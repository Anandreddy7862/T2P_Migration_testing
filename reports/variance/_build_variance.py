"""Throwaway: compare Tableau vs Power BI visual CSV exports, emit variance report."""
import csv
import html
import json
import os
import re
import sys
from datetime import datetime

ROOT = os.getcwd()
DL = os.path.join(ROOT, 'downloads')
OUT_DIR = os.path.join(ROOT, 'reports', 'variance')
TEMPLATE = os.path.join(ROOT, '.claude', 'skills', 'bi-variance-report', 'report-template.html')
THRESHOLD = 0.5
AGG = {'sum', 'avg', 'average', 'min', 'max', 'of'}


def norm_name(s):
    return re.sub(r'[\s_-]+', ' ', s.strip().lower()).strip()


def strip_index(fname):
    base = fname[:-4] if fname.lower().endswith('.csv') else fname
    return re.sub(r'^\d+_', '', base)


def norm_measure(raw):
    s = re.sub(r'[^a-z0-9]+', ' ', raw.strip().lower())
    s = re.sub(r'\s+', ' ', s).strip()
    if s.startswith('count of ') or s == 'count':
        return 'count'
    prev, toks = s, s.split()
    while toks and toks[0] in AGG:
        toks = toks[1:]
        if not toks:
            break
        prev = ' '.join(toks)
    out = ' '.join(toks) if toks else prev
    if out.startswith('count of ') or out == 'count':
        return 'count'
    return out or prev


NUM_RE = re.compile(r'^-?\d+(\.\d+)?$')


def norm_value(raw):
    s = (raw or '').strip()
    c = s.replace('$', '').replace(',', '').replace('%', '').replace(' ', '')
    if NUM_RE.match(c):
        return float(c), c
    return None, c.lower()


def read_csv(path):
    with open(path, 'r', encoding='utf-8-sig', newline='') as f:
        rows = [r for r in csv.reader(f) if any(x.strip() for x in r)]
    if not rows:
        return None, []
    return rows[0], rows[1:]


def canonicalise(path):
    header, rows = read_csv(path)
    if header is None:
        return None, {}, 0, {}
    hdr = [h.strip() for h in header]
    low = [h.lower() for h in hdr]
    cells, labels = {}, {}

    def put(key, raw_m, raw_v):
        m = norm_measure(raw_m)
        num, s = norm_value(raw_v)
        labels.setdefault(m, raw_m.strip())
        cells[(key.strip(), m)] = {'raw': raw_v.strip(), 'num': num, 'str': s}

    has_mn, has_mv = 'measure names' in low, 'measure values' in low
    if has_mn and has_mv:
        i_mn, i_mv = low.index('measure names'), low.index('measure values')
        for r in rows:
            if len(r) > max(i_mn, i_mv):
                put(r[0], r[i_mn], r[i_mv])
    elif has_mn:
        i_mn = low.index('measure names')
        for r in rows:
            for ci in range(1, len(hdr)):
                if ci != i_mn and ci < len(r):
                    put(r[0], hdr[ci], r[ci])
    else:
        for r in rows:
            for ci in range(1, len(hdr)):
                if ci < len(r):
                    put(r[0], hdr[ci], r[ci])
    return hdr[0], cells, len(rows), labels


def list_visuals(platform):
    base, out = os.path.join(DL, platform), {}
    if not os.path.isdir(base):
        return out
    for dash in sorted(os.listdir(base)):
        d = os.path.join(base, dash)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if fn.lower().endswith('.csv'):
                out.setdefault(norm_name(dash), {})[norm_name(strip_index(fn))] = {
                    'dash_raw': dash, 'file': fn, 'rel': platform + '/' + dash + '/' + fn,
                    'abs': os.path.join(d, fn), 'visual_raw': strip_index(fn)}
    return out


