# 🚀 배포 가이드 (Cloudflare Pages)

## 빠른 시작 (최초 1회 설정)

1. [dash.cloudflare.com](https://dash.cloudflare.com) 가입 (무료)
2. 왼쪽 메뉴 **Workers & Pages** → **Create application** → **Pages** 탭 → **Connect to Git**
3. GitHub 인증 → `Ha-kunamatata/cashflow` 저장소 선택
4. **빌드 설정**:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
5. **Save and Deploy** 클릭

배포 완료되면 `cashflow-xxxx.pages.dev` 주소가 발급됩니다.

## 자동 배포

- `main` 브랜치에 push → 프로덕션 자동 재배포
- 다른 브랜치 push → 프리뷰 URL 자동 생성 (`<branch>.cashflow.pages.dev`)
- PR 생성 시 자동으로 프리뷰 링크가 PR 코멘트에 추가됨

## 로컬 개발

```bash
npm install          # 첫 1회
npm run dev          # http://localhost:5173 (핫리로드)
npm run build        # 프로덕션 빌드 → dist/
npm run preview      # 프로덕션 빌드 로컬 미리보기
npm run typecheck    # 타입 체크 (TS 도입 후)
```

## 커스텀 도메인 연결 (선택)

도메인 구매 (예: Cloudflare Registrar, Namecheap, 가비아) 후:
1. Cloudflare Pages 프로젝트 → **Custom domains** → **Set up a custom domain**
2. 도메인 입력 → Cloudflare가 자동으로 DNS 설정 안내
3. 2분 안에 HTTPS 자동 발급 + 연결 완료

## 폴더 구조

```
cashflow/
├── index.html           # Vite entry
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/              # 정적 파일 (빌드 시 dist/ 루트로 복사)
│   ├── manifest.json
│   ├── sw.js
│   └── _headers         # Cloudflare 캐싱 정책
├── src/                 # 소스 코드
│   ├── app.js           # 진입점
│   ├── styles/style.css
│   └── *.js
├── dist/                # 빌드 결과 (gitignored)
└── v3/                  # 레거시 (GitHub Pages용, 단계적 제거 예정)
```
