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
  let h = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  h = h
    .replace(/^### (.+)$/gm, '<div class="ai-h3">$1</div>')
    .replace(/^## (.+)$/gm,  '<div class="ai-h2">$1</div>')
    .replace(/^# (.+)$/gm,   '<div class="ai-h1">$1</div>');
  h = h
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  h = h.replace(/^---+$/gm, '<div class="ai-divider"></div>');
  h = h.replace(/^[•\-\*]\s+(.+)$/gm,
    (_, c) => `<div class="ai-bullet"><span class="ai-bullet-dot">▸</span><span>${c}</span></div>`);
  h = h.replace(/^(\d+)[.)]\s+(.+)$/gm,
    (_, n, c) => `<div class="ai-numbered"><span class="ai-num-badge">${n}</span><span>${c}</span></div>`);
  h = h.replace(/\n\n+/g, '<br><br>').replace(/\n/g, '<br>');
  return h;
}

// ── Gemini API 호출 (재시도 포함) ─────────────────────
async function callGemini(prompt, maxTokens = 2048) {
  const key = getGeminiKey();
  if (!key) throw new Error('API 키가 없습니다');

  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // 재시도 시 대기 (2초, 4초)
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, attempt * 2000));
    }

    let res;
    try {
      res = await fetch(`${GEMINI_API_BASE}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.7,
          },
        }),
      });
    } catch (_) {
      if (attempt < MAX_RETRIES) continue;
      throw new Error('네트워크 연결을 확인해주세요.');
    }

    // 재시도 가능한 서버 오류 (과부하, 일시적 오류)
    if ((res.status === 503 || res.status === 500 || res.status === 529) && attempt < MAX_RETRIES) {
      continue;
    }

    // 429 Rate limit — 한 번 더 재시도
    if (res.status === 429 && attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      const candidate = data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text || '';

      // MAX_TOKENS로 잘린 경우 — 있는 것까지 반환
      if (candidate?.finishReason === 'MAX_TOKENS') {
        return text + '\n\n*(내용이 길어 일부만 표시됩니다. 더 자세한 분석은 다시 시도해주세요.)*';
      }

      return text || '응답을 받지 못했습니다.';
    }

    // 오류 처리
    const err = await res.json().catch(() => ({}));
    const rawMsg = err?.error?.message || '';
    const status = res.status;
    let userMsg;

    if (status === 503 || rawMsg.toLowerCase().includes('demand') || rawMsg.toLowerCase().includes('overload')) {
      userMsg = 'Gemini가 현재 과부하 상태입니다. 잠시 후 다시 시도해주세요. 🔄';
    } else if (status === 429 || rawMsg.toLowerCase().includes('quota') || rawMsg.toLowerCase().includes('rate')) {
      userMsg = 'API 사용량 한도에 도달했어요. 잠시 후 다시 시도해주세요.';
    } else if (status === 401 || status === 403 || (status === 400 && rawMsg.toLowerCase().includes('api key'))) {
      userMsg = 'API 키가 올바르지 않아요. 설정에서 키를 확인해주세요.';
    } else {
      userMsg = rawMsg || `오류가 발생했어요. (HTTP ${status})`;
    }
    throw new Error(userMsg);
  }
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

  const prompt = `당신은 개인 재무 분석 AI입니다.
사용자 재무 현황:
${summary}

인사말 없이 바로 아래 형식으로 한국어 분석을 작성하세요:

## 💡 현황 요약
현재 재무 상태를 1-2문장으로 핵심 요약. 잔고, 위험선 대비 상황 포함.

## 📊 주목할 지표
- (가장 중요한 수치와 의미 — 구체적 금액 포함)
- (개선 필요하거나 긍정적인 항목 하나)

## ✅ 오늘의 추천 행동
- (즉시 실천 가능한 구체적 행동)
- (이번달 내 실천할 행동)

형식 엄수. 각 섹션 2-4문장. 이모지 자연스럽게.`;

  return callGemini(prompt, 2048);
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

  const topDays = [...dailyExpenses].sort((a, b) => b.amt - a.amt).slice(0, 3)
    .map(({ d, amt }) => `  - ${month + 1}월 ${d}일: ${amt.toLocaleString('ko-KR')}원`)
    .join('\n') || '  (없음)';

  const curYm = Number(`${year}${pad(month + 1)}`);
  const fixedExpense = (state.entries || []).filter(e => e.type === 'expense' && e.repeat === '매월' && (!e.endMonth || Number(e.endMonth) >= curYm)).reduce((s, e) => s + e.amount, 0);

  const prompt = `당신은 전문 재무 분석 AI입니다.
${monthStr} 가계부 데이터:

가계부 총 지출: ${totalExpense.toLocaleString('ko-KR')}원
가계부 총 수입: ${totalIncome.toLocaleString('ko-KR')}원
월 고정지출: ${fixedExpense.toLocaleString('ko-KR')}원
현재 잔고: ${(state.balance||0).toLocaleString('ko-KR')}원
위험선: ${(state.dangerLine||0).toLocaleString('ko-KR')}원

카테고리별 지출:
${catList}

최다 지출일 TOP 3:
${topDays}

인사말 없이 바로 아래 형식으로 상세 분석을 작성하세요:

## 🎯 이달의 요약
전체 소비 패턴 평가, 잔고 상황, 수입 대비 지출 비율. 2-3문장.

## 📊 카테고리 분석
상위 지출 카테고리별 평가. 과소비 여부 판단. 각 카테고리 구체적 금액과 비율 언급.

## ⚠️ 주의할 점
위험 요소나 즉시 개선 필요 항목. 없으면 "특이사항 없음" 작성.

## 💡 다음달 절약 전략
- 카테고리별 절약 방법 (구체적 금액 포함)
- 절약 방법 2-3가지

## 🏆 잘한 점
긍정적 소비 습관이나 칭찬할 점. 없으면 개선 가능성 긍정적으로 서술.

각 섹션 충분히 상세하게. 구체적 금액과 비율 반드시 언급. 이모지 적극 활용.`;

  return callGemini(prompt, 4096);
}

// ── 3. 미니 채팅 ─────────────────────────────────────
export async function chatWithAI(userMessage, state) {
  const summary = buildFinancialSummary(state);

  const prompt = `당신은 개인 재무 도우미 AI입니다.
사용자 재무 현황:
${summary}

사용자 질문: "${userMessage}"

위 재무 데이터를 참고해 질문에 답변하세요.
답변은 실용적이고 구체적으로. 필요하면 마크다운(굵게, 불릿, ## 헤더) 사용. 한국어로.
인사말 없이 바로 답변 시작.`;

  return callGemini(prompt, 1536);
}

// ── 4. 영수증 OCR (Gemini Vision) ────────────────────
export async function analyzeReceipt(imageBase64, mimeType = 'image/jpeg') {
  const key = getGeminiKey();
  if (!key) throw new Error('API 키가 없습니다');

  const prompt = `이 영수증 이미지를 분석해서 다음 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.
{
  "amount": 숫자(원),
  "memo": "가게명 또는 구매내용 (한국어, 20자 이내)",
  "category": "카테고리 (식비/음료, 교통, 쇼핑, 의료/건강, 문화/취미, 기타 중 하나)",
  "date": "YYYY-MM-DD 또는 null"
}
금액을 찾을 수 없으면 amount를 0으로 설정하세요.`;

  const res = await fetch(`${GEMINI_API_BASE}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]
      }],
      generationConfig: { maxOutputTokens: 256, temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `오류 (HTTP ${res.status})`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const json = text.match(/\{[\s\S]*\}/)?.[0] || '{}';
  return JSON.parse(json);
}

