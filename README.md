# 💰 내 자금 흐름 (CashFlow)

개인 현금 흐름을 추적하고, 미래 잔고를 예측하며, AI로 소비를 분석하는 **PWA(Progressive Web App)**입니다.
PC · 태블릿 · 모바일 어디서나 동일한 경험으로 사용할 수 있으며, 구글 계정으로 로그인 시 기기 간 실시간 동기화됩니다.

---

## 🛠 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | Vanilla JavaScript (ES Modules), HTML5, CSS3 |
| 스타일링 | CSS Custom Properties, CSS Grid/Flexbox, Glass Morphism |
| 인증 | Firebase Authentication (Google OAuth) |
| 데이터베이스 | Firebase Firestore (실시간 동기화) |
| AI | Google Gemini 2.5 Flash API |
| 차트 | Chart.js |
| 폰트 | Noto Sans KR, DM Mono (Google Fonts) |
| PWA | Web App Manifest, Service Worker |

---

## 📁 프로젝트 구성

```
cashflow/
└── v3/
    ├── index.html          # 단일 페이지 앱 (SPA) 진입점 — 모든 탭/시트 HTML 포함
    ├── manifest.json       # PWA 매니페스트 (홈 화면 추가, 아이콘 등)
    ├── css/
    │   └── style.css       # 전체 스타일 (다크/라이트 테마, 애니메이션, 컴포넌트)
    └── js/
        ├── app.js          # 앱 진입점 — Firebase 초기화, 이벤트 리스너, 탭 라우팅
        ├── state.js        # 전역 상태(state) 객체, 로드/저장/초기화
        ├── ui.js           # UI 인터랙션 — 폼 열기/닫기, 시트 관리, AI 연동
        ├── render.js       # 데이터 → DOM 렌더링 (가계부, 위시리스트, 재무 등)
        ├── ai.js           # Gemini API 연동 — 인사이트, 소비 분석, 채팅
        ├── forecast.js     # 365일 잔고 예측 엔진 (고정 수입/지출 기반)
        ├── firebase.js     # Firestore CRUD, 목표 공유 기능
        ├── assets.js       # 자산 관리 로직
        ├── budget.js       # 월별 예산 설정 및 집계
        ├── config.js       # 카테고리 상수, 기본값 설정
        ├── game.js         # 레벨/배지/스트릭 게이미피케이션
        ├── streak.js       # 출석 체크 스트릭 계산
        └── utils.js        # 날짜 포맷, 시트 열기/닫기, 배지 유틸리티
```

---

## ✨ 주요 기능

### 💳 잔고 & 현금 흐름
- 현재 잔고 직접 입력 및 자동 계산
- 고정 수입 / 고정 지출 등록 (월별 반복, 종료월 설정)
- 카드 할부 자동 관리 (카드별 결제일, 할부 잔여 추적)
- 위험선(Danger Line) 설정으로 잔고 경보

### 📊 365일 예측 차트
- 오늘부터 최대 1년 후까지 잔고 추이 시각화
- 위험 구간(잔고 < 위험선) 자동 하이라이트
- 급여일/지출일 타임라인 이벤트 표시

### 📒 가계부
- 일별 수입/지출 직접 기록
- 카테고리별 색상 히트맵 달력
- 월별 카테고리 지출 분석 차트
- **AI 소비 분석** — Gemini가 한 달 소비 패턴을 심층 분석

### 🤖 AI 재무 인사이트 (Gemini 2.5 Flash)
- 홈 탭: 현재 재무 현황 요약 + 오늘의 추천 행동
- 가계부 탭: 월별 카테고리 분석, 절약 전략, 주의 사항
- AI 채팅: 재무 데이터 기반 Q&A 도우미
- 마크다운 렌더링 (헤더, 굵기, 불릿, 번호 목록)
- 전체 보기 시트로 모든 내용 확인 가능

### 🎯 저축 목표
- 목표 금액 / 저축 현황 트래킹
- 목표 공유 코드 생성 → 다른 사용자 참여 (Firebase 기반)
- 달성 시 뱃지/레벨업

