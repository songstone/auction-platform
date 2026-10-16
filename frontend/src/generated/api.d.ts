// GENERATED from contracts/openapi.yaml; do not edit.
// Contract 0.1.0; source SHA-256 4cad0ae25cb48ef7891176594093374ae5007587d28ac5563fc644e21aaa527d
// Tool input derives discriminator mapping from existing required const values only.
export interface paths {
    "/auth/csrf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * CSRF 토큰 확보
         * @description 로그인 전에도 세션/CSRF 준비 가능. 반환 토큰은 메모리에서 보관하고 변경 요청 X-CSRF-Token에 전달. 로그인/로그아웃 뒤 재취득. 쿠키 속성·세션 수명은 OPEN-06의 제안 범위.
         */
        get: operations["getCsrfToken"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 현재 세션 조회 */
        get: operations["getSession"];
        put?: never;
        post?: never;
        /** 현재 세션 로그아웃 */
        delete: operations["logout"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/registrations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 이메일 검증 가입 요청
         * @description 일반 가입으로 운영자 권한 취득 불가. 비밀번호/토큰/시도 제한 상세를 결정한 뒤 보안 구현 기준선으로 사용한다.
         */
        post: operations["registerMember"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/email-verifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 가입 이메일 검증 */
        post: operations["verifyEmail"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 이메일·비밀번호 로그인
         * @description 성공 시 AUCTION_SESSION 보안 쿠키 설정·세션 고정 방어 및 CSRF 재취득. 정확한 쿠키 수명/동시 세션 정책은 미정이며 다중 기기 공유를 막는 단일 기기 제한을 추가하지 않는다.
         */
        post: operations["login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/password-reset-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 검증 이메일을 통한 재설정 요청 */
        post: operations["requestPasswordReset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/password-resets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 비밀번호 재설정 완료 */
        post: operations["completePasswordReset"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 공개 회차 목록
         * @description 공개된 회차만. 생성 직후 미공개 회차·상품·배정을 guest에 노출하지 않는다.
         */
        get: operations["listPublicRounds"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds/{roundId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 공개 회차 상태 */
        get: operations["getPublicRound"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds/{roundId}/lots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 공개된 회차 상품 목록 */
        get: operations["listPublishedLots"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/lots/{lotId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 공개 상품 상세 */
        get: operations["getPublishedLot"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/lots/{lotId}/photos/{photoId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 공개 상품에 연결된 사진 */
        get: operations["getPublishedPhoto"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auctions/{auctionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 원경매 진행·결과 조회
         * @description 종료 후에도 원경매 조회. D-094에 따라 유찰 결과에는 최고입찰가를 제공하지 않는다. 종료된 경매의 liveState로 옛 최고가를 다시 제공하지 않는다. 회차 취소로 미진행은 ROUND_CANCELLED/result=null로 보존한다.
         */
        get: operations["getPublicAuction"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds/{roundId}/snapshot": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 일관된 공개 snapshot과 stream cursor
         * @description 초기 연결/재동기화 기준. snapshot-first 후 cursor로 SSE 재생. 세대·상태·버전·cursor는 같은 읽기에 해당한다.
         */
        get: operations["getAuctionSnapshot"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rounds/{roundId}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 공개 회차 SSE 구독
         * @description 비회원 허용. snapshot-first → cursor 이후 범위별 영속 replay → live 공백 없는 인계. heartbeat/resync에는 SSE id 없음. cursor 부재·이전 세대·invalid/replay 초과는 control frame으로 재동기화. 상세 순서·cursor/오류 규약은 auction-events.md가 원본.
         */
        get: operations["subscribeAuctionEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/listing-context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 현재 출품 모집 맥락
         * @description 검증 가입 회원. 현재 귀속 회차와 설정된 다음 모집 일정을 제공하고 future private Lot 정보는 제외한다.
         */
        get: operations["getListingContext"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/lots": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 본인 출품 목록 */
        get: operations["listMyLots"];
        put?: never;
        /**
         * 모집 회차 자동 귀속 출품
         * @description 서버 원접수 시각으로 현재 모집 회차 귀속. Round 최초 공식 출품 순번으로 유효 요청을 배정. publicNumber/레인을 본문으로 선택 불가. 원결과 조회는 /api/v1/me/action-requests/{requestId}.
         */
        post: operations["createLot"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/lots/{lotId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 본인 출품 상세 */
        get: operations["getMyLot"];
        /**
         * 공개 전 본인 상품 수정
         * @description 공개 직전 공식 접수 변경을 선행 순서대로 반영. 공개 정각부터 수정 불가. 최초 등록순·배정은 유지. 원요청 조회는 me/action-requests.
         */
        put: operations["updateLot"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/participations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 본인 참여·결과 목록 */
        get: operations["listMyParticipations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/photos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 본인 출품용 사진 저장 */
        post: operations["uploadPhoto"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/photos/{photoId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 공개 전후 본인 저장 사진 읽기
         * @description 공개 전 출품 재조회/수정 때 기존 사진을 복원한다. photoId를 알아도 타인 사진은 404 RESOURCE_NOT_FOUND. 본인 사진의 운영 보존/정리 조건은 OPEN-12.
         */
        get: operations["getOwnedPhoto"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/lots/{lotId}/cancellations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 원출품 취소
         * @description 원상품 고정. 공개 전후 경계의 서버 라우팅은 Round 공개 순서와 Lane 개시/취소 순서를 함께 보호. 유효 개시 전 접수는 늦게 판정돼도 취소 자격 유지. 개시 정각에는 개시 우선. 사유 필수화 없음.
         */
        post: operations["cancelOwnLot"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/action-requests/{requestId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 본인 출품 변경 원요청 결과
         * @description MEMBER_ACTION의 원 requestId 내용·원접수·원결과. 없음은 404 REQUEST_RECORD_NOT_FOUND이며 원최종 거절 아님.
         */
        get: operations["getMyActionRequest"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/bid-intents/{requestId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 공유 입찰 의도 등록·동일 키 복구
         * @description 회원×Auction당 동시에 미확인 공유 의도 하나. 같은 회원+키에 원경매·금액 고정. 다른 기기도 원등록을 확인한 뒤 같은 의도로 실제 제출 가능. 이 API는 현재가/마감/최고자 자격을 사전 업무 판정하지 않는다. 등록 응답 유실은 같은 PUT/현재 의도 조회로 복구. 등록은 공식 입찰 접수 아님.
         */
        put: operations["registerBidIntent"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/bid-intents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 현재 미확인 공유 의도 조회 */
        get: operations["getCurrentBidIntent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auctions/{auctionId}/bid-requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 등록된 원의도로 실제 입찰 접수
         * @description 등록 확인 뒤 제출. member+requestId에 원경매·금액 고정. 접수 gate 이후 원시각/순번을 저장하고 commit 성공 후 202. 현재 업무 금액/개시/마감·본인 출품/최고자는 자기 공식 순번에서 판정한다. 같은 키 재전송은 원접수·원판정, 최초 미도달이면 이번 첫 공식 접수 시각. 409/401/5xx는 원입찰 REJECTED나 제한 해제 아님. HTTP 도착 선착순 보장 없음.
         */
        post: operations["submitBid"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/bid-requests/{requestId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 본인 원입찰 판정 조회
         * @description 반환 원기록은 불변 최종 판정을 보존. 현재 Auction 상태는 별도 조회. 404는 단순 기록 없음이고 timeout·경매 종료와 함께 미확인 해제의 근거가 아니다.
         */
        get: operations["getBidRequest"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/bid-requests/{requestId}/acknowledgements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 원최종 판정 수신·반영 자동 확인
         * @description 동일 회원 어느 기기든 원판정을 수신·반영한 뒤 자동 ACK. 서버 전송 성공/공개 SSE 수신/최신 snapshot만으로 ACK 호출하지 않는다. 동일 ACK는 최초 확인 시각 유지. 최종 없음/다른 outcomeId는 409이며 제한 해제 없음. 옛 ACK는 새 의도에 영향 없음.
         */
        post: operations["acknowledgeBidOutcome"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auctions/{auctionId}/contact": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 낙찰 당사자의 상대 이메일
         * @description SOLD의 출품자/낙찰자 본인만 상대 인증 가입 이메일. 미인증은 401 AUTHENTICATION_REQUIRED, MEMBER 역할 없음/검증 미완료는 403 ROLE_REQUIRED/EMAIL_NOT_VERIFIED. MEMBER 요건을 충족해도 대상 없음·비SOLD·당사자 아님은 404 RESOURCE_NOT_FOUND. 운영자 역할만으로 이메일 권한 없음.
         */
        get: operations["getTradeContact"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/operator/rounds": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 운영 회차 목록 */
        get: operations["listOperatorRounds"];
        put?: never;
        /**
         * 일정·레인·시간을 가진 회차 생성
         * @description 소급 생성 금지·모집 기간 중복 검증. 원명령 결과 조회는 /api/v1/operator/commands/{requestId}. 자동 시작은 시스템 처리이며 수동 start API는 추가하지 않는다.
         */
        post: operations["createRound"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/operator/rounds/{roundId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 운영 회차 설정 조회 */
        get: operations["getOperatorRound"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/operator/rounds/{roundId}/schedule": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 공개 전 회차 일정 변경
         * @description 공개 후 예약 일정 고정. 모집/공개 관계와 중복을 변경 공식 차례에 재검증.
         */
        put: operations["updateRoundSchedule"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/operator/rounds/{roundId}/lane-configuration": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 공개 전 레인 수 변경·전체 재배정
         * @description 공개 전만. 남은 유효 출품 전체를 최초 등록순·최소 대기 수·레인 번호 동률 규칙으로 재배정. 공개 직전 선행 변경을 반영한 뒤 공개 고정.
         */
        put: operations["updateRoundLanes"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/operator/rounds/{roundId}/timing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * 실제 시작 전 회차 시간 변경
         * @description 공개 후에도 실제 시작 전에는 가능. 실제 시작 후 중단/재개를 포함해 시간 세트 고정.
         */
        put: operations["updateRoundTiming"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/operator/rounds/{roundId}/cancellations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 공개 후 실제 시작 전 회차 취소
         * @description Round 공통 시작/취소 순서에서 자기 차례 자격 확인. 지연 대기라도 실제 시작 전이면 자격 판정. 공개 전/진행 중 전체 회차 취소는 MVP 제외. 상품은 경매 미진행 표시·기존 개별 취소 보존, 자동 이전 없음.
         */
        post: operations["cancelRound"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/operator/rounds/{roundId}/lanes/{laneId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 레인 현재 제어·복구 맥락 조회 */
        get: operations["getOperatorLane"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/operator/rounds/{roundId}/lanes/{laneId}/pauses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 원회차 레인 중단
         * @description 동일 Lane 공통 접수 순번. 선행 유효 입찰 효과를 보존한다. 반복 동일 키는 원결과, 새 중단 발생 건과 구분.
         */
        post: operations["pauseLane"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/operator/rounds/{roundId}/lanes/{laneId}/resumes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 현재 중단 발생 건에 대한 명시적 재개
         * @description 현재 발생 건·원인별 확인·선행 요청·권위 이력 확인. 실제 R부터 단계 전체 시간. 기존 최고입찰 보존. 원성공 재전송은 원 R만 반환하며 새 중단을 해제하지 않는다. 진행 중 새 키 재개도 시간을 갱신하지 않는다.
         */
        post: operations["resumeLane"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/operator/rounds/{roundId}/lanes/{laneId}/recovery-confirmations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 현재 장애의 복구 가능 상태 확인
         * @description 서버가 원접수·판정·최고입찰·단계·미결·정상 접수/기록 증거를 검증한다. 확인만으로 보류·수동 중단 해제/자동 재개/시간 부여 없음. historyStatus UNKNOWN을 본문의 true로 덮어쓰는 기능 없음. 증거 보완 관리 API는 deferred.
         */
        post: operations["confirmRecovery"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/operator/auctions/{auctionId}/cancellations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 원현재 경매 운영자 취소
         * @description 원Auction 고정. 자기 차례에 현재 대상·현재 마감·선행 요청·확정 결과 부재를 확인한다. 결과 존재 여부 불명은 추정 취소/거절하지 않고 보류. 진행 레인은 다음 준비, 중단 레인은 중단 유지.
         */
        post: operations["cancelCurrentAuction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/operator/commands/{requestId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 본인 운영 명령 원결과 조회
         * @description 운영자+requestId 원명령 내용/접수/결과. 다른 운영자 개인 명령 조회 권한은 추가하지 않는다. 같은 성공 재개는 원 R 유지. 현재 레인은 별도 조회.
         */
        get: operations["getOperatorCommand"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description 대소문자 구분·정확 일치하는 불투명 식별자. 공백만인 값은 거절. 클라이언트가 분해·정렬·trim하지 않는다. 길이/생성 운영 제한은 OPEN-10. URL에서는 인코딩한다. */
        OpaqueId: string;
        /** @description SSE id와 재생 요청에 쓰는 서버 발행 opaque vector cursor. NUL·CR·LF 없는 단일행이며 클라이언트가 분해·수정하지 않는다. 다른 종류의 원키/목록 커서와 혼용 금지. */
        StreamCursor: string;
        /** @description 공백만인 입력은 거절한다. 문자 수 상한은 해당 OPEN을 따른다. */
        NonBlankString: string;
        /** @description KRW 양의 정수의 10진 문자열. 선행 0·부호·소수·지수 표기 금지. 제품 상한은 OPEN-05이며 이 스키마에 임의 상한을 추가하지 않는다. */
        MoneyWon: string;
        /** @description 0 이상의 카운터. JavaScript 숫자 변환 없이 BigInt/문자열로 보존. 서로 다른 scope/epoch 사이 비교 금지. */
        Counter: string;
        /** @description 1 이상의 해당 회차·레인 공식 접수 순번. 이벤트 버전·전역 ID와 다름. */
        ReceiptSequence: string;
        /**
         * Format: date-time
         * @description UTC RFC 3339 문자열. 최대 6자리 소수의 wire 제안이며 원기록 정밀도를 보존한다. 절삭/반올림해 마감 비교하지 않는다. 실제 시각 취득·정밀도·연속성 보장은 ADR-001/OPEN-10에서 별도 검증. 일정 계산/표시는 Asia/Seoul.
         */
        UtcInstant: string;
        /** @description roundId 안에서만 의미가 있는 레인 번호. */
        LaneId: number;
        /** @description 이 API의 같은 출처에 대한 /api/v1/... 상대 URL. 비밀·이메일·세션 토큰을 넣지 않는다. */
        RelativeUrl: string;
        /** @description 회차 시간 한 세트. 기본 5/10/5초. 실제 시작 때 고정. 허용 입력 범위는 OPEN-05; integer 스키마만으로 모든 정수의 허용을 승인한 것이 아니다. */
        DurationSettings: {
            preparationSeconds: number;
            initialBidSeconds: number;
            followupBidSeconds: number;
        };
        /** @description 중단/보류 원인을 함께 표시. 마감 시각 경과나 snapshot 수신으로 해제하지 않는다. */
        ControlState: {
            manualStopped: boolean;
            held: boolean;
        };
        LaneWatermark: {
            laneId: components["schemas"]["LaneId"];
            laneVersion: components["schemas"]["Counter"];
        };
        SoldResult: {
            auctionId: components["schemas"]["OpaqueId"];
            lotId: components["schemas"]["OpaqueId"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "SOLD";
            finalizedAt: components["schemas"]["UtcInstant"];
            winningPrice: components["schemas"]["MoneyWon"];
        };
        /** @description D-094에 따라 유찰 종료 결과에는 최고입찰가를 제공하지 않는다. 기존 공개 진행 가격을 사용자가 기억하거나 저장한 것까지 회수한다는 뜻은 아니다. 본인 원입찰 기록 보존과 구분하며 개별 입찰 이력의 추가 조회 범위는 OPEN-07이다. */
        NoSaleResult: {
            auctionId: components["schemas"]["OpaqueId"];
            lotId: components["schemas"]["OpaqueId"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "NO_SALE";
            finalizedAt: components["schemas"]["UtcInstant"];
        };
        /** @description 허용된 개별 상품 경매 취소. 회차 취소에 의한 미진행과 다르다. 공개 취소 사유 필드는 추가하지 않는다. */
        CancelledResult: {
            auctionId: components["schemas"]["OpaqueId"];
            lotId: components["schemas"]["OpaqueId"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "CANCELLED";
            finalizedAt: components["schemas"]["UtcInstant"];
        };
        PublicAuctionResult: components["schemas"]["SoldResult"] | components["schemas"]["NoSaleResult"] | components["schemas"]["CancelledResult"];
        /** @description 진행 대상의 공개 상태. 승인 입찰 없으면 highestBidAmount=null이고 nextBidAmount=startingPrice. FOLLOWUP_WAIT에는 승인 최고입찰이 존재한다. 준비/중단 후 다음 상품 준비 미개시의 시간은 null 가능. 실제 개시/재개·마감 원값을 보존하며 controlState가 중단/보류면 입찰 가능으로 해석하지 않는다. */
        PublicCurrentAuction: {
            auctionId: components["schemas"]["OpaqueId"];
            lotId: components["schemas"]["OpaqueId"];
            /** @enum {string} */
            stage: "PREPARATION" | "INITIAL_WAIT" | "FOLLOWUP_WAIT";
            startingPrice: components["schemas"]["MoneyWon"];
            bidIncrement: components["schemas"]["MoneyWon"];
            highestBidAmount: components["schemas"]["MoneyWon"] | null;
            reserveMet: boolean;
            nextBidAmount: components["schemas"]["MoneyWon"];
            windowStartAt: components["schemas"]["UtcInstant"] | null;
            opensAt: components["schemas"]["UtcInstant"] | null;
            closesAt: components["schemas"]["UtcInstant"] | null;
        } & (unknown & unknown);
        /** @description 같은 레인 버전의 전체 공개 상태. 종료된 Auction을 currentAuction의 live 가격 형태로 남기지 않는다. lastResult도 공개 결과 스키마만 사용한다. FINISHED는 남은 대상과 보류가 없어 currentAuction=null이며 control flags=false인 상태다. */
        PublicLaneState: {
            laneId: components["schemas"]["LaneId"];
            laneVersion: components["schemas"]["Counter"];
            /** @enum {string} */
            status: "RUNNING" | "FINISHED";
            controlState: components["schemas"]["ControlState"];
            currentAuction: components["schemas"]["PublicCurrentAuction"] | null;
            lastResult: components["schemas"]["PublicAuctionResult"] | null;
        } & unknown;
        /** @description 공개된 회차만. PUBLISHED=공개 후 시작 전, WAITING=예약 시각 후 선행 회차 등 시작 조건 대기, ACTIVE=진행/중단/보류 포함. 예약 시각을 실제 시작으로 덮어쓰지 않는다. 공개는 예약 시작일 전날 00:00 Asia/Seoul. 실제 시작 때 공통 시간 세트 고정. */
        PublicRoundState: {
            roundId: components["schemas"]["OpaqueId"];
            roundVersion: components["schemas"]["Counter"];
            /** @enum {string} */
            status: "PUBLISHED" | "WAITING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
            recruitmentOpensAt: components["schemas"]["UtcInstant"];
            publicationAt: components["schemas"]["UtcInstant"];
            scheduledStartsAt: components["schemas"]["UtcInstant"];
            actualStartedAt: components["schemas"]["UtcInstant"] | null;
            completedAt: components["schemas"]["UtcInstant"] | null;
            cancelledAt: components["schemas"]["UtcInstant"] | null;
            laneCount: number;
            durations: components["schemas"]["DurationSettings"];
            durationsFrozen: boolean;
        };
        /** @description 한 READ ONLY 일관 읽기의 공개 회차·운영 레인·watermark와 해당 시점까지의 opaque vector cursor. roundId는 round.roundId와 동일하고 lanes는 laneId 오름차순·중복 없음·laneCount와 일치. serverTime은 응답 구성 시 권위 시계 표본이며 입찰 접수 시각/COMMIT 완료 시각이 아니다. 이 커서 이후 영속 재생이 필수. */
        AuctionSnapshot: {
            /** @constant */
            schemaVersion: 1;
            streamEpoch: components["schemas"]["OpaqueId"];
            roundId: components["schemas"]["OpaqueId"];
            serverTime: components["schemas"]["UtcInstant"];
            round: components["schemas"]["PublicRoundState"];
            lanes: components["schemas"]["PublicLaneState"][];
            cursor: components["schemas"]["StreamCursor"];
        };
        /** @description 공개 번호·자리는 공개 후 취소돼도 유지한다. ROUND_CANCELLED는 회차 취소로 미진행이며 가상의 개별 CANCELLED/NO_SALE 결과를 만들지 않는다. reservePrice·판매자/입찰자 식별·이메일은 없다. */
        PublishedLot: {
            lotId: components["schemas"]["OpaqueId"];
            auctionId: components["schemas"]["OpaqueId"];
            roundId: components["schemas"]["OpaqueId"];
            laneId: components["schemas"]["LaneId"];
            publicNumber: number;
            title: components["schemas"]["NonBlankString"];
            description: components["schemas"]["NonBlankString"];
            photoIds: components["schemas"]["OpaqueId"][];
            startingPrice: components["schemas"]["MoneyWon"];
            bidIncrement: components["schemas"]["MoneyWon"];
            /** @enum {string} */
            availability: "PUBLISHED" | "WITHDRAWN" | "ROUND_CANCELLED";
        };
        /** @description WAITING/LIVE에는 result=null, FINISHED에는 liveState=null·result 존재, ROUND_CANCELLED는 둘 다 null. 종료 결과는 live DTO를 직렬화하지 않는다. */
        PublicAuctionView: {
            auctionId: components["schemas"]["OpaqueId"];
            lotId: components["schemas"]["OpaqueId"];
            roundId: components["schemas"]["OpaqueId"];
            laneId: components["schemas"]["LaneId"];
            /** @enum {string} */
            lifecycle: "WAITING" | "LIVE" | "FINISHED" | "ROUND_CANCELLED";
            liveState: components["schemas"]["PublicCurrentAuction"] | null;
            result: components["schemas"]["PublicAuctionResult"] | null;
        } & (unknown & unknown & unknown & unknown);
        /** @description 공개 회차의 scheduledStartsAt, roundId 오름차순. 페이지 크기는 이 초안에서 고정하지 않으며 nextCursor=null이면 끝. 새 변경 중 목록이 완전히 고정된다는 보장은 없다. */
        PublicRoundPage: {
            items: components["schemas"]["PublicRoundState"][];
            nextCursor: components["schemas"]["OpaqueId"] | null;
        };
        /** @description laneId, 공개 당시 publicNumber 오름차순. 공개 취소 번호를 당기지 않는다. */
        PublishedLotPage: {
            items: components["schemas"]["PublishedLot"][];
            nextCursor: components["schemas"]["OpaqueId"] | null;
        };
        RegisterBidIntent: {
            auctionId: components["schemas"]["OpaqueId"];
            amount: components["schemas"]["MoneyWon"];
        };
        /** @description 회원+requestId의 원경매·금액 고정. REGISTERED는 공식 입찰 접수/승인/순번 확보가 아니다. 같은 의도 최초 실제 제출·재전송은 허용. 이미 확인한 옛 키 PUT은 원의도만 반환하고 다시 현재 의도로 만들지 않는다. */
        BidIntent: {
            requestId: components["schemas"]["OpaqueId"];
            auctionId: components["schemas"]["OpaqueId"];
            amount: components["schemas"]["MoneyWon"];
            /** @constant */
            registrationState: "REGISTERED";
            registeredAt: components["schemas"]["UtcInstant"];
            acknowledgedAt: components["schemas"]["UtcInstant"] | null;
        };
        /** @description 해당 인증 회원×Auction의 현재 미확인 공유 의도. 없음은 intent=null. 조회 부재/timeout으로 의도를 폐기하거나 원입찰 미접수를 영구 확정하지 않는다. */
        CurrentBidIntent: {
            auctionId: components["schemas"]["OpaqueId"];
            intent: components["schemas"]["BidIntent"] | null;
        };
        /** @description 등록 확인한 같은 requestId·원경매·원금액. actor는 세션에서 확보하며 본문으로 보내지 않는다. */
        SubmitBid: {
            requestId: components["schemas"]["OpaqueId"];
            amount: components["schemas"]["MoneyWon"];
        };
        /** @description 공식 접수 내구 기록 존재·미판정. receivedAt은 인증/기본형식 확인 후 gate 안에서 원기록에 넣은 시각이며 HTTP 도착/등록/판정/응답 시각과 다르다. 접수 사실은 commit 성공 후 응답한다. */
        BidPending: {
            requestId: components["schemas"]["OpaqueId"];
            auctionId: components["schemas"]["OpaqueId"];
            amount: components["schemas"]["MoneyWon"];
            receivedAt: components["schemas"]["UtcInstant"];
            receiptSequence: components["schemas"]["ReceiptSequence"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "PENDING";
        };
        /** @description 원최종 승인. resultingClosesAt=이 원입찰 receivedAt+회차 고정 후속 시간. 현재 최고입찰자·낙찰 보장이 아니다. 조회/재전송은 같은 원시각·순번·판정·마감 값을 반환하며 현재 상태로 재계산하지 않는다. */
        BidApproved: {
            requestId: components["schemas"]["OpaqueId"];
            auctionId: components["schemas"]["OpaqueId"];
            amount: components["schemas"]["MoneyWon"];
            receivedAt: components["schemas"]["UtcInstant"];
            receiptSequence: components["schemas"]["ReceiptSequence"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "APPROVED";
            outcomeId: components["schemas"]["OpaqueId"];
            decidedAt: components["schemas"]["UtcInstant"];
            resultingClosesAt: components["schemas"]["UtcInstant"];
        };
        /** @enum {string} */
        BidRejectionCode: "SELF_LISTING" | "CURRENT_LEADER" | "WRONG_AMOUNT" | "BEFORE_BIDDING_WINDOW" | "DEADLINE_REACHED" | "BIDDING_SUSPENDED" | "AUCTION_NOT_CURRENT" | "AUCTION_FINISHED" | "AUCTION_CANCELLED";
        /** @description 내구 저장된 원최종 업무 거절. 가격·마감 효과 없음. 운영/통신/인증/조회 없음·단순 처리 지연은 이 원거절을 대신하지 않는다. */
        BidRejected: {
            requestId: components["schemas"]["OpaqueId"];
            auctionId: components["schemas"]["OpaqueId"];
            amount: components["schemas"]["MoneyWon"];
            receivedAt: components["schemas"]["UtcInstant"];
            receiptSequence: components["schemas"]["ReceiptSequence"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "REJECTED";
            outcomeId: components["schemas"]["OpaqueId"];
            decidedAt: components["schemas"]["UtcInstant"];
            rejectionCode: components["schemas"]["BidRejectionCode"];
        };
        BidRequest: components["schemas"]["BidPending"] | components["schemas"]["BidApproved"] | components["schemas"]["BidRejected"];
        FinalBidOutcome: components["schemas"]["BidApproved"] | components["schemas"]["BidRejected"];
        /** @description 앱이 이 requestId의 해당 원최종 판정을 실제 수신·반영한 뒤 자동 전송. 사람의 읽음·모든 기기 확인은 요구하지 않는다. */
        AcknowledgeBidOutcome: {
            outcomeId: components["schemas"]["OpaqueId"];
        };
        /** @description 해당 의도에 대한 최초 확인 시각. 같은 ACK 재시도는 원시각을 반환. 어느 기기 확인이든 해당 공유 제한만 해제하며 최고자 재입찰 금지 등 다른 조건은 유지한다. 옛 ACK는 새 의도에 영향 없음. */
        BidAcknowledgement: {
            requestId: components["schemas"]["OpaqueId"];
            outcomeId: components["schemas"]["OpaqueId"];
            acknowledgedAt: components["schemas"]["UtcInstant"];
        };
        /** @enum {string} */
        ActionKind: "LOT_CREATE" | "LOT_UPDATE" | "LOT_CANCEL" | "ROUND_CREATE" | "ROUND_SCHEDULE_UPDATE" | "ROUND_LANES_UPDATE" | "ROUND_TIMING_UPDATE" | "ROUND_CANCEL" | "LANE_PAUSE" | "LANE_RESUME" | "AUCTION_CANCEL" | "RECOVERY_CONFIRM";
        /** @description 원요청의 대상. 생성 작업은 아직 식별하지 못한 대상이 null일 수 있다. 기존 상품/경매 취소는 원대상을 새 현재 상품으로 바꾸지 않는다. */
        ActionTarget: {
            roundId: components["schemas"]["OpaqueId"] | null;
            laneId: components["schemas"]["LaneId"] | null;
            lotId: components["schemas"]["OpaqueId"] | null;
            auctionId: components["schemas"]["OpaqueId"] | null;
        };
        /** @description 원행위자+requestId와 종류·원내용에 결합한 내구 접수. 운영자에게 requestId는 명령 번호다. 내부 Round/Lane 순번은 서로 다른 scope이며 전역 비교하지 않는다. */
        ActionPending: {
            requestId: components["schemas"]["OpaqueId"];
            kind: components["schemas"]["ActionKind"];
            target: components["schemas"]["ActionTarget"];
            receivedAt: components["schemas"]["UtcInstant"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "PENDING";
        };
        /** @description 원명령 효과의 성공. Lane 재개는 원실제 R을 effectiveAt에 보존하며 같은 키 재전송이 시간을 다시 주지 않는다. 현재 리소스 상태는 resourceUri로 별도 조회한다. */
        ActionSucceeded: {
            requestId: components["schemas"]["OpaqueId"];
            kind: components["schemas"]["ActionKind"];
            target: components["schemas"]["ActionTarget"];
            receivedAt: components["schemas"]["UtcInstant"];
            /** @constant */
            status: "SUCCEEDED";
            outcomeId: components["schemas"]["OpaqueId"];
            decidedAt: components["schemas"]["UtcInstant"];
            resourceUri: components["schemas"]["RelativeUrl"];
            effectiveAt: components["schemas"]["UtcInstant"] | null;
        } & (unknown & {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "SUCCEEDED";
        });
        /** @enum {string} */
        ActionRejectionCode: "NO_RECRUITING_ROUND" | "RECRUITMENT_CLOSED" | "LOT_NOT_EDITABLE" | "LOT_NOT_CANCELLABLE" | "LOT_NOT_OWNED" | "INVALID_SCHEDULE" | "SCHEDULE_CONFLICT" | "ROUND_NOT_EDITABLE" | "ROUND_NOT_CANCELLABLE" | "LANE_CONFIGURATION_FROZEN" | "TIMING_CONFIGURATION_FROZEN" | "NOT_CURRENT_AUCTION" | "ALREADY_FINAL" | "STALE_SUSPENSION" | "LANE_NOT_SUSPENDED" | "RECOVERY_NOT_CONFIRMED";
        /** @description 효과 없음이 확인된 원최종 업무 거절. 원효과/결과 존재 불명을 REJECTED로 바꾸지 않는다. 불명은 원기록 PENDING·복구 확인 경로를 유지한다. */
        ActionRejected: {
            requestId: components["schemas"]["OpaqueId"];
            kind: components["schemas"]["ActionKind"];
            target: components["schemas"]["ActionTarget"];
            receivedAt: components["schemas"]["UtcInstant"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            status: "REJECTED";
            outcomeId: components["schemas"]["OpaqueId"];
            decidedAt: components["schemas"]["UtcInstant"];
            rejectionCode: components["schemas"]["ActionRejectionCode"];
        };
        ActionRequest: components["schemas"]["ActionPending"] | components["schemas"]["ActionSucceeded"] | components["schemas"]["ActionRejected"];
        FinalActionOutcome: components["schemas"]["ActionSucceeded"] | components["schemas"]["ActionRejected"];
        /** @description MEMBER_ACTION 이름공간의 본인 출품 원요청만. */
        MemberActionRequest: {
            status: "MemberActionRequest";
        } & (Omit<components["schemas"]["ActionRequest"], "status"> & {
            /** @enum {unknown} */
            kind?: "LOT_CREATE" | "LOT_UPDATE" | "LOT_CANCEL";
        });
        /** @description OPERATOR_COMMAND 이름공간의 해당 운영자 원명령만. */
        OperatorCommand: {
            status: "OperatorCommand";
        } & (Omit<components["schemas"]["ActionRequest"], "status"> & {
            /** @enum {unknown} */
            kind?: "ROUND_CREATE" | "ROUND_SCHEDULE_UPDATE" | "ROUND_LANES_UPDATE" | "ROUND_TIMING_UPDATE" | "ROUND_CANCEL" | "LANE_PAUSE" | "LANE_RESUME" | "AUCTION_CANCEL" | "RECOVERY_CONFIRM";
        });
        CsrfToken: {
            /** @constant */
            headerName: "X-CSRF-Token";
            /** @description 비밀 CSRF 값. 로그·URL에 넣지 않는다. */
            token: string;
        };
        /** @description D-092에 따라 한 계정은 MEMBER 또는 OPERATOR 하나의 역할만 가진다. 운영 전용 계정은 회원 출품·입찰·개인 목록·당사자 연락처 권한을 갖지 않는다. 동일인이 별도 일반회원 계정을 사용하는 것까지 금지한 정책은 아니다. MEMBER는 이메일 검증 가입 완료를 전제로 한다. */
        SessionUser: {
            subjectId: components["schemas"]["OpaqueId"];
            /** Format: email */
            email: string;
            emailVerified: boolean;
            roles: ("MEMBER" | "OPERATOR")[];
        } & unknown;
        AnonymousSession: {
            /** @constant */
            authenticated: false;
            user: null;
        };
        AuthenticatedSession: {
            /** @constant */
            authenticated: true;
            user: components["schemas"]["SessionUser"];
        };
        SessionView: components["schemas"]["AnonymousSession"] | components["schemas"]["AuthenticatedSession"];
        LoginRequest: {
            /** Format: email */
            email: string;
            /** @description 원문 비밀번호. 정책은 OPEN-06. */
            password: string;
        };
        RegistrationRequest: {
            /** Format: email */
            email: string;
            /** @description 원문 비밀번호. 정책은 OPEN-06. */
            password: string;
        };
        /** @description 가입 완료/실명 확인이 아니며 이메일 검증 전 회원 출품/입찰 권한 없음. 메일 발송 요청과 실제 메일 도달도 다르다. */
        RegistrationReceipt: {
            registrationId: components["schemas"]["OpaqueId"];
            /** @constant */
            status: "VERIFICATION_REQUIRED";
        };
        VerificationRequest: {
            token: string;
        };
        VerifiedMember: {
            memberId: components["schemas"]["OpaqueId"];
            /** Format: email */
            email: string;
            /** @constant */
            emailVerified: true;
        };
        PasswordResetRequest: {
            /** Format: email */
            email: string;
        };
        /** @description 보안 응답 제안. 계정 존재·메일 도달·비밀번호 변경 성공을 뜻하지 않는다. 상세는 OPEN-06. */
        EmailActionReceipt: {
            /** @constant */
            status: "REQUEST_RECEIVED";
        };
        PasswordResetCompletion: {
            token: string;
            newPassword: string;
        };
        /** @description 사진 형식/크기/수 제한은 OPEN-05. multipart 경로의 존재가 무제한 업로드 승인이 아니다. */
        UploadPhotoRequest: {
            /** Format: binary */
            file: string;
        };
        /** @description 인증된 소유자의 저장 완료 사진. 연결 가능한지 출품 때 재검증한다. 외부 정적 경로로 비공개 사진을 노출하지 않는다. */
        StoredPhoto: {
            photoId: components["schemas"]["OpaqueId"];
            /** @constant */
            status: "STORED";
        };
        /** @description 현재 모집 회차로 서버가 자동 귀속. roundId·laneId·소유자는 본문에 받지 않는다. reservePrice >= startingPrice. D-093에 따라 reservePrice - startingPrice가 bidIncrement의 정수배일 필요는 없다. 단위 후보/금액·사진·텍스트 범위는 OPEN-05. */
        CreateLotRequest: {
            requestId: components["schemas"]["OpaqueId"];
            title: components["schemas"]["NonBlankString"];
            description: components["schemas"]["NonBlankString"];
            photoIds: components["schemas"]["OpaqueId"][];
            startingPrice: components["schemas"]["MoneyWon"];
            reservePrice: components["schemas"]["MoneyWon"];
            bidIncrement: components["schemas"]["MoneyWon"];
        };
        /** @description 전체 편집 가능 내용을 교체하되 최초 등록순·레인을 변경하지 않는다. 수정 시각을 등록순으로 사용하지 않는다. 공개 전 자기 공식 차례의 자격 확인. reservePrice >= startingPrice이며 D-093에 따라 최저낙찰가의 입찰 단위 정렬을 요구하지 않는다. */
        UpdateLotRequest: {
            requestId: components["schemas"]["OpaqueId"];
            title: components["schemas"]["NonBlankString"];
            description: components["schemas"]["NonBlankString"];
            photoIds: components["schemas"]["OpaqueId"][];
            startingPrice: components["schemas"]["MoneyWon"];
            reservePrice: components["schemas"]["MoneyWon"];
            bidIncrement: components["schemas"]["MoneyWon"];
        };
        /** @description 출품자 취소에 사유 필수 입력을 추가하지 않는다. 공개 후에도 유효 개시 전 원접수 취소 가능; 개시 정각에는 개시 우선. */
        MemberCancellation: {
            requestId: components["schemas"]["OpaqueId"];
        };
        /** @description 인증된 본인 출품 DTO. reservePrice는 여기에서만 소유자에게 제공. 전체 개인정보/관리 조회를 의미하지 않는다. */
        MyLot: {
            lotId: components["schemas"]["OpaqueId"];
            roundId: components["schemas"]["OpaqueId"];
            laneId: components["schemas"]["LaneId"];
            auctionId: components["schemas"]["OpaqueId"] | null;
            submittedAt: components["schemas"]["UtcInstant"];
            /** @enum {string} */
            status: "ACTIVE" | "WITHDRAWN" | "ROUND_CANCELLED";
            title: components["schemas"]["NonBlankString"];
            description: components["schemas"]["NonBlankString"];
            photoIds: components["schemas"]["OpaqueId"][];
            startingPrice: components["schemas"]["MoneyWon"];
            reservePrice: components["schemas"]["MoneyWon"];
            bidIncrement: components["schemas"]["MoneyWon"];
        };
        MyLotPage: {
            items: components["schemas"]["MyLot"][];
            nextCursor: components["schemas"]["OpaqueId"] | null;
        };
        /** @description 본인 참여 요약. 원입찰 판정은 bid-requests 조회로 확인. 다른 참가자 식별·입찰 이력은 포함하지 않음. */
        Participation: {
            auctionId: components["schemas"]["OpaqueId"];
            lotId: components["schemas"]["OpaqueId"];
            isCurrentLeader: boolean;
            currentIntentRequestId: components["schemas"]["OpaqueId"] | null;
            lastBidRequestId: components["schemas"]["OpaqueId"] | null;
            result: components["schemas"]["PublicAuctionResult"] | null;
        };
        ParticipationPage: {
            items: components["schemas"]["Participation"][];
            nextCursor: components["schemas"]["OpaqueId"] | null;
        };
        RecruitingRound: {
            roundId: components["schemas"]["OpaqueId"];
            recruitmentOpensAt: components["schemas"]["UtcInstant"];
            publicationAt: components["schemas"]["UtcInstant"];
            scheduledStartsAt: components["schemas"]["UtcInstant"];
        };
        /** @description 본인 출품 흐름에 필요한 현재 모집 여부·귀속 일정과 설정된 다음 모집 일정. nextRecruitment는 취소되지 않은 미래 모집 중 가장 이른 일정 또는 null. recruitingRound=null이면 현재 출품 접수 불가이며 다음 일정이 있으면 안내한다. 미공개 상품·배정·회원 정보는 포함하지 않는다. */
        ListingContext: {
            serverTime: components["schemas"]["UtcInstant"];
            recruitingRound: components["schemas"]["RecruitingRound"] | null;
            nextRecruitment: components["schemas"]["RecruitingRound"] | null;
        };
        /** @description 낙찰된 거래의 해당 출품자/낙찰자 서로에게만 상대 인증 가입 이메일 제공. 제3자·유찰/취소·운영자 역할만으로 조회 불가. 이메일 변경·접근 종료·보존은 OPEN-06/12. */
        TradeContact: {
            auctionId: components["schemas"]["OpaqueId"];
            /** Format: email */
            counterpartyEmail: string;
        };
        /** @description durations 생략 시 승인 기본 5/10/5초. publicationAt은 서버가 예약 시작일 전날 00:00 Asia/Seoul로 도출. 현재 <= 모집 시작 < 공개 < 예약 시작 및 모집 중복 없음. 일정 정밀도/미래 상한·시간 범위는 OPEN-01/05. */
        CreateRoundRequest: {
            requestId: components["schemas"]["OpaqueId"];
            recruitmentOpensAt: components["schemas"]["UtcInstant"];
            scheduledStartsAt: components["schemas"]["UtcInstant"];
            laneCount: number;
            durations?: components["schemas"]["DurationSettings"];
        };
        UpdateRoundSchedule: {
            requestId: components["schemas"]["OpaqueId"];
            recruitmentOpensAt: components["schemas"]["UtcInstant"];
            scheduledStartsAt: components["schemas"]["UtcInstant"];
        };
        UpdateRoundLanes: {
            requestId: components["schemas"]["OpaqueId"];
            laneCount: number;
        };
        UpdateRoundTiming: {
            requestId: components["schemas"]["OpaqueId"];
            durations: components["schemas"]["DurationSettings"];
        };
        /** @description 원운영자+번호에 종류·원대상·제출 사유 고정. 텍스트 길이 상한은 미정. 재전송에 사유를 바꾸지 않는다. */
        OperatorCancellation: {
            requestId: components["schemas"]["OpaqueId"];
            reason: components["schemas"]["NonBlankString"];
        };
        /** @description 사유는 제출하면 원명령에 고정. 중단이 앞선 입찰을 추월하지 않으며 단순 우선 처리 명령이 아니다. */
        PauseLane: {
            requestId: components["schemas"]["OpaqueId"];
            reason?: components["schemas"]["NonBlankString"];
        };
        /** @description 해당 회차·레인과 현재 해제 대상 발생 건에 결합. 원상품 일치를 모든 Lane 명령에 요구하지 않는다. 새 원인/새 중단이면 옛 명령으로 해제 불가. */
        ResumeLane: {
            requestId: components["schemas"]["OpaqueId"];
            suspensionOccurrenceId: components["schemas"]["OpaqueId"];
        };
        /** @description 해당 회차·레인과 현재 해제 대상 발생 건에 결합. 원상품 일치를 모든 Lane 명령에 요구하지 않는다. 새 원인/새 중단이면 옛 명령으로 해제 불가. */
        ConfirmRecovery: {
            requestId: components["schemas"]["OpaqueId"];
            suspensionOccurrenceId: components["schemas"]["OpaqueId"];
        };
        OperatorRound: {
            roundId: components["schemas"]["OpaqueId"];
            /** @enum {string} */
            status: "SCHEDULED" | "RECRUITING" | "PUBLISHED" | "WAITING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
            recruitmentOpensAt: components["schemas"]["UtcInstant"];
            publicationAt: components["schemas"]["UtcInstant"];
            scheduledStartsAt: components["schemas"]["UtcInstant"];
            actualStartedAt: components["schemas"]["UtcInstant"] | null;
            laneCount: number;
            durations: components["schemas"]["DurationSettings"];
            durationsFrozen: boolean;
        };
        OperatorRoundPage: {
            items: components["schemas"]["OperatorRound"][];
            nextCursor: components["schemas"]["OpaqueId"] | null;
        };
        /** @description 운영자 조회에만 제공할 복구 제어 맥락. historyStatus는 증거 확인 결과이며 임의 true 입력으로 덮어쓰지 않는다. */
        RecoveryControl: {
            suspensionOccurrenceId: components["schemas"]["OpaqueId"] | null;
            incidentIds: components["schemas"]["OpaqueId"][];
            /** @enum {string} */
            historyStatus: "CHECKING" | "COMPLETE" | "UNKNOWN";
            recoveryConfirmed: boolean;
        };
        OperatorLaneView: {
            roundId: components["schemas"]["OpaqueId"];
            lane: components["schemas"]["PublicLaneState"];
            recovery: components["schemas"]["RecoveryControl"];
        };
        /** @enum {string} */
        ProblemCode: "VALIDATION_FAILED" | "AUTHENTICATION_REQUIRED" | "AUTHENTICATION_FAILED" | "ROLE_REQUIRED" | "EMAIL_NOT_VERIFIED" | "CSRF_INVALID" | "RESOURCE_NOT_FOUND" | "REQUEST_RECORD_NOT_FOUND" | "CONTENT_CONFLICT" | "UNCONFIRMED_INTENT_EXISTS" | "INTENT_NOT_REGISTERED" | "OUTCOME_NOT_FINAL" | "OUTCOME_MISMATCH" | "RATE_LIMITED" | "SERVICE_UNAVAILABLE" | "COMMIT_RESULT_UNKNOWN" | "RECOVERY_REVIEW_REQUIRED" | "INTERNAL_ERROR";
        /** @description 필드 위치와 입력 오류 안내. 비밀번호·토큰·제출 원문은 넣지 않는다. */
        FieldViolation: {
            field: string;
            reason: string;
        };
        /** @description 접수 전후 프로토콜/보안/가용성 오류. 이 응답 자체는 원입찰 최종 REJECTED가 아니다. HTTP timeout/5xx/기록 없음 뒤 원키로 복구하며 새 키·의도 포기로 제한을 풀지 않는다. */
        Problem: {
            code: components["schemas"]["ProblemCode"];
            message: string;
            traceId: components["schemas"]["OpaqueId"];
            serverTime: components["schemas"]["UtcInstant"];
            fieldErrors: components["schemas"]["FieldViolation"][];
        };
        /** @description data.roundId는 envelope.roundId와 동일. occurredAt은 공개 변화와 함께 기록한 서버 시각이며 실제 전이 S/N/R·flush·클라이언트 반영 시각을 대체하지 않는다. */
        RoundStateEvent: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "round.state.changed";
            /** @constant */
            schemaVersion: 1;
            eventId: components["schemas"]["OpaqueId"];
            streamEpoch: components["schemas"]["OpaqueId"];
            roundId: components["schemas"]["OpaqueId"];
            occurredAt: components["schemas"]["UtcInstant"];
            data: components["schemas"]["PublicRoundState"];
        };
        LaneStateEvent: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "lane.state.changed";
            /** @constant */
            schemaVersion: 1;
            eventId: components["schemas"]["OpaqueId"];
            streamEpoch: components["schemas"]["OpaqueId"];
            roundId: components["schemas"]["OpaqueId"];
            occurredAt: components["schemas"]["UtcInstant"];
            data: components["schemas"]["PublicLaneState"];
        };
        /** @description 관측 순간 권위 버전 광고. SSE id를 내보내거나 cursor를 전진시키지 않는다. 마지막 데이터 유실 발견 보조이며 앱 원판정 ACK 아님. */
        HeartbeatEvent: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "stream.heartbeat";
            /** @constant */
            schemaVersion: 1;
            streamEpoch: components["schemas"]["OpaqueId"];
            roundId: components["schemas"]["OpaqueId"];
            serverTime: components["schemas"]["UtcInstant"];
            roundVersion: components["schemas"]["Counter"];
            laneVersions: components["schemas"]["LaneWatermark"][];
        };
        /** @description SSE id 없음. 클라이언트는 기존 EventSource를 닫고 snapshot으로 복원한 cursor로 새 연결을 만든다. unknown schema를 같은 자동 재시도 루프로 반복하지 않는다. */
        ResyncRequiredEvent: {
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "stream.resync-required";
            /** @constant */
            schemaVersion: 1;
            streamEpoch: components["schemas"]["OpaqueId"];
            roundId: components["schemas"]["OpaqueId"];
            serverTime: components["schemas"]["UtcInstant"];
            /** @enum {string} */
            reason: "EPOCH_CHANGED" | "CURSOR_INVALID" | "REPLAY_UNAVAILABLE" | "BUFFER_OVERFLOW" | "PROTOCOL_UNSUPPORTED";
            snapshotUrl: components["schemas"]["RelativeUrl"];
        };
        StreamEvent: components["schemas"]["RoundStateEvent"] | components["schemas"]["LaneStateEvent"] | components["schemas"]["HeartbeatEvent"] | components["schemas"]["ResyncRequiredEvent"];
    };
    responses: {
        /** @description HTTP 400: VALIDATION_FAILED. 원입찰 최종 판정이나 미확인 해제를 뜻하지 않는다. */
        Error400: {
            headers: {
                /** @description JSON 및 동적 응답은 no-store. */
                "Cache-Control"?: "no-store";
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Problem"] & {
                    /** @enum {unknown} */
                    code?: "VALIDATION_FAILED";
                };
            };
        };
        /** @description HTTP 401: AUTHENTICATION_REQUIRED, AUTHENTICATION_FAILED. 원입찰 최종 판정이나 미확인 해제를 뜻하지 않는다. */
        Error401: {
            headers: {
                /** @description JSON 및 동적 응답은 no-store. */
                "Cache-Control"?: "no-store";
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Problem"] & {
                    /** @enum {unknown} */
                    code?: "AUTHENTICATION_REQUIRED" | "AUTHENTICATION_FAILED";
                };
            };
        };
        /** @description HTTP 403: ROLE_REQUIRED, EMAIL_NOT_VERIFIED, CSRF_INVALID. 원입찰 최종 판정이나 미확인 해제를 뜻하지 않는다. */
        Error403: {
            headers: {
                /** @description JSON 및 동적 응답은 no-store. */
                "Cache-Control"?: "no-store";
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Problem"] & {
                    /** @enum {unknown} */
                    code?: "ROLE_REQUIRED" | "EMAIL_NOT_VERIFIED" | "CSRF_INVALID";
                };
            };
        };
        /** @description HTTP 404: RESOURCE_NOT_FOUND, REQUEST_RECORD_NOT_FOUND. 원입찰 최종 판정이나 미확인 해제를 뜻하지 않는다. */
        Error404: {
            headers: {
                /** @description JSON 및 동적 응답은 no-store. */
                "Cache-Control"?: "no-store";
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Problem"] & {
                    /** @enum {unknown} */
                    code?: "RESOURCE_NOT_FOUND" | "REQUEST_RECORD_NOT_FOUND";
                };
            };
        };
        /** @description HTTP 409: CONTENT_CONFLICT, UNCONFIRMED_INTENT_EXISTS, INTENT_NOT_REGISTERED, OUTCOME_NOT_FINAL, OUTCOME_MISMATCH. 원입찰 최종 판정이나 미확인 해제를 뜻하지 않는다. */
        Error409: {
            headers: {
                /** @description JSON 및 동적 응답은 no-store. */
                "Cache-Control"?: "no-store";
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Problem"] & {
                    /** @enum {unknown} */
                    code?: "CONTENT_CONFLICT" | "UNCONFIRMED_INTENT_EXISTS" | "INTENT_NOT_REGISTERED" | "OUTCOME_NOT_FINAL" | "OUTCOME_MISMATCH";
                };
            };
        };
        /** @description HTTP 429: RATE_LIMITED. 원입찰 최종 판정이나 미확인 해제를 뜻하지 않는다. */
        Error429: {
            headers: {
                /** @description JSON 및 동적 응답은 no-store. */
                "Cache-Control"?: "no-store";
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Problem"] & {
                    /** @enum {unknown} */
                    code?: "RATE_LIMITED";
                };
            };
        };
        /** @description HTTP 503: SERVICE_UNAVAILABLE, COMMIT_RESULT_UNKNOWN, RECOVERY_REVIEW_REQUIRED. 원입찰 최종 판정이나 미확인 해제를 뜻하지 않는다. */
        Error503: {
            headers: {
                /** @description JSON 및 동적 응답은 no-store. */
                "Cache-Control"?: "no-store";
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Problem"] & {
                    /** @enum {unknown} */
                    code?: "SERVICE_UNAVAILABLE" | "COMMIT_RESULT_UNKNOWN" | "RECOVERY_REVIEW_REQUIRED";
                };
            };
        };
        /** @description HTTP 500: INTERNAL_ERROR. 원입찰 최종 판정이나 미확인 해제를 뜻하지 않는다. */
        Error500: {
            headers: {
                /** @description JSON 및 동적 응답은 no-store. */
                "Cache-Control"?: "no-store";
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Problem"] & {
                    /** @enum {unknown} */
                    code?: "INTERNAL_ERROR";
                };
            };
        };
    };
    parameters: {
        /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
        CsrfToken: string;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getCsrfToken: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CsrfToken"];
                };
            };
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionView"];
                };
            };
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    logout: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 현재 세션 무효화. 기존 원판정/공유 의도는 보존. */
            204: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    registerMember: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegistrationRequest"];
            };
        };
        responses: {
            /** @description 성공 */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegistrationReceipt"];
                };
            };
            400: components["responses"]["Error400"];
            403: components["responses"]["Error403"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    verifyEmail: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VerificationRequest"];
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VerifiedMember"];
                };
            };
            400: components["responses"]["Error400"];
            403: components["responses"]["Error403"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    login: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginRequest"];
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthenticatedSession"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    requestPasswordReset: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasswordResetRequest"];
            };
        };
        responses: {
            /** @description 성공 */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EmailActionReceipt"];
                };
            };
            400: components["responses"]["Error400"];
            403: components["responses"]["Error403"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    completePasswordReset: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasswordResetCompletion"];
            };
        };
        responses: {
            /** @description 새 비밀번호로 로그인 가능·기존 비밀번호 불가. 기존 세션 처리와 토큰 만료/재사용은 OPEN-06 결정 필요. */
            204: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["Error400"];
            403: components["responses"]["Error403"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    listPublicRounds: {
        parameters: {
            query?: {
                /** @description 서버가 반환한 목록 페이지 커서. stream cursor와 혼용 금지. */
                cursor?: components["schemas"]["OpaqueId"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicRoundPage"];
                };
            };
            400: components["responses"]["Error400"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getPublicRound: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 원회차 식별 */
                roundId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicRoundState"];
                };
            };
            400: components["responses"]["Error400"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    listPublishedLots: {
        parameters: {
            query?: {
                /** @description 서버가 반환한 목록 페이지 커서. stream cursor와 혼용 금지. */
                cursor?: components["schemas"]["OpaqueId"];
            };
            header?: never;
            path: {
                /** @description 원회차 식별 */
                roundId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublishedLotPage"];
                };
            };
            400: components["responses"]["Error400"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getPublishedLot: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 원출품 식별 */
                lotId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublishedLot"];
                };
            };
            400: components["responses"]["Error400"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getPublishedPhoto: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 원출품 식별 */
                lotId: components["schemas"]["OpaqueId"];
                /** @description 해당 공개 상품의 사진 */
                photoId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 공개 상태·상품 관계 확인 후 이미지 바이너리. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "image/*": string;
                };
            };
            400: components["responses"]["Error400"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getPublicAuction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 원경매 식별; 레인은 서버 기록에서 결정 */
                auctionId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicAuctionView"];
                };
            };
            400: components["responses"]["Error400"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getAuctionSnapshot: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 원회차 식별 */
                roundId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuctionSnapshot"];
                };
            };
            400: components["responses"]["Error400"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    subscribeAuctionEvents: {
        parameters: {
            query?: {
                /** @description snapshot 또는 적용한 프레임의 opaque vector cursor. 값이 있으면 Last-Event-ID보다 우선한다. */
                cursor?: components["schemas"]["StreamCursor"];
            };
            header?: {
                /** @description 기본 EventSource 재접속 표식. 앱 반영 확인 아님. cursor query가 있으면 그 값을 우선. */
                "Last-Event-ID"?: components["schemas"]["StreamCursor"];
            };
            path: {
                /** @description 원회차 식별 */
                roundId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description text/event-stream. JSON 프레임은 StreamEvent. cursor가 없거나 재생할 수 없으면 resync-required 후 종료. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    /** @description UTF-8 SSE 프레임 */
                    "Content-Type"?: "text/event-stream";
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": string;
                };
            };
            400: components["responses"]["Error400"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getListingContext: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ListingContext"];
                };
            };
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    listMyLots: {
        parameters: {
            query?: {
                /** @description 서버가 반환한 목록 페이지 커서. stream cursor와 혼용 금지. */
                cursor?: components["schemas"]["OpaqueId"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MyLotPage"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    createLot: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateLotRequest"];
            };
        };
        responses: {
            /** @description 기록된 원최종 결과. 같은 키는 현재 상태로 재실행하지 않는다. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Omit<components["schemas"]["FinalActionOutcome"], "status"> & {
                        /** @constant */
                        kind?: "LOT_CREATE";
                    };
                };
            };
            /** @description 내구 접수·아직 처리 중. */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    /** @description 인증된 원요청 조회 URI. */
                    Location?: components["schemas"]["RelativeUrl"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPending"] & {
                        /** @constant */
                        kind?: "LOT_CREATE";
                    };
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getMyLot: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 원출품 식별 */
                lotId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MyLot"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    updateLot: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path: {
                /** @description 원출품 식별 */
                lotId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateLotRequest"];
            };
        };
        responses: {
            /** @description 기록된 원최종 결과. 같은 키는 현재 상태로 재실행하지 않는다. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Omit<components["schemas"]["FinalActionOutcome"], "status"> & {
                        /** @constant */
                        kind?: "LOT_UPDATE";
                    };
                };
            };
            /** @description 내구 접수·아직 처리 중. */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    /** @description 인증된 원요청 조회 URI. */
                    Location?: components["schemas"]["RelativeUrl"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPending"] & {
                        /** @constant */
                        kind?: "LOT_UPDATE";
                    };
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    listMyParticipations: {
        parameters: {
            query?: {
                /** @description 서버가 반환한 목록 페이지 커서. stream cursor와 혼용 금지. */
                cursor?: components["schemas"]["OpaqueId"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParticipationPage"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    uploadPhoto: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["UploadPhotoRequest"];
            };
        };
        responses: {
            /** @description 성공 */
            201: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StoredPhoto"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getOwnedPhoto: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 본인 소유 사진 */
                photoId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 같은 인증 회원이 소유한 기존 업로드/출품 사진 바이너리. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "image/*": string;
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    cancelOwnLot: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path: {
                /** @description 원출품 식별 */
                lotId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["MemberCancellation"];
            };
        };
        responses: {
            /** @description 기록된 원최종 결과. 같은 키는 현재 상태로 재실행하지 않는다. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Omit<components["schemas"]["FinalActionOutcome"], "status"> & {
                        /** @constant */
                        kind?: "LOT_CANCEL";
                    };
                };
            };
            /** @description 내구 접수·아직 처리 중. */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    /** @description 인증된 원요청 조회 URI. */
                    Location?: components["schemas"]["RelativeUrl"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPending"] & {
                        /** @constant */
                        kind?: "LOT_CANCEL";
                    };
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getMyActionRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 인증된 본인/운영자의 원요청·명령 키 */
                requestId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemberActionRequest"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    registerBidIntent: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path: {
                /** @description 인증된 본인/운영자의 원요청·명령 키 */
                requestId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegisterBidIntent"];
            };
        };
        responses: {
            /** @description 같은 키·내용의 원등록. ACK된 옛 의도를 현재 의도로 되살리지 않는다. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BidIntent"];
                };
            };
            /** @description 성공 */
            201: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BidIntent"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getCurrentBidIntent: {
        parameters: {
            query: {
                /** @description 해당 원경매 */
                auctionId: components["schemas"]["OpaqueId"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CurrentBidIntent"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    submitBid: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path: {
                /** @description 원경매 식별; 레인은 서버 기록에서 결정 */
                auctionId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitBid"];
            };
        };
        responses: {
            /** @description 이미 기록되었거나 응답 시점에 확인한 원최종 판정. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FinalBidOutcome"];
                };
            };
            /** @description 성공 */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    /** @description /api/v1/me/bid-requests/{requestId} */
                    Location?: components["schemas"]["RelativeUrl"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BidPending"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getBidRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 인증된 본인/운영자의 원요청·명령 키 */
                requestId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BidRequest"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    acknowledgeBidOutcome: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path: {
                /** @description 인증된 본인/운영자의 원요청·명령 키 */
                requestId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AcknowledgeBidOutcome"];
            };
        };
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BidAcknowledgement"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getTradeContact: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 원경매 식별; 레인은 서버 기록에서 결정 */
                auctionId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TradeContact"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    listOperatorRounds: {
        parameters: {
            query?: {
                /** @description 서버가 반환한 목록 페이지 커서. stream cursor와 혼용 금지. */
                cursor?: components["schemas"]["OpaqueId"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperatorRoundPage"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    createRound: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateRoundRequest"];
            };
        };
        responses: {
            /** @description 기록된 원최종 결과. 같은 키는 현재 상태로 재실행하지 않는다. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Omit<components["schemas"]["FinalActionOutcome"], "status"> & {
                        /** @constant */
                        kind?: "ROUND_CREATE";
                    };
                };
            };
            /** @description 내구 접수·아직 처리 중. */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    /** @description 인증된 원요청 조회 URI. */
                    Location?: components["schemas"]["RelativeUrl"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPending"] & {
                        /** @constant */
                        kind?: "ROUND_CREATE";
                    };
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getOperatorRound: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 원회차 식별 */
                roundId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperatorRound"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    updateRoundSchedule: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path: {
                /** @description 원회차 식별 */
                roundId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateRoundSchedule"];
            };
        };
        responses: {
            /** @description 기록된 원최종 결과. 같은 키는 현재 상태로 재실행하지 않는다. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Omit<components["schemas"]["FinalActionOutcome"], "status"> & {
                        /** @constant */
                        kind?: "ROUND_SCHEDULE_UPDATE";
                    };
                };
            };
            /** @description 내구 접수·아직 처리 중. */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    /** @description 인증된 원요청 조회 URI. */
                    Location?: components["schemas"]["RelativeUrl"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPending"] & {
                        /** @constant */
                        kind?: "ROUND_SCHEDULE_UPDATE";
                    };
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    updateRoundLanes: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path: {
                /** @description 원회차 식별 */
                roundId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateRoundLanes"];
            };
        };
        responses: {
            /** @description 기록된 원최종 결과. 같은 키는 현재 상태로 재실행하지 않는다. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Omit<components["schemas"]["FinalActionOutcome"], "status"> & {
                        /** @constant */
                        kind?: "ROUND_LANES_UPDATE";
                    };
                };
            };
            /** @description 내구 접수·아직 처리 중. */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    /** @description 인증된 원요청 조회 URI. */
                    Location?: components["schemas"]["RelativeUrl"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPending"] & {
                        /** @constant */
                        kind?: "ROUND_LANES_UPDATE";
                    };
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    updateRoundTiming: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path: {
                /** @description 원회차 식별 */
                roundId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateRoundTiming"];
            };
        };
        responses: {
            /** @description 기록된 원최종 결과. 같은 키는 현재 상태로 재실행하지 않는다. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Omit<components["schemas"]["FinalActionOutcome"], "status"> & {
                        /** @constant */
                        kind?: "ROUND_TIMING_UPDATE";
                    };
                };
            };
            /** @description 내구 접수·아직 처리 중. */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    /** @description 인증된 원요청 조회 URI. */
                    Location?: components["schemas"]["RelativeUrl"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPending"] & {
                        /** @constant */
                        kind?: "ROUND_TIMING_UPDATE";
                    };
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    cancelRound: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path: {
                /** @description 원회차 식별 */
                roundId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OperatorCancellation"];
            };
        };
        responses: {
            /** @description 기록된 원최종 결과. 같은 키는 현재 상태로 재실행하지 않는다. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Omit<components["schemas"]["FinalActionOutcome"], "status"> & {
                        /** @constant */
                        kind?: "ROUND_CANCEL";
                    };
                };
            };
            /** @description 내구 접수·아직 처리 중. */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    /** @description 인증된 원요청 조회 URI. */
                    Location?: components["schemas"]["RelativeUrl"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPending"] & {
                        /** @constant */
                        kind?: "ROUND_CANCEL";
                    };
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getOperatorLane: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 원회차 식별 */
                roundId: components["schemas"]["OpaqueId"];
                /** @description 원회차 안의 레인 번호 */
                laneId: components["schemas"]["LaneId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperatorLaneView"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    pauseLane: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path: {
                /** @description 원회차 식별 */
                roundId: components["schemas"]["OpaqueId"];
                /** @description 원회차 안의 레인 번호 */
                laneId: components["schemas"]["LaneId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PauseLane"];
            };
        };
        responses: {
            /** @description 기록된 원최종 결과. 같은 키는 현재 상태로 재실행하지 않는다. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Omit<components["schemas"]["FinalActionOutcome"], "status"> & {
                        /** @constant */
                        kind?: "LANE_PAUSE";
                    };
                };
            };
            /** @description 내구 접수·아직 처리 중. */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    /** @description 인증된 원요청 조회 URI. */
                    Location?: components["schemas"]["RelativeUrl"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPending"] & {
                        /** @constant */
                        kind?: "LANE_PAUSE";
                    };
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    resumeLane: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path: {
                /** @description 원회차 식별 */
                roundId: components["schemas"]["OpaqueId"];
                /** @description 원회차 안의 레인 번호 */
                laneId: components["schemas"]["LaneId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ResumeLane"];
            };
        };
        responses: {
            /** @description 기록된 원최종 결과. 같은 키는 현재 상태로 재실행하지 않는다. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Omit<components["schemas"]["FinalActionOutcome"], "status"> & {
                        /** @constant */
                        kind?: "LANE_RESUME";
                    };
                };
            };
            /** @description 내구 접수·아직 처리 중. */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    /** @description 인증된 원요청 조회 URI. */
                    Location?: components["schemas"]["RelativeUrl"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPending"] & {
                        /** @constant */
                        kind?: "LANE_RESUME";
                    };
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    confirmRecovery: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path: {
                /** @description 원회차 식별 */
                roundId: components["schemas"]["OpaqueId"];
                /** @description 원회차 안의 레인 번호 */
                laneId: components["schemas"]["LaneId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConfirmRecovery"];
            };
        };
        responses: {
            /** @description 기록된 원최종 결과. 같은 키는 현재 상태로 재실행하지 않는다. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Omit<components["schemas"]["FinalActionOutcome"], "status"> & {
                        /** @constant */
                        kind?: "RECOVERY_CONFIRM";
                    };
                };
            };
            /** @description 내구 접수·아직 처리 중. */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    /** @description 인증된 원요청 조회 URI. */
                    Location?: components["schemas"]["RelativeUrl"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPending"] & {
                        /** @constant */
                        kind?: "RECOVERY_CONFIRM";
                    };
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    cancelCurrentAuction: {
        parameters: {
            query?: never;
            header: {
                /** @description GET /api/v1/auth/csrf에서 확보. 로그인/로그아웃 후 재취득. 변경 요청에 필수; 실패는 403 CSRF_INVALID. */
                "X-CSRF-Token": components["parameters"]["CsrfToken"];
            };
            path: {
                /** @description 원경매 식별; 레인은 서버 기록에서 결정 */
                auctionId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OperatorCancellation"];
            };
        };
        responses: {
            /** @description 기록된 원최종 결과. 같은 키는 현재 상태로 재실행하지 않는다. */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Omit<components["schemas"]["FinalActionOutcome"], "status"> & {
                        /** @constant */
                        kind?: "AUCTION_CANCEL";
                    };
                };
            };
            /** @description 내구 접수·아직 처리 중. */
            202: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    /** @description 인증된 원요청 조회 URI. */
                    Location?: components["schemas"]["RelativeUrl"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ActionPending"] & {
                        /** @constant */
                        kind?: "AUCTION_CANCEL";
                    };
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            409: components["responses"]["Error409"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
    getOperatorCommand: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description 인증된 본인/운영자의 원요청·명령 키 */
                requestId: components["schemas"]["OpaqueId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 성공 */
            200: {
                headers: {
                    /** @description JSON 및 동적 응답은 no-store. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OperatorCommand"];
                };
            };
            400: components["responses"]["Error400"];
            401: components["responses"]["Error401"];
            403: components["responses"]["Error403"];
            404: components["responses"]["Error404"];
            429: components["responses"]["Error429"];
            500: components["responses"]["Error500"];
            503: components["responses"]["Error503"];
        };
    };
}
