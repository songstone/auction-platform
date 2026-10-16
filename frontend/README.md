# 프런트엔드 실행과 공개 회차 탐색

승인 계약 **0.1.0 / D-095**를 소비하는 React/TypeScript 앱이다. `/`에서 실제 `GET /api/v1/rounds`의 공개 목록을 조회하고 opaque cursor로 더 보기를 수행한다. 항목 선택 또는 `/?roundId=...`에서 `GET /api/v1/rounds/{roundId}`로 상태·일정·레인 수·시간 설정을 표시한다. 목록 복귀는 재조회하며 직접 링크·reload·뒤로/앞으로 이동을 지원한다. 로그인·출품·입찰·SSE·재접속·서버 ACK는 후속 구현이며 남은 OPEN과 지원 브라우저 인수 범위를 유지한다.

## 실행

이 작업에서 확인한 도구는 Node **24.19.0**, npm **11.17.0**이다. `.node-version`과 `packageManager`로 재현 기준을 표시하고 `engine-strict`로 해당 Node/npm 계열을 확인한다. Node 실행 파일이 PATH에 있어야 한다. 저장소 루트에서 다음을 실행한다.

```powershell
cd frontend
npm ci
npm run check:generated
npm run dev
```

기본 화면: <http://127.0.0.1:5173/>. 합성 회차를 명시적으로 준비한 로컬/테스트 DB의 조회 진입점은 <http://127.0.0.1:5173/?roundId=demo-round>다. DB와 백엔드 준비는 [루트 실행 안내](../README.md)를 따른다. 개발용 고정 예제는 <http://127.0.0.1:5173/?preview=contract>에서 백엔드 없이 실행하며 API 요청을 만들지 않는다. 개발 서버는 loopback에 바인딩하고 5173이 사용 중이면 다른 포트로 자동 이동하지 않는다. 프로세스는 `Ctrl+C`로 종료한다.

브라우저는 같은 출처의 `/api/v1`만 호출한다. `vite.config.ts`의 개발 서버와 로컬 production preview는 `/api`를 `AUCTION_API_TARGET`으로 전달하며 기본값은 `http://127.0.0.1:8080`이다. 예를 들어 백엔드가 18080에서 실행 중이면 Vite를 시작하기 전에 `$env:AUCTION_API_TARGET = 'http://127.0.0.1:18080'`을 설정한다. 이 변수는 Vite 서버의 테스트/개발 설정이며 브라우저 번들에 비밀을 넣는 용도가 아니다. 운영 배포의 동일 출처 라우팅은 별도 구성한다.

```powershell
npm run typecheck
npm test
npm run build
npm run preview
```

`preview`는 빌드 결과를 4173에서 확인하는 로컬 서버다. 개발 예제 진입 기능은 배포 번들에서 제거한다. `build`의 후속 검사는 배포 JavaScript에 개발 마커·선택한 합성 ID가 포함되지 않는지 확인한다. 이 문자열 검사는 전체 보안 검증을 대신하지 않는다.

## 공개 회차 흐름과 응답 경계

`src/rounds/round-client.ts`는 ID를 trim·분해하지 않고 정확히 `encodeURIComponent`하여 GET을 보낸다. 응답은 `application/json`·`no-store`를 확인한 뒤 `round-contract.ts`에서 승인된 닫힌 객체 구조를 검사한다. 예상하지 못한 필드, 다른 회차 ID, 숫자로 바뀐 counter, 레인 범위 위반, 잘못된 달력 날짜·UTC 형식·6자리를 넘는 소수 시각, 안전하게 표현할 수 없는 JS 정수 시간은 표시하지 않는다. 시간 설정의 safe-integer 검사는 표현 손실 방지이며 OPEN-05의 제품 상한을 승인하는 의미가 아니다. 미정 최소/최대 시간을 추가하지 않는다.

생성된 `PublicRoundPage`·`PublicRoundState`·`Problem` 타입을 사용하며 런타임 검사는 이 조회 경계의 필요한 필드만 다룬다. counter 원문과 최대 마이크로초 정밀도 문자열을 보존한다. 일정은 `Asia/Seoul`로 표시하고 `<time dateTime>`에는 원문 UTC 값을 둔다. 브라우저 현재 시각으로 회차 상태나 시작·종료를 판정하지 않는다. null인 실제 시작·종료·취소는 각 기록 부재로 표시한다.

