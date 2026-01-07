# 회고 (Retrospective)

> 작성일: 2026-01-08
> 세션: 테스트 인프라 구축 및 질문 생성 구조 개선

---

## 1. 실수한 부분

### 1.1 테스트 파일 형식 불일치

**문제**
```
full-report.test.ts를 Vitest용 describe/it 블록이 아닌
standalone main() 함수 형태로 작성함

→ vitest run 실행 시 "No test suite found" 오류 발생
→ npx tsx로 직접 실행해야 했음
```

**원인**
- Vitest 테스트 파일 컨벤션 미준수
- 통합 테스트와 단위 테스트의 구조 차이 미고려

**교훈**
```
테스트 파일 작성 시 실행 방법을 먼저 결정하고 그에 맞는 구조 사용
- Vitest로 실행 → describe/it 블록 필수
- npx tsx로 실행 → main() 함수 OK, 단 파일명에서 .test 제거 권장
```

---

### 1.2 팩트체크 에이전트 웹 접근 제한

**문제**
```
충북대 교수진 팩트체크 에이전트가 웹 검색에 실패
→ "WebSearch/WebFetch 비활성화" 메시지 반환
→ 3명의 교수 검증 불가
```

**원인**
- 에이전트에 명시적 권한 컨텍스트 미전달
- 웹 접근 실패 시 fallback 전략 부재

**교훈**
```typescript
// Before: 암묵적으로 웹 검색 가능 가정
const prompt = "웹 검색으로 확인하세요";

// After: 명시적 권한 및 fallback 명시
const prompt = `
웹 검색으로 확인하세요.
[접근 가능한 도구]: WebSearch, WebFetch
[웹 접근 실패 시]: 기존 프로젝트 파일에서 검색하거나
                   "웹 확인 필요" 표시 후 진행
`;
```

---

### 1.3 문서 업데이트 지연

**문제**
```
synthesis.ts 구조 변경 (교수진 context 제외) 완료 후
→ PIPELINE_ANALYSIS.md, PROMPT_STRATEGY.md 즉시 업데이트 안함
→ 사용자 요청 후에야 업데이트
```

**원인**
- 코드 변경에 집중하여 문서화 후순위로 밀림
- "나중에 한번에" 심리

**교훈**
```
코드 변경 → 관련 문서 즉시 업데이트 → 커밋
문서 업데이트를 별도 작업이 아닌 코드 변경의 일부로 인식
```

---

### 1.4 중복 코드 생성

**문제**
```
cnu-report.ts와 cbnu-report.ts가 거의 동일
→ UNI, DEPT 상수만 다름
→ 200줄+ 코드 중복
```

**원인**
- 빠른 실행을 위해 복사-붙여넣기
- 리팩토링 시점 판단 미스

**개선안**
```typescript
// 파라미터화된 단일 파일이 더 나았음
// test/integration/generate-report.ts

const UNI = process.argv[2] || '충남대학교';
const DEPT = process.argv[3] || '정치외교학과';

// 실행: npx tsx generate-report.ts 충북대학교 정치외교학과
```

---

## 2. 더 잘할 수 있었던 부분

### 2.1 가설 검증 순서

**실제 진행**
```
전체 synthesis.ts 수정 → 전체 테스트 실행 → 성공 확인
```

**더 나은 접근**
```
1. 작은 실험 먼저: 단일 프롬프트로 A/B 테스트
   - A: 교수진 포함 context
   - B: 교수진 제외 context

2. 결과 비교 후 전체 적용 결정

3. 점진적 롤아웃
```

**이유**
```
현재 방식은 "올인" 전략 - 실패 시 롤백 비용 큼
작은 실험 → 검증 → 확대 방식이 리스크 낮음
```

---

### 2.2 커밋 전략

**실제 진행**
```
1차 커밋: 코드 + 테스트 인프라 (60 files)
2차 커밋: 문서 업데이트 (4 files)
```

**더 나은 접근**
```
1차: Vitest 인프라 설정 (vitest.config.ts, setup.ts)
2차: 품질 검증기 (reportValidator.ts, mockData.ts)
3차: 단위 테스트 (utils.test.ts, validators.test.ts)
4차: synthesis.ts 구조 변경 (핵심 변경)
5차: 통합 테스트 + 문서
```

