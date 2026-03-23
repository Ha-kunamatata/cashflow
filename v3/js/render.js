// ════════════════════════════════════════════════════════
// render.js — 화면 렌더링
// ════════════════════════════════════════════════════════
import { DAYS_KR, CAT_COLORS } from ‘./config.js’;
import { today, addDays, dateKey, yyyymm, p2, fmtFull, fmtShort, fmtSigned, animateNumber } from ‘./utils.js’;
import { state } from ‘./state.js’;
import { buildForecast } from ‘./forecast.js’;

let _chartPeriod    = 30;
let _forecastFilter = ‘all’;
let _entryFilter    = ‘전체’;
export let currentLedgerYear  = today().getFullYear();
export let currentLedgerMonth = today().getMonth();
let _selectedLedgerDate = null;

export function setSelectedLedgerDate(dk) { _selectedLedgerDate = dk; }

// ════════════════════════════════════════════════════════
// 전체 렌더
// ════════════════════════════════════════════════════════
export function renderAll() {
renderHome(); renderEntries();
const ap = document.querySelector(’.page.active’);
if (ap?.id===‘page-forecast’) renderForecast();
if (ap?.id===‘page-cards’)    renderCards();
if (ap?.id===‘page-ledger’)   renderLedger();
}

// ════════════════════════════════════════════════════════
// 홈
// ════════════════════════════════════════════════════════
export function renderHome() {
const balEl = document.getElementById(‘balance-display’);
if (!balEl) return;
animateNumber(balEl, state.balance, v => fmtFull(v));
balEl.className = ‘balance-amount’+(state.balance<state.dangerLine?’ danger’:’’);
const tb = document.getElementById(‘topbar-balance’);
animateNumber(tb, state.balance, v => fmtShort(v));
if(tb) tb.className=‘topbar-balance-amount’+(state.balance<state.dangerLine?’ danger’:’’);

const todayYm = yyyymm(today());
const mi = state.entries.filter(e=>e.type===‘income’&&e.repeat===‘매월’).reduce((s,e)=>s+e.amount,0);
const me = state.entries.filter(e=>e.type===‘expense’&&e.repeat===‘매월’).reduce((s,e)=>s+e.amount,0);
const mh = state.entries.filter(e=>e.type===‘expense’&&e.category===‘할부’&&e.repeat===‘매월’&&(!e.endMonth||parseInt(e.endMonth)>=todayYm)).reduce((s,e)=>s+e.amount,0);

const si=document.getElementById(‘sum-income’); if(si) si.textContent=fmtFull(mi);
const se=document.getElementById(‘sum-expense’); if(se) se.textContent=fmtFull(me);
const sh=document.getElementById(‘sum-halbu’); if(sh) sh.textContent=fmtFull(mh);

const monthPrefix=`${today().getFullYear()}-${p2(today().getMonth()+1)}`;
const checkTotal=Object.entries(state.checkData||{}).filter(([d])=>d.startsWith(monthPrefix)).reduce((s,[,v])=>s+v,0);
const sc=document.getElementById(‘sum-checkcard’); if(sc) sc.textContent=fmtFull(checkTotal);

const net=mi-me;
const netEl=document.getElementById(‘sum-net’);
if(netEl){ netEl.textContent=fmtSigned(net); netEl.className=’summary-item-value ’+(net>=0?‘green’:‘red’); }

const insightEl=document.getElementById(‘balance-insight’);
if(insightEl) insightEl.textContent=state.balance<state.dangerLine?‘주의가 필요해요. 잔고가 위험 기준선 아래입니다.’:net>0?‘좋아요. 월 순현금이 플러스 흐름을 유지하고 있어요.’:‘고정 지출 비중이 높아요. 지출 구조를 점검해보세요.’;

const fc=buildForecast(365);
const firstDanger=fc.find(f=>f.balance<state.dangerLine);
const wEl=document.getElementById(‘balance-warning’);
if(wEl){ wEl.style.display=firstDanger?‘flex’:‘none’; const wt=document.getElementById(‘balance-warning-text’); if(wt&&firstDanger) wt.textContent=`${firstDanger.date.getMonth()+1}/${firstDanger.date.getDate()} 이후 잔고 위험 예상`; }

const dangerDays=fc.filter(f=>f.balance<state.dangerLine&&(f.income>0||f.expense>0));
const alertEl=document.getElementById(‘alert-banner’);
if(alertEl){ if(dangerDays.length>0){ alertEl.style.display=‘block’; const list=dangerDays.slice(0,3).map(d=>`${d.date.getMonth()+1}/${d.date.getDate()}(${fmtShort(d.balance)})`).join(’, ’); alertEl.innerHTML=`🚨 앞으로 365일 중 <strong>${dangerDays.length}번</strong> 잔고 부족 예상 — ${list}${dangerDays.length>3?` 외 ${dangerDays.length-3}건`:''}`; } else alertEl.style.display=‘none’; }

const upcoming=fc.slice(0,30).filter(f=>f.income>0||f.expense>0);
const ul=document.getElementById(‘upcoming-list’);
if(!ul) return;
if(!upcoming.length){ ul.innerHTML=’<div class="empty-state">앞 30일 이벤트 없음</div>’; return; }
ul.innerHTML=upcoming.map(f=>{
const isDanger=f.balance<state.dangerLine; const dow=f.date.getDay();
const dayColor=dow===0?‘color:var(–red2)’:dow===6?‘color:var(–accent2)’:‘color:var(–text3)’;
return `<div class="event-row"><div class="event-left"><span class="event-date">${f.date.getMonth()+1}/${p2(f.date.getDate())}</span><span class="event-day" style="${dayColor}">${DAYS_KR[dow]}</span><div class="event-tags">${f.events.slice(0,2).map(ev=>`<span class="event-tag">${ev.name}</span>`).join('')}${f.events.length>2?`<span class="event-tag">+${f.events.length-2}</span>`:''}</div></div><div class="event-right">${f.income>0?`<div class="event-delta money-strong" style="color:var(--green2)">${fmtSigned(f.income)}</div>`:''}${f.expense>0?`<div class="event-delta money-strong" style="color:var(--red2)">${fmtSigned(-f.expense)}</div>`:''}<div class="event-bal" style="color:${isDanger?'var(--orange)':'var(--text3)'}">→ ${fmtShort(f.balance)}</div></div></div>`;
}).join(’’);
}

