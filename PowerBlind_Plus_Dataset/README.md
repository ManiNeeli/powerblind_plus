# PowerBlind+ Synthetic Multi-Class Smart Meter Anomaly Dataset

## What this is
A hybrid dataset built specifically for the PowerBlind+ project: realistic, real-world-calibrated
"normal" consumption profiles (structured like Irish CER / SGCC residential & commercial patterns
described in published literature), with synthetic anomalies injected on top using attack/fault
formulas drawn from peer-reviewed electricity theft & fault detection papers.

## Files
| File | Description |
|---|---|
| `powerblind_smartmeter_readings.csv` | Main time-series data: 5,000 consumers x 365 days = 1,825,000 rows |
| `powerblind_smartmeter_readings.csv.gz` | Compressed version (27MB vs 146MB) |
| `powerblind_consumer_labels.csv` | One row per consumer: ground-truth label, subtype, anomaly window dates |
| `data_dictionary.json` | Full column descriptions, class taxonomy, and methodology notes |
| `generate_dataset.py` | The generator script — fully reproducible (seed=42), editable for your own scale/features |

## Class distribution (consumer-level, this run)
- Normal: 3,983 (79.7%)
- Theft: 527 (10.5%) — 5 sub-types
- FaultyMeter: 283 (5.7%) — 4 sub-types
- CommFailure: 207 (4.1%) — 3 sub-types

This mirrors the realistic class imbalance seen in real utility data (e.g. SGCC ~8.5% theft),
which is intentional — your model needs to handle this imbalance (SMOTE, class weighting, focal loss, etc.)
just as it would on real-world data.

## Columns
- `consumer_id`, `date`, `consumer_type`
- `kwh` — daily energy consumption (NaN during comm-failure data-loss windows)
- `voltage_v`, `current_a`, `power_factor` — derived electrical features (these carry anomaly-specific
  signatures, e.g. faulty meters show power factor degradation — useful for your explainability/XAI layer)
- `comm_flag` — marks days affected by communication failure
- `label` — Normal / Theft / FaultyMeter / CommFailure (your primary multi-class target)
- `anomaly_subtype` — fine-grained sub-type label (useful for a secondary classification head or for
  generating richer SHAP/LIME explanations tied to *why* an anomaly was flagged)

## Why hybrid (real + synthetic)?
No public dataset contains all three anomaly classes with ground truth (see earlier discussion) —
this is a known, documented gap in the field. The standard, defensible research methodology (used in
SGCC, Irish CER, and most published theft-detection papers) is exactly this: real/realistic normal
consumption baselines + literature-grounded synthetic anomaly injection. You can cite this methodology
in your paper's Data section.

## Regenerating / customizing
Edit `generate_dataset.py` — key parameters at the top:
- `N_CONSUMERS`, `N_DAYS` — scale
- `CLASS_WEIGHTS` — class imbalance ratios
- `CONSUMER_TYPES` — base load archetypes
- Injection functions (`inject_theft`, `inject_fault`, `inject_comm_failure`) — anomaly severity/duration

Run with: `python3 generate_dataset.py`
