/**
 * 테이블 정규식 디버깅
 */

const testText = `### 핵심 전공 과목
| 과목명 | 핵심 개념 | 면접 예상 질문 |
| :--- | :--- | :--- |
| 정치학원론 | 정치의 본질, 권력의 속성 | 당신이 생각하는 정치의 정의는? |
| 국제정치론 | 현실주의, 자유주의 | 미중 관계를 이론으로 분석하시오 |

### 학과 특색`;

console.log('=== 입력 텍스트 ===');
console.log(JSON.stringify(testText));

// 정규식 테스트
const tableRegex = /(\|[^\n]+\|(?:\n|$))+/g;
const matches = testText.match(tableRegex);
console.log('\n=== 정규식 매치 ===');
console.log(matches);

// 직접 줄 단위로 확인
console.log('\n=== 줄 단위 확인 ===');
const lines = testText.split('\n');
lines.forEach((line, i) => {
    console.log(`[${i}] "${line}" -> 테이블행: ${line.startsWith('|') && line.endsWith('|')}`);
});

// 테이블 부분만 추출
console.log('\n=== 테이블 추출 시도 ===');
const tableLines: string[] = [];
let inTable = false;
for (const line of lines) {
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        inTable = true;
        tableLines.push(line);
    } else if (inTable && line.trim() === '') {
        break;
    } else if (inTable) {
        break;
    }
}
console.log('추출된 테이블 줄:', tableLines);
