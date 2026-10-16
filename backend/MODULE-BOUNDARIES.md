# Backend 패키지 경계

책임·의존성의 원본은 [SYSTEM-DESIGN §3~6](../docs/architecture/SYSTEM-DESIGN.md)이다. 이 파일은 승인된 경계를 Java 패키지와 자동 검사에 연결하며 새 제품 정책·경매 알고리즘·모듈 책임표를 만들지 않는다.

루트는 `com.auctionplatform`이다. 기능은 `identity`, `listing`, `auction`, `query`, `realtime`, `bootstrap`으로 구분한다. `bootstrap`은 조립·HTTP·보안·오류/추적을 담당한다. 첫 공개 회차 조회는 `query.application.PublicRoundQuery`와 `PublicRoundReader` 포트, `query.infrastructure.JdbcPublicRoundReader`, `query.publicapi.PublicRoundState`로 구성한다. 나머지 기능의 업무 클래스는 아직 없다.

첫 migration의 `auction.rounds`는 auction 소유 저장이며 query adapter는 승인된 읽기 SQL 예외로 SELECT만 수행한다. query가 회차 생성·공개·시각 전이를 수행하지 않는다. JDBC 조회 메서드는 읽기 전용 트랜잭션이며 단일 행의 공개 상태를 반환한다. snapshot·watermark·SSE 커서 의미는 이 API에 추가하지 않는다.

기능을 구현할 때 내부에 `domain`, `application`, `publicapi`, `infrastructure`를 책임에 맞게 둔다. 작은 기능에도 빈 클래스·저장소·인터페이스를 기계적으로 만들 필요는 없다.

| 검사 규칙 | 코드에서 차단할 의존성 |
| --- | --- |
| `DOMAIN_IS_PURE` | domain → Spring/JDBC/Servlet 또는 application/infrastructure/bootstrap |
| `APPLICATION_AVOIDS_ADAPTERS` | application/publicapi → infrastructure/bootstrap |
| `NO_AUCTION_CALLBACK` | listing/identity → auction |
| `NO_FEATURE_TO_BOOTSTRAP` | 업무 기능 → bootstrap |
| `FEATURES_ARE_ACYCLIC` | 기능 패키지 간 순환 |
| `CROSS_FEATURE_ACCESS_USES_PUBLIC_API` | bootstrap 조립 밖에서 다른 기능의 publicapi 외부 타입 참조 |

공개 API를 사용한다는 사실만으로 새 의존성이 승인되는 것은 아니다. 시스템 설계가 허용한 조정 방향을 함께 지킨다. 특히 출품·공개·취소의 교차 기능 조정은 auction.application → listing.publicapi이며 반대 callback은 금지다. 읽기 전용 query SQL의 예외를 타 모듈 상태 변경 통로로 확대하지 않는다.

도메인은 승인된 원시각·행위자·상태를 입력받고 현재 시각·인증 토큰·저장·네트워크를 직접 해석하지 않는다. 애플리케이션은 필요한 transaction을 조정하고 infrastructure가 포트를 구현한다. publicapi에 내부 엔티티·저장소를 노출하지 않는다.

원접수·공식 순번·원판정/ACK·단계·마감·결과·outbox를 구현할 때 [ADR-001~005](../docs/decisions/adr/README.md)의 채택 범위와 미완성 메커니즘을 함께 따른다. DB gate·old transaction·replay/live 안전성은 패키지 검사로 증명되지 않는다.

테스트의 의도적 위반 클래스는 `src/test`에만 존재한다. framework 의존 domain과 내부 cross-feature 참조를 실제 bytecode로 만들어 검사기가 위반을 포착하는지 확인한다. production artifact에는 포함하지 않는다.

현재 기능 코드가 비어 있는 규칙은 `allowEmptyShould(true)`로 향후 코드를 검사할 수 있게 둔다. 기본 bootstrap의 실제 production 클래스 검사와 음성/양성 대조 검사를 함께 실행하며, 기능별 업무 경계가 구현·검증됐다고 보고하지 않는다.
