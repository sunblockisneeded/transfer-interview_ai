/**
 * Professors 모듈 단독 테스트
 * - 교수 이름이 정상적인 한글 2-4자인지 확인
 * - "명예", "젊은", "최신" 같은 잘못된 이름이 없는지 확인
 */

import { Type, Schema } from "@google/genai";
import { ai, MODEL_RESEARCH } from '../api/_config.js';
import { generateContentWithSmartRetry, parseJsonSafe, cleanOutput } from '../api/_utils.js';

const testCases = [
    { uni: "충남대학교", dept: "정치외교학과" },
    { uni: "서울대학교", dept: "경제학부" },
];

async function testProfessorsModule(uni: string, dept: string) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🧪 Testing: ${uni} ${dept}`);
    console.log("=".repeat(60));

    const searchPrompt = `
"${uni} ${dept} 교수진" 또는 "${uni} ${dept} 교수 소개"를 검색하여 실제 교수 명단을 확인하세요.

[필수]
- 반드시 검색하여 실제 재직 중인 교수명 확인
- 명예교수는 제외하고 현직 교수만 포함
- 최소 3명 이상의 교수 정보 제공

[출력 형식 - JSON]
각 교수에 대해 다음 정보를 JSON 배열로 반환:
- name: 교수 실명 (2-4글자 한글, 예: "홍길동")
- field: 전공/연구 분야 (예: "국제정치", "비교정치")
- interviewTip: 이 교수 면접 시 예상 질문 또는 어필 포인트
`;

    const professorSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            professors: {
                type: Type.ARRAY,
                description: "교수진 목록 (최소 3명)",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: "교수 실명 (2-4글자 한글)" },
                        field: { type: Type.STRING, description: "전공/연구 분야" },
                        interviewTip: { type: Type.STRING, description: "면접 연결 포인트" },
                    },
                    required: ["name", "field", "interviewTip"],
                },
            },
            analysisText: {
                type: Type.STRING,
                description: "학과 강점 및 면접 어필 포인트 종합 분석"
            }
        },
        required: ["professors", "analysisText"],
    };

    try {
        const response = await generateContentWithSmartRetry(
            ai.models,
            MODEL_RESEARCH,
            searchPrompt,
            {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: professorSchema,
            },
            60000,
            "Professor Test"
        );

        const data = parseJsonSafe(response.text || "{}");

        // 결과 검증
        console.log("\n📊 검증 결과:");
        console.log("-".repeat(40));

        const rawProfessors = data.professors || [];
        console.log(`\n[원본 교수 데이터] (${rawProfessors.length}명)`);
        rawProfessors.forEach((p: any, i: number) => {
            console.log(`  ${i + 1}. ${p.name} - ${p.field}`);
        });

        // 필터링: 한글 2-4자만 유효
        const validProfessors = rawProfessors.filter((p: any) =>
            p.name && /^[가-힣]{2,4}$/.test(p.name)
        );

        // 잘못된 이름 검출
        const invalidNames = rawProfessors
            .filter((p: any) => !p.name || !/^[가-힣]{2,4}$/.test(p.name))
            .map((p: any) => p.name);

        console.log(`\n[필터링 후] ${validProfessors.length}명`);
        validProfessors.forEach((p: any, i: number) => {
            console.log(`  ${i + 1}. ${p.name} - ${p.field}`);
        });

        if (invalidNames.length > 0) {
            console.log(`\n⚠️ 잘못된 이름 감지: ${invalidNames.join(', ')}`);
        }

        // 점수 계산
        const hasEnoughProfessors = validProfessors.length >= 3;
        const noInvalidNames = invalidNames.length === 0;
        const hasAnalysis = data.analysisText && data.analysisText.length > 100;

        console.log(`\n[평가]`);
        console.log(`  교수 3명 이상: ${hasEnoughProfessors ? "✅" : "❌"} (${validProfessors.length}명)`);
        console.log(`  잘못된 이름 없음: ${noInvalidNames ? "✅" : "❌"}`);
        console.log(`  분석 텍스트 존재: ${hasAnalysis ? "✅" : "❌"}`);

        const score = [hasEnoughProfessors, noInvalidNames, hasAnalysis].filter(Boolean).length;
        console.log(`\n🏆 종합: ${score}/3 (${(score / 3 * 100).toFixed(0)}%)`);

        return {
            uni,
            dept,
            validCount: validProfessors.length,
            invalidNames,
            score,
        };

    } catch (error: any) {
        console.error(`❌ 테스트 실패: ${error.message}`);
        return { uni, dept, error: error.message };
    }
}

async function main() {
    console.log("🚀 Professors 모듈 단독 테스트 시작\n");

    const results = [];
    for (const tc of testCases) {
        const result = await testProfessorsModule(tc.uni, tc.dept);
        results.push(result);
    }

    console.log("\n" + "=".repeat(60));
    console.log("📋 전체 결과 요약");
    console.log("=".repeat(60));

    for (const r of results) {
        if (r.error) {
            console.log(`❌ ${r.uni} ${r.dept}: 오류 - ${r.error}`);
        } else {
            console.log(`${r.score === 3 ? "✅" : "⚠️"} ${r.uni} ${r.dept}: ${r.score}/3`);
            console.log(`   유효 교수: ${r.validCount}명`);
            if (r.invalidNames && r.invalidNames.length > 0) {
                console.log(`   잘못된 이름: ${r.invalidNames.join(', ')}`);
            }
        }
    }
}

main().catch(console.error);
