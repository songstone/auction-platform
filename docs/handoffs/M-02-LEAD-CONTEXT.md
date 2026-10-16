# M-02 리드 세션 컨텍스트 — 계정과 역할

## 1. 역할과 이번 인계의 범위

너는 이 저장소의 **M-02 Engineering Lead**다. M-01 완료 근거를 확인하고, M-02의 남은 계정 정책 결정과 계약 구체화부터 시작한다. 해당 조건이 충족되면 M-02 작업만 세분화하여 배정·구현·독립 검증·CI·dev 통합·정리까지 이끈다. 구현 결함은 원담당에게 재배정하고 리드는 공식 상태와 통합을 관리한다.

- 저장소: `C:/Users/jitin81/Documents/dev/private/auction-platform`.
- 근거: 2026-10-16 전체 [ROADMAP](../ROADMAP.md)·[BACKLOG](../BACKLOG.md) 승인, M-01 완료 후 사용자 요청 **“M-01 완료되었으니 M-02 리드 세션에 전달할 컨텍스트도 작성해줘”**.
- M-02의 목표·순서·완료 조건은 승인 로드맵 그대로다. 같은 범위를 다시 승인받지 않는다. **CR-10·SEC-01~04의 미승인 선택을 이번 인계 요청으로 승인 처리하지 않는다.**
- 현재 상태: **인계 문서 준비 완료 / 정책 결정·계약 구체화부터 시작 가능 / 기능 구현 READY 아님**. 이 문서를 작성한 세션에서는 M-02 구현·새 실행 카드·DDL·클래스 구조를 만들지 않았다.
- 남은 사용자 정책 결정은 작은 묶음으로 질문한다. 내부 구현 선택은 승인 설계 안에서 리드가 근거를 갖고 해결하고, 계약 의미 변경은 [ADR-005](../decisions/adr/ADR-005-CONTRACT-BASELINE.md)를 따른다. M-03 이후 구현·운영 배포·main 승격은 확대하지 않는다.

**목표 사용자 흐름:** 비회원 → 이메일 검증 가입 → 로그인·현재 세션 확인 → 로그아웃 → 검증 이메일을 통한 비밀번호 재설정 → 새 비밀번호로 로그인. 사전 지정 운영자는 운영 전용 계정으로 로그인하며 일반 가입으로 운영 권한을 얻을 수 없다. PC와 개발 모바일에서 같은 실제 서버 흐름을 확인한다.

2026-10-16 추가 입력: D-096·[ADR-006](../decisions/adr/ADR-006-JPA-DOMAIN-ENTITIES.md)과 [JPA 적용 계획](../implementation/JPA-ADOPTION-PLAN.md)을 먼저 반영한다. 현재 설계는 SYSTEM 1.1 / DOMAIN 1.3 / DECISION 1.9이며 계약 0.1.0은 유지한다. 업무 엔티티가 JPA를 겸하고 서비스가 Spring Data Repository를 직접 사용한다. 별도 매퍼·영속 모델·CRUD 래퍼를 만들지 않는다. JPA/DDL 전환과 계정 기능은 아직 미구현이며 계정 정책·계약의 기존 시작 조건은 유지한다. 아래 최초 인계의 조사 SHA·버전·검증 수치는 당시 이력이다.

## 2. 반드시 읽을 원본