// ════════════════════════════════════════════════════════
// 예측
// ════════════════════════════════════════════════════════
export function setChartPeriod(days, btn) { _chartPeriod=days; document.querySelectorAll(’.period-btn’).forEach(b=>b.classList.remove(‘active’)); btn.classList.add(‘active’); renderForecast(); }
export function setForecastFilter(f, btn) { _forecastFilter=f; document.querySelectorAll(’#page-forecast .filter-tab’).forEach(b=>b.classList.remove(‘active’)); btn.classList.add(‘active’); renderForecastTable(); }
export function renderForecast() { renderForecastChart(); renderMonthlyChart(); renderForecastTable(); }

export function renderForecastChart() {
const fc=buildForecast(_chartPeriod);
const vals=fc.map(f=>f.balance); const min=Math.min(…vals,0); const max=Math.max(…vals,state.dangerLine); const range=max-min||1;
const W=560,H=120,PAD=10; const bw=W/fc.length;
const py=v=>PAD+(H-PAD*2)-((v-min)/range)*(H-PAD*2);
const pts=fc.map((f,i)=>`${(i*bw+bw/2).toFixed(1)},${py(f.balance).toFixed(1)}`).join(’ ‘);
let dots=’’; fc.forEach((f,i)=>{ if(!f.income&&!f.expense) return; const fill=f.balance<state.dangerLine?’#ef4444’:f.income>0?’#10b981’:’#f87171’; dots+=`<circle cx="${(i*bw+bw/2).toFixed(1)}" cy="${py(f.balance).toFixed(1)}" r="2.5" fill="${fill}" opacity="0.82"/>`; });
let labels=’’; const step=_chartPeriod<=30?7:*chartPeriod<=90?14:30;
fc.filter((*,i)=>i%step===0).forEach((f,idx)=>{ labels+=`<text x="${(idx*step*bw+bw/2).toFixed(1)}" y="${H+2}" fill="#475569" font-size="9" font-family="monospace" text-anchor="middle">${f.date.getMonth()+1}/${f.date.getDate()}</text>`; });
const zeroY=py(0); const dangerY=py(state.dangerLine);
const el=document.getElementById(‘forecast-chart’); if(!el) return;
el.innerHTML=`<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0.03"/></linearGradient></defs>${state.dangerLine>min?`<rect x="0" y="${dangerY.toFixed(1)}" width="${W}" height="${(zeroY-dangerY).toFixed(1)}" fill="rgba(249,115,22,0.06)"/>`:''}<line x1="0" y1="${zeroY.toFixed(1)}" x2="${W}" y2="${zeroY.toFixed(1)}" stroke="#334155" stroke-width="1" stroke-dasharray="4 4"/>${state.dangerLine>0?`<line x1="0" y1="${dangerY.toFixed(1)}" x2="${W}" y2="${dangerY.toFixed(1)}" stroke="#f97316" stroke-width="1.5" stroke-dasharray="4 3"/><text x="4" y="${(dangerY-4).toFixed(1)}" fill="#f97316" font-size="8" font-family="monospace">${fmtShort(state.dangerLine)}</text>`:''}<polygon points="0,${H} ${pts} ${W},${H}" fill="url(#ag)"/><polyline points="${pts}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}`;
}

export function renderMonthlyChart() {
const now=today(); const months=[];
for(let i=-2;i<=3;i++){ const d=new Date(now.getFullYear(),now.getMonth()+i,1); const ym=yyyymm(d); const ymStr=String(ym); const fi=state.entries.filter(e=>e.type===‘income’&&e.repeat===‘매월’&&(!e.endMonth||parseInt(e.endMonth)>=ym)).reduce((s,e)=>s+e.amount,0); const fe=state.entries.filter(e=>e.type===‘expense’&&e.repeat===‘매월’&&(!e.endMonth||parseInt(e.endMonth)>=ym)).reduce((s,e)=>s+e.amount,0); const cd=state.cardData[ymStr]||{}; months.push({label:`${d.getMonth()+1}월`,income:fi,expense:fe+(cd.hyundai||0)+(cd.kookmin||0)}); }
const maxVal=Math.max(…months.map(m=>Math.max(m.income,m.expense)),1);
const el=document.getElementById(‘monthly-chart’); if(!el) return;
el.innerHTML=`<div class="monthly-chart-bar">${months.map(m=>`<div><div style="font-size:9px;color:var(--text3);margin-bottom:4px;font-weight:600">${m.label}</div><div class="bar-row"><span class="bar-label" style="color:var(--green2)">수입</span><div class="bar-track"><div class="bar-fill income" style="width:${(m.income/maxVal*100).toFixed(1)}%"></div></div><span class="bar-value" style="color:var(--green2)">${fmtShort(m.income)}</span></div><div class="bar-row"><span class="bar-label" style="color:var(--red2)">지출</span><div class="bar-track"><div class="bar-fill expense" style="width:${(m.expense/maxVal*100).toFixed(1)}%"></div></div><span class="bar-value" style="color:var(--red2)">${fmtShort(m.expense)}</span></div></div>`).join('<div style="height:8px"></div>')}</div>`;
}

export function renderForecastTable() {
const fc=buildForecast(365); let html=’’,lastMonth=-1;
for(const f of fc){ if(_forecastFilter===‘event’&&f.income===0&&f.expense===0) continue; if(_forecastFilter===‘danger’&&f.balance>=state.dangerLine) continue; const m=f.date.getMonth()+1; if(m!==lastMonth){ html+=`<tr class="month-header"><td colspan="6">${f.date.getFullYear()}년 ${m}월</td></tr>`; lastMonth=m; } const isDanger=f.balance<state.dangerLine; const dow=f.date.getDay(); const dayClass=‘col-day’+(dow===0?’ sun’:dow===6?’ sat’:’’); const isToday=dateKey(f.date)===dateKey(today()); html+=`<tr class="${isDanger?'danger':f.income>0?'income-row':''}"><td class="col-date" style="${isToday?'font-weight:700;color:var(--accent2)':''}">${m}/${p2(f.date.getDate())}</td><td class="${dayClass}">${DAYS_KR[dow]}</td><td class="col-in">${f.income>0?fmtShort(f.income):'-'}</td><td class="col-out">${f.expense>0?fmtShort(f.expense):'-'}</td><td class="col-bal${isDanger?' danger':''}">${fmtShort(f.balance)}</td><td class="col-status">${isDanger?'⚠️':f.income&&f.expense?'💰💳':f.income?'💰':f.expense?'💳':'-'}</td></tr>`; }
const el=document.getElementById(‘forecast-tbody’); if(el) el.innerHTML=html;
}

// ════════════════════════════════════════════════════════
// 수입/지출 목록
// ════════════════════════════════════════════════════════
export function setEntryFilter(f, btn) { _entryFilter=f; document.querySelectorAll(’#page-entries .filter-tab’).forEach(b=>b.classList.remove(‘active’)); btn.classList.add(‘active’); renderEntries(); }

export function renderEntries() {
const container=document.getElementById(‘entries-list’); if(!container) return;
let entries=[…state.entries];
if(_entryFilter===‘수입’) entries=entries.filter(e=>e.type===‘income’);
else if(_entryFilter===‘지출’) entries=entries.filter(e=>e.type===‘expense’&&e.category!==‘할부’);
else if(_entryFilter===‘할부’) entries=entries.filter(e=>e.category===‘할부’);
if(!entries.length){ container.innerHTML=’<div class="empty-state">항목이 없습니다<br>위 버튼으로 추가하세요!</div>’; return; }
const todayYm=yyyymm(today());
entries.sort((a,b)=>(a.type===‘income’?0:a.category===‘할부’?2:1)-(b.type===‘income’?0:b.category===‘할부’?2:1)||(a.day||0)-(b.day||0));
let html=’’,lastGroup=’’;
for(const e of entries){
const g=e.type===‘income’?‘▲ 수입’:e.category===‘할부’?‘💳 할부’:‘▼ 지출’;
if(g!==lastGroup){ html+=`<div class="entry-group-label">${g}</div>`; lastGroup=g; }
const isEnded=e.endMonth&&parseInt(e.endMonth)<todayYm;
const amtClass=e.type===‘income’?‘income’:e.category===‘할부’&&e.card===‘현대카드’?‘halbu-h’:e.category===‘할부’&&e.card===‘국민카드’?‘halbu-k’:‘expense’;
const cardBadge=e.card===‘현대카드’?’<span class="badge hyundai">현대</span>’:e.card===‘국민카드’?’<span class="badge kookmin">국민</span>’:’’;
const endBadge=e.endMonth?`<span class="badge ${isEnded?'ended':'halbu'}">${isEnded?'종료':'~'+String(e.endMonth).slice(0,4)+'/'+String(e.endMonth).slice(4)}</span>`:’’;
const ri=e.repeat===‘매월’?`매월 ${e.day}일`:e.repeat===‘1회성’?e.date:‘격주’;
html+=`<div class="entry-item" style="${isEnded?'opacity:0.45':''}"><div class="entry-left"><div class="entry-dot" style="background:${CAT_COLORS[e.category]||'#64748b'};color:${CAT_COLORS[e.category]||'#64748b'}"></div><div class="entry-info"><div class="entry-name">${e.name}</div><div class="entry-meta">${e.category} · ${ri} ${cardBadge} ${endBadge}</div></div></div><div class="entry-right"><span class="entry-amount ${amtClass}">${e.type==='income'?'+':'-'}${fmtShort(e.amount)}</span><button class="icon-btn edit" onclick="window._ui.editEntry('${e.id}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg></button><button class="icon-btn del" onclick="window._ui.deleteEntry('${e.id}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button></div></div>`;
}
container.innerHTML=html;
}

// ════════════════════════════════════════════════════════
// 카드 탭
// ════════════════════════════════════════════════════════
export function renderCards() { renderCardMonths(); }
export function renderCardMonths() {
const t=today(); let html=’’;
for(let i=-1;i<=12;i++){ const d=new Date(t.getFullYear(),t.getMonth()+i,1); const ym=String(yyyymm(d)); const m=d.getMonth()+1; const cd=state.cardData[ym]||{}; const h=cd.hyundai||0,k=cd.kookmin||0; const isCurrent=d.getFullYear()===t.getFullYear()&&m===t.getMonth()+1; html+=`<div class="card-month-item ${isCurrent?'current':''}"><div class="card-month-header"><span class="card-month-label">${d.getFullYear()}년 ${m}월 ${isCurrent?'<span style="font-size:10px;color:var(--accent2)">(이번달)</span>':''}</span><span class="card-month-total">${h+k>0?'-'+fmtShort(h+k):'-'}</span></div><div class="card-inputs"><div><div class="card-input-label hyundai">🔵 현대카드 (1일)</div><input class="card-num-input" type="number" value="${h||''}" placeholder="0" inputmode="numeric" oninput="window._ui.updateCardData('${ym}','hyundai',this.value)" style="border-color:var(--accent)"></div><div><div class="card-input-label kookmin">🟠 국민카드 (3일)</div><input class="card-num-input" type="number" value="${k||''}" placeholder="0" inputmode="numeric" oninput="window._ui.updateCardData('${ym}','kookmin',this.value)" style="border-color:var(--orange)"></div></div></div>`; }
const el=document.getElementById(‘card-months-list’); if(el) el.innerHTML=html;
}

// ════════════════════════════════════════════════════════
// 가계부 탭
// ════════════════════════════════════════════════════════
export function renderLedger() {
const y=currentLedgerYear,m=currentLedgerMonth;
const firstDay=new Date(y,m,1); const lastDay=new Date(y,m+1,0);
const startWd=firstDay.getDay(); const totalDays=lastDay.getDate();
const monthPrefix=`${y}-${p2(m+1)}`;
const ml=document.getElementById(‘ledger-month-label’); if(ml) ml.textContent=`${y}년 ${m+1}월`;
const monthEntries=Object.entries(state.checkData||{}).filter(([d])=>d.startsWith(monthPrefix));
const monthTotal=monthEntries.reduce((s,[,v])=>s+v,0);
const spendDays=monthEntries.length;
let maxDayText=’-’;
if(monthEntries.length>0){ const [mx,ma]=monthEntries.reduce((max,cur)=>cur[1]>max[1]?cur:max); const md=new Date(mx); maxDayText=`${md.getDate()}일 · ${fmtShort(ma)}`; }
const te=document.getElementById(‘ledger-total-spend’); if(te) te.textContent=fmtShort(monthTotal);
const ae=document.getElementById(‘ledger-avg-spend’); if(ae) ae.textContent=spendDays>0?fmtShort(Math.round(monthTotal/spendDays)):’-’;
const me=document.getElementById(‘ledger-max-day’); if(me) me.textContent=maxDayText;
const ms=document.getElementById(‘ledger-month-summary’); if(ms) ms.innerHTML=`<div class="ledger-summary-hero"><div><strong>${m+1}월 소비 요약</strong><span>날짜를 눌러 금액을 입력하거나 수정할 수 있어요</span></div><div style="font-family:var(--mono);font-size:16px;color:var(--orange);font-weight:800">${fmtShort(monthTotal)}</div></div>`;
const chartEl=document.getElementById(‘ledger-bar-chart’);
if(chartEl){ if(!monthEntries.length){ chartEl.innerHTML=`<div class="empty-state" style="padding:20px 0">이번 달 소비 기록이 없습니다</div>`; } else { const maxAmt=Math.max(…monthEntries.map(([,v])=>v),1); chartEl.innerHTML=`<div class="monthly-chart-bar">${monthEntries.sort((a,b)=>a[0].localeCompare(b[0])).map(([date,amt])=>{ const dd=new Date(date); return `<div class="bar-row"><span class="bar-label">${dd.getDate()}일</span><div class="bar-track"><div class="bar-fill expense" style="width:${(amt/maxAmt*100).toFixed(1)}%"></div></div><span class="bar-value" style="color:var(--red2)">${fmtShort(amt)}</span></div>`; }).join('')}</div>`; } }
let html=’’;
for(let i=0;i<startWd;i++) html+=`<div class="ledger-day empty"></div>`;
for(let day=1;day<=totalDays;day++){ const d=new Date(y,m,day); const dk=dateKey(d); const dow=d.getDay(); const isToday=dk===dateKey(today()); const isSelected=dk===_selectedLedgerDate; const amt=(state.checkData&&state.checkData[dk])?state.checkData[dk]:0; let nc=‘ledger-day-num’+(dow===0?’ sun’:dow===6?’ sat’:’’); html+=`<div class="ledger-day ${isToday?'today':''} ${isSelected?'selected':''}" onclick="window._ui.openLedgerEditor('${dk}')"><div class="ledger-day-top"><div class="${nc}">${day}</div></div><div class="ledger-day-amount">${amt>0?'-'+fmtShort(amt):''}</div></div>`; }
const grid=document.getElementById(‘ledger-calendar-grid’); if(grid) grid.innerHTML=html;
}

export function changeLedgerMonth(diff) {
currentLedgerMonth+=diff;
if(currentLedgerMonth<0){ currentLedgerMonth=11; currentLedgerYear–; }
if(currentLedgerMonth>11){ currentLedgerMonth=0; currentLedgerYear++; }
_selectedLedgerDate=null;
const ec=document.getElementById(‘ledger-editor-card’); if(ec) ec.style.display=‘none’;
renderLedger();
}
