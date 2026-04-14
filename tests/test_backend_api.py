import unittest
import json
import os
import shutil
import time
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import app, socketio, DATA_DIR

class TestBackendAPI(unittest.TestCase):

    # CSRF header 用於所有 POST 請求
    CSRF_HEADERS = {'X-Requested-With': 'XMLHttpRequest'}

    def setUp(self):
        """Setup test environment"""
        app.config['TESTING'] = True
        self.app = app.test_client()
        self.socketio = socketio.test_client(app, flask_test_client=self.app)
        self.test_user_id = "test_user_api"

        # Clean up data dir before test
        self.data_path = os.path.join(DATA_DIR, f"{self.test_user_id}.json")
        if os.path.exists(self.data_path):
            os.remove(self.data_path)

    def _post_json(self, url, data):
        """Helper: POST JSON with CSRF header"""
        return self.app.post(url, json=data, headers=self.CSRF_HEADERS)

    def tearDown(self):
        """Clean up after test"""
        if self.socketio.is_connected():
            self.socketio.disconnect()
        if os.path.exists(self.data_path):
            os.remove(self.data_path)

    def test_login(self):
        """測試登入 API"""
        # Success
        response = self._post_json('/api/login', {'userId': self.test_user_id})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json['success'])

        # Failure (Missing ID)
        response = self._post_json('/api/login', {})
        self.assertEqual(response.status_code, 400)

    def test_csrf_protection(self):
        """測試 CSRF 防護：缺少 X-Requested-With header 應被拒絕"""
        # POST without CSRF header → 403
        response = self.app.post('/api/login', json={'userId': self.test_user_id})
        self.assertEqual(response.status_code, 403)
        self.assertIn('CSRF', response.json.get('message', ''))

    def test_save_and_get_data(self):
        """測試資料儲存與讀取"""
        # Initial Get (Empty)
        response = self.app.get(f'/api/data/{self.test_user_id}')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json['data'])

        # Save Data (Force)
        test_data = {'timestamp': 123456789, 'courses': []}
        payload = {
            'data': test_data,
            'lastSyncedTimestamp': 0,
            'force': True
        }
        response = self._post_json(f'/api/data/{self.test_user_id}', payload)
        self.assertEqual(response.status_code, 200)

        # Get Data Again (Should exist)
        response = self.app.get(f'/api/data/{self.test_user_id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['data']['timestamp'], 123456789)

    def test_conflict_detection(self):
        """測試衝突偵測"""
        # 1. Setup initial data
        timestamp_server = 1000
        test_data = {'timestamp': timestamp_server}
        with open(self.data_path, 'w') as f:
            json.dump(test_data, f)

        # 2. Try to save with OLD timestamp (force=False)
        timestamp_client = 500 # Older
        payload = {
            'data': {'timestamp': 2000},
            'lastSyncedTimestamp': timestamp_client,
            'force': False
        }
        response = self._post_json(f'/api/data/{self.test_user_id}', payload)

        # Expect Conflict (409)
        self.assertEqual(response.status_code, 409)
        self.assertFalse(response.json['success'])
        self.assertEqual(response.json['serverData']['timestamp'], timestamp_server)

        # 3. Try to save with SAME timestamp (force=False) -> Should Pass
        payload['lastSyncedTimestamp'] = timestamp_server
        response = self._post_json(f'/api/data/{self.test_user_id}', payload)
        self.assertEqual(response.status_code, 200)

    def test_websocket_notifications(self):
        """測試 WebSocket 通知"""
        # 1. Join Room
        self.socketio.emit('join', {'userId': self.test_user_id})
        received = self.socketio.get_received()
        # Should verify 'status' event
        # print("Received events:", received)
        self.assertTrue(any(e['name'] == 'status' for e in received))

        # 2. Trigger Update via API
        timestamp_server = 12345
        payload = {
            'data': {'timestamp': timestamp_server},
            'lastSyncedTimestamp': 0,
            'force': True,
            'socketId': 'sender_socket_id'
        }
        self._post_json(f'/api/data/{self.test_user_id}', payload)

        # 3. Verify 'data_updated' broadcast
        received = self.socketio.get_received()
        update_event = next((e for e in received if e['name'] == 'data_updated'), None)
        self.assertIsNotNone(update_event)
        self.assertEqual(update_event['args'][0]['timestamp'], timestamp_server)

    def test_presence_warning(self):
        """測試多人同時在線警告"""
        # Client 1 joins
        client1 = socketio.test_client(app, flask_test_client=self.app)
        client1.emit('join', {'userId': self.test_user_id})
        
        # Client 2 joins (Should trigger warning on Client 2? Or both?)
        # app.py logic: emit('presence_warning', ..., room=user_id)
        # So everyone in the room gets it.
        
        client2 = socketio.test_client(app, flask_test_client=self.app)
        client2.emit('join', {'userId': self.test_user_id})
        
        received1 = client1.get_received()
        received2 = client2.get_received()
        
        # Check for warning
        warning1 = next((e for e in received1 if e['name'] == 'presence_warning'), None)
        warning2 = next((e for e in received2 if e['name'] == 'presence_warning'), None)
        
        # Depending on timing/logic, at least the new joiner or room members should get it
        self.assertTrue(warning1 or warning2)
        
        client1.disconnect()
        client2.disconnect()

    # --- 輸入驗證：路徑穿越防護 ---

    def test_invalid_user_id_rejected(self):
        """測試非法 user_id 被拒絕（路徑穿越攻擊防護）"""
        bad_ids = [
            '../etc/passwd',
            '..\\windows\\system32',
            'a' * 65,          # 超過 64 字元上限
            'foo/bar',
            '',
        ]
        for bad_id in bad_ids:
            resp = self.app.get(f'/api/data/{bad_id}')
            self.assertIn(resp.status_code, [400, 404], f"Expected 400/404 for id={bad_id!r}, got {resp.status_code}")

    def test_valid_user_ids_accepted(self):
        """測試合法 user_id 被接受（含中文）"""
        good_ids = ['abc', 'user_1', '王小明', 'test.user-01']
        for gid in good_ids:
            resp = self.app.get(f'/api/data/{gid}')
            self.assertEqual(resp.status_code, 200, f"Expected 200 for id={gid!r}, got {resp.status_code}")

    # --- 資料遷移 ---

    def test_schema_migration_v0_to_v1(self):
        """測試 schemaVersion 自動升級"""
        # Write v0 data (no schemaVersion)
        v0_data = {'timestamp': 999, 'courses': []}
        with open(self.data_path, 'w') as f:
            json.dump(v0_data, f)

        resp = self.app.get(f'/api/data/{self.test_user_id}')
        data = resp.json['data']
        self.assertEqual(data['schemaVersion'], 1)

    # --- 原子寫入 ---

    def test_atomic_write_creates_file(self):
        """測試原子寫入成功建立檔案"""
        payload = {
            'data': {'timestamp': 111, 'test': True},
            'lastSyncedTimestamp': 0,
            'force': True
        }
        resp = self._post_json(f'/api/data/{self.test_user_id}', payload)
        self.assertEqual(resp.status_code, 200)

        # Verify file exists and is valid JSON
        with open(self.data_path, 'r', encoding='utf-8') as f:
            saved = json.load(f)
        self.assertEqual(saved['timestamp'], 111)
        self.assertTrue(saved['test'])

        # Verify no .tmp files left behind
        tmp_files = [f for f in os.listdir(DATA_DIR) if f.endswith('.tmp')]
        self.assertEqual(len(tmp_files), 0, f"Leftover .tmp files: {tmp_files}")

if __name__ == '__main__':
    unittest.main()
