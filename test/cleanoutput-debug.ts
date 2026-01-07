/**
 * cleanOutput 함수 디버깅
 */

// convertMarkdownTableToHtml 함수 직접 테스트
const convertMarkdownTableToHtml = (text: string): string => {
    const tableRegex = /(\|[^\n]+\|(?:\n|$))+/g;

    return text.replace(tableRegex, (tableMatch) => {
        console.log('매치된 테이블:', JSON.stringify(tableMatch));

        const lines = tableMatch.trim().split('\n').filter(line => line.trim() && line.includes('|'));
        console.log('파싱된 줄:', lines);

        if (lines.length < 2) return tableMatch;

        const separatorIndex = lines.findIndex(line => {
            const cleaned = line.replace(/[^|:\-\s]/g, '');
            const isSeparator = /^\|[\s:\-]+\|$/.test(cleaned) && line.includes('---');
            console.log(`줄 "${line}" -> cleaned: "${cleaned}" -> isSeparator: ${isSeparator}`);
            return isSeparator;
        });

        console.log('구분자 인덱스:', separatorIndex);
        if (separatorIndex === -1) return tableMatch;

        const headerLines = lines.slice(0, separatorIndex);
        const bodyLines = lines.slice(separatorIndex + 1);

        const parseRow = (line: string): string[] => {
            return line.split('|')
                .slice(1, -1)
                .map(cell => cell.trim());
        };

        let html = '<table style="width:100%; border-collapse:collapse; margin:15px 0; font-size:14px;">';
        html += '<thead style="background-color:#f1f5f9;">';
        for (const headerLine of headerLines) {
            html += '<tr>';
            for (const cell of parseRow(headerLine)) {
                html += `<th style="border:1px solid #e2e8f0; padding:10px; text-align:left;">${cell}</th>`;
            }
            html += '</tr>';
        }
        html += '</thead>';

        if (bodyLines.length > 0) {
            html += '<tbody>';
            for (const bodyLine of bodyLines) {
                html += '<tr>';
                for (const cell of parseRow(bodyLine)) {
                    html += `<td style="border:1px solid #e2e8f0; padding:10px;">${cell}</td>`;
                }
                html += '</tr>';
            }
            html += '</tbody>';
        }

        html += '</table>';
        return html;
    });
};

const testText = `### 핵심 전공 과목
| 과목명 | 핵심 개념 | 면접 예상 질문 |
| :--- | :--- | :--- |
| 정치학원론 | 정치의 본질 | 정의는? |
| 국제정치론 | 현실주의 | 분석하시오 |

### 학과 특색`;

console.log('=== 변환 테스트 ===');
const result = convertMarkdownTableToHtml(testText);
console.log('\n=== 결과 ===');
console.log(result);
console.log('\n=== 테이블 포함 여부 ===');
console.log('포함:', result.includes('<table'));
