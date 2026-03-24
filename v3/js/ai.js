// ════════════════════════════════════════════════════════
// ai.js — Gemini AI 연동
// ════════════════════════════════════════════════════════

const GEMINI_KEY_STORAGE = 'gemini_api_key';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ── API 키 관리 ───────────────────────────────────────
export function getGeminiKey() {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
}

export function setGeminiKey(key) {
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
  } else {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
  }
}

export function hasGeminiKey() {
  return !!getGeminiKey();
}

// ── Gemini API 호출 ────────────────────────────────────
async function callGemini(prompt) {
  const key = getGeminiKey();
  if (!key) throw new Error('API 키가 없습니다');

  const res = await fetch(`${GEMINI_API_BASE}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '응답을 받지 못했습니다.';
}

// ── 데이터 요약 빌더 ───────────────────────────────────
function buildFinancialSummary(state) {
  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth();
  const pad   = n => String(n).padStart(2, '0');

  // 이번달 가계부 카테고리 집계
  const monthData = {};
  for (let d = 1; d <= 31; d++) {
    const dk = `${year}-${pad(month + 1)}-${pad(d)}`;
    const items = state.ledgerData?.[dk] || [];
    for (const item of items) {
      if (item.type === 'expense') {
        monthData[item.category] = (monthData[item.category] || 0) + item.amount;
      }
    }
  }

  // 고정 수입/지출
  const curYm = Number(`${year}${pad(month + 1)}`);
  const fixedIncome  = state.entries.filter(e => e.type === 'income'  && e.repeat === '매월').reduce((s, e) => s + e.amount, 0);
  const fixedExpense = state.entries.filter(e => e.type === 'expense' && e.repeat === '매월' && (!e.endMonth || Number(e.endMonth) >= curYm)).reduce((s, e) => s + e.amount, 0);

  const catList = Object.entries(monthData)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `  - ${cat}: ${amt.toLocaleString('ko-KR')}원`)
    .join('\n') || '  (없음)';

  return `현재 잔고: ${state.balance.toLocaleString('ko-KR')}원
위험선: ${(state.dangerLine || 0).toLocaleString('ko-KR')}원
월 고정수입: ${fixedIncome.toLocaleString('ko-KR')}원
월 고정지출: ${fixedExpense.toLocaleString('ko-KR')}원
이번달 가계부 지출 카테고리:
${catList}`;
}

// ── 1. 홈 탭 AI 인사이트 ─────────────────────────────
export async function getHomeInsight(state) {
  const summary = buildFinancialSummary(state);
  const prompt = `당신은 친근하고 실용적인 개인 재무 도우미입니다.
아래는 사용자의 재무 현황입니다 (개인정보 없음):

${summary}

위 데이터를 바탕으로 짧고 실용적인 재무 인사이트를 2~3문장으로 한국어로 작성해주세요.
긍정적이고 구체적인 조언이어야 합니다. 이모지를 1~2개 포함해도 됩니다.`;

  return callGemini(prompt);
}

// ── 2. 통계 탭 AI 상세 분석 ──────────────────────────
export async function getLedgerAnalysis(state, year, month) {
  const pad = n => String(n).padStart(2, '0');
  const monthStr = `${year}년 ${month + 1}월`;

  // 해당 월 전체 집계
  const catTotals = {};
  let totalExpense = 0;
  let totalIncome  = 0;

  for (let d = 1; d <= 31; d++) {
    const dk = `${year}-${pad(month + 1)}-${pad(d)}`;
    const items = state.ledgerData?.[dk] || [];
    for (const item of items) {
      if (item.type === 'expense') {
        catTotals[item.category] = (catTotals[item.category] || 0) + item.amount;
        totalExpense += item.amount;
      } else {
        totalIncome += item.amount;
      }
    }
  }

  const catList = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `  - ${cat}: ${amt.toLocaleString('ko-KR')}원 (${totalExpense > 0 ? Math.round(amt / totalExpense * 100) : 0}%)`)
    .join('\n') || '  (없음)';

  const curYm = Number(`${year}${pad(month + 1)}`);
  const fixedExpense = state.entries.filter(e => e.type === 'expense' && e.repeat === '매월' && (!e.endMonth || Number(e.endMonth) >= curYm)).reduce((s, e) => s + e.amount, 0);

  const prompt = `당신은 전문 재무 분석가입니다.
아래는 ${monthStr} 가계부 데이터입니다 (개인정보 없음):

가계부 총 지출: ${totalExpense.toLocaleString('ko-KR')}원
가계부 총 수입: ${totalIncome.toLocaleString('ko-KR')}원
월 고정지출: ${fixedExpense.toLocaleString('ko-KR')}원
현재 잔고: ${state.balance.toLocaleString('ko-KR')}원
위험선: ${(state.dangerLine || 0).toLocaleString('ko-KR')}원

카테고리별 지출:
${catList}

위 데이터를 분석하여 다음을 포함한 한국어 재무 분석을 작성해주세요:
1. 이번달 소비 패턴 평가 (1~2문장)
2. 가장 주목할 카테고리와 이유 (1~2문장)
3. 다음달을 위한 구체적인 절약 팁 (2~3가지 불릿 포인트)
이모지를 적절히 사용해 읽기 쉽게 작성해주세요.`;

  return callGemini(prompt);
}

// ── 3. 미니 채팅 ─────────────────────────────────────
export async function chatWithAI(userMessage, state) {
  const summary = buildFinancialSummary(state);
  const prompt = `당신은 친근하고 유능한 개인 재무 도우미입니다.
사용자의 현재 재무 현황 (개인정보 없음):

${summary}

사용자 질문: "${userMessage}"

위 재무 데이터를 참고하여 질문에 답변해주세요.
답변은 간결하고 실용적으로, 한국어로 작성해주세요 (3~5문장 이내).`;

  return callGemini(prompt);
}
