import pandas as pd
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "data" / "Synthetic_Data"
    files = ["students_list15.xlsx", "students_list16.xlsx"]
    dfs = []
    for fname in files:
        p = root / fname
        if not p.exists():
            continue
        df = pd.read_excel(p)
        df["__source"] = fname
        dfs.append(df)

    if not dfs:
        print("No student list files found.")
        return

    students = pd.concat(dfs, ignore_index=True)

    # Detect program column
    prog_col = None
    for c in students.columns:
        name = str(c).strip().upper()
        if name in ("PROGRAM", "PROGRAM NAME", "PROGRAM_NAME"):
            prog_col = c
            break

    if prog_col is None:
        print("ERROR: no PROGRAM column found in students_list15/16.xlsx")
        print("Columns:", list(students.columns))
        return

    counts = (
        students[prog_col]
        .astype(str)
        .str.strip()
        .value_counts()
        .sort_index()
    )

    for prog, n in counts.items():
        print(f"{prog}\t{n}")


if __name__ == "__main__":
    main()

