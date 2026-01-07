/**
 * 보고서 품질 검증 함수
 * "좋은 보고서"의 기준을 코드화
 */

import { FullReport, Professor, CoreConcept, InterviewQuestion } from '../../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}

export const QUALITY_THRESHOLDS = {
  curriculum: {
    minLength: 500,
    requiredPatterns: ['과목', '면접'],
  },
  professors: {
    minCount: 3,
    namePattern: /^[가-힣]{2,4}$/,
  },
  majorKnowledgeAnalysis: {
    minLength: 500,
  },
  interviewTrends: {
    minLength: 300,
    requiredKeywords: ['면접', '합격'],
  },
  coreStrategy: {
    minLength: 300,
  },
  coreConcepts: {
    exactCount: 5,
    keywordMaxLength: 30,
    descriptionMinLength: 100,
    exampleMinLength: 50,
  },
  questions: {
    countPerLevel: 3,
    levels: ['high', 'medium', 'low'] as const,
  },
};

/**
 * 교수 이름 유효성 검사
 */
export function isValidProfessorName(name: string): boolean {
  return QUALITY_THRESHOLDS.professors.namePattern.test(name);
}

/**
 * CoreConcept 유효성 검사
 */
export function validateCoreConcept(concept: CoreConcept, index: number): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!concept.keyword || concept.keyword === 'undefined') {
    errors.push(`coreConcepts[${index}].keyword: 비어있음`);
  } else if (concept.keyword.length > QUALITY_THRESHOLDS.coreConcepts.keywordMaxLength) {
    warnings.push(`coreConcepts[${index}].keyword: ${concept.keyword.length}자 (권장 ${QUALITY_THRESHOLDS.coreConcepts.keywordMaxLength}자 이하)`);
  }

  const descLen = (concept.description || '').length;
  if (descLen < QUALITY_THRESHOLDS.coreConcepts.descriptionMinLength) {
    warnings.push(`coreConcepts[${index}].description: ${descLen}자 (권장 ${QUALITY_THRESHOLDS.coreConcepts.descriptionMinLength}자 이상)`);
  }

  const exampleLen = (concept.example || '').length;
  if (exampleLen < QUALITY_THRESHOLDS.coreConcepts.exampleMinLength) {
    warnings.push(`coreConcepts[${index}].example: ${exampleLen}자 (권장 ${QUALITY_THRESHOLDS.coreConcepts.exampleMinLength}자 이상)`);
  }

  return { errors, warnings };
}

/**
 * 전체 FullReport 검증
 */
export function validateFullReport(report: FullReport): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Curriculum Analysis
  const currText = report.curriculumAnalysis?.text || '';
  if (currText.length < QUALITY_THRESHOLDS.curriculum.minLength) {
    errors.push(`curriculumAnalysis.text: ${currText.length}자 (최소 ${QUALITY_THRESHOLDS.curriculum.minLength}자 필요)`);
  }

  // 2. Professors
  const profs = report.professorAnalysis?.professors || [];
  if (profs.length < QUALITY_THRESHOLDS.professors.minCount) {
    errors.push(`professors: ${profs.length}명 (최소 ${QUALITY_THRESHOLDS.professors.minCount}명 필요)`);
  }

  const invalidNames = profs.filter(p => !isValidProfessorName(p.name));
  if (invalidNames.length > 0) {
    errors.push(`invalid professor names: ${invalidNames.map(p => p.name).join(', ')}`);
  }

  // 3. Major Knowledge Analysis
  const majorText = report.professorAnalysis?.majorKnowledgeAnalysis || '';
  if (majorText.length < QUALITY_THRESHOLDS.majorKnowledgeAnalysis.minLength) {
    errors.push(`majorKnowledgeAnalysis: ${majorText.length}자 (최소 ${QUALITY_THRESHOLDS.majorKnowledgeAnalysis.minLength}자 필요)`);
  }

  // 4. Interview Trends
  const trendsText = report.interviewTrends?.text || '';
  if (trendsText.length < QUALITY_THRESHOLDS.interviewTrends.minLength) {
    warnings.push(`interviewTrends.text: ${trendsText.length}자 (권장 ${QUALITY_THRESHOLDS.interviewTrends.minLength}자 이상)`);
  }

  // 5. Core Strategy
  const strategy = report.strategy?.coreStrategy || '';
  if (strategy.length < QUALITY_THRESHOLDS.coreStrategy.minLength) {
    errors.push(`coreStrategy: ${strategy.length}자 (최소 ${QUALITY_THRESHOLDS.coreStrategy.minLength}자 필요)`);
  }

  // 6. Core Concepts (정확히 5개)
  const concepts = report.strategy?.coreConcepts || [];
  if (concepts.length !== QUALITY_THRESHOLDS.coreConcepts.exactCount) {
    errors.push(`coreConcepts: ${concepts.length}개 (정확히 ${QUALITY_THRESHOLDS.coreConcepts.exactCount}개 필요)`);
  }

  concepts.forEach((c, i) => {
    const result = validateCoreConcept(c, i);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  });

  // 7. Questions (high/medium/low 각 3개)
  const q = report.strategy?.questions || { high: [], medium: [], low: [] };
  for (const level of QUALITY_THRESHOLDS.questions.levels) {
    const count = (q[level] || []).length;
    if (count < QUALITY_THRESHOLDS.questions.countPerLevel) {
      errors.push(`questions.${level}: ${count}개 (최소 ${QUALITY_THRESHOLDS.questions.countPerLevel}개 필요)`);
    }
  }

  // 점수 계산 (10개 핵심 체크 항목 기준)
  const totalChecks = 10;
  const failedChecks = Math.min(errors.length, totalChecks);
  const score = Math.max(0, Math.round((1 - failedChecks / totalChecks) * 100));

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score,
  };
}

/**
 * 빠른 검증 (필수 항목만)
 */
export function quickValidate(report: FullReport): boolean {
  if (!report) return false;

  const profs = report.professorAnalysis?.professors || [];
  const concepts = report.strategy?.coreConcepts || [];
  const questions = report.strategy?.questions;

  return (
    profs.length >= 3 &&
    profs.every(p => isValidProfessorName(p.name)) &&
    concepts.length === 5 &&
    (questions?.high?.length || 0) >= 3 &&
    (questions?.medium?.length || 0) >= 3 &&
    (questions?.low?.length || 0) >= 3
  );
}
