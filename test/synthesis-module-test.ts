/**
 * Synthesis 모듈 단독 테스트
 * - Core Concepts 5개 생성 확인
 * - description/example 필드 존재 확인
 * - Low Difficulty 질문 3개 생성 확인
 */

import { ai, MODEL_SYNTHESIS } from '../api/_config.js';
import { generateContentWithSmartRetry, parseJsonSafe } from '../api/_utils.js';
import { Type, Schema } from "@google/genai";

const testCases = [
    { uni: "충남대학교", dept: "정치외교학과" },
    { uni: "서울대학교", dept: "경제학부" },
];

// Mock data (실제 파이프라인에서 넘어오는 형태)
const mockPayload = {
    curriculum: `
## 1학년 교과목
- 정치학개론: 정치의 기본 개념과 이론
- 국제정치학개론: 국제관계의 기초 이론
- 한국정치론: 한국 정치 발전사

## 2학년 교과목
- 비교정치론: 각국 정치체제 비교
- 정치사상사: 고대부터 현대까지 정치사상
- 외교정책론: 외교 결정 과정과 이론
    `,
    professors: [
        { name: "김교수", researchTendency: "민주주의와 선거제도 연구" },
        { name: "이교수", researchTendency: "국제안보와 동아시아 지역연구" },
        { name: "박교수", researchTendency: "정치경제와 복지정책" },
    ],
    trends: `
## 최근 면접 경향
- 시사 이슈와 연결한 질문 증가
- 전공 기초 개념 설명 요구
- 지원 동기 및 학업 계획 질문

## 합격 사례
- 국제정세에 대한 자신만의 시각 제시
- 논리적 사고력 강조
    `,
};

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

async function testSynthesisModule(uni: string, dept: string) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🧪 Testing: ${uni} ${dept}`);
    console.log("=".repeat(60));

    const profSummary = mockPayload.professors
        .map((p: any) => `- ${p.name}: ${p.researchTendency}`)
        .join('\n');

    const context = `
[커리큘럼 분석]
${mockPayload.curriculum}

[면접 트렌드 및 합격 사례]
${mockPayload.trends}

[교수진 연구 분야]
${profSummary}
`.trim();

    // Strategy + Core Concepts 테스트
    const strategyPrompt = `
[역할] 당신은 ${uni} ${dept} 편입 면접 전략 수립 전문가입니다.

[시간 컨텍스트]
현재: ${currentYear}년 ${currentMonth}월
대상 학년도: ${currentYear}년 또는 ${currentYear + 1}학번

[분석 데이터]
${context}

---

[작업 1: 종합 면접 준비 전략 (coreStrategy)]
전략을 300자 이상으로 작성하세요.

---

[작업 2: 핵심 개념 5개 (coreConcepts)]

⚠️ **중요: 반드시 정확히 5개의 개념을 생성해야 합니다. 5개 미만은 불가.**

**규칙:**
- keyword: 짧은 단어/구 (최대 5단어)
- 교수명 절대 포함 금지
- 모든 필드(keyword, description, example)는 비어있으면 안 됨

**각 개념 구조 (5개 모두 필수):**
- keyword: 핵심 키워드 (짧게, 필수)
- description: 개념 상세 설명 100자 이상 (필수)
- example: 실제 사례/응용 예시 50자 이상 (필수)
`;

    const questionsPrompt = `
[역할] 당신은 ${uni} ${dept} 편입 면접 예상 질문 생성 전문가입니다.

[분석 데이터]
${context}

---

[작업: 예상 질문 생성]

난이도별로 정확히 3개씩 질문을 생성하세요.

## high (상위 난이도) - 정확히 3개
전공 심화 지식 또는 시사 연결 질문

## medium (중위 난이도) - 정확히 3개
전공 기초 개념 설명 질문

## low (하위 난이도) - 정확히 3개 ⚠️ 필수!
기본 지식, 지원 동기, 학과 선택 이유

