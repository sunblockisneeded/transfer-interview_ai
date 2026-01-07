/**
 * Trends 모듈 프롬프트 실험
 *
 * 실행: npx tsx test/experiments/trends-experiment.ts
 *
 * 충남대학교 정치외교학과 면접 트렌드 분석 프롬프트 개선 실험
 *
 * 문제점:
 * 1. Contrary Thinking이 피상적 (단순 실패 사례 나열)
 * 2. 일반적인 조언 수준
 * 3. 학교 특화 정보 부족
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// .env.local에서 API 키 로드
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const MODEL_DEFAULT = 'gemini-3-flash-preview';
const MODEL_HIGH = 'gemini-3-pro-preview';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

// ===== 실험 설정 =====
const EXPERIMENT_CONFIG = {
  uni: "충남대학교",
  dept: "정치외교학과",
  targetYear: currentYear,
  targetSchoolYear: `${currentYear}학년도 또는 ${currentYear + 1}학번`
};

// ===== 유틸리티 =====

const timeContext = `
당신의 학습 데이터는 2024년까지입니다. 이후의 정보는 도구나 시스템 메시지로 제공되지 않는 한 알 수 없습니다.
현재 시점: ${currentYear}년 ${currentMonth}월
대상 학년도: ${EXPERIMENT_CONFIG.targetSchoolYear}
`;

const timeContextEnglish = `
Your training data is reliable up to 2024. You must treat this as your knowledge cutoff:
you should not assume you know anything about events, releases, or facts after this date unless they are explicitly provided by tools or system messages.
The current time is ${currentYear} - ${currentMonth}.`;

// 결과 저장
const saveResult = (filename: string, result: any) => {
  const dir = path.join(process.cwd(), 'test', 'results');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`결과 저장: ${filepath}`);
};

// ===== 기존 프롬프트 (현재 api/_handlers/trends.ts에서 사용 중) =====

const getOldPrompt = () => {
  const { uni, dept } = EXPERIMENT_CONFIG;

  return `
    Analyze transfer interview trends for ${dept} at ${uni}.
    Output MUST be in Korean.
    무의식적인 자기소개서나 학업계획서에 대한 언급을 피하세요. 자기소개서나 학업계획서가 현재 학년도의 편입 제출 서류에 확실히 포함될때만 언급하세요.
    [Temporal Context]
    ${timeContextEnglish}
    check whether the informations are correct based on current time.
    check information could be applied ${currentYear} or ${currentYear + 1}학번.

    Structure your response with these EXACT headers:

    # 5. ${dept} 합격 사례 분석
    - General trends in successful transfer interviews for this major (Any university).

    # 6. ${uni} ${dept} 합격 사례 및 꿀팁
    - Specific tips, hacks, or unique features of this university's interview process.
    - check if it is the ${currentYear} or ${currentYear + 1} school year.

    # 7. ${dept} 불합격 사례 및 주의사항
    - use Charlie Munger's Contrary Thinking method.
    - Common reasons for rejection in this field (General).
    - Analyze how to fail to understand how to succeed.

    # 8. ${dept} 실전 면접 대비 사례
    - Find real-world industry cases or academic case studies relevant to this major.
  `;
};

// ===== 개선 프롬프트 =====

const getImprovedPrompt = () => {
  const { uni, dept, targetSchoolYear } = EXPERIMENT_CONFIG;

  return `
[역할] 당신은 편입 면접 트렌드 분석 전문가입니다.

[시간 컨텍스트]
현재: ${currentYear}년 ${currentMonth}월
대상: ${targetSchoolYear} 편입
주의: 자기소개서/학업계획서는 해당 학년도 제출 서류에 확실히 포함될 때만 언급하세요.

[분석 대상]
${uni} ${dept}

---

# 5. ${dept} 합격 사례 분석

[작업 1: 합격 사례 검색 및 분석]
검색 키워드: "${dept} 편입 합격 후기", "${dept} 면접 합격", "정치외교 편입 성공"

다음 구조로 정리하세요:
## 5.1 합격자 공통 특성
- 학업 배경 (전적대 전공, 학점 등)
- 면접 준비 기간 및 방법
- 답변 스타일 특징

## 5.2 성공 요인 분석
| 성공 요인 | 구체적 사례 | 적용 팁 |
|----------|------------|--------|
| ... | ... | ... |

## 5.3 합격자가 공유한 실전 조언
실제 합격 후기에서 발췌한 핵심 조언을 인용하세요.

---

# 6. ${uni} ${dept} 특화 정보

[작업 2: 학교 특화 정보 검색]
검색 키워드: "${uni} ${dept} 면접", "${uni} 편입 면접 후기", "충남대 정치외교 편입"

## 6.1 ${uni} ${dept} 면접 특징
- 면접 형식 (개별/집단, 시간, 면접관 수)
- 분위기 (압박 여부, 질문 스타일)
- 최근 기출 경향

## 6.2 충남대 특화 꿀팁
- ${uni} 정치외교학과만의 특징 (교수진, 커리큘럼, 연구 분야)
- 면접에서 어필할 수 있는 학과 특성
- 피해야 할 실수 (학교 관련)

## 6.3 체크리스트
- [ ] 충남대 ${dept} 교수진 연구 분야 파악
- [ ] 학과 커리큘럼 특징 숙지
- [ ] 지역 특화 이슈 (대전/충남 관련) 준비

---

# 7. ${dept} 불합격 사례 및 Contrary Thinking

[작업 3: Charlie Munger의 역발상 분석]
핵심 질문: "어떻게 하면 ${dept} 편입 면접에서 **확실히 떨어질 수** 있을까?"

## 7.1 치명적 실수 (Instant Fail)
면접장에서 하는 순간 탈락이 확정되는 행동/발언:

| 실수 유형 | 구체적 예시 | 왜 치명적인가 |
|----------|------------|--------------|
| 전공 무지 | "정치학이 뭔지 잘 모르겠어요" | 기본 열정/준비 의심 |
| 시사 무관심 | "뉴스는 안 봐요" | 정치외교 전공 부적합 |
| 학교 무관심 | "다른 학교도 넣었어요" | 진정성 의심 |
| ... | ... | ... |

## 7.2 흔한 실패 패턴 (Common Pitfalls)
불합격자의 70%가 보이는 공통점:

**답변 내용의 문제:**
-
-

**태도/자세의 문제:**
-
-

**준비 부족의 징후:**
-
-

## 7.3 역전 전략표 (Inversion Table)
| 실패 행동 | 역전 전략 | 구체적 실행 방법 |
|----------|----------|----------------|
| "정치에 관심 없어요" | 구체적 관심 분야 제시 | "한미동맹 변화에 관심이 있어 XXX 논문을 읽었습니다" |
| "취업 때문에 왔어요" | 학문적 동기 강조 | "XX 현상을 학문적으로 분석하고 싶어 지원했습니다" |
| ... | ... | ... |

---

# 8. ${dept} 실전 면접 대비

[작업 4: 실전 대비 자료]

## 8.1 예상 질문 유형
정치외교학과 면접에서 자주 출제되는 질문 패턴:

**기초 개념 질문:**
-

**시사/이슈 질문:**
-

**개인 경험 질문:**
-

## 8.2 최근 시사 이슈 (${currentYear}년 기준)
면접에 출제될 가능성이 높은 이슈:
- 국제정치:
- 국내정치:
- 외교:

## 8.3 답변 프레임워크
정치외교학과 면접 답변의 기본 구조:
1.
2.
3.

---

[출력 규칙]
- 마크다운만 사용, HTML 태그 금지
- 검색 기반 정보만 작성, 추측 금지
- ${currentYear}년 기준 최신 정보
- 구체적 예시와 실용적 조언 중심
`;
};

// ===== 실험 실행 =====

const runExperiment = async () => {
  console.log('='.repeat(60));
  console.log('Trends 모듈 프롬프트 실험');
  console.log(`대상: ${EXPERIMENT_CONFIG.uni} ${EXPERIMENT_CONFIG.dept}`);
  console.log(`모델: ${MODEL_DEFAULT}`);
  console.log('='.repeat(60));

  if (!apiKey) {
    console.log('\n⚠️ API_KEY가 설정되지 않았습니다.');
    console.log('API 실험을 실행하려면 환경변수를 설정하세요:');
    console.log('  export API_KEY=your_api_key');

    // API 키 없이도 프롬프트 비교는 저장
    const promptComparison = {
      experiment: 'trends_prompt_comparison',
      timestamp: new Date().toISOString(),
      config: EXPERIMENT_CONFIG,
      prompts: {
        old: {
          description: '기존 프롬프트 (영어 혼합, 구조 부족)',
          length: getOldPrompt().length,
          content: getOldPrompt()
        },
        improved: {
          description: '개선 프롬프트 (한국어, 상세 구조, Contrary Thinking 강화)',
          length: getImprovedPrompt().length,
          content: getImprovedPrompt()
        }
      },
      improvements: [
        '역할 명시: 편입 면접 트렌드 분석 전문가',
        '시간 컨텍스트 한국어화',
        '합격 사례 분석 구조화 (공통 특성, 성공 요인, 실전 조언)',
        '학교 특화 정보 섹션 강화 (면접 특징, 꿀팁, 체크리스트)',
        'Contrary Thinking 프레임워크 상세화 (치명적 실수, 흔한 패턴, 역전 전략표)',
        '실전 대비 섹션 추가 (예상 질문, 시사 이슈, 답변 프레임워크)',
        '출력 규칙 명시 (마크다운만, HTML 금지)'
      ],
      apiKeyMissing: true,
      note: 'API 키가 없어 프롬프트 비교만 저장됨. 실제 실험 결과는 API 키 설정 후 재실행 필요.'
    };

    saveResult('trends_result.json', promptComparison);
    return;
  }

  const results: any = {
    experiment: 'trends_module',
    timestamp: new Date().toISOString(),
    config: EXPERIMENT_CONFIG,
    model: MODEL_DEFAULT
  };

  try {
    // 1. 기존 프롬프트 실행
    console.log('\n[1/2] 기존 프롬프트 실행 중...');
    const oldPrompt = getOldPrompt();
    const oldStartTime = Date.now();

    const oldResponse = await ai.models.generateContent({
      model: MODEL_DEFAULT,
      contents: oldPrompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const oldDuration = Date.now() - oldStartTime;
    console.log(`  완료 (${(oldDuration / 1000).toFixed(1)}초)`);

    results.old = {
      prompt: oldPrompt,
      promptLength: oldPrompt.length,
      response: oldResponse.text,
      responseLength: oldResponse.text?.length || 0,
      duration: oldDuration
    };

    // API 호출 간 딜레이
    console.log('  API 딜레이 (3초)...');
    await new Promise(r => setTimeout(r, 3000));

    // 2. 개선 프롬프트 실행
    console.log('\n[2/2] 개선 프롬프트 실행 중...');
    const improvedPrompt = getImprovedPrompt();
    const improvedStartTime = Date.now();

    const improvedResponse = await ai.models.generateContent({
      model: MODEL_DEFAULT,
      contents: improvedPrompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const improvedDuration = Date.now() - improvedStartTime;
    console.log(`  완료 (${(improvedDuration / 1000).toFixed(1)}초)`);

    results.improved = {
      prompt: improvedPrompt,
      promptLength: improvedPrompt.length,
      response: improvedResponse.text,
      responseLength: improvedResponse.text?.length || 0,
      duration: improvedDuration
    };

    // 3. 분석
    results.analysis = {
      promptLengthIncrease: `${((improvedPrompt.length / oldPrompt.length - 1) * 100).toFixed(0)}%`,
      responseLengthChange: results.improved.responseLength - results.old.responseLength,
      durationChange: results.improved.duration - results.old.duration
    };

    // 4. 품질 평가 지표
    results.qualityMetrics = {
      old: analyzeResponse(results.old.response),
      improved: analyzeResponse(results.improved.response)
    };

    // 결과 저장
    saveResult('trends_result.json', results);

    // 콘솔 출력
    console.log('\n' + '='.repeat(60));
    console.log('실험 결과 요약');
    console.log('='.repeat(60));

    console.log('\n[기존 프롬프트 결과]');
    console.log(`  응답 길이: ${results.old.responseLength}자`);
    console.log(`  소요 시간: ${(results.old.duration / 1000).toFixed(1)}초`);
    console.log(`  품질 지표:`, results.qualityMetrics.old);

    console.log('\n[개선 프롬프트 결과]');
    console.log(`  응답 길이: ${results.improved.responseLength}자`);
    console.log(`  소요 시간: ${(results.improved.duration / 1000).toFixed(1)}초`);
    console.log(`  품질 지표:`, results.qualityMetrics.improved);

    console.log('\n[비교]');
    console.log(`  프롬프트 길이 증가: ${results.analysis.promptLengthIncrease}`);
    console.log(`  응답 길이 변화: ${results.analysis.responseLengthChange > 0 ? '+' : ''}${results.analysis.responseLengthChange}자`);

    // 샘플 출력
    console.log('\n' + '-'.repeat(60));
    console.log('기존 프롬프트 응답 (처음 1000자):');
    console.log('-'.repeat(60));
    console.log(results.old.response?.substring(0, 1000));

    console.log('\n' + '-'.repeat(60));
    console.log('개선 프롬프트 응답 (처음 1000자):');
    console.log('-'.repeat(60));
    console.log(results.improved.response?.substring(0, 1000));

  } catch (error: any) {
    console.error('실험 실패:', error.message);
    results.error = error.message;
    saveResult('trends_result.json', results);
  }
};

// 응답 품질 분석 함수
const analyzeResponse = (text: string | undefined): any => {
  if (!text) return { error: 'No response' };

  return {
    // 구조화 지표
    hasHeaders: (text.match(/^#+\s/gm) || []).length,
    hasTables: (text.match(/\|.*\|/g) || []).length > 2,
    hasLists: (text.match(/^[-*]\s/gm) || []).length,
    hasCheckboxes: (text.match(/\[ \]/g) || []).length,

    // 내용 품질 지표
    hasSpecificExamples: /예시|예를 들|예:|예\)/i.test(text),
    hasContraryThinking: /역발상|역전|Contrary|Munger|실패|떨어질/i.test(text),
    hasSchoolSpecific: /충남대|충남대학교/g.test(text),

    // 형식 지표
    hasHtmlTags: /<[^>]+>/.test(text),
    hasCitations: /\[cite:/i.test(text),

    // 길이 분석
    wordCount: text.split(/\s+/).length,
    paragraphCount: text.split(/\n\n+/).length
  };
};

// 메인 실행
runExperiment().catch(console.error);
