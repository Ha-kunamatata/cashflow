// ════════════════════════════════════════════════════════
// ai.js — Gemini AI 연동
// ════════════════════════════════════════════════════════

const GEMINI_KEY_STORAGE = 'gemini_api_key';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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

// ── 마크다운 → HTML 렌더러 ────────────────────────────
export function renderMarkdown(text) {
  if (!text) return '';
  // HTML 이스케이프
  let h = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // 헤더
  h = h
    .replace(/^### (.+)$/gm, '<div class="ai-h3">$1</div>')
    .replace(/^## (.+)$/gm, '<div class="ai-h2">$1</div>')
    .replace(/^# (.+)$/gm, '<div class="ai-h1">$1</div>');
  // 굵기/기울임
  h = h
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  // 구분선
  h = h.replace(/^---+$/gm, '<div class="ai-divider"></div>');
  // 불릿 포인트
  h = h.replace(/^[•\-\*]\s+(.+)$/gm,
    (_, c) => `<div class="ai-bullet"><span class="ai-bullet-dot">▸</span><span>${c}</span></div>`);
  // 번호 목록
  h = h.replace(/^(\d+)[.)]\s+(.+)$/gm,
    (_, n, c) => `<div class="ai-numbered"><span class="ai-num-badge">${n}</span><span>${c}</span></div>`);
  // 줄바꿈
  h = h.replace(/\n\n+/g, '<br><br>').replace(/\n/g, '<br>');
  return h;
}

// ── Gemini API 호출 ────────────────────────────────────
async function callGemini(prompt, maxTokens = 1024) {
  const key = getGeminiKey();
  if (!key) throw new Error('API 키가 없습니다');

  let res;
  try {
    res = await fetch(`${GEMINI_API_BASE}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.75 },
      }),
    });
  } catch (_) {
    throw new Error('네트워크 연결을 확인해주세요.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const status = res.status;
    const rawMsg = err?.error?.message || '';
    let userMsg;
    if (status === 429 || rawMsg.toLowerCase().includes('quota') || rawMsg.toLowerCase().includes('rate')) {
      userMsg = 'API 사용량 한도에 도달했어요. 잠시 후 다시 시도해주세요.';
    } else if (status === 400 && rawMsg.toLowerCase().includes('api key')) {
      userMsg = 'API 키가 올바르지 않아요. 설정에서 키를 확인해주세요.';
    } else if (status === 401 || status === 403) {
      userMsg = 'API 키가 올바르지 않아요. 설정에서 키를 확인해주세요.';
    } else {
      userMsg = rawMsg || `오류가 발생했어요. (HTTP ${status})`;
    }
    throw new Error(userMsg);
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

  const monthData = {};
  let ledgerTotal = 0;
  for (let d = 1; d <= 31; d++) {
    const dk = `${year}-${pad(month + 1)}-${pad(d)}`;
    const items = state.ledgerData?.[dk] || [];
    for (const item of items) {
      if (item.type === 'expense') {
        monthData[item.category] = (monthData[item.category] || 0) + item.amount;
        ledgerTotal += item.amount;
      }
    }
  }

  const curYm = Number(`${year}${pad(month + 1)}`);
  const fixedIncome  = (state.entries || []).filter(e => e.type === 'income'  && e.repeat === '매월').reduce((s, e) => s + e.amount, 0);
  const fixedExpense = (state.entries || []).filter(e => e.type === 'expense' && e.repeat === '매월' && (!e.endMonth || Number(e.endMonth) >= curYm)).reduce((s, e) => s + e.amount, 0);

  const catList = Object.entries(monthData)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `  - ${cat}: ${amt.toLocaleString('ko-KR')}원`)
    .join('\n') || '  (없음)';

  const totalAssets = (state.assets || []).reduce((s, a) => s + (a.amount || 0), 0);
  const goalList = (state.goals || []).filter(g => !g.done).map(g =>
    `  - ${g.name}: 목표 ${(g.targetAmount||0).toLocaleString('ko-KR')}원 / 저축 ${(g.savedAmount||0).toLocaleString('ko-KR')}원`
  ).join('\n') || '  (없음)';

  return `현재 잔고: ${(state.balance||0).toLocaleString('ko-KR')}원
위험선: ${(state.dangerLine||0).toLocaleString('ko-KR')}원
월 고정수입: ${fixedIncome.toLocaleString('ko-KR')}원
월 고정지출: ${fixedExpense.toLocaleString('ko-KR')}원
총 자산: ${totalAssets.toLocaleString('ko-KR')}원
이번달 가계부 지출합계: ${ledgerTotal.toLocaleString('ko-KR')}원
이번달 지출 카테고리:
${catList}
진행 중인 목표:
${goalList}`;
}

// ── 1. 홈 탭 AI 인사이트 ─────────────────────────────
export async function getHomeInsight(state) {
  const summary = buildFinancialSummary(state);
  const prompt = `당신은 친근하고 전문적인 개인 재무 도우미입니다.
아래는 사용자의 재무 현황입니다 (개인정보 없음):

${summary}

위 데이터를 분석하여 **반드시 아래 마크다운 형식**으로 한국어로 작성해주세요:

**💡 현황 요약**
(현재 재무 상태를 1-2문장으로 핵심만 요약)

**📊 주목할 지표**
- (잔고/수입/지출 중 가장 중요한 수치 1가지와 그 의미)
- (개선이 필요하거나 잘 되고 있는 항목 1가지)

**✅ 오늘의 추천 행동**
- (즉시 실천 가능한 구체적 행동 1가지)
- (이번달 안에 해볼 만한 행동 1가지)

각 섹션을 간결하고 구체적으로, 이모지를 자연스럽게 활용해 작성하세요.`;

  return callGemini(prompt, 1024);
}

// ── 2. 가계부탭 AI 상세 분석 ─────────────────────────
export async function getLedgerAnalysis(state, year, month) {
  const pad = n => String(n).padStart(2, '0');
  const monthStr = `${year}년 ${month + 1}월`;

  const catTotals = {};
  let totalExpense = 0;
  let totalIncome  = 0;
  const dailyExpenses = [];

  for (let d = 1; d <= 31; d++) {
    const dk = `${year}-${pad(month + 1)}-${pad(d)}`;
    const items = state.ledgerData?.[dk] || [];
    let dayExp = 0;
    for (const item of items) {
      if (item.type === 'expense') {
        catTotals[item.category] = (catTotals[item.category] || 0) + item.amount;
        totalExpense += item.amount;
        dayExp += item.amount;
      } else {
        totalIncome += item.amount;
      }
    }
    if (dayExp > 0) dailyExpenses.push({ d, amt: dayExp });
  }

  const catList = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => `  - ${cat}: ${amt.toLocaleString('ko-KR')}원 (${totalExpense > 0 ? Math.round(amt / totalExpense * 100) : 0}%)`)
    .join('\n') || '  (없음)';

  // 최다 지출일 top3
  const topDays = [...dailyExpenses].sort((a, b) => b.amt - a.amt).slice(0, 3)
    .map(({ d, amt }) => `  - ${month + 1}월 ${d}일: ${amt.toLocaleString('ko-KR')}원`)
    .join('\n') || '  (없음)';

  const curYm = Number(`${year}${pad(month + 1)}`);
  const fixedExpense = (state.entries || []).filter(e => e.type === 'expense' && e.repeat === '매월' && (!e.endMonth || Number(e.endMonth) >= curYm)).reduce((s, e) => s + e.amount, 0);

  const prompt = `당신은 전문 재무 분석가입니다.
아래는 ${monthStr} 가계부 데이터입니다:

가계부 총 지출: ${totalExpense.toLocaleString('ko-KR')}원
가계부 총 수입: ${totalIncome.toLocaleString('ko-KR')}원
월 고정지출: ${fixedExpense.toLocaleString('ko-KR')}원
현재 잔고: ${(state.balance||0).toLocaleString('ko-KR')}원
위험선: ${(state.dangerLine||0).toLocaleString('ko-KR')}원

카테고리별 지출:
${catList}

최다 지출일 TOP 3:
${topDays}

위 데이터를 분석하여 **반드시 아래 마크다운 형식**으로 상세히 작성해주세요:

## 🎯 이달의 요약
(전체적인 소비 패턴 평가, 잔고 상황, 2-3문장)

## 📊 카테고리 분석
(상위 지출 카테고리 평가, 과소비 여부, 구체적 금액 언급)

## ⚠️ 주의할 점
(위험 요소나 개선이 시급한 부분, 없으면 "특이사항 없음"으로)

## 💡 다음달 절약 전략
- (카테고리별 구체적 절약 방법 2-3가지, 금액 포함)

## 🏆 잘한 점
(긍정적인 소비 습관이나 칭찬할 만한 점)

각 섹션을 충분히 상세하게, 구체적인 금액과 비율을 꼭 언급하고, 이모지를 적극 활용해 읽기 편하게 작성하세요.`;

  return callGemini(prompt, 2048);
}

// ── 3. 미니 채팅 ─────────────────────────────────────
export async function chatWithAI(userMessage, state) {
  const summary = buildFinancialSummary(state);
  const prompt = `당신은 친근하고 유능한 개인 재무 도우미입니다.
사용자의 현재 재무 현황 (개인정보 없음):

${summary}

사용자 질문: "${userMessage}"

위 재무 데이터를 참고하여 질문에 답변해주세요.
답변은 실용적이고 구체적으로, 필요하면 마크다운(굵게, 불릿)을 사용해 한국어로 작성하세요.`;

  return callGemini(prompt, 1024);
}
