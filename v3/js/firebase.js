// ════════════════════════════════════════════════════════
// firebase.js — Firebase 인증 & Firestore 동기화
// ════════════════════════════════════════════════════════
import { initializeApp } from “https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js”;
import {
getFirestore, doc, setDoc, getDoc, onSnapshot
} from “https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js”;
import {
getAuth, GoogleAuthProvider,
signInWithPopup, signInWithRedirect,
signOut, onAuthStateChanged
} from “https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js”;

import { FIREBASE_CONFIG } from ‘./config.js’;
import { showLoading, hideLoading, showBadge, openSheet, closeSheet } from ‘./utils.js’;
import { state, load, save, syncCheckDataToBalance, initDefaultData } from ‘./state.js’;
import { applyTheme } from ‘./ui.js’;
import { renderAll } from ‘./render.js’;

const app      = initializeApp(FIREBASE_CONFIG);
const db       = getFirestore(app);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

let unsubscribe = null;

// ── 기기 감지 ──────────────────────────────────────────
function isIOS()         { return /iPhone|iPad|iPod/i.test(navigator.userAgent); }
function isSafari()      { return /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|GSA/i.test(navigator.userAgent); }
function isInAppBrowser(){ return /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line|wv/i.test(navigator.userAgent); }

// ── 로그인 ─────────────────────────────────────────────
export async function signInWithGoogle() {
const btn = document.querySelector(’.btn-google-login’);
const txt = document.getElementById(‘google-login-text’);

try {
if (isInAppBrowser()) {
alert(‘앱 내 브라우저에서는 로그인이 잘 되지 않을 수 있어요.\nSafari나 기본 브라우저에서 열어주세요.’);
return;
}
btn?.classList.add(‘is-loading’);
if (txt) txt.innerHTML = `<span class="btn-inline-spinner"></span>로그인 중...`;
showLoading(‘Google 로그인 중…’);

```
if (isIOS() && isSafari()) {
  await signInWithRedirect(auth, provider);
  return;
}
await signInWithPopup(auth, provider);
```

} catch (e) {
console.error(‘로그인 실패:’, e);
const msgs = {
‘auth/popup-blocked’:       ‘브라우저가 로그인 창을 차단했습니다. 다시 시도해주세요.’,
‘auth/popup-closed-by-user’:‘로그인 창이 닫혔습니다. 다시 시도해주세요.’,
‘auth/unauthorized-domain’: ‘승인되지 않은 도메인입니다.’,
};
alert(msgs[e?.code] || ‘로그인에 실패했습니다. 다시 시도해주세요.’);
} finally {
btn?.classList.remove(‘is-loading’);
if (txt) txt.textContent = ‘Google로 시작하기’;
hideLoading();
}
}

// ── 로그아웃 ───────────────────────────────────────────
export async function proceedSignOut() {
closeSheet(‘signout-sheet’);
showLoading(‘로그아웃 중…’);
try {
if (unsubscribe) unsubscribe();
await signOut(auth);
showBadge(‘👋 로그아웃되었습니다’);
} catch (e) {
console.error(e);
alert(‘로그아웃 중 오류가 발생했어요.’);
} finally {
hideLoading();
}
}

// ── Firebase CRUD ──────────────────────────────────────
function getRef() {
const user = auth.currentUser;
if (!user) return null;
return doc(db, ‘users’, user.uid, ‘data’, ‘main’);
}

export async function saveToFirebase(data) {
const ref = getRef();
if (!ref) return;
try { await setDoc(ref, data); } catch (e) { console.warn(‘저장 실패:’, e); }
}

export async function loadFromFirebase() {
const ref = getRef();
if (!ref) return null;
try {
const snap = await getDoc(ref);
return snap.exists() ? snap.data() : null;
} catch (e) { return null; }
}

export function startSync(callback) {
const ref = getRef();
if (!ref) return;
if (unsubscribe) unsubscribe();
unsubscribe = onSnapshot(ref, snap => {
if (snap.exists()) callback(snap.data());
});
}

// ── 인증 상태 감시 ──────────────────────────────────────
onAuthStateChanged(auth, async user => {
window.currentUser  = user;
window.firebaseReady = !!user;
window.saveToFirebase = saveToFirebase;

if (user) {
// UI 전환
document.getElementById(‘login-screen’).style.display = ‘none’;
document.getElementById(‘topbar’).style.display       = ‘flex’;
document.getElementById(‘bottom-nav’).style.display   = ‘flex’;

```
// 아바타
const img = document.getElementById('user-avatar-img');
const txt = document.getElementById('user-avatar-text');
if (user.photoURL) { img.src = user.photoURL; img.style.display = 'block'; txt.style.display = 'none'; }
else               { txt.textContent = (user.displayName || user.email || '?')[0].toUpperCase(); }

// 설정 UI
document.getElementById('user-menu-name').textContent  = user.displayName || user.email;
document.getElementById('setting-account').textContent = user.email;
_updateProfileSheet(user);

// 데이터 로드 & 초기화
load();
const cloud = await loadFromFirebase();
if (cloud) {
  Object.assign(state, cloud);
  localStorage.setItem('cashflow_v21', JSON.stringify(state));
  showBadge('☁️ 동기화됨');
}
initDefaultData();
syncCheckDataToBalance();
document.getElementById('setting-danger').value      = state.dangerLine;
document.getElementById('danger-line-input').value   = state.dangerLine;
applyTheme();
renderAll();

// 실시간 동기화
startSync(cloudData => {
  Object.assign(state, cloudData);
  localStorage.setItem('cashflow_v21', JSON.stringify(state));
  applyTheme();
  renderAll();
  showBadge('🔄 다른 기기에서 업데이트됨');
});
```

} else {
document.getElementById(‘login-screen’).style.display = ‘flex’;
document.getElementById(‘topbar’).style.display       = ‘none’;
document.getElementById(‘bottom-nav’).style.display   = ‘none’;
hideLoading();
closeSheet(‘profile-sheet’);
closeSheet(‘signout-sheet’);
closeSheet(‘balance-sheet’);
}
});

function _updateProfileSheet(user) {
const name   = document.getElementById(‘profile-sheet-name’);
const email  = document.getElementById(‘profile-sheet-email’);
const avatar = document.getElementById(‘profile-sheet-avatar’);
if (name)   name.textContent  = user.displayName || ‘사용자’;
if (email)  email.textContent = user.email || ‘-’;
if (avatar) {
avatar.innerHTML = user.photoURL
? `<img src="${user.photoURL}" referrerpolicy="no-referrer" alt="profile">`
: (user.displayName || user.email || ‘?’)[0].toUpperCase();
}
}
