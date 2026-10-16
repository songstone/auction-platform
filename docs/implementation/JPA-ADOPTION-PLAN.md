# JPA 적용 계획 — 업무 엔티티·Spring Data Repository·BIGINT PK

## 1. 범위와 현재 상태

2026-10-16. D-096과 [ADR-006](../decisions/adr/ADR-006-JPA-DOMAIN-ENTITIES.md)의 엔티티·도메인 통합 및 Spring Data Repository 사용을 구현 작업으로 분해한다. SYSTEM-DESIGN 1.1 / DOMAIN-MODEL 1.3 / 계약 0.1.0을 입력으로 사용한다. 이번 문서 반영은 설계·계획 변경이며 실제 JPA 의존성·엔티티·DB 전환의 완료가 아니다.

현재 업무 테이블은 V1의 `auction.rounds` 하나이며 `round_id text COLLATE "C"`가 PK다. 실제 업무 API는 JDBC 공개 회차 목록·상세 조회다. identity/listing/auction 명령의 제품 클래스는 아직 없으며 신규 구현과 기존 코드 전환을 구분한다. M-02 계정 정책·계약의 미승인 범위는 유지한다.

| 결정된 구조 | 구현 시 상세화·검증할 것 |
| --- | --- |
| 업무 엔티티와 JPA 엔티티 통합, 별도 영속 모델·매퍼 없음 | 실제 엔티티 필드·연관관계·값 매핑 |
| 서비스에서 Spring Data Repository 직접 사용 | 실제 프록시·flush·트랜잭션·잠금 |
| 업무 테이블 BIGINT PK/FK 방향 | sequence·backfill·제약·잠금 시간·데이터 검증 |
| 외부 opaque 문자열 ID·현재 API 보존 | 기존 URL·정확 ID·cursor·정렬 회귀 |
| 일반 동적 검색 Specification, 복잡한 조회 SQL 병용 | 실제 조건·권한·실행계획. Querydsl은 선택 전 검증 |

## 2. 코드 구성

```text
auction/
  domain/                    Round, Auction 등 @Entity와 업무 메서드
  application/               유스케이스, @Transactional 서비스
                             RoundRepository extends JpaRepository<Round, Long>
  publicapi/                 기능 간 업무 포트와 불변 입출력
  infrastructure/            custom repository fragment, gate/counter SQL
query/
  application/               기존 조회 유스케이스·읽기 포트
  infrastructure/            읽기 전용 SQL·DTO projection
  publicapi/                 승인 응답 DTO
```

기본 CRUD를 감싸는 저장 포트·구현체·매퍼를 추가하지 않는다. custom Repository fragment가 필요하면 인터페이스는 application의 Repository와 함께, 구현은 infrastructure에 둔다. 메일·파일·시계·명시 SQL 등 의미 있는 외부 협력은 필요에 맞게 유지한다. 동일 기능의 서비스만 해당 Repository를 사용하며 기능 간 조정은 기존 publicapi 방향을 따른다. domain의 Jakarta Persistence 매핑은 허용하되 Spring 서비스·Repository 호출·직접 I/O는 차단한다.

엔티티의 업무 메서드가 상태 전이를 수행하고 서비스가 저장·트랜잭션을 조정한다. API에는 projection/직접 생성 DTO를 반환한다. 엔티티의 연관관계를 그대로 직렬화하지 않는다. 연관관계는 필요한 범위만 매핑하며 입찰 전체 이력을 읽거나 다른 기능의 엔티티를 연관관계로 연결하지 않는다.

## 3. 테이블 설계와 기존 데이터

현재 회차의 목표 형태는 `id BIGINT PRIMARY KEY`, 기존 `round_id TEXT NOT NULL UNIQUE`, 기존 `round_version NUMERIC` 보존이다. 외부 roundId로 내부 PK를 반환하는 필드를 추가하지 않는다. 공개 버전은 무상한 계약·40자리 기존 시험을 보존하고 ORM 버전과 구분한다.

