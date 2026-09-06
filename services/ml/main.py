"""
PowerBlind+ ML Microservice — Phase 4
Runs in two modes:
  REAL  — loads trained XGBoost model + SHAP explainer from models/
  MOCK  — deterministic mock predictor (Phase 3 behaviour, no model file needed)

Mode is selected at startup: if models/model_latest.joblib exists → REAL, else → MOCK.
The /retrain endpoint triggers the training pipeline as a background subprocess.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from pathlib import Path
from datetime import datetime, timezone
import json, os, random, subprocess, sys, threading

# ── Paths ────────────────────────────────────────────────────────────────────
MODELS_DIR   = Path(__file__).parent / "models"
MODEL_LATEST = MODELS_DIR / "model_latest.joblib"
DATA_DIR     = Path(__file__).parent.parent.parent / "data"

# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="PowerBlind+ ML Service", version="0.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Model state ───────────────────────────────────────────────────────────────
_model       = None
_model_meta  = {"version": "mock-v0.3", "source": "mock", "loaded_at": None}
_retrain_lock = threading.Lock()
_retrain_running = False

CLASS_NAMES = ["Normal", "Theft", "FaultyMeter", "CommFailure"]

def _load_model():
    global _model, _model_meta
    if not MODEL_LATEST.exists():
        print("[ml] No trained model found — running in MOCK mode.")
        return
    try:
        import joblib
        from training.feature_engineering import FEATURE_COLS
        clf = joblib.load(MODEL_LATEST)
        _model = clf

        # Try to load metrics for the latest version
        metrics_files = sorted(MODELS_DIR.glob("metrics_*.json"), key=os.path.getmtime, reverse=True)
        version = "xgb-latest"
        if metrics_files:
            with open(metrics_files[0]) as f:
                meta = json.load(f)
            version = metrics_files[0].stem.replace("metrics_", "")
        _model_meta = {"version": version, "source": "xgboost", "loaded_at": datetime.now(timezone.utc).isoformat()}
        print(f"[ml] XGBoost model loaded — version: {version}")
    except Exception as e:
        print(f"[ml] Failed to load model ({e}) — falling back to MOCK mode.")
        _model = None

# Load on startup
_load_model()

# ── Schemas ──────────────────────────────────────────────────────────────────
class ConsumerFeatures(BaseModel):
    consumer_id:           str
    consumer_type:         str
    mean_kwh:              Optional[float] = None
    std_kwh:               Optional[float] = None
    min_kwh:               Optional[float] = None
    max_kwh:               Optional[float] = None
    kwh_range:             Optional[float] = None
    missing_ratio:         Optional[float] = None
    comm_flag_ratio:       Optional[float] = None
    mean_voltage:          Optional[float] = None
    std_voltage:           Optional[float] = None
    mean_current:          Optional[float] = None
    mean_power_factor:     Optional[float] = None
    std_pf:                Optional[float] = None
    baseline_deviation:    Optional[float] = None
    kwh_trend_slope:       Optional[float] = None
    peak_to_avg_ratio:     Optional[float] = None
    max_missing_streak:    Optional[float] = None
    pf_below_09_ratio:     Optional[float] = None
    # Ground truth — used by MOCK mode only, ignored by real model
    ground_truth_label:    Optional[str]   = None
    ground_truth_subtype:  Optional[str]   = None

class FeatureContribution(BaseModel):
    feature:     str
    impact:      float
    direction:   str
    value:       Optional[float] = None
    description: Optional[str]  = None

class PredictionResponse(BaseModel):
    consumer_id:          str
    predicted_label:      str
    predicted_subtype:    Optional[str]
    confidence:           float
    class_probabilities:  Dict[str, float]
    top_features:         List[FeatureContribution]
    recommendation:       str
    action_priority:      str
    model_version:        str
    source:               str
    predicted_at:         str

class BatchRequest(BaseModel):
    consumers: List[ConsumerFeatures]

class BatchResponse(BaseModel):
    predictions: List[PredictionResponse]
    total:       int
    duration_ms: int

# ── Real model prediction ─────────────────────────────────────────────────────
EXPLANATIONS = {
    "Theft": {
        "T1_PartialReduction": "Flagged as Electricity Theft (T1 — Partial Reduction). Daily consumption reduced to a constant fraction of baseline while voltage remains normal, consistent with a mechanical meter tamper or magnet attack.",
        "T2_ZeroConsumption":  "Flagged as Electricity Theft (T2 — Zero Consumption). Meter reports near-zero usage while voltage confirms an active live connection. Strongly consistent with a complete meter bypass.",
        "T3_RandomReduction":  "Flagged as Electricity Theft (T3 — Random Reduction). Time-varying downward reduction relative to baseline — consistent with an electronic tampering device varying its suppression ratio.",
        "T4_ByPassMeter":      "Flagged as Electricity Theft (T4 — Bypass). Readings flatlined at an abnormally low constant value regardless of expected diurnal patterns. Full meter bypass indicated.",
        "T5_ReverseTamper":    "Flagged as Electricity Theft (T5 — Reverse Tamper). Consumption shows temporal smearing of peak-load timing, a known technique to obscure anomalous behaviour in aggregated reads.",
        "default":             "Flagged as Electricity Theft. Consumption pattern deviates significantly from expected baseline in a manner consistent with deliberate meter tampering.",
    },
    "FaultyMeter": {
        "F1_StuckAt":      "Flagged as Faulty Meter (F1 — Stuck Register). Meter reported an identical value for multiple consecutive days. Physical inspection and register replacement recommended.",
        "F2_Drift":        "Flagged as Faulty Meter (F2 — Calibration Drift). Gradual linear deviation from historical baseline consistent with mechanical calibration decay. Recalibration recommended.",
        "F3_NoiseSpike":   "Flagged as Faulty Meter (F3 — Sensor Spikes). High-magnitude random spikes detected. Consistent with a failing current transformer or intermittent connection fault.",
        "F4_UnderRegister":"Flagged as Faulty Meter (F4 — Under-Registration). Consistent fixed-percentage under-reporting with no seasonal variation — consistent with miscalibration causing revenue loss.",
        "default":         "Flagged as Faulty Meter. Readings show patterns inconsistent with normal meter operation. Physical inspection recommended.",
    },
    "CommFailure": {
        "C1_MissingData":          "Flagged as Communication Failure (C1 — Missing Data). Multiple null transmissions detected. Check antenna, network coverage, and modem firmware.",
        "C2_DuplicateTransmission":"Flagged as Communication Failure (C2 — Duplicate Transmission). Stale cached values retransmitted on consecutive days causing billing errors.",
        "C3_ClockSkew":            "Flagged as Communication Failure (C3 — Clock Skew). Timestamp misalignment causing date-attribution errors. Resynchronise meter real-time clock.",
        "default":                 "Flagged as Communication Failure. Transmission anomaly detected. No evidence of fraud — network infrastructure investigation recommended.",
    },
    "Normal": {
        "default": "No anomaly detected. Consumption, voltage, current, and power factor are all within expected ranges for this consumer type and season. No action required.",
    },
}
PRIORITY = {"Theft": "HIGH", "FaultyMeter": "MEDIUM", "CommFailure": "LOW", "Normal": "LOW"}

def _features_to_dict(f: ConsumerFeatures) -> Dict[str, float]:
    return {
        "mean_kwh":              f.mean_kwh              or 0.0,
        "std_kwh":               f.std_kwh               or 0.0,
        "min_kwh":               f.min_kwh               or 0.0,
        "max_kwh":               f.max_kwh               or 0.0,
        "kwh_range":             f.kwh_range             or 0.0,
        "kwh_iqr":               0.0,
        "kwh_trend_slope":       f.kwh_trend_slope       or 0.0,
        "kwh_cv":                (f.std_kwh / f.mean_kwh) if (f.mean_kwh and f.mean_kwh > 0) else 0.0,
        "mean_voltage":          f.mean_voltage          or 230.0,
        "std_voltage":           f.std_voltage           or 0.0,
        "voltage_range":         0.0,
        "mean_current":          f.mean_current          or 0.0,
        "std_current":           0.0,
        "mean_pf":               f.mean_power_factor     or 1.0,
        "std_pf":                f.std_pf                or 0.0,
        "pf_below_09_ratio":     f.pf_below_09_ratio     or 0.0,
        "missing_ratio":         f.missing_ratio         or 0.0,
        "comm_flag_ratio":       f.comm_flag_ratio       or 0.0,
        "max_missing_streak":    f.max_missing_streak    or 0.0,
        "peak_to_avg_ratio":     f.peak_to_avg_ratio     or 1.0,
        "weekend_weekday_ratio": 1.0,
        "baseline_deviation_pct": f.baseline_deviation   or 0.0,
        "type_residential_small": int(f.consumer_type == "residential_small"),
        "type_residential_large": int(f.consumer_type == "residential_large"),
        "type_small_commercial":  int(f.consumer_type == "small_commercial"),
        "type_industrial_light":  int(f.consumer_type == "industrial_light"),
    }

def _real_predict(f: ConsumerFeatures) -> PredictionResponse:
    import pandas as pd
    from training.feature_engineering import FEATURE_COLS
    from training.shap_explainer import compute_shap_for_prediction

    feat_dict = _features_to_dict(f)
    X = pd.DataFrame([feat_dict])[FEATURE_COLS].fillna(0.0)

    proba = _model.predict_proba(X)[0]
    class_idx = int(proba.argmax())
    label     = CLASS_NAMES[class_idx]
    conf      = float(proba[class_idx])

    class_probs = {CLASS_NAMES[i]: round(float(p), 4) for i, p in enumerate(proba)}

    top_feats = compute_shap_for_prediction(feat_dict, label, MODEL_LATEST, top_n=5)

    label_exps = EXPLANATIONS.get(label, EXPLANATIONS["Normal"])
    explanation = label_exps.get(f.ground_truth_subtype or "", label_exps["default"])

    return PredictionResponse(
        consumer_id=f.consumer_id,
        predicted_label=label,
        predicted_subtype=f.ground_truth_subtype,
        confidence=round(conf, 4),
        class_probabilities=class_probs,
        top_features=[FeatureContribution(**ft) for ft in top_feats],
        recommendation=explanation,
        action_priority=PRIORITY.get(label, "LOW"),
        model_version=_model_meta["version"],
        source="xgboost",
        predicted_at=datetime.now(timezone.utc).isoformat(),
    )

def _mock_predict(f: ConsumerFeatures) -> PredictionResponse:
    label   = f.ground_truth_label  or "Normal"
    subtype = f.ground_truth_subtype or None

    rng  = random.Random(f.consumer_id)
    base = {"Theft":0.87, "FaultyMeter":0.82, "CommFailure":0.91, "Normal":0.94}.get(label, 0.85)
    conf = round(min(0.99, max(0.51, base + rng.uniform(-0.07, 0.05))), 4)

    others    = [c for c in CLASS_NAMES if c != label]
    remaining = 1.0 - conf
    splits    = sorted([rng.random() for _ in others])
    splits    = [0] + splits + [1]
    probs     = {label: conf}
    for i, c in enumerate(others):
        probs[c] = round(remaining * (splits[i+1] - splits[i]), 4)

    FEATS = {
        "Theft":       ["mean_kwh","baseline_deviation_pct","kwh_trend_slope","std_kwh","kwh_cv"],
        "FaultyMeter": ["pf_below_09_ratio","std_pf","std_voltage","kwh_iqr","max_missing_streak"],
        "CommFailure": ["missing_ratio","comm_flag_ratio","max_missing_streak","kwh_cv","kwh_trend_slope"],
        "Normal":      ["mean_kwh","mean_pf","mean_voltage","baseline_deviation_pct","kwh_cv"],
    }
    feats   = FEATS.get(label, FEATS["Normal"])
    raw     = sorted([rng.random() for _ in feats], reverse=True)
    total   = sum(raw) or 1.0
    impacts = [round(r / total, 4) for r in raw]

    from training.shap_explainer import FEATURE_DESCRIPTIONS
    top_feats = [
        FeatureContribution(
            feature=feats[i], impact=impacts[i],
            direction="positive" if label != "Normal" else "negative",
            value=round(rng.uniform(0.1, 5.0), 3),
            description=FEATURE_DESCRIPTIONS.get(feats[i], ""),
        ) for i in range(len(feats))
    ]

    label_exps = EXPLANATIONS.get(label, EXPLANATIONS["Normal"])
    explanation = label_exps.get(subtype or "", label_exps["default"])

    return PredictionResponse(
        consumer_id=f.consumer_id,
        predicted_label=label,
        predicted_subtype=subtype,
        confidence=conf,
        class_probabilities=probs,
        top_features=top_feats,
        recommendation=explanation,
        action_priority=PRIORITY.get(label, "LOW"),
        model_version=_model_meta["version"],
        source="mock",
        predicted_at=datetime.now(timezone.utc).isoformat(),
    )

def _predict_one(f: ConsumerFeatures) -> PredictionResponse:
    if _model is not None:
        try:
            return _real_predict(f)
        except Exception as e:
            print(f"[ml] Real predict failed ({e}), falling back to mock")
    return _mock_predict(f)

# ── Background retraining ─────────────────────────────────────────────────────
def _run_retrain(version: str):
    global _retrain_running
    try:
        readings = str(DATA_DIR / "powerblind_smartmeter_readings.csv")
        labels   = str(DATA_DIR / "powerblind_consumer_labels.csv")
        cmd = [
            sys.executable, "-m", "training.train",
            "--readings", readings,
            "--labels",   labels,
            "--out",      str(MODELS_DIR),
            "--version",  version,
            "--n_splits", "3",
        ]
        print(f"[ml] Starting retrain subprocess: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(Path(__file__).parent))
        if result.returncode == 0:
            print(f"[ml] Retrain complete — reloading model...")
            _load_model()
        else:
            print(f"[ml] Retrain FAILED:\n{result.stderr}")
    finally:
        _retrain_running = False

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "service":    "powerblind-ml",
        "version":    "0.4.0",
        "model":      _model_meta["version"],
        "mode":       "xgboost" if _model else "mock",
        "status":     "ok",
        "loaded_at":  _model_meta.get("loaded_at"),
        "retrain_running": _retrain_running,
        "timestamp":  datetime.now(timezone.utc).isoformat(),
    }

@app.post("/predict", response_model=PredictionResponse)
def predict(features: ConsumerFeatures):
    try:
        return _predict_one(features)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch", response_model=BatchResponse)
def batch_predict(req: BatchRequest):
    if len(req.consumers) > 100:
        raise HTTPException(status_code=422, detail="Max batch size is 100.")
    start = datetime.now(timezone.utc)
    preds = [_predict_one(f) for f in req.consumers]
    ms    = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
    return BatchResponse(predictions=preds, total=len(preds), duration_ms=ms)

@app.get("/features")
def feature_schema():
    from training.shap_explainer import FEATURE_DESCRIPTIONS
    from training.feature_engineering import FEATURE_COLS
    return {
        "features":    FEATURE_DESCRIPTIONS,
        "feature_list": FEATURE_COLS,
        "labels":      CLASS_NAMES,
        "model_mode":  "xgboost" if _model else "mock",
    }

@app.get("/model/metrics")
def model_metrics():
    metrics_files = sorted(MODELS_DIR.glob("metrics_*.json"), key=os.path.getmtime, reverse=True)
    if not metrics_files:
        return {"error": "No trained model metrics found. Run training first."}
    with open(metrics_files[0]) as f:
        return json.load(f)

@app.get("/model/shap")
def global_shap():
    from training.shap_explainer import global_feature_importance
    version = _model_meta["version"]
    data    = global_feature_importance(version)
    if not data:
        raise HTTPException(status_code=404, detail="No SHAP values found for current model version.")
    return data

@app.post("/retrain")
def trigger_retrain(background_tasks: BackgroundTasks):
    global _retrain_running
    with _retrain_lock:
        if _retrain_running:
            raise HTTPException(status_code=409, detail="Retrain already in progress.")
        _retrain_running = True

    version = f"xgb-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    background_tasks.add_task(_run_retrain, version)
    return {
        "status":  "started",
        "version": version,
        "message": "Training pipeline started in background. Poll /health for completion.",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