// ── 5. 주간 소비 코칭 ─────────────────────────────────
export async function getWeeklyCoachingInsight(state) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const pad = n => String(n).padStart(2, '0');

  const catThis = {}, catLast = {};
  const thisPrefix = `${year}-${pad(month + 1)}`;
  const lastDate = new Date(year, month - 1, 1);
  const lastPrefix = `${lastDate.getFullYear()}-${pad(lastDate.getMonth() + 1)}`;

  for (const [dk, items] of Object.entries(state.ledgerData || {})) {
    for (const item of items) {
      if (item.type !== 'expense') continue;
      if (dk.startsWith(thisPrefix)) {
        catThis[item.category] = (catThis[item.category] || 0) + item.amount;
      } else if (dk.startsWith(lastPrefix)) {
        catLast[item.category] = (catLast[item.category] || 0) + item.amount;
      }
    }
  }

  const thisTotal = Object.values(catThis).reduce((s, v) => s + v, 0);
  const lastTotal = Object.values(catLast).reduce((s, v) => s + v, 0);
  const fixedIncome = (state.entries || [])
    .filter(e => e.type === 'income' && e.repeat === '매월')
    .reduce((s, e) => s + e.amount, 0);

  const anomalies = [];
  for (const [cat, amt] of Object.entries(catThis)) {
    const prev = catLast[cat] || 0;
    if (prev === 0 && amt > 10000) {
      anomalies.push({ cat, amt, prev, change: 100 });
    } else if (prev > 0) {
      const changePct = Math.round(((amt - prev) / prev) * 100);
      if (changePct > 20) anomalies.push({ cat, amt, prev, change: changePct });
    }
  }
  anomalies.sort((a, b) => b.change - a.change);

  const catList = Object.entries(catThis)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amt]) => {
      const prev = catLast[cat];
      const changeStr = prev
        ? ` (전월 ${prev.toLocaleString('ko-KR')}원, ${Math.round((amt - prev) / prev * 100) >= 0 ? '+' : ''}${Math.round((amt - prev) / prev * 100)}%)`
        : ' (이번달 신규)';
      return `  - ${cat}: ${amt.toLocaleString('ko-KR')}원${changeStr}`;
    })
    .join('\n') || '  (없음)';

  const anomalyList = anomalies.slice(0, 3)
    .map(a => `  - ${a.cat}: +${a.change}% (${a.amt.toLocaleString('ko-KR')}원 / 전월 ${a.prev.toLocaleString('ko-KR')}원)`)
    .join('\n') || '  (없음)';

  const prompt = `당신은 개인 재무 코치 AI입니다. 다음 데이터를 바탕으로 실용적인 소비 코칭을 제공하세요.

이번달 지출 합계: ${thisTotal.toLocaleString('ko-KR')}원
전월 지출 합계: ${lastTotal.toLocaleString('ko-KR')}원
월 고정수입: ${fixedIncome.toLocaleString('ko-KR')}원

이번달 카테고리별 지출 (상위 5개):
${catList}

전월 대비 급증한 카테고리:
${anomalyList}

인사말 없이 바로 아래 형식으로 한국어 코칭을 작성하세요:

## 📊 이번달 지출 진단
전월 대비 지출 변화를 1-2문장으로 요약.

## ⚠️ 주목할 카테고리
급증한 지출 카테고리 분석. 없으면 긍정적 피드백.

## 💡 이번주 절약 팁
즉시 실천 가능한 구체적인 절약 행동 2가지.

각 섹션 2-3문장. 간결하고 실용적으로.`;

  return callGemini(prompt, 1024);
}
