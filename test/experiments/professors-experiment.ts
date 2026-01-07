/**
 * Professors 모듈 프롬프트 실험
 *
 * 실행: npx tsx test/experiments/professors-experiment.ts
 *
 * 목표: 충남대학교 정치외교학과 교수 정보 품질 개선
 *
 * 현재 문제점:
 * 1. 일부 교수 정보가 매우 빈약 (예: 김정현: "발표된 논문 1편 (제목 미상)")
 * 2. [cite: ...] 메타데이터 노출
 * 3. "Unknown" lab 표시
 *
 * 실험 대상: 박영득, 김정현 교수
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';
import * as path from 'path';

// 환경변수에서 API 키 로드
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const MODEL_DEFAULT = 'gemini-3-flash-preview';

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

// ===== 설정 =====
const UNI = "충남대학교";
const DEPT = "정치외교학과";
const TARGET_PROFESSORS = ["박영득", "김정현"];

// ===== 유틸리티 =====

const timeContext = `
당신의 학습 데이터는 2024년까지입니다. 이후의 정보는 도구나 시스템 메시지로 제공되지 않는 한 알 수 없습니다.
현재 시점: ${currentYear}년 ${currentMonth}월
`;

// 후처리 함수 (cite 제거)
const cleanOutput = (text: string): string => {
  if (!text) return '';

  return text
    // [cite: ...] 패턴 제거 (다양한 형식 대응)
    .replace(/\[cite:\s*[\d,\s]+(?:from previous turn)?\]/gi, '')
    .replace(/\[cite:\s*\d+\]/gi, '')
    // HTML 태그 정리
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// JSON 파싱 (안전)
const parseJsonSafe = (text: string): any => {
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // JSON 객체 추출 시도
    const firstOpen = text.indexOf('{');
    if (firstOpen === -1) return null;

    let balance = 0;
    let inString = false;
    let escape = false;

    for (let i = firstOpen; i < text.length; i++) {
      const char = text[i];

      if (escape) { escape = false; continue; }
      if (char === '\\') { escape = true; continue; }
      if (char === '"') { inString = !inString; continue; }

      if (!inString) {
        if (char === '{') balance++;
        else if (char === '}') {
          balance--;
          if (balance === 0) {
            try {
              return JSON.parse(text.substring(firstOpen, i + 1));
            } catch (e2) {
              // continue
            }
          }
        }
      }
    }
    return null;
  }
};

// ===== 프롬프트 정의 =====

// 기존 프롬프트 (현재 professors.ts에서 사용 중)
const createOldPrompt = (name: string, uni: string, dept: string) => `
Analyze professor "${name}" from ${uni} ${dept}.
Output MUST be in Korean.

[Temporal Context]
${timeContext}

Return ONLY a JSON object:
{
  "name": "${name}",
  "lab": "Lab Name (or 'Unknown')",
  "contact": "Email or Office (or 'Unknown')",
  "researchTendency": "One sentence summary of research focus (ends with ~하는 경향이 있음)",
  "majorPapers": ["Paper 1", "Paper 2", "Paper 3"],
  "details": "Brief description of their academic background or specific interests"
}
`;

// 개선 프롬프트 (품질 보장)
const createNewPrompt = (name: string, uni: string, dept: string) => `
[역할] 당신은 한국 대학 교수 연구 분석가입니다.
[분석 대상] ${uni} ${dept} ${name} 교수

[검색 전략]
1. "${name} ${uni}" 검색
2. "${name} 연구실" 검색
3. "${name} 논문" 검색

[품질 규칙]
- 논문은 반드시 제목이 확인된 것만 포함
- 확인 불가시 해당 필드 null 반환
- "Unknown"이나 빈 정보 대신 null 사용
- 최소 3개 이상의 구체적 정보가 없으면 해당 교수 제외 권고

[출력 형식]
{
  "name": "교수명",
  "lab": "연구실명 (없으면 null)",
  "contact": "연락처 (없으면 null)",
  "researchTendency": "구체적 연구 분야 서술",
  "majorPapers": ["확인된 논문 제목만"],
  "details": "학력, 경력",
  "dataQuality": "high/medium/low"
}
`;

// ===== 실험 실행 함수 =====

interface ExperimentResult {
  professor: string;
  old: {
    prompt: string;
    rawResponse: string;
    parsed: any;
    issues: string[];
  };
  new: {
    prompt: string;
    rawResponse: string;
    parsed: any;
    issues: string[];
  };
  comparison: {
    winner: 'old' | 'new' | 'tie';
    reason: string;
  };
}

// 품질 문제 분석
const analyzeIssues = (parsed: any, rawText: string): string[] => {
  const issues: string[] = [];

  if (!parsed) {
    issues.push("JSON 파싱 실패");
    return issues;
  }

  // 1. Unknown 체크
  if (parsed.lab === 'Unknown' || parsed.lab?.toLowerCase() === 'unknown') {
    issues.push("lab이 'Unknown'으로 표시됨");
  }

  // 2. cite 메타데이터 체크
  if (rawText.includes('[cite:')) {
    issues.push("[cite:] 메타데이터 노출");
  }

  // 3. 빈약한 논문 정보 체크
  if (parsed.majorPapers) {
    const papers = parsed.majorPapers;
    if (papers.length === 0) {
      issues.push("논문 정보 없음");
    } else {
      const vaguePatterns = ['미상', '제목 없음', 'Unknown', '없음', '확인 불가'];
      const vaguePapers = papers.filter((p: string) =>
        vaguePatterns.some(pattern => p.includes(pattern))
      );
      if (vaguePapers.length > 0) {
        issues.push(`빈약한 논문 정보: ${vaguePapers.join(', ')}`);
      }
    }
  }

  // 4. 빈 필드 체크
  const emptyFields = Object.entries(parsed)
    .filter(([key, value]) => value === '' || value === 'Unknown' || value === '확인 불가')
    .map(([key]) => key);

  if (emptyFields.length > 0) {
    issues.push(`불완전한 필드: ${emptyFields.join(', ')}`);
  }

  return issues;
};

// 결과 비교
const compareResults = (oldIssues: string[], newIssues: string[], oldParsed: any, newParsed: any): { winner: 'old' | 'new' | 'tie'; reason: string } => {
  const oldScore = oldIssues.length;
  const newScore = newIssues.length;

  // 데이터 품질 점수도 고려
  let oldDataScore = 0;
  let newDataScore = 0;

  if (oldParsed) {
    if (oldParsed.lab && oldParsed.lab !== 'Unknown') oldDataScore++;
    if (oldParsed.majorPapers?.length > 0) oldDataScore += oldParsed.majorPapers.length;
    if (oldParsed.details && oldParsed.details.length > 50) oldDataScore++;
  }

  if (newParsed) {
    if (newParsed.lab && newParsed.lab !== null) newDataScore++;
    if (newParsed.majorPapers?.length > 0) newDataScore += newParsed.majorPapers.length;
    if (newParsed.details && newParsed.details.length > 50) newDataScore++;
    if (newParsed.dataQuality === 'high') newDataScore += 2;
    else if (newParsed.dataQuality === 'medium') newDataScore += 1;
  }

  // 최종 점수 = 데이터 품질 - 문제점
  const oldFinalScore = oldDataScore - oldScore * 2;
  const newFinalScore = newDataScore - newScore * 2;

  if (newFinalScore > oldFinalScore) {
    return { winner: 'new', reason: `개선 프롬프트가 더 나음 (문제점: ${newScore} vs ${oldScore}, 데이터 품질: ${newDataScore} vs ${oldDataScore})` };
  } else if (oldFinalScore > newFinalScore) {
    return { winner: 'old', reason: `기존 프롬프트가 더 나음 (문제점: ${oldScore} vs ${newScore}, 데이터 품질: ${oldDataScore} vs ${newDataScore})` };
  } else {
    return { winner: 'tie', reason: `동점 (문제점: ${oldScore} = ${newScore}, 데이터 품질: ${oldDataScore} = ${newDataScore})` };
  }
};

// 단일 교수 실험
const experimentProfessor = async (name: string): Promise<ExperimentResult> => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`교수 실험: ${name}`);
  console.log('='.repeat(50));

  const oldPrompt = createOldPrompt(name, UNI, DEPT);
  const newPrompt = createNewPrompt(name, UNI, DEPT);

  // 기존 프롬프트 실행
  console.log('\n[1/2] 기존 프롬프트 실행 중...');
  let oldResponse = '';
  let oldParsed = null;

  try {
    const oldResult = await ai.models.generateContent({
      model: MODEL_DEFAULT,
      contents: oldPrompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    oldResponse = oldResult.text || '';
    oldParsed = parseJsonSafe(oldResponse);
    console.log('  -> 성공');
  } catch (e: any) {
    console.error('  -> 실패:', e.message);
    oldResponse = `ERROR: ${e.message}`;
  }

  // 딜레이
  await new Promise(r => setTimeout(r, 2000));

  // 개선 프롬프트 실행
  console.log('[2/2] 개선 프롬프트 실행 중...');
  let newResponse = '';
  let newParsed = null;

  try {
    const newResult = await ai.models.generateContent({
      model: MODEL_DEFAULT,
      contents: newPrompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    newResponse = newResult.text || '';
    newParsed = parseJsonSafe(newResponse);
    console.log('  -> 성공');
  } catch (e: any) {
    console.error('  -> 실패:', e.message);
    newResponse = `ERROR: ${e.message}`;
  }

  // 문제점 분석
  const oldIssues = analyzeIssues(oldParsed, oldResponse);
  const newIssues = analyzeIssues(newParsed, newResponse);

  // 비교
  const comparison = compareResults(oldIssues, newIssues, oldParsed, newParsed);

  // 결과 출력
  console.log('\n--- 분석 결과 ---');
  console.log(`기존 프롬프트 문제점: ${oldIssues.length > 0 ? oldIssues.join(', ') : '없음'}`);
  console.log(`개선 프롬프트 문제점: ${newIssues.length > 0 ? newIssues.join(', ') : '없음'}`);
  console.log(`승자: ${comparison.winner} (${comparison.reason})`);

  return {
    professor: name,
    old: {
      prompt: oldPrompt,
      rawResponse: oldResponse,
      parsed: oldParsed,
      issues: oldIssues
    },
    new: {
      prompt: newPrompt,
      rawResponse: newResponse,
      parsed: newParsed,
      issues: newIssues
    },
    comparison
  };
};

// ===== 메인 실행 =====

const main = async () => {
  console.log('='.repeat(60));
  console.log('Professors 모듈 프롬프트 실험');
  console.log(`대상: ${UNI} ${DEPT}`);
  console.log(`교수: ${TARGET_PROFESSORS.join(', ')}`);
  console.log(`모델: ${MODEL_DEFAULT}`);
  console.log('='.repeat(60));

  if (!apiKey) {
    console.log('\nAPI_KEY가 설정되지 않았습니다.');
    console.log('환경변수를 설정하세요: export API_KEY=your_api_key');
    return;
  }

  const results: ExperimentResult[] = [];

  for (const professor of TARGET_PROFESSORS) {
    try {
      const result = await experimentProfessor(professor);
      results.push(result);

      // 다음 교수 실험 전 딜레이
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      console.error(`${professor} 실험 실패:`, e);
    }
  }

  // 종합 결과
  console.log('\n' + '='.repeat(60));
  console.log('종합 결과');
  console.log('='.repeat(60));

  const summary = {
    timestamp: new Date().toISOString(),
    config: {
      university: UNI,
      department: DEPT,
      model: MODEL_DEFAULT,
      targetProfessors: TARGET_PROFESSORS
    },
    results: results.map(r => ({
      professor: r.professor,
      oldIssues: r.old.issues,
      newIssues: r.new.issues,
      winner: r.comparison.winner,
      reason: r.comparison.reason,
      oldParsed: r.old.parsed,
      newParsed: r.new.parsed
    })),
    overall: {
      oldWins: results.filter(r => r.comparison.winner === 'old').length,
      newWins: results.filter(r => r.comparison.winner === 'new').length,
      ties: results.filter(r => r.comparison.winner === 'tie').length,
      recommendation: ''
    }
  };

  if (summary.overall.newWins > summary.overall.oldWins) {
    summary.overall.recommendation = '개선 프롬프트 적용 권장';
  } else if (summary.overall.oldWins > summary.overall.newWins) {
    summary.overall.recommendation = '기존 프롬프트 유지';
  } else {
    summary.overall.recommendation = '추가 실험 필요';
  }

  console.log(`기존 프롬프트 승: ${summary.overall.oldWins}`);
  console.log(`개선 프롬프트 승: ${summary.overall.newWins}`);
  console.log(`동점: ${summary.overall.ties}`);
  console.log(`권장 사항: ${summary.overall.recommendation}`);

  // 결과 저장
  const resultsDir = path.join(__dirname, '../results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const outputPath = path.join(resultsDir, 'professors_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.log(`\n결과 저장: ${outputPath}`);

  // 상세 결과도 별도 저장
  const detailedPath = path.join(resultsDir, `professors_detailed_${Date.now()}.json`);
  fs.writeFileSync(detailedPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`상세 결과 저장: ${detailedPath}`);
};

main().catch(console.error);
