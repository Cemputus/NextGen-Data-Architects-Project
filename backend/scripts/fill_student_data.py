"""
One-off script: fill missing values in students_list15.xlsx and source_data2.csv,
and add more Ugandan names to the student list.
"""
import pandas as pd
import numpy as np
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
SYNTHETIC = BACKEND / "data" / "Synthetic_Data"
DATA = BACKEND / "data"

# Expanded Ugandan first names (male and female, common in Uganda)
UGANDAN_FIRST_NAMES = [
    "Daniel", "Amina", "Brian", "Grace", "Joseph", "Esther", "Paul", "Ruth",
    "Michael", "Sarah", "Peter", "Joy", "David", "Mary", "Samuel", "Lilian",
    "Isaac", "Patricia", "John", "Hannah", "Noah", "Faith", "Stephen",
    "Dorothy", "Caleb", "Agnes", "Andrew", "Prisca", "Martin", "Stella",
    "Timothy", "Beatrice", "James", "Catherine", "Benjamin", "Deborah",
    "Enock", "Rebecca", "Moses", "Florence", "Joshua", "Alice", "Simon",
    "Margaret", "Patrick", "Rose", "Charles", "Nancy", "George", "Helen",
    "Francis", "Elizabeth", "Henry", "Christine", "Robert", "Jane",
    "Richard", "Sylvia", "Kenneth", "Annet", "Thomas", "Scovia", "William",
    "Immaculate", "Ronald", "Mariam", "Edward", "Ritah", "Lawrence", "Sandra",
    "Fred", "Jackline", "Godfrey", "Naome", "Emmanuel", "Peace", "Ivan",
    "Phionah", "Alex", "Doreen", "Nicholas", "Violet", "Vincent", "Harriet",
    "Joseph", "Juliet", "Peter", "Mildred", "Stephen", "Gloria", "Mark",
    "Prossy", "Luke", "Sylvia", "Matthew", "Rebecca", "Philip", "Susan",
]
# Expanded Ugandan last names (clans, common surnames)
UGANDAN_LAST_NAMES = [
    "Okello", "Namakula", "Kato", "Achieng", "Mukasa", "Wekesa", "Akol",
    "Atwine", "Kasule", "Mugisha", "Kagimu", "Namirembe", "Nandutu",
    "Ssebagala", "Muwonge", "Nabirye", "Kawuma", "Nasuuna", "Nanyonjo",
    "Bukenya", "Ssempijja", "Nansubuga", "Kyaligonza", "Tumwebaze",
    "Katusiime", "Bamwine", "Asiimwe", "Nkurunziza", "Mutesi", "Niyonzima",
    "Mutebi", "Ouma", "Ochieng", "Odongo", "Obote", "Okot", "Ojok",
    "Oloya", "Opio", "Otieno", "Owori", "Ssali", "Sserwadda", "Wasswa",
    "Kiggundu", "Lubega", "Lule", "Mugerwa", "Mukasa", "Nsubuga", "Ssebunya",
    "Ssemakula", "Ssentongo", "Wandera", "Biira", "Kemigisha", "Kyomuhendo",
    "Tumusiime", "Tusiime", "Nabukenya", "Nakato", "Nalwadda", "Nambi",
]

np.random.seed(42)


# Defaults for columns when missing. Use values pandas won't treat as NA when reading Excel (avoid "N/A", "NA").
NA_PLACEHOLDER = "—"
COLUMN_FILL_DEFAULTS = {
    "PROGRAM TYPE": "Undergraduate",
    "RETAKE COURSES": "—",  # avoid "None" (pandas may read as NaN)
    "% DIVERGENCE": "0",
    "MOODLE": "Registered",
    "ACADEMIC OFFICER": NA_PLACEHOLDER,
    "ACCOMMODATION OFFICER": NA_PLACEHOLDER,
    "ACCOMMODATION Type": "Off-campus",
    "ACCOUNTS OFFICER": NA_PLACEHOLDER,
    "HALL": NA_PLACEHOLDER,
    "BLOCK": NA_PLACEHOLDER,
    "BED": NA_PLACEHOLDER,
    "MEALS STATUS": "Self-catering",
    "MEALS OFFICER": NA_PLACEHOLDER,
    "SCHOLARSHIP TYPE": "—",  # avoid "None" (pandas may read as NaN)
    "SCHOLARSHIP NAME": NA_PLACEHOLDER,
    "FINANCIAL AID OFFICER": NA_PLACEHOLDER,
}


