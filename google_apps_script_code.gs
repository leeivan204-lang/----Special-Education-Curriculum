function doPost(e) {
  // 1. 取得並解析傳入的資料
  var postData = JSON.parse(e.postData.contents);
  var userId = postData.userId; // 確保前端有傳送 userId

  if (!userId) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'No userId provided'})).setMimeType(ContentService.MimeType.JSON);
  }

  // 2. 開啟試算表
  // 如果腳本是綁定在試算表上，使用 getActiveSpreadsheet()
  var ss = SpreadsheetApp.getActiveSpreadsheet(); 
  
  // 如果您希望指定特定的 URL，請取消下行註解並填入 URL
  // var ss = SpreadsheetApp.openByUrl("YOUR_SPREADSHEET_URL_HERE");

  // 3. 檢查是否存在名為 userId 的分頁
  var sheet = ss.getSheetByName(userId);

  // 4. 若分頁不存在 (新 ID)，則建立新分頁
  if (!sheet) {
    sheet = ss.insertSheet(userId);
    // 設定標題列 (可自訂)
    sheet.appendRow(["時間戳記", "資料備份 (JSON)"]); 
  }

  // 5. 將資料寫入分頁 (附加到最後一列)
  // 這裡我們儲存當下時間與完整的資料 JSON 字串
  var timestamp = new Date();
  var dataString = JSON.stringify(postData);
  
  sheet.appendRow([timestamp, dataString]);

  // 6. 回傳成功訊息
  return ContentService.createTextOutput(JSON.stringify({status: 'success', userId: userId})).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var userId = e.parameter.userId;

  if (!userId) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'No userId provided'})).setMimeType(ContentService.MimeType.JSON);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // var ss = SpreadsheetApp.openByUrl("YOUR_SPREADSHEET_URL_HERE");

  var sheet = ss.getSheetByName(userId);

  if (!sheet) {
    // 找不到該 ID 的分頁，回傳空資料或特定訊息
    return ContentService.createTextOutput(JSON.stringify({status: 'success', message: 'New user, no data', data: null})).setMimeType(ContentService.MimeType.JSON);
  }

  // 取得最後一列的資料 (最新的備份)
  var lastRow = sheet.getLastRow();
  
  if (lastRow < 2) { // 假設第 1 列是標題
      return ContentService.createTextOutput(JSON.stringify({status: 'success', message: 'User sheet exists but is empty', data: null})).setMimeType(ContentService.MimeType.JSON);
  }

  // 取得第二欄 (Column B) 的資料，假設我們是依照 [timestamp, dataString] 格式儲存
  var dataString = sheet.getRange(lastRow, 2).getValue();
  
  try {
      var data = JSON.parse(dataString);
      return ContentService.createTextOutput(JSON.stringify({status: 'success', data: data})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Failed to parse data', error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}