| 순서 | 원본과 확인할 내용 |
| --- | --- |
| 1 | [AGENTS](../../AGENTS.md), [STATE](../STATE.md): 최신 dev·기존 dirty/worktree 보존·실제 작업 상태·공유 파일 소유권 |
| 2 | [ROADMAP M-02](../ROADMAP.md), [BACKLOG F01~03/F23](../BACKLOG.md): 승인 목표·선행·DoD·후속 연계 |
| 3 | [IMPLEMENTATION-PLAN](../implementation/IMPLEMENTATION-PLAN.md), [QA-PLAN](../implementation/QA-PLAN.md), [MODULE-BOUNDARIES](../../backend/MODULE-BOUNDARIES.md): 작업 경계·최대 2명 구현·독립 증거 |
| 4 | [MVP-PRD](../product/MVP-PRD.md), [AUCTION-RULES](../product/AUCTION-RULES.md), [DOMAIN-MODEL](../architecture/DOMAIN-MODEL.md): R-16/23/37/45/50/52, INV-26/27 정보·역할 경계, INV-46 원기록 보존 및 실제 적용 AC/TS |
| 5 | [DECISION-LOG](../decisions/DECISION-LOG.md), [CONTRACT-REVIEW-001](../decisions/CONTRACT-REVIEW-001.md): D-045/046/048·D-092/095, OPEN-06 및 CR-10·SEC-01~04 미승인 경계 |
| 6 | [SYSTEM-DESIGN](../architecture/SYSTEM-DESIGN.md) §3~§7·§10, [OpenAPI](../../contracts/openapi.yaml), [계약 안내](../../contracts/README.md), [승인 manifest](../../contracts/approved-baseline-0.1.0-architecture-1.1.json), [ADR-005](../decisions/adr/ADR-005-CONTRACT-BASELINE.md): identity 소유·검증된 행위자·쿠키/CSRF·계약 변경 |
| 7 | [M-01 검증 보고서](../implementation/ROUND-DISCOVERY-VERIFICATION.md), [M-01 작업 기록](../tasks/README.md), [이번 인계 검토](../implementation/M-02-HANDOFF-REVIEW-2026-10-16.md): 재사용 가능한 증거와 NOT_RUN |

인계 조사 입력은 제품 1.6 / DOMAIN 1.2 / SYSTEM 1.0 / DECISION 1.8 / 계약 0.1.0이다. 현재 계획·QA 0.7은 실행 안내 갱신이며 정책 승인이 아니다. 다음 세션은 최신 버전과 승인 이력을 다시 읽는다. 보호 원본·봉인 결과를 먼저 고치거나 hash를 갱신하여 불일치를 숨기지 않는다.

## 3. M-01 완료와 현재 구현의 경계

