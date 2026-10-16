# SPIKE-001 — 4레인 입찰·트랜잭션·실시간 복구 실험 보고서

## 1. 상태와 판단 범위

**COMPLETED_WITH_FINDINGS — 설계 판단용 실험 완료. 100연결 지정 부하·복원 검증 근거 확보, 200연결 실패와 시간/장애 계약의 잔여 위험 확인. 운영 채택 승인은 별도다.**

2026-10-15 사용자가 세 실험과 측정 조건을 승인했고 실행·컴파일 기준을 Java 25로 지정했다. 승인 당시 목표·성공 기준·예상값은 [계획 보관본](SPIKE-001-PLAN.md)에 남겼다. 이 보고서는 실제 실행 결과와 미검증 범위를 구분한다.

입력 정본은 [MVP PRD](../product/MVP-PRD.md), [경매 규칙](../product/AUCTION-RULES.md), [도메인 설계](../architecture/DOMAIN-MODEL.md), [결정 기록](../decisions/DECISION-LOG.md)이다. 제품·도메인 정책이나 Aggregate B/C 선택을 이 실험으로 변경하지 않는다.

| 항목 | 현재 판단 |
| --- | --- |
| 공식 접수·순번·입찰·마감 경계 | 지정 HTTP/DB 사례에서 실행 근거 확보. 합성 시각을 사용한 경계 결과이며 운영 전체 정확성 증명이 아님 |
| 원판정·공유 의도·중단·복구 | 지정 중복·실패·JVM 종료·DB 재시작 사례 근거 확보. 발견한 중단 토큰 결함 수정 및 관련 재검증 완료 |
| 실제 전이 시각 | **잔여 위험 확인:** 재개 시각 기록과 PostgreSQL 커밋 기록 시각 사이의 차이 및 그 시각 기준 잔여 시간 감소. 물리 내구성 완료 뒤 가용 시간의 직접 계측은 아님 |
| 실시간 전달·DOM·성능 | 100연결 기본/집중 각3회, 실제 브라우저5개 표본, 20연결 재접속400표본 근거 확보. 200연결 탐색은 pool 획득 실패로 FAIL, 400은 중단 조건에 따라 NOT_RUN |
| 운영 채택 / 종료 조건 | 최소 후보·관측 한계·후속 실험을 결정할 자료 확보. 전이 시각 계약·장애 진행 권한·조회 폭주 보호를 해결하기 전 운영 정합성/수용량을 확정하지 않음 |

## 2. 구현한 최소 후보

실험은 [experiments/spike-001](../../experiments/spike-001/README.md)에 격리했다. Spring MVC REST, `SseEmitter`, JDBC, PostgreSQL 한 자원을 사용한다. JPA, Redis, 메시지 브로커, WebFlux, WebSocket은 도입하지 않았다. 인증·실제 계정·배포·완전한 제품 UI를 구현한 프로젝트가 아니다.

| 경계 | 구현과 확인할 의미 |
| --- | --- |
| 공식 접수 | 레인 행의 `FOR UPDATE` 아래 현재 DB 시각·증가 순번·요청 기록을 같은 짧은 트랜잭션에 저장. 판정과 별도 commit |
| 판정 | 같은 레인 gate를 잡고 가장 낮은 미결 순번 처리. 입찰·제어·현재 개시/마감을 원접수 시각으로 비교 |
| 원자적 변경 | 승인 입찰·최고가/최고입찰자·단계·마감·원판정·레인 버전·outbox를 같은 트랜잭션에 저장 |
| 중복/확인 | 회원+요청번호 내용 결합, 회원×경매 미확인 의도 고유성, 원요청을 지정하는 앱 확인. 자동 TTL 없음 |
| 중단/재개 | 수동 중단과 장애 보류 유지. 새 중단 원인마다 토큰 갱신, 재개는 현재 토큰과 복구 확인을 검증 |
| 공개 snapshot | READ ONLY REPEATABLE READ로 읽고 레인 gate를 잡지 않음. 공개 응답에서 최저가 원금액·입찰자 식별 제외 |
| 이벤트 | 레인별 연속 버전을 재생 cursor로 사용. 각 JVM이 outbox를 읽어 자기 SSE 연결에 전달 |
| 클라이언트 | 구독·버퍼 준비 → snapshot → 새 버전 병합. 중복/옛 버전 무시, 공백/heartbeat 불일치 시 재조회 |
| 장애 연속성 | 오류를 관측한 JVM의 후속 worker 진입 차단. 이미 진행 중인 작업과 peer까지 원자적으로 차단하는지는 미검증. PostgreSQL postmaster epoch 변화 시 다음 상태 변경 전에 미완료 레인을 보류 |

[Engine.java](../../experiments/spike-001/src/main/java/spike/core/Engine.java)와 [schema.sql](../../experiments/spike-001/src/main/resources/schema.sql)이 권위 상태 실험 구현이다. Java 메모리 락·큐를 유일한 정합성 근거로 사용하지 않는다. 레인 순번은 롤백되는 행 counter이며 outbox 전역 sequence를 전체 재생 cursor로 사용하지 않는다.

정상 상태 변경은 공유 advisory lock으로 DB epoch만 확인하므로 서로 다른 레인의 gate를 동시에 사용할 수 있다. epoch가 바뀐 경우에만 배타 복구 경계에서 모든 미완료 레인의 보류와 새 epoch를 commit한다. 스키마 초기화의 별도 advisory lock은 동시 JVM 시작의 DDL 경쟁을 직렬화한다.

