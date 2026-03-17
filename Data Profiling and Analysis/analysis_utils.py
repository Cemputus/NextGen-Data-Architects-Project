from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class BasicProfile:
    rows: int
    cols: int
    dup_rows: int
    null_cells: int


def basic_profile(df: pd.DataFrame) -> BasicProfile:
    return BasicProfile(
        rows=int(len(df)),
        cols=int(df.shape[1]),
        dup_rows=int(df.duplicated().sum()),
        null_cells=int(df.isna().sum().sum()),
    )


def missingness_report(df: pd.DataFrame, top_n: int = 25) -> pd.DataFrame:
    """Column missingness with types and uniqueness."""
    out = pd.DataFrame(
        {
            "dtype": df.dtypes.astype(str),
            "missing_rate": df.isna().mean(),
            "missing_count": df.isna().sum(),
            "nunique": df.nunique(dropna=True),
        }
    )
    return out.sort_values(["missing_rate", "missing_count"], ascending=False).head(top_n)


def numeric_outlier_report(df: pd.DataFrame, cols: Optional[Iterable[str]] = None) -> pd.DataFrame:
    """IQR-based outlier rates for numeric columns."""
    if cols is None:
        cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    rows = []
    for c in cols:
        s = pd.to_numeric(df[c], errors="coerce")
        s = s[s.notna()]
        if len(s) < 20:
            continue
        q1, q3 = np.percentile(s, [25, 75])
        iqr = q3 - q1
        lo = q1 - 1.5 * iqr
        hi = q3 + 1.5 * iqr
        out_rate = float(((s < lo) | (s > hi)).mean())
        rows.append(
            {
                "col": c,
                "n": int(len(s)),
                "mean": float(s.mean()),
                "std": float(s.std(ddof=1)),
                "min": float(s.min()),
                "p25": float(q1),
                "p50": float(np.median(s)),
                "p75": float(q3),
                "max": float(s.max()),
                "outlier_rate_iqr": out_rate,
            }
        )
    return pd.DataFrame(rows).sort_values("outlier_rate_iqr", ascending=False)


def merge_to_transcript_for_cgpa(
    df: pd.DataFrame,
    transcript: pd.DataFrame,
    on: list[str],
    how: str = "inner",
) -> pd.DataFrame:
    """Standardized merge helper to attach CGPA and semester GPA."""
    t = transcript.copy()
    keep = [c for c in ["REG_NO", "SEMESTER_INDEX", "CGPA", "SEMESTER_GPA", "PROGRAM", "ACADEMIC_YEAR", "SEMESTER"] if c in t.columns]
    t = t[keep]
    merged = df.merge(t, on=on, how=how, suffixes=("", "_trans"))
    return merged


def group_summary(df: pd.DataFrame, group_col: str, metric_cols: list[str], top_n: int = 20) -> pd.DataFrame:
    g = df.groupby(group_col)[metric_cols].agg(["count", "mean", "median", "std"]).sort_values((metric_cols[0], "count"), ascending=False)
    return g.head(top_n)

