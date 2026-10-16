# ADR-006 — 도메인 엔티티와 Spring Data JPA Repository

| 항목 | 값 |
| --- | --- |
| 상태 | ACCEPTED_WITH_OPEN — 엔티티·도메인 통합과 Spring Data Repository 채택. 영속화 전환 실행은 후속 |
| 결정일 / 근거 | 2026-10-16 / D-096. 사용자 “매퍼없이 순수 도메인모델말고 엔티티랑 혼용해서 사용해줘. repository는 Spring Data Repository를 사용해줘.” 및 후속 “수정해줘” |
| 기준선 | SYSTEM-DESIGN 1.1, DOMAIN-MODEL 1.3, 계약 0.1.0. HTTP·이벤트 정의는 변경하지 않음 |
| 적용 범위 | 기능별 도메인 엔티티, Repository 배치, 업무 트랜잭션, BIGINT 전환·조회 구현 계획 |
| 구현·실행 | JPA 의존성·엔티티·DDL 전환·DB/브라우저/성능 시험 NOT_RUN. 현재 제품 경로는 기존 JDBC 공개 조회 |

## 1. 결정과 대안

별도 순수 도메인 모델과 영속 엔티티를 만들고 양방향 매퍼·저장 포트·단순 위임 어댑터를 두는 제안을 채택하지 않는다. 업무 엔티티가 JPA `@Entity`를 겸하고 업무 메서드로 불변식과 상태 전이를 구현한다. 애플리케이션 서비스는 Spring Data JPA Repository를 직접 사용한다. 반복적인 전달 계층과 동기화 비용을 줄이려는 사용자 선택이다.

매핑과 규칙을 함께 두므로 프록시·변경 감지·지연 로딩·자동 flush의 영향을 검증해야 한다. 엔티티의 업무 메서드는 HTTP·인증 토큰·현재 시각 취득·Repository 호출·네트워크 발행을 수행하지 않는다. 값 객체는 필요에 따라 일반 Java 값 또는 `@Embeddable`로 구현한다. 모든 도메인 객체를 엔티티·별도 테이블로 만들지 않는다.

ADR-004의 JDBC 단독 기본 선택과 framework-free 도메인 설명은 이 ADR의 범위에서 대체한다. 모듈 소유권·비순환 의존성·필수 업무 원자성과 ADR-001~003의 시간·접수·장애 의미는 유지한다.

## 2. 코드 배치와 경계

| 위치 | 책임 |
| --- | --- |
| `feature.domain` | `Round`, `Auction`, `Lot` 등의 업무 엔티티·값·규칙. Jakarta Persistence 매핑 허용 |
| `feature.application` | 유스케이스 서비스·트랜잭션 조정과 해당 기능의 `JpaRepository<Entity, Long>` 인터페이스. 필요할 때 `JpaSpecificationExecutor` 확장 |
| `feature.publicapi` | 다른 기능에 제공할 업무 연산과 불변 입출력. 엔티티·Repository·Specification·Pageable 노출 금지 |
| `feature.infrastructure` | 별도 구현이 필요한 custom repository fragment, 명시 SQL gate/counter, 메일·파일 등 기술 처리 |
| `query.infrastructure` | query 소유 읽기 전용 SQL projection. 다른 기능의 엔티티·Repository를 import하지 않음 |
| `bootstrap` | HTTP/보안·조립·설정. 업무 Repository를 직접 사용해 업무 상태를 변경하지 않음 |

`RoundRepository extends JpaRepository<Round, Long>`처럼 서비스가 직접 주입받는다. 같은 메서드를 반복 선언하는 별도 저장 포트와 위임용 어댑터를 기본으로 만들지 않는다. 명시 SQL이 필요한 연산은 목적이 있는 fragment/기술 협력으로 구현한다. 연관관계는 필요한 범위만 매핑하고 다른 기능 엔티티로 객체 그래프를 확장하지 않는다. 기능 간 FK는 BIGINT 식별자로 표현하고 공개 포트를 통해 조정한다.

엔티티를 HTTP 응답으로 직렬화하지 않는다. 승인된 DTO는 projection 또는 직접 생성으로 반환하며 별도 매퍼 계층을 기본으로 두지 않는다. 엔티티에 public setter를 열어 최고가·단계·마감을 따로 갱신하지 않는다. 입찰 이력 전체를 Auction 컬렉션으로 로딩하거나 이력을 cascade delete하지 않는다.

## 3. PK와 데이터 전환 계획

애플리케이션 소유 업무 테이블은 BIGINT 단일 PK와 참조 BIGINT FK를 기본 설계로 삼는다. 회원+원키, 회차+레인 번호, scope+접수 순번 등 업무 유일성은 별도 UNIQUE로 보호한다. 외부 ID는 현 계약의 opaque 문자열을 보존한다. 내부 PK·공식 순번·공개 revision·레인 번호·stream cursor는 구별한다.

