"""
PowerBlind+ XGBoost Training Script — Phase 4

Usage:
    python -m training.train \
        --readings  ../../data/powerblind_smartmeter_readings.csv \
        --labels    ../../data/powerblind_consumer_labels.csv \
        --out       models/ \
        --n_splits  5

Steps:
    1. Load and engineer features
    2. Handle class imbalance with SMOTE
    3. Stratified K-Fold cross-validation
    4. Train final model on full dataset
    5. Compute SHAP values for global importance
    6. Save model artefacts + metrics JSON
    7. Print API-ready metrics for the ModelVersion record
"""

import argparse
import json
import os
import warnings
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from imblearn.over_sampling import SMOTE
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

from training.feature_engineering import (
    FEATURE_COLS,
    LABEL_DECODER,
    LABEL_ENCODER,
    engineer_features,
)

warnings.filterwarnings("ignore")

CLASS_NAMES = ["Normal", "Theft", "FaultyMeter", "CommFailure"]

# ── XGBoost hyperparameters ──────────────────────────────────────────────────
# Tuned for this dataset's class distribution (~80/10/6/4).
# Use scale_pos_weight OR SMOTE for imbalance — we do SMOTE here.
XGB_PARAMS = {
    "n_estimators":      400,
    "max_depth":         6,
    "learning_rate":     0.08,
    "subsample":         0.8,
    "colsample_bytree":  0.8,
    "reg_alpha":         0.1,       # L1
    "reg_lambda":        1.0,       # L2
    "min_child_weight":  3,
    "use_label_encoder": False,
    "eval_metric":       "mlogloss",
    "random_state":      42,
    "tree_method":       "hist",    # fast on CPU
    "n_jobs":            -1,
}


def _resolve_path(path_str: str) -> Path:
    p = Path(path_str)
    if p.exists():
        return p
    # Try relative to repo root (services/ml/training/ -> repo root)
    repo_root = Path(__file__).resolve().parent.parent.parent
    for candidate in [repo_root / p, repo_root / "data" / p.name, Path.cwd() / p, Path.cwd() / "data" / p.name]:
        if candidate.exists():
            return candidate
    return p


def load_data(readings_path: str, labels_path: str):
    r_path = _resolve_path(readings_path)
    l_path = _resolve_path(labels_path)
    print(f"[train] Loading readings from {r_path}...")
    readings = pd.read_csv(r_path, low_memory=False)
    print(f"[train] {len(readings):,} rows loaded.")

    print(f"[train] Loading labels from {l_path}...")
    labels = pd.read_csv(l_path)
    print(f"[train] {len(labels)} consumers in label file.")

    # Merge consumer_type into readings if absent
    if "consumer_type" not in readings.columns and "consumer_type" in labels.columns:
        type_map = labels.set_index("consumer_id")["consumer_type"]
        readings["consumer_type"] = readings["consumer_id"].map(type_map)

    return readings, labels


def build_features(readings: pd.DataFrame, labels: pd.DataFrame):
    print("[train] Engineering features (this takes ~2 min for 5k consumers)...")
    consumer_meta = labels.set_index("consumer_id")[["base_kwh"]] if "base_kwh" in labels.columns else None

    X = engineer_features(readings, consumer_meta)

    # Join ground-truth labels
    label_map = labels.set_index("consumer_id")["label"]
    y_str = X.index.map(label_map)
    valid  = y_str.notna()
    X = X[valid]
    y_str = y_str[valid]

    le = LabelEncoder()
    le.classes_ = np.array(CLASS_NAMES)
    y = le.transform(y_str)

    print(f"[train] Feature matrix: {X.shape[0]} consumers × {X.shape[1]} features")
    print("[train] Class distribution:")
    for cls, cnt in zip(*np.unique(y, return_counts=True)):
        print(f"         {CLASS_NAMES[cls]:15s}: {cnt:5d} ({cnt/len(y)*100:.1f}%)")

    return X, y


def cross_validate(X: pd.DataFrame, y: np.ndarray, n_splits: int = 5):
    print(f"\n[train] Stratified {n_splits}-fold CV...")
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    fold_accs, fold_f1s = [], []

    for fold, (tr_idx, val_idx) in enumerate(skf.split(X, y), 1):
        X_tr, X_val = X.iloc[tr_idx], X.iloc[val_idx]
        y_tr, y_val = y[tr_idx],      y[val_idx]

        # SMOTE on training fold only
        smote = SMOTE(random_state=42, k_neighbors=3)
        X_res, y_res = smote.fit_resample(X_tr, y_tr)

        clf = XGBClassifier(**XGB_PARAMS)
        clf.fit(X_res, y_res,
                eval_set=[(X_val, y_val)],
                verbose=False)

        preds = clf.predict(X_val)
        acc   = accuracy_score(y_val, preds)
        f1    = f1_score(y_val, preds, average="macro")
        fold_accs.append(acc)
        fold_f1s.append(f1)
        print(f"         Fold {fold}/{n_splits} — Acc: {acc:.4f}  Macro-F1: {f1:.4f}")

    print(f"\n[train] CV Accuracy:  {np.mean(fold_accs):.4f} ± {np.std(fold_accs):.4f}")
    print(f"[train] CV Macro-F1:  {np.mean(fold_f1s):.4f} ± {np.std(fold_f1s):.4f}")
    return float(np.mean(fold_accs)), float(np.mean(fold_f1s))


