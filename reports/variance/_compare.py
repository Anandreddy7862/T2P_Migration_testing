#!/usr/bin/env python3
"""Canonicalise the Tableau/Power BI CSV exports, compute variance, emit the report."""
import csv, io, json, os, re, sys, html
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
T_ROOT = os.path.join(ROOT, 'downloads', 'tableau')
P_ROOT = os.path.join(ROOT, 'downloads', 'powerbi')
OUT_DIR = os.path.join(ROOT, 'reports', 'variance')
TEMPLATE = os.path.join(ROOT, '.claude', 'skills', 'bi-variance-report', 'report-template.html')
THRESHOLD = 0.5

AGG = re.compile(r'^(sum|avg|average|min|max)( of)?\b\s*(.*)$')


def norm_name(s):
    """Folder / visual pairing key: index prefix stripped, _ - space equivalent, case-insensitive."""
    s = re.sub(r'^\d+_', '', s)
    s = re.sub(r'\.csv$', '', s, flags=re.I)
    return re.sub(r'[_\-\s]+', ' ', s).strip().lower()


def norm_measure(m):
    s = re.sub(r'[^a-z0-9 ]+', ' ', m.lower())
    s = re.sub(r'\s+', ' ', s).strip()
    if s == 'count' or re.match(r'^count of\b', s):
        return 'count'
    while True:
        mm = AGG.match(s)
        if not mm:
            break
        rest = mm.group(3).strip()
        if not rest:
            break  # stripping would empty the name -> keep the last non-empty form
        s = rest
    if re.match(r'^count of\b', s):
        return 'count'
    return s


def norm_value(raw):
    s = (raw or '').strip()
    cleaned = s.replace('$', '').replace(',', '').replace('%', '').replace(' ', '')
    if cleaned in ('', '-'):
        return None, ''
    try:
        return float(cleaned), cleaned
    except ValueError:
        return None, re.sub(r'\s+', ' ', s).strip().lower()


def read_csv(path):
    with open(path, 'rb') as fh:
        data = fh.read()
    rows = list(csv.reader(io.StringIO(data.decode('utf-8-sig'))))  # utf-8-sig strips the BOM
    rows = [r for r in rows if any((c or '').strip() for c in r)]
    if not rows:
        return None, []
    return [(c or '').strip() for c in rows[0]], rows[1:]


def canonicalise(path):
    header, rows = read_csv(path)
    if header is None:
        return None, {}, 0, 'empty'
    lower = [h.lower() for h in header]
    cells = {}

    def put(key, measure, raw):
        num, s = norm_value(raw)
        cells[(key, norm_measure(measure))] = (num, s, (raw or '').strip())

    if 'measure names' in lower and 'measure values' in lower:
        shape = 'tableau-long'
        mn, mv = lower.index('measure names'), lower.index('measure values')
        for r in rows:
            if len(r) <= max(mn, mv):
                continue
            put(r[0].strip(), r[mn].strip(), r[mv])
    elif 'measure names' in lower:
        shape = 'measure-names-only'
        mn = lower.index('measure names')
        for r in rows:
            for i, h in enumerate(header):
                if i == 0 or i == mn or i >= len(r):
                    continue
                put(r[0].strip(), h, r[i])
    else:
        shape = 'wide'
        for r in rows:
            for i, h in enumerate(header):
                if i == 0 or i >= len(r):
                    continue
                put(r[0].strip(), h, r[i])
    return header[0], cells, len(rows), shape


def variance(t, p):
    if t is None or p is None:
        return None, 'n/a', False
    tn, ts, _ = t
    pn, ps, _ = p
    if tn is not None and pn is not None:
        if tn == 0 and pn == 0:
            return 0.0, '0.00%', True
        if tn == 0:
            return None, 'n/a', False
        pct = ((pn - tn) / abs(tn)) * 100
        return pct, '%+.2f%%' % pct, abs(pct) <= THRESHOLD
    return None, 'n/a (text)', ts == ps


def index_tree(root):
    out = {}
    if not os.path.isdir(root):
        return out
    for dash in sorted(os.listdir(root)):
        d = os.path.join(root, dash)
        if not os.path.isdir(d):
            continue
        files = {}
        for f in sorted(os.listdir(d)):
            if f.lower().endswith('.csv'):
                files[norm_name(f)] = f
        out[norm_name(dash)] = {'raw': dash, 'files': files}
    return out


tab, pbi = index_tree(T_ROOT), index_tree(P_ROOT)
if not tab or not pbi:
    sys.exit('FATAL: a download tree is missing or empty - run `npm run test:extract` first.')