향후 identity 계정·검증 기록, listing 출품·사진 참조·이력, auction 회차·레인·경매·입찰·참여·접수·판정·운영 명령·권위 기록, outbox의 실제 업무 테이블에 BIGINT 단일 PK/FK 원칙을 적용한다. 이 목록은 테이블 생성 지시가 아니며 값 객체·결과를 무조건 별도 테이블로 만들지 않는다. 회원+원키·운영자+명령키·회원×Auction·회차+레인번호·scope+순번·결과 단일성은 별도 UNIQUE/제약으로 보호한다.

1. V1을 보존하고 다음 버전 migration을 추가한다. 실행 시 최신 migration 번호를 다시 확인한다.
2. 기존 데이터 보존을 기본으로 실제 행 수·참조 FK·허용 중단 시간을 조사한다. 현재 소스에는 다른 업무 FK가 없지만 실행 대상도 확인한다.
3. sequence·BIGINT 컬럼과 기본값을 추가하고 기존 행을 backfill한다. 기존 공개 ID의 UNIQUE를 확보한 뒤 PK를 전환한다. 필요한 실제 ALTER 순서·락 시간은 disposable DB에서 검증한다.
4. 초기 후보는 명시적 SEQUENCE·allocationSize=1이다. DB 증가량·기존 데이터·다음 삽입 충돌 없음을 검증한다. PK 증가를 접수·commit·outbox 재생 순서로 사용하지 않는다.
5. 신규 DB의 V1→신규 버전과 V1+기존 fixture DB의 업그레이드를 모두 시험한다. 행 수·모든 업무 값·공개 ID·큰 버전·PK 유일성·재시작·Flyway 재실행을 확인한다.
6. 기존 `ON CONFLICT(round_id)` fixture를 유지할 수 있게 UNIQUE와 id 기본값을 설계한다. fixture에 내부 PK를 고정하지 않는다. 공개 목록용 `(scheduled_starts_at, round_id)` 인덱스는 PK 인덱스와 별도로 실행계획을 확인한다.

데이터 손상 시 자동 down migration을 가정하지 않는다. 변경 전 복원 가능한 백업·검증 환경과 실패 시 롤백/복원 절차를 적용 대상에 맞게 준비한다. 개발·일회성 시험 DB 외의 데이터를 seed하거나 초기화하지 않는다.

## 4. 조회·동적 조건

| 사례 | 구현·검증 |
| --- | --- |
| 기본 조회·저장 | JpaRepository, 업무 메서드와 변경 감지 |
| 고정 조건·필드 선택 | 메서드 쿼리/JPQL DTO projection. 필요한 연관관계만 조회 |
| 상태·기간·범위·선택 조건 | JpaSpecificationExecutor와 Specification/PredicateSpecification. 조건 결합과 NULL·경계·필수 권한 조건 시험 |
| 교차 기능 JOIN·집계·CTE·window | query가 직접 소유한 바인딩 SQL. 타 기능 엔티티/Repository 참조 없음 |
| 반복되는 복잡한 동적 JOIN | OpenFeign Querydsl 도입 후보. Java 25/Boot 4.1.1/Gradle 9.8.1에서 Q 생성·DTO·정렬·페이징을 검증한 뒤 별도 선택 |

값은 바인딩하고 정렬 컬럼은 허용 enum/매핑으로 제한한다. 선택 필터 누락으로 공개·본인·당사자 경계가 사라지지 않게 검증한다. count/데이터 조건 동일성, 안정 정렬 보조키, limit+1/cursor, N+1·SQL 수·컬렉션 fetch join 페이징을 확인한다. 현재 목록의 `scheduledStartsAt, roundId`·C collation·cursor 형식을 내부 PK로 교체하지 않는다.

동적 조건을 지원한다는 이유로 현재 API에 새 검색 필드·정렬 파라미터를 추가하지 않는다. 새 공개 검색 계약은 필요해질 때 ADR-005에 따라 결정한다.

## 5. 수정 파일과 작업 순서