def train_final(X: pd.DataFrame, y: np.ndarray):
    print("\n[train] Training final model on full dataset (with SMOTE)...")
    smote = SMOTE(random_state=42, k_neighbors=3)
    X_res, y_res = smote.fit_resample(X, y)
    print(f"[train] After SMOTE: {len(X_res):,} samples (was {len(X):,})")

    clf = XGBClassifier(**XGB_PARAMS)
    clf.fit(X_res, y_res, verbose=False)
    return clf


def compute_shap(clf: XGBClassifier, X: pd.DataFrame):
    print("[train] Computing SHAP values (TreeExplainer)...")
    explainer   = shap.TreeExplainer(clf)
    shap_values = explainer.shap_values(X)  # shape: (n_samples, n_features, n_classes) or list

    # Average absolute SHAP per feature per class
    if isinstance(shap_values, list):
        # older shap API returns list of arrays
        global_shap = {
            CLASS_NAMES[i]: dict(zip(FEATURE_COLS, np.abs(shap_values[i]).mean(axis=0).tolist()))
            for i in range(len(shap_values))
        }
    else:
        global_shap = {
            CLASS_NAMES[i]: dict(zip(FEATURE_COLS, np.abs(shap_values[:, :, i]).mean(axis=0).tolist()))
            for i in range(shap_values.shape[2])
        }
    return global_shap


def compute_metrics(clf, X: pd.DataFrame, y: np.ndarray, cv_acc: float, cv_f1: float):
    preds  = clf.predict(X)
    report = classification_report(y, preds, target_names=CLASS_NAMES, output_dict=True)
    cm     = confusion_matrix(y, preds).tolist()

    per_class = {
        cls: {
            "precision": round(report[cls]["precision"], 4),
            "recall":    round(report[cls]["recall"],    4),
            "f1":        round(report[cls]["f1-score"],  4),
            "support":   int(report[cls]["support"]),
        }
        for cls in CLASS_NAMES
    }

    return {
        "accuracy":        round(float(accuracy_score(y, preds)), 4),
        "macro_f1":        round(float(f1_score(y, preds, average="macro")), 4),
        "cv_accuracy":     round(cv_acc, 4),
        "cv_macro_f1":     round(cv_f1,  4),
        "per_class":       per_class,
        "confusion_matrix": cm,
        "training_samples": len(X),
        "test_samples":     len(X),
        "trained_at":       datetime.now(timezone.utc).isoformat(),
        "feature_count":    len(FEATURE_COLS),
        "xgb_params":       XGB_PARAMS,
    }


def save_artefacts(clf, shap_values: dict, metrics: dict, out_dir: str, version: str):
    out = Path(out_dir)
    if not out.is_absolute():
        ml_dir = Path(__file__).resolve().parent.parent
        if not out.exists() and (ml_dir / out).parent.exists():
            out = ml_dir / out
    out.mkdir(parents=True, exist_ok=True)

    model_path  = out / f"model_{version}.joblib"
    shap_path   = out / f"shap_{version}.json"
    metrics_path = out / f"metrics_{version}.json"
    latest_path  = out / "model_latest.joblib"

    joblib.dump(clf, model_path)
    joblib.dump(clf, latest_path)         # also write as 'latest' for the API

    with open(shap_path,    "w") as f: json.dump(shap_values, f, indent=2)
    with open(metrics_path, "w") as f: json.dump(metrics,     f, indent=2)

    print(f"\n[train] Saved:")
    print(f"         Model:   {model_path}")
    print(f"         SHAP:    {shap_path}")
    print(f"         Metrics: {metrics_path}")
    return str(model_path), str(metrics_path)


def main():
    parser = argparse.ArgumentParser(description="PowerBlind+ XGBoost training pipeline")
    parser.add_argument("--readings", default="../../data/powerblind_smartmeter_readings.csv")
    parser.add_argument("--labels",   default="../../data/powerblind_consumer_labels.csv")
    parser.add_argument("--out",      default="models/")
    parser.add_argument("--n_splits", type=int, default=5)
    parser.add_argument("--version",  default=None,
                        help="Model version string (default: xgb-YYYYMMDD-HHMMSS)")
    args = parser.parse_args()

    version = args.version or f"xgb-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    print(f"\n{'='*60}")
    print(f"  PowerBlind+ XGBoost Training — version: {version}")
    print(f"{'='*60}\n")

    readings, labels = load_data(args.readings, args.labels)
    X, y             = build_features(readings, labels)
    cv_acc, cv_f1    = cross_validate(X, y, args.n_splits)
    clf              = train_final(X, y)
    shap_vals        = compute_shap(clf, X)
    metrics          = compute_metrics(clf, X, y, cv_acc, cv_f1)

    save_artefacts(clf, shap_vals, metrics, args.out, version)

    # Print metrics JSON for easy copy-paste into the ModelVersion API record
    print(f"\n{'='*60}")
    print("  Metrics summary (paste into API seed-version endpoint):")
    print(f"{'='*60}")
    print(json.dumps({k: v for k, v in metrics.items() if k != "xgb_params"}, indent=2))
    print(f"\n  Version string: {version}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
