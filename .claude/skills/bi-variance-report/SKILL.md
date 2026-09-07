---
name: bi-variance-report
description: Compare the CSVs downloaded from Tableau and Power BI and produce an HTML variance report. Use after the tableau and powerbi extraction suites have run, or whenever the user asks to validate migrated dashboard data, compare Tableau vs Power BI numbers, or generate a variance / data-validation report.
---

# Tableau to Power BI data variance report

Validates that a migrated dashboard shows the **same numbers** in Power BI as it
does in Tableau. Tableau is the baseline; Power BI is what is being validated.

## Inputs

Both extraction suites write one CSV per visual:

```
downloads/tableau/<dashboard>/<index>_<VisualName>.csv
downloads/powerbi/<page>/<index>_<VisualName>.csv
```

## Step 1 - make sure the data is current

Check both trees exist and are non-empty, and report the newest file's timestamp
so a stale comparison is never passed off as a fresh one:

```bash
find downloads -name '*.csv' -printf '%T+  %p\n' | sort
```

If either tree is missing or older than the user expects, run the extraction
first - it takes a few minutes per platform:

```bash
npm run test:extract      # tableau, then powerbi
```

Never invent data for a missing file. A visual with no CSV on one side is an
**unpaired visual** and is reported as such.

## Step 2 - pair the files by name

The visual name is identical on both platforms, so the name is the pairing key.
Two rules:

- **Strip the `<index>_` prefix before matching.** The index is the visual's
  position on the canvas and it does *not* correspond across platforms. Observed:
  `DualAxis` is Tableau `2_DualAxis.csv` but Power BI `0_DualAxis.csv`. Matching
  on the full filename would pair three visuals wrongly on that page alone.
- Compare the remaining name case-insensitively, treating `_`, `-` and spaces as
  equivalent. Dashboard folders pair the same way (`Analysis` to `Analysis`,
  `analysis_2` to `analysis_2`).

Anything left over on either side goes in the **Unpaired visuals** section. Do
not force a pair by position.

## Step 3 - canonicalise both CSVs before comparing

The two platforms export the *same visual* in different shapes, so never diff
rows positionally. Reduce each file to a set of `(key, measure, value)` triples
keyed on the dimension value - this also makes the comparison order-insensitive,
which matters because Tableau sorts alphabetically and Power BI by descending
measure.

Every file starts with a UTF-8 BOM; strip it from the first header.

**Shape detection**, in order:

1. Headers contain **both** `Measure Names` and `Measure Values` - Tableau long
   format. Key = column 1, measure = the `Measure Names` cell, value = the
   `Measure Values` cell.
   ```
   Country,Measure Names,Measure Values
   United States,Entry Fee USD,317   ->  (United States, entry fee usd, 317)
   ```
2. Headers contain `Measure Names` but **no** `Measure Values` - the real measures
   are the other columns; ignore the `Measure Names` column entirely.
   ```
   Region,Measure Names,Annual Visitors Millions
   East Asia,Annual Visitors Millions,19  ->  (East Asia, annual visitors millions, 19)
   ```
3. Otherwise wide - key = column 1, melt every remaining column into one measure
   each. This is the normal Power BI shape.
   ```
   Country,Sum Annual Visitors Millions,Count of Places
   United States,205.10,10   ->  (United States, annual visitors millions, 205.10)
                                 (United States, count, 10)
   ```

**Measure-name normalisation** - lowercase, collapse whitespace, drop
punctuation, then:

- Strip **every** leading aggregate token (`sum`, `avg`, `average`, `min`,
  `max`), repeatedly until none is left. Power BI writes
  `Sum Average Visit Duration Hours` where Tableau writes
  `Average Visit Duration Hours`; stripping greedily makes both
  `visit duration hours`, while stripping only one leaves
  `average visit duration hours` against `visit duration hours` and the same
  measure silently fails to pair. If stripping empties the name, keep the last
  non-empty form.
- `count of <anything>` becomes `count`, which pairs Power BI's `Count of Places`
  with Tableau's `Count of world_famous_places_2024.csv`.