newest = max(os.path.getmtime(os.path.join(r, d, f))
             for r in (T_ROOT, P_ROOT)
             for d in os.listdir(r) if os.path.isdir(os.path.join(r, d))
             for f in os.listdir(os.path.join(r, d)) if f.lower().endswith('.csv'))

dashboards, unpaired, audit = [], [], []
tot_cells = tot_pass = tot_fail = 0

for dkey in sorted(set(tab) | set(pbi)):
    t_d, p_d = tab.get(dkey), pbi.get(dkey)
    name = (t_d or p_d)['raw']
    if not t_d or not p_d:
        side = 'Tableau' if t_d else 'Power BI'
        miss = 'Power BI' if t_d else 'Tableau'
        for _vk, f in (t_d or p_d)['files'].items():
            unpaired.append({'dashboard': name, 'visual': f, 'present': side, 'missing': miss})
            tot_fail += 1
        continue

    visuals = []
    for vkey in sorted(set(t_d['files']) | set(p_d['files'])):
        tf, pf = t_d['files'].get(vkey), p_d['files'].get(vkey)
        if not tf or not pf:
            unpaired.append({'dashboard': name, 'visual': tf or pf,
                             'present': 'Tableau' if tf else 'Power BI',
                             'missing': 'Power BI' if tf else 'Tableau'})
            tot_fail += 1
            continue

        t_dim, t_cells, t_rows, t_shape = canonicalise(os.path.join(T_ROOT, t_d['raw'], tf))
        p_dim, p_cells, p_rows, p_shape = canonicalise(os.path.join(P_ROOT, p_d['raw'], pf))
        audit.append({'dashboard': name,
                      'tableau_file': t_d['raw'] + '/' + tf,
                      'powerbi_file': p_d['raw'] + '/' + pf,
                      'reason': 'name match after stripping index prefix -> "%s"' % vkey,
                      'tableau_shape': t_shape, 'powerbi_shape': p_shape})

        rows_out = []
        n_pass = n_fail = 0
        max_var = 0.0
        for key, meas in sorted(set(t_cells) | set(p_cells)):
            t, p = t_cells.get((key, meas)), p_cells.get((key, meas))
            pct, disp, ok = variance(t, p)
            if pct is not None:
                max_var = max(max_var, abs(pct))
            note = ''
            if t is None:
                note = 'key/measure missing on Tableau'
            elif p is None:
                note = 'key/measure missing on Power BI'
            elif t[0] == 0 and p[0] not in (None, 0):
                note = 'Tableau baseline is 0 - variance undefined'
            rows_out.append({'key': key, 'measure': meas,
                             'tableau': t[2] if t else None,
                             'powerbi': p[2] if p else None,
                             'variance_pct': None if pct is None else round(pct, 4),
                             'variance_display': disp,
                             'status': 'PASS' if ok else 'FAIL', 'note': note})
            n_pass += ok
            n_fail += (not ok)

        rows_out.sort(key=lambda r: (r['status'] == 'PASS', r['key'], r['measure']))
        one_sided = sum(1 for r in rows_out if r['tableau'] is None or r['powerbi'] is None)

        # A row-count mismatch is only a data gap when cells are actually one-sided.
        # Tableau exports long (one row per key x measure) where Power BI exports wide
        # (one row per key, measures as columns), so the same data legitimately yields
        # different row counts.
        row_note = ''
        if t_rows != p_rows:
            if one_sided:
                row_note = ('row counts differ and %d value(s) exist on one platform only - '
                            'genuine data gap' % one_sided)
            else:
                row_note = ('row counts differ by export shape only (Tableau %s vs Power BI %s); '
                            'both sides carry the same %d values across %d keys x %d measures'
                            % (t_shape, p_shape, len(rows_out),
                               len({r['key'] for r in rows_out}),
                               len({r['measure'] for r in rows_out})))

        tot_cells += len(rows_out)
        tot_pass += n_pass
        tot_fail += n_fail
        visuals.append({'one_sided_cells': one_sided, 'row_count_note': row_note,
                        'tableau_shape': t_shape, 'powerbi_shape': p_shape,
                        'visual': re.sub(r'^\d+_|\.csv$', '', tf),
                        'tableau_file': tf, 'powerbi_file': pf,
                        'dimension': t_dim or p_dim or 'Key',
                        'keys': len({r['key'] for r in rows_out}),
                        'measures': len({r['measure'] for r in rows_out}),
                        'cells': len(rows_out), 'tableau_rows': t_rows, 'powerbi_rows': p_rows,
                        'max_variance_pct': round(max_var, 4),
                        'pass': n_pass, 'fail': n_fail,
                        'status': 'PASS' if n_fail == 0 and rows_out else 'FAIL',
                        'rows': rows_out})

    visuals.sort(key=lambda v: (v['status'] == 'PASS', v['visual'].lower()))
    dashboards.append({'dashboard': name, 'visuals': visuals,
                       'status': 'PASS' if visuals and all(v['status'] == 'PASS' for v in visuals) else 'FAIL'})

