// ════════════════════════════════════════════════════════
// portfolioView.ts — 포트폴리오 탭 렌더링 & 입력 핸들러
// ────────────────────────────────────────────────────────
// · 상단 리밸런싱 신호등
// · 항아리 A/B 세로 그릇 (총자산 대비 비율만큼 채움, B는 자산별 색층)
// · 자산별 목표선 겹친 비중 막대 + 편차(pp) + 금액 입력칸
// ────────────────────────────────────────────────────────
// renderPortfolio() 는 navigate()/renderAll() 에서 반복 호출돼도 안전하다:
// 골격은 최초 1회만 생성(입력 포커스 유지), 이후엔 파생 시각요소만 갱신.
// 값 변경 시 state.portfolio 갱신 → save()(localStorage + Firestore) 디바운스.
// ════════════════════════════════════════════════════════
import {
  ISA_HOLDINGS,
  GOLD_COLOR,
  GOLD_TARGET_PCT,
  computePortfolio,
  emptyPortfolio,
  type HoldingResult,
} from './portfolio';
import { state, save } from './state';
import { fmtFull, fmtShort, escapeHtml } from './utils';

const ISA_CODES = new Set(ISA_HOLDINGS.map((h) => h.code));
const MONEY_KEYS = [...ISA_HOLDINGS.map((h) => h.code), 'gold', 'jarA'];

let _built = false;

// ── 진입점 (반복 호출 안전) ──────────────────────────────
export function renderPortfolio(): void {
  const root = document.getElementById('portfolio-root');
  if (!root) return;
  if (!state.portfolio) state.portfolio = emptyPortfolio();
  if (!_built) {
    buildSkeleton(root);
    bindUI(root);
    _built = true;
  }
  syncInputsFromState(root);
  updateView(root);
}

// ── 정적 골격 생성 (최초 1회) ────────────────────────────
function moneyRow(opts: { key: string; name: string; color: string; targetLabel: string; soft?: boolean }): string {
  const { key, name, color, targetLabel, soft } = opts;
  return `
  <div class="pf-row${soft ? ' pf-row--soft' : ''}" data-row="${key}">
    <div class="pf-row-head">
      <span class="pf-dot" style="background:${color}"></span>
      <span class="pf-row-name">${escapeHtml(name)}</span>
      <span class="pf-row-target">목표 ${targetLabel}</span>
      <span class="pf-flag" data-flag="${key}" hidden></span>
    </div>
    <div class="pf-bar" title="현재비중">
      <div class="pf-bar-fill" data-fill="${key}" style="background:${color}"></div>
      <div class="pf-bar-target" data-target="${key}"></div>
    </div>
    <div class="pf-row-foot">
      <span class="pf-weight" data-weight="${key}">–</span>
      <span class="pf-dev" data-dev="${key}"></span>
      <label class="pf-input-wrap">
        <span class="pf-input-won">₩</span>
        <input class="pf-input" type="text" inputmode="numeric" autocomplete="off"
               data-input="${key}" placeholder="0" aria-label="${escapeHtml(name)} 평가금액">
      </label>
    </div>
  </div>`;
}

function buildSkeleton(root: HTMLElement): void {
  const isaRows = ISA_HOLDINGS.map((h) =>
    moneyRow({ key: h.code, name: `${h.name} (${h.code})`, color: h.color, targetLabel: `${h.target}%` }),
  ).join('');

  const goldRow = moneyRow({
    key: 'gold',
    name: '금현물',
    color: GOLD_COLOR,
    targetLabel: `약 ${GOLD_TARGET_PCT}% · 느슨`,
    soft: true,
  });

  root.innerHTML = `
  <div class="pf">
    <div class="pf-signal" data-signal>
      <div class="pf-signal-light" data-signal-light></div>
      <div class="pf-signal-txt">
        <div class="pf-signal-title" data-signal-title>–</div>
        <div class="pf-signal-sub">ISA 4종목 목표배분 대비 ±5%p 이탈 감시</div>
      </div>
    </div>

    <div class="pf-jars">
      <div class="pf-jar">
        <div class="pf-vessel"><div class="pf-vessel-fill pf-vessel-a" data-jar-a></div></div>
        <div class="pf-jar-label">항아리 A · 유동성</div>
        <div class="pf-jar-amt" data-jar-a-amt>₩0</div>
        <div class="pf-jar-ratio" data-jar-a-ratio>0%</div>
      </div>
      <div class="pf-jar">
        <div class="pf-vessel"><div class="pf-vessel-fill pf-vessel-b" data-jar-b></div></div>
        <div class="pf-jar-label">항아리 B · ISA + 금</div>
        <div class="pf-jar-amt" data-jar-b-amt>₩0</div>
        <div class="pf-jar-ratio" data-jar-b-ratio>0%</div>
      </div>
      <div class="pf-total">
        <div class="pf-total-label">총자산</div>
        <div class="pf-total-amt" data-total-amt>₩0</div>
        <div class="pf-legend" data-legend></div>
      </div>
    </div>

    <section class="pf-sec">
      <h3 class="pf-sec-title">항아리 B · ISA 4종목 <span class="pf-sec-note">목표배분 대비 현재비중</span></h3>
      ${isaRows}
    </section>

    <section class="pf-sec">
      <h3 class="pf-sec-title">금현물 <span class="pf-sec-note">항아리 B 내 비중</span></h3>
      ${goldRow}
    </section>

    <section class="pf-sec">
      <h3 class="pf-sec-title">항아리 A · 유동성 <span class="pf-sec-note">비상금 · 대기자금</span></h3>
      <div class="pf-row pf-row--soft" data-row="jarA">
        <div class="pf-row-foot pf-row-foot--single">
          <span class="pf-weight" data-weight="jarA">총자산의 –</span>
          <label class="pf-input-wrap">
            <span class="pf-input-won">₩</span>
            <input class="pf-input" type="text" inputmode="numeric" autocomplete="off"
                   data-input="jarA" placeholder="0" aria-label="항아리 A 금액">
          </label>
        </div>
      </div>
    </section>
  </div>`;
}