**이유**
```
- 각 커밋이 독립적으로 리뷰 가능
- 문제 발생 시 특정 커밋만 revert 가능
- 변경 히스토리 추적 용이
```

---

### 2.3 사용자 피드백 루프

**실제 진행**
```
사용자: "교수진 overfit 문제 있는 것 같아요"
나: (긴 분석) → "맞습니다, 변경하겠습니다"
```

**더 나은 접근**
```
사용자: "교수진 overfit 문제 있는 것 같아요"
나: "좋은 지적입니다. 두 가지 접근이 가능한데:
     A) 교수진 완전 제외
     B) 교수진 가중치 낮춤
     어느 방향을 선호하시나요?"

→ 더 빠른 방향 결정 가능
```

---

### 2.4 에러 핸들링

**현재 상태**
```typescript
// 팩트체크 에이전트
try {
  const result = await webSearch(query);
  return result;
} catch (e) {
  // 조용히 실패, 빈 결과 반환
  return { verified: false, reason: "검증 실패" };
}
```

**개선안**
```typescript
// 명시적 실패 이유 + 대안 제시
try {
  const result = await webSearch(query);
  return result;
} catch (e) {
  return {
    verified: false,
    reason: e.message,
    fallback: "수동 확인 필요",
    suggestedAction: `브라우저에서 ${url} 직접 확인`,
  };
}
```

---

## 3. 잘된 부분

### 3.1 문제 식별 및 해결

```
사용자 피드백 (교수 overfit) → 분석 → 근본 원인 파악 → 구조적 해결

단순 증상 치료(교수명 필터링)가 아닌
근본 원인 해결(context에서 제외)을 선택
```

### 3.2 병렬 처리 활용

```
- 충남대/충북대 리포트 병렬 생성 (47초 + 44초 → ~50초)
- 팩트체크 에이전트 4개 병렬 실행
- API 호출 최적화 (Research 3개 병렬)
```

### 3.3 품질 검증 체계화

```
QUALITY_THRESHOLDS 정의 → validateFullReport() 구현
→ 100/100 점수 달성 기준 명확화
→ 향후 회귀 테스트 가능
```

### 3.4 사용자 협업

```
"접근권한이 없거나 안되는건 제가 해드리겠습니다"
→ 충북대 교수진 직접 확인
→ 효율적 역할 분담
```

---

## 4. 향후 개선 방향

### 4.1 테스트 구조 정리

```
test/
├── unit/           # Vitest (describe/it)
├── integration/    # Vitest (describe/it) - 긴 timeout
└── scripts/        # npx tsx 직접 실행 (main 함수)
```

### 4.2 파라미터화된 리포트 생성

```bash
# 현재
npx tsx test/integration/cnu-report.ts
npx tsx test/integration/cbnu-report.ts

# 개선
npx tsx test/scripts/generate-report.ts --uni="충남대학교" --dept="정치외교학과"
```

### 4.3 팩트체크 강화

```typescript
interface FactCheckResult {
  item: string;
  status: 'verified' | 'unverified' | 'error';
  source?: string;
  confidence: number;
  manualCheckUrl?: string;
}
```

### 4.4 문서-코드 동기화

```
코드 변경 시 자동으로 관련 문서 섹션 하이라이트
또는 pre-commit hook으로 문서 업데이트 리마인더
```

---

## 5. 핵심 교훈 요약

| 카테고리 | 교훈 |
|----------|------|
| 테스트 | 실행 방법 먼저 결정 → 그에 맞는 구조 작성 |
| 에이전트 | 명시적 권한/fallback 항상 포함 |
| 문서화 | 코드 변경과 동시에 문서 업데이트 |
| 커밋 | 작고 독립적인 커밋 선호 |
| 가설 검증 | 작은 실험 → 검증 → 확대 |
| 협업 | 사용자 강점 활용 (접근 권한 등) |

---

## 6. 다음 세션 체크리스트

- [ ] 테스트 파일 구조 통일 (scripts/ vs unit/ vs integration/)
- [ ] generate-report.ts 파라미터화 리팩토링
- [ ] 팩트체크 에이전트 fallback 로직 강화
- [ ] pre-commit hook으로 문서 동기화 검사 추가
