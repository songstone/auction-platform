# SPIKE-001 HTTP 정합성·재시작·SSE 장애 실행 근거

작성일: 2026-10-15. RunId 시각은 UTC다. 이 파일은 `harness/`가 실제 실행한 결과를 요약한다. 제품 구현·운영 승인·전체 성능 통과를 뜻하지 않는다.

## 성공한 주요 실행

명령의 작업 디렉터리는 저장소 루트다. `python`의 실제 실행 파일은 `C:\Python314\python.exe`, 버전은 3.14.0, OS는 `Windows-11-10.0.26200-SP0`였다. 같은 Windows PC의 두 JVM(`127.0.0.1:18081`, `18082`)과 공유 PostgreSQL을 실제 HTTP로 호출했다. 시각 경계는 명시적으로 주입한 합성 밀리초이며, 프로세스 종료·재시작·HTTP/SSE 통신은 실제 실행이다.

| 실행 / 실제 명령 | RunId / 원본 요약 | 종료 코드 | 결과 | 실행 JAR |
| --- | --- | --- | --- | --- |
| `python experiments/spike-001/harness/correctness.py --repeats 100 --failure-repeats 10` | [20261015T021332Z-1e76d614](correctness/20261015T021332Z-1e76d614/summary.json) | 0 | **480/480 PASS** | A |
| `python experiments/spike-001/harness/regressions.py --repeats 10` | [20261015T022437Z-6bae40cf](regressions/20261015T022437Z-6bae40cf/summary.json) | 0 | **100/100 PASS** | B |
| `python experiments/spike-001/harness/correctness.py --repeats 0 --failure-repeats 10 --only 'E2_(recovery_hold\|resume_identity\|known_pending_recovery\|unknown_history_hold\|clock_regression_hold\|bid_before_actual_resume)\|E1_bid_STOP'` | [20261015T022641Z-b84a9905](correctness/20261015T022641Z-b84a9905/summary.json) | 0 | **80/80 PASS** | B |
| `python experiments/spike-001/harness/crashes.py --repeats 10` | [20261015T021920Z-cfc74566](crashes/20261015T021920Z-cfc74566/summary.json) | 0 | **40/40 PASS** | A |
| `python experiments/spike-001/harness/stream_crashes.py --repeats 10` | [20261015T023341Z-65be92ac](stream-crashes/20261015T023341Z-65be92ac/summary.json) | 0 | **20/20 PASS** | C |

위 정규식의 Markdown 표 안 `\|`는 표 구분자 escape다. 그대로 실행할 명령은 해당 `summary.json`의 `command` 배열 또는 아래 명령을 사용한다.

```powershell
python experiments/spike-001/harness/correctness.py --repeats 0 --failure-repeats 10 --only 'E2_(recovery_hold|resume_identity|known_pending_recovery|unknown_history_hold|clock_regression_hold|bid_before_actual_resume)|E1_bid_STOP'
```

각 디렉터리에는 `http-trace.jsonl`(실제 HTTP 요청·응답·네트워크 오류·단조 시계 경과시간), `cases.jsonl`(개별 검증·원시 DB audit), `summary.json`(실행 인자·환경·건수·Python 소스 hash)이 있다. 성공한 예비 smoke와 실패한 이전 실행도 삭제하지 않았다. 행 수를 합쳐 서로 다른 고유 시나리오 수로 주장하지 않는다.

JAR SHA-256은 각 실행 시작 시 읽어 기록했다. A 이후 중단 발생 건 식별을 보완하고 B에서 관련 회귀를 다시 실행했으며, C는 이후 재빌드에 대한 SSE 실험이다. **480·40을 C의 전체 재실행 결과로 바꾸어 보고하지 않는다.** 최신 `environment.json`의 JAR hash가 다르더라도 과거 실행의 hash를 덮어쓰지 않는다.

| JAR | SHA-256 |
| --- | --- |
| A | `ab99c28ae622e49e51050ecd1a887129bed5ce28b20b397f2c10a6f9dfa6f652` |
| B | `9c51035bcea9ef79981b9fd98bea5edd71d0b37d857774c15794905adda52aab` |
| C | `88ee58ccc4deed6ff061e02859f9ca3976263a885cd2fa3c77e654c9fbae6284` |

## 실제 경쟁·장애 결과

