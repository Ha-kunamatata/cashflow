// ════════════════════════════════════════════════════════
// game.js — 재정 배틀 RPG (모바일 방치형 픽셀 게임)
// ════════════════════════════════════════════════════════

// ── 수치 포맷 헬퍼 ───────────────────────────────────────
function fmtHp(n) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000)      return `${Math.round(n / 10000)}만`;
  if (n >= 1_000)       return `${(n / 1000).toFixed(0)}천`;
  return `${Math.round(n)}`;
}

// grid: array of equal-length strings; palette: char→color (null=skip)
function drawSprite(ctx, cx, cy, grid, palette, ps) {
  const rows = grid.length;
  const cols = grid[0].length;
  const ox = Math.round(cx - (cols * ps) / 2);
  const oy = Math.round(cy - (rows * ps) / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const color = palette[grid[r][c]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + c * ps, oy + r * ps, ps, ps);
    }
  }
}

// ── Monster type definitions ───────────────────────────
// 5 tiers: slime(<1만) goblin(<5만) orc(<10만) troll(<20만) dragon(20만+)
const MONSTER_TYPES = {
  slime: {
    label: '슬라임', baseColor: '#4ade80', hpColor: '#166534',
    atk: 3, ps: 3,
    grid: [
      '..111...',
      '.111111.',
      '11111111',
      '11141411',
      '.111111.',
      '..1221..',
    ],
    palette: { '1': '#4ade80', '2': '#166534', '4': '#ffffff', '.': null },
  },
  goblin: {
    label: '고블린', baseColor: '#a3e635', hpColor: '#365314',
    atk: 7, ps: 3,
    grid: [
      '.2...2..',
      '.111111.',
      '11111111',
      '11141411',
      '.211112.',
      '.111111.',
      '1.1111.1',
      '.1....1.',
    ],
    palette: { '1': '#a3e635', '2': '#365314', '4': '#fde68a', '.': null },
  },
  orc: {
    label: '오크', baseColor: '#fb923c', hpColor: '#9a3412',
    atk: 14, ps: 3,
    grid: [
      '2......2',
      '.211112.',
      '21311132',
      '21141412',
      '.211112.',
      '.122221.',
      '1.1111.1',
      '1..22..1',
      '.11..11.',
    ],
    palette: { '1': '#fb923c', '2': '#9a3412', '3': '#fed7aa', '4': '#ffffff', '.': null },
  },
  troll: {
    label: '트롤', baseColor: '#818cf8', hpColor: '#3730a3',
    atk: 22, ps: 3,
    grid: [
      '22222222',
      '22111122',
      '21313122',
      '21141412',
      '22111122',
      '21122112',
      '22111122',
      '2..22..2',
      '.11..11.',
    ],
    palette: { '1': '#818cf8', '2': '#3730a3', '3': '#c7d2fe', '4': '#ffffff', '.': null },
  },
  dragon: {
    label: '드래곤', baseColor: '#f87171', hpColor: '#991b1b',
    atk: 45, ps: 4, isBoss: true,
    grid: [
      '2........2',
      '.22.....22',
      '2231...132',
      '.2231.132.',
      '..231312..',
      '..222222..',
      '.21111122.',
      '.21141122.',
      '2.211112.2',
      '.2.2112.2.',
      '..22..22..',
    ],
    palette: { '1': '#f87171', '2': '#991b1b', '3': '#fca5a5', '4': '#ffffff', '.': null },
  },
};

function getMonsterType(amount) {
  if (amount <  10_000) return MONSTER_TYPES.slime;
  if (amount <  50_000) return MONSTER_TYPES.goblin;
  if (amount < 100_000) return MONSTER_TYPES.orc;
  if (amount < 200_000) return MONSTER_TYPES.troll;
  return MONSTER_TYPES.dragon;
}