def _fill_all_missing(df):
    """Fill every column that has missing values so no column has NaN. Use non-empty defaults so Excel doesn't re-read as NaN."""
    filled = []
    for col in df.columns:
        missing = df[col].isna()
        if not missing.any():
            continue
        n = int(missing.sum())
        if col in COLUMN_FILL_DEFAULTS:
            fill_val = COLUMN_FILL_DEFAULTS[col]
        elif df[col].dtype in (np.float64, np.int64):
            val = df[col].median()
            fill_val = val if pd.notna(val) else 0
        else:
            mode_vals = df[col].dropna().astype(str)
            if len(mode_vals) > 0:
                mode_val = mode_vals.mode().iloc[0] if len(mode_vals.mode()) else NA_PLACEHOLDER
            else:
                mode_val = NA_PLACEHOLDER
            fill_val = NA_PLACEHOLDER if str(mode_val).strip() in ("", "nan", "None", "N/A", "NA") else mode_val
        # Ensure column can hold strings so fill is not lost; assign then convert to avoid mixed type
        df[col] = df[col].astype(object).where(~missing, fill_val)
        filled.append((col, n))
    return filled


def fill_students_excel():
    path = SYNTHETIC / "students_list15.xlsx"
    if not path.exists():
        print(f"Skip: {path} not found")
        return
    df = pd.read_excel(path, engine="openpyxl")
    n = len(df)
    print(f"Loaded {path}: {n} rows, {len(df.columns)} columns")

    # Fill missing NAME with Ugandan names
    name_col = "NAME"
    missing_name = df[name_col].isna() | (df[name_col].astype(str).str.strip().str.lower().isin(["", "nan", "none"]))
    n_missing = missing_name.sum()
    if n_missing > 0:
        for idx in df.index[missing_name]:
            first = np.random.choice(UGANDAN_FIRST_NAMES)
            last = np.random.choice(UGANDAN_LAST_NAMES)
            df.at[idx, name_col] = f"{first} {last}"
        print(f"  Filled {n_missing} missing NAME with Ugandan names")

    # Add more Ugandan names: replace existing names that look generic or random with Ugandan
    # Replace up to ~30% of rows (that have a name) with new Ugandan names for variety
    has_name = df[name_col].notna() & (df[name_col].astype(str).str.strip() != "")
    replace_count = min(int(has_name.sum() * 0.35), n - n_missing)
    if replace_count > 0:
        candidates = df.index[has_name].tolist()
        np.random.shuffle(candidates)
        for idx in candidates[:replace_count]:
            first = np.random.choice(UGANDAN_FIRST_NAMES)
            last = np.random.choice(UGANDAN_LAST_NAMES)
            df.at[idx, name_col] = f"{first} {last}"
        print(f"  Replaced {replace_count} names with Ugandan names for variety")

    # Fill other missing key columns (PROGRAM, PROGRESS, YEAR, SEMESTER, etc.)
    key_cols = ["PROGRAM", "PROGRESS", "YEAR", "SEMESTER", "NATIONALITY", "GENDER", "REGISTRATION TYPE",
                "TOTAL REGISTRATIONS", "RESIDENCE", "FEES", "STUDENT STATUS"]
    for col in key_cols:
        if col not in df.columns:
            continue
        missing = df[col].isna()
        if missing.any():
            # Use mode for categorical; for numeric use median or 1
            if df[col].dtype in (np.float64, np.int64):
                fill_val = df[col].median()
                if pd.isna(fill_val):
                    fill_val = 1
            else:
                mode_val = df[col].dropna().mode()
                fill_val = mode_val.iloc[0] if len(mode_val) else ""
            df.loc[missing, col] = fill_val
            print(f"  Filled {missing.sum()} missing in {col}")

    # PROGRAM: fill with first available program name if still missing
    if "PROGRAM" in df.columns:
        still_missing = df["PROGRAM"].isna() | (df["PROGRAM"].astype(str).str.strip() == "")
        if still_missing.any():
            first_prog = df["PROGRAM"].dropna().astype(str).iloc[0] if (df["PROGRAM"].notna().any()) else "Bachelor of Science in Computer Science"
            df.loc[still_missing, "PROGRAM"] = first_prog
            print(f"  Filled {still_missing.sum()} PROGRAM with default")

    # ACC. NO. and REG. NO.: ensure no NaN/nan string
    for col in ["ACC. NO.", "REG. NO."]:
        if col not in df.columns:
            continue
        bad = df[col].isna() | (df[col].astype(str).str.strip().str.lower().isin(["nan", "none", ""]))
        if bad.any():
            # Use S/N or index-based placeholder
            for idx in df.index[bad]:
                sn = df.at[idx, "S/N"] if "S/N" in df.columns and pd.notna(df.at[idx, "S/N"]) else idx + 1
                if col == "REG. NO.":
                    df.at[idx, col] = f"REG{int(sn):05d}"
                else:
                    df.at[idx, col] = f"B{30000 + int(sn)}"
            print(f"  Filled {bad.sum()} missing in {col}")

    # Ensure no column has missing values (list15)
    filled = _fill_all_missing(df)
    for col, n in filled:
        print(f"  Filled {n} missing in {col}")
    df.to_excel(path, index=False, engine="openpyxl")
    print(f"Saved {path}")


