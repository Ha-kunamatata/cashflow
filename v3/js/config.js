// ════════════════════════════════════════════════════════
// config.js — Firebase 설정 & 앱 상수
// ════════════════════════════════════════════════════════

export const FIREBASE_CONFIG = {
apiKey: “AIzaSyDnENmqs9vZamZfnWCBOh4Z4rLIgereMDA”,
authDomain: “cashflow-37c61.firebaseapp.com”,
projectId: “cashflow-37c61”,
storageBucket: “cashflow-37c61.firebasestorage.app”,
messagingSenderId: “166803006858”,
appId: “1:166803006858:web:0ac904e24edc517a499473”
};

export const STORAGE_KEY = ‘cashflow_v21’;

export const CAT_COLORS = {
‘월급’:     ‘#10b981’,
‘수당’:     ‘#34d399’,
‘기타수입’: ‘#6ee7b7’,
‘카드’:     ‘#f87171’,
‘할부’:     ‘#fb923c’,
‘공과금’:   ‘#facc15’,
‘보험’:     ‘#c084fc’,
‘기타지출’: ‘#94a3b8’,
};

export const INCOME_CATS  = [‘월급’, ‘수당’, ‘기타수입’];
export const EXPENSE_CATS = [‘카드’, ‘할부’, ‘공과금’, ‘보험’, ‘기타지출’];
export const DAYS_KR      = [‘일’,‘월’,‘화’,‘수’,‘목’,‘금’,‘토’];