// ── Hero level definitions (5 levels) ─────────────────
const HERO_LEVELS = {
  1: {
    label: '농부', color: '#94a3b8', ps: 4,
    grid: [
      '..333...',
      '.333333.',
      '.311113.',
      '.341413.',
      '.311113.',
      '..111...',
      '.111111.',
      '1.1111.1',
      '.1....1.',
      '.1....1.',
    ],
    palette: { '1': '#94a3b8', '2': '#475569', '3': '#fde68a', '4': '#1a1a2e', '.': null },
  },
  2: {
    label: '모험가', color: '#60a5fa', ps: 4,
    grid: [
      '..333...',
      '.333333.',
      '.311113.',
      '.341413.',
      '.311113.',
      '..111...',
      '.111111.',
      '2.1111.2',
      '.2....2.',
      '.2....2.',
    ],
    palette: { '1': '#60a5fa', '2': '#1e40af', '3': '#fde68a', '4': '#1a1a2e', '.': null },
  },
  3: {
    label: '전사', color: '#34d399', ps: 4,
    grid: [
      '.2333.2.',
      '.333333.',
      '2.31113.',
      '2.34143.',
      '2.31113.',
      '.2111.2.',
      '22111122',
      '2.1111.2',
      '2..22..2',
      '.22..22.',
    ],
    palette: { '1': '#34d399', '2': '#064e3b', '3': '#fde68a', '4': '#1a1a2e', '.': null },
  },
  4: {
    label: '기사', color: '#a78bfa', ps: 4,
    grid: [
      '22333322',
      '23333322',
      '23.313.3',
      '23.414.3',
      '23.313.3',
      '22111122',
      '2211112.',
      '2..1..22',
      '2.1111.2',
      '.22..22.',
    ],
    palette: { '1': '#a78bfa', '2': '#4c1d95', '3': '#c4b5fd', '4': '#1a1a2e', '.': null },
  },
  5: {
    label: '전설', color: '#fbbf24', ps: 4,
    grid: [
      '22333322',
      '23333332',
      '2.31113.',
      '2.34143.',
      '2.31113.',
      '22222222',
      '22111122',
      '2.1111.2',
      '2.1221.2',
      '.22..22.',
    ],
    palette: { '1': '#fbbf24', '2': '#78350f', '3': '#fef3c7', '4': '#1a1a2e', '.': null },
  },
};

function getHeroLevel(netWorth) {
  if (netWorth <  1_000_000) return 1;
  if (netWorth <  5_000_000) return 2;
  if (netWorth < 10_000_000) return 3;
  if (netWorth < 30_000_000) return 4;
  return 5;
}

// ════════════════════════════════════════════════════════
// FinanceGame — Main game class
// ════════════════════════════════════════════════════════
export class FinanceGame {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.state  = state;

    this.W = 0; this.H = 0;
    this.tick = 0;
    this.running = false;
    this.animFrame = null;

    this.hero = null;
    this.monsters = [];
    this.particles = [];
    this.stars = [];

    this.lastBattleTick = 0;
    this.BATTLE_INTERVAL = 180; // 3 s @ 60 fps

    this.salaryPerSec = 0;
    this.salaryAccum  = 0;
    this.paydayFlash  = 0;
    this.respawnTimer = null;

