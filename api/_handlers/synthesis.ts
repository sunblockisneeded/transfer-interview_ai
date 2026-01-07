import { Type, Schema } from "@google/genai";
import type { VercelResponse } from '@vercel/node';
import { ai, MODEL_SYNTHESIS, currentYear, currentMonth } from '../_config.js';
import { generateContentWithSmartRetry, cleanOutput, parseJsonSafe } from '../_utils.js';

/**
 * 텍스트에서 핵심 정보만 추출 (스마트 압축)
 * - 헤더와 주요 내용만 유지
 * - 반복/장황한 부분 제거
 */
const extractKeyContent = (text: string, maxLength: number = 3000): string => {
    if (!text || text.length <= maxLength) return text;

    // 1. 마크다운 헤더 기준으로 섹션 분리
    const sections = text.split(/(?=^#+ )/m);

    // 2. 각 섹션에서 핵심 내용만 추출 (첫 500자)
    const condensed = sections.map(section => {
        const lines = section.split('\n').filter(l => l.trim());
        // 헤더는 유지
        const header = lines.find(l => l.startsWith('#')) || '';
        // 불릿 포인트 우선 추출
        const bullets = lines.filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'));
        // 나머지 내용
        const content = lines.filter(l => !l.startsWith('#') && !l.startsWith('-') && !l.startsWith('*'));

        return [
            header,
            ...bullets.slice(0, 5),
            ...content.slice(0, 3)
        ].join('\n');
    });

    const result = condensed.join('\n\n');

    // 3. 최종 길이 제한
    return result.length > maxLength ? result.substring(0, maxLength) + '\n...(압축됨)' : result;
};

export async function handleSynthesis(payload: any, res: VercelResponse) {
    const { uni, dept, curriculum, trends, config } = payload;
    // Note: professors는 이제 전략/질문 생성에 사용하지 않음 (overfit 방지)

    const model = config?.model || MODEL_SYNTHESIS;

    // 스마트 Context 생성 (교수진 제외 - 1-2학년 교과서 수준에 집중)
    const context = `
[1-2학년 핵심 전공 과목]
${extractKeyContent(curriculum, 2500)}

[면접 기출 및 합격 사례]
${extractKeyContent(trends, 1500)}
`.trim();

    const strategyPrompt = `
[역할] 당신은 ${uni} ${dept} 편입 면접 전략 수립 전문가입니다.

[시간 컨텍스트]
현재: ${currentYear}년 ${currentMonth}월
대상 학년도: ${currentYear}년 또는 ${currentYear + 1}학번

[분석 데이터]
${context}

---

[작업 1: 종합 면접 준비 전략 (coreStrategy)]

다음 원칙을 따라 종합 전략을 작성하세요:

**핵심 원칙:**
1. 커리큘럼(1-2학년 전공 기초 지식)과 합격 사례를 중심으로 전략 수립
2. 교과서 수준의 기본 개념에 집중 (편입 면접 = 3학년 수업 따라갈 기초 역량 확인)
3. "무엇을 알아야 하는가" + "어떻게 답변해야 하는가"를 통합

**확인 사항:**
- ${currentYear}년 또는 ${currentYear + 1}학번 기준 편입 전형 확인
- 면접 전형이 없거나 서류/지필만 있는 경우 명시
- 자기소개서/학업계획서는 실제 제출 서류에 포함될 때만 언급

**전략 구성:**
1. 전공 기초 지식 준비 방향
2. 면접 답변 핵심 프레임워크
3. 학과 특화 어필 포인트
4. D-Day 체크리스트

---

[작업 2: 핵심 개념 5개 (coreConcepts)]

⚠️ **중요: 반드시 정확히 5개의 개념을 생성해야 합니다. 5개 미만은 불가.**

**규칙:**
- keyword: 짧은 단어/구 (최대 5단어, 예: "민주주의", "STP전략", "재무제표")
- 교수명 절대 포함 금지
- 1-2학년 교과서에 나오는 기본 개념 기반으로 선정
- 특정 교수 연구 분야가 아닌 학과 공통 핵심 개념
- 모든 필드(keyword, description, example)는 비어있으면 안 됨

**각 개념 구조 (5개 모두 필수):**
- keyword: 핵심 키워드 (짧게, 필수)
- description: 개념 상세 설명 100자 이상 (면접에서 어떻게 설명할지, 필수)
- example: 실제 사례/응용 예시 50자 이상 (구체적인 사례나 뉴스, 필수)
`;

    const questionsPrompt = `
[역할] 당신은 ${uni} ${dept} 편입 면접 예상 질문 생성 전문가입니다.

[분석 데이터]
${context}

---

[작업: 예상 질문 생성]

난이도별로 정확히 3개씩 질문을 생성하세요.

## high (상위 난이도) - 3개 + 꼬리질문
**특징:**
- 전공 심화 지식 또는 시사 연결 질문
- 1-2학년 커리큘럼 기반 (너무 과하지 않게)
- 각 질문에 꼬리질문 1개씩 추가

**질문 예시 유형:**
- "XX 이론을 현재 YY 상황에 어떻게 적용할 수 있을까요?"
- "XX 개념과 YY 개념의 차이점은 무엇인가요?"

## medium (중위 난이도) - 3개
**특징:**
- 전공 기초 개념 설명 질문
- 교과서 수준의 이론 질문

**질문 예시 유형:**
- "XX란 무엇인가요?"
- "XX 이론의 핵심 주장은 무엇인가요?"

## low (하위 난이도) - 3개 (필수)
**특징:**
- 기본 지식, 지원 동기
- 학과 선택 이유

**필수 포함 질문:**
- "왜 다른 학교가 아닌 ${uni} ${dept}에 지원했나요?"
- 전공 기초 용어 정의

---

**각 질문 구조:**
- question: 실제 면접 질문
- intent: 교수가 이 질문을 통해 확인하려는 것
- tip: 답변 시 유의할 점 또는 핵심 포인트
`;

    const strategySchema: Schema = {
        type: Type.OBJECT,
        properties: {
            coreStrategy: { type: Type.STRING, description: "종합 면접 전략 (300자 이상)" },
            coreConcepts: {
                type: Type.ARRAY,
                description: "핵심 개념 5개 (반드시 5개)",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        keyword: { type: Type.STRING, description: "핵심 키워드 (최대 5단어, 교수명 금지)" },
                        description: { type: Type.STRING, description: "개념 상세 설명 (100자 이상)" },
                        example: { type: Type.STRING, description: "실제 사례 또는 적용 예시 (50자 이상)" },
                    },
                    required: ["keyword", "description", "example"],
                },
            },
        },
        required: ["coreStrategy", "coreConcepts"],
    };

    const questionsSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            questions: {
                type: Type.OBJECT,
                properties: {
                    high: {
                        type: Type.ARRAY,
                        description: "상위 난이도 질문 3개 (필수)",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING, description: "면접 질문" },
                                intent: { type: Type.STRING, description: "질문 의도" },
                                tip: { type: Type.STRING, description: "답변 팁" },
                            },
                            required: ["question", "intent", "tip"],
                        },
                    },
                    medium: {
                        type: Type.ARRAY,
                        description: "중위 난이도 질문 3개 (필수)",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING, description: "면접 질문" },
                                intent: { type: Type.STRING, description: "질문 의도" },
                                tip: { type: Type.STRING, description: "답변 팁" },
                            },
                            required: ["question", "intent", "tip"],
                        },
                    },
                    low: {
                        type: Type.ARRAY,
                        description: "하위 난이도 질문 3개 (필수, 기본 지식/지원 동기)",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING, description: "면접 질문" },
                                intent: { type: Type.STRING, description: "질문 의도" },
                                tip: { type: Type.STRING, description: "답변 팁" },
                            },
                            required: ["question", "intent", "tip"],
                        },
                    },
                },
                required: ["high", "medium", "low"],
            },
        },
        required: ["questions"],
    };

    const attemptStrategy = async () => {
        return generateContentWithSmartRetry(
            ai.models,
            model,
            strategyPrompt,
            {
                responseMimeType: "application/json",
                responseSchema: strategySchema,
            },
            config?.timeout ? config.timeout : undefined,
            "Final Synthesis - Strategy" // Task Name
        );
    };

    const attemptQuestions = async () => {
        return generateContentWithSmartRetry(
            ai.models,
            model,
            questionsPrompt,
            {
                responseMimeType: "application/json",
                responseSchema: questionsSchema,
            },
            config?.timeout ? config.timeout : undefined,
            "Final Synthesis - Questions" // Task Name
        );
    };

    const subTask = payload.subTask || 'all'; // 'strategy', 'questions', or 'all'

    let strategyData: any = {};
    let questionsData: any = {};

    try {
        if (subTask === 'strategy') {
            const strategyResp = await attemptStrategy();
            strategyData = parseJsonSafe(strategyResp.text || "{}");
            return res.status(200).json(strategyData);
        }

        if (subTask === 'questions') {
            const questionsResp = await attemptQuestions();
            questionsData = parseJsonSafe(questionsResp.text || "{}");
            return res.status(200).json(questionsData);
        }

        // Default 'all' behavior (Parallel)
        const [strategyResp, questionsResp] = await Promise.all([
            attemptStrategy(),
            attemptQuestions()
        ]);

        strategyData = parseJsonSafe(strategyResp.text || "{}");
        questionsData = parseJsonSafe(questionsResp.text || "{}");

    } catch (e) {
        console.error('Synthesis failed after smart retries', e);
    }

    return res.status(200).json({
        coreStrategy: strategyData.coreStrategy || "전략을 생성하는 중 오류가 발생했습니다.",
        coreConcepts: Array.isArray(strategyData.coreConcepts) ? strategyData.coreConcepts : [],
        questions: {
            high: Array.isArray(questionsData.questions?.high) ? questionsData.questions.high : [],
            medium: Array.isArray(questionsData.questions?.medium) ? questionsData.questions.medium : [],
            low: Array.isArray(questionsData.questions?.low) ? questionsData.questions.low : []
        }
    });
}
