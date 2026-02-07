import json

# 讀取修正後的資料
with open('data/DemoUser2026.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=" * 60)
print("DemoUser2026 資料檢查")
print("=" * 60)

print(f"\n課程總數: {len(data['courses'])}")
print("\n課程列表:")
print("-" * 60)

for i, course in enumerate(data['courses'], 1):
    print(f"{i}. ID: {course['id']}")
    print(f"   名稱: {course['name']}")
    print(f"   分組: {course['groups']} (類型: {type(course['groups']).__name__})")
    
    # 檢查是否有groupDetails
    if 'groupDetails' in course:
        print(f"   ✓ 有 groupDetails")
    else:
        print(f"   ✗ 缺少 groupDetails")
    
    # 檢查舊欄位
    if 'groupInfo' in course:
        print(f"   ✗ 有舊欄位 groupInfo (應刪除)")
    if 'hoursPerWeek' in course:
        print(f"   ✗ 有舊欄位 hoursPerWeek (應刪除)")
    
    print()

print("\n學年度資訊:")
print("-" * 60)
st = data.get('scheduleTitle', {})
print(f"學校名稱: {st.get('schoolName', 'N/A')}")
print(f"學年度: {st.get('academicYear', 'N/A')}")
print(f"學期: {st.get('semester', 'N/A')}")
print(f"開始日期: {st.get('startDate', 'N/A')}")
print(f"結束日期: {st.get('endDate', 'N/A')}")
