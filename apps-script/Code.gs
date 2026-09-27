// 將產生後的 Code.gs 貼到「成績表 → 擴充功能 → Apps Script」。
// 部署設定：執行身分「我」、存取權「所有人」。
const QUIZ_VERSION = '2026-09-a';
const QUESTION_IDS = Array.from({length: 25}, (_, i) => 'Q' + String(i + 1).padStart(2, '0'));
const RESPONSE_SHEET = '作答紀錄';
const KEY_SHEET = '題目對照';

function doPost(e) {
  let receipt = '';
  try {
    const raw = e && e.postData && e.postData.contents || '';
    if (raw.length > 50000) throw new Error('資料長度超出限制');
    const data = JSON.parse(raw);
    receipt = String(data.receipt || '');
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,45}$/i.test(receipt)) throw new Error('送出編號無效');
    if (data.version !== QUIZ_VERSION) throw new Error('測驗版本不一致，請重新整理頁面');
    const name = String(data.name || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 40) throw new Error('姓名格式不正確');
    if (!data.answers || Object.keys(data.answers).length !== QUESTION_IDS.length) throw new Error('作答題數不正確');

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const sheet = getResponseSheet_();
      if (findReceiptRow_(sheet, receipt)) return text_('duplicate');
      const answerKey = getAnswerKey_();
      const selected = [];
      let score = 0;
      QUESTION_IDS.forEach(id => {
        const item = data.answers[id];
        const choice = String(item && item.choice || '');
        const optionText = String(item && item.text || '');
        if (!/^[A-D]$/.test(choice) || !optionText || optionText.length > 220) throw new Error(id + ' 的答案格式不正確');
        if (choice === answerKey[id].answer) score++;
        selected.push(choice + '｜' + safeCell_(optionText));
      });
      const row = [new Date(), receipt, safeCell_(name), score, QUESTION_IDS.length, Math.round(score / QUESTION_IDS.length * 100), ...selected];
      sheet.appendRow(row);
      SpreadsheetApp.flush();
      return text_('ok');
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    if (receipt && /^[0-9a-f-]{30,50}$/i.test(receipt)) {
      CacheService.getScriptCache().put('error:' + receipt, String(error.message || '送出失敗'), 600);
    }
    return text_('error');
  }
}

function doGet(e) {
  const p = e && e.parameter || {};
  const callback = String(p.callback || '');
  if (!/^quizReceipt_[A-Za-z0-9_]{8,80}$/.test(callback)) return text_('invalid callback');
  const receipt = String(p.receipt || '');
  let payload = { status: 'pending' };
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,45}$/i.test(receipt)) {
    try {
      const sheet = getResponseSheet_();
      const rowNumber = findReceiptRow_(sheet, receipt);
      if (rowNumber) {
        const answerKey = getAnswerKey_();
        const row = sheet.getRange(rowNumber, 1, 1, 6 + QUESTION_IDS.length).getValues()[0];
        const feedback = {};
        QUESTION_IDS.forEach((id, i) => {
          const selected = String(row[6 + i]).charAt(0);
          feedback[id] = {
            correct: selected === answerKey[id].answer,
            answer: answerKey[id].answer,
            explanation: answerKey[id].explanation
          };
        });
        payload = { status: 'ok', score: Number(row[3]), total: QUESTION_IDS.length, feedback: feedback };
      } else {
        const error = CacheService.getScriptCache().get('error:' + receipt);
        if (error) payload = { status: 'error', message: error };
      }
    } catch (error) {
      payload = { status: 'error', message: '無法讀取成績表，請聯絡老師' };
    }
  }
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function getResponseSheet_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('找不到綁定的 Google Sheet');
  let sheet = book.getSheetByName(RESPONSE_SHEET);
  if (!sheet) sheet = book.insertSheet(RESPONSE_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['送出時間', '送出編號', '姓名', '得分', '總題數', '百分比', ...QUESTION_IDS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getAnswerKey_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book && book.getSheetByName(KEY_SHEET);
  if (!sheet || sheet.getLastRow() < 26) throw new Error('題目對照表不完整');
  const rows = sheet.getRange(2, 1, 25, 11).getValues();
  const key = {};
  rows.forEach(row => {
    const id = String(row[0]);
    const answer = String(row[9]);
    if (!QUESTION_IDS.includes(id) || !/^[A-D]$/.test(answer) || key[id]) throw new Error('題目對照表格式不正確');
    key[id] = { answer: answer, explanation: String(row[10]) };
  });
  if (Object.keys(key).length !== QUESTION_IDS.length) throw new Error('題目對照表題數不正確');
  return key;
}

function findReceiptRow_(sheet, receipt) {
  if (sheet.getLastRow() < 2) return 0;
  const cell = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1)
    .createTextFinder(receipt).matchEntireCell(true).findNext();
  return cell ? cell.getRow() : 0;
}

function safeCell_(value) {
  const text = String(value).replace(/[\u0000-\u001f]/g, ' ').trim();
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function text_(value) {
  return ContentService.createTextOutput(value).setMimeType(ContentService.MimeType.TEXT);
}
