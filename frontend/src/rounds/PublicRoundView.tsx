import { useEffect, useState } from 'react';
import { createRoundLoader } from './round-client.ts';
import type { RoundError, RoundState } from './round-client.ts';
import { formatSeoul } from './round-contract.ts';
import type { PublicRound } from './round-contract.ts';

const labels: Record<PublicRound['status'], { label: string; description: string }> = {
  PUBLISHED: { label: '공개 · 시작 전', description: '공개된 회차입니다. 경매 시작을 기다리고 있습니다.' },
  WAITING: { label: '시작 대기', description: '예약 시각이 지났으며 시작 조건을 기다리고 있습니다.' },
  ACTIVE: { label: '진행 중', description: '시작된 회차입니다. 개별 레인의 중단·보류 상태는 이 화면에 표시되지 않습니다.' },
  COMPLETED: { label: '종료', description: '회차의 경매 진행이 종료되었습니다.' },
  CANCELLED: { label: '취소', description: '취소된 회차입니다.' },
};

const errors: Record<RoundError, { title: string; message: string }> = {
  'not-found': { title: '회차를 찾을 수 없습니다.', message: '회차가 없거나 아직 공개되지 않았습니다. 전달받은 링크를 확인해 주세요.' },
  unavailable: { title: '잠시 조회할 수 없습니다.', message: '회차 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' },
  'invalid-link': { title: '회차 링크를 확인해 주세요.', message: '올바른 회차 링크로 다시 접속해 주세요.' },
  network: { title: '연결을 확인해 주세요.', message: '회차 정보를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.' },
  unexpected: { title: '정보를 불러오지 못했습니다.', message: '지금은 회차 정보를 표시할 수 없습니다. 잠시 후 다시 시도해 주세요.' },
};

function TimeValue({ value, empty }: { value: string | null; empty: string }) {
  return value === null ? <span className="muted">{empty}</span> : <time dateTime={value}>{formatSeoul(value)}</time>;
}

function RoundDetails({ round, refresh }: { round: PublicRound; refresh: () => void }) {
  const status = labels[round.status];
  return <>
    <section className="round-hero panel" aria-labelledby="round-title">
      <div className="round-hero-top"><span className="badge">{status.label}</span><button type="button" onClick={refresh}>새로고침</button></div>
      <p className="eyebrow">PUBLIC AUCTION</p><h2 id="round-title">공개 회차</h2>
      <p className="round-id mono">{round.roundId}</p><p className="round-description">{status.description}</p>
      <div className="round-summary"><div><span className="muted">운영 레인</span><strong data-testid="lane-count">{round.laneCount}개 레인</strong></div><div><span className="muted">예약 시작</span><strong><TimeValue value={round.scheduledStartsAt} empty="미정" /></strong></div></div>
    </section>
    <div className="round-grid">
      <section className="panel round-section" aria-labelledby="schedule-title"><p className="eyebrow">SCHEDULE</p><h2 id="schedule-title">회차 일정</h2><p className="muted small">한국 시간 · Asia/Seoul</p>
        <dl className="round-facts">
          <div><dt>모집 시작</dt><dd><TimeValue value={round.recruitmentOpensAt} empty="미정" /></dd></div>
          <div><dt>공개 시각</dt><dd><TimeValue value={round.publicationAt} empty="미정" /></dd></div>
          <div><dt>예약 시작</dt><dd><TimeValue value={round.scheduledStartsAt} empty="미정" /></dd></div>
          <div><dt>실제 시작</dt><dd><TimeValue value={round.actualStartedAt} empty="아직 시작하지 않음" /></dd></div>
          <div><dt>종료 시각</dt><dd><TimeValue value={round.completedAt} empty="종료 기록 없음" /></dd></div>
          <div><dt>취소 시각</dt><dd><TimeValue value={round.cancelledAt} empty="취소 기록 없음" /></dd></div>
        </dl>
      </section>
      <section className="panel round-section" aria-labelledby="timing-title"><p className="eyebrow">AUCTION TIMING</p><h2 id="timing-title">경매 시간 설정</h2><p className="muted small">{round.durationsFrozen ? '실제 시작 시 확정된 설정입니다.' : '실제 시작 전에 변경될 수 있습니다.'}</p>
        <dl className="round-facts">
          <div><dt>상품 준비</dt><dd>{round.durations.preparationSeconds}초</dd></div>
          <div><dt>최초 입찰</dt><dd>{round.durations.initialBidSeconds}초</dd></div>
          <div><dt>후속 입찰</dt><dd>{round.durations.followupBidSeconds}초</dd></div>
        </dl>
        <p className="round-footnote">예약 시작과 실제 시작 시각은 다를 수 있습니다. 회차 상태는 조회한 정보를 기준으로 표시합니다.</p>
      </section>
    </div>
    <footer className="round-footer muted small"><span>최신 정보를 확인하려면 새로고침해 주세요.</span><span>상태 버전 <span className="mono" data-testid="round-version">{round.roundVersion}</span></span></footer>
  </>;
}

export default function PublicRoundView({ roundId }: { roundId: string }) {
  const [state, setState] = useState<RoundState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const refresh = () => setAttempt((value) => value + 1);
  useEffect(() => {
    const loader = createRoundLoader(setState);
    void loader.load(roundId);
    return () => loader.dispose();
  }, [roundId, attempt]);
  if (state.kind === 'loading') return <section className="panel empty-state round-loading" role="status" aria-live="polite"><span className="loading-dot" aria-hidden="true" /><h2>회차 정보를 불러오는 중입니다.</h2><p>잠시만 기다려 주세요.</p></section>;
  if (state.kind === 'error') {
    const error = errors[state.error];
    return <section className="panel empty-state" role="alert"><p className="eyebrow">AUCTION INFORMATION</p><h2>{error.title}</h2><p>{error.message}</p><button type="button" className="primary" onClick={refresh}>다시 시도</button></section>;
  }
  return <RoundDetails round={state.round} refresh={refresh} />;
}
