# 공개 경매 이벤트 계약

| 항목 | 값 |
| --- | --- |
| 계약 버전 | **0.1.0** |
| 상태 | **USER_APPROVED — D-095의 정의된 의미를 구현 기준선으로 채택. OPEN·미검증 유지, 독자 변경 금지** |
| 작성일 | 2026-10-15 |
| 신규 실행 | 제품 구현·실제 SSE·재접속·장애·브라우저·성능 검증 모두 **NOT_RUN** |
| 책임 | Solution Architect & Contract Owner |

## 1. 원본과 적용 범위

이 문서는 공개 SSE의 전달·순서·중복·재생·재동기화 의미를 소유한다. payload 필드·자료형·필수값·enum·입력 오류의 원본은 [OpenAPI](openapi.yaml)다.
동일 JSON 스키마나 완전한 payload 예제를 여기 복제하지 않는다. 스키마와 본문의 의미가 충돌하면 승인된 것으로 추정하지 않고 변경 절차로 해결한다.
본 계약은 [SYSTEM-DESIGN](../docs/architecture/SYSTEM-DESIGN.md)과 [ADR-001](../docs/decisions/adr/ADR-001-TRANSITION-TIME.md)·[ADR-002](../docs/decisions/adr/ADR-002-DURABLE-RECEIPT-AND-ORDERING.md)·[ADR-003](../docs/decisions/adr/ADR-003-FAILURE-AUTHORITY-AND-RECOVERY.md)의 범위별 채택을 구체화한 구현 기준선이다.
승인된 정책·요구사항은 [DECISION-LOG](../docs/decisions/DECISION-LOG.md)와 [MVP-PRD](../docs/product/MVP-PRD.md)가 원본이다.
검토본 `0.1.0-draft.2`의 정의된 의미를 D-095로 승인받아 `0.1.0`으로 정식화했다. 승인 기록·파일 식별은 [승인 기준선](approved-baseline-0.1.0.json)을 따른다. OPEN의 미선택 값·deferred·실행/운영 보장은 제외된다. 유찰 결과는 D-094의 `NoSaleResult`를 사용하며 진행 중 가격 회수·개인 원기록 삭제를 뜻하지 않는다. 이벤트 구조·순서·복구 의미가 같아 `schemaVersion` 1을 유지한다.
설계·계약 초안 작성에는 추가 실험 통과를 요구하지 않는다. 계약 채택과 실행·운영 보장의 확인은 별도 상태로 기록한다.

## 2. 연결 경로와 공개 권한