- **20명 같은 금액 동시 입찰 100회:** 각 회차마다 유효 공식 순번 첫 요청 1건 승인, 19건 거절. 대표 첫 회차의 실제 승인은 `member-10 / same-10`, 순번 1, 접수 1000ms, 금액 10000이었다. DB의 최고입찰자·최고가도 각각 `member-10 / 10000`, 새 마감은 6000ms였다. HTTP 도착·스레드 실행 순서를 정답으로 지정하지 않았다.
- **판정 역전 시도 100회:** 선행 무효 입찰의 판정 트랜잭션을 멈춘 상태에서 다른 JVM의 후행 처리를 경쟁시켰다. 선행 거절 후 후행 유효 입찰 승인과 공식 순번을 보존했다. 같은 동안 레인 2의 입찰은 진행했다. 별도 자동 worker 회귀 10회에서 레인 1을 멈춰도 레인 2가 자동 판정됐고, snapshot은 커밋된 상태를 반환했다.
- **접수 커밋·마감 틈 10회:** 9950ms 접수 기록의 커밋 전 정지 중 10000ms 타이머가 먼저 완료하지 못했다. 이후 원접수 9950ms 입찰을 승인하고 14950ms 마감을 보존했다. 유효/무효 선행 입찰, 개시 직전·정각·직후, 긴 판정 지연과 단순 타이머 지연, 입찰과 STOP/CANCEL 양방향 순서를 각각 검증했다.
- **중복·확인·복구:** 원승인과 원거절 재사용, 종료 뒤 승인 재조회, 개시 후에도 원래의 개시 전 거절 보존, 회원×경매 공유 의도 하나, 다른 기기의 의도 조회·제출, 미접수·미결 확인의 제한 해제 금지, 옛 확인이 새 의도를 해제하지 않음, 내용 충돌과 원기록 보존을 확인했다. 완전한 미결 이력은 원시각으로 처리하고, 불명·시계 역행은 미결·보류를 유지했다.
- **실제 JVM 종료 40회:** 접수 커밋 직전/직후·판정 커밋 직전/직후 각각 10회. Windows 프로세스 종료 코드는 모두 **71**, 재기동 명령 종료 코드는 모두 **0**이었다. 생존한 다른 JVM이 각각 `NOT_FOUND / PENDING / PENDING / ACCEPTED`를 관찰했다. 미커밋 접수는 명시적 복구·재개 뒤 재전송의 최초 실제 접수 시각을 사용했고, 커밋된 접수는 원시각·원순번을 보존했다. 최종 입찰 효과는 한 번이었다.
- **실제 SSE와 종료 20회:** 커밋 후 상태 전송 전 10회, 실제 클라이언트가 상태 프레임을 받은 후 발행 표시 전 10회. 대상 outbox는 모두 종료 직전 `published=false`였다. 후자의 10회는 별도 HTTP SSE reader가 정확한 레인·버전의 프레임을 실제 파싱한 뒤에만 종료했다. PID 파일과 `/health`의 PID를 대조한 전용 JVM만 종료했고, 종료 코드는 모두 **72**, 재기동 명령 종료 코드는 모두 **0**이었다. 다른 서버를 통해 해당 버전을 실제 다시 수신했고, 이미 받은 버전은 무시했으며, 원승인과 최고가를 보존한 채 네 레인의 권위 snapshot으로 수렴했다. `emitter.send` 호출만으로 클라이언트 수신을 추정하지 않았다.
- **전역 outbox ID cursor 반례 10회:** 레인 1의 낮은 ID 이벤트 커밋을 늦춘 동안 레인 2의 높은 ID가 먼저 커밋됐다. 나중에 보인 레인 1 이벤트는 높은 전역 ID cursor로 조회하면 빠질 수 있는 실제 자료였다. 레인별 버전 조회는 해당 이벤트를 찾았다.

## 발견·수정·재검증 이력