현재 `auction.rounds`는 `round_id text` PK 하나만 존재한다. 후속 migration에서 `id BIGINT` PK를 추가하고 `round_id`를 NOT NULL UNIQUE로 보존하는 안을 검증한다. V1은 수정하지 않는다. 데이터 보존을 기본 전제로 하며 실제 DB 규모·중단 허용 시간을 확인한 뒤 backfill·잠금·전환 절차를 정한다. 신규 업무 테이블의 세부 DDL은 각 기능 계약 확정 뒤 설계한다. Flyway·향후 세션 라이브러리 관리 테이블은 해당 규격을 별도로 검토한다.

PostgreSQL SEQUENCE와 명시적 `GenerationType.SEQUENCE`, 초기 `allocationSize=1`을 구현 후보로 둔다. DB sequence 설정과 일치시키고 삽입·기존 데이터 전환·재시작으로 검증한 후 적용한다. 생성값은 롤백·커밋 순서를 표현하지 않는다. 공개 `round_version numeric`을 Long이나 JPA `@Version`으로 축소하지 않으며 낙관적 충돌 검출이 필요한 엔티티에는 별도 영속 버전을 검토한다.

## 4. 조회 선택과 트랜잭션

| 용도 | 구현 기준 |
| --- | --- |
| 기본 저장·단건 조회 | Spring Data JPA Repository·변경 감지 |
| 고정 조건 조회 | Repository 메서드 또는 JPQL DTO projection |
| 일반 동적 조건 | 소유 기능 내부 Specification/PredicateSpecification. 애플리케이션 조건 객체를 기술 조건으로 변환 |
| 복잡한 JOIN·집계·CTE·window·교차 기능 조회 | query 소유 parameterized SQL과 DTO projection |
| 복잡한 동적 JOIN 반복 | OpenFeign Querydsl을 호환성·생성 코드 검증 후 선택할 대안. 현재 미채택 |
| 원접수·gate·counter·DB 시각·조건부 갱신 | 소유 기능의 명시 SQL. JPA의 자동 동작으로 순서 보장을 대체하지 않음 |

동적 SQL 값은 바인딩하고 정렬은 허용 필드로 제한한다. 공개/본인/당사자 조건을 선택 필터와 독립적으로 강제한다. count와 데이터 조건을 일치시키고 전체 건수가 필요 없으면 cursor/limit+1을 사용한다. 기존 회차 목록의 `scheduledStartsAt, roundId` 정렬·C collation·목록 cursor는 유지한다. N+1·컬렉션 fetch join 페이징·SQL 수·실행계획을 실제 DB에서 확인한다.

업무 서비스가 트랜잭션을 조정하며 JPA와 JDBC는 같은 DataSource·업무 트랜잭션에 참여하도록 구현·검증한다. 별도 tx manager로 핵심 상태를 분리하지 않는다. JPA flush 뒤 JDBC 가시성, JDBC 변경 뒤 영속 context의 stale 상태, 자동 flush에 따른 잠금 순서를 시험한다. OSIV 비활성화·Flyway 단독 DDL·JPA validate를 적용 계획으로 둔다.

`@Version`은 Lane gate·공식 순서·장애 확정 권한의 대체가 아니다. flush나 auditing 시각을 실제 전이 확정 S/N/R로 취급하지 않는다. 원접수와 별도 판정, 상태·원판정·outbox 동시 커밋, commit 후 SSE, 기존 원기록 보존을 유지한다.

## 5. 적용·증거

구체 파일·작업 순서·완료 조건은 [JPA 적용 계획](../../implementation/JPA-ADOPTION-PLAN.md)이 소유한다. 제품 정책과 HTTP/이벤트 계약의 의미 변경은 없고 OpenAPI·FE 생성물은 현행을 유지한다. 미정 계정·입력·보안 정책은 이번 구조 선택으로 확정하지 않는다.

설계 채택과 실제 JPA 적용은 별도다. baseline·문서 검증은 정적 증거이며 JPA 저장·BIGINT 전환·잠금·동적 조회·브라우저·성능은 후속 실행 카드의 실제 결과로 판정한다. 기존 검증 보고서를 소급 수정하지 않는다.

근거: [Spring Data Specifications](https://docs.spring.io/spring-data/jpa/reference/jpa/specifications.html), [Querydsl 지원](https://docs.spring.io/spring-data/jpa/reference/repositories/core-extensions.html), [Spring JPA 트랜잭션](https://docs.spring.io/spring-framework/reference/data-access/orm/jpa.html), [PostgreSQL sequence](https://www.postgresql.org/docs/18/functions-sequence.html). 공식 지원과 로컬 호환성 검증을 구분한다.