verdict = 'PASS' if tot_fail == 0 and not unpaired else 'FAIL'
gen = datetime.now()
payload = {
    'generated': gen.isoformat(timespec='seconds'),
    'data_newest': datetime.fromtimestamp(newest).isoformat(timespec='seconds'),
    'sources': {'tableau': 'downloads/tableau', 'powerbi': 'downloads/powerbi'},
    'threshold_pct': THRESHOLD,
    'formula': '((powerbi - tableau) / abs(tableau)) * 100',
    'totals': {'dashboards': len(dashboards),
               'visuals': sum(len(d['visuals']) for d in dashboards),
               'cells_compared': tot_cells, 'pass': tot_pass, 'fail': tot_fail,
               'unpaired': len(unpaired)},
    'verdict': verdict,
    'dashboards': dashboards,
    'unpaired_visuals': unpaired,
    'pairing_audit': audit,
}
os.makedirs(OUT_DIR, exist_ok=True)
with open(os.path.join(OUT_DIR, 'variance.json'), 'w', encoding='utf-8') as fh:
    json.dump(payload, fh, indent=2)

# ------------------------------------------------------------------ HTML
def e(s):
    return html.escape(str(s if s is not None else ''))


def cls(s):
    return 'pass' if s == 'PASS' else 'fail'


def badge(s):
    return '<span class="badge %s">%s</span>' % (cls(s), s)


DASH = '&mdash;'
body = []
for d in dashboards:
    body.append('  <h2>%s %s</h2>' % (e(d['dashboard']), badge(d['status'])))
    for v in d['visuals']:
        lop = ' &middot; <b>row counts differ</b>' if v['row_count_note'] else ''
        body.append('  <div class="visual">')
        body.append('    <div class="head">')
        body.append('      <span class="name">%s %s</span>' % (e(v['visual']), badge(v['status'])))
        body.append('      <span class="stats">%d keys &middot; %d measures &middot; %d values &middot; '
                    '%d pass / %d fail &middot; Tableau %d rows vs Power BI %d rows &middot; '
                    'max variance %.2f%%%s</span>'
                    % (v['keys'], v['measures'], v['cells'], v['pass'], v['fail'],
                       v['tableau_rows'], v['powerbi_rows'], v['max_variance_pct'], lop))
        body.append('    </div>')
        if v['fail']:
            body.append('    <div class="note">%d of %d values failed. Failing rows are listed first.</div>'
                        % (v['fail'], v['cells']))
        if v['row_count_note']:
            style_cls = 'note' if v['one_sided_cells'] else 'shape'
            body.append('    <div class="%s">%s</div>' % (style_cls, e(v['row_count_note'])))
        body.append('    <div class="scroll"><table><thead><tr><th>%s</th><th>Measure</th>'
                    '<th class="num">Tableau</th><th class="num">Power BI</th>'
                    '<th class="num">Variance %%</th><th>Status</th></tr></thead><tbody>'
                    % e(v['dimension']))
        for r in v['rows']:
            note = ' <span class="stats">(%s)</span>' % e(r['note']) if r['note'] else ''
            body.append('      <tr class="%s"><td>%s</td><td>%s%s</td>'
                        '<td class="num t-val">%s</td><td class="num p-val">%s</td>'
                        '<td class="num var">%s</td><td>%s</td></tr>'
                        % (cls(r['status']), e(r['key']), e(r['measure']), note,
                           e(r['tableau']) if r['tableau'] is not None else DASH,
                           e(r['powerbi']) if r['powerbi'] is not None else DASH,
                           e(r['variance_display']), badge(r['status'])))
        body.append('    </tbody></table></div>')
        body.append('  </div>')

body.append('  <h2>Unpaired visuals</h2>')
if unpaired:
    body.append('  <p class="sub">Present on one platform only, so the data cannot be validated. '
                'Counted as a failure.</p>')
    body.append('  <div class="scroll"><table><thead><tr><th>Dashboard</th><th>Visual</th>'
                '<th>Present on</th><th>Missing on</th></tr></thead><tbody>')
    for u in unpaired:
        body.append('    <tr class="fail"><td>%s</td><td><code>%s</code></td><td>%s</td><td>%s</td></tr>'
                    % (e(u['dashboard']), e(u['visual']), e(u['present']), e(u['missing'])))
    body.append('  </tbody></table></div>')
