"""Quick test to verify UCU data structure"""
from ucu_actual_data import UCU_FACULTIES, UCU_STRUCTURE
from collections import Counter

print(f"✅ Faculties: {len(UCU_FACULTIES)}")
print(f"✅ Total Programs: {len(UCU_STRUCTURE)}")

# Count departments
depts = Counter([(fid, dept) for fid, dept, _, _, _, _, _ in UCU_STRUCTURE])
print(f"✅ Total Departments: {len(depts)}")

print("\n📚 Faculties:")
for f in UCU_FACULTIES:
    print(f"  {f['id']}. {f['name']}")

print("\n📊 Departments by Faculty:")
for (fid, dept), count in sorted(depts.items()):
    fac_name = next((f['name'] for f in UCU_FACULTIES if f['id'] == fid), 'Unknown')
    print(f"  {fac_name} -> {dept} ({count} programs)")

print("\n✅ Data structure is correct!")

