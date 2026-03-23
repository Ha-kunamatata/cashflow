// ════════════════════════════════════════════════════════
// firebase.js — Firebase 인증 & Firestore (순환참조 없음)
// ════════════════════════════════════════════════════════
import { initializeApp } from “https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js”;
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from “https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js”;
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from “https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js”;
import { FIREBASE_CONFIG } from ‘./config.js’;

const app      = initializeApp(FIREBASE_CONFIG);
const db       = getFirestore(app);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

let unsubscribeSnapshot = null;

function isIOS()         { return /iPhone|iPad|iPod/i.test(navigator.userAgent); }
function isSafari()      { return /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|GSA/i.test(navigator.userAgent); }
function isInAppBrowser(){ return /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line|wv/i.test(navigator.userAgent); }

export async function signInWithGoogle() {
const btn = document.querySelector(’.btn-google-login’);
const txt = document.getElementById(‘google-login-text’);
try {
if (isInAppBrowser()) { alert(‘앱 내 브라우저에서는 로그인이 잘 되지 않아요.\nSafari나 기본 브라우저에서 열어주세요.’); return; }
btn?.classList.add(‘is-loading’);
if (txt) txt.innerHTML = `<span class="btn-inline-spinner"></span>로그인 중...`;
if (isIOS() && isSafari()) { await signInWithRedirect(auth, provider); return; }
await signInWithPopup(auth, provider);
} catch (e) {
const msgs = { ‘auth/popup-blocked’:‘브라우저가 팝업을 차단했습니다.’, ‘auth/popup-closed-by-user’:‘로그인 창이 닫혔습니다.’, ‘auth/unauthorized-domain’:‘승인되지 않은 도메인입니다.’ };
alert(msgs[e?.code] || ‘로그인에 실패했습니다.’);
} finally {
btn?.classList.remove(‘is-loading’);
if (txt) txt.textContent = ‘Google로 시작하기’;
}
}

export async function signOutUser() {
if (unsubscribeSnapshot) unsubscribeSnapshot();
await signOut(auth);
}

function getRef() {
const user = auth.currentUser;
return user ? doc(db, ‘users’, user.uid, ‘data’, ‘main’) : null;
}

export async function saveToFirebase(data) {
const ref = getRef(); if (!ref) return;
try { await setDoc(ref, data); } catch(e) { console.warn(‘저장 실패:’, e); }
}

export async function loadFromFirebase() {
const ref = getRef(); if (!ref) return null;
try { const snap = await getDoc(ref); return snap.exists() ? snap.data() : null; } catch(e) { return null; }
}

export function startSync(callback) {
const ref = getRef(); if (!ref) return;
if (unsubscribeSnapshot) unsubscribeSnapshot();
unsubscribeSnapshot = onSnapshot(ref, snap => { if (snap.exists()) callback(snap.data()); });
}

// onAuthStateChanged → app.js에서 등록한 콜백 호출
export function initAuth(onLogin, onLogout) {
onAuthStateChanged(auth, user => {
window.currentUser = user;
window.firebaseReady = !!user;
window.saveToFirebase = saveToFirebase;
if (user) onLogin(user);
else onLogout();
});
}