공식 접수 시각은 DB pool·레인 gate 대기 뒤 채취한다. HTTP가 마감 전에 도착했더라도 gate 획득이 마감 뒤면 늦은 접수로 판단할 수 있다. 기록 시각과 접수 commit 사이의 간격도 존재하며, gate가 그 사이 timer의 추월을 막는다는 범위다. 클라이언트 클릭/HTTP 도착 순서 보장으로 확대하지 않는다.

SSE 연결별 큐는 64개로 제한하고 가상 스레드가 쓴다. 연결별 실패·초과는 연결을 종료하며 DB 입찰 트랜잭션 안에서 네트워크 송신하지 않는다. 이 구조가 실제 느린 연결에서 충분한지는 §7 실행 자료로 판단한다.

## 3. 실제 측정 환경과 빌드 식별

최종 빌드의 환경 정본은 [environment.json](../../experiments/spike-001/results/environment.json)이며 수집 시각과 전체 hash를 포함한다. 초기 계획의 Java 7 PATH와 Docker 미기동 상태는 현재 실행 환경 설명이 아니다.

| 항목 | 실제 설정 |
| --- | --- |
| OS / CPU / 메모리 | Windows NT 10.0.26200.0, Intel i7-11800H, 논리 CPU 16, 물리 메모리 16,866,848,768 bytes |
| Java / 빌드 | Corretto 25.0.3, compilation release 25, Maven Wrapper 3.9.16, Spring Boot 3.5.16 |
| DB | PostgreSQL 18.6 Alpine, 전용 `auction-spike-001-db`, loopback 15432 |
| DB 자원 / 내구성 | CPU 2개·메모리 1GiB. `fsync`, `synchronous_commit`, `full_page_writes`, `track_commit_timestamp` 모두 on |
| 앱 2개 | loopback 18081/18082, JVM별 heap 128~512MiB, Hikari 최대 16·최소 4 |
| HTTP / 주기 | HTTP 스레드 최대 100·최소 8, 레인별 worker 10ms, outbox poll 40ms, heartbeat 1초 |
| 위치 | 부하 발생기·JVM 2개·Docker DB 모두 같은 Windows PC. 별도 서버/외부망 결과와 동일시하지 않음 |
| 시각 | 경계 시험은 주입한 합성 epoch milliseconds. 실제 실행은 DB `clock_timestamp()`를 millisecond로 기록 |

[Java 25 실행·컴파일 증거](../../experiments/spike-001/results/java25-verification.json)는 실행 중 peer PID 52152의 `jcmd VM.version`에서 `25.0.3+9-LTS`, `Engine.class`의 major version 69와 compilation release 25를 확인한 자료다. PATH의 기본 Java 버전을 실행 증거로 대신하지 않는다.

실행별 JAR이 다르므로 사례 수를 하나의 최신 바이너리 전체 검증으로 합치지 않는다. Python suite summary의 `serverJarAtInvocationSha256`와 harness hash가 당시 식별 근거다. realtime summary는 해당 JAR hash 필드를 갖지 않으며 `environment.sourceHashes`와 실제 앱 PID, 위 공통 environment의 최종 JAR hash를 함께 참조한다. 최종 UI 빌드 이후 실시간/부하 시험 중 서버를 재빌드하지 않았다.

- `ab99c28a…a6f652`: 전체 정확성 480건과 JVM 종료 40건. 이후 층별 중단 토큰 반례가 발견된 빌드다.
- `9c51035b…52aab`: 층별 중단 토큰 수정 뒤 회귀 100건과 영향 범위 80건 재검증.
- `88EE58CC…AE6284`: 화면·계측 보강 후 재빌드. Engine 코어 변경 없이 실행하며 전체 480건을 이 JAR로 다시 실행했다고 계산하지 않는다.
- 최신 Engine SHA-256은 환경 자료에 `9570BB92…84385B`로 기록되어 있다. 정확한 전체 hash는 링크한 JSON을 따른다.

