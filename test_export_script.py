
import requests
import json

url = "http://localhost:3000/api/export/word"
data = {
    "title": "Test Schedule",
    "date_range": "2024.01.01-2024.01.31",
    "schedule": [
        {
            "period": "1",
            "name": "1",
            "time": "08:30~09:15",
            "isLunch": False,
            "days": {
                "monday": "Math",
                "tuesday": "English", 
                "wednesday": "Science",
                "thursday": "Art", 
                "friday": "F"
            }
        },
        {
            "period": "lunch",
            "name": "lunch", 
            "time": "12:00",
            "isLunch": True,
            "days": {}
        }
    ]
}

try:
    response = requests.post(url, json=data)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print("Success! Content length:", len(response.content))
        with open("test_output.docx", "wb") as f:
            f.write(response.content)
    else:
        print("Error:", response.text)
except Exception as e:
    print("Exception:", e)