def variance(t, p):
    if t is None or p is None:
        return None, '-', False
    tn, pn = t['num'], p['num']
    if tn is None or pn is None:
        ok = t['str'] == p['str']
        return (0.0 if ok else None), ('0.00%' if ok else 'n/a'), ok
    if tn == 0 and pn == 0:
        return 0.0, '0.00%', True
    if tn == 0:
        return None, 'n/a', False
    v = ((pn - tn) / abs(tn)) * 100.0
    return v, '%+.2f%%' % v, abs(v) <= THRESHOLD


tab, pbi = list_visuals('tableau'), list_visuals('powerbi')
dashboards, unpaired, audit = [], [], []
tot_cells = tot_pass = tot_fail = tot_visuals = 0

for dash in sorted(set(tab) | set(pbi)):
    tv, pv = tab.get(dash, {}), pbi.get(dash, {})
    dash_label = (next(iter(tv.values()))['dash_raw'] if tv
                  else next(iter(pv.values()))['dash_raw'])
    visuals = []
    for vname in sorted(set(tv) | set(pv)):
        t_meta, p_meta = tv.get(vname), pv.get(vname)
        if not t_meta or not p_meta:
            meta = t_meta or p_meta
            unpaired.append({'dashboard': dash_label, 'visual': meta['visual_raw'],
                             'present_on': 'Tableau' if t_meta else 'Power BI',
                             'missing_on': 'Power BI' if t_meta else 'Tableau',
                             'file': meta['rel']})
            tot_fail += 1
            continue
        tot_visuals += 1
        audit.append({'dashboard': dash_label, 'tableau_file': t_meta['rel'],
                      'powerbi_file': p_meta['rel'],
                      'reason': 'visual name %s (index prefix stripped)' % vname})
        t_dim, t_cells, t_rows, t_labels = canonicalise(t_meta['abs'])
        p_dim, p_cells, p_rows, p_labels = canonicalise(p_meta['abs'])
        keys = sorted(set(t_cells) | set(p_cells))
        rows_out, n_pass, n_fail, max_var = [], 0, 0, None
        for k in keys:
            t, p = t_cells.get(k), p_cells.get(k)
            v, disp, ok = variance(t, p)
            note = ''
            if t is None:
                note = 'key/measure on Power BI only'
            elif p is None:
                note = 'key/measure on Tableau only'
            if v is not None and (max_var is None or abs(v) > abs(max_var)):
                max_var = v
            rows_out.append({'key': k[0],
                             'measure': t_labels.get(k[1]) or p_labels.get(k[1]) or k[1],
                             'measure_norm': k[1],
                             'tableau': t['raw'] if t else '(missing)',
                             'powerbi': p['raw'] if p else '(missing)',
                             'variance': disp, 'variance_pct': v,
                             'status': 'PASS' if ok else 'FAIL', 'note': note})
            n_pass += ok
            n_fail += (not ok)
        rows_out.sort(key=lambda r: (r['status'] == 'PASS', r['key'], r['measure']))
        tot_cells += len(rows_out)
        tot_pass += n_pass
        tot_fail += n_fail
        allk = set(t_cells) | set(p_cells)
        t_only = sorted(set(m for _, m in t_cells) - set(m for _, m in p_cells))
        p_only = sorted(set(m for _, m in p_cells) - set(m for _, m in t_cells))
        visuals.append({'name': t_meta['visual_raw'], 'dimension': t_dim or p_dim or 'Key',
                        'status': 'PASS' if (n_fail == 0 and rows_out) else 'FAIL',
                        'tableau_file': t_meta['rel'], 'powerbi_file': p_meta['rel'],
                        'tableau_rows': t_rows, 'powerbi_rows': p_rows,
                        'n_keys': len(set(k for k, _ in allk)),
                        'n_measures': len(set(m for _, m in allk)),
                        'n_cells': len(rows_out), 'n_pass': n_pass, 'n_fail': n_fail,
                        'max_variance': ('%+.2f%%' % max_var) if max_var is not None else 'n/a',
                        'tableau_only_measures': t_only, 'powerbi_only_measures': p_only,
                        'rows': rows_out})
    d_unp = [u for u in unpaired if u['dashboard'] == dash_label]
    ok_dash = bool(visuals) and all(v['status'] == 'PASS' for v in visuals) and not d_unp
    dashboards.append({'name': dash_label, 'status': 'PASS' if ok_dash else 'FAIL',
                       'visuals': visuals})