else:
    body.append('  <p class="sub">None &mdash; every visual was found on both platforms and validated.</p>')

body.append('  <h2>Pairing audit</h2>')
body.append('  <p class="sub">Which Tableau file was compared against which Power BI file. The '
            '<code>index_</code> prefix is stripped before matching, because a visual&rsquo;s canvas '
            'position does not correspond across platforms.</p>')
body.append('  <div class="scroll"><table><thead><tr><th>Dashboard</th><th>Tableau file</th>'
            '<th>Power BI file</th><th>Matched on</th><th>Shape (T / PBI)</th></tr></thead><tbody>')
for a in audit:
    body.append('    <tr><td>%s</td><td><code>%s</code></td><td><code>%s</code></td><td>%s</td>'
                '<td>%s / %s</td></tr>'
                % (e(a['dashboard']), e(a['tableau_file']), e(a['powerbi_file']),
                   e(a['reason']), e(a['tableau_shape']), e(a['powerbi_shape'])))
body.append('  </tbody></table></div>')

with open(TEMPLATE, encoding='utf-8') as fh:
    tpl = fh.read()
style = tpl[tpl.index('<style>'):tpl.index('</style>')]
# informational counterpart to .note: a row-count difference that is only an export-shape
# difference, not a data gap, so it must not be coloured like a failure
style += ('  .shape { border-left: 3px solid var(--muted); background: var(--head); '
          'padding: 10px 14px; border-radius: 0 8px 8px 0; margin: 10px 0; '
          'font-size: 13px; color: var(--muted); }\n</style>')

doc = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tableau to Power BI Variance Report</title>
%s
</head>
<body>
<div class="wrap">

  <h1>Tableau to Power BI variance report</h1>
  <p class="sub">Data validation for the migrated dashboards. Tableau is the baseline; Power BI is the platform under validation.</p>

  <div class="cards">
    <div class="card"><div class="n">%d</div><div class="l">Dashboards</div></div>
    <div class="card"><div class="n">%d</div><div class="l">Visuals validated</div></div>
    <div class="card"><div class="n">%d</div><div class="l">Values compared</div></div>
    <div class="card"><div class="n">%d</div><div class="l">Pass</div></div>
    <div class="card"><div class="n">%d</div><div class="l">Fail</div></div>
  </div>

  <div class="meta">
    <div><b>Generated</b> %s</div>
    <div><b>Sources</b> <code>downloads/tableau</code> vs <code>downloads/powerbi</code> (newest file %s)</div>
    <div><b>Variance</b> <code>((powerbi - tableau) / abs(tableau)) * 100</code></div>
    <div><b>Threshold</b> PASS at or under 0.5%% variance &middot; FAIL above it, or when a value exists on one platform only</div>
    <div><b>Verdict</b> %s</div>
  </div>

%s

  <footer>
    Generated by the <code>bi-variance-report</code> skill. Machine-readable findings: <code>reports/variance/variance.json</code>.
  </footer>

</div>
</body>
</html>
''' % (style, payload['totals']['dashboards'], payload['totals']['visuals'], tot_cells,
       tot_pass, tot_fail, gen.strftime('%Y-%m-%d %H:%M:%S'),
       datetime.fromtimestamp(newest).strftime('%Y-%m-%d %H:%M:%S'),
       badge(verdict), '\n'.join(body))

with open(os.path.join(OUT_DIR, 'index.html'), 'w', encoding='utf-8') as fh:
    fh.write(doc)

# ------------------------------------------------------------------ console
print('Threshold +/-%.1f%%   Formula ((powerbi - tableau) / abs(tableau)) * 100' % THRESHOLD)
for d in dashboards:
    print('')
    print('%s  %s' % (d['dashboard'], d['status']))
    for v in d['visuals']:
        print('  %-4s %-34s %3d values  %3d pass  %3d fail   rows T%-3d P%-3d   max var %.2f%%'
              % (v['status'], v['visual'], v['cells'], v['pass'], v['fail'],
                 v['tableau_rows'], v['powerbi_rows'], v['max_variance_pct']))
        if v['row_count_note']:
            print('       ^ %s' % v['row_count_note'])
fails = [d['dashboard'] + '/' + v['visual'] for d in dashboards for v in d['visuals'] if v['status'] == 'FAIL']
print('')
print('Failing visuals: %s' % (', '.join(fails) if fails else 'none'))
print('Unpaired visuals: %d' % len(unpaired))
print('TOTAL %d values  %d pass  %d fail  ->  %s' % (tot_cells, tot_pass, tot_fail, verdict))
print('Report: reports/variance/index.html')