**Value normalisation** - strip `$`, `,`, `%` and spaces, then parse as a number.
Keep the raw string too; the report shows raw values, the comparison uses
numbers. `$317` equals `317`, `19.00` equals `19`, `205.10` equals `205.1`.
Values that are not numeric compare as normalised strings.

## Step 4 - compute the variance

Tableau is the baseline:

```
variance % = ((powerbi - tableau) / abs(tableau)) * 100
```

- both values `0` gives `0%`
- tableau `0` with a non-zero Power BI value - variance is undefined; render `n/a`
  and fail the row
- a key or measure present on one side only fails the row, with no percentage

**Threshold** - one tolerance, and the status is binary:

| Status | Condition |
|---|---|
| `PASS` | absolute variance at or under **0.5%** |
| `FAIL` | absolute variance over 0.5%; or tableau is 0 with a non-zero Power BI value; or the key/measure exists on only one platform |

0.5% absorbs Power BI's 2-decimal formatting and genuine rounding (`19.00` against
`19` is 0.00%) without hiding a real difference.

A **visual** is `PASS` only when every one of its values passes; one failing value
fails the visual. A **dashboard** is `PASS` only when every visual passes, and the
run is `PASS` only when every dashboard passes.

**Arithmetic accuracy matters more than speed.** For a pair with more than about
50 comparable cells, do the numbers with a short throwaway script (`python -` or
`node -e`) instead of by eye, then report what the script computed. A confidently
wrong percentage is worse than a slow one.

## Step 5 - validate every file, exclude nothing

Every CSV in `downloads/` is compared and every comparison counts toward the
result. Nothing is filtered out, held back as a warning, or left out of the
totals.

When one platform returns fewer rows than the other, the keys it is missing
become `FAIL` rows - that is a genuine failure to reproduce the data, whatever
its cause. Do not suppress them and do not soften the visual's status.

Still report **Tableau rows vs Power BI rows** on every visual. A visual whose
sides differ 1 row against 23 will fail on a block of missing keys, and the row
counts are what tell the reader the cause at a glance. Both extractors can export
a *filtered* visual when the click that selects it lands on a mark or data point,
so a lopsided row count usually points at the extraction run rather than the
migration - say so in the summary when you see it, but keep the `FAIL`.

## Step 6 - write the report

Fill in `report-template.html` (next to this file) and write it to
`reports/variance/index.html`. It is self-contained: inline CSS, no CDN, no
external requests. Required content:

1. **Summary** - generated timestamp, source folders, dashboards compared,
   visuals validated, values compared, pass and fail counts, and the overall
   verdict. State the threshold used.
2. **Per-visual detail, for every visual on every dashboard** - a table with one
   row per `(key, measure)`: dimension value, measure, **Tableau value**,
   **Power BI value**, **variance %**, `PASS`/`FAIL`. This is the core of the
   report; both platforms' values and the percentage must be visible on every
   row. Show the visual's own PASS/FAIL badge and its Tableau/Power BI row counts.
3. **Unpaired visuals** - a visual present on one platform only cannot be
   validated, so list it and fail it.
4. **Pairing audit** - which Tableau file was compared against which Power BI
   file, so a wrong pair is visible rather than silent.

Also write `reports/variance/variance.json` with the same data, so a later run or
the `migration-variance-analyst` agent can read the findings without re-parsing
the CSVs.

Finally print a short console summary: per-dashboard counts by status, then the
report path.

## Reporting rules

- Never fabricate a value. If a file is missing, unreadable, or empty, say so and
  fail the visual - an invented number in a validation report is the worst
  possible output.
- Never round a variance away. `PASS` means it met the threshold, not that the
  numbers were identical - show the actual percentage on every row.
- Lead with the failures. Sort failing rows to the top of each table and name the
  failing visuals in the console summary; a reader should not have to hunt.
- State how many values were compared, and each visual's row counts on both
  sides. `PASS` over 1 row of an expected 23 is not a validation and must not
  read like one.
- If a measure exists on one platform only, say which, and do not guess a mapping.
  Observed real case: `tableau/analysis_2/2_City_vs_visitors.csv` carries
  `Average Visit Duration Hours` while its Power BI counterpart carries
  `Sum Annual Visitors Millions` - different measures entirely, which is a real
  finding, not a normalisation gap to paper over.