| 이전 관찰 | 보존한 실행 | 처리 / 후속 증거 |
| --- | --- | --- |
| 완전한 미결 이력을 복구했지만 PREPARING 상태의 과거 개시를 반영하지 않아 `NOT_OPEN` 거절 | [초기 단일 JVM smoke 29/30](correctness/20261015T020411Z-8ed968b8/summary.json) | 과거의 확정 가능한 개시를 반영하면서 장애 보류는 유지. 이후 주 실행과 관련 회귀 PASS |
| `actor + ':' + key`로 만든 중단 ID 충돌. 서로 다른 `a:b/c`, `a/b:c`가 같아 옛 재개가 새 중단을 해제 | [실제 실패 1/1](regressions/20261015T021101Z-5521550a/summary.json) | 영속 발생 건 UUID로 변경. 후속 10회 PASS |
| 장애 보류→새 수동 중단, 수동 중단→새 장애 보류에서 기존 token을 재사용. 옛 재개가 두 사유를 잘못 해제 | [실제 실패 2/2](regressions/20261015T022222Z-62e3d55b/summary.json) | 새 사유의 token을 갱신하고 두 사유와 최초 보류 경계는 보존. B에서 두 순서 각각 10회 PASS |
| 첫 전체 실행 477/480. `WinError 10048` 2건과 fixture TRUNCATE/조회 간 DB deadlock 1건 | [실패 전체 실행](correctness/20261015T020606Z-71b6b54b/summary.json) | HTTP 요청마다 새 연결을 만들던 발생기를 재사용 pool로 수정. fixture reset은 lane table lock을 먼저 획득. 새 전체 실행 480/480 PASS. 포트 오류는 서비스 정책 실패로 집계하지 않음 |
| PowerShell로 JVM은 기동됐지만 Python의 캡처 pipe 완료가 반환되지 않아 첫 crash runner를 중단 | [완료 0건, INCOMPLETE](crashes/20261015T021642Z-832f649f/interrupted.json) | 전용 harness 프로세스만 중단. 파일 기반 stdout/stderr와 DEVNULL stdin으로 수정 후 smoke 4/4 및 실제 종료 40/40 PASS |
| 층별 중단 보완 뒤 시계 역행 검증기가 기존 stopId 유지까지 요구해 90/100 | [검증기 조건 실패](regressions/20261015T022350Z-2fda2c53/summary.json) | 실제로는 새 fault token과 미결·수동 중단·보류가 올바르게 유지됨. 내부 ID 동등성 조건을 제거하고 입찰 가능 구간·마감 불변을 검사. 동일 코드에서 100/100 PASS |

초기 smoke 일부는 JAR hash 필드가 추가되기 전 기록이다. 이 누락을 추정 hash로 채우지 않았다. 실패 실행은 성공한 것처럼 수정하지 않았다.

## 독립적인 저장 이력 검사

`python experiments/spike-001/harness/verify_evidence.py <run-directory>`를 실행했고 아래 모두 종료 코드 0이다. 이 검사는 **저장된 실제 HTTP audit의 오프라인 재검사**이며 서비스 추가 실행이 아니다.

| 실행 | audit 관찰 수 | 결과 |
| --- | --- | --- |
| 전체 480 | [430](correctness/20261015T021332Z-1e76d614/audit-invariants.json) | PASS |
| 층별 수정 후 회귀 100 | [80](regressions/20261015T022437Z-6bae40cf/audit-invariants.json) | PASS |
| 관련 회귀 80 | [30](correctness/20261015T022641Z-b84a9905/audit-invariants.json) | PASS |
| JVM 종료 40 | [80](crashes/20261015T021920Z-cfc74566/audit-invariants.json) | PASS |
| SSE 종료 20 | [20](stream-crashes/20261015T023341Z-65be92ac/audit-invariants.json) | PASS |

검사 대상은 승인 요청과 입찰 행의 일대일 대응, 원금액·순번·접수 시각, 현재 최고 금액·최고입찰자와 마지막 승인 입찰의 일치, 정확한 입찰 단위, 승인 이력의 본인/연속 최고입찰 제한, 낙찰·유찰과 최저낙찰가 관계, 원판정 필드 일치, 회원×경매 미확인 의도 유일성, 커밋된 레인 버전과 outbox 버전의 연속성이다. 관찰 수에는 같은 기록의 반복 조회가 포함된다.

## 경계와 미검증

- 본 하네스의 HTTP 경과시간·재시작 시간은 **화면 p95나 운영 처리량 측정이 아니다**. 100연결 부하, 20/80 역할, 실제 브라우저 DOM, 느린 소비자·지연 프록시 시험은 별도 realtime 결과를 참조한다.
- E1 경계는 합성 시계로 제어했다. 실제 OS 시계를 바꾸지 않았고 시계 정밀도를 제품 정책으로 확정하지 않았다. `--seed`는 시나리오 표식이며 fixture는 결정적이다. OS 스케줄과 네트워크 도착 순서를 seed로 통제했다고 주장하지 않는다.
- 재기동 시 장애 범위와 이력 완전성은 실험의 명시적 복구 입력이다. 임의 네트워크 단절을 자동 감지하고 영향 범위를 증명한 결과가 아니다. DB 재시작 및 재개 시각과 물리 commit 간 차이는 별도 `environment-failures/` 결과를 참조한다.
- JVM 종료 증거는 전원·디스크 손실, DB failover, 여러 물리 배포 노드, 외부망 장애 검증을 대신하지 않는다. 인증·권한·운영 개인정보·완전한 제품 UI도 이 하네스의 검증 범위가 아니다.
- outbox `published`는 개별 사용자의 수신·반영 확인이 아니다. SSE 도착으로 원입찰 앱 확인을 대신하지 않았다. 네트워크 전체에 대한 exactly-once 전달을 주장하지 않는다.
- 실험 코드와 fixture·fault hook은 `experiments/spike-001/`에만 있다. 재현 방법은 [하네스 README](../harness/README.md)에 있다.

