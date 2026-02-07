# Frontend Utils Test Cases

此文件包含用於驗證 `script.js` 中工具函式與資料清理邏輯的測試案例。

## 測試環境
- **目標檔案**: `d:\特教課表Special Education Curriculum\script.js`
- **測試工具**: `Jest` (單元測試)

## 測試案例列表

### describe('時間戳記解析 (parseTimestamp)')
- [x] it('應正確解析標準 ISO 格式時間字串')
- [x] it('應正確解析帶有 AM/PM 的時間字串')
- [x] it('應正確解析帶有 上午/下午 的中文時間字串')
- [x] it('應在解析失敗或輸入為空時回傳 0')

### describe('資料清理 (sanitizeScheduleData)')
- [x] it('應移除 scheduleData 中指向不存在課程 (Course ID 不在 courses 列表中) 的無效區塊')
- [x] it('應將非陣列格式的 scheduleData 項目修正為陣列')
- [x] it('應在發現無效資料並清理後，自動觸發存檔 (saveAllDataToServer)')

### describe('狀態還原 (restoreData)')
- [x] it('應將傳入的資料物件正確寫入 LocalStorage')
- [x] it('應處理部分欄位缺失的情況，使用預設值 (空陣列或空物件)')
