# Backend API Data Test Cases

此文件包含用於驗證 `app.py` 中 API 資料處理與同步邏輯的測試案例。重點確保資料存取的正確性、衝突偵測機制的運作以及 WebSocket 的即時通知。

## 測試環境
- **目標檔案**: `d:\特教課表Special Education Curriculum\app.py`
- **測試工具**: `requests` (模擬 HTTP 請求), `socketio-client` (模擬 WebSocket)

## 測試案例列表

### describe('API: 登入 (/api/login)')
- [x] it('應成功登入並回傳 success: true (當提供 userId 時)')
- [x] it('應拒絕登入並回傳 400 錯誤 (當未提供 userId 時)')

### describe('API: 取得資料 (/api/data/:user_id)')
- [x] it('應回傳使用者的 JSON 資料 (當檔案存在時)')
- [x] it('應回傳 success: true 但 data: null (當檔案不存在時)')
- [x] it('應正確處理 JSON 解析錯誤或檔案讀取錯誤')

### describe('API: 儲存資料 (/api/data/:user_id) - 強制模式')
- [x] it('應成功儲存資料並覆寫現有檔案 (當 force: true 或 legacy format)')
- [x] it('應更新伺服器端的 timestamp')
- [x] it('應透過 WebSocket 廣播 data_updated 事件給同一房間的用戶')
- [x] it('應在廣播內容中包含正確的 sourceSocketId 以避免自我通知')

### describe('API: 儲存資料 (/api/data/:user_id) - 衝突偵測')
- [x] it('應成功儲存資料 (當 clientTimestamp 等於 serverTimestamp 且 force: false)')
- [x] it('應拒絕儲存並回傳 409 Conflict (當 clientTimestamp 不等於 serverTimestamp 且 force: false)')
- [x] it('應在 409 回應中包含伺服器當前的 serverData 供前端比對')

### describe('WebSocket: 連線與狀態')
- [x] it('應在 join 事件後正確加入使用者房間 (Room)')
- [x] it('應在斷線後正確移除使用者連線紀錄')
- [x] it('應在多個使用者同時在線時發送 presence_warning 通知')