이후 snapshot/event 공통 DOM 계측을 보강한 최종 UI 빌드는 `CABCAB…`이며 코어는 동일하다. Boot 3.5.16의 Java 25 호환 범위는 [공식 요구사항](https://docs.spring.io/spring-boot/3.5/system-requirements.html)으로 확인했다. 행 락의 의미는 [PostgreSQL 18 문서](https://www.postgresql.org/docs/18/explicit-locking.html), 커밋 시각 계측의 함수·보존 제약은 [시스템 정보 함수](https://www.postgresql.org/docs/18/functions-info.html)를 참고했다. 문서 확인은 실행 증거와 별개다.

## 4. 실제 실행 명령과 결과

명령의 작업 위치와 옵션은 각 실행 summary의 `command`가 정본이다. 아래 Python 명령은 저장소 루트 기준이며 DB 초기화 suite를 동시에 실행하지 않는다. 환경 준비·빌드는 [재현 안내](../../experiments/spike-001/README.md)를 따른다.

| 실행 | 실제 명령 / 결과 | 증거 |
| --- | --- | --- |
| 전체 정확성 | `python experiments/spike-001/harness/correctness.py --repeats 100 --failure-repeats 10` → **480/480 PASS** | [021332 summary](../../experiments/spike-001/results/correctness/20261015T021332Z-1e76d614/summary.json) |
| JVM 실제 강제 종료 | `python experiments/spike-001/harness/crashes.py --repeats 10` → **40/40 PASS** | [021920 summary](../../experiments/spike-001/results/crashes/20261015T021920Z-cfc74566/summary.json) |
| 수정 후 회귀 | `python experiments/spike-001/harness/regressions.py --repeats 10` → **100/100 PASS** | [022437 summary](../../experiments/spike-001/results/regressions/20261015T022437Z-6bae40cf/summary.json) |
| 중단·복구 영향 범위 | 아래 `--only` 명령 → **80/80 PASS** | [022641 summary](../../experiments/spike-001/results/correctness/20261015T022641Z-b84a9905/summary.json) |
| 실제 DB 재시작·commit 간격 | 실험 폴더에서 `python harness/environment_failures.py --db-repeats 10 --timing-repeats 10` → **DB 10/10 PASS + 간격 관측 10/10** | [023022 summary](../../experiments/spike-001/results/environment-failures/20261015T023022Z-5bd892c1/summary.json) |
| SSE 전송 전/수신 후 실제 JVM 종료 | `python experiments/spike-001/harness/stream_crashes.py --repeats 10` → **20/20 PASS**, 실제 종료72·재기동·다른 노드 재생 | [023341 summary](../../experiments/spike-001/results/stream-crashes/20261015T023341Z-65be92ac/summary.json) |

```powershell
python experiments/spike-001/harness/correctness.py --repeats 0 --failure-repeats 10 --only 'E2_(recovery_hold|resume_identity|known_pending_recovery|unknown_history_hold|clock_regression_hold|bid_before_actual_resume)|E1_bid_STOP'
```

각 RunId의 `cases.jsonl`은 기대값·실제 관찰·assertion을, `http-trace.jsonl` 또는 `trace.jsonl`은 실제 요청/응답·외부 명령·오류를 보존한다. 별도 `audit-invariants.json`은 저장된 audit 자료의 독립 재검사이며 추가 서비스 실행 수가 아니다. shell 종료 코드가 summary 필드에 없으면 그 파일만으로 별도 실행 코드를 주장하지 않는다.

### 경쟁 요청에서 실제 관찰한 내용

같은 금액 20명 동시 제출을 100회 수행하여 각 회차에서 공식 순번 첫 유효 요청 1건 승인·19건 거절을 확인했다. 첫 회차의 실제 승자는 `member-10 / same-10`, 순번 1, 합성 접수 시각 1000ms, 승인 금액 10,000원이었다. 최고가는 10,000원, 마감은 6000ms로 기록됐다. 특정 회원의 승리를 사전에 지정한 시험이 아니다. [원시 사례](../../experiments/spike-001/results/correctness/20261015T021332Z-1e76d614/cases.jsonl)

판정 순서를 뒤집으려는 경쟁 100회에서는 선행 무효 요청을 먼저 거절하고 후행 유효 요청을 승인했다. 레인 1의 판정 commit 직전 정지 중 레인 2가 진행한 증거를 함께 남겼다. 이는 논리적 독립성의 지정 사례이며 공유 CPU/DB에 의한 성능 간섭이 없다는 뜻은 아니다.

접수 commit 틈과 마감, 유효·무효 선행 입찰 뒤 정각 요청, 개시 직전/정각/직후, 옛 타이머, 장기 판정 지연과 콜백 지연, 중단/취소 순서, 원승인·원거절 재전송, 공유 의도·옛 확인, 이력 불명·시계 역행을 지정 사례로 실행했다. 480건은 100회 경쟁 2종과 10회 반복 28종의 합이다.

낮은 outbox 전역 ID의 레인 1 트랜잭션을 정지하고 높은 ID의 레인 2를 먼저 commit한 뒤 레인 1을 commit했다. 전역 `id > cursor`로만 읽으면 놓칠 수 있는 실제 순서이며 레인별 버전 조회는 늦게 나타난 이벤트를 찾았다. 이를 전역 ID의 commit 순서 보장으로 해석하지 않는다.

## 5. 실패를 통해 바꾼 부분

| 발견한 문제 | 실제 증거 또는 검토 경계 | 수정과 후속 확인 |
| --- | --- | --- |
| 보류 전 접수된 완전 이력의 개시 재구성 누락 | 초기 smoke **29/30**, known-pending 요청을 `NOT_OPEN`으로 거절 | 역사적 개시를 재구성하되 보류 유지. 이후 전체/영향 범위 검증에 포함. [초기 결과](../../experiments/spike-001/results/correctness/20261015T020411Z-8ed968b8/summary.json) |
| fixture reset과 snapshot의 테이블 잠금 순서 | 초기 전체 **477/480**, reset deadlock 1건 | reset에서 lane 테이블을 먼저 잠금. 공개 snapshot은 행 gate 없는 MVCC 읽기. [초기 결과](../../experiments/spike-001/results/correctness/20261015T020606Z-71b6b54b/summary.json) |
| 부하 발생기 소켓 고갈 | 같은 실행의 WinError 10048 2건 | HTTP 연결 재사용. 실패를 제품 정책 위반으로 바꾸거나 삭제하지 않음 |
| 중단 ID 문자열 구분자 충돌 | `a:b`+`c`와 `a`+`b:c`가 같은 ID, 옛 재개 승인 | 발생 UUID로 교체. [실제 실패](../../experiments/spike-001/results/regressions/20261015T021101Z-5521550a/summary.json) |
| 수동/장애 중첩에서 토큰 재사용 | 장애→수동, 수동→장애 모두 옛 재개가 새 원인을 해제하여 **2/2 FAIL** | 새 승인 STOP·새 장애마다 토큰 갱신. 원인·최초 보류 경계 보존. 수정 후 100+80건. [반례](../../experiments/spike-001/results/regressions/20261015T022222Z-62e3d55b/summary.json) |
| 판정/타이머 시각 역행 확인 부족 | 접수 때만 시계 역행을 확인하던 구현의 검토 결함 | 최신 접수보다 이른 판정/타이머도 이력 불명 보류. 원요청을 임의 거절하지 않음 |
| DB 재연결 후 자동 진행 위험 | worker 예외만 기록하면 마감 경과 뒤 자동 종료 가능하다는 검토 반례 | worker 연속성 차단과 영속 DB epoch guard 추가. 실제 DB 재시작 시험은 §6 |

한 레인 gate에서 대기하는 공개 조회가 다른 레인 잠금을 연쇄 점유하지 않도록 snapshot을 READ ONLY REPEATABLE READ로 변경했다. 동시 스키마 초기화·네 개 자동 worker 분리도 함께 적용했다. 검토로 수정한 부분과 실제 실패를 포착한 부분을 표에서 구분했다.

## 6. 실제 장애와 재개 시각 관측

### JVM 및 PostgreSQL 재시작

JVM 시험은 접수 commit 전/후, 판정 commit 전/후 네 지점에서 각각 10회 `Runtime.halt`를 실행했다. 사례별 실제 프로세스 종료 코드와 재기동 명령을 보존했다. 미commit 접수는 부재, commit된 접수·판정은 원기록 유지, 재기동 후 보류·명시적 복구를 확인했다. 40건은 층별 토큰 변경 전 JAR 결과이며 변경 후 관련 회귀를 별도로 수행했다.

JVM/SSE 종료 시험은 두 앱의 자동 판정을 끈 fixture에서 실행하고 `-Recover`로 재기동했다. **생존 peer가 다른 JVM 사망을 감지하고 필요한 범위를 자동 보류하는 membership/lease 기능은 미구현·미검증**이다. DB가 정상이고 자체 오류/보류가 없는 peer의 자동 worker는 계속 진행할 수 있다는 소스상 한계가 있다. 단일 JVM 사망을 항상 전체 장애로 분류하는 정책을 추가한 것은 아니다. [실행별 근거 요약](../../experiments/spike-001/results/E1-E2-evidence.md)

worker 오류 flag는 pump 진입에서 검사한다. 이미 진입한 다른 레인의 작업까지 즉시 취소하지 않으며 영속 보류는 별도 500ms 주기의 복구 작업에서 기록한다. 이 구간과 생존 peer의 진행은 소스에서 확인한 잔여 위험이며 실제 장애 범위를 완성한 증거는 아니다.

DB 최종 시험은 전용 컨테이너 라벨을 확인하고 PostgreSQL을 실제 KILL/start했다. 후속 마감 5000ms, 중단 대기 5200ms 자료에서 10회 모두 다음을 확인했다.

- DB 시계 샘플과 명령 시작/종료 단조 시각으로 kill 완료가 마감보다 앞섰음을 보수적으로 확인했다. 짧은 구간에서 DB wall clock이 역행하지 않았다는 가정을 기록했다.
- `pg_postmaster_start_time()` 변경과 두 JVM PID 유지로 DB 재시작과 앱 재시작을 구별했다.
- 복구 시각은 원마감 뒤였지만 최초 상품·승인 최고가·원판정을 유지하고 네 미완료 레인을 보류했다. 자동 낙찰·유찰·다음 상품 진행이 발생하지 않았다.
- 정리 단계에서 전용 DB start와 준비 상태를 다시 확인했다. 명령 timeout·실패·정리 오류도 기록하도록 harness를 구성했다.

첫 DB 실행은 **9 PASS + 1 fixture 조건 FAIL**이었다. 10번째 kill 완료의 보수적 시간 상한이 마감을 넘어 “마감 전 장애” 조건을 증명하지 못했다. 이를 제품 오류나 성공으로 재분류하지 않았다. 후속 시간/중단 시간을 늘린 새 실행에서 10회를 다시 수행했다. [보존한 첫 실행](../../experiments/spike-001/results/environment-failures/20261015T022834Z-265f2363/summary.json)

### 기록 시각과 PostgreSQL 커밋 기록 시각 — 미해결 계약

재개 판정 commit 직전에 500ms를 주입한 10회에서, 기록된 재개 시각→`pg_xact_commit_timestamp()`의 커밋 기록 시각 간격은 **518~561ms**였다. 설정한 단계 시간은 10,000ms지만 그 커밋 기록 시각 기준 마감까지 잔여 값은 **9439~9482ms**였다. [실측 10건](../../experiments/spike-001/results/environment-failures/20261015T023022Z-5bd892c1/cases.jsonl)

2026-10-15 ADR 검토에서 계측 경계를 명확히 했다. [harness의 계산](../../experiments/spike-001/harness/environment_failures.py)은 `committedMs - windowStartMs`, `deadlineMs - committedMs`이며 `committedMs`는 [Engine.events](../../experiments/spike-001/src/main/java/spike/core/Engine.java)의 커밋 타임스탬프 조회에서 온다. PostgreSQL 18.0 공식 소스는 커밋 기록 시각을 채취한 뒤 WAL flush·후속 처리를 수행한다. 따라서 이 수치를 물리 내구성 완료·락 해제·JDBC COMMIT 반환 뒤의 실제 가용 시간으로 해석하지 않는다. 이는 소스에 근거한 경계 정정이며 새 실행 결과가 아니다. 원자료의 `physicalCommitFullDurationSatisfied` 등 당시 필드명과 수치는 수정하지 않았다. [고정 PostgreSQL 소스](https://github.com/postgres/postgres/blob/3d6a828938a5fa0444275d3d2f67b64ec3199eb7/src/backend/access/transam/xact.c#L1348)

이는 간격 관측의 성공이지 “물리 commit부터 전체 시간 보장”의 성공이 아니다. 레인 gate가 commit 틈에 새 접수를 막더라도 이미 기록한 마감의 시간은 흐른다. 합성 시각의 재개 하한 시험으로 이 실제 시각 기록·저장 간격과 접수 가능성을 검증했다고 주장할 수 없다.

D-067~D-070의 권위 전이 기록 시각을 어떤 기술적 확정 경계와 결합할지 후속 결정이 필요하다. commit 시각을 쓰려면 그 시각의 영속 보존·projection·재시작 복원까지 설계해야 한다. 내부 기록 시각을 쓴다면 commit 지연의 의미와 보류 조건을 명시해야 하며 현재 정책이 자동으로 바뀐 것으로 취급하지 않는다.

## 7. 실시간·브라우저·성능 결과

| 시험 | 상태 | 실제 결과 입력 위치 |
| --- | --- | --- |
| 실제 SSE 전송 전/후 JVM 종료와 outbox 복원 | **20/20 PASS** | §4의 RunId. 실제 프레임 관찰과 published=false 확인 후 종료·재시작, 원판정/중복 무시/다른 노드 재생/4레인 snapshot 수렴 |
| 유실·중복·역전·느린 연결·마지막 이벤트 유실 | **80/80 PASS** | `node corruption.mjs --core-passed`, exit0, [024349 결과](../../experiments/spike-001/results/realtime/2026-10-15T02-43-49-025Z-corruption/corruption-summary.json). 8종×10회, 느린 연결64개 큐 초과 및 재접속 복원 포함 |
| 20클라이언트 재연결, 단절 5초/15초 | **20회·400표본 PASS** | `node reconnect.mjs --core-passed`, exit0, [034755 결과](../../experiments/spike-001/results/realtime/2026-10-15T03-47-55-440Z-reconnect/reconnect-summary.json). 각 단절10회, 버전·17상태필드 정확 일치, 기준 변경/오류0 |
| 100연결 기본/집중 부하 | **각 3회 PASS** | 각 60초 준비+300초 측정. 측정 1,800+4,500건, 시스템 실패·BID-only 정책 재생 오류0. [부하 근거](../../experiments/spike-001/results/realtime/LOAD-EVIDENCE.md) |
| 실제 Chrome DOM / 추가 RTT 100ms | **각100클릭 및 상태/DOM 비교 PASS** | `node browser-run.mjs --core-passed`와 `--base http://127.0.0.1:18091`, 각각 exit0. 아래 두 실행 자료와 측정 범위 참조 |
| 200/400연결 탐색 | **200 FAIL / 400 NOT_RUN** | 200연결 10초 준비+60초 측정1회: 300건 중146완료·154실패. DB pool 획득 timeout과 worker 중단·4레인 보류 관측. 악화 시 중단 조건에 따라400은 생략 |

최종 브라우저 근거는 [로컬 035235](../../experiments/spike-001/results/realtime/2026-10-15T03-52-35-179Z-browser/browser-summary.json), [추가 RTT100ms 035400](../../experiments/spike-001/results/realtime/2026-10-15T03-54-00-352Z-browser/browser-summary.json)이다. Chrome155.0.8059.40, 실제 브라우저5개(입찰2·관람3)+프로토콜95연결이다. 각각 5초·15초 재접속과 최종 검사의 세 지점에서 5개 화면의20개 core 필드·실제 상품/가격/상태/마감/입찰금액 문구가 권위 상태와 일치했다. 의도한 응답 유실1건씩은 원요청 키·저장 원판정으로 복구했고 정상 지연100표본과 분리했다. [최종 실제 화면](../../experiments/spike-001/results/realtime/2026-10-15T03-52-35-179Z-browser/four-lanes.png)

| 브라우저 측정 경계 | 조건 | N | p50 ms | p95 ms | p99 ms | 최대 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 클릭→본인 최종 DOM | 로컬 | 100 | 63.1 | 76.7 | 89.2 | 90.2 |
| DB commit→관람 DOM, 보정 추정 | 로컬 | 300 | 29.1 | 47.2 | 61.2 | 71.2 |
| SSE ready→복원 DOM | 로컬 | 10 | 27.5 | 151.3 | 151.3 | 151.3 |
| 클릭→본인 최종 DOM | 추가 RTT100ms | 100 | 395.1 | 408.5 | 420.8 | 434.3 |
| DB commit→관람 DOM, 보정 추정 | 추가 RTT100ms | 294 | 82.8 | 110.8 | 206.9 | 227.9 |
| SSE ready→복원 DOM | 추가 RTT100ms | 10 | 143.6 | 147.4 | 147.4 | 147.4 |

commit×관람자 예상쌍은 각각300/294개이고 모두 관측했다. 시계 오차·관측 drift를 더한 p95 추정은50.7/171.3ms이며 엄밀 상한은 아니다. 클릭 cadence는 실제2.002/2.007건/초, 500ms 이상 늦은 클릭은0이지만 직전 결과를 기다리는 직렬 브라우저 driver다. 네트워크 복구→5개 DOM 전체 복원 벽시계 관측은 로컬195/90ms, 지연 조건325/310ms였다. 자동 reconnect/backoff·100개 실제 브라우저·5분×3회의 DOM 측정은 **NOT_RUN**이다. 따라서 이 표본의 R-49 관련 임계값 충족을 전체 운영/R-49 인수 완료로 확대하지 않는다.

최종 프로토콜 재접속은 **별도20연결 fixture**에서 단절5초/15초 각각10회 실행했다. SSE ready→snapshot 모델 적용400표본은 p50 26.6 / p95 38.0 / p99 46.1 / 최대51.1ms였다. 단절 중 수동 STOP8회·장애 HOLD8회를 포함하고 상품 전환·입찰을 함께 발생시켰다. 100연결 중20개를 동시에 복구한 부하 시험으로 확대하지 않는다. 실제 브라우저의 별도100연결 조건에서는5개 화면의 재접속을 관측한다.

100연결의 실제 실행 명령은 `node load.mjs --scenario base --connections 100 --core-passed` 및 `node load.mjs --scenario concentrated --connections 100 --core-passed`이고 각각 exit0이었다. 기본값인 준비60초+측정300초×3회를 모두 실행했다. 아래는 **intent 등록 시작→최종 응답 관측**이며 DOM 지연과 ACK 완료는 제외한다. 단위는 ms다.

| 부하·회차 | 측정 완료 N | 승인 / 거절 | p50 | p95 | p99 | 최대 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 기본 1 | 600 | 600 / 0 | 65.8 | 95.6 | 141.1 | 376.3 |
| 기본 2 | 600 | 600 / 0 | 64.9 | 80.4 | 97.8 | 427.2 |
| 기본 3 | 600 | 600 / 0 | 65.0 | 81.7 | 108.3 | 776.3 |
| 집중 1 | 1,500 | 343 / 1,157 | 306.3 | 483.8 | 595.4 | 952.3 |
| 집중 2 | 1,500 | 338 / 1,162 | 307.6 | 500.9 | 615.4 | 752.1 |
| 집중 3 | 1,500 | 336 / 1,164 | 312.5 | 513.2 | 590.8 | 654.3 |

집중 부하의 20명 경쟁180묶음 중117묶음은 1건 승인·63묶음은 전부 정상 거절이었다. 5초 경쟁 간격과 후속 마감5초가 겹치며 상품 교체·준비도 포함한다. 다른 세 레인의 측정900건은 모두 승인됐다. 레인1 응답 p95는493.6~521.2ms, 다른 레인은114.6~161.3ms였다. 레인 독립성은 공유 자원 성능 간섭이 없다는 뜻이 아니다.

각 측정5분의 자원 표본20개에서 주 JVM 힙 최대는112.6~120.2MiB, 주 JVM CPU p95는 논리 코어1개 기준28.3~33.6%, DB CPU p95는43.6~64.3%였다. 락 대기 표본 최대0을 실제 대기 부재로 해석하지 않는다. 원시 요청의 접수→기록 판정 p95는 기본22~23ms, 집중281~302ms였다. DB pool 대기의 연속 분포·GC·순간 최대치는 **NOT_MEASURED**이며, 200연결의 pool 오류 메시지는 별도 장애 관측이다. 반복·레인별 모든 분포, 시간 매핑, 표본 간격, 원시 hash는 [전체 분석](../../experiments/spike-001/results/realtime/full-load-analysis.json)과 [상세 부하 근거](../../experiments/spike-001/results/realtime/LOAD-EVIDENCE.md)를 따른다.

200연결 탐색은 [034020 원시 결과](../../experiments/spike-001/results/realtime/2026-10-15T03-40-20-964Z-concentrated-200/summary.json), [실패 후 상태](../../experiments/spike-001/results/realtime/2026-10-15T03-40-20-964Z-concentrated-200/post-failure-observation.json), [오프라인 분석](../../experiments/spike-001/results/realtime/exploration-analysis.json)에 보존했다. `HikariPool-1`의 total16/active16/idle0/waiting88 및 3018ms 획득 timeout이 worker 오류로 기록됐다. 네 레인의 `WORKER_CONTINUITY_LOST` 보류와 `manual=true`, 미결54건이 관측됐다. 측정 실패154건은 관측 timeout54와 비최종 응답을 최종 판정으로 읽지 못한100건이다. 완료146건만의 p95 6500.4ms를 성공 수치로 사용하지 않는다.

200클라이언트의 누적 snapshot은989회, gap 감지는781회였다. 공용 pool에서 입찰·worker·snapshot 조회가 경쟁하며 heartbeat 후 여러 클라이언트가 함께 재조회할 수 있다는 소스상 원인 후보가 있다. 중첩 연결 획득은 발견하지 못했다. 최초 포화를 일으킨 요청·pool 점유 stack·GC·순간 락 자료는 없어 직접 원인은 미확정이다. 장애 보류 이후 미결 요청을 정상 BID-only oracle로 재생한 파생 불일치를 오승인 건수로 바꾸지 않는다. 이 한 번의 실패는 현재 조건의 한계이며 절대 최대 동시 사용자 수를 확정하지 않는다.

200연결에서도 입찰자20명과 집중 발행률 평균5요청/초는 유지하고 관람 역할만80→180명으로 늘렸다. 입찰률을 두 배로 올린 시험이 아니다.

해석 기준은 다음과 같다. 수치가 추가되어도 아래 경계를 유지한다.

1. 부하 audit validator의 “정책 오류 0”은 **BID-only fixture 재생** 범위다. 금액·접수 순서/구간·최고가·원판정·결과·outbox 버전을 검증하며 공유 의도·중단·권한 전체 검증을 대신하지 않는다.
2. 최종 부하 harness는 자동 worker를 멈춘 뒤 snapshot을 받아 4레인 버전과 핵심 상태 필드 일치를 검사한다. 이 검사는 최종 권위 상태의 일치이며 모든 중간 SSE의 도달 증거는 아니다. 500ms 클라이언트 연결 표본·15초 서버 표본과 stream 오류/워밍업 실패를 별도 집계한다.
   서버 `streamErrors`는 writer·poll·heartbeat 공용이며 의도한 연결 종료 뒤 writer 실패도 포함하고 reset 뒤 늦게 증가할 수 있다. 개별 원인 로그가 없어 각 증가분을 정상 종료/비정상 장애로 확정 분류하지 못한다. 부하 통과 검사는 해당 실행 클라이언트의 unexpected end/error와 연결 표본을 사용하며 원시 서버 카운터도 보존한다. 운영 계측에서는 원인별 분리가 필요하다.
3. 실제 시도 수/기간·계획 대비 미전송·500ms 슬롯 지연을 기록한다. 일정 지연/연결 감소/전체 기간 실패를 조건 미충족으로 판정한다. 준비 중 시도도 전송하여 정상 거절을 기록하며 예정 부하를 묵시적으로 줄이지 않는다.
4. 완료 표본 p95는 timeout·미확인·시스템 실패를 포함하지 않는다. 이 수를 전체 시도와 함께 보고하며 실패가 있는 실행을 완료 p95만으로 통과시키지 않는다. 현재 polling의 10초 관측 제한은 등록·최초 제출 이후 시작하고 프로토콜 HTTP별 제한은 15초다. 따라서 승인 계획의 클릭부터 총 10초인 관측 제한을 완전히 구현한 결과가 아니다. 표본 지연에는 등록·제출을 포함하지만, 이 전체 시간초과 동작은 **NOT_RUN**으로 남긴다.
5. DOM 시험의 기본 구성은 실제 브라우저 5개(입찰 2·관람 3)+프로토콜 95개다. 이를 100개 브라우저 또는 전체 부하 기간의 DOM 측정으로 확대하지 않는다. 실제 역할·샘플·반복 수를 쓴다.
6. commit→DOM은 측정 구간의 DB journal×관람자3에 대해 해당 버전 이상의 상태가 처음 DOM에 반영된 시각을 찾는다. 이벤트와 snapshot 반영을 모두 계측하고 예상/관측/누락 수를 보고한다. 더 최신 상태로 합쳐진 중간 버전을 개별 화면에 반드시 표시했다는 뜻은 아니다.
7. 시계 보정은 시작/끝 offset의 선형 보간과 RTT 오차를 가정한 추정이다. 관측 drift를 더해도 내부 clock step까지 보장하는 엄밀 상한은 아니다. DOM 수정 후 RAF callback 경계를 실제 화면 paint 완료로 확대하지 않는다.
8. 실행 도구의 `pass`와 R-49 임계값 판정을 구분한다. 클릭→최종 DOM p95 1초, 상태 확정→다른 DOM p95 1초, 재연결→복원 p95 3초는 각각 해당 경계·실패·표본 조건으로 평가한다.

브라우저 초기 [024700](../../experiments/spike-001/results/realtime/2026-10-15T02-47-00-340Z-browser/browser-failure.json) 및 [024854](../../experiments/spike-001/results/realtime/2026-10-15T02-48-54-371Z-browser/browser-failure.json) 실행은 새 ready 관측을 기다리다 timeout했다. 후속 관측에서는 브라우저 offline 주입만으로 기존 SSE 종료를 증명하지 못했다. 명시적 UI 연결 닫기→offline→온라인 복귀→UI 재연결로 바꾸고 실제 연결 수 100→95를 확인했다. 이는 자동 EventSource 재연결의 성공/실패 판정이 아니며 해당 자동 동작은 **NOT_RUN**이다.

재연결 지연 표본은 SSE ready 이후의 snapshot 또는 DOM 복원 경계다. 별도 `networkRestoredToAllDomMs`는 5개 화면 전체의 벽시계 관측이며, 자동 retry/backoff 포함 p95를 대신하지 않는다. 시계 역행 시험도 최신 접수 시각보다 작은 판정/tick을 감지한 범위이며 모든 wall-clock 후퇴·전진을 감지한 결과가 아니다.

초기 재접속 검사는 새 버전이 기준보다 크면 통과하는 경로가 있어 실제 필드와 DOM의 정확 일치를 추가했다. [고정100ms 정지 대기 실행](../../experiments/spike-001/results/realtime/2026-10-15T03-42-51-924Z-reconnect/reconnect-summary.json)은 5초 단절 반복4/7에서 이미 시작한 worker가 기준 snapshot 뒤에 끝나며 기준 자체가 변해 실패했다. 이는 클라이언트가 옛 상태로 회귀한 관측과 다르다. 최종 절차는 단절 중 전이 후 실험 자동 worker를 끄고 1초간 상태 불변을 관측한 뒤 기준을 정하며, 복원 후 기준 불변도 재검사한다. 이 준비 시간은 복원 지연 표본에 넣지 않는다. 제품 STOP 정책이나 운영 pause barrier를 구현한 것으로 해석하지 않으며, 진행 중 snapshot 경쟁은 별도 corruption 사례에서 검증한다.

`published`는 연결 큐 삽입 뒤 기록하며 클라이언트 수신 확인이 아니다. “실제 전송 후 발행 기록 전 종료” 시험은 dispatcher를 발행 기록 전에 정지하고 독립 SSE 관찰자의 해당 lane/version 수신 및 DB `published=false`를 확인한 뒤 종료해야 한다. writer 훅만으로 두 조건을 동시에 입증하지 않는다.

초기 E3 전체는 [77/80](../../experiments/spike-001/results/realtime/2026-10-15T02-38-52-239Z-corruption/corruption-summary.json), 관측 대기만 보강한 부분 재시험은 [17/20](../../experiments/spike-001/results/realtime/2026-10-15T02-42-22-227Z-corruption/corruption-summary.json)이었다. 화면 수렴은 했지만 일부 중복/옛 프레임을 실제 관측하지 못해 실패로 남겼다. 소스 검토에서 hub cursor 초기화와 DB fixture reset 사이에 poll이 옛 cursor를 다시 채울 수 있음을 확인했다. 실패 당시 cursor 로그까지 확보한 것은 아니다. reset 전 dispatcher 정지로 이 경쟁을 차단하고 8종 전체80건을 재실행했다. 이 보완은 격리 fixture 절차이며 온라인 회차 전환·전체 노드 복원 계약의 검증이 아니다.

## 8. 권고 후보와 후속 결정

현재 근거는 **MVC + REST/SSE + PostgreSQL 영속 접수·레인 gate·원판정·outbox + 버전 snapshot 복구**를 다음 설계의 최소 후보로 유지하는 데 유용하다. 전체 운영 구조 채택이나 제품 코드 편입을 승인한 결과는 아니다.

100연결 지정 부하는 통과했지만 200연결 탐색에서 공용 DB pool 획득 실패와 전체 보류가 발생했다. 후속 우선순위는 조회 폭주와 worker/입찰의 pool 경쟁을 계측하고, 동시 snapshot 조회 합치기·조회 요청 제한·상태 변경 작업의 DB 접근 보호를 비교하는 것이다. 이는 설계 후보이며 이번에 구현·검증하지 않았다. 단순 pool 증설, Redis/브로커 도입 또는 WebFlux 전환을 이 결과만으로 처방하지 않는다.

| 선택 | 현재 권고 / 추가 근거가 필요한 조건 |
| --- | --- |
| 비관적 락 | 공식 순서·짧은 접수/판정 경계의 시작 후보 유지. 한 레인의 직렬 구간은 서버 증설만으로 사라지지 않음 |
| 낙관적 락 | **비교 미실행.** 재시도 시 원접수·순번·선행 처리 보존 비용을 포함한 동일 정확성 비교 필요 |
| Redis | 현재 권위 상태/중복/의도 구현의 필수 요소로 확인되지 않음. 캐시·연결 공유의 실측 필요가 생기면 역할과 장애 비용 검토 |
| 메시지 브로커 | 두 JVM outbox 조회부터 검증. 독립 소비자·fan-out·적체/재생 요구가 확인되면 비교. DB 원자성을 자동 해결하지 않음 |
| WebFlux / WebSocket | 현재 미비교. SSE 쓰기·자원 병목 또는 지속 양방향 채널 요구가 입증되면 대안 검토 |
| Aggregate B/C | **미결정.** 한 트랜잭션·gate의 논리적 원자성 증거를 물리 객체/aggregate 선택 승인으로 바꾸지 않음 |

후속 ADR에는 다음 미해결 계약을 반드시 포함한다.

코드 위치·대안·다음 반례 조건은 [아키텍처 결정 입력 메모](SPIKE-001-DECISION-INPUTS.md)에 모았다. 해당 메모는 제안이며 제품 정책이나 ADR을 확정하지 않는다.

- **시간:** 공식 접수와 전이 기록/commit 경계, 정밀도, 시계 역행, 지연 보류 및 재개 전체 시간의 의미.
- **장애:** postmaster epoch는 실제 DB 재시작을 감지하지만 임의 네트워크 분할·failover·전체 서비스 가용성 증거를 완성하지 않는다. worker 오류 차단도 범용 분산 장애 감지기가 아니다.
- **중단 발생:** 실험의 각 명시적 `hold` 호출을 새 발생으로 취급한다. 같은 장애의 반복 관측을 합치려면 영속 incident ID와 중복 처리 계약이 필요하다.
- **이력 불명:** `historyComplete=false`는 보류를 유지한다. 운영자가 나중에 이력을 증명한 뒤 정상 확인 상태로 전환하는 관리 절차/API는 구현하지 않았다.
- **전파:** per-lane cursor·snapshot 병합, 마지막 유실 확인, 보존/재생 범위와 느린 연결 처리. 원입찰 앱 확인은 공개 SSE 수신과 별도다.
- **회차/세대:** fixture ID는 `L1-A1` 형태의 단일 회차 모델이며 round namespace가 없다. 운영 cursor에는 회차·레인 또는 세대 epoch가 필요하다. 백업 복원/회차 전환으로 버전이 낮아졌을 때의 클라이언트 재동기화 계약은 **NOT_RUN**이다.
- **성능:** 같은 PC·loopback·작은 DB에서 관측한 값이다. 레인별 지연·lock/queue·pool·CPU/메모리·dispatcher 지표의 확보 범위와 미측정 항목을 분명히 한다.

전원/디스크 손실, PostgreSQL failover, 외부망, 장기 보존/삭제, 인증·권한·제품 전체 흐름, 다수 배포 노드 운영은 별도 검증이 필요하다. 현재의 실험 구현과 성공 사례를 이러한 영역의 PASS로 기록하지 않는다.

**종료 판단:** 이 spike는 설계 판단용 증거 확보를 완료했다. 공식 접수 이후 순서·원자적 판정·원요청 복원·버전 기반 상태 수렴을 최소 후보로 유지할 근거와, 200연결 pool 포화의 실패 근거를 확보했다. 운영 구현 착수 전 전이 확정 시각, 진행 중 작업/생존 peer의 장애 권한, 조회 폭주 보호 및 계측, 회차/복원 세대 계약을 후속 결정해야 한다. 실험 코드와 성공 사례를 제품의 운영 보장으로 편입하지 않는다.

실행 종료 후 실험 JVM 2개·지연 프록시·자원 수집기를 종료하고 전용 DB 컨테이너를 정지했다. DB 데이터와 성공·실패 원시 자료는 보존했다. [정리 확인 기록](../../experiments/spike-001/results/cleanup.json)