verdict = 'PASS' if (tot_fail == 0 and not unpaired) else 'FAIL'
newest = max((os.path.getmtime(os.path.join(dp, f)) for dp, _, fs in os.walk(DL)
              for f in fs if f.lower().endswith('.csv')), default=0)
data_ts = datetime.fromtimestamp(newest).strftime('%Y-%m-%d %H:%M:%S') if newest else 'n/a'
gen_ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

payload = {'generated': gen_ts, 'data_newest_file': data_ts, 'threshold_pct': THRESHOLD,
           'variance_formula': '((powerbi - tableau) / abs(tableau)) * 100',
           'sources': {'tableau': 'downloads/tableau', 'powerbi': 'downloads/powerbi'},
           'summary': {'dashboards': len(dashboards), 'visuals_validated': tot_visuals,
                       'values_compared': tot_cells, 'pass': tot_pass, 'fail': tot_fail,
                       'unpaired_visuals': len(unpaired), 'verdict': verdict},
           'dashboards': dashboards, 'unpaired': unpaired, 'pairing_audit': audit}
os.makedirs(OUT_DIR, exist_ok=True)
with open(os.path.join(OUT_DIR, 'variance.json'), 'w', encoding='utf-8') as f:
    json.dump(payload, f, indent=2)

e = html.escape


def cls(s):
    return 'pass' if s == 'PASS' else 'fail'


FILT = ('Row counts differ &mdash; Tableau exported %d data row(s) against %d on Power BI. '
        'Keys present on only one side are failed below. A lopsided count like this usually points '
        'at the extraction run rather than the migration: the click that selected the visual landed '
        'on a mark, so a <b>filtered</b> visual was exported.')

body = []
for d in dashboards:
    body.append('  <h2>%s <span class="badge %s">%s</span></h2>'
                % (e(d['name']), cls(d['status']), d['status']))
    for v in d['visuals']:
        notes = []
        if v['tableau_rows'] != v['powerbi_rows']:
            notes.append(FILT % (v['tableau_rows'], v['powerbi_rows']))
        if v['tableau_only_measures']:
            notes.append('Measure on <b>Tableau only</b>: ' + ', '.join(
                '<code>%s</code>' % e(m) for m in v['tableau_only_measures']))
        if v['powerbi_only_measures']:
            notes.append('Measure on <b>Power BI only</b>: ' + ', '.join(
                '<code>%s</code>' % e(m) for m in v['powerbi_only_measures']))
        body.append('  <div class="visual">')
        body.append('    <div class="head">')
        body.append('      <span class="name">%s <span class="badge %s">%s</span></span>'
                    % (e(v['name']), cls(v['status']), v['status']))
        body.append('      <span class="stats">%d keys &middot; %d measures &middot; %d values '
                    '(%d pass / %d fail) &middot; Tableau %d rows vs Power BI %d rows &middot; '
                    'max variance %s</span>'
                    % (v['n_keys'], v['n_measures'], v['n_cells'], v['n_pass'], v['n_fail'],
                       v['tableau_rows'], v['powerbi_rows'], v['max_variance']))
        body.append('    </div>')
        body.append('    <div class="stats" style="font-size:12px;margin:2px 0 6px">'
                    '<code>%s</code> vs <code>%s</code></div>'
                    % (e(v['tableau_file']), e(v['powerbi_file'])))
        for n in notes:
            body.append('    <div class="note">%s</div>' % n)
        body.append('    <div class="scroll">\n      <table>\n        <thead>\n          <tr>'
                    '<th>%s</th><th>Measure</th><th class="num">Tableau</th>'
                    '<th class="num">Power BI</th><th class="num">Variance %%</th><th>Status</th>'
                    '</tr>\n        </thead>\n        <tbody>' % e(v['dimension']))
        for r in v['rows']:
            c = cls(r['status'])
            m = e(r['measure'])
            if r['note']:
                m += ' <span class="stats">(%s)</span>' % e(r['note'])
            body.append('          <tr class="%s"><td>%s</td><td>%s</td>'
                        '<td class="num t-val">%s</td><td class="num p-val">%s</td>'
                        '<td class="num var">%s</td>'
                        '<td><span class="badge %s">%s</span></td></tr>'
                        % (c, e(r['key']), m, e(r['tableau']), e(r['powerbi']),
                           e(r['variance']), c, r['status']))
        body.append('        </tbody>\n      </table>\n    </div>\n  </div>')

