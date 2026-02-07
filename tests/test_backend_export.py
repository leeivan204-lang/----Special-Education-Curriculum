import unittest
import sys
import os
import json
from io import BytesIO

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

class TestBackendExport(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_export_teacher_schedule(self):
        print("\nTEST: Export Teacher Schedule (Word)")
        
        # Mock Data
        payload = {
            "title": "Test Teacher Schedule",
            "date_range": "2025/01/01",
            "teachers": [
                {
                    "name": "Teacher A",
                    "baseHours": 10,
                    "stats_text": "Stats Info",
                    "stats_table": {
                        "total": 12,
                        "base": 10,
                        "part_time": 2,
                        "overtime": "0",
                        "note": "Note"
                    },
                    "schedule_rows": [
                        {
                            "period": "1",
                            "name": "First Period",
                            "time": "08:00~09:00",
                            "days": {
                                "monday": "Math<br>Teacher A<br>Room 101",
                                "tuesday": "",
                                "wednesday": "",
                                "thursday": "",
                                "friday": ""
                            }
                        },
                        {
                            "isLunch": True
                        }
                    ]
                }
            ]
        }
        
        response = self.app.post('/api/export/word/teacher', 
                                 data=json.dumps(payload),
                                 content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers['Content-Type'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        self.assertIn('teachers_schedule.docx', response.headers['Content-Disposition'])
        
        # Verify content is not empty
        self.assertTrue(len(response.data) > 0)
        print("PASS: Teacher Schedule Export returned valid document")

    def test_export_student_schedule(self):
        print("\nTEST: Export Student Schedule (Word)")
        
        payload = {
            "title": "Test Student Schedule",
            "students": [
                {
                    "name": "Student A",
                    "schedule_rows": [
                        {
                            "period": "1",
                            "time": "08:00~09:00",
                            "days": {
                                "monday": "Math\nTeacher A\nRoom 101",
                                "tuesday": ""
                            }
                        }
                    ]
                }
            ]
        }
        
        response = self.app.post('/api/export/word/student', 
                                 data=json.dumps(payload),
                                 content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.data) > 0)
        print("PASS: Student Schedule Export returned valid document")

if __name__ == '__main__':
    unittest.main()
