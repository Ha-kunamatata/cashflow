// ════════════════════════════════════════════════════════
// firebase.js — Firebase 인증 & Firestore (순환참조 없음)
// ════════════════════════════════════════════════════════
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { FIREBASE_CONFIG } from './config';

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let unsubscribeSnapshot = null;

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isSafari() {
  return /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|GSA/i.test(navigator.userAgent);
}

function isInAppBrowser() {
  return /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line|wv/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.navigator.standalone === true;
}

export async function signInWithGoogle() {
  const btn = document.querySelector('.btn-google-login');
  const txt = document.getElementById('google-login-text');

  try {
    if (isInAppBrowser()) {
      alert('앱 내 브라우저에서는 로그인이 잘 되지 않아요.\nSafari나 기본 브라우저에서 열어주세요.');
      return;
    }

    btn?.classList.add('is-loading');
    if (txt) txt.innerHTML = '<span class="btn-inline-spinner"></span>로그인 중...';

    // 팝업 먼저 시도 (iOS 16+ Safari·PWA·Chrome 모두 직접 탭 액션이면 허용)
    // 팝업이 차단된 경우에만 redirect 폴백
    try {
      await signInWithPopup(auth, provider);
    } catch (popupErr) {
      const blocked =
        popupErr?.code === 'auth/popup-blocked' ||
        popupErr?.code === 'auth/operation-not-supported-in-this-environment';
      if (blocked) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw popupErr;
    }
  } catch (e) {
    const msgs = {
      'auth/popup-closed-by-user': '로그인 창이 닫혔습니다.',
      'auth/cancelled-popup-request': '로그인이 취소됐습니다.',
      'auth/unauthorized-domain': '승인되지 않은 도메인입니다.',
    };
    alert(msgs[e?.code] || `로그인 실패: ${e?.code || e?.message || '알 수 없는 오류'}`);
    console.error('Google login error:', e);
  } finally {
    btn?.classList.remove('is-loading');
    if (txt) txt.textContent = 'Google로 시작하기';
  }
}

export async function signOutUser() {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }

  await signOut(auth);
}

function getRef() {
  const user = auth.currentUser;
  if (!user) return null;
  const hCode = localStorage.getItem('cashflow_household');
  if (hCode) return doc(db, 'households', hCode, 'data', 'main');
  return doc(db, 'users', user.uid, 'data', 'main');
}

export async function saveToFirebase(data) {
  const ref = getRef();
  if (!ref) return;

  try {
    await setDoc(ref, data);
  } catch (e) {
    console.warn('저장 실패:', e);
  }
}

export async function loadFromFirebase() {
  const ref = getRef();
  if (!ref) return null;

  try {
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('불러오기 실패:', e);
    return null;
  }
}

export function startSync(callback) {
  const ref = getRef();
  if (!ref) return;

  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
  }

  unsubscribeSnapshot = onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    }
  });
}

// ── 공유 목표 코드 (전역 컬렉션) ───────────────────────
export async function publishSharedGoal(code, goalSnapshot) {
  try {
    const user = auth.currentUser;
    await setDoc(doc(db, 'sharedGoals', code.toUpperCase()), {
      ...goalSnapshot,
      publisherUid: user?.uid || '',
      publisherName: user?.displayName || '알 수 없음',
      publishedAt: new Date().toISOString(),
    });
    return true;
  } catch (e) {
    console.warn('공유 목표 저장 실패:', e);
    return false;
  }
}

export async function fetchSharedGoalByCode(code) {
  try {
    const snap = await getDoc(doc(db, 'sharedGoals', code.toUpperCase()));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('공유 목표 조회 실패:', e);
    return null;
  }
}

// ── 가계 공유 (커플/가족) ────────────────────────────────
export function getCurrentHouseholdCode() {
  return localStorage.getItem('cashflow_household') || null;
}

export async function createHousehold(stateData) {
  const user = auth.currentUser;
  if (!user) return null;
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  try {
    await setDoc(doc(db, 'households', code), {
      ownerId: user.uid,
      ownerName: user.displayName || user.email || '알 수 없음',
      members: [user.uid],
      memberNames: [user.displayName || user.email || '알 수 없음'],
      createdAt: new Date().toISOString(),
    });
    const dataRef = doc(db, 'households', code, 'data', 'main');
    await setDoc(dataRef, stateData);
    localStorage.setItem('cashflow_household', code);
    return code;
  } catch (e) {
    console.warn('가계 생성 실패:', e);
    return null;
  }
}

export async function joinHousehold(code) {
  const user = auth.currentUser;
  if (!user) return null;
  const upper = code.trim().toUpperCase();
  try {
    const metaRef = doc(db, 'households', upper);
    const metaSnap = await getDoc(metaRef);
    if (!metaSnap.exists()) return null;
    const meta = metaSnap.data();
    const members = [...new Set([...meta.members, user.uid])];
    const memberNames = [...new Set([...meta.memberNames, user.displayName || user.email || '알 수 없음'])];
    await setDoc(metaRef, { ...meta, members, memberNames });
    localStorage.setItem('cashflow_household', upper);
    const dataSnap = await getDoc(doc(db, 'households', upper, 'data', 'main'));
    return dataSnap.exists() ? dataSnap.data() : {};
  } catch (e) {
    console.warn('가계 참여 실패:', e);
    return null;
  }
}

export async function leaveHousehold() {
  const code = getCurrentHouseholdCode();
  if (!code) return;
  const user = auth.currentUser;
  if (user) {
    try {
      const metaRef = doc(db, 'households', code);
      const metaSnap = await getDoc(metaRef);
      if (metaSnap.exists()) {
        const meta = metaSnap.data();
        const members = meta.members.filter(uid => uid !== user.uid);
        const memberNames = meta.memberNames
          ? meta.memberNames.filter((_, i) => meta.members[i] !== user.uid)
          : [];
        await setDoc(metaRef, { ...meta, members, memberNames });
      }
    } catch (e) {
      console.warn('가계 나가기 실패:', e);
    }
  }
  localStorage.removeItem('cashflow_household');
}

export async function getHouseholdMeta() {
  const code = getCurrentHouseholdCode();
  if (!code) return null;
  try {
    const snap = await getDoc(doc(db, 'households', code));
    return snap.exists() ? { ...snap.data(), code } : null;
  } catch (e) {
    return null;
  }
}

// onAuthStateChanged → app.js에서 등록한 콜백 호출
export async function initAuth(onLogin, onLogout) {
  // 리다이렉트 로그인 결과 처리 (iOS Standalone 모드용)
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      console.log('redirect 로그인 성공:', result.user.email);
    }
  } catch (e) {
    console.error('redirect 결과 처리 실패:', e);
  }

  onAuthStateChanged(auth, (user) => {
    window.currentUser = user;
    window.firebaseReady = !!user;
    window.saveToFirebase = saveToFirebase;

    if (user) onLogin(user);
    else onLogout();
  });
}
