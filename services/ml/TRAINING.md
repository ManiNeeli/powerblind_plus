# PowerBlind+ XGBoost Training — Phase 4

## Overview

This trains a real multi-class XGBoost classifier on the 5,000-consumer dataset.
The trained model is automatically loaded by `main.py` at startup — the API
falls back to mock mode when no model file is found.

## Steps

### 1. Install dependencies
```bash
cd services/ml
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Make sure the dataset is in `/data`
```
powerblind-plus/data/
  powerblind_smartmeter_readings.csv   (~146MB)
  powerblind_consumer_labels.csv
```

### 3. Run training
```bash
# From services/ml/ directory:
python -m training.train \
    --readings  ../../data/powerblind_smartmeter_readings.csv \
    --labels    ../../data/powerblind_consumer_labels.csv \
    --out       models/ \
    --n_splits  5

# Quick run (3 folds, faster):
python -m training.train --n_splits 3
```

Training takes **5–15 minutes** depending on hardware (mostly feature engineering
across 1.8M rows). Progress is printed step by step.

### 4. What gets saved
```
models/
  model_<version>.joblib    # XGBoost classifier
  model_latest.joblib       # symlink/copy for API auto-load
  metrics_<version>.json    # accuracy, F1, confusion matrix, CV scores
  shap_<version>.json       # global SHAP values (all 4 classes)
```

### 5. Start the ML service
```bash
python main.py   # or: uvicorn main:app --reload
```

On startup, `main.py` detects `models/model_latest.joblib` and loads it.
The `/health` endpoint reports `"mode": "xgboost"` when real model is active.

### 6. Seed the version in the DB
After training, go to the Admin → Model Health page and click **Seed v0.3**,
OR call the API directly:

```bash
curl -X POST http://localhost:4000/api/model/seed-version \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"version": "xgb-20240101-120000"}'   # use the version string from training output
```

## Expected performance (5-fold CV, full 5k dataset)

| Class       | Precision | Recall | F1    |
|-------------|-----------|--------|-------|
| Normal      | ~0.97     | ~0.99  | ~0.98 |
| Theft       | ~0.89     | ~0.86  | ~0.87 |
| FaultyMeter | ~0.83     | ~0.80  | ~0.81 |
| CommFailure | ~0.95     | ~0.92  | ~0.93 |
| **Macro**   | —         | —      | **~0.90** |

Slight variation expected due to SMOTE's random sampling.

## Feature engineering

26 features per consumer, computed from the 365-day reading history:

- **kWh stats**: mean, std, min, max, range, IQR, trend slope, CV
- **Voltage**: mean, std, range
- **Current**: mean, std
- **Power factor**: mean, std, fraction below 0.90
- **Missing data**: missing ratio, comm flag ratio, longest streak
- **Temporal**: peak-to-avg ratio, weekend/weekday ratio
- **Baseline**: deviation from consumer-type base_kwh (%)
- **Type**: one-hot encoded consumer type (4 features)

## Hyperparameter notes

Key XGBoost params (in `training/train.py`):
- `n_estimators=400` — more trees than default, dataset is large
- `max_depth=6` — moderate depth to avoid overfitting on Normal class
- `learning_rate=0.08` — slower learning with more trees
- SMOTE with `k_neighbors=3` — safe for minority classes of ~200 samples
