/**
 * Bold 변환 로직 단위 테스트
 */

// 마크다운 bold를 HTML strong으로 변환
const convertBold = (text: string): string => {
    return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
};

console.log('=== Bold 변환 테스트 ===\n');

const testCases = [
    { input: '**정치학원론**', expected: '<strong>정치학원론</strong>' },
    { input: '**국제관계이론** 분석', expected: '<strong>국제관계이론</strong> 분석' },
    { input: '정치권력, 민주주의', expected: '정치권력, 민주주의' },
    { input: '**핵심** 개념과 **이론**', expected: '<strong>핵심</strong> 개념과 <strong>이론</strong>' },
];

let passed = 0;
for (const tc of testCases) {
    const result = convertBold(tc.input);
    const ok = result === tc.expected;
    console.log(`입력: ${tc.input}`);
    console.log(`출력: ${result}`);
    console.log(`기대: ${tc.expected}`);
    console.log(`결과: ${ok ? '✅ PASS' : '❌ FAIL'}\n`);
    if (ok) passed++;
}

console.log(`=== 결과: ${passed}/${testCases.length} ===`);
