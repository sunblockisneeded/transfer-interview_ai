/**
 * 보고서 품질 테스트 - 모듈별 점진적 테스트
 * Purpose: "좋은 보고서"가 나오는가?
 */

import { ai, MODEL_RESEARCH } from '../api/_config.js';
import { generateContentWithSmartRetry, cleanOutput, parseJsonSafe } from '../api/_utils.js';
import { Type, Schema } from "@google/genai";
import * as fs from 'fs';

const UNI = "충남대학교";
const DEPT = "정치외교학과";

// =============================================
// 1. CURRICULUM 모듈 테스트
// =============================================
async function testCurriculum() {
    console.log("\n" + "=".repeat(70));
    console.log("📚 1. CURRICULUM 모듈 테스트");
    console.log("=".repeat(70));

    const prompt = `
"${UNI} ${DEPT} 교육과정" 또는 "${UNI} ${DEPT} 커리큘럼"을 검색한 뒤, 편입 면접 준비 가이드를 작성해주세요.

[필수 규칙]
1. 반드시 검색하여 실제 과목명 확인
2. 검색에서 확인된 과목만 [확인됨] 표시와 함께 작성
3. 각 과목의 핵심 개념과 면접 예상 질문 포함

[작성 형식]
### 핵심 전공 과목
| 과목명 | 핵심 개념 | 면접 예상 질문 |
|--------|----------|---------------|
| (과목명) [확인됨] | 핵심 개념 | 예상 질문 |

### 학과 특색
- 이 학과만의 특징적인 교육 방향

### 면접 준비 핵심
편입 면접에서 반드시 알아야 할 개념들
`;

    try {
        const response = await generateContentWithSmartRetry(
            ai.models,
            MODEL_RESEARCH,
            prompt,
            { tools: [{ googleSearch: {} }] },
            90000,
            "Curriculum Test"
        );

        const rawText = response.text || '';
        const cleanedText = cleanOutput(rawText);

        console.log("\n📄 [원본 출력 (처음 2000자)]");
        console.log("-".repeat(50));
        console.log(rawText.substring(0, 2000));

        console.log("\n📄 [cleanOutput 적용 후 (처음 2000자)]");
        console.log("-".repeat(50));
        console.log(cleanedText.substring(0, 2000));

        // 품질 체크
        console.log("\n✅ [품질 체크]");
        const hasTable = cleanedText.includes('<table') || rawText.includes('|');
        const hasConfirmed = rawText.includes('[확인됨]') || rawText.includes('확인됨');
        const hasHeadings = rawText.includes('###') || rawText.includes('##');
        const length = rawText.length;

        console.log(`  - 테이블 포함: ${hasTable ? '✅' : '❌'}`);
        console.log(`  - [확인됨] 태그 사용: ${hasConfirmed ? '✅' : '❌'}`);
        console.log(`  - 구조화된 헤딩: ${hasHeadings ? '✅' : '❌'}`);
        console.log(`  - 충분한 길이: ${length > 1000 ? '✅' : '❌'} (${length}자)`);

        return { rawText, cleanedText, quality: { hasTable, hasConfirmed, hasHeadings, length } };
    } catch (e: any) {
        console.error("❌ 테스트 실패:", e.message);
        return null;
    }
}

// =============================================
// 2. PROFESSORS 모듈 테스트
// =============================================
async function testProfessors() {
    console.log("\n" + "=".repeat(70));
    console.log("👨‍🏫 2. PROFESSORS 모듈 테스트");
    console.log("=".repeat(70));

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
                description: "학과 강점 및 면접 어필 포인트 종합 분석 (마크다운 형식, 500자 이상)"
            }
        },
        required: ["professors", "analysisText"],
    };

    const prompt = `
"${UNI} ${DEPT} 교수진" 또는 "${UNI} ${DEPT} 교수 소개"를 검색하여 실제 교수 명단을 확인하세요.

[필수]
- 반드시 검색하여 실제 재직 중인 교수명 확인
- 명예교수는 제외하고 현직 교수만 포함
- 최소 3명 이상의 교수 정보 제공

[출력 형식 - JSON]
각 교수에 대해 다음 정보를 JSON 배열로 반환:
- name: 교수 실명 (2-4글자 한글, 예: "홍길동")
- field: 전공/연구 분야 (예: "국제정치", "비교정치")
- interviewTip: 이 교수 면접 시 예상 질문 또는 어필 포인트

analysisText에는 학과의 강점과 면접에서 어필할 포인트를 마크다운으로 작성
`;

    try {
        const response = await generateContentWithSmartRetry(
            ai.models,
            MODEL_RESEARCH,
            prompt,
            {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: professorSchema,
            },
            90000,
            "Professors Test"
        );

        const data = parseJsonSafe(response.text || "{}");
        const professors = (data.professors || []).filter((p: any) =>
            p.name && /^[가-힣]{2,4}$/.test(p.name)
        );

        console.log("\n📄 [교수진 목록]");
        console.log("-".repeat(50));
        professors.forEach((p: any, i: number) => {
            console.log(`${i + 1}. ${p.name}`);
            console.log(`   전공: ${p.field}`);
            console.log(`   면접팁: ${p.interviewTip?.substring(0, 80)}...`);
            console.log();
        });

        console.log("\n📄 [분석 텍스트 (처음 1000자)]");
        console.log("-".repeat(50));
        console.log((data.analysisText || '').substring(0, 1000));

        // 품질 체크
        console.log("\n✅ [품질 체크]");
        const validNames = professors.every((p: any) => /^[가-힣]{2,4}$/.test(p.name));
        const hasEnough = professors.length >= 3;
        const hasAnalysis = (data.analysisText || '').length > 200;

        console.log(`  - 유효한 이름만: ${validNames ? '✅' : '❌'}`);
        console.log(`  - 3명 이상: ${hasEnough ? '✅' : '❌'} (${professors.length}명)`);
        console.log(`  - 분석 텍스트 충분: ${hasAnalysis ? '✅' : '❌'}`);

        return { professors, analysisText: data.analysisText, quality: { validNames, hasEnough, hasAnalysis } };
    } catch (e: any) {
        console.error("❌ 테스트 실패:", e.message);
        return null;
    }
}