def fill_students_list16_excel():
    path = SYNTHETIC / "students_list16.xlsx"
    if not path.exists():
        print(f"Skip: {path} not found")
        return
    df = pd.read_excel(path, engine="openpyxl")
    n = len(df)
    print(f"Loaded {path}: {n} rows, {len(df.columns)} columns")

    # NAME
    name_col = "NAME"
    if name_col in df.columns:
        missing_name = df[name_col].isna() | (df[name_col].astype(str).str.strip().str.lower().isin(["", "nan", "none"]))
        for idx in df.index[missing_name]:
            df.at[idx, name_col] = f"{np.random.choice(UGANDAN_FIRST_NAMES)} {np.random.choice(UGANDAN_LAST_NAMES)}"
        if missing_name.any():
            print(f"  Filled {missing_name.sum()} missing NAME")

    # REG. NO. / ACC. NO.
    for col in ["ACC. NO.", "REG. NO."]:
        if col not in df.columns:
            continue
        bad = df[col].isna() | (df[col].astype(str).str.strip().str.lower().isin(["nan", "none", ""]))
        for idx in df.index[bad]:
            sn = df.at[idx, "S/N"] if "S/N" in df.columns and pd.notna(df.at[idx, "S/N"]) else idx + 1
            df.at[idx, col] = f"REG{int(sn):05d}" if col == "REG. NO." else f"B{30000 + int(sn)}"
        if bad.any():
            print(f"  Filled {bad.sum()} missing in {col}")

    # Fill every other missing column
    filled = _fill_all_missing(df)
    for col, n in filled:
        print(f"  Filled {n} missing in {col}")
    df.to_excel(path, index=False, engine="openpyxl")
    print(f"Saved {path}")


def fill_source_data2_csv():
    # Do NOT modify source_data2.csv: exam_score and absence_reason missing/empty are valid data points
    # (e.g. missing exam_score for MEX; absence_reason only when applicable). Leave file as-is.
    path = DATA / "source_data2.csv"
    if not path.exists():
        print(f"Skip: {path} not found")
        return
    print(f"  {path}: left unchanged (exam_score and absence_reason are meaningful when missing)")


if __name__ == "__main__":
    print("Filling students_list15.xlsx...")
    fill_students_excel()
    print("\nFilling students_list16.xlsx...")
    fill_students_list16_excel()
    print("\nFilling source_data2.csv...")
    fill_source_data2_csv()
    print("\nDone.")