| 항목 | 확인된 근거 |
| --- | --- |
| M-01 실제 런타임 검증·T-003 통합 | `89ae78c368a65522f4357616f9eebfaa89dcf084` |
| T-004 문서 검증·M-01 최종 dev 통합 | `5afa23dc1bd597bf437a960b9440dd6eb096602e` |
| 최종 문서 후보 CI | [run 38858681024](https://github.com/songstone/auction-platform/actions/runs/38858681024), 위 5afa23d 커밋의 contracts/backend/frontend/integration 모두 success. 이번 조사에서 원격 재확인 |
| 최종 상태 | T-001~004 MERGED. `.artifacts/tasks/m01-lead/final-handoff.json` 및 현재 STATE. 과거 T-004/report의 IN_REVIEW는 당시 작성 상태 |
| 실제 흐름 | 공개 목록·3페이지·정확 ID 상세·복귀, 빈 목록/503 구별, 동일 열린 Page의 DB down/up 재시도. BE fast 13, PG/HTTP 15, FE unit 33, 독립 목록 expectation 39+상세 6, 실제 브라우저 15+합성 fault 7 |
| 관측 한계 | Chromium 156.0.8078.4, 1280×844/390×844 개발 관측. 전체 OPEN-08 지원 환경·인증·입찰·SSE·성능·운영 인수 증거가 아님 |
| 정리 | M-01 task branch 로컬/원격 및 Git worktree 등록 제거. runtime cleanup PASS. `auction-platform-worktrees/t-001` 디스크 잔여는 보존되어 있으므로 재사용·자동 삭제하지 않고 최신 inventory 확인 |

이 인계 조사 시 fetch한 `origin/dev`는 5afa23d의 **40자리 SHA**였다. 이는 M-01 완료 기준이며 다음 리드의 실제 착수 SHA가 아니다. 인계 문서 통합만으로도 tip이 이동한다. `main/origin/main`은 `003a28fb9f2836f80ce21ed4e64f855977632eb8`였고 배포하지 않았다. M-01 런타임은 기존 실행 증거로 확인했으며 이번 문서 세션에서 재실행하지 않았다.

현재 `identity`는 모듈 안내만 있고 제품 인증 API는 미구현이다. bootstrap 보안은 공개 health/회차 GET만 허용하고 나머지를 기본 거부하며, CSRF 저장소 준비가 실제 회원·운영자 인증을 입증하지 않는다. 기존 migration은 회차용 V1뿐이다. Mailpit 개발 수신기 구성은 준비 상태이며 가입/재설정 메일 전달 기능이 아니다. 실제 세션 저장 어댑터·메일 경로·수명·실패 처리는 M-02에서 선택·구현·검증해야 한다. PostgreSQL 세션 어댑터, Redis, JWT 등을 이미 채택한 것으로 기록하지 않는다.

## 4. 승인된 범위와 먼저 결정할 사항

**이미 정해진 기준:** 이메일 검증 후 회원 가입 완료, 이메일·비밀번호 로그인, 검증 이메일을 통한 재설정, 사전 지정 운영 전용 계정, 일반 가입의 운영 권한 취득 금지, 운영/회원 겸용 계정 금지다. 같은 사람의 별도 일반회원 계정 사용은 허용되지만 **같은 이메일 허용**까지 결정된 것은 아니다. 이메일 검증은 실명 인증이 아니다.

D-095의 동일 출처 Spring Security·서버 세션·쿠키/CSRF, 검증된 인증 맥락의 행위자 전달, 다중 기기 사용, 현재 세션 로그아웃과 원입찰/공유 의도 보존을 유지한다. 임의 입력의 ID/role을 인증 행위자로 신뢰하지 않는다. 세션 종료는 경매 원기록이나 미확인 제한을 지우는 사유가 아니다.

아래 표는 **미정 검토 목록**이다. 원본 CR/SEC의 추천값도 승인 전에는 구현 기본값·DoD로 확정하지 않는다. `RegistrationRequest`/비밀번호 schema의 `minLength: 1` 역시 최종 비밀번호 정책 승인이 아니다.

| 결정 묶음 | 다음 리드가 정리할 질문·영향 |
| --- | --- |
| 계정 동일성 / CR-10 | 이메일 trim·대소문자·중복 키, `+tag`/점 처리, 운영자와 회원의 같은 이메일 사용, 검증 전 중복 가입·재발송. DB 고유 제약·가입/로그인/재설정 응답과 연결. 계정 변경·탈퇴·정지 UI를 임의 추가하거나 후보의 제외안을 새 승인으로 기록하지 않음 |
| 비밀번호·검증·재설정 / SEC-01/02 | 길이·Unicode 정규화·취약 비밀번호 차단, 토큰 수명·일회성·재발급/옛 토큰·동시 소비·응답 유실, 재설정 뒤 세션/토큰 무효화 범위·자동 로그인 여부. 메일 실패 때 저장된 상태와 재시도/안내, 계정 유무 비노출 응답과 기존 오류 계약의 정합성 |
| 세션 수명 / SEC-03 | idle/absolute 수명·시작/갱신 사건, 인증 REST·공개 관람의 만료 연장 여부, 만료 후 화면·재인증. 승인된 다중 기기 사용과 현재 세션 로그아웃을 재개방하지 않음 |
| 운영자 준비·보호 / SEC-04 | 사전 지정 계정 준비 절차, 로그인/발송 시도 제한과 사용자 안내, 해시/작업비용·서버 세션 저장·메일 어댑터. 기술 선택과 사용자 정책을 구분하고 제한의 scope/실패 의미 등 계약 영향만 구체 승인. 기본 비밀번호를 저장소에 넣거나 권한 관리 화면을 임의 추가하지 않음 |

예를 들어 CR/SEC에 적힌 비밀번호 15~128, 검증 30분/재설정 15분, 세션 idle 30분/absolute 8시간, 재설정 뒤 모든 세션 무효화는 **모두 미승인 후보**다. 인계 문서에서 새로운 추천을 확정하지 않는다. 다음 리드는 최신 원본의 선택지·장단점·추천 근거를 제시하고 실제 답변을 기록한다. 질문의 기본 선택이나 대기 시간 경과를 승인으로 처리하지 않는다.

## 5. 계약 구체화와 구현 착수 조건

현재 `/api/v1` 아래 인증 operation은 아래 8개다. 이것은 기존 계약 목록이며 독자적인 대체 API를 만들지 않는다. 필드·상태 코드·쿠키·오류·no-store의 원본은 OpenAPI이고 필요 변화는 ADR-005로 검토한다.

| Operation | 메서드 / 경로 |
| --- | --- |
| `getCsrfToken` | GET `/auth/csrf` |
| `getSession` | GET `/auth/session` |
| `logout` | DELETE `/auth/session` |
| `registerMember` | POST `/auth/registrations` |
| `verifyEmail` | POST `/auth/email-verifications` |
| `login` | POST `/auth/sessions` |
| `requestPasswordReset` | POST `/auth/password-reset-requests` |
| `completePasswordReset` | POST `/auth/password-resets` |

현재 계약의 `AUCTION_SESSION`, `X-CSRF-Token`, 로그인/로그아웃 후 CSRF 재취득, 세션 고정 방어, `SessionUser` 단일 역할과 회원의 `emailVerified: true`, 닫힌 schema를 함께 확인한다. 가입 body에 role을 추가하지 않는다. FE 타입은 봉인 OpenAPI에서 생성하며 unknown field를 묵인하지 않는다. 쿠키 상세·수명 등 OPEN은 승인 없이 채우지 않는다.

**정책 준비에서 기능 READY로 넘어가는 조건:**

1. 관련 OPEN-06/CR-10/SEC 결정을 실제 사용자 답변에 연결하고, 남은 질문이 각 구현 경로를 막는지 표시한다. 영향 없는 읽기 분석·기술 비교·독립 반례 준비는 병행할 수 있다.
2. Contract Owner가 관련 제품/결정/설계·계약의 정확 diff, 예제, 호환성, BE/FE/QA 영향을 마련한다. ADR-005의 독립 검토·구체 변경 승인 후에만 새 기준선을 기록한다. 정책 승인과 계약 변경 승인을 자동으로 합치지 않고, 필요한 내용을 한 번의 구체 검토안으로 제시할 수 있다.
3. 승인된 변경을 적용한 최신 기준선의 버전·승인 근거·검사 결과·dev 통합 SHA를 확정한다. 기존 봉인 자료를 hash 재작성으로 우회하지 않는다. 이번 문서 작업은 보호 원본/manifest를 변경하지 않았다.
4. M-02에 필요한 작업 카드만 만든다. 실제 최신 origin/dev **40자리 SHA**, 담당자·branch/worktree, 계약/guard, 편집 소유권, 검증 환경, 선행 검증/통합 SHA와 포함 관계를 기록한 뒤 READY로 전환한다. M-01 완료 카드를 재개하거나 먼 마일스톤의 클래스를 설계하지 않는다.

실행 세션 첫 확인은 다음과 같다. dirty·타 worktree·미병합 branch를 보존하고 기능 작업은 최신 origin/dev에서 분기한다.

```powershell
git status --short --branch
git fetch origin --prune
git rev-parse HEAD origin/dev origin/main
git branch -vv
git worktree list
git merge-base --is-ancestor 5afa23dc1bd597bf437a960b9440dd6eb096602e origin/dev
python -X utf8 scripts/check-approved-baseline.py --strict-evidence
```

Corretto 25, Wrapper 9.8.1, 프로젝트 Node/npm·Python/validator·PowerShell, Docker·disposable PostgreSQL/메일·브라우저 환경을 실제 확인한다. `AUCTION_JAVA_HOME`/`-JavaHome`은 확인한 Corretto 경로를 사용한다. 보호 쿠키가 실제 전달되는 브라우저 조건도 검증 환경에 포함한다. 환경 실패는 성공 skip으로 기록하지 않는다.

## 6. 배정·병렬화·주요 통합

초기 제품 구현 활성은 **최대 2명**이다. 아래는 책임/통합 순서이며 아직 새 Task ID나 담당/worktree가 배정된 것은 아니다.

실제 가용 인력·M-01 처리 기록·남은 정책 대기 시간을 확인한 뒤 M-02/03의 일정 범위를 갱신한다. 인계 시점에는 고정 날짜·인일을 약속하지 않는다.

| 단계 | 병렬 작업과 통합 관문 |
| --- | --- |
| 정책·계약 준비 | 리드/Contract Owner가 질문·diff 조정, BE는 저장·메일·세션 대안 및 실패 경계, FE는 흐름/오류 영향, QA는 독립 기대값을 읽기 검토. 미승인 기본값의 기능 구현은 시작하지 않음 |
| 봉인 후 구현 | BE identity·검증된 행위자/보안·메일/세션과 FE 생성 타입·계약 mock/화면을 분리. QA 기대값 준비는 가능하며 mock 완료와 실제 연결 완료를 구분 |
| 실제 연결 | BE 실제 PG/HTTP·세션·메일 및 실패/경합 검증→CI/dev 포함 확인→그 통합 SHA를 포함한 FE 실제 연결. 명확히 독립된 작업은 병렬로 하되 공유 변경은 한 소유자만 편집 |
| 독립 QA·마감 | 결합 후보의 실제 브라우저·보안/실패·M-01 회귀, 결함 원담당 반환, 독립 검토·CI·dev 통합 후 리드 인수/정리 |

리드는 `backend/build.gradle.kts`, 의존성 lock, security/bootstrap 설정, `db/migration`, `scripts/**`, `.github/**`와 공통 인프라의 **단일 조정 소유자**를 지정한다. FE package/lock·공통 빌드/브라우저 설정도 충돌 전에 배정한다. 제품/설계/결정/계약의 의미 변경은 Contract Owner가 조정하고, STATE·카드·현재 가이드·공식 보고서는 리드가 관리한다.

identity만 회원·검증·세션을 변경하며 다른 모듈에는 검증된 행위자와 역할 경계를 제공한다. 경매 원기록 삭제·수명 정책을 인증에 결합하지 않는다. 기존 V1은 고치지 않고 필요한 다음 migration을 추가한다. 계정·합성 데이터는 migration에 넣지 않으며 개발 fixture와 disposable 시험 데이터를 배포물에서 분리한다.

기존 runner는 빌드/실행 전에 상속된 Spring/DB/server/management/mail/photo·JVM/Gradle 옵션을 정화한다. M-02 시험 메일/세션 자원은 runner가 소유하고 명시 주입하도록 확장한다. 개발·운영 메일/DB를 상속하여 사용하지 않는다. 기존 비밀 scan이 인증 비밀까지 검사한다고 가정하지 말고 새 토큰·비밀번호·쿠키·메일·trace 증거 경계를 검증한다. 비밀은 Git·로그·URL·명령 인수·결과물에 남기지 않으며 메일→화면 토큰 전달 방식도 계약 검토에 포함한다.

시간·공식 접수·authority 위험 V-01~03의 검증 설계는 병행할 수 있지만 M-02 계정 완료의 일괄 선행조건이 아니다. 별도 격리 실험은 목표·대안·성공 조건·범위를 구체화하고 승인된 범위만 실행한다. SPIKE 코드를 제품에 자동 복사하지 않는다.

## 7. 완료 조건과 증거

| 구분 | M-02에서 실제 입증할 결과 |
| --- | --- |
| 기능/DB/HTTP | 실제 가입→메일 검증→로그인/현재 세션→로그아웃→재설정→새 비밀번호 로그인. 미검증 계정의 회원 자격 미부여, 이전 비밀번호 실패, 승인된 이메일/비밀번호 경계 및 중복 처리 |
| 세션·권한 | 실제 서버 세션·쿠키/CSRF·세션 ID 교체, 비인증/미검증/회원/운영자 구분, 단일 역할·가입 권한 상승 차단, 입력 ID/role 위조 차단, 다중 기기·현재 세션 로그아웃·승인된 만료/재설정 무효화 |
| 트랜잭션·실패 | 검증/재설정 토큰 만료·재사용·재발급·동시 소비, 계정/비밀번호/세션 변경의 commit/rollback, DB·세션 저장·메일 실패와 응답 유실의 상태/재시도. 사용자에게 보여준 결과와 저장 상태가 승인 정책에 일치 |
| 브라우저·메일 | 같은 빌드의 PC/개발 모바일에서 실제 시험 수신 메일을 거쳐 흐름 완료. 로컬 수신함 성공과 외부 메일 사업자 전달/운영 성공을 분리. 실제 만료·재로그인/오류 안내와 보호 쿠키 조건 관측 |
| 회귀·정보 보호 | M-01 비회원 목록/페이지/상세/복귀·동일 화면 DB 복구, strict schema·no-store·오류/trace. 비밀번호/토큰/쿠키·개인정보 누출 반례와 시험 자원 cleanup |
| 인수 기록 | 실제 적용 AC/INV/TS를 기대값·명령·시험 이름·artifact·정확 검증/통합 SHA에 연결. 계약/정적·기능·DB·세션·실패·브라우저·운영 증거를 분리 |

아직 존재하지 않는 출품·입찰·본인 목록·연락처·운영 명령 API의 실제 권한 인수는 **NOT_RUN/후속 연계**다. M-02의 실제 인증/역할 경계를 R-16/45/52 전체 업무 AC 성공으로 확대하지 않는다. 세션/경매 원기록의 분리는 설계·경계로 보존하고, 재설정/만료 후 원입찰·미확인 제한 복원은 실제 경매가 구현되는 M-05/06에서 검증한다. SSE·공식 접수·전체 성능·운영 배포와 OPEN-08 전체 지원 환경도 별도다.

기존 검증기는 공개 조회 중심이며 `authentication_sessions`는 NOT_RUN이다. 아래 명령이 통과했다는 사실만으로 M-02 성공을 선언하지 않는다. 새 계정 사례가 실제 수집·실행되고 CI artifact로 남도록 실행 카드를 구체화한다.

```powershell
python -X utf8 scripts/check-approved-baseline.py --strict-evidence
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome $env:AUCTION_JAVA_HOME
pwsh -NoProfile -File scripts/verify.ps1 -JavaHome $env:AUCTION_JAVA_HOME -Integration
git diff --check
```

PG 사례는 명시적 `integrationTest`로 실행하며 Docker 미가용은 실패다. 이식형 runner를 사용하면 계약 검사·BE/FE fast를 대체한다고 가정하지 않는다. 원시 결과는 `.artifacts/integration/<run-id>/`, `output/playwright/`, `.artifacts/tasks/<task-id>/<run-id>/`에 비밀 없이 남기고 Git에는 요약 보고서를 추가한다. 과거 보고서는 덮어쓰지 않는다.

## 8. 완료 보고·통합·다음 인계

승인 기준선 불일치, 미승인 정책/권한 확대, private 노출, 선행 SHA 부재, 소유권 충돌, 실제 시험 FAIL·cleanup 실패, 시험의 외부 DB/메일 접근이면 영향 작업의 원인·범위·담당·재개 조건을 기록한다. 필요한 정책 질문만 구체적으로 하고 무관한 준비는 계속한다. 제품 결함을 문서나 mock 기대값 변경으로 덮지 않는다.

검증 후보의 contracts/backend/frontend/integration CI를 확인한 뒤 최신 dev에 FF/일반 merge·push한다. 병합 해결이 있으면 변경 부분을 다시 검증한다. fetch 후 **로컬·원격 task tip 모두** origin/dev의 조상인지, 타 worktree가 쓰는지 확인하고 완료 branch만 안전하게 삭제한다. 미병합 작업·main/dev를 보존하며 root checkout은 dev에 둔다.

최종 산출물은 M-02 실행 카드/상태, 승인 결정·계약 변경 근거, 새 계정 기능 검증 보고서, 현재 가이드 링크, 정확 검증/통합 SHA·명령·CI/artifact·FAIL/NOT_RUN·runtime/branch/worktree 정리 결과다. 문서 자체의 미래 commit을 미리 기입하지 않고 통합 후 최종 인계에 실제 값을 기록한다. dev 통합을 RELEASED로 부르지 않는다.

M-02 종료 시 M-03의 회차/출품 입력 정책·계정 행위자 연결·공유 파일 소유권과 착수 조건을 인계한다. M-03 구현을 자동으로 시작하지 않는다.
