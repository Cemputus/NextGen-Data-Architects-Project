"""View ETL Pipeline Log Files"""
from pathlib import Path
from datetime import datetime

log_dir = Path(__file__).parent / "logs"

if not log_dir.exists():
    print("No logs directory found. Run ETL pipeline first.")
    exit(1)

log_files = sorted(log_dir.glob("etl_pipeline_*.log"), key=lambda x: x.stat().st_mtime, reverse=True)

if not log_files:
    print("No ETL log files found. Run ETL pipeline first.")
    exit(1)

print("=" * 80)
print("ETL PIPELINE LOG FILES")
print("=" * 80)
print(f"\nLog directory: {log_dir}")
print(f"Total log files: {len(log_files)}\n")

for i, log_file in enumerate(log_files[:10], 1):  # Show last 10
    size_kb = log_file.stat().st_size / 1024
    mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
    print(f"{i}. {log_file.name}")
    print(f"   Size: {size_kb:.2f} KB | Modified: {mtime.strftime('%Y-%m-%d %H:%M:%S')}")

print("\n" + "=" * 80)
print("LATEST LOG FILE CONTENT (Last 30 lines)")
print("=" * 80)
print(f"\nFile: {log_files[0].name}\n")

with open(log_files[0], 'r', encoding='utf-8') as f:
    lines = f.readlines()
    for line in lines[-30:]:
        print(line.rstrip())

print("\n" + "=" * 80)
print(f"To view full log: {log_files[0]}")
print("=" * 80)


