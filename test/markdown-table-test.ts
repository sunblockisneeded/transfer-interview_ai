/**
 * 마크다운 테이블 → HTML 변환 테스트
 */

import { cleanOutput } from '../api/_utils.js';

const testMarkdown = `
### 핵심 전공 과목
| 과목명 | 핵심 개념 | 면접 예상 질문 |
| :--- | :--- | :--- |
| 정치학원론 | 정치의 본질, 권력의 속성 | 당신이 생각하는 정치의 정의는? |
| 국제정치론 | 현실주의, 자유주의 | 미중 관계를 이론으로 분석하시오 |

### 학과 특색
- 세방화 중심 교육
- 실천적 교육 프로그램

[확인됨] 이 태그는 제거되어야 합니다.
`;

console.log('=== 입력 (마크다운) ===');
console.log(testMarkdown);
console.log('\n=== 출력 (HTML 변환) ===');
const result = cleanOutput(testMarkdown);
console.log(result);

// 검증
console.log('\n=== 검증 ===');
console.log('테이블 변환됨:', result.includes('<table') ? '✅' : '❌');
console.log('헤더 존재:', result.includes('<th') ? '✅' : '❌');
console.log('데이터 존재:', result.includes('<td') ? '✅' : '❌');
console.log('[확인됨] 제거됨:', !result.includes('[확인됨]') ? '✅' : '❌');
console.log('h3 변환됨:', result.includes('<h3') ? '✅' : '❌');
console.log('리스트 변환됨:', result.includes('•') ? '✅' : '❌');
