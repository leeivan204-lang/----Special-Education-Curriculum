function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    // 1. 解析傳入的資料
    var rawData = e.postData.contents;
    var jsonData = JSON.parse(rawData);
    var timestamp = new Date();
    
    // 取得 User ID，若無則使用 'Unknown'
    var userId = jsonData.id || jsonData.user_id || 'Unknown';
    
    // 2. 處理該 User 的分頁
    processUserLog(ss, userId, jsonData, timestamp);

    // 3. 回傳成功
    return ContentService.createTextOutput(JSON.stringify({
      'result': 'success',
      'id': userId,
      'timestamp': timestamp
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      'result': 'error',
      'message': error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 處理使用者記錄分頁
function processUserLog(ss, userId, data, timestamp) {
  // 嘗試取得該 User ID 的分頁
  var sheet = ss.getSheetByName(userId);
  
  // 若分頁不存在，則建立新分頁並寫入標題
  if (!sheet) {
    sheet = ss.insertSheet(userId);
    // 設定標題列
    var headers = ["時間戳記 (Timestamp)", "備份日期 (Date)", "資料大小 (Bytes)", "完整內容 (JSON)"];
    sheet.appendRow(headers);
    // 格式化標題 (粗體、灰色背景)
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#E0E0E0");
    // 凍結第一列
    sheet.setFrozenRows(1);
  }
  
  // 準備寫入的資料
  var jsonString = JSON.stringify(data);
  var rowData = [
    timestamp,                 // 時間物件 (Google Sheet 會自動格式化)
    timestamp.toISOString(),   // ISO 字串格式
    jsonString.length,         // 資料長度
    jsonString                 // 完整 JSON 字串
  ];
  
  // 將資料追加到最後一列
  sheet.appendRow(rowData);
}