if unpaired:
    up = '\n'.join('        <tr class="fail"><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>'
                   % (e(u['dashboard']), e(u['visual']), e(u['present_on']), e(u['missing_on']))
                   for u in unpaired)
else:
    up = ('        <tr class="pass"><td colspan="4">None &mdash; every visual paired across '
          'both platforms.</td></tr>')
aud = '\n'.join('        <tr><td>%s</td><td><code>%s</code></td><td><code>%s</code></td>'
                '<td>%s</td></tr>'
                % (e(a['dashboard']), e(a['tableau_file']), e(a['powerbi_file']), e(a['reason']))
                for a in audit)

with open(TEMPLATE, 'r', encoding='utf-8') as f:
    tpl = f.read()
tpl = re.sub(r'<!--\s*TEMPLATE NOTES.*?-->', '', tpl, flags=re.S)
start = tpl.index('  <!-- ================= per-visual detail')
end = tpl.index('  <!-- ================= unpaired')
tpl = tpl[:start] + '\n'.join(body) + '\n\n' + tpl[end:]
tpl = tpl.replace('        <tr class="fail"><td>{{U_DASHBOARD}}</td><td>{{U_VISUAL}}</td>'
                  '<td>{{U_PRESENT}}</td><td>{{U_MISSING}}</td></tr>', up)
tpl = tpl.replace('        <tr><td>{{A_DASHBOARD}}</td><td><code>{{A_TABLEAU_FILE}}</code></td>'
                  '<td><code>{{A_POWERBI_FILE}}</code></td><td>{{A_REASON}}</td></tr>', aud)
for k, val in [('{{DASHBOARDS}}', len(dashboards)), ('{{VISUALS}}', tot_visuals),
               ('{{CELLS_COMPARED}}', tot_cells), ('{{N_PASS}}', tot_pass),
               ('{{N_FAIL}}', tot_fail), ('{{TIMESTAMP}}', gen_ts),
               ('{{DATA_TIMESTAMP}}', data_ts),
               ('{{VERDICT}}', '<span class="badge %s">%s</span>' % (cls(verdict), verdict))]:
    tpl = tpl.replace(k, str(val))
leftover = sorted(set(re.findall(r'\{\{[A-Z_]+\}\}', tpl)))
with open(os.path.join(OUT_DIR, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(tpl)

print('')
print('Data: newest CSV %s  |  threshold %s%% absolute variance' % (data_ts, THRESHOLD))
print('')
for d in dashboards:
    print('%s: %s' % (d['name'], d['status']))
    for v in d['visuals']:
        flag = '' if v['status'] == 'PASS' else '   <== FAIL'
        print('   %-4s  %-34s %3d pass / %3d fail   rows T%d:P%d%s'
              % (v['status'], v['name'], v['n_pass'], v['n_fail'],
                 v['tableau_rows'], v['powerbi_rows'], flag))
print('')
print('Dashboards %d | visuals %d | values %d | pass %d | fail %d | unpaired %d'
      % (len(dashboards), tot_visuals, tot_cells, tot_pass, tot_fail, len(unpaired)))
print('VERDICT: %s' % verdict)
if leftover:
    print('WARNING unfilled placeholders: %s' % leftover, file=sys.stderr)
print('Report: reports/variance/index.html')