// ── 입력값 → 상태 반영 (이벤트 위임) ─────────────────────
function applyInput(key: string, amount: number): void {
  if (ISA_CODES.has(key)) state.portfolio.isa[key] = amount;
  else if (key === 'gold') state.portfolio.gold = amount;
  else if (key === 'jarA') state.portfolio.jarA = amount;
}

let _saveTimer: ReturnType<typeof setTimeout> | undefined;
function debouncedSave(): void {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => save(), 500);
}

function bindUI(root: HTMLElement): void {
  root.addEventListener('input', (e) => {
    const input = (e.target as HTMLElement)?.closest<HTMLInputElement>('[data-input]');
    if (!input) return;
    applyInput(input.dataset.input!, parseAmount(input.value));
    debouncedSave();
    updateView(root);
  });
  // 포커스 아웃: 콤마 포맷 정리
  root.addEventListener(
    'focusout',
    (e) => {
      const input = (e.target as HTMLElement)?.closest<HTMLInputElement>('[data-input]');
      if (!input) return;
      const n = parseAmount(input.value);
      input.value = n > 0 ? n.toLocaleString('ko-KR') : '';
    },
    true,
  );
}

/** 상태값을 입력칸에 반영 (포커스된 칸은 건드리지 않음) */
function syncInputsFromState(root: HTMLElement): void {
  const active = document.activeElement;
  for (const key of MONEY_KEYS) {
    const input = root.querySelector<HTMLInputElement>(`[data-input="${key}"]`);
    if (!input || input === active) continue;
    const val = ISA_CODES.has(key) ? state.portfolio.isa[key] || 0 : key === 'gold' ? state.portfolio.gold : state.portfolio.jarA;
    input.value = val > 0 ? val.toLocaleString('ko-KR') : '';
  }
}

// ── 파생 시각요소 갱신 ───────────────────────────────────
function updateView(root: HTMLElement): void {
  const r = computePortfolio(state.portfolio);

  // 신호등
  const signal = root.querySelector<HTMLElement>('[data-signal]');
  const title = root.querySelector<HTMLElement>('[data-signal-title]');
  if (signal && title) {
    signal.classList.toggle('is-ok', r.flagCount === 0);
    signal.classList.toggle('is-warn', r.flagCount > 0);
    title.textContent =
      r.flagCount === 0 ? (r.isaTotal > 0 ? '✓ 리밸런싱 불필요' : '금액을 입력해 시작하세요') : `⚠ 리밸런싱 신호 ${r.flagCount}건`;
  }

  // 항아리 그릇
  const jarA = root.querySelector<HTMLElement>('[data-jar-a]');
  const jarB = root.querySelector<HTMLElement>('[data-jar-b]');
  if (jarA) jarA.style.height = `${clamp(r.aRatio)}%`;
  if (jarB) {
    const segs = [
      ...r.holdings.map((h) => ({ color: h.color, pct: r.total > 0 ? (h.amount / r.total) * 100 : 0, name: h.short })),
      { color: GOLD_COLOR, pct: r.total > 0 ? (r.gold / r.total) * 100 : 0, name: '금' },
    ].filter((s) => s.pct > 0);
    jarB.style.height = `${clamp(r.bRatio)}%`;
    jarB.innerHTML = segs
      .map((s) => `<div class="pf-vessel-seg" style="flex:${s.pct};background:${s.color}" title="${escapeHtml(s.name)}"></div>`)
      .join('');
  }
  setText(root, '[data-jar-a-amt]', fmtShort(r.jarA));
  setText(root, '[data-jar-b-amt]', fmtShort(r.jarB));
  setText(root, '[data-jar-a-ratio]', `${fmtPct(r.aRatio)}%`);
  setText(root, '[data-jar-b-ratio]', `${fmtPct(r.bRatio)}%`);
  setText(root, '[data-total-amt]', fmtFull(r.total));

  // 총자산 범례
  const legend = root.querySelector<HTMLElement>('[data-legend]');
  if (legend) {
    const items = [
      { name: '항아리 A', color: '#64748b', pct: r.aRatio },
      ...r.holdings.map((h) => ({ name: h.short, color: h.color, pct: r.total > 0 ? (h.amount / r.total) * 100 : 0 })),
      { name: '금', color: GOLD_COLOR, pct: r.total > 0 ? (r.gold / r.total) * 100 : 0 },
    ].filter((i) => i.pct > 0.05);
    legend.innerHTML = items
      .map(
        (i) =>
          `<span class="pf-legend-item"><span class="pf-dot" style="background:${i.color}"></span>${escapeHtml(i.name)} <b>${fmtPct(
            i.pct,
          )}%</b></span>`,
      )
      .join('');
  }

  // ISA 종목 막대
  const isaHasData = r.isaTotal > 0;
  for (const h of r.holdings) updateBar(root, h, isaHasData);

  // 금현물 막대 (느슨한 목표선)
  updateSoftBar(root, { key: 'gold', weight: r.goldWeight, target: GOLD_TARGET_PCT, deviation: r.goldDeviation, hasBase: r.jarB > 0 });

  // 항아리 A 비중
  setText(root, '[data-weight="jarA"]', r.total > 0 ? `총자산의 ${fmtPct(r.aRatio)}%` : '총자산의 –');
}