    // 클릭 정보 패널
    this._infoPanel = { visible: false, lines: [], x: 0, y: 0, tick: 0, color: '#60a5fa' };
    this._clickHandler = null;
    this._touchHandler = null;
  }

  // ── Public API ────────────────────────────────────────
  init() {
    this._resize();
    this._buildStars();
    this._buildHero();
    this._buildMonsters();
    this._calcSalary();
    // 캔버스 클릭/터치 이벤트
    this._clickHandler = (e) => this._handleClick(e);
    this._touchHandler = (e) => { e.preventDefault(); if (e.changedTouches[0]) this._handleClick(e.changedTouches[0]); };
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchend', this._touchHandler, { passive: false });
    this.canvas.style.cursor = 'pointer';
    if (!this.running) { this.running = true; this._loop(); }
  }

  destroy() {
    this.running = false;
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    if (this.respawnTimer) clearTimeout(this.respawnTimer);
    if (this._clickHandler) this.canvas.removeEventListener('click', this._clickHandler);
    if (this._touchHandler) this.canvas.removeEventListener('touchend', this._touchHandler);
    this.animFrame = null;
  }

  resize() {
    this._resize();
    if (this.hero) {
      this.hero.x = Math.round(this.W * 0.17);
      this.hero.y = Math.round(this.H * 0.60);
    }
    this._repositionMonsters();
  }

  updateState(newState) {
    this.state = newState;
    this._buildHero();
    this._buildMonsters();
    this._calcSalary();
  }

  // ── Setup helpers ─────────────────────────────────────
  _resize() {
    const wrap = this.canvas.parentElement;
    this.W = wrap.offsetWidth || (window.innerWidth - 32) || 360;
    this.H = wrap.offsetHeight || 360;
    this.canvas.width  = this.W;
    this.canvas.height = this.H;
  }

  _calcSalary() {
    const monthly = (this.state.entries || [])
      .filter(e => e.type === 'income' && e.repeat === '매월')
      .reduce((s, e) => s + (e.amount || 0), 0);
    // 초당 원 단위 수입 trickle (파티클 표시용)
    this.salaryPerSec = monthly / (30 * 24 * 3600);
    this.salaryAccum = 0;
  }

  _buildHero() {
    const totalAssets = (this.state.assets || []).reduce((s, a) => s + (a.amount || 0), 0);
    const lvl = getHeroLevel(totalAssets);

    // 월수입 = 영웅 최대 HP
    const monthly = (this.state.entries || [])
      .filter(e => e.type === 'income' && e.repeat === '매월')
      .reduce((s, e) => s + (e.amount || 0), 0);
    const maxHp = Math.max(100_000, monthly); // 최소 10만원

    // 잔고 = 현재 HP (월수입 대비 비율로 표시)
    const balance = this.state.balance || 0;
    const hp = Math.max(0, Math.min(maxHp, balance));

    // 공격력 = 월수입 / 30 / 적 수 (일당 소득 배분)
    const numExp = Math.max(1, (this.state.entries || []).filter(e => e.type === 'expense' && e.repeat === '매월').length);
    const atk = Math.max(1_000, Math.round(monthly / 30 / numExp * 2));

    this.hero = {
      x: Math.round(this.W * 0.17),
      y: Math.round(this.H * 0.60),
      level: lvl,
      def: HERO_LEVELS[lvl],
      atk,
      hp,
      maxHp,
      monthlyIncome: monthly,
      attackTick: 0,
      attackTarget: null,
    };
  }

  _buildMonsters() {
    const expenses = (this.state.entries || [])
      .filter(e => e.type === 'expense' && e.repeat === '매월');
    const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    const count = expenses.length;
    const cols  = Math.min(count, 3);
    const rows  = count > 0 ? Math.ceil(count / 3) : 0;

    const areaX  = this.W * 0.48;
    const areaW  = this.W * 0.50;
    const areaY  = this.H * 0.06;
    const groundY = this.H * 0.72;
    const areaH  = groundY - areaY - 10;

    const cellW = cols > 0 ? areaW / cols : areaW;
    const cellH = rows > 0 ? areaH / rows : areaH;

    this.monsters = expenses.map((e, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const mtype = getMonsterType(e.amount || 0);
      // 몬스터 HP = 월 지출액 (실제 원 단위)
      const maxHp = Math.max(1_000, e.amount || 0);
      // 몬스터 공격력 = 지출액 / 30 (일 단위 부담)
      const monAtk = Math.max(100, Math.round((e.amount || 0) / 30));

      return {
        id: e.id || `m${i}`,
        name: e.name || '지출',
        amount: e.amount || 0,
        category: e.category || '',
        x: Math.round(areaX + col * cellW + cellW / 2),
        y: Math.round(areaY + row * cellH + cellH * 0.65),
        mtype,
        hp: maxHp,
        maxHp,
        monAtk,
        wobble: Math.random() * Math.PI * 2,
        dead: false,
        deathTick: 0,
        flashTick: 0,
      };
    });
  }

  _repositionMonsters() {
    const count = this.monsters.length;
    if (count === 0) return;
    const cols = Math.min(count, 3);
    const rows = Math.ceil(count / 3);
    const areaX  = this.W * 0.48;
    const areaW  = this.W * 0.50;
    const areaY  = this.H * 0.06;
    const groundY = this.H * 0.72;
    const areaH  = groundY - areaY - 10;
    const cellW = areaW / cols;
    const cellH = areaH / rows;
    this.monsters.forEach((m, i) => {
      m.x = Math.round(areaX + (i % 3) * cellW + cellW / 2);
      m.y = Math.round(areaY + Math.floor(i / 3) * cellH + cellH * 0.65);
    });
  }

  _buildStars() {
    this.stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H * 0.68,
      size: Math.random() < 0.75 ? 1 : 2,
      speed: 0.06 + Math.random() * 0.22,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  // ── Main loop ─────────────────────────────────────────
  _loop() {
    if (!this.running) return;
    this.animFrame = requestAnimationFrame(() => this._loop());
    this.tick++;

    this._drawBackground();
    this._drawGround();
    this._drawMonsters();
    this._drawHero();
    this._drawParticles();
    this._drawHUD();
    this._drawInfoPanel();

    // Auto-battle every BATTLE_INTERVAL ticks
    if (this.tick - this.lastBattleTick >= this.BATTLE_INTERVAL) {
      this._autoBattle();
      this.lastBattleTick = this.tick;
    }

    // 월급 파티클 (시각적 효과만 — 실제 회복은 battle tick에서 처리)
    if (this.salaryPerSec > 0 && this.hero) {
      this.salaryAccum += this.salaryPerSec / 60;
      if (this.salaryAccum >= 1000) {
        const n = Math.floor(this.salaryAccum);
        this.salaryAccum -= n;
        if (Math.random() < 0.15) {
          this._spawnParticle(
            this.hero.x + (Math.random() - 0.5) * 28,
            this.hero.y - 52,
            `+${fmtHp(n)}`, '#4ade80', -0.9, 70, 10
          );
        }
      }
    }

    if (this.paydayFlash > 0) this.paydayFlash--;
  }

  // ── Draw: Background ──────────────────────────────────
  _drawBackground() {
    const { ctx, W, H } = this;

    // Sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.76);
    g.addColorStop(0,   '#060918');
    g.addColorStop(0.5, '#0b1428');
    g.addColorStop(1,   '#0d1c38');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.76);

    // Parallax stars
    this.stars.forEach(s => {
      s.x -= s.speed;
      if (s.x < 0) { s.x = W + 2; s.y = Math.random() * H * 0.64; }
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(this.tick * 0.012 + s.phase));
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#c7d7ef';
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
    });
    ctx.globalAlpha = 1;

    // Moon
    const mx = Math.round(W * 0.86), my = Math.round(H * 0.10);
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath(); ctx.arc(mx, my, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath(); ctx.arc(mx, my, 13, 0, Math.PI * 2); ctx.fill();
    // Crescent shadow
    ctx.fillStyle = '#0b1428';
    ctx.beginPath(); ctx.arc(mx + 7, my - 1, 12, 0, Math.PI * 2); ctx.fill();

    // Distant mountains (simple silhouette)
    ctx.fillStyle = 'rgba(12,28,58,0.8)';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.62);
    ctx.lineTo(W * 0.10, H * 0.48);
    ctx.lineTo(W * 0.22, H * 0.55);
    ctx.lineTo(W * 0.35, H * 0.43);
    ctx.lineTo(W * 0.48, H * 0.52);
    ctx.lineTo(W * 0.60, H * 0.46);
    ctx.lineTo(W * 0.75, H * 0.56);
    ctx.lineTo(W * 0.88, H * 0.44);
    ctx.lineTo(W, H * 0.52);
    ctx.lineTo(W, H * 0.76);
    ctx.lineTo(0, H * 0.76);
    ctx.closePath();
    ctx.fill();

    // Payday flash
    if (this.paydayFlash > 0) {
      ctx.fillStyle = `rgba(251,191,36,${(this.paydayFlash / 120) * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ── Draw: Ground ──────────────────────────────────────
  _drawGround() {
    const { ctx, W, H } = this;
    const gy = Math.round(H * 0.75);

    const g = ctx.createLinearGradient(0, gy, 0, H);
    g.addColorStop(0, '#172244');
    g.addColorStop(1, '#090e1c');
    ctx.fillStyle = g;
    ctx.fillRect(0, gy, W, H - gy);

    // Ground edge glow
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, gy, W, 2);
    ctx.fillStyle = 'rgba(30,58,138,0.3)';
    ctx.fillRect(0, gy + 2, W, 3);

    // Battle grid lines
    ctx.strokeStyle = 'rgba(37,99,235,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, H); ctx.stroke();
    }
  }

  // ── Draw: Hero ────────────────────────────────────────
  _drawHero() {
    const { ctx } = this;
    const h = this.hero;
    if (!h) return;

    const bobY = Math.round(Math.sin(this.tick * 0.07) * 2);
    const drawY = h.y + bobY;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(h.x, h.y + 23, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sprite
    drawSprite(ctx, h.x, drawY, h.def.grid, h.def.palette, h.def.ps);

    // Attack line to target
    if (h.attackTick > 0) {
      h.attackTick--;
      const t = h.attackTarget;
      if (t && !t.dead) {
        const alpha = h.attackTick / 15;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(h.x + 10, drawY - 4);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Slash cross at target
        const sx = t.x, sy = t.y;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx - 8, sy - 8); ctx.lineTo(sx + 8, sy + 8); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx + 8, sy - 8); ctx.lineTo(sx - 8, sy + 8); ctx.stroke();

        ctx.globalAlpha = 1;
      }
    }

    // HP bar
    const bw = 54, bh = 7;
    const bx = h.x - bw / 2, by = h.y - 58;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    const hpPct = h.hp / h.maxHp;
    ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(bx, by, Math.round(bw * hpPct), bh);

    ctx.font = '700 7px "DM Mono", monospace';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.fillText(`잔고 ${fmtHp(h.hp)} / 월수입 ${fmtHp(h.maxHp)}`, h.x, by - 3);

    // Level badge
    const badgeW = 34, badgeH = 13;
    ctx.fillStyle = h.def.color;
    ctx.fillRect(h.x - badgeW / 2, h.y + 26, badgeW, badgeH);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 7px monospace';
    ctx.fillText(`LV.${h.level}`, h.x, h.y + 35);
    ctx.textAlign = 'left';
  }

  // ── Draw: Monsters ────────────────────────────────────
  _drawMonsters() {
    const { ctx } = this;

    this.monsters.forEach(m => {
      const ps  = m.mtype.ps;
      const sprH = m.mtype.grid.length * ps;
      const sprW = m.mtype.grid[0].length * ps;

      if (m.dead) {
        m.deathTick++;
        if (m.deathTick < 48) {
          ctx.globalAlpha = 1 - m.deathTick / 48;
          const sc = Math.max(0.5, 1 - m.deathTick / 80);
          drawSprite(ctx, m.x, m.y - m.deathTick * 0.5, m.mtype.grid, m.mtype.palette, ps * sc);
          ctx.globalAlpha = 1;
        }
        return;
      }

      m.wobble += 0.036;
      const wx = Math.sin(m.wobble) * 3;
      const wy = Math.cos(m.wobble * 0.75) * 2;
      const dx = m.x + wx, dy = m.y + wy;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      ctx.beginPath();
      ctx.ellipse(dx, m.y + sprH / 2 + 3, sprW * 0.42, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Hit flash overlay
      if (m.flashTick > 0) {
        m.flashTick--;
        const whitePal = {};
        for (const k of Object.keys(m.mtype.palette)) {
          whitePal[k] = m.mtype.palette[k] ? '#ffffff' : null;
        }
        ctx.globalAlpha = 0.55;
        drawSprite(ctx, dx, dy, m.mtype.grid, whitePal, ps);
        ctx.globalAlpha = 1;
      }

      // Main sprite
      drawSprite(ctx, dx, dy, m.mtype.grid, m.mtype.palette, ps);

      // Boss indicator
      if (m.mtype.isBoss) {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('★ BOSS ★', dx, dy - sprH / 2 - 18);
      }

      // HP bar (HP = 지출액)
      const bw = Math.max(36, sprW + 6);
      const bh = 5;
      const bx = dx - bw / 2;
      const by = dy - sprH / 2 - (m.mtype.isBoss ? 28 : 14);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(bx, by, bw, bh);
      const hpPct = m.hp / m.maxHp;
      ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#eab308' : '#ef4444';
      ctx.fillRect(bx, by, Math.round(bw * hpPct), bh);

      // Name & HP(원)
      const nameStr = m.name.length > 5 ? m.name.slice(0, 4) + '…' : m.name;
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(nameStr, dx, by - 3);
      ctx.font = '600 7px monospace';
      ctx.fillStyle = m.mtype.baseColor;
      ctx.fillText(`HP ${fmtHp(m.hp)}/${fmtHp(m.maxHp)}`, dx, by - 12);
      ctx.textAlign = 'left';
    });
  }

  // ── Draw: Particles ───────────────────────────────────
  _drawParticles() {
    const { ctx } = this;
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x += (p.vx || 0);
      p.y += p.vy;
      p.life--;
      ctx.globalAlpha = Math.min(1, p.life / 18);
      ctx.font = `bold ${p.size || 11}px monospace`;
      ctx.fillStyle = p.color;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, Math.round(p.x), Math.round(p.y));
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // ── Draw: HUD ─────────────────────────────────────────
  _drawHUD() {
    const { ctx, W, H } = this;
    if (!this.hero) return;

    const hudH = 48;
    const hudY = H - hudH;
    const alive = this.monsters.filter(m => !m.dead);

    // Panel
    ctx.fillStyle = 'rgba(4,7,20,0.94)';
    ctx.fillRect(0, hudY, W, hudH);
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, hudY, W, 1);

    // Dividers
    ctx.fillStyle = 'rgba(30,58,138,0.35)';
    ctx.fillRect(Math.round(W / 3), hudY + 7, 1, hudH - 14);
    ctx.fillRect(Math.round(W * 2 / 3), hudY + 7, 1, hudH - 14);

    // Balance
    const bal = this.state.balance || 0;
    const balStr = bal >= 100_000_000 ? `${(bal / 100_000_000).toFixed(1)}억`
                 : bal >= 10_000      ? `${Math.round(bal / 10000)}만원`
                 : `${bal.toLocaleString()}원`;
    ctx.font = '700 8px monospace';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'left';
    ctx.fillText('💰잔고', 10, hudY + 16);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = bal >= 0 ? '#4ade80' : '#f87171';
    ctx.fillText(balStr, 10, hudY + 35);

    // Monster count
    ctx.font = '700 8px monospace';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.fillText('⚔️몬스터', W / 2, hudY + 16);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = alive.length === 0 ? '#4ade80' : '#f87171';
    ctx.fillText(`${alive.length} / ${this.monsters.length}`, W / 2, hudY + 35);

    // Hero info
    ctx.font = '700 8px monospace';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'right';
    ctx.fillText('🛡영웅', W - 10, hudY + 16);
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = this.hero.def.color;
    ctx.fillText(`LV${this.hero.level} ${this.hero.def.label}`, W - 10, hudY + 35);
    ctx.textAlign = 'left';

    // Empty state overlay
    if (this.monsters.length === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.52)';
      ctx.fillRect(0, 0, W, H * 0.76);
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('항목탭에서 고정 지출을', W / 2, H * 0.37);
      ctx.fillText('추가하면 몬스터 등장!', W / 2, H * 0.37 + 24);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#334155';
      ctx.fillText('(뷰탭 → 항목탭 → +추가)', W / 2, H * 0.37 + 46);
      ctx.textAlign = 'left';
    }
  }

  // ── Battle logic ──────────────────────────────────────
  _autoBattle() {
    const alive = this.monsters.filter(m => !m.dead);
    if (!this.hero || alive.length === 0) return;

    // 영웅 공격: 랜덤 대상 1개 (±25% 편차)
    const target = alive[Math.floor(Math.random() * alive.length)];
    const dmg = Math.round(this.hero.atk * (0.75 + Math.random() * 0.5));
    target.hp = Math.max(0, target.hp - dmg);
    target.flashTick = 8;
    this.hero.attackTick = 15;
    this.hero.attackTarget = target;

    this._spawnParticle(
      target.x + (Math.random() - 0.5) * 18,
      target.y - 16,
      `-${fmtHp(dmg)}`, '#fbbf24', -1.6, 65, 11
    );

    if (target.hp <= 0) {
      target.dead = true;
      for (let i = 0; i < 4; i++) {
        this._spawnParticle(
          target.x + (Math.random() - 0.5) * 28,
          target.y - 8,
          '💰', '#fbbf24',
          -(0.7 + Math.random() * 1.3), 72, 14,
          (Math.random() - 0.5) * 1.5
        );
      }
      this._spawnParticle(target.x, target.y - 22, '격파!', '#f59e0b', -2.0, 90, 13);

      if (this.monsters.filter(m => !m.dead).length === 0) {
        this.paydayFlash = 120;
        this._spawnParticle(this.W / 2, this.H * 0.34, '🎉 재정 자유!', '#f59e0b', -0.8, 200, 15);
        this.respawnTimer = setTimeout(() => {
          this._buildMonsters();
          if (this.hero) this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + Math.round(this.hero.maxHp * 0.3));
        }, 4000);
      }
    }

    // 몬스터 반격: 공격력 = 지출액/30 (일 단위 부담)
    alive.forEach(m => {
      if (m.dead) return;
      const monDmg = Math.max(100, Math.round(m.monAtk * 0.4 * (m.hp / m.maxHp + 0.3)));
      this.hero.hp = Math.max(0, this.hero.hp - monDmg);
      if (Math.random() < 0.55) {
        this._spawnParticle(
          this.hero.x + (Math.random() - 0.5) * 18,
          this.hero.y - 20,
          `-${fmtHp(monDmg)}`, '#ef4444', -1.1, 50, 10
        );
      }
    });

    // 수동 회복: 월수입/30 / 8 per battle (하루 소득 8분할)
    const regen = Math.max(1000, Math.round(this.hero.maxHp / 30 / 8));
    this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + regen);
  }

  // ── 캔버스 클릭/터치 ──────────────────────────────────
  _handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.W / rect.width;
    const sy = this.H / rect.height;
    const cx = (e.clientX - rect.left) * sx;
    const cy = (e.clientY - rect.top) * sy;

    // 영웅 히트체크 (반경 32)
    const h = this.hero;
    if (h && Math.hypot(cx - h.x, cy - h.y) < 38) {
      const hpPct = h.maxHp > 0 ? Math.round(h.hp / h.maxHp * 100) : 0;
      this._showInfo(
        [`LV.${h.level} ${h.def.label}`, `월수입: ${fmtHp(h.monthlyIncome)}원`, `잔고: ${fmtHp(h.hp)}원 (${hpPct}%)`, `공격력: ${fmtHp(h.atk)}원`],
        h.x, h.y - 68, '#4ade80'
      );
      return;
    }

    // 몬스터 히트체크
    for (const m of this.monsters) {
      if (m.dead) continue;
      const ps = m.mtype.ps;
      const sprW = m.mtype.grid[0].length * ps;
      const sprH = m.mtype.grid.length * ps;
      if (cx >= m.x - sprW / 2 - 10 && cx <= m.x + sprW / 2 + 10 &&
          cy >= m.y - sprH / 2 - 10 && cy <= m.y + sprH / 2 + 10) {
        const hpPct = Math.round(m.hp / m.maxHp * 100);
        this._showInfo(
          [`${m.mtype.label} — ${m.name}`, `월 지출: ${fmtHp(m.amount)}원`, `HP: ${fmtHp(m.hp)}/${fmtHp(m.maxHp)} (${hpPct}%)`, `일 공격력: ${fmtHp(m.monAtk)}원`],
          m.x, m.y - sprH / 2 - 32, m.mtype.baseColor
        );
        return;
      }
    }
  }

  _showInfo(lines, x, y, color = '#60a5fa') {
    this._infoPanel = {
      visible: true,
      lines,
      x: Math.max(90, Math.min(this.W - 90, x)),
      y: Math.max(40, y),
      tick: 200,
      color,
    };
  }

  _drawInfoPanel() {
    const p = this._infoPanel;
    if (!p.visible || p.tick <= 0) { this._infoPanel.visible = false; return; }
    p.tick--;

    const { ctx } = this;
    const alpha = Math.min(1, p.tick / 25);
    ctx.globalAlpha = alpha;

    const lh = 13;
    const pad = 10;
    const bw = 170;
    const bh = p.lines.length * lh + pad * 2;
    const bx = p.x - bw / 2;
    const by = p.y - bh;

    // 배경
    ctx.fillStyle = 'rgba(4,7,20,0.95)';
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(bx + r, by); ctx.lineTo(bx + bw - r, by);
    ctx.arcTo(bx + bw, by, bx + bw, by + r, r);
    ctx.lineTo(bx + bw, by + bh - r);
    ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r);
    ctx.lineTo(bx + r, by + bh);
    ctx.arcTo(bx, by + bh, bx, by + bh - r, r);
    ctx.lineTo(bx, by + r);
    ctx.arcTo(bx, by, bx + r, by, r);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = p.color + '88';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    p.lines.forEach((line, i) => {
      ctx.font = i === 0 ? 'bold 9px monospace' : '8px monospace';
      ctx.fillStyle = i === 0 ? p.color : '#cbd5e1';
      ctx.fillText(line, p.x, by + pad + (i + 1) * lh - 1);
    });
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  _spawnParticle(x, y, text, color, vy = -1.5, life = 60, size = 11, vx = 0) {
    this.particles.push({ x, y, text, color, vy, vx, life, size });
  }
}
