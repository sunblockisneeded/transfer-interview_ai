# 🎓 AI 편입 면접 에이전트 (AI Transfer Interview Agent)

이 프로젝트는 대학 편입 면접을 준비하는 학생들을 위한 AI 기반 보조 도구입니다. 지원하려는 대학의 커리큘럼, 교수진의 연구 성향, 그리고 최신 면접 트렌드를 분석하여 개인화된 합격 전략을 제시합니다.

## ✨ 주요 기능

- **대학/학과 검증**  : 입력한 대학과 학과가 실제로 존재하는지 확인합니다.
- **커리큘럼 분석**: 1~2학년 핵심 전공 과목과 교육 트렌드를 분석합니다.
- **교수진 연구 성향 분석**: 주요 교수진을 검색하고, 해당 교수의 연구 성향을 **한국어로 요약**하여 제공합니다.
- **면접 트렌드 분석**: 합격 및 불합격 사례, 학교별 특이사항을 분석합니다.
- **면접 전략 수립**: 위 정보를 종합하여 핵심 면접 전략, 필수 키워드, 예상 질문(난이도별)을 생성합니다.

## 🚀 시작하기 (Getting Started)
1. https://transfer-interview-ai.vercel.app/ 접속하는 방법이 있습니다 
- vercel로 배포되었습니다.
- 개별 api 호출 시간이 60초로 제한되어있어 일부 기능들이 재대로 작동하지 않습니다. 따라서 로컬 설치를 권장합니다.

## 로컬 설치하기 ##

### 필수 조건 (Prerequisites)

- Node.js (v18 이상 권장)
- Google Gemini API Key (google AI studio에서 발급)

### 설치 방법 (Installation)

1.  저장소 클론 (Clone):
    ```bash
    git clone <repository-url>
    cd <project-directory>
    ```

2.  의존성 설치 (Install dependencies):
    ```bash
    npm install
    ```

3.  환경 변수 설정:
    루트 경로에 `.env.local` 파일을 생성하고 API 키를 입력하세요:
    ```env
    API_KEY = asdkfihawelrf....  
    API_ENABLED=true
    ```

### 실행 방법 (Running the Application)

이 애플리케이션은 React 프론트엔드와 Node.js API 서버로 구성되어 있습니다. 두 가지를 모두 실행해야 합니다.


1.  **백엔드 서버 실행**:
    터미널을 열고 다음 명령어를 입력합니다:
    ```bash
    npx tsx server.ts
    ```
    서버가 `http://localhost:3001`에서 시작됩니다.

2.  **프론트엔드 실행**:
    **새로운** 터미널을 열고 다음 명령어를 입력합니다:
    ```bash
    npm run dev
    ```
    프론트엔드는 `http://localhost:3000`에서 접속할 수 있습니다. ctrl + 클릭으로 접속하세요

## 📂 프로젝트 구조 (Project Structure)

- `api/`: 백엔드 API 로직 (모듈화됨).
    - `_handlers/`: 개별 API 핸들러 (검증, 커리큘럼, 교수진 등).
    - `_agents.ts`: 팩트 체크 및 포맷팅을 위한 AI 에이전트 로직.
    - `_config.ts`: 설정 및 상수.
- `components/`: React UI 컴포넌트.
- `services/`: 프론트엔드 API 호출 서비스.
- `server.ts`: Express/Node.js 서버 진입점.

## 🛠️ 기술 스택 (Tech Stack)

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Vercel Serverless Functions (호환), Google GenAI SDK
- **AI**: Google Gemini Models (Flash, Pro)

## 📝 라이선스

이 프로젝트는 교육 목적으로 제작되었습니다.
=======
1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
 terminal 1 : `npx tsx server.ts`
 terminal 2 : `npm run dev`
>>>>>>> a77f55b61b94ce13dd56d5fb32178796ada73a30
