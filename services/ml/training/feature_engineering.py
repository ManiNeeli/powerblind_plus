"""
Feature engineering for PowerBlind+ XGBoost model.

Input:  raw readings DataFrame (consumer_id, date, kwh, voltage_v, current_a,
         power_factor, comm_flag, consumer_type)
Output: one feature vector per consumer (used for both training and inference)
"""

import numpy as np
import pandas as pd
from typing import Optional

FEATURE_COLS = [
    # kWh statistics
    "mean_kwh", "std_kwh", "min_kwh", "max_kwh",
    "kwh_range", "kwh_iqr", "kwh_trend_slope", "kwh_cv",
    # Voltage
    "mean_voltage", "std_voltage", "voltage_range",
    # Current
    "mean_current", "std_current",
    # Power factor
    "mean_pf", "std_pf", "pf_below_09_ratio",
    # Missing / communication
    "missing_ratio", "comm_flag_ratio", "max_missing_streak",
    # Temporal patterns
    "peak_to_avg_ratio", "weekend_weekday_ratio",
    # Baseline deviation
    "baseline_deviation_pct",
    # Consumer type (one-hot)
    "type_residential_small", "type_residential_large",
    "type_small_commercial", "type_industrial_light",
]

LABEL_ENCODER = {"Normal": 0, "Theft": 1, "FaultyMeter": 2, "CommFailure": 3}
LABEL_DECODER = {v: k for k, v in LABEL_ENCODER.items()}
CLASS_NAMES = ["Normal", "Theft", "FaultyMeter", "CommFailure"]


def _trend_slope(series: pd.Series) -> float:
    s = series.dropna()
    if len(s) < 2:
        return 0.0
    x = np.arange(len(s))
    return float(np.polyfit(x, s.values, 1)[0])


def _max_streak(flags: pd.Series) -> int:
    max_s = cur = 0
    for v in flags:
        if v:
            cur += 1
            max_s = max(max_s, cur)
        else:
            cur = 0
    return max_s


def engineer_features(
    readings_df: pd.DataFrame,
    consumer_meta: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    """
    Args:
        readings_df:   Columns: consumer_id, date, kwh, voltage_v, current_a,
                                power_factor, comm_flag, consumer_type
        consumer_meta: DataFrame indexed by consumer_id with column base_kwh

    Returns:
        DataFrame with one row per consumer and columns = FEATURE_COLS
    """
    df = readings_df.copy()
    for col in ["kwh", "voltage_v", "current_a", "power_factor"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["comm_flag"]  = df["comm_flag"].astype(bool)
    df["date"]       = pd.to_datetime(df["date"], errors="coerce")
    df["is_weekend"] = df["date"].dt.dayofweek >= 5

    rows = []
    for cid, grp in df.groupby("consumer_id"):
        kwh  = grp["kwh"]
        volt = grp["voltage_v"].dropna()
        curr = grp["current_a"].dropna()
        pf   = grp["power_factor"]
        cf   = grp["comm_flag"]

        n = len(grp)
        missing_mask = kwh.isna()
        kwh_valid    = kwh.dropna()

        mean_kwh = float(kwh_valid.mean()) if len(kwh_valid) else 0.0
        std_kwh  = float(kwh_valid.std())  if len(kwh_valid) > 1 else 0.0
        q75, q25 = (np.percentile(kwh_valid, [75, 25])
                    if len(kwh_valid) > 1 else (0.0, 0.0))

        weekend_mean = float(kwh[grp["is_weekend"]].dropna().mean() or 0)
        weekday_mean = float(kwh[~grp["is_weekend"]].dropna().mean() or 1e-9)
        wd_ratio     = weekend_mean / weekday_mean if weekday_mean != 0 else 1.0
        peak_avg     = float(kwh_valid.max() / mean_kwh) if mean_kwh > 0 else 1.0

        ctype = str(grp["consumer_type"].iloc[0]) if "consumer_type" in grp.columns else ""

        base_kwh = None
        if consumer_meta is not None and cid in consumer_meta.index:
            base_kwh = float(consumer_meta.loc[cid, "base_kwh"])
        baseline_dev = (abs(mean_kwh - base_kwh) / base_kwh
                        if base_kwh and base_kwh > 0 else 0.0)

        rows.append({
            "consumer_id": cid,
            "mean_kwh":    mean_kwh,
            "std_kwh":     std_kwh,
            "min_kwh":     float(kwh_valid.min()) if len(kwh_valid) else 0.0,
            "max_kwh":     float(kwh_valid.max()) if len(kwh_valid) else 0.0,
            "kwh_range":   float(kwh_valid.max() - kwh_valid.min()) if len(kwh_valid) > 1 else 0.0,
            "kwh_iqr":     float(q75 - q25),
            "kwh_trend_slope": _trend_slope(kwh),
            "kwh_cv":      std_kwh / mean_kwh if mean_kwh > 0 else 0.0,

            "mean_voltage":  float(volt.mean()) if len(volt) else 230.0,
            "std_voltage":   float(volt.std())  if len(volt) > 1 else 0.0,
            "voltage_range": float(volt.max() - volt.min()) if len(volt) > 1 else 0.0,

            "mean_current": float(curr.mean()) if len(curr) else 0.0,
            "std_current":  float(curr.std())  if len(curr) > 1 else 0.0,

            "mean_pf":           float(pf.dropna().mean()) if pf.dropna().size else 1.0,
            "std_pf":            float(pf.dropna().std())  if pf.dropna().size > 1 else 0.0,
            "pf_below_09_ratio": float((pf < 0.9).sum() / n),

            "missing_ratio":      float(missing_mask.sum() / n),
            "comm_flag_ratio":    float(cf.sum() / n),
            "max_missing_streak": float(_max_streak(missing_mask)),

            "peak_to_avg_ratio":    float(peak_avg),
            "weekend_weekday_ratio": float(wd_ratio),
            "baseline_deviation_pct": float(baseline_dev),

            "type_residential_small": int(ctype == "residential_small"),
            "type_residential_large": int(ctype == "residential_large"),
            "type_small_commercial":  int(ctype == "small_commercial"),
            "type_industrial_light":  int(ctype == "industrial_light"),
        })

    feat_df = pd.DataFrame(rows).set_index("consumer_id")
    feat_df = feat_df.fillna(0.0)
    return feat_df[FEATURE_COLS]