function updateBar(root: HTMLElement, h: HoldingResult, isaHasData: boolean): void {
  const fill = root.querySelector<HTMLElement>(`[data-fill="${h.code}"]`);
  const target = root.querySelector<HTMLElement>(`[data-target="${h.code}"]`);
  const weight = root.querySelector<HTMLElement>(`[data-weight="${h.code}"]`);
  const dev = root.querySelector<HTMLElement>(`[data-dev="${h.code}"]`);
  const flag = root.querySelector<HTMLElement>(`[data-flag="${h.code}"]`);
  const rowEl = root.querySelector<HTMLElement>(`[data-row="${h.code}"]`);

  if (fill) fill.style.width = `${clamp(h.weight)}%`;
  if (target) target.style.left = `${clamp(h.target)}%`;
  if (weight) weight.textContent = isaHasData ? `${fmtPct(h.weight)}%` : '–';
  if (dev) {
    dev.textContent = isaHasData ? `${fmtSigned1(h.deviation)}%p` : '';
    dev.className = `pf-dev ${!isaHasData ? '' : h.deviation > 0 ? 'pf-dev--over' : h.deviation < 0 ? 'pf-dev--under' : ''}`;
  }
  if (flag) {
    if (h.flagged) {
      flag.hidden = false;
      flag.textContent = h.action === 'sell' ? '매도 후보' : '매수 후보';
      flag.className = `pf-flag ${h.action === 'sell' ? 'pf-flag--sell' : 'pf-flag--buy'}`;
    } else {
      flag.hidden = true;
    }
  }
  if (rowEl) rowEl.classList.toggle('is-flagged', h.flagged);
}

function updateSoftBar(
  root: HTMLElement,
  o: { key: string; weight: number; target: number; deviation: number; hasBase: boolean },
): void {
  const fill = root.querySelector<HTMLElement>(`[data-fill="${o.key}"]`);
  const target = root.querySelector<HTMLElement>(`[data-target="${o.key}"]`);
  const weight = root.querySelector<HTMLElement>(`[data-weight="${o.key}"]`);
  const dev = root.querySelector<HTMLElement>(`[data-dev="${o.key}"]`);
  if (fill) fill.style.width = `${clamp(o.weight)}%`;
  if (target) target.style.left = `${clamp(o.target)}%`;
  if (weight) weight.textContent = o.hasBase ? `${fmtPct(o.weight)}%` : '–';
  if (dev) dev.textContent = o.hasBase ? `${fmtSigned1(o.deviation)}%p` : '';
}

// ── 로컬 헬퍼 ────────────────────────────────────────────
function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
function fmtPct(n: number): string {
  return (n || 0).toFixed(1);
}
function fmtSigned1(n: number): string {
  const s = (n || 0).toFixed(1);
  return (n || 0) > 0 ? `+${s}` : s;
}
function parseAmount(raw: string): number {
  const n = Number(String(raw).replace(/[^\d]/g, '')); // 콤마·원·공백 등 숫자 외 문자 제거
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}
function setText(root: HTMLElement, sel: string, txt: string): void {
  const el = root.querySelector(sel);
  if (el) el.textContent = txt;
}
