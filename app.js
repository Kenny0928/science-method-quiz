import { QUESTIONS, QUIZ_VERSION } from './questions.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const root = document.querySelector('#quiz');
const endpoint = String(window.QUIZ_ENDPOINT || '').trim();
const state = { name: '', answers: {}, index: -1, receipt: null, busy: false, message: '' };

function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function button(label, className, handler) {
  const node = el('button', `button ${className || ''}`, label);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}

function renderIntro() {
  root.replaceChildren();
  root.append(
    el('h2', '', '開始作答'),
    el('p', 'muted intro-copy', '共 25 題，皆為單選。依序完成後送出，系統會計分並記錄作答；確認記錄成功後即可查看解析。')
  );
  const label = el('label', 'field-label', '姓名');
  label.htmlFor = 'student-name';
  const input = el('input', 'name-input');
  input.id = 'student-name';
  input.type = 'text';
  input.name = 'student-name';
  input.autocomplete = 'name';
  input.maxLength = 40;
  input.required = true;
  input.placeholder = '請填寫你的姓名';
  input.value = state.name;
  const hint = el('p', 'hint', '請填寫老師可辨識的姓名。');
  const error = el('p', 'error');
  error.setAttribute('role', 'alert');
  const start = button('開始測驗', 'primary', () => {
    const name = input.value.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      error.textContent = '請填寫至少 2 個字的姓名。';
      input.focus();
      return;
    }
    state.name = name;
    state.index = 0;
    render();
  });
  input.addEventListener('keydown', event => { if (event.key === 'Enter') start.click(); });
  root.append(label, input, hint, error, start);
}

