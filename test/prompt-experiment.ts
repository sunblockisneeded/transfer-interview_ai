/**
 * 프롬프트 실험 파일
 *
 * 실행: npx tsx test/prompt-experiment.ts
 *
 * 각 실험별로 기존 vs 개선 프롬프트를 비교합니다.
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';

// 환경변수에서 API 키 로드
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const MODEL_DEFAULT = 'gemini-3-flash-preview';
const MODEL_HIGH = 'gemini-3-pro-preview';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

// ===== 유틸리티 =====

const timeContext = `
당신의 학습 데이터는 2024년까지입니다. 이후의 정보는 도구나 시스템 메시지로 제공되지 않는 한 알 수 없습니다.
현재 시점: ${currentYear}년 ${currentMonth}월
대상 학년도: ${currentYear}년 또는 ${currentYear + 1}학번
`;

// 후처리 함수 (개선안)
const cleanOutput = (text: string): string => {
  return text
    // [cite: ...] 제거
    .replace(/\[cite:\s*[\d,\s]+(?:from previous turn)?\]/gi, '')
    // 인라인 스타일 HTML 태그를 마크다운으로 변환
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:strong|b)>/gi, '**')
    .replace(/<\/?(?:em|i)>/gi, '*')
    .replace(/<li>(.*?)<\/li>/gi, '- $1')
    .replace(/<ul[^>]*>|<\/ul>/gi, '')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n')
    .replace(/<[^>]+>/g, '') // 나머지 HTML 태그 제거
    .replace(/\n{3,}/g, '\n\n') // 과도한 줄바꿈 정리
    .trim();
};

// 결과 저장
const saveResult = (name: string, result: any) => {
  const dir = './test/results';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `${dir}/${name}_${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`결과 저장: ${filename}`);
};

// ===== 실험 1: 교수 분석 프롬프트 =====

const experimentProfessor = async () => {
  const uni = "충남대학교";
  const dept = "정치외교학과";
  const professorName = "박영득";

  // 기존 프롬프트
  const oldPrompt = `
    Analyze professor "${professorName}" from ${uni} ${dept}.
    Output MUST be in Korean.

    [Temporal Context]
    ${timeContext}

    Return ONLY a JSON object:
    {
      "name": "${professorName}",
      "lab": "Lab Name (or 'Unknown')",
      "contact": "Email or Office (or 'Unknown')",
      "researchTendency": "One sentence summary of research focus (ends with ~하는 경향이 있음)",
      "majorPapers": ["Paper 1", "Paper 2", "Paper 3"],
      "details": "Brief description of their academic background or specific interests"
    }
  `;

  // 개선 프롬프트
  const newPrompt = `
[역할]
당신은 한국 대학 교수 정보 분석 전문가입니다.

[시간 컨텍스트]
${timeContext}

[분석 대상]
- 대학: ${uni}
- 학과: ${dept}
- 교수명: ${professorName}

[작업]
해당 교수의 연구 활동을 분석하세요.

[신뢰도 규칙]
- 검색으로 확인된 정보만 포함
- 확인 불가 정보는 "확인 필요" 또는 null로 표시
- 추측, 일반화 금지
- 구체적 논문명, 연구실명은 출처 확인 후에만 작성

[출력 형식]
JSON 형식으로만 응답:
{
  "name": "${professorName}",
  "lab": "연구실명 (확인 불가시 null)",
  "contact": "이메일 또는 연락처 (확인 불가시 null)",
  "researchTendency": "주요 연구 분야를 구체적으로 서술. 예: '미중 관계와 동북아 안보를 중심으로 국제정치를 연구'",
  "majorPapers": ["확인된 논문 제목만 포함. 없으면 빈 배열"],
  "details": "학력, 경력 등 확인된 배경 정보",
  "confidence": "high/medium/low - 정보 신뢰도"
}
`;

  console.log('\n===== 실험 1: 교수 분석 =====\n');

  try {
    // 기존 프롬프트 실행
    console.log('기존 프롬프트 실행 중...');
    const oldResult = await ai.models.generateContent({
      model: MODEL_DEFAULT,
      contents: oldPrompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    // 개선 프롬프트 실행
    console.log('개선 프롬프트 실행 중...');
    const newResult = await ai.models.generateContent({
      model: MODEL_DEFAULT,
      contents: newPrompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const result = {
      experiment: 'professor_analysis',
      professor: professorName,
      old: {
        prompt: oldPrompt.substring(0, 200) + '...',
        response: oldResult.text
      },
      new: {
        prompt: newPrompt.substring(0, 200) + '...',
        response: newResult.text
      }
    };

    saveResult('professor', result);

    console.log('\n[기존 결과]');
    console.log(oldResult.text?.substring(0, 500));
    console.log('\n[개선 결과]');
    console.log(newResult.text?.substring(0, 500));

    return result;
  } catch (e) {
    console.error('실험 1 실패:', e);
  }
};

// ===== 실험 2: Contrary Thinking (불합격 분석) =====

const experimentContraryThinking = async () => {
  const dept = "정치외교학과";

  // 기존 프롬프트
  const oldPrompt = `
    # 7. ${dept} 불합격 사례 및 주의사항
    - use Charlie Munger's Contrary Thinking method.
    - Common reasons for rejection in this field (General).
    - Analyze how to fail to understand how to succeed.

    Output MUST be in Korean.
  `;

  // 개선 프롬프트
  const newPrompt = `
[역할]
당신은 편입 면접 불합격 사례 분석 전문가입니다.

[분석 대상]
${dept} 편입 면접

[Contrary Thinking 프레임워크]
Charlie Munger의 역발상 사고법을 적용합니다.
핵심 질문: "어떻게 하면 ${dept} 면접에서 확실히 떨어질 수 있을까?"

[작업]
다음 3단계로 분석하세요:

## 1. 치명적 실수 (Instant Fail)
면접장에서 절대 하면 안 되는 행동이나 답변을 구체적으로 나열하세요.
예: "정치에 관심 없는데 취업 때문에 왔다고 말하기"

## 2. 흔한 실패 패턴 (Common Pitfalls)
대부분의 불합격자가 보이는 공통점을 분석하세요.
- 답변 내용의 문제
- 태도/자세의 문제
- 준비 부족의 징후

## 3. 역전 전략 (Inversion)
위의 각 실패 요인을 정반대로 뒤집어 성공 전략을 도출하세요.
| 실패 요인 | 역전 전략 |
|----------|----------|
| ... | ... |

[출력 규칙]
- 한국어로 작성
- 구체적인 예시 포함
- 추상적 조언 지양
`;

  console.log('\n===== 실험 2: Contrary Thinking =====\n');

  try {
    console.log('기존 프롬프트 실행 중...');
    const oldResult = await ai.models.generateContent({
      model: MODEL_DEFAULT,
      contents: oldPrompt
    });

    console.log('개선 프롬프트 실행 중...');
    const newResult = await ai.models.generateContent({
      model: MODEL_DEFAULT,
      contents: newPrompt
    });

    const result = {
      experiment: 'contrary_thinking',
      old: {
        prompt: oldPrompt,
        response: oldResult.text
      },
      new: {
        prompt: newPrompt,
        response: newResult.text
      }
    };

    saveResult('contrary_thinking', result);

    console.log('\n[기존 결과 (처음 800자)]');
    console.log(oldResult.text?.substring(0, 800));
    console.log('\n[개선 결과 (처음 800자)]');
    console.log(newResult.text?.substring(0, 800));

    return result;
  } catch (e) {
    console.error('실험 2 실패:', e);
  }
};

// ===== 실험 3: 예상 질문 생성 =====

const experimentQuestions = async () => {
  const uni = "충남대학교";
  const dept = "정치외교학과";

  // 샘플 커리큘럼 데이터
  const sampleCurriculum = `
1-2학년 핵심 과목:
- 정치학원론: 정치현상 전반에 대한 기초적인 개념과 이론
- 세계정치론: 국제 관계의 기본 이론과 주요 이슈
- 비교정치론: 다양한 국가의 정치 체제 비교 분석
- 정치학방법론: 정치 현상을 과학적으로 분석하기 위한 연구 방법론
- 계량정치분석: R 프로그래밍을 활용한 정치 데이터 분석

교육 트렌드:
- 데이터 분석 및 계량적 방법론 강조
- AI와 디지털 국가책략
- 첨단기술 외교 및 데이터 지정학
`;

  // 기존 프롬프트
  const oldPrompt = `
    Act as a Top-Tier Transfer Interview Question Generator for ${uni} ${dept}.
    Output MUST be in Korean.

    Input Data (Summarized):
    ${sampleCurriculum}

    Tasks:
    3. Generate 9 + 3(high 꼬리질문) Anticipated Questions based on the data.
       - 'high': High difficulty questions - deeply related to major. 각각 1개의 꼬리 질문 추가.
       - 'medium': Medium difficulty questions - related to major.
       - 'low': Low difficulty questions - basic knowledge, why this school?
  `;

  // 개선 프롬프트
  const newPrompt = `
[역할]
당신은 ${uni} ${dept} 편입 면접 출제위원입니다.
실제 면접에서 교수가 물어볼 법한 질문을 생성합니다.

[입력 데이터: 학과 커리큘럼]
${sampleCurriculum}

[질문 생성 규칙]

### HIGH 난이도 (3개 + 각각 꼬리질문 1개)
- 위 커리큘럼의 핵심 과목(정치학원론, 세계정치론 등)에서 직접 출제
- 이론 적용, 사례 분석, 비판적 사고 요구
- 꼬리질문: 첫 답변을 심화하거나, 반대 관점에서 재질문

예시 형식:
Q: [정치학원론] 권력의 정당성과 합법성의 차이를 설명하고, 현대 민주주의에서 이 둘이 충돌하는 사례를 들어보세요.
→ 꼬리질문: 그렇다면 정당성 없는 합법적 권력은 어떻게 유지될 수 있을까요?

### MEDIUM 난이도 (3개)
- 전공 기초 개념의 정의, 비교, 설명
- 1-2학년 수업에서 다루는 내용 수준

예시: "이상주의와 현실주의 국제정치 이론의 핵심 차이점은 무엇인가요?"

### LOW 난이도 (3개)
- 지원 동기, 학과 선택 이유
- 기초 상식 (정치/외교란 무엇인가)
- 학업 계획

예시: "왜 ${uni} ${dept}에 편입하고 싶으신가요?"

[출력 형식]
각 질문마다:
{
  "question": "질문 내용",
  "intent": "출제 의도 (1줄)",
  "tip": "답변 팁 (1-2줄)",
  "followUp": "꼬리질문 (HIGH만 해당, 나머지는 null)"
}

JSON 배열로 출력:
{
  "high": [...],
  "medium": [...],
  "low": [...]
}
`;

  console.log('\n===== 실험 3: 예상 질문 생성 =====\n');

  try {
    console.log('기존 프롬프트 실행 중...');
    const oldResult = await ai.models.generateContent({
      model: MODEL_HIGH, // 복잡한 작업은 Pro 모델
      contents: oldPrompt,
      config: { responseMimeType: "application/json" }
    });

    console.log('개선 프롬프트 실행 중...');
    const newResult = await ai.models.generateContent({
      model: MODEL_HIGH,
      contents: newPrompt,
      config: { responseMimeType: "application/json" }
    });

    const result = {
      experiment: 'question_generation',
      old: {
        prompt: oldPrompt.substring(0, 300) + '...',
        response: oldResult.text
      },
      new: {
        prompt: newPrompt.substring(0, 300) + '...',
        response: newResult.text
      }
    };

    saveResult('questions', result);

    console.log('\n[기존 결과]');
    console.log(oldResult.text?.substring(0, 1000));
    console.log('\n[개선 결과]');
    console.log(newResult.text?.substring(0, 1000));

    return result;
  } catch (e) {
    console.error('실험 3 실패:', e);
  }
};

// ===== 실험 4: 후처리 테스트 =====

const experimentCleanup = () => {
  console.log('\n===== 실험 4: 후처리 함수 테스트 =====\n');

  const sampleDirtyText = `
<h1 style="font-family: 'Noto Serif KR', serif; font-size: 24px; color: #1e1b4b;">1. 충남대학교 정치외교학과 교과과정 분석</h1><br><br>
충남대학교 정치외교학과는 세방화 시대에 발맞춰 지방 공동체에 기여합니다. [cite: 2, 9 from previous turn]
<br><br>
<strong>핵심 과목</strong>
<ul>
<li>정치학원론</li>
<li>세계정치론</li>
</ul>
박영득 교수는 정치외교학을 연구합니다. [cite: 5]
`;

  const cleanedText = cleanOutput(sampleDirtyText);

  console.log('[원본 텍스트]');
  console.log(sampleDirtyText);
  console.log('\n[정리된 텍스트]');
  console.log(cleanedText);

  // 검증
  const hasCite = cleanedText.includes('[cite:');
  const hasHtmlTag = /<[^>]+>/.test(cleanedText);

  console.log('\n[검증 결과]');
  console.log(`- [cite:] 제거됨: ${!hasCite ? '✓' : '✗'}`);
  console.log(`- HTML 태그 제거됨: ${!hasHtmlTag ? '✓' : '✗'}`);

  return { original: sampleDirtyText, cleaned: cleanedText, passed: !hasCite && !hasHtmlTag };
};

// ===== 메인 실행 =====

const main = async () => {
  console.log('='.repeat(50));
  console.log('프롬프트 실험 시작');
  console.log(`모델: DEFAULT=${MODEL_DEFAULT}, HIGH=${MODEL_HIGH}`);
  console.log('='.repeat(50));

  // 실험 4는 API 호출 없이 바로 테스트
  experimentCleanup();

  // API 키가 있을 때만 API 실험 실행
  if (!apiKey) {
    console.log('\n⚠️ API_KEY가 설정되지 않았습니다.');
    console.log('API 실험을 실행하려면 환경변수를 설정하세요:');
    console.log('  export API_KEY=your_api_key');
    return;
  }

  // 원하는 실험만 실행 (주석 해제)
  // await experimentProfessor();
  // await experimentContraryThinking();
  // await experimentQuestions();

  // 모든 실험 실행
  const experiments = [
    experimentProfessor,
    experimentContraryThinking,
    experimentQuestions
  ];

  for (const exp of experiments) {
    try {
      await exp();
      // API 호출 간 딜레이
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error('실험 실패:', e);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('모든 실험 완료');
  console.log('결과는 test/results/ 폴더에서 확인하세요.');
  console.log('='.repeat(50));
};

main().catch(console.error);
