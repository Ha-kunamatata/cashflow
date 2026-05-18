// ════════════════════════════════════════════════════════
// firebase.ts — Firebase 인증 & Firestore (순환참조 없음)
// ════════════════════════════════════════════════════════
// @ts-nocheck — Firebase CDN URL imports are resolved at runtime, not by TS
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { FIREBASE_CONFIG } from './config';

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let unsubscribeSnapshot: (() => void) | null = null;

function isInAppBrowser(): boolean {
  return /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line|wv/i.test(navigator.userAgent);
}

function getRef() {
  const user = auth.currentUser;
  if (!user) return null;
  const hCode = localStorage.getItem('cashflow_household');
  if (hCode) return doc(db, 'households', hCode, 'data', 'main');
  return doc(db, 'users', user.uid, 'data', 'main');
}

export async function signInWithGoogle(): Promise<void> {
  const btn = document.querySelector('.btn-google-login') as HTMLElement | null;
  const txt = document.getElementById('google-login-text');

  try {
    if (isInAppBrowser()) {
      alert('앱 내 브라우저에서는 로그인이 잘 되지 않아요.\nSafari나 기본 브라우저에서 열어주세요.');
      return;
    }

    btn?.classList.add('is-loading');
    if (txt) txt.innerHTML = '<span class="btn-inline-spinner"></span>로그인 중...';

    try {
      await signInWithPopup(auth, provider);
    } catch (popupErr: unknown) {
      const code = (popupErr as { code?: string })?.code;
      const blocked =
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment';
      if (blocked) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw popupErr;
    }
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    const message = (e as { message?: string })?.message;
    const msgs: Record<string, string> = {
      'auth/popup-closed-by-user': '로그인 창이 닫혔습니다.',
      'auth/cancelled-popup-request': '로그인이 취소됐습니다.',
      'auth/unauthorized-domain': '승인되지 않은 도메인입니다.',
    };
    alert(msgs[code ?? ''] || `로그인 실패: ${code || message || '알 수 없는 오류'}`);
    console.error('Google login error:', e);
  } finally {
    btn?.classList.remove('is-loading');
    if (txt) txt.textContent = 'Google로 시작하기';
  }
}

export async function signOutUser(): Promise<void> {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  await signOut(auth);
}

export async function saveToFirebase(data: unknown): Promise<void> {
  const ref = getRef();
  if (!ref) return;
  try {
    await setDoc(ref, data as Record<string, unknown>);
  } catch (e) {
    console.warn('저장 실패:', e);
  }
}

export async function loadFromFirebase(): Promise<unknown> {
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

export function startSync(callback: (data: unknown) => void): void {
  const ref = getRef();
  if (!ref) return;
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  unsubscribeSnapshot = onSnapshot(ref, (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

export async function publishSharedGoal(code: string, goalSnapshot: unknown): Promise<boolean> {
  try {
    const user = auth.currentUser;
    await setDoc(doc(db, 'sharedGoals', code.toUpperCase()), {
      ...(goalSnapshot as object),
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

export async function fetchSharedGoalByCode(code: string): Promise<unknown> {
  try {
    const snap = await getDoc(doc(db, 'sharedGoals', code.toUpperCase()));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('공유 목표 조회 실패:', e);
    return null;
  }
}

export function getCurrentHouseholdCode(): string | null {
  return localStorage.getItem('cashflow_household') || null;
}

export async function createHousehold(stateData: unknown): Promise<string | null> {
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
    await setDoc(dataRef, stateData as Record<string, unknown>);
    localStorage.setItem('cashflow_household', code);
    return code;
  } catch (e) {
    console.warn('가계 생성 실패:', e);
    return null;
  }
}

export async function joinHousehold(code: string): Promise<unknown> {
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

export async function leaveHousehold(): Promise<void> {
  const code = getCurrentHouseholdCode();
  if (!code) return;
  const user = auth.currentUser;
  if (user) {
    try {
      const metaRef = doc(db, 'households', code);
      const metaSnap = await getDoc(metaRef);
      if (metaSnap.exists()) {
        const meta = metaSnap.data();
        const members = meta.members.filter((uid: string) => uid !== user.uid);
        const memberNames = meta.memberNames
          ? meta.memberNames.filter((_: string, i: number) => meta.members[i] !== user.uid)
          : [];
        await setDoc(metaRef, { ...meta, members, memberNames });
      }
    } catch (e) {
      console.warn('가계 나가기 실패:', e);
    }
  }
  localStorage.removeItem('cashflow_household');
}

export async function getHouseholdMeta(): Promise<unknown> {
  const code = getCurrentHouseholdCode();
  if (!code) return null;
  try {
    const snap = await getDoc(doc(db, 'households', code));
    return snap.exists() ? { ...snap.data(), code } : null;
  } catch (_) {
    return null;
  }
}

export async function initAuth(
  onLogin: (user: unknown) => void,
  onLogout: () => void,
): Promise<void> {
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