function chart(kind) {
  const figure = el('figure', 'chart');
  if (kind === 'scatter') {
    figure.innerHTML = `<svg viewBox="0 0 520 280" role="img" aria-labelledby="scatter-title scatter-desc">
      <title id="scatter-title">光照時間與植株高度的散佈圖</title>
      <desc id="scatter-desc">橫軸為每日光照時數，縱軸為植株高度。每株植物用一個獨立的點表示，點與點沒有連線。</desc>
      <rect x="0" y="0" width="520" height="280" fill="#fbfcfd"/>
      <line x1="62" y1="226" x2="480" y2="226" stroke="#526574" stroke-width="2"/>
      <line x1="62" y1="226" x2="62" y2="28" stroke="#526574" stroke-width="2"/>
      <g fill="#347695">${[[105,196],[135,178],[179,186],[208,151],[252,161],[292,117],[341,126],[382,79],[436,66]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="6"/>`).join('')}</g>
      <text x="265" y="261" text-anchor="middle">每日光照（小時）</text><text x="17" y="133" transform="rotate(-90 17 133)" text-anchor="middle">植株高度（cm）</text>
    </svg>`;
  } else {
    const bars = [
      { x: 92, name: '白光', value: 16, height: 160 },
      { x: 195, name: '紅光', value: 13, height: 130 },
      { x: 298, name: '藍光', value: 11, height: 110 },
      { x: 401, name: '綠光', value: 7, height: 70 },
    ];
    figure.innerHTML = `<svg viewBox="0 0 520 280" role="img" aria-labelledby="bar-title bar-desc">
      <title id="bar-title">四種光色組別的第 14 天苗高長條圖</title>
      <desc id="bar-desc">白光 16 公分，紅光 13 公分，藍光 11 公分，綠光 7 公分。</desc>
      <rect x="0" y="0" width="520" height="280" fill="#fbfcfd"/>
      <line x1="62" y1="220" x2="480" y2="220" stroke="#526574" stroke-width="2"/>
      <line x1="62" y1="220" x2="62" y2="28" stroke="#526574" stroke-width="2"/>
      ${[0,5,10,15].map(v => `<text x="52" y="${224-v*10}" text-anchor="end" font-size="13">${v}</text>`).join('')}
      ${bars.map(b => `<rect x="${b.x}" y="${220-b.height}" width="46" height="${b.height}" fill="#417a99"/><text x="${b.x+23}" y="${210-b.height}" text-anchor="middle" font-size="14">${b.value}</text><text x="${b.x+23}" y="243" text-anchor="middle">${b.name}</text>`).join('')}
      <text x="17" y="130" transform="rotate(-90 17 130)" text-anchor="middle">苗高（cm）</text>
    </svg>`;
  }
  figure.append(el('figcaption', '', '教學用虛擬數據'));
  return figure;
}

function progress() {
  const answered = Object.keys(state.answers).length;
  const row = el('div', 'progress-row');
  row.append(el('span', '', `已答 ${answered} / ${QUESTIONS.length} 題`), el('span', '', state.name));
  const track = el('div', 'progress-track');
  const fill = el('div', 'progress-fill');
  fill.style.width = `${(answered / QUESTIONS.length) * 100}%`;
  track.append(fill);
  return [row, track];
}

function renderQuestion() {
  const q = QUESTIONS[state.index];
  root.replaceChildren(...progress());
  root.append(el('p', 'question-meta', `${String(state.index + 1).padStart(2, '0')} / ${QUESTIONS.length}　${q.area}`));
  const heading = el('h2', '', q.prompt);
  heading.tabIndex = -1;
  root.append(heading);
  if (q.figure) root.append(chart(q.figure));
  const group = el('fieldset', 'options');
  group.setAttribute('aria-label', '請選擇一個答案');
  q.options.forEach((option, i) => {
    const label = el('label', 'option');
    const input = el('input');
    input.type = 'radio';
    input.name = q.id;
    input.value = LETTERS[i];
    input.checked = state.answers[q.id] === LETTERS[i];
    input.addEventListener('change', () => {
      state.answers[q.id] = LETTERS[i];
      renderQuestion();
      const selected = root.querySelector(`input[value="${LETTERS[i]}"]`);
      selected?.focus();
    });
    label.append(input, el('span', 'option-text', `${LETTERS[i]}. ${option}`));
    group.append(label);
  });
  root.append(group);
  const actions = el('div', 'actions');
  if (state.index > 0) actions.append(button('上一題', '', () => { state.index--; render(); }));
  else actions.append(el('span'));
  actions.append(button(state.index === QUESTIONS.length - 1 ? '檢查作答' : '下一題', 'primary', () => {
    state.index++;
    render();
  }));
  root.append(actions);
  heading.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function renderReview() {
  root.replaceChildren(...progress(), el('h2', '', '檢查作答'));
  const missing = QUESTIONS.filter(q => !state.answers[q.id]);
  root.append(el('p', 'muted', missing.length ? `還有 ${missing.length} 題未作答。請完成後再送出。` : '已完成全部題目。送出後答案就不能修改。'));
  const summary = el('div', 'review-summary');
  for (const area of ['文獻解構', '相關與因果', '圖表判讀']) {
    const qs = QUESTIONS.filter(q => q.area === area);
    summary.append(el('span', 'pill', `${area} ${qs.filter(q => state.answers[q.id]).length}/${qs.length}`));
  }
  root.append(summary);
  const grid = el('div', 'review-grid');
  grid.setAttribute('aria-label', '題目作答狀態');
  QUESTIONS.forEach((q, i) => {
    const jump = el('button', `review-jump ${state.answers[q.id] ? '' : 'missing'}`, `${i + 1}${state.answers[q.id] ? ' ✓' : '　'}`);
    jump.type = 'button';
    jump.setAttribute('aria-label', `第 ${i + 1} 題，${state.answers[q.id] ? '已作答' : '未作答'}`);
    jump.addEventListener('click', () => { state.index = i; render(); });
    grid.append(jump);
  });
  root.append(grid);
  if (state.message) root.append(el('p', 'status error', state.message));
  const actions = el('div', 'actions');
  actions.append(button('返回修改', '', () => { state.index = QUESTIONS.length - 1; state.message = ''; render(); }));
  const submit = button(state.busy ? '正在送出…' : '送出並計分', 'primary', submitQuiz);
  submit.disabled = state.busy || missing.length > 0 || !endpoint;
  actions.append(submit);
  root.append(actions);
  if (!endpoint) root.append(el('p', 'status error', '測驗尚未開放送出。請老師先完成成績表連線設定。'));
}

function callbackReceipt(url, callbackName) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => done(new Error('確認逾時')), 6500);
    function done(value, ok = false) {
      window.clearTimeout(timer);
      delete window[callbackName];
      script.remove();
      ok ? resolve(value) : reject(value);
    }
    window[callbackName] = value => done(value, true);
    script.onerror = () => done(new Error('無法確認成績表連線'));
    script.src = url;
    document.head.append(script);
  });
}

async function waitForReceipt(receipt) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const callback = `quizReceipt_${crypto.randomUUID().replaceAll('-', '')}`;
    const url = new URL(endpoint);
    url.searchParams.set('action', 'receipt');
    url.searchParams.set('receipt', receipt);
    url.searchParams.set('callback', callback);
    const result = await callbackReceipt(url.href, callback);
    if (result.status === 'ok') return result;
    if (result.status === 'error') throw new Error(result.message || '送出失敗');
    await new Promise(resolve => window.setTimeout(resolve, 1500));
  }
  throw new Error('尚未確認成績表已收到資料。請稍後再按「送出並計分」，系統會使用同一筆送出編號避免重複記錄。');
}

async function submitQuiz() {
  if (state.busy || Object.keys(state.answers).length !== QUESTIONS.length) return;
  if (!state.receipt) state.receipt = crypto.randomUUID();
  state.busy = true;
  state.message = '';
  renderReview();
  try {
    const answers = {};
    for (const q of QUESTIONS) {
      const choice = state.answers[q.id];
      answers[q.id] = { choice, text: q.options[LETTERS.indexOf(choice)] };
    }
    await fetch(endpoint, {
      method: 'POST', mode: 'no-cors', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ version: QUIZ_VERSION, receipt: state.receipt, name: state.name, answers }),
    });
    const result = await waitForReceipt(state.receipt);
    renderResult(result);
  } catch (error) {
    state.message = error instanceof Error ? error.message : '送出失敗，請稍後再試。';
    state.busy = false;
    renderReview();
  }
}

function renderResult(result) {
  state.busy = false;
  root.replaceChildren(el('p', 'question-meta', '已送出並記錄'), el('h2', '', `${state.name}，你的成績`));
  const score = el('div', 'score');
  score.append(document.createTextNode(String(result.score)), el('small', '', ` / ${result.total} 題`));
  root.append(score, el('p', 'muted', '以下是逐題結果與解析。'));
  const list = el('div', 'feedback-list');
  QUESTIONS.forEach((q, i) => {
    const feedback = result.feedback?.[q.id];
    if (!feedback) return;
    const item = el('section', `feedback-item ${feedback.correct ? 'correct' : 'incorrect'}`);
    item.append(
      el('p', 'feedback-head', `第 ${i + 1} 題 · ${q.area} · ${q.concept} · ${feedback.correct ? '答對' : '答錯'}`),
      el('h3', '', q.prompt),
      el('p', '', `你的答案：${state.answers[q.id]}．${q.options[LETTERS.indexOf(state.answers[q.id])]}`),
      el('p', 'feedback-answer', `正確答案：${feedback.answer}．${q.options[LETTERS.indexOf(feedback.answer)]}`),
      el('p', 'muted', feedback.explanation)
    );
    list.append(item);
  });
  root.append(list);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function render() {
  if (state.index < 0) renderIntro();
  else if (state.index < QUESTIONS.length) renderQuestion();
  else renderReview();
}

render();
