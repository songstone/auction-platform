import { useReducer, useState } from 'react';
import type { components } from '../generated/api.d.ts';
import { contractSource, examples } from '../generated/contract-examples.ts';
import { applyPreviewEvent, createPreviewState } from './preview-model.ts';

type Schema = components['schemas'];
const eventExamples: { label: string; payload: Schema['StreamEvent'] }[] = [
  { label: '회차 변경 · 중복', payload: examples.RoundChanged },
  { label: '레인 변경 · 중복', payload: examples.LaneChanged },
  { label: 'heartbeat', payload: examples.Heartbeat },
  { label: '재동기화 요구', payload: examples.ResyncRequired },
  { label: '레인 변경 · 유찰', payload: examples.NoSaleLaneChanged },
];
const bidExamples = [
  { label: '공유 의도 등록', meaning: 'REGISTERED는 입찰 접수 전입니다.', payload: examples.RegisteredIntent },
  { label: '접수 · 판정 대기', meaning: '202는 내구 접수·판정 대기를 뜻합니다. 승인·낙찰이 아닙니다.', payload: examples.PendingBid },
  { label: '원판정 승인', meaning: 'APPROVED는 이 원입찰의 승인입니다. 현재 최고자·낙찰 확정과 구분합니다.', payload: examples.ApprovedBid },
  { label: '다른 원요청의 거절', meaning: 'request_later의 별도 거절 예제입니다. 앞선 승인 요청의 후속 상태가 아닙니다.', payload: examples.RejectedBid },
  { label: '원판정 ACK', meaning: '원 outcomeId의 수신·반영 확인 예제입니다. 서버로 ACK를 보내지 않습니다.', payload: examples.AcknowledgedBid },
] as const;

function money(value: string | null): string {
  return value === null ? '없음' : `${value.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}

function LaneCard({ lane }: { lane: Schema['PublicLaneState'] }) {
  const auction = lane.currentAuction;
  const controlLabels = [lane.controlState.manualStopped && '중단', lane.controlState.held && '보류'].filter(Boolean).join(' · ') || '제어 제한 없음';
  return (
    <article className="lane panel">
      <div className="lane-heading"><h3>레인 {lane.laneId}</h3><span className="badge">v{lane.laneVersion}</span></div>
      <p className="status-line">{lane.status} · {controlLabels}</p>
      {auction ? <>
        <p className="mono muted">{auction.auctionId}</p>
        <p className="lane-price">{money(auction.highestBidAmount)}</p>
        <p className="muted">공개 최고입찰가 · {auction.stage}</p>
        <dl><div><dt>다음 금액</dt><dd>{money(auction.nextBidAmount)}</dd></div><div><dt>마감 원시각</dt><dd className="mono">{auction.closesAt ?? '미개시'}</dd></div></dl>
      </> : <div className="lane-empty"><p>현재 진행 상품 없음</p>{lane.lastResult && <p>최근 결과: {lane.lastResult.status}{lane.lastResult.status === 'SOLD' && ` · ${money(lane.lastResult.winningPrice)}`}</p>}</div>}
    </article>
  );
}

export default function ContractPreview() {
  const [state, dispatch] = useReducer((previous: ReturnType<typeof createPreviewState>, event: Schema['StreamEvent'] | null) => event ? applyPreviewEvent(previous, event) : createPreviewState(), undefined, createPreviewState);
  const [selectedBid, setSelectedBid] = useState(0);
  const [lastPayload, setLastPayload] = useState<Schema['StreamEvent'] | null>(null);
  const bid = bidExamples[selectedBid] ?? bidExamples[0];

  return (
    <main className="shell" data-preview="DEV_CONTRACT_PREVIEW_ONLY">
      <header className="page-heading"><div className="brand-mark" aria-hidden="true">4</div><div><p className="eyebrow">CONTRACT PREVIEW</p><h1>4레인 계약 미리보기</h1></div><a href="/" className="quiet-link">개발 셸</a></header>
      <aside className="mock-banner"><strong>개발용 고정 예제 · 실제 거래 없음</strong><p>OpenAPI {contractSource.version}의 합성 예제를 표시합니다. 서버 연결·입찰 전송·로그인·ACK는 수행하지 않습니다. 표시 시각은 예제 원문이며 현재 서버 시각이나 남은 시간이 아닙니다.</p></aside>
      <section className="overview panel" aria-label="모의 회차 상태"><div><p className="eyebrow">{state.baseline.roundId}</p><h2>{state.round.status} <span className="small">회차 v{state.round.roundVersion}</span></h2></div><div><span className={`badge ${state.needsResync ? 'warning' : ''}`}>{state.needsResync ? '재동기화 필요 · 모의' : 'snapshot 예제 · 미연결'}</span><p className="mono small muted">서버 표본 예제: {state.serverTimeSample}</p></div></section>
      <section className={`lanes ${state.needsResync ? 'stale' : ''}`} aria-label="네 레인 공개 상태 예제">{state.lanes.map((lane) => <LaneCard key={lane.laneId} lane={lane} />)}</section>
      <section className="panel controls">
        <div className="section-heading"><div><p className="eyebrow">PUBLIC EVENTS</p><h2>4종 이벤트 payload 소비</h2></div><button type="button" onClick={() => { dispatch(null); setLastPayload(null); }}>snapshot 예제로 초기화</button></div>
        <p className="muted">버튼은 승인된 payload를 로컬 모델에 전달합니다. 실제 SSE 프레임·cursor 재생·재접속 연결은 구현 전입니다.</p>
        <div className="button-row">{eventExamples.map(({ label, payload }) => <button type="button" key={label} onClick={() => { setLastPayload(payload); dispatch(payload); }}>{label}</button>)}</div>
        <p className="notice" role="status">{state.notice}</p>
        <p className="mono small muted">초기 snapshot 커서: {state.baseline.cursor} · 예제 적용으로 재생 커서를 전진시키지 않습니다.</p>
        {lastPayload && <details><summary>마지막 이벤트 원문</summary><pre>{JSON.stringify(lastPayload, null, 2)}</pre></details>}
      </section>
      <section className="panel controls">
        <p className="eyebrow">PRIVATE BID RESPONSES</p><h2>개인 입찰 단계별 응답 예제</h2>
        <p className="muted">각 응답을 독립 열람합니다. 선택 동작은 입찰 상태 전이·등록·제출·확인 요청을 실행하지 않습니다.</p>
        <div className="button-row">{bidExamples.map(({ label }, index) => <button type="button" aria-pressed={selectedBid === index} key={label} onClick={() => setSelectedBid(index)}>{label}</button>)}</div>
        <p className="notice">{bid.meaning}</p><pre>{JSON.stringify(bid.payload, null, 2)}</pre>
      </section>
      <footer className="muted small">원본: {contractSource.path} · {contractSource.version}<br /><span className="mono">SHA-256 {contractSource.sha256}</span><p>금액·버전은 문자열로 보존합니다. 이 화면은 지원 브라우저·상품 입력 제한·운영 설정을 확정하지 않습니다.</p></footer>
    </main>
  );
}