| 카드 | 파일·작업 | 완료 조건 / 상태 |
| --- | --- | --- |
| JPA-00 설계·계획 | ADR-006, SYSTEM-DESIGN, DOMAIN-MODEL 연결, 결정 기록·새 승인 manifest·계획·가이드 | 이번 작업. 설계 기록과 정적 검증으로 판정 |
| JPA-10 기반·DB 전환 | `backend/build.gradle.kts`, `gradle.lockfile`, `application*.yaml`, bootstrap 구성, `db/migration/V2__...sql` 후보 | PLANNED / NOT_RUN. JPA BOM/lock, Flyway→validate, OSIV false, PK 전환 및 JPA 최소 매핑 roundtrip |
| JPA-20 경계·회귀 | `ArchitectureRules.java`, `ArchitectureRulesTest.java`, 관련 fixtures, `InfrastructureBoundaryTest`, `PublicRoundPostgresIntegrationTest`, `scripts/verify-integration.py` | PLANNED / NOT_RUN. JPA 매핑 허용과 domain I/O 금지, Repository/publicapi 경계. migration 1개 고정 검사 수정 |
| JPA-30 첫 업무 적용 | M-02 정책·계약 확정 뒤 `identity/domain`, `identity/application` Repository·서비스, 필요한 custom fragment | PLANNED / NOT_RUN. 실제 가입/세션 등 해당 계약과 저장을 검증. JPA 기반만으로 M-02 READY 처리하지 않음 |
| 후속 기능 적용 | listing/auction 기능별 엔티티·Repository, query SQL, 필요한 명시 SQL | BE-10/20/30/40/50의 각 승인 기능·의존성에 맞춰 적용. 미래 업무 테이블 일괄 선구현 금지 |

JPA-10과 JPA-20은 하나의 전환 작업으로 통합 검증한다. build/lock·bootstrap·migration·scripts는 한 소유자가 조정한다. 기본 profile은 기존 무DB 기동과 조회 503을 회귀 확인하고 local-infra에서만 실제 DB 구성을 확인한다. 현재 JdbcPublicRoundReader와 HTTP/FE 타입은 공개 ID 전략을 보존하면 유지 가능하다. fixture와 기존 계약/브라우저 시험은 회귀 대상으로 사용한다. API 변경 없이는 FE 생성물을 수정하지 않는다.

## 6. 검증·인계

| 증거 | 필수 확인 |
| --- | --- |
| 계약·정적 | strict baseline, mutation guard, 계약 validator, ArchUnit, 생성 타입·닫힌 DTO 회귀 |
| 실제 DB·HTTP | fresh/upgrade, BIGINT PK·FK·UNIQUE, JPA 저장/조회/rollback, 기존 정확 ID·큰 버전·정렬·페이지·503 |
| 트랜잭션 | 같은 DataSource/실제 tx manager의 JPA+JDBC commit/rollback, flush 가시성·stale context·예외 시점 |
| 동시성·시간·장애 | 구현된 기능에 한해 원키 충돌·잠금 순서·원접수 보존·원판정/outbox 원자성·commit 불명·old tx. @Version/flush로 기존 미검증을 해결했다고 보고하지 않음 |
| 조회 성능 | 데이터 규모·SQL/row 수·N+1·count 조건·EXPLAIN ANALYZE, 조회와 명령의 pool 경쟁. 승인되지 않은 목표값을 만들지 않음 |
| 브라우저 | 기존 공개 목록→페이지→상세→복귀와 같은 열린 화면의 DB 복구. 계정·입찰·SSE는 해당 기능 구현 후 별도 |

실행 명령은 `scripts/verify.ps1 -JavaHome <Corretto25>`와 Docker가 필요한 `-Integration`, 필요한 추가 migration/JPA 사례다. integrationTest는 Docker 부재 시 실패이며 성공 skip으로 처리하지 않는다. disposable 인프라만 사용하고 환경·정확 SHA·명령·artifact·실패·NOT_RUN을 새 검증 보고서에 기록한다. 현재 [설계 반영 검토](JPA-PLAN-REVIEW-2026-10-16.md)는 정적 증거다.

최신 origin/dev에서 작업 브랜치를 만들고 관련 검증·필수 CI 후 dev에 통합한다. 원격 dev에 로컬·원격 task tip이 포함됨을 확인한 뒤 브랜치를 정리하고 dev에 둔다. main 승격은 사용자 별도 작업이다.
