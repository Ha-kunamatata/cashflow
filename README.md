# 💰 내 자금 흐름 (CashFlow)

개인 현금 흐름을 추적하고, 미래 잔고를 예측하며, AI로 소비를 분석하는 **PWA(Progressive Web App)**입니다.
PC · 태블릿 · 모바일 어디서나 동일한 경험으로 사용할 수 있으며, 구글 계정으로 로그인 시 기기 간 실시간 동기화됩니다.

> 🌐 **라이브 데모:** [https://cashflow-6mn.pages.dev](https://cashflow-6mn.pages.dev)
> (Cloudflare Pages, Vite + TypeScript 빌드 · 자동 배포)

## ⚡ 빠른 시작 (개발)

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # 프로덕션 빌드 → dist/
npm run typecheck # TypeScript 타입 검사
```

배포 가이드는 [`DEPLOY.md`](DEPLOY.md) 참고.

---

---

## 🛠 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | Vanilla JavaScript (ES Modules), HTML5, CSS3 |
| 스타일링 | CSS Custom Properties, CSS Grid/Flexbox, Glass Morphism, Canvas API |
| 인증 | Firebase Authentication (Google OAuth) |
| 데이터베이스 | Firebase Firestore (실시간 동기화) |
| AI | Google Gemini 2.5 Flash API (Text + Vision Multimodal) |
| 차트 | 자체 SVG 차트 엔진 + Chart.js |
| 폰트 | Noto Sans KR, DM Mono (Google Fonts) |
| PWA | Web App Manifest, Service Worker (캐시 전략 분리) |

---

## 📁 프로젝트 구성

```
cashflow/
├── index.html              # Vite entry (SPA HTML 포함)
├── package.json
├── vite.config.ts          # Vite 빌드 설정
├── tsconfig.json           # TypeScript 설정 (점진 도입 — allowJs)
├── eslint.config.js        # ESLint 9 flat config
├── .prettierrc.json
├── public/                 # 정적 자산 (그대로 dist/로 복사)
│   ├── manifest.json       # PWA 매니페스트
│   ├── sw.js               # Service Worker
│   └── _headers            # Cloudflare 캐싱 정책
└── src/
    ├── types.ts            # 앱 전역 데이터 모델 (AppState, LedgerData 등)
    ├── config.ts           # Firebase 설정, 카테고리 상수
    ├── utils.ts            # 날짜·금액 포맷, 시트, 배지
    ├── budget.ts           # 월별 예산 헬퍼
    ├── forecast.ts         # 365일 잔고 예측 엔진
    ├── streak.ts           # 스트릭 + 배지 정의
    ├── assets.ts           # 자산 분류 + 집 레벨 시스템
    ├── styles/style.css    # 전체 스타일
    ├── app.js              # 진입점 — Firebase 초기화, 이벤트 바인딩 (점진 .ts 전환 예정)
    ├── state.js            # 전역 상태 관리
    ├── ui.js               # 폼/시트/모달 인터랙션
    ├── render.js           # DOM 렌더링 (점진 분할 예정)
    ├── ai.js               # Gemini API 연동
    ├── firebase.js         # Firestore CRUD + Auth
    └── game.js             # 게이미피케이션 보조
```

---

## ✨ 주요 기능

### 💳 잔고 & 현금 흐름
- 현재 잔고 직접 입력 및 자동 계산
- 고정 수입 / 고정 지출 등록 (월별 반복, 종료월 설정)
- 카드 할부 자동 관리 (카드별 결제일, 할부 잔여 추적)
- 위험선(Danger Line) 설정으로 잔고 경보
- **리빙 그라디언트 잔고 카드** — 부드럽게 흐르는 컬러 그라디언트 + 플로팅 오브 데코

### 📊 365일 예측 차트
- 오늘부터 최대 1년 후까지 잔고 추이 시각화
- 위험 구간(잔고 < 위험선) 자동 하이라이트
- 급여일/지출일 타임라인 이벤트 표시
- **홈 예측 미니 위젯** — 월말 예상잔고 · 예정 지출 · 다음 큰 지출을 한 카드에

### 📒 가계부
- 일별 수입/지출 직접 기록 + 소비 유형 태그(충동/계획/필수/외식/선물)
- 카테고리별 색상 히트맵 달력 + 일일 거래 건수 배지
- **달력 인라인 패널** — 날짜 탭 시 바텀시트 없이 달력 바로 아래에서 펼침
- 월별 카테고리 지출 분석 차트
- **연간 히트맵** — GitHub 컨트리뷰션 그리드 스타일 지출 강도 시각화
- **카테고리 트렌드 라인 차트** — 최대 4개 카테고리 12개월 추이 비교
- **AI 소비 분석** — Gemini가 한 달 소비 패턴을 심층 분석

### 💰 예산
- 카테고리별 월간 예산 설정 + 실시간 진행률
- **홈 예산 위젯** — 상위 4개 카테고리 진행 바를 홈에서 한눈에
- 80% / 100% 도달 시 색상 변경 (안전 → 주의 → 초과)

### 📸 월간 리포트 카드
- 이달 소비 요약을 PNG 이미지(640×1040)로 저장
- 수입/지출/저축률/카테고리 Top 4/소비 성향 + 건강 점수
- 인스타그램 스토리 공유 최적화 비율

### 🤖 AI 재무 인사이트 (Gemini 2.5 Flash)
- 홈 탭: 현재 재무 현황 요약 + 오늘의 추천 행동
- 가계부 탭: 월별 카테고리 분석, 절약 전략, 주의 사항
- AI 채팅: 재무 데이터 기반 Q&A 도우미
- **📷 영수증 OCR** — 사진 한 장으로 금액/카테고리/메모 자동 입력 (Gemini Vision)
- **주간 코칭 카드** — 한 주 소비를 AI가 코칭
- 마크다운 렌더링 (헤더, 굵기, 불릿, 번호 목록)

### 🎯 저축 목표 & 가계 공유
- 목표 금액 / 저축 현황 트래킹
- 목표 공유 코드 생성 → 다른 사용자 참여 (Firebase 기반)
- **가계 공유** — 여러 계정이 하나의 가계부 공동 관리
- 달성 시 뱃지/레벨업

### 💹 위시리스트 & 관심 종목
- 사고 싶은 항목 금액과 함께 관리
- **만약에 시뮬레이터** — 위시 구매 시 미래 잔고 영향 예측
- 관심 주식/코인 심볼 등록 및 가격 확인

### 🏆 게이미피케이션
- 출석 스트릭 (연속 방문일수)
- 레벨 & 뱃지 시스템 (집 레벨업 UI)
- 업적 달성 알림 + **컨페티 애니메이션**
- 재정 건강 점수 (저축률·스트릭·예산 준수·할부 비중 기반)
- **소비 성향 분석** — 태그 기반 성향 분류

### ⚡ 빠른 입력 & 검색
- **스피드 다이얼 FAB** — `+` 한 번으로 AI 도우미 + 가계부 추가 둘 다 호출
- **즐겨찾기 템플릿** — 자주 쓰는 거래를 한 번에 입력
- **스마트 메모 자동완성** — 과거 메모 이력 기반 칩 추천 (메모/카테고리/타입 일괄 적용)
- **전체 검색 오버레이** — 모든 가계부를 키워드로 즉시 탐색 (Cmd/Ctrl+K 단축키)

### 🎨 커스터마이징
- 다크 / 라이트 모드 토글
- **8종 테마 컬러 프리셋** — 인디고/블루/바이올렛/핑크/에메랄드/앰버/로즈/틸
- 선택 즉시 앱 전체 강조 색상 변경 + localStorage 저장

### 📱 PWA / 모바일 최적화
- 홈 화면 추가 지원 (Android / iOS)
- Safe Area 대응 (iPhone 노치/홈 인디케이터)
- 하단 8개 탭 — 비활성 시 아이콘만, 활성 시 아이콘+텍스트 자동 확장
- 홈 카드 스태거 애니메이션 (순차적 페이드인)
- Service Worker 캐시 분리 — HTML은 네트워크 우선, 정적 에셋은 캐시 우선
- 자동 업데이트 — 새 버전 배포 시 캐시 자동 무효화 + 리로드

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
- 설정 탭 → **🎨 테마 컬러** 8종 프리셋 중 선택
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

## 🆕 최근 업데이트

### v13 (2026.05)
- 🎨 **커스텀 테마 컬러** — 8종 액센트 프리셋
- 📈 **홈 예측 미니 위젯** — 월말 잔고/예정 지출/다음 큰 지출 한눈에
- ✍️ **스마트 메모 자동완성** — 과거 메모 기반 칩 추천 + 카테고리 자동 적용

### v12
- 🔍 **전체 검색 오버레이** (Cmd/Ctrl+K)
- 🌈 **리빙 그라디언트 잔고 카드**
- 📱 **8탭 네비 재설계** (비활성 아이콘 전용)
- 🎬 홈 카드 스태거 페이드인 애니메이션

### v11
- 📅 **달력 인라인 패널** + 일일 거래 건수 배지
- 💰 **홈 예산 위젯** (상위 4개 카테고리 진행 바)
- 📸 **월간 리포트 카드** PNG 저장
- ⚡ **스피드 다이얼 FAB** (AI + 가계부 통합)

### v10 이전
- 🤖 영수증 OCR · AI 코칭 · 만약에 시뮬레이터
- 🏠 가계 공유 · 연간 히트맵 · 소비 성향 분석
- 🏆 재정 건강 점수 · 배지 시스템 · 컨페티

---

## 🗺 앞으로 개발할 기능 (Roadmap)

| 우선순위 | 기능 | 설명 |
|----------|------|------|
| 🔴 높음 | 알림 / 푸시 | 위험선 근접 시 브라우저 푸시 알림 |
| 🟡 중간 | 정기 지출 자동 인식 | 가계부 패턴 분석으로 고정비 자동 추천 |
| 🟡 중간 | 다중 통화 지원 | USD, JPY 등 환율 변환 포함 자산 관리 |
| 🟢 낮음 | 월별 리포트 PDF | 한 달 소비 요약을 PDF로 다운로드 |
| 🟢 낮음 | 오프라인 완전 지원 | Service Worker + IndexedDB 캐싱 강화 |
| 🟢 낮음 | 위젯 지원 | Android/iOS 홈 화면 잔고 위젯 |

---

## 📄 라이선스

개인 프로젝트 — 비공개 사용 목적으로 제작되었습니다.
