/**
 * api/_utils.ts 단위 테스트
 * - cleanOutput
 * - parseJsonSafe
 * - 마크다운 테이블 → HTML 변환
 * - Bold 변환
 */

import { describe, it, expect } from 'vitest';
import { cleanOutput, parseJsonSafe } from '../../api/_utils';

describe('cleanOutput', () => {
  it('[cite:...] 패턴을 제거한다', () => {
    const input = '텍스트 [cite: 1, 2, 3] 입니다.';
    const result = cleanOutput(input);
    expect(result).not.toContain('[cite:');
  });

  it('[확인됨] 태그를 제거한다', () => {
    const input = '정치학원론 [확인됨] 과목입니다.';
    const result = cleanOutput(input);
    expect(result).not.toContain('[확인됨]');
  });

  it('마크다운 테이블을 HTML로 변환한다', () => {
    const input = `
| 과목명 | 핵심 개념 |
|--------|----------|
| 정치학원론 | 권력 |
`;
    const result = cleanOutput(input);
    expect(result).toContain('<table');
    expect(result).toContain('</table>');
    expect(result).toContain('<th');
    expect(result).toContain('<td');
  });

  it('테이블 내 **bold**를 <strong>으로 변환한다', () => {
    const input = `
| 과목명 | 설명 |
|--------|------|
| **정치학원론** | 기초 |
`;
    const result = cleanOutput(input);
    expect(result).toContain('<strong>정치학원론</strong>');
    expect(result).not.toContain('**정치학원론**');
  });

  it('빈 문자열을 처리한다', () => {
    expect(cleanOutput('')).toBe('');
    expect(cleanOutput(null as any)).toBe('');
    expect(cleanOutput(undefined as any)).toBe('');
  });

  it('과도한 줄바꿈을 정리한다', () => {
    const input = '첫째\n\n\n\n\n둘째';
    const result = cleanOutput(input);
    expect(result).not.toContain('\n\n\n\n');
  });

  it('마크다운 헤딩은 유지한다', () => {
    const input = '## 제목\n### 소제목\n본문';
    const result = cleanOutput(input);
    expect(result).toContain('## 제목');
    expect(result).toContain('### 소제목');
  });
});

describe('parseJsonSafe', () => {
  it('정상적인 JSON을 파싱한다', () => {
    const input = '{"name": "홍길동", "age": 30}';
    const result = parseJsonSafe(input);
    expect(result).toEqual({ name: '홍길동', age: 30 });
  });

  it('```json 블록을 처리한다', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = parseJsonSafe(input);
    expect(result).toEqual({ key: 'value' });
  });

  it('텍스트가 섞인 JSON을 추출한다', () => {
    const input = '응답입니다: {"extracted": true} 이상입니다.';
    const result = parseJsonSafe(input);
    expect(result).toEqual({ extracted: true });
  });

  it('중첩된 객체를 처리한다', () => {
    const input = '{"outer": {"inner": "value"}}';
    const result = parseJsonSafe(input);
    expect(result.outer.inner).toBe('value');
  });

  it('잘못된 JSON은 빈 객체를 반환한다', () => {
    const input = 'not a json at all';
    const result = parseJsonSafe(input);
    expect(result).toEqual({});
  });

  it('빈 문자열은 빈 객체를 반환한다', () => {
    const result = parseJsonSafe('');
    expect(result).toEqual({});
  });
});

describe('마크다운 테이블 변환 상세', () => {
  it('여러 행의 테이블을 변환한다', () => {
    const input = `
| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| 4 | 5 | 6 |
`;
    const result = cleanOutput(input);
    expect(result).toContain('<tr>');
    // 헤더 1행 + 데이터 2행 = 3개의 tr
    const trCount = (result.match(/<tr>/g) || []).length;
    expect(trCount).toBe(3);
  });

  it('구분자 행 패턴을 인식한다 (:--- 형식)', () => {
    const input = `
| 왼쪽 | 가운데 | 오른쪽 |
|:-----|:------:|-------:|
| L | C | R |
`;
    const result = cleanOutput(input);
    expect(result).toContain('<table');
  });

  it('테이블이 아닌 파이프 문자는 유지한다', () => {
    const input = 'A | B 형식은 테이블이 아닙니다';
    const result = cleanOutput(input);
    expect(result).not.toContain('<table');
    expect(result).toContain('|');
  });
});
