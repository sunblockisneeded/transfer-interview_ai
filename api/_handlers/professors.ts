import type { VercelResponse } from '@vercel/node';
import { Type, Schema } from "@google/genai";
import { ai, MODEL_RESEARCH, TIMEOUTS } from '../_config.js';
import { sanitizeInput, generateContentWithSmartRetry, cleanOutput, parseJsonSafe } from '../_utils.js';

export async function handleProfessors(payload: any, res: VercelResponse) {
    const { uni, dept, config } = payload;
    const safeUni = sanitizeInput(uni);
    const safeDept = sanitizeInput(dept);

    const model = config?.model || MODEL_RESEARCH;

    // 1단계: 검색으로 교수진 목록 가져오기
    const searchPrompt = `
"${safeUni} ${safeDept} 교수진" 또는 "${safeUni} ${safeDept} 교수 소개"를 검색하여 실제 교수 명단을 확인하세요.

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
                description: "학과 강점 및 면접 어필 포인트 종합 분석 (마크다운 형식, 500자 이상)"
            }
        },
        required: ["professors", "analysisText"],
    };

    try {
        const response = await generateContentWithSmartRetry(
            ai.models,
            model,
            searchPrompt,
            {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: professorSchema,
            },
            config?.timeout || TIMEOUTS.PROFESSOR_LIST,
            "Professor Analysis (JSON)"
        );

        const data = parseJsonSafe(response.text || "{}");

        // 교수 데이터 정규화
        const professors = (data.professors || [])
            .filter((p: any) => p.name && /^[가-힣]{2,4}$/.test(p.name)) // 한글 이름만 필터
            .map((p: any) => ({
                name: p.name,
                researchTendency: p.field || '정보 없음',
                interviewQuestion: p.interviewTip || null,
                lab: null,
                contact: null,
                majorPapers: [],
                details: ''
            }));

        const analysisText = cleanOutput(data.analysisText || '');

        return res.status(200).json({
            professors,
            majorKnowledgeAnalysis: analysisText,
            sources: []
        });
    } catch (e) {
        console.error('Professor analysis failed:', e);
        return res.status(200).json({
            professors: [],
            majorKnowledgeAnalysis: '교수진 정보를 분석하는 중 오류가 발생했습니다.',
            sources: []
        });
    }
}

// 텍스트에서 교수 정보 간단히 추출
function extractProfessorsFromText(text: string): any[] {
    const professors: any[] = [];

    // **교수명** 패턴 찾기
    const profPattern = /\*\*([^*]+)\*\*\s*[-–]\s*([^→\n]+)(?:→\s*([^\n]+))?/g;
    let match;

    while ((match = profPattern.exec(text)) !== null) {
        professors.push({
            name: match[1].trim(),
            researchTendency: match[2].trim(),
            interviewQuestion: match[3]?.trim() || null,
            lab: null,
            contact: null,
            majorPapers: [],
            details: ''
        });
    }

    // 교수 패턴을 못 찾은 경우, 이름만이라도 추출
    if (professors.length === 0) {
        const namePattern = /([가-힣]{2,4})\s*교수/g;
        const names = new Set<string>();
        while ((match = namePattern.exec(text)) !== null) {
            names.add(match[1]);
        }
        names.forEach(name => {
            professors.push({
                name,
                researchTendency: '상세 정보 본문 참조',
                lab: null,
                contact: null,
                majorPapers: [],
                details: ''
            });
        });
    }

    return professors;
}
