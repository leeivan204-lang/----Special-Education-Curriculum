"""測試 Word 匯出 API"""
import requests
import json

BASE_URL = "http://localhost:3000"

# 測試數據
test_data = {
    "title": "測試教師課表",
    "date_range": "2026.02.01-2026.06.30",
    "teachers": [
        {
            "name": "測試教師",
            "schedule_rows": [
                {
                    "period": "1",
                    "name": "1",
                    "time": "08:30~09:15",
                    "isLunch": False,
                    "days": {
                        "monday": "數學", 
                        "tuesday": "國語",
                        "wednesday": "",
                        "thursday": "",
                        "friday": ""
                    }
                },
                {
                    "period": "lunch",
                    "name": "午休",
                    "time": "12:30~13:10",
                    "isLunch": True,
                    "days": {}
                }
            ],
            "stats_text": "-數學：2 節  -國語：1 節",
            "stats_table": {
                "total": 8,
                "base": 6,
                "part_time": 0,
                "overtime": "2 節",
                "note": "(測試備註)"
            }
        }
    ]
}

def test_teacher_export():
    """測試教師課表匯出"""
    url = f"{BASE_URL}/api/export/word/teacher"
    print(f"測試 URL: {url}")
    print(f"請求方法: POST")
    print(f"請求數據: {json.dumps(test_data, ensure_ascii=False, indent=2)[:200]}...")
    
    try:
        response = requests.post(
            url,
            json=test_data,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"\n狀態碼: {response.status_code}")
        print(f"響應標頭: {dict(response.headers)}")
        
        if response.status_code == 200:
            print("✅ API 正常工作！")
            print(f"響應大小: {len(response.content)} bytes")
            # 保存測試文件
            with open("test_export.docx", "wb") as f:
                f.write(response.content)
            print("已保存測試文件: test_export.docx")
        else:
            print(f"❌ API 返回錯誤")
            print(f"響應內容: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ 無法連接到服務器，請確認服務器是否在運行")
    except Exception as e:
        print(f"❌ 發生錯誤: {e}")

if __name__ == "__main__":
    test_teacher_export()
