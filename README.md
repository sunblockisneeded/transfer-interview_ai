# AI 편입 면접 에이전트 (AI Transfer Interview Agent)

대학 편입 면접을 준비하는 학생들을 위한 AI 기반 보조 도구입니다. 지원하려는 대학의 커리큘럼, 교수진, 면접 트렌드를 분석하여 개인화된 합격 전략을 제시합니다.

## 주요 기능

- **대학/학과 검증**: 입력한 대학과 학과가 실제로 존재하는지 확인
- **커리큘럼 분석**: 1~2학년 핵심 전공 과목과 교육 트렌드 분석
- **교수진 분석**: 주요 교수진 검색 및 연구 성향 요약
- **면접 트렌드 분석**: 합격/불합격 사례, 학교별 특이사항 분석
- **면접 전략 수립**: 핵심 전략, 필수 키워드, 예상 질문(난이도별) 생성

## 시작하기

### 온라인 접속
https://transfer-interview-ai.vercel.app/
- Vercel로 배포됨
- API 호출 시간 60초 제한으로 일부 기능 제한
- 로컬 설치 권장

### 로컬 설치

**필수 조건**
- Node.js v18+
- Google Gemini API Key ([Google AI Studio](https://aistudio.google.com/)에서 발급)

**설치**
```bash
git clone <repository-url>
cd <project-directory>
npm install
```

**환경 변수 설정**

`.env.local` 파일 생성:
```env
API_KEY=your_gemini_api_key_here
API_ENABLED=true
```

**실행**
```bash
# 터미널 1: 백엔드 서버
npx tsx server.ts

# 터미널 2: 프론트엔드
npm run dev
```
- 백엔드: http://localhost:3001
- 프론트엔드: http://localhost:3000

---

## 테스트

### 단위 테스트 (API 불필요)
```bash
# 모든 단위 테스트 (36개)
npm run test:unit

# 빠른 테스트 (단위 + 검증기)
npm run test:quick
```

### 통합 테스트 (API 필요)
```bash
# 특정 대학/학과 리포트 생성
API_KEY=xxx npx tsx test/integration/cnu-report.ts   # 충남대 정치외교학과
API_KEY=xxx npx tsx test/integration/cbnu-report.ts  # 충북대 정치외교학과
```

### 테스트 결과 (2026-01-08)
| 대학 | 학과 | Score | 시간 |
|------|------|-------|------|
| 충남대 | 정치외교학과 | 100/100 | 47초 |
| 충북대 | 정치외교학과 | 100/100 | 44초 |
| 건국대 | 경영학과 | 100/100 | 41초 |

---

## 프로젝트 구조

```
api/
├── _handlers/          # API 핸들러
│   ├── validate.ts     # 대학/학과 검증
│   ├── curriculum.ts   # 커리큘럼 분석
│   ├── professors.ts   # 교수진 분석
│   ├── trends.ts       # 면접 트렌드
│   └── synthesis.ts    # 전략/질문 생성
├── _agents.ts          # AI 에이전트 로직
├── _config.ts          # 설정
└── _utils.ts           # 유틸리티 함수

components/             # React UI 컴포넌트
services/               # 프론트엔드 API 서비스
test/
├── unit/               # 단위 테스트
├── validators/         # 품질 검증기
├── integration/        # 통합 테스트
└── experiments/        # 프롬프트 실험

server.ts               # Express 서버
vitest.config.ts        # Vitest 설정
```

---

## 기술 스택

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Vercel Serverless Functions
- **AI**: Google Gemini Models (gemini-3-flash-preview)
- **Testing**: Vitest

## 문서

- [PIPELINE_ANALYSIS.md](./PIPELINE_ANALYSIS.md) - 파이프라인 구조 및 테스트 결과
- [PROMPT_STRATEGY.md](./PROMPT_STRATEGY.md) - 프롬프트 전략 및 개선 내역

## Inspiration

This project was inspired by **Andrew Ng's Agentic Reviewer** (http://paperreview.ai)

## 라이선스

이 프로젝트는 교육 목적으로 제작되었습니다.