### 💹 위시리스트 & 관심 종목
- 사고 싶은 항목 금액과 함께 관리
- 관심 주식/코인 심볼 등록 및 가격 확인

### 🏆 게이미피케이션
- 출석 스트릭 (연속 방문일수)
- 레벨 & 뱃지 시스템 (집 레벨업 UI)
- 업적 달성 알림

### 📱 PWA / 모바일 최적화
- 홈 화면 추가 지원 (Android / iOS)
- Safe Area 대응 (iPhone 노치/홈 인디케이터)
- 하단 탭바 라운드 모서리, 부드러운 페이지 전환

---

## ⚙️ 개발 환경 설정

### 1. Firebase 프로젝트 설정
1. [Firebase Console](https://console.firebase.google.com)에서 새 프로젝트 생성
2. **Authentication** → Google 로그인 활성화
3. **Firestore Database** 생성 (테스트 모드 또는 보안 규칙 설정)
4. **프로젝트 설정 → 웹 앱 추가** → Firebase SDK 설정값 복사

### 2. Firebase 설정 적용
`v3/js/firebase.js` 상단의 `firebaseConfig` 객체를 본인 프로젝트 설정으로 교체:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. 로컬 서버 실행
ES Modules는 `file://` 프로토콜에서 동작하지 않으므로 로컬 HTTP 서버가 필요합니다.

```bash
# Python 3
python3 -m http.server 8080 --directory v3

# Node.js (npx)
npx serve v3

# VS Code
# Live Server 확장 설치 후 index.html 우클릭 → "Open with Live Server"
```

브라우저에서 `http://localhost:8080` 접속

### 4. Gemini API 키 설정
1. [Google AI Studio](https://aistudio.google.com/app/apikey)에서 무료 API 키 발급
2. 앱 로그인 후 **설정 탭 → Gemini API 키 입력** 저장
3. 키는 `localStorage`에만 저장되며 서버로 전송되지 않습니다

---

## 🎨 컨디션 조절 (커스터마이징)

### 테마 변경
- 앱 내 **설정 탭 → 다크/라이트 테마** 토글
- CSS `--bg`, `--accent` 등 CSS Custom Properties로 전체 색상 조정 가능

### 위험선 설정
- 홈 탭 → 잔고 카드 → 위험선 금액 설정
- 잔고가 위험선 이하로 떨어지면 예측 차트에 경고 표시

### 카테고리 수정
`v3/js/config.js`에서 `EXPENSE_CATS`, `INCOME_CATS`, `LEDGER_CATEGORIES` 배열 수정

```javascript
export const EXPENSE_CATS = ['식비', '교통', '통신', '의료', '쇼핑', ...];
```

### 예측 기간 조정
`v3/js/forecast.js`의 `FORECAST_DAYS` 상수 변경 (기본값: 365일)

---

## 🗺 앞으로 개발할 기능 (Roadmap)

| 우선순위 | 기능 | 설명 |
|----------|------|------|
| 🔴 높음 | 알림 / 푸시 | 위험선 근접 시 브라우저 푸시 알림 |
| 🔴 높음 | 예산 초과 경보 | 카테고리별 월 예산 초과 시 실시간 경고 |
| 🟡 중간 | 정기 지출 자동 인식 | 가계부 패턴 분석으로 고정비 자동 추천 |
| 🟡 중간 | 영수증 OCR | 사진 촬영 → 금액/카테고리 자동 입력 |
| 🟡 중간 | 다중 통화 지원 | USD, JPY 등 환율 변환 포함 자산 관리 |
| 🟢 낮음 | 월별 리포트 PDF | 한 달 소비 요약을 PDF로 다운로드 |
| 🟢 낮음 | 가족/팀 공유 | 하나의 가계부를 여러 계정이 공동 관리 |
| 🟢 낮음 | 오프라인 완전 지원 | Service Worker + IndexedDB 캐싱 강화 |
| 🟢 낮음 | 위젯 지원 | Android/iOS 홈 화면 잔고 위젯 |

---

## 📄 라이선스

개인 프로젝트 — 비공개 사용 목적으로 제작되었습니다.