**각 질문 구조:**
- question: 실제 면접 질문
- intent: 질문 의도
- tip: 답변 팁
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
                        keyword: { type: Type.STRING, description: "핵심 키워드" },
                        description: { type: Type.STRING, description: "개념 상세 설명 (100자 이상)" },
                        example: { type: Type.STRING, description: "실제 사례 (50자 이상)" },
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
                        description: "하위 난이도 질문 3개 (필수)",
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

    try {
        // 병렬 실행
        const [strategyResp, questionsResp] = await Promise.all([
            generateContentWithSmartRetry(
                ai.models,
                MODEL_SYNTHESIS,
                strategyPrompt,
                { responseMimeType: "application/json", responseSchema: strategySchema },
                60000,
                "Strategy Test"
            ),
            generateContentWithSmartRetry(
                ai.models,
                MODEL_SYNTHESIS,
                questionsPrompt,
                { responseMimeType: "application/json", responseSchema: questionsSchema },
                60000,
                "Questions Test"
            ),
        ]);

        const strategyData = parseJsonSafe(strategyResp.text || "{}");
        const questionsData = parseJsonSafe(questionsResp.text || "{}");

        // 결과 검증
        console.log("\n📊 검증 결과:");
        console.log("-".repeat(40));

        // Core Concepts 검증
        const concepts = strategyData.coreConcepts || [];
        const conceptCount = concepts.length;
        const conceptsValid = concepts.every((c: any) =>
            c.keyword && c.description && c.example &&
            c.keyword !== "undefined" && c.description !== "undefined" && c.example !== "undefined"
        );

        console.log(`\n[Core Concepts]`);
        console.log(`  개수: ${conceptCount}/5 ${conceptCount === 5 ? "✅" : "❌"}`);
        console.log(`  필드 유효성: ${conceptsValid ? "✅" : "❌"}`);

        if (concepts.length > 0) {
            console.log(`  샘플 (첫 번째):`);
            console.log(`    - keyword: ${concepts[0].keyword}`);
            console.log(`    - description: ${(concepts[0].description || "").substring(0, 50)}...`);
            console.log(`    - example: ${(concepts[0].example || "").substring(0, 50)}...`);
        }

        // Questions 검증
        const questions = questionsData.questions || {};
        const highCount = (questions.high || []).length;
        const mediumCount = (questions.medium || []).length;
        const lowCount = (questions.low || []).length;

        console.log(`\n[Expected Questions]`);
        console.log(`  High: ${highCount}/3 ${highCount >= 3 ? "✅" : "❌"}`);
        console.log(`  Medium: ${mediumCount}/3 ${mediumCount >= 3 ? "✅" : "❌"}`);
        console.log(`  Low: ${lowCount}/3 ${lowCount >= 3 ? "✅" : "❌"}`);

        if (lowCount > 0) {
            console.log(`  Low 샘플:`);
            console.log(`    - ${questions.low[0].question}`);
        }

        // 종합 점수
        const score = {
            concepts: conceptCount === 5 && conceptsValid ? 1 : 0,
            high: highCount >= 3 ? 1 : 0,
            medium: mediumCount >= 3 ? 1 : 0,
            low: lowCount >= 3 ? 1 : 0,
        };
        const totalScore = Object.values(score).reduce((a, b) => a + b, 0);

        console.log(`\n🏆 종합: ${totalScore}/4 (${(totalScore / 4 * 100).toFixed(0)}%)`);

        return {
            uni,
            dept,
            conceptCount,
            conceptsValid,
            highCount,
            mediumCount,
            lowCount,
            score: totalScore,
        };

    } catch (error: any) {
        console.error(`❌ 테스트 실패: ${error.message}`);
        return { uni, dept, error: error.message };
    }
}

async function main() {
    console.log("🚀 Synthesis 모듈 단독 테스트 시작\n");

    const results = [];
    for (const tc of testCases) {
        const result = await testSynthesisModule(tc.uni, tc.dept);
        results.push(result);
    }

    console.log("\n" + "=".repeat(60));
    console.log("📋 전체 결과 요약");
    console.log("=".repeat(60));

    for (const r of results) {
        if (r.error) {
            console.log(`❌ ${r.uni} ${r.dept}: 오류 - ${r.error}`);
        } else {
            console.log(`${r.score === 4 ? "✅" : "⚠️"} ${r.uni} ${r.dept}: ${r.score}/4`);
            console.log(`   Concepts: ${r.conceptCount}/5, Low: ${r.lowCount}/3`);
        }
    }
}

main().catch(console.error);