- 전체 공개 상태: `GET /api/v1/rounds/{roundId}/snapshot`.
- 공개 SSE: `GET /api/v1/rounds/{roundId}/events?cursor={opaque}`.
- snapshot 응답의 스키마 원본은 [AuctionSnapshot](openapi.yaml#/components/schemas/AuctionSnapshot)이다.
- stream의 논리 payload 원본은 [StreamEvent](openapi.yaml#/components/schemas/StreamEvent)와 참조하는 네 이벤트 스키마다.

공개 가능한 해당 회차의 snapshot·SSE는 비회원도 구독할 수 있다. 로그인 여부로 공개 payload에 개인 필드를 추가하지 않는다.
인증 토큰·세션·비밀번호를 URL query나 cursor에 넣지 않는다. cursor는 조회 범위·재생 위치를 나타내며 인증·개인 원판정 조회 권한이 아니다.
존재하지 않거나 공개 조회가 허용되지 않는 회차의 HTTP 응답은 OpenAPI를 따른다. stream 시작 전 HTTP 오류와 시작 후 재동기화 신호를 구분한다.
URL 회차는 유효하지만 전달한 cursor가 다른 회차·세대에 속하면 §7의 재동기화 신호를 보내고 연결을 종료한다.
SSE가 공개라는 이유로 내부 최저낙찰가 원금액·입찰자/낙찰자 식별·거래 이메일·개인 원키를 노출하지 않는다.

## 3. 이벤트 종류와 상태의 의미

| SSE `event` / payload `type` | 스키마 원본 | 의미 |
| --- | --- | --- |
| `round.state.changed` | [RoundStateEvent](openapi.yaml#/components/schemas/RoundStateEvent) | 해당 회차의 새 공개 상태. data는 [PublicRoundState](openapi.yaml#/components/schemas/PublicRoundState) |
| `lane.state.changed` | [LaneStateEvent](openapi.yaml#/components/schemas/LaneStateEvent) | 해당 회차·레인의 새 공개 상태. data는 [PublicLaneState](openapi.yaml#/components/schemas/PublicLaneState) |
| `stream.heartbeat` | [HeartbeatEvent](openapi.yaml#/components/schemas/HeartbeatEvent) | 권위 버전과 서버 시각의 관측 표본. 업무 상태 변경이나 결과 확인이 아님 |
| `stream.resync-required` | [ResyncRequiredEvent](openapi.yaml#/components/schemas/ResyncRequiredEvent) | 이 연결의 cursor로 계속 적용할 수 없다는 제어 신호. snapshot 복구 또는 지원 버전 확인 필요 |

상태 이벤트는 변경 조각이 아니라 해당 scope의 완전한 공개 상태를 전달한다. 클라이언트는 검증한 새 버전의 상태를 한 번에 교체한다.
낙찰·유찰·취소·중단·보류·실제 재개의 공개 표현은 참조 상태 스키마를 따른다. 기존 제품 정책에 없는 최종 결과를 만들지 않는다.
입찰 업무 거절·개인 확인 상태가 공개 상태를 바꾸지 않는다면 공개 laneVersion과 이벤트를 증가시킬 필요가 없다.
공개 변화가 있으면 그 scope의 버전 증가·상태·해당 이벤트 outbox를 같은 업무 트랜잭션으로 보존한다.
같은 scope·버전의 상태를 서로 다른 내용으로 발행하지 않는다. 이벤트 전송을 위한 네트워크 송신은 업무 commit 뒤 별도로 수행한다.
공개 입찰 상태 변화가 본인의 원입찰 승인·현재 최고입찰·최종 낙찰을 모두 의미하는 것은 아니다. 개인 판정 복구는 §9를 따른다.

## 4. 식별·버전·권위 시각

`schemaVersion`은 payload 의미·구조를 식별하는 기술 버전이며 이 기준선은 정수 1을 사용한다. 문서 버전·API 경로 버전과 서로 다른 축이다.
`streamEpoch`는 상태 버전 이력을 비교할 수 있는 세대의 불투명 식별자다. authorityEpoch·프로세스 실행·incident·중단 발생 건과 합치지 않는다.
`roundId`는 불투명 회차 식별자이고 `laneId`는 그 회차 안의 레인 번호다. 다른 회차의 같은 레인 번호는 별개 scope다.
`roundVersion`·`laneVersion`은 OpenAPI의 10진 정수 문자열 규칙을 따르고 초기값 0도 허용한다. JavaScript Number로 바꾸어 정밀도를 잃지 않는다.
클라이언트는 정수 문자열의 숫자값을 비교한다. 문자열 사전순이나 서로 다른 레인·회차의 버전 크기로 선후를 정하지 않는다.
`eventId`는 업무 이벤트의 고유 식별자다. 전역 commit 순서·전체 replay 위치를 뜻하지 않으며 SSE의 `id`와 같은 개념이 아니다.
공식 요청의 양의 `receiptSequence`는 개인 처리 기록의 순서다. 공개 이벤트·snapshot·cursor payload에 노출하지 않고 공개 상태 버전과 혼용하지 않는다.

상태 이벤트의 `occurredAt`은 그 공개 변화의 outbox와 함께 영속한 서버 기록 시각이다. 발행·수신·앱 반영 시각으로 다시 만들지 않는다.
이를 WAL flush 완료·COMMIT 성공 응답·준비/재개의 실제 S/N/R과 자동으로 동일시하지 않는다. 권위 전이 경계의 잔여 위험은 ADR-001을 따른다.
heartbeat·재동기화 신호의 `serverTime`은 해당 응답을 구성하며 관측한 서버 시각 표본이다. 클라이언트 수신 순간의 정확한 현재 시각이 아니다.
snapshot의 서버 시각도 입찰 공식 접수나 최종 결과의 증거가 아니다. 카운트다운은 표시 추정이며 로컬 0초로 낙찰·유찰을 확정하지 않는다.
시각은 [OpenAPI의 UtcInstant](openapi.yaml#/components/schemas/UtcInstant)를 따르는 UTC RFC 3339 표현이다. 일정 계산·표시는 승인된 Asia/Seoul 기준을 따른다.
원래 정밀도·비교·직렬화·절삭 규칙은 공통 계약에서 일관돼야 한다. 임의 반올림·클라이언트 시각으로 원접수·마감을 보정하지 않는다.

## 5. SSE 프레임 규약

stream은 UTF-8 `text/event-stream`을 사용한다. 프레임 구분·재접속·`Last-Event-ID`의 브라우저 동작은 [WHATWG SSE 표준](https://html.spec.whatwg.org/multipage/server-sent-events.html)을 따른다.
업무 상태 프레임의 `event`는 payload `type`과 일치하고 `data`는 참조 이벤트 스키마에 맞는 JSON이다. 프레임 완결 전에 적용하지 않는다.
내구 업무 상태 프레임에는 §6의 불투명 vector cursor를 `id`로 넣는다. `eventId`를 그대로 넣지 않는다.
heartbeat·resync-required에는 **`id` 필드를 넣지 않으며 cursor를 전진시키지 않는다.** 이 프레임에 브라우저가 이전 lastEventId를 표시해도 새 업무 적용 사실이 아니다.
주석 keep-alive는 구현상 사용할 수 있지만 권위 버전을 광고하는 heartbeat를 대신하지 않는다. 임의 `retry` 값을 업무 timeout·확정 결과로 해석하지 않는다.
연결 큐 삽입·송신 성공·published 표시·EventSource 수신은 서로 다른 관측이다. 서버는 그것을 앱 반영 ACK로 기록하지 않는다.

서버가 연결을 닫으면 EventSource는 재접속할 수 있다. 따라서 재동기화 제어 신호를 받은 앱은 기존 source를 명시적으로 닫고 다음 복구 경로를 선택한다.
payload 역직렬화 실패·미지원 schemaVersion·`event`/`type` 불일치는 성공 적용으로 처리하지 않는다. 같은 연결을 무한 재시도해 해결됐다고 표시하지 않는다.

## 6. Cursor의 범위와 전진 규칙

cursor는 해당 streamEpoch·회차와 회차/레인별 적용 위치를 서버가 해석할 수 있는 불투명 값이다. 클라이언트는 분해·증가·다른 회차로 합성하지 않는다. SSE `id`에 사용할 수 있도록 NUL·CR·LF 없는 단일행이어야 하며 정확한 wire 조건은 [StreamCursor](openapi.yaml#/components/schemas/StreamCursor)가 원본이다.
snapshot cursor는 같은 읽기에서 확보한 공개 회차·레인 상태와 각 watermark를 나타낸다. snapshot에 포함되지 않은 미래 이벤트까지 전진시킬 수 없다.
각 연결에서 송신하는 업무 프레임의 cursor는 이전 송신 cursor에서 **이번 프레임 scope의 해당 버전까지만** 전진한다.
아직 보내지 않은 다른 scope 이벤트를 DB에서 읽었거나 outbox batch 상한을 알았다는 이유로 cursor의 다른 성분을 올리지 않는다.
예를 들어 레인 2 상태를 먼저 보냈다고 아직 안 보낸 레인 1 상태의 watermark까지 전진시키면 안 된다. 낮은 전역 outbox ID의 늦은 commit도 누락하면 안 된다.
재전송한 동일 이벤트는 동일 scope·버전에 합류하며 새 공개 업무 효과를 만들지 않는다. cursor의 바이트 표현 자체를 업무 이벤트 고유성으로 쓰지 않는다.

cursor query와 `Last-Event-ID`가 모두 있으면 **query cursor를 우선한다.** 새 snapshot에서 얻은 기준으로 수동 재동기화할 수 있게 하는 채택 규칙이다.
query가 유효하지 않을 때 header로 조용히 fallback하지 않는다. 두 값이 모두 없으면 snapshot을 요구하는 `CURSOR_INVALID` 신호 후 연결을 닫는다.
고정 cursor가 있는 EventSource URL은 자동 재연결 때 같은 query를 다시 보낼 수 있다. 이 경우 오래된 위치에서의 중복 재생은 허용하고 클라이언트가 제거한다.
앱은 마지막으로 검증·적용한 기준이나 새 snapshot cursor로 source를 새로 만들어 재접속할 수 있다. 브라우저 last event ID가 앱 reducer 성공을 증명하지 않는다.
앱 상태 적용 실패 후 브라우저가 더 앞선 Last-Event-ID로 재접속하면 누락될 수 있으므로, 실패를 관측하면 그 연결을 버리고 snapshot으로 복구한다.
cursor 내용·길이·무결성·세대 판별의 실제 구현은 OpenAPI 제한과 서버 검증을 따라야 하며 cursor에 사용자 비밀을 담지 않는다.

## 7. 재동기화 신호와 실패 분류

reason의 정확한 enum은 [ResyncRequiredEvent](openapi.yaml#/components/schemas/ResyncRequiredEvent)가 원본이다. 이유별 앱 행동은 다음과 같다.

- `EPOCH_CHANGED`: 기존 cursor·모델의 세대 비교를 중단하고 새 snapshot으로 전체 기준을 교체한다.
- `CURSOR_INVALID`: cursor 부재·해석 불가·회차 불일치·권위 위치와 모순 등을 처리한다. 값 수정·추측 대신 새 snapshot을 받는다.
- `REPLAY_UNAVAILABLE`: 필요한 영속 재생 범위를 복원할 수 없다. 누락 구간을 건너뛰어 live만 시작하지 않는다.
- `BUFFER_OVERFLOW`: 유한 큐/버퍼로 더 이상 올바른 인계를 유지할 수 없다. 해당 연결을 종료하고 snapshot부터 복구한다.
- `PROTOCOL_UNSUPPORTED`: 지원 가능한 클라이언트·schemaVersion인지 확인한다. 같은 비호환 요청을 무한 자동 재시도하지 않는다.

`snapshotUrl`은 OpenAPI가 허용하는 상대 URL로 검증한다. 제어 payload가 임의 외부 URL이나 인증 정보를 요구하는 것으로 신뢰하지 않는다.
서버는 가능하면 신호를 보낸 뒤 연결을 닫는다. 끊긴 연결·느린 소비자에게 마지막 신호 전달을 보장하지 않으므로 앱은 무신호 종료도 복구할 수 있어야 한다.
snapshot 조회 실패는 미확인·연결 복구 상태로 남긴다. 복구되지 않은 모델을 정상 최신 상태로 표시하지 않는다.
이 신호는 원입찰 거절·경매 결과·운영자 재개 명령이 아니다. 공개 SSE-only 오류만으로 경매 전체 장애를 추가하지 않는다.

## 8. 초기 연결·재생에서 live로 인계

**초기 권고 흐름은 snapshot-first다.** 이전 시스템 설계의 구독 준비 우선 후보를 영속 cursor 재생을 명시하는 다음 프로토콜로 구체화한다.
서버는 읽기 전용 일관된 트랜잭션에서 전체 공개 상태·세대·watermark·cursor를 함께 구성한다. 다른 읽기에서 얻은 더 높은 cursor를 사후 결합하지 않는다.

1. 클라이언트는 snapshot을 받아 같은 읽기의 회차·레인·세대·watermark·cursor를 한 기준으로 적용한다.
2. 그 cursor를 query에 넣어 SSE를 연다. snapshot 반환과 실제 stream 등록 사이의 변화는 영속 outbox에서 재생해야 한다.
3. 서버는 연결의 제한된 live 버퍼를 먼저 등록한 뒤, cursor 이후 필요한 모든 영속 이벤트를 scope별로 조회한다.
4. 각 scope는 연속 버전으로 재생하고 live 버퍼와 합친다. replay/live 중복은 같은 scope·버전으로 제거한다.
5. 아직 재생하지 않은 이벤트를 건너뛰어 live cursor를 전진시키지 않는다. 인계 경계의 공백·보존 부족·버퍼 초과는 §7로 전환한다.
6. 인계 후 live 상태 이벤트를 보낸다. 상태 저장과 outbox의 원자성은 업무 경로가, 중복·인계·느린 연결 격리는 전파 경로가 책임진다.

서버의 실제 등록·조회 barrier·dispatcher 연계는 구현에서 검증해야 한다. 이 문서의 단계 나열이 무손실 인계 성공의 증거는 아니다.
outbox를 전역 ID 하나로 읽어 낮은 ID의 늦은 commit을 누락하는 구현은 허용하지 않는다. 회차/각 레인의 영속 순서·존재를 확인한다.
서로 다른 scope 이벤트 사이에는 전역 순서·동시 렌더를 보장하지 않는다. 전체 snapshot은 한 일관된 단면이고 live 이벤트는 각 scope의 완전한 새 상태다.
클라이언트는 회차 이벤트로 임의의 레인 상태를 재작성하거나 다른 레인 버전을 끌어올리지 않는다. 교차 scope의 동시 화면 갱신이 필요해지면 별도 계약 변경으로 다룬다.

### 8.1 클라이언트의 적용·중복·공백 처리

같은 streamEpoch·roundId인지 확인한 뒤 회차 이벤트는 roundVersion, 레인 이벤트는 해당 laneId의 laneVersion과 비교한다.
버전이 같거나 작으면 상태를 덮어쓰지 않는다. 같은 scope·버전에 다른 내용이 관측되면 프로토콜 이상을 기록하고 snapshot을 다시 확인한다.
정확한 다음 버전만 적용하고 원자적으로 로컬 상태·적용 버전·사용 가능한 cursor를 갱신한다. 버전 공백은 누락을 추정 보정하지 않고 재동기화한다.
한 연결의 프레임 적용은 수신 순서로 직렬화한다. 앞선 프레임을 반영하기 전에 뒤 프레임 cursor를 적용 완료 기준으로 확정하지 않는다.
다른 scope의 더 높은 숫자로 현재 이벤트가 오래됐다고 판단하지 않는다. `eventId` 중복 집합만으로 버전 검사를 대신하지 않는다.
버퍼·메모리가 무한 증가하지 않게 하고 중복 재동기화는 single flight로 합친다. 재시도 분산·jitter를 적용할 구체 수치는 아직 확정하지 않는다.
새 snapshot을 적용할 때 그 기준 이전의 pending 이벤트·옛 연결 callback을 폐기한다. 이전 세대 이벤트로 새 모델을 되돌리지 않는다.
미지원 schemaVersion이나 반복되는 스키마 실패는 연결을 중단하고 지원 여부를 확인한다. 새 snapshot도 해석할 수 없으면 성공 복구로 표시하지 않는다.

### 8.2 마지막 이벤트 유실과 heartbeat

heartbeat의 권위 회차/레인 버전을 같은 scope의 로컬 적용 버전과 비교한다. 이벤트가 더 오지 않는 마지막 유실도 이 차이로 발견할 수 있어야 한다.
비교 표본 동안 live가 전송 중일 수 있으므로 불일치를 자동 장애·업무 거절로 확정하지 않는다. snapshot 재동기화를 합치고 반복 폭주를 막는다.
heartbeat는 업무 상태·cursor를 갱신하지 않는다. 로컬보다 작은 권위 버전·세대 불일치는 원본·연결을 확인하고 snapshot으로 재설정한다.
heartbeat 주기·무응답 탐지·retry/backoff·버퍼·재생 창의 숫자는 계약/운영 설정의 후속 승인 대상이다. 장애 감지 상한으로 임의 확정하지 않는다.

## 9. 개인 원요청과 앱 확인의 별도 복구

로그인한 앱은 공개 상태 복구와 별도로 다음 REST 경로를 사용한다. 정확한 입력·권한·응답은 OpenAPI가 원본이다.

- `GET /api/v1/me/bid-intents?auctionId={auctionId}`로 본인 공유 의도·미확인 상태를 확인한다.
- `GET /api/v1/me/bid-requests/{requestId}`로 원입찰 접수·원최종 판정을 확인한다.
- `POST /api/v1/me/bid-requests/{requestId}/acknowledgements`에 원 `outcomeId`를 결합해 수신·반영을 자동 확인한다.

공개 SSE·snapshot·heartbeat·서버의 응답 송신 성공은 이 ACK를 대신하지 않는다. 어느 한 기기의 유효 ACK만으로 해당 원의도 제한을 해제한다.
원키는 원경매·원금액에 결합하고 같은 키로 조회·실제 제출 재시도를 복구한다. 현재 최고자 변경·회차 이동·새 cursor를 이유로 새 키를 자동 생성하지 않는다.
원판정이 없다는 단순 조회 결과·timeout·재연결 횟수 소진은 최종 거절·미접수 종료·제한 해제의 근거가 아니다.
입찰이 원래 승인됐는지와 현재 최고입찰·최종 낙찰 상태는 구분한다. 오래된 원승인 응답이 현재 공개 상태를 과거로 덮어쓰면 안 된다.

## 10. 재생 보존·복원 세대·장애 경계

공개 replay 보존 창·개수·정리 방식은 OPEN-10/12의 후속 결정이다. 보존 부족 시 snapshot으로 현재 상태를 복구한다.
진행·보류·미확인 원판정·중복 식별 기록의 MVP 자동 만료 없음(D-080)은 공개 replay 창과 다르다. replay 정리가 원기록 삭제를 허용하지 않는다.
DB 백업 복원·회차 전환 때 cursor 의미가 바뀌면 streamEpoch를 구별한다. 앱 재시작·authority 변경마다 무조건 같은 세대를 새로 만든다는 규칙은 추가하지 않는다.
세대 변경은 소실된 원키·원접수·원판정을 복구했다는 증거가 아니다. 원기록이 불명하면 ADR-003의 보류·증거 확인을 따른다.
새 snapshot이 중단·보류면 그 상태를 복원한다. 연결이 살아났다고 경매를 재개하거나 시간·원 R을 새로 부여하지 않는다.
실제 outage·관측·영속 보류와 old transaction 권한은 공개 전파와 다른 문제다. replay 성공만으로 장애 중 잘못된 확정을 막았다고 주장하지 않는다.

## 11. 검토·검증과 변경 절차

이번 문서는 범위별 승인된 계약이며 실제 SSE 인계·자동 EventSource 재접속·snapshot 폭주 보호·세대 복원 검증은 NOT_RUN이다.
기존 [SPIKE-001](../docs/spikes/SPIKE-001.md)의 지정 재생·재접속 사례, 100연결 조건 통과와 200연결 실패는 그 원환경·표본·측정 경계에서만 인용한다.
이 기준선의 snapshot-first·opaque vector cursor·회차 이벤트·schemaVersion·제품 UI가 기존 실험으로 통과됐다고 계산하지 않는다.

후속 검증에서는 다음을 독립적으로 확인한다. 이는 새 실행 결과나 고정 운영 수치가 아니다.

- snapshot과 연결 등록 사이 변화, replay/live 역전·중복·마지막 유실·다른 scope 동시 변화.
- batch 상한의 미송신 cursor 전진 차단, 이전 EventSource callback·앱 적용 실패·query/header 충돌.
- 잘못된 회차/세대·보존 부족·느린 연결·신호 미도달·미지원 schema와 재동기화 single flight.
- 공개 정보 경계, 원키/ACK 복구, 보류 snapshot과 원판정 불변, 실제 브라우저·실패 표본·자원 적체.

변경은 [계약 검토 절차](README.md)를 따른다. 구현 담당은 관련 R/D/INV·ADR, 의미·호환성·스키마 diff·BE/FE/QA 영향과 예제를 Contract Owner에게 제출한다.
payload 스키마는 OpenAPI에서 한 번 수정하고 이 문서는 의미·참조를 맞춘다. D-095로 승인한 0.1.0의 정의된 의미를 구현 담당이 독자 변경하지 않는다. 남은 OPEN의 값·deferred 확장은 별도 결정·변경 절차를 따른다.
파괴적 변경의 버전·소비자 이행·구버전 연결 종료 방법을 검토하며, 문서 lint·스키마 검사와 실제 전달·복구의 실행 증거를 분리한다.
