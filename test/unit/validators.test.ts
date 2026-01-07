/**
 * reportValidator 단위 테스트
 * - validateFullReport
 * - isValidProfessorName
 * - quickValidate
 */

import { describe, it, expect } from 'vitest';
import {
  validateFullReport,
  isValidProfessorName,
  quickValidate,
  QUALITY_THRESHOLDS,
} from '../validators/reportValidator';
import { mockFullReport, invalidMockReport } from '../fixtures/mockData';

describe('isValidProfessorName', () => {
  it('2-4글자 한글 이름을 허용한다', () => {
    expect(isValidProfessorName('김철수')).toBe(true);
    expect(isValidProfessorName('이영희')).toBe(true);
    expect(isValidProfessorName('박민')).toBe(true);
    expect(isValidProfessorName('홍길동이')).toBe(true); // 4글자
  });

  it('1글자 이름을 거부한다', () => {
    expect(isValidProfessorName('김')).toBe(false);
  });

  it('5글자 이상 이름을 거부한다', () => {
    expect(isValidProfessorName('김철수영희')).toBe(false);
  });

  it('영문 이름을 거부한다', () => {
    expect(isValidProfessorName('Kim')).toBe(false);
    expect(isValidProfessorName('Professor')).toBe(false);
  });

  it('숫자가 포함된 이름을 거부한다', () => {
    expect(isValidProfessorName('김123')).toBe(false);
  });

  it('특수문자가 포함된 이름을 거부한다', () => {
    expect(isValidProfessorName('김철수!')).toBe(false);
  });

  // Note: "명예", "젊은" 등은 한글 2글자이므로 정규식은 통과함
  // 의미론적 검증(교수 이름 vs 일반 단어)은 API 레벨에서 JSON 스키마로 처리
  it('빈 문자열을 거부한다', () => {
    expect(isValidProfessorName('')).toBe(false);
  });
});

describe('validateFullReport', () => {
  it('유효한 보고서는 isValid=true', () => {
    const result = validateFullReport(mockFullReport);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it('유효하지 않은 보고서는 isValid=false', () => {
    const result = validateFullReport(invalidMockReport);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });

  describe('curriculumAnalysis 검증', () => {
    it('500자 미만이면 에러', () => {
      const report = {
        ...mockFullReport,
        curriculumAnalysis: { text: '짧은 텍스트', sources: [] },
      };
      const result = validateFullReport(report);
      expect(result.errors.some(e => e.includes('curriculumAnalysis.text'))).toBe(true);
    });
  });

  describe('professors 검증', () => {
    it('3명 미만이면 에러', () => {
      const report = {
        ...mockFullReport,
        professorAnalysis: {
          ...mockFullReport.professorAnalysis,
          professors: mockFullReport.professorAnalysis.professors.slice(0, 2),
        },
      };
      const result = validateFullReport(report);
      expect(result.errors.some(e => e.includes('professors'))).toBe(true);
    });

    it('잘못된 이름이 있으면 에러', () => {
      const report = {
        ...mockFullReport,
        professorAnalysis: {
          ...mockFullReport.professorAnalysis,
          professors: [
            { name: 'Invalid', majorPapers: [], researchTendency: '' },
            ...mockFullReport.professorAnalysis.professors.slice(1),
          ],
        },
      };
      const result = validateFullReport(report);
      expect(result.errors.some(e => e.includes('invalid professor names'))).toBe(true);
    });
  });

  describe('coreConcepts 검증', () => {
    it('5개가 아니면 에러', () => {
      const report = {
        ...mockFullReport,
        strategy: {
          ...mockFullReport.strategy,
          coreConcepts: mockFullReport.strategy.coreConcepts.slice(0, 3),
        },
      };
      const result = validateFullReport(report);
      expect(result.errors.some(e => e.includes('coreConcepts'))).toBe(true);
    });

    it('빈 keyword가 있으면 에러', () => {
      const report = {
        ...mockFullReport,
        strategy: {
          ...mockFullReport.strategy,
          coreConcepts: [
            { keyword: '', description: 'desc', example: 'ex' },
            ...mockFullReport.strategy.coreConcepts.slice(1),
          ],
        },
      };
      const result = validateFullReport(report);
      expect(result.errors.some(e => e.includes('keyword'))).toBe(true);
    });
  });

  describe('questions 검증', () => {
    it('high가 3개 미만이면 에러', () => {
      const report = {
        ...mockFullReport,
        strategy: {
          ...mockFullReport.strategy,
          questions: {
            high: [mockFullReport.strategy.questions.high[0]],
            medium: mockFullReport.strategy.questions.medium,
            low: mockFullReport.strategy.questions.low,
          },
        },
      };
      const result = validateFullReport(report);
      expect(result.errors.some(e => e.includes('questions.high'))).toBe(true);
    });

    it('medium이 비어있으면 에러', () => {
      const report = {
        ...mockFullReport,
        strategy: {
          ...mockFullReport.strategy,
          questions: {
            high: mockFullReport.strategy.questions.high,
            medium: [],
            low: mockFullReport.strategy.questions.low,
          },
        },
      };
      const result = validateFullReport(report);
      expect(result.errors.some(e => e.includes('questions.medium'))).toBe(true);
    });
  });
});

describe('quickValidate', () => {
  it('유효한 보고서는 true', () => {
    expect(quickValidate(mockFullReport)).toBe(true);
  });

  it('유효하지 않은 보고서는 false', () => {
    expect(quickValidate(invalidMockReport)).toBe(false);
  });

  it('null/undefined는 false', () => {
    expect(quickValidate(null as any)).toBe(false);
    expect(quickValidate(undefined as any)).toBe(false);
  });
});

describe('QUALITY_THRESHOLDS', () => {
  it('임계값이 정의되어 있다', () => {
    expect(QUALITY_THRESHOLDS.curriculum.minLength).toBe(500);
    expect(QUALITY_THRESHOLDS.professors.minCount).toBe(3);
    expect(QUALITY_THRESHOLDS.coreConcepts.exactCount).toBe(5);
    expect(QUALITY_THRESHOLDS.questions.countPerLevel).toBe(3);
  });
});