화면은 loading·목록·빈 목록·상세·404·503·연결 실패·잘못된 응답과 수동 재시도를 구분한다. 목록/항목/중첩 필드도 닫힌 구조로 검사하며 서버 cursor를 해석하거나 페이지 크기를 가정하지 않는다. `Problem.message`, fieldErrors, 예외 원문은 화면에 출력하지 않으며 안전한 고정 안내를 사용한다. 새 조회는 기존 요청을 취소하고, 취소를 무시한 옛 응답도 요청 세대 검사로 폐기한다. 첫 페이지 새로고침은 이전 목록을 초기화한다. 다음 페이지 요청 실패는 기존 행과 cursor를 유지하여 같은 cursor로 재시도하고 정확 ID 기준으로 중복 추가를 막는다. 상세 새 조회의 실패는 이전 성공 정보를 현재 상태처럼 남기지 않는다. 자동 polling·SSE·로그인은 추가하지 않았다.

## 자동 브라우저 통합 검사

사용자가 요청한 자동 테스트 파일을 위해 `@playwright/test` **1.64.1**을 dev dependency로 정확 고정했다. 공식 npm metadata의 Node 요구는 `>=20`이며 저장소 Node 24.19.0으로 도구를 실행한다. 브라우저 실행기·assertion·trace가 필요한 범위에 사용하고 제품 runtime dependency에는 추가하지 않는다. [Playwright 설정](https://playwright.dev/docs/test-configuration), [Vite preview proxy](https://vite.dev/config/preview-options.html#preview-proxy).

`e2e/public-round.spec.ts`는 외부에서 실행한 실제 백엔드와 production preview를 사용한다. 새 `e2e/round-discovery.spec.ts`의 empty/discovery/recovery도 실제 서버를 사용하고, fault phase만 합성 HTTP 응답을 가로채 소비자 거부·재시도·취소를 검사한다. 기존 public-round 사례는 API route mocking이나 mock 서버를 만들지 않는다. `E2E_BASE_URL`은 필수이며 없으면 실행이 실패한다. Playwright 명령 자체는 서비스를 자동으로 생성하거나 기존 프로세스를 재사용하지 않는다. 아래는 `frontend/`에서 수동으로 실행하는 명령이며 통합 서비스 준비·정리는 루트 안내를 따른다.

```powershell
npm exec -- playwright install chromium
$env:E2E_BASE_URL = 'http://127.0.0.1:4173'
$env:E2E_PHASE = 'up'
npm run test:e2e
```

| phase | 외부 준비 상태 | 선택되는 검사 |
| --- | --- | --- |
| `up` | 격리 DB의 `demo-round`: 4레인·version `9007199254740993`, `demo-hidden`: 미공개, `demo-missing`: 없음 | 실제 공개 화면·404/재시도·목록 진입/상세/복귀/history·모바일 viewport·배포 fixture 제외 |
| `changed` | 같은 공개 레코드의 최초 입찰 시간을 15초·version을 `9007199254740994`로 변경, 4레인 유지 | 바뀐 DB 값의 HTTP 응답·DOM 반영 |
| `down` (`database-down`도 허용) | 백엔드를 유지한 채 해당 격리 DB 중지 | 실제 503·안전한 안내·재시도·이전 성공 상태 부재 |

기본 결과 경로는 ignored `output/playwright/public-round/<phase>/report.json`이며 screenshot·성공/실패 trace는 같은 경로의 `results/` 아래에 남긴다. 통합 실행기가 `E2E_ARTIFACT_DIR`을 전달하면 해당 디렉터리에 보고서와 결과를 모은다. timeout은 시험 실행 도구 설정이며 제품 장애 감지 기준이 아니다. Chromium 한 환경과 390px viewport smoke는 전체 지원 브라우저·모바일 인수를 뜻하지 않는다. 오류 원문 차단·response parser·옛 요청 폐기는 Node 단위 검사에서도 독립 검증한다.

새 phase `empty`는 migration만 수행한 빈 DB, `discovery`는 53개 공개 합성 회차의 전체 페이지·예약문자 ID 상세·history, `recovery`는 같은 Page/document의 실제 DB down/up 재시도다. `fault`는 합성 응답 7건이며 실제 DB 증거와 구분한다. 서비스/handshake 준비와 자기 자원 정리는 `scripts/verify.ps1 -Integration` 또는 portable runner가 수행한다. 최종 원시 결과는 `output/playwright/round-discovery/<run-id>/`에 저장된다. 수동 `E2E_PHASE` 지정만으로 DB 장애 orchestration을 대신하지 않는다.

## 계약 생성과 원본

- HTTP·이벤트 JSON 필드의 단일 원본: [contracts/openapi.yaml](../contracts/openapi.yaml).
- 이벤트 순서·cursor·재동기화 의미: [auction-events.md](../contracts/auction-events.md).
- 승인된 파일 식별: [approved-baseline-0.1.0.json](../contracts/approved-baseline-0.1.0.json).
- 변경 권한과 절차: [ADR-005](../docs/decisions/adr/ADR-005-CONTRACT-BASELINE.md).

```powershell
npm run generate:contract
npm run check:generated
```

`scripts/generate-contract.mjs`는 승인 manifest의 상태·버전·OpenAPI SHA-256 일치를 확인한 뒤 `openapi-typescript` 공식 Node API로 `src/generated/api.d.ts`를 생성한다. 같은 OpenAPI의 `components/examples`에서 11개 예제를 추출해 `src/generated/contract-examples.ts`를 만든다. 각 예제는 원본의 `x-schema-ref`를 따라 생성 타입에 `satisfies`로 연결한다. 파일에 원본 hash를 기록하고 freshness 검사는 두 생성물의 정확한 일치를 확인한다. 생성물은 독립 계약 원본이 아니며 직접 편집하지 않는다.

추출 대상은 `SnapshotFourLanes`, `RoundChanged`, `LaneChanged`, `Heartbeat`, `ResyncRequired`, `NoSaleLaneChanged`, `RegisteredIntent`, `PendingBid`, `ApprovedBid`, `RejectedBid`, `AcknowledgedBid`다. 미리보기는 이 원문을 수정하지 않는다. 생성 타입은 정규식·JSON Schema 조건식·권한·런타임 응답을 전부 검증하지 않는다. 공개 회차 조회에는 위의 별도 응답 검사를 적용했으며 후속 HTTP/SSE 경계에도 해당 계약 검증이 필요하다. 승인 계약은 프런트엔드 구현자가 변경하지 않는다.

실제 생성에서 `openapi-typescript 7.13.0`은 mapping 없는 discriminator의 literal을 분기 schema 이름으로 추론했다. 예를 들어 `round.state.changed` 대신 `RoundStateEvent`, `NO_SALE` 대신 `NoSaleResult`를 생성해 예제 타입 검사가 실패했다. `scripts/generator-input.mjs`는 **메모리상의 도구 입력 복제본**에 각 분기의 기존 필수 `properties.const`에서만 explicit mapping을 도출한다. 원본 OAS·const·예제·검증 제약은 수정하지 않으며 새 wire 값을 만들지 않는다. 필수 const 부재·중복·상충하는 기존 mapping은 추측하지 않고 실패한다. 이 어댑터와 원문 hash를 버전 관리하고 공식 도구 교체/업데이트 때 재검토한다. 관련 도구 동작은 [공식 discriminator 생성 코드](https://github.com/openapi-ts/openapi-typescript/blob/openapi-typescript%407.13.0/packages/openapi-typescript/src/lib/utils.ts)를 참고한다.

## 개발 예제의 범위

`?preview=contract`는 `import.meta.env.DEV`에서만 열리는 고정 예제 미리보기다. 모의 표시를 항상 보여 주며 기본 셸에는 예제를 자동 표시하지 않는다.

- 4레인 snapshot 원문과 회차/레인 버전을 표시한다. 예제 timestamp를 현재 서버 시각·현재 마감·남은 시간으로 계산하지 않는다. 금액은 문자열로 출력하며 버전은 `BigInt`로 비교한다.
- 4종 이벤트 payload를 버튼으로 전달한다. 초기 snapshot에 이미 포함된 회차/레인 변경 예제는 중복으로 처리한다. 별도 `NoSaleLaneChanged`는 레인 1의 다음 버전을 적용하고 유찰 종료 상태에 공개 최고가를 남기지 않는다.
- 같은 scope·버전의 다른 내용, 버전 공백, 세대/회차 차이, heartbeat 버전 불일치는 모의 재동기화 필요 상태를 만든다. 이 상태에서 추가 payload를 적용하지 않는다. 초기화는 같은 고정 snapshot을 다시 읽으며 서버 복구 성공을 뜻하지 않는다.
- 공유 의도 등록·내구 접수·원승인·별도 원요청의 거절·원판정 ACK 응답을 독립 열람한다. 버튼은 실제 입찰 상태 전이가 아니다. 원승인을 현재 최고자/낙찰과 동일시하거나 공개 SSE로 개인 ACK를 대신하지 않는다.

실제 EventSource·SSE framing·runtime schema validation·cursor 전진/저장·영속 replay·snapshot/live 인계·old callback 폐기·retry·자동 ACK·인증 정보 저장은 구현하지 않았다. 초기 snapshot의 cursor는 원문 식별만 표시한다. 미리보기 reducer를 완성된 실시간 클라이언트로 사용하지 않는다.

## 기술 선택과 호환성

2026-10-16 npm 공식 registry의 안정 `latest`와 명시 버전 메타데이터를 확인했다. 직접 의존성은 정확 버전이고 전이 의존성은 `package-lock.json`으로 고정했다.

| 선택 | 해결하는 문제와 이유 |
| --- | --- |
| React/ReactDOM **19.3.1**, 각 타입 **19.3.0** | 승인된 React/TS 방향에서 실행 가능한 단일 화면을 구성한다. ReactDOM의 React peer `^19.3.1`과 맞춘다. 지금 필요한 셸에 별도 라우터·상태 라이브러리를 추가하지 않았다. [React의 독립 앱 안내](https://react.dev/learn/build-a-react-app-from-scratch) |
| Vite **8.3.4**, React 플러그인 **6.1.2** | 로컬 개발 서버·React 갱신·정적 번들을 제공한다. 플러그인 peer `vite ^8.0.0`, Vite Node `^20.19.0 \|\| >=22.12.0`에 실제 도구가 들어간다. 도구의 기본 브라우저 변환 대상이 제품 지원 브라우저 승인값은 아니다. [Vite 실행 요구](https://vite.dev/guide/), [공식 플러그인](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react) |
| TypeScript **5.9.3**, openapi-typescript **7.13.0** | 계약 DTO의 수작업 복제를 줄이고 필드/분기 타입을 재현한다. 생성기의 peer `typescript ^5.x`를 지키기 위해 최신 TS 7 대신 안정 5.9.3을 고정했다. [공식 Node API](https://openapi-ts.dev/node), [TS 5.9](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html) |
| yaml **2.9.1**, Node 타입 **24.19.2** | OAS 예제를 같은 생성 단계에서 추출하고 도구 설정 타입을 확인한다. Node 내장 test runner로 예제 적용의 핵심 반례를 검사해 테스트 프레임워크를 추가하지 않았다. [yaml 공식 저장소](https://github.com/eemeli/yaml), [Node TypeScript 실행](https://nodejs.org/api/typescript.html) |

공식 registry 메타데이터 재확인 명령 예: `npm view vite@8.3.4 engines --json`, `npm view @vitejs/plugin-react@6.1.2 peerDependencies --json`, `npm view openapi-typescript@7.13.0 peerDependencies --json`. 전역 `npx ...@latest`로 생성하지 않고 lockfile의 로컬 도구를 사용한다.

## 검증 기록

현재 목록·상세·동일 열린 화면의 DB 복구 재시도·CI·미실행은 [ROUND-DISCOVERY-VERIFICATION](../docs/implementation/ROUND-DISCOVERY-VERIFICATION.md)에 기록한다. 이전 상세 검증은 [PUBLIC-ROUND-VERIFICATION](../docs/implementation/PUBLIC-ROUND-VERIFICATION.md)에 보존한다. 초기 골격의 실행 원본은 [FOUNDATION-VERIFICATION](../docs/implementation/FOUNDATION-VERIFICATION.md)에 보존한다. 아래는 프런트엔드 담당자가 2026-10-16에 이 디렉터리에서 실행한 **초기 골격의 당시 결과 이력**이며 현재 통합 검증표의 복제본이 아니다. 계약 정적 검사의 기존 PASS는 실제 제품 HTTP/SSE·DB·동시성·권한·장애·브라우저·운영 성공으로 확대하지 않는다.

| 검사 | 결과 |
| --- | --- |
| `npm ci` | PASS — 고정 lockfile로 57개 패키지 설치. 당시 npm audit 보고 0건 |
| `npm run check:generated` | PASS — 승인 OAS SHA-256 `4cad0ae25cb48ef7891176594093374ae5007587d28ac5563fc644e21aaa527d`와 생성물 일치 |
| `npm run typecheck` | PASS — 생성 freshness 검사와 TypeScript `--noEmit` |
| `npm test` | PASS — 12/12. 생성 어댑터·예제 적용·중복·공백·세대·heartbeat·유찰·원판정 식별의 로컬 반례 |
| `npm run build` | PASS — Vite 번들 생성 및 개발 예제 제외 마커 검사 |
| 브라우저 직접 렌더·실제 HTTP/SSE·인증·DB·부하·장애·배포 | NOT_RUN |
