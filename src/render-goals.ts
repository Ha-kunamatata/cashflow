// @ts-nocheck
// ════════════════════════════════════════════════════════
// render-goals.ts — 목표/하우스레벨/스트릭 렌더링
// ════════════════════════════════════════════════════════
import { HOUSE_LEVELS, ASSET_TYPES, ASSET_PURPOSES, getTotalAssets, getHouseLevel } from './assets';
import { computeStreak, BADGE_DEFS, RARITY_CONFIG } from './streak';
import { today, fmtShort, fmtFull, fmtSigned, escapeHtml, yyyymm } from './utils';
import { state } from './state';

const _celebratedGoals = new Set();

export function renderGoals() {
  const container = document.getElementById('goals-list');
  if (!container) return;

  const goals = state.goals || [];
  if (!goals.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🎯</div>
      <div class="empty-state-title">목표가 없습니다</div>
      <div class="empty-state-desc">저축 목표를 설정하면 달성률과<br>예상 완료일을 자동으로 계산해드려요</div>
      <div class="empty-state-hint">+ 목표 추가 버튼을 탭하세요</div>
    </div>`;
    return;
  }

  const now = today();
  const nowYm = yyyymm(now);

  const totalSaved = goals.reduce((s, g) => s + (g.savedAmount || 0), 0);
  const totalTarget = goals.reduce((s, g) => s + (g.targetAmount || 0), 0);
  const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
  const completedCount = goals.filter(g => (g.savedAmount || 0) >= (g.targetAmount || 1)).length;

  const summaryHtml = `
    <div class="card" style="margin-bottom:12px;background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08));border-color:rgba(99,102,241,0.2)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div>
          <div style="font-size:11px;color:var(--text3);font-weight:700;letter-spacing:0.5px;margin-bottom:3px">전체 목표 달성률</div>
          <div style="font-family:var(--mono);font-size:26px;font-weight:900;color:var(--accent2)">${overallPct}%</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--text3);margin-bottom:3px">${goals.length}개 목표 중 ${completedCount}개 달성</div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${fmtShort(totalSaved)} / ${fmtShort(totalTarget)}</div>
        </div>
      </div>
      <div class="goal-progress-track" style="height:8px">
        <div class="goal-progress-fill" style="width:${overallPct}%;background:linear-gradient(90deg,var(--accent2),#8b5cf6)"></div>
      </div>
    </div>`;

  const goalCards = goals.map((g) => {
    const saved = g.savedAmount || 0;
    const target = g.targetAmount || 1;
    const pct = Math.min(100, Math.round((saved / target) * 100));
    const remaining = Math.max(0, target - saved);

    let monthsLeft = 0;
    let monthlyRequired = 0;
    let daysLeft = 0;
    let urgency = '';
    if (g.targetDate) {
      const ty = parseInt(g.targetDate.slice(0, 4), 10);
      const tm = parseInt(g.targetDate.slice(4), 10) - 1;
      monthsLeft = Math.max(0, (ty - now.getFullYear()) * 12 + (tm - now.getMonth()));
      monthlyRequired = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
      daysLeft = Math.max(0, Math.round((new Date(ty, tm + 1, 0) - now) / 86400000));
      if (monthsLeft <= 1 && pct < 100) urgency = 'urgent';
      else if (monthsLeft <= 3 && pct < 100) urgency = 'warning';
    }
    const barColor = pct >= 100 ? 'var(--green2)' : urgency === 'urgent' ? 'var(--red2)' : urgency === 'warning' ? 'var(--orange)' : pct >= 60 ? 'var(--accent2)' : '#60a5fa';
    if (pct >= 100 && !_celebratedGoals.has(g.id)) {
      _celebratedGoals.add(g.id);
      setTimeout(() => window.launchConfetti?.(), 400);
    }

    const monthlyIncome = state.entries
      .filter(e => e.type === 'income' && e.repeat === '매월')
      .reduce((s, e) => s + e.amount, 0);
    const canSaveMonthly = monthlyIncome > 0 && monthlyRequired > 0
      ? Math.min(100, Math.round((monthlyIncome * 0.3 / monthlyRequired) * 100)) : 0;

    return `
      <div class="goal-card ${urgency ? 'goal-card-' + urgency : ''}" data-goal-id="${g.id}" style="cursor:default">
        <div class="goal-card-top">
          <div class="goal-emoji">${escapeHtml(g.emoji || '🎯')}</div>
          <div class="goal-info">
            <div class="goal-name">${escapeHtml(g.name)}</div>
            ${g.targetDate ? `
              <div style="display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap">
                <div class="goal-date">${g.targetDate.slice(0, 4)}년 ${parseInt(g.targetDate.slice(4), 10)}월 목표</div>
                ${monthsLeft > 0 ? `<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:${urgency === 'urgent' ? 'rgba(239,68,68,0.15)' : urgency === 'warning' ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.07)'};color:${urgency === 'urgent' ? 'var(--red2)' : urgency === 'warning' ? 'var(--orange)' : 'var(--text3)'}">D-${daysLeft}</span>` : ''}
              </div>` : ''}
          </div>
          <div style="display:flex;gap:6px;margin-left:auto;align-items:flex-start">
            <button class="icon-btn edit goal-edit-btn" data-id="${g.id}" title="수정">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button class="icon-btn del goal-del-btn" data-id="${g.id}" title="삭제">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin:10px 0 6px">
          <div>
            <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:2px">저축 현황</div>
            <div style="display:flex;align-items:baseline;gap:4px">
              <span style="font-family:var(--mono);font-size:20px;font-weight:900;color:var(--accent2)">${fmtFull(saved)}</span>
              <span style="font-size:11px;color:var(--text3)">/ ${fmtShort(target)}</span>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:28px;font-weight:900;font-family:var(--mono);color:${barColor};line-height:1">${pct}%</div>
            ${pct < 100 ? `<div style="font-size:10px;color:var(--text3)">${fmtShort(remaining)} 남음</div>` : '<div style="font-size:10px;color:var(--green2)">달성 완료!</div>'}
          </div>
        </div>
        <div class="goal-progress-track" style="height:8px;margin-bottom:10px">
          <div class="goal-progress-fill" style="width:${pct}%;background:${pct >= 100 ? 'linear-gradient(90deg,var(--green2),#10b981)' : `linear-gradient(90deg,${barColor},${barColor}aa)`}"></div>
        </div>

        ${pct < 100 && monthsLeft > 0 ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div style="padding:8px 10px;border-radius:10px;background:var(--bg3);border:1px solid var(--border)">
            <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:3px">월 필요 저축액</div>
            <div style="font-family:var(--mono);font-size:14px;font-weight:900;color:${urgency === 'urgent' ? 'var(--red2)' : 'var(--text)'}">${fmtShort(monthlyRequired)}</div>
          </div>
          <div style="padding:8px 10px;border-radius:10px;background:var(--bg3);border:1px solid var(--border)">
            <div style="font-size:10px;color:var(--text3);font-weight:700;margin-bottom:3px">남은 기간</div>
            <div style="font-family:var(--mono);font-size:14px;font-weight:900;color:var(--text)">${monthsLeft}개월</div>
          </div>
        </div>
        ${urgency === 'urgent' ? `<div style="font-size:11px;color:var(--red2);padding:8px 10px;border-radius:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);margin-bottom:8px">⚠️ 목표 기간이 얼마 남지 않았습니다</div>` : ''}
        ` : pct >= 100 ? `
        <div style="font-size:13px;color:var(--green2);padding:10px;border-radius:10px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);margin-bottom:10px;text-align:center">
          🎉 목표를 달성했어요! 훌륭합니다!
        </div>
        ` : ''}

        <div class="goal-share-row" style="justify-content:space-between;align-items:center">
          <button class="goal-share-btn" data-share-id="${g.id}">🔗 ${g.sharedCode ? '코드 복사' : '공유 코드 생성'}</button>
          ${g.sharedCode ? `<span class="goal-invite-code-inline">${escapeHtml(g.sharedCode)}</span>` : ''}
          ${g.sharedFrom ? `<span style="font-size:10px;color:var(--text3)">📎 ${escapeHtml(g.sharedFrom)}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  container.innerHTML = summaryHtml + goalCards;
}

export function renderHouseLevel() {
  const el = document.getElementById('house-level-card');
  if (!el) return;

  const totalAssets = getTotalAssets(state.assets);
  const netWorth = totalAssets;
  const level = getHouseLevel(netWorth);

  const pct = level.next && level.next > 0
    ? Math.min(100, Math.round((netWorth / level.next) * 100))
    : 100;

  el.setAttribute('data-house-detail', '1');
  const miniLevels = HOUSE_LEVELS.map((l, i) => {
    const isActive = i === level.index;
    const isPast = i < level.index;
    return `<div title="${l.label}" style="flex:1;height:6px;border-radius:3px;background:${isPast ? l.color : isActive ? l.color : 'var(--bg3)'};opacity:${isActive ? 1 : isPast ? 0.6 : 0.3};transition:all 0.3s"></div>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <div style="font-size:42px;line-height:1;filter:drop-shadow(0 2px 8px ${level.color}66)">${level.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
          <div style="font-size:16px;font-weight:900;color:var(--text)">${level.label}</div>
          <div style="font-size:9px;padding:2px 6px;border-radius:6px;font-weight:800;background:${level.color}22;color:${level.color};border:1px solid ${level.color}44">${level.sublabel}</div>
        </div>
        <div style="font-size:11px;color:var(--text3)">순자산 ${fmtShort(netWorth)} · ${level.index + 1}/${HOUSE_LEVELS.length} 단계</div>
        ${level.next ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">다음: ${level.nextIcon} ${level.nextLabel} · ${fmtShort(level.next - netWorth)} 부족</div>` : '<div style="font-size:10px;color:#f59e0b;margin-top:2px;font-weight:700">🏆 최고 레벨 달성!</div>'}
      </div>
    </div>
    ${level.next ? `
    <div style="margin-top:10px">
      <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3);margin-bottom:4px">
        <span>현재 레벨 진행도</span><span style="color:${level.color};font-weight:700">${pct}%</span>
      </div>
      <div class="house-progress-track">
        <div class="house-progress-fill" style="width:${pct}%;background:${level.color}"></div>
      </div>
    </div>` : ''}
    <div style="display:flex;gap:3px;margin-top:10px;align-items:center">${miniLevels}</div>
    <div style="font-size:10px;color:var(--accent2);text-align:center;margin-top:8px;opacity:0.7;letter-spacing:0.3px">▼ 탭해서 전체 레벨 보기</div>
  `;
}

export function renderStreak() {
  const el = document.getElementById('streak-chip-home');
  if (!el) return;

  const { count, hasToday } = computeStreak(state.ledgerData);
  if (count === 0) {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'inline-flex';
  el.innerHTML = `🔥 ${count}일 연속 기록 중${hasToday ? ' ✓' : ''}`;
}