// =============================================
// 3. TRENDS 모듈 테스트
// =============================================
async function testTrends() {
    console.log("\n" + "=".repeat(70));
    console.log("📈 3. TRENDS 모듈 테스트");
    console.log("=".repeat(70));

    const prompt = `
"${UNI} ${DEPT} 편입 면접 후기" 또는 "${UNI} ${DEPT} 편입 합격 수기"를 검색한 뒤, 면접 준비 가이드를 작성해주세요.

[필수 규칙]
1. 반드시 검색하여 실제 후기/사례 기반으로 작성
2. 실제 사례는 [실제사례] 표시
3. 일반적인 조언은 [일반] 표시

[작성 내용]
### 실제 면접 질문
- 실제로 나왔던 질문들 (출처 명시)

### 합격자 공통점
- 합격 수기에서 파악된 공통 요소

### 준비 체크리스트
- D-30, D-7, D-Day 별 준비사항
`;

    try {
        const response = await generateContentWithSmartRetry(
            ai.models,
            MODEL_RESEARCH,
            prompt,
            { tools: [{ googleSearch: {} }] },
            90000,
            "Trends Test"
        );

        const rawText = response.text || '';
        const cleanedText = cleanOutput(rawText);

        console.log("\n📄 [원본 출력 (처음 2000자)]");
        console.log("-".repeat(50));
        console.log(rawText.substring(0, 2000));

        // 품질 체크
        console.log("\n✅ [품질 체크]");
        const hasRealCase = rawText.includes('[실제사례]') || rawText.includes('실제') || rawText.includes('후기');
        const hasChecklist = rawText.includes('체크리스트') || rawText.includes('D-');
        const hasQuestions = rawText.includes('질문');
        const length = rawText.length;

        console.log(`  - 실제 사례 언급: ${hasRealCase ? '✅' : '❌'}`);
        console.log(`  - 체크리스트 포함: ${hasChecklist ? '✅' : '❌'}`);
        console.log(`  - 질문 예시 포함: ${hasQuestions ? '✅' : '❌'}`);
        console.log(`  - 충분한 길이: ${length > 1000 ? '✅' : '❌'} (${length}자)`);

        return { rawText, cleanedText, quality: { hasRealCase, hasChecklist, hasQuestions, length } };
    } catch (e: any) {
        console.error("❌ 테스트 실패:", e.message);
        return null;
    }
}

// =============================================
// MAIN
// =============================================
async function main() {
    console.log("🎯 보고서 품질 테스트 시작");
    console.log(`대상: ${UNI} ${DEPT}`);
    console.log("목표: 각 모듈이 '좋은 보고서'를 생성하는가?\n");

    // 1. Curriculum
    const currResult = await testCurriculum();

    // 2. Professors
    const profResult = await testProfessors();

    // 3. Trends
    const trendsResult = await testTrends();

    // 결과 요약
    console.log("\n" + "=".repeat(70));
    console.log("📊 전체 결과 요약");
    console.log("=".repeat(70));

    if (currResult) {
        const q = currResult.quality;
        const score = [q.hasTable, q.hasConfirmed, q.hasHeadings, q.length > 1000].filter(Boolean).length;
        console.log(`\n[Curriculum] ${score}/4`);
    }

    if (profResult) {
        const q = profResult.quality;
        const score = [q.validNames, q.hasEnough, q.hasAnalysis].filter(Boolean).length;
        console.log(`[Professors] ${score}/3`);
    }

    if (trendsResult) {
        const q = trendsResult.quality;
        const score = [q.hasRealCase, q.hasChecklist, q.hasQuestions, q.length > 1000].filter(Boolean).length;
        console.log(`[Trends] ${score}/4`);
    }

    // HTML 보고서 저장
    if (currResult && profResult && trendsResult) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${UNI} ${DEPT} - 모듈별 테스트 결과</title>
    <style>
        body { font-family: 'Noto Serif KR', serif; max-width: 900px; margin: 0 auto; padding: 40px; line-height: 1.8; }
        h1 { color: #1e1b4b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
        h2 { color: #334155; margin-top: 30px; }
        .section { margin-bottom: 40px; padding: 20px; background: #f8fafc; border-radius: 8px; }
        .professor-card { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #6366f1; }
        pre { background: #f1f5f9; padding: 15px; overflow-x: auto; border-radius: 8px; }
    </style>
</head>
<body>
    <h1>${UNI} ${DEPT}</h1>
    <p>모듈별 보고서 품질 테스트 결과</p>

    <div class="section">
        <h2>1. 커리큘럼 분석</h2>
        ${currResult.cleanedText}
    </div>

    <div class="section">
        <h2>2. 교수진 현황</h2>
        ${profResult.professors.map((p: any) => `
            <div class="professor-card">
                <strong>${p.name}</strong> - ${p.field}<br>
                <em>${p.interviewTip}</em>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>3. 교수진 연구 분야 분석</h2>
        ${cleanOutput(profResult.analysisText || '')}
    </div>

    <div class="section">
        <h2>4. 면접 트렌드 및 합격 사례</h2>
        ${trendsResult.cleanedText}
    </div>
</body>
</html>
        `;

        fs.writeFileSync('test/report-quality-output.html', html);
        console.log("\n📁 결과 저장: test/report-quality-output.html");
    }
}

main().catch(console.error);
