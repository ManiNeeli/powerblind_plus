"""
SHAP explainability module for PowerBlind+ — Phase 4.

Loads the trained TreeExplainer and computes per-prediction SHAP values,
returning them in the same schema the frontend already renders.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

# Lazy imports — only loaded if real model is active
_explainer = None
_shap_global: Optional[Dict] = None

MODELS_DIR = Path(__file__).parent.parent / "models"

FEATURE_DESCRIPTIONS = {
    "mean_kwh":             "Mean daily kWh consumption",
    "std_kwh":              "Standard deviation of daily kWh",
    "min_kwh":              "Minimum daily kWh observed",
    "max_kwh":              "Maximum daily kWh observed",
    "kwh_range":            "Range of daily consumption (max − min)",
    "kwh_iqr":              "Interquartile range of daily consumption",
    "kwh_trend_slope":      "Linear trend slope over the measurement period",
    "kwh_cv":               "Coefficient of variation (std / mean)",
    "mean_voltage":         "Mean daily voltage (V)",
    "std_voltage":          "Voltage stability (std dev)",
    "voltage_range":        "Voltage range across the period",
    "mean_current":         "Mean daily current draw (A)",
    "std_current":          "Standard deviation of current draw",
    "mean_pf":              "Mean power factor",
    "std_pf":               "Power factor stability (std dev)",
    "pf_below_09_ratio":    "Fraction of days with power factor < 0.90",
    "missing_ratio":        "Fraction of readings that were missing (null)",
    "comm_flag_ratio":      "Fraction of days flagged for communication issues",
    "max_missing_streak":   "Longest consecutive sequence of missing readings",
    "peak_to_avg_ratio":    "Peak daily consumption to average ratio",
    "weekend_weekday_ratio": "Weekend vs weekday consumption ratio",
    "baseline_deviation_pct": "Absolute deviation from consumer-type baseline (%)",
    "type_residential_small": "Consumer type: residential small",
    "type_residential_large": "Consumer type: residential large",
    "type_small_commercial":  "Consumer type: small commercial",
    "type_industrial_light":  "Consumer type: industrial light",
}

CLASS_NAMES = ["Normal", "Theft", "FaultyMeter", "CommFailure"]


def _load_explainer(model_path: Path):
    global _explainer
    if _explainer is not None:
        return _explainer
    try:
        import shap, joblib
        clf = joblib.load(model_path)
        _explainer = shap.TreeExplainer(clf)
        print(f"[shap] TreeExplainer loaded from {model_path}")
    except Exception as e:
        print(f"[shap] Failed to load explainer: {e}")
        _explainer = None
    return _explainer


def _load_global_shap(version: str) -> Optional[Dict]:
    global _shap_global
    if _shap_global is not None:
        return _shap_global
    path = MODELS_DIR / f"shap_{version}.json"
    if path.exists():
        with open(path) as f:
            _shap_global = json.load(f)
    return _shap_global


def compute_shap_for_prediction(
    feature_vector: Dict[str, float],
    predicted_label: str,
    model_path: Path,
    top_n: int = 5,
) -> List[Dict]:
    """
    Compute SHAP values for a single consumer's feature vector.
    Returns list of {feature, impact, direction, value, description} sorted by |impact|.
    """
    explainer = _load_explainer(model_path)
    if explainer is None:
        return _fallback_contributions(feature_vector, predicted_label, top_n)

    try:
        import pandas as pd
        from training.feature_engineering import FEATURE_COLS

        X = pd.DataFrame([feature_vector])[FEATURE_COLS].fillna(0.0)
        shap_vals = explainer.shap_values(X)  # (1, n_features, n_classes) or list

        class_idx = CLASS_NAMES.index(predicted_label) if predicted_label in CLASS_NAMES else 0

        if isinstance(shap_vals, list):
            sv = shap_vals[class_idx][0]          # shape (n_features,)
        else:
            sv = shap_vals[0, :, class_idx]       # shape (n_features,)

        total = np.abs(sv).sum() or 1.0
        contributions = []
        for feat, val in zip(FEATURE_COLS, sv):
            contributions.append({
                "feature":     feat,
                "impact":      round(float(abs(val)) / total, 4),
                "direction":   "positive" if val > 0 else "negative",
                "value":       round(float(feature_vector.get(feat, 0.0)), 4),
                "description": FEATURE_DESCRIPTIONS.get(feat, ""),
            })

        contributions.sort(key=lambda x: x["impact"], reverse=True)
        return contributions[:top_n]

    except Exception as e:
        print(f"[shap] Error computing SHAP: {e}")
        return _fallback_contributions(feature_vector, predicted_label, top_n)


def global_feature_importance(version: str) -> Optional[Dict]:
    """Returns global SHAP importance dict {class: {feature: mean_abs_shap}}."""
    return _load_global_shap(version)


def _fallback_contributions(
    feature_vector: Dict[str, float],
    predicted_label: str,
    top_n: int,
) -> List[Dict]:
    """Heuristic contributions when SHAP is unavailable (e.g. mock mode)."""
    import random
    rng = random.Random(str(feature_vector))

    from training.feature_engineering import FEATURE_COLS
    FEAT_BY_LABEL = {
        "Theft":       ["kwh_trend_slope", "baseline_deviation_pct", "kwh_cv", "mean_kwh", "std_kwh"],
        "FaultyMeter": ["pf_below_09_ratio", "std_pf", "std_voltage", "kwh_iqr", "max_missing_streak"],
        "CommFailure": ["missing_ratio", "comm_flag_ratio", "max_missing_streak", "kwh_cv", "kwh_trend_slope"],
        "Normal":      ["mean_kwh", "mean_pf", "mean_voltage", "baseline_deviation_pct", "kwh_cv"],
    }
    feats = FEAT_BY_LABEL.get(predicted_label, FEATURE_COLS[:5])[:top_n]
    raw   = sorted([rng.random() for _ in feats], reverse=True)
    total = sum(raw) or 1.0
    return [
        {
            "feature":     f,
            "impact":      round(raw[i] / total, 4),
            "direction":   "positive" if predicted_label != "Normal" else "negative",
            "value":       round(float(feature_vector.get(f, 0.0)), 4),
            "description": FEATURE_DESCRIPTIONS.get(f, ""),
        }
        for i, f in enumerate(feats)
    ]
