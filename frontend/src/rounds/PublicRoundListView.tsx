import { useEffect, useRef, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { publicRoundHref } from './round-client.ts';
import type { RoundError } from './round-client.ts';
import { formatSeoul } from './round-contract.ts';
import { createRoundListLoader } from './round-list-loader.ts';
import type { RoundListState } from './round-list-loader.ts';
import { roundStatusLabels } from './round-presentation.ts';

function errorMessage(error: RoundError): string {
  if (error === 'unavailable') return '잠시 목록을 조회할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  if (error === 'network') return '목록을 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.';
  return '목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export default function PublicRoundListView({ navigate }: { navigate: MouseEventHandler<HTMLAnchorElement> }) {
  const [state, setState] = useState<RoundListState>({ kind: 'loading' });
  const loader = useRef<ReturnType<typeof createRoundListLoader> | null>(null);
  useEffect(() => {
    const current = createRoundListLoader(setState);
    loader.current = current;
    void current.refresh();
    return () => { current.dispose(); loader.current = null; };
  }, []);
  const refresh = () => { void loader.current?.refresh(); };
  const more = () => { void loader.current?.more(); };

  return <section aria-labelledby="round-list-title">
    <header className="discovery-heading">
      <div><p className="eyebrow">PUBLIC AUCTIONS</p><h2 id="round-list-title">공개 회차 목록</h2><p className="muted">회차를 선택해 일정과 진행 상태를 확인하세요.</p></div>
      <button type="button" onClick={refresh} disabled={state.kind === 'loading'}>목록 새로고침</button>
    </header>
    {state.kind === 'loading' && <div className="panel empty-state" role="status"><span className="loading-dot" aria-hidden="true" /><h3>회차 목록을 불러오는 중입니다.</h3><p>잠시만 기다려 주세요.</p></div>}
    {state.kind === 'error' && <div className="panel empty-state" role="alert"><h3>목록을 불러오지 못했습니다.</h3><p>{errorMessage(state.error)}</p><button type="button" className="primary" onClick={refresh}>다시 시도</button></div>}
    {state.kind === 'ready' && <>
      {state.page.items.length === 0
        ? <div className="panel empty-state"><h3>공개된 회차가 없습니다.</h3><p>공개된 회차가 있으면 이곳에서 확인할 수 있습니다.</p></div>
        : <ul className="round-list" aria-label="공개 회차">
          {state.page.items.map((round) => <li className="panel round-card" key={round.roundId}>
            <div className="round-card-top"><span className="badge">{roundStatusLabels[round.status].label}</span><span className="muted small">{round.laneCount}개 레인</span></div>
            <h3><a className="round-link mono" href={publicRoundHref(round.roundId)} onClick={navigate}>{round.roundId}</a></h3>
            <dl className="round-facts"><div><dt>예약 시작</dt><dd><time dateTime={round.scheduledStartsAt}>{formatSeoul(round.scheduledStartsAt)}</time></dd></div></dl>
            <p className="muted small round-card-version">상태 버전 <span className="mono">{round.roundVersion}</span></p>
          </li>)}
        </ul>}
      <div className="list-pagination">
        {state.error !== null && <p role="alert">{errorMessage(state.error)} 앞서 불러온 회차는 유지됩니다.</p>}
        {state.page.nextCursor !== null && <button type="button" className="primary" onClick={more} disabled={state.loadingMore}>{state.loadingMore ? '불러오는 중…' : state.error !== null ? '다시 시도' : '더 보기'}</button>}
        {state.loadingMore && <p role="status">다음 회차를 불러오는 중입니다.</p>}
        {state.page.nextCursor === null && state.page.items.length > 0 && <p className="muted small">현재 공개된 회차를 모두 불러왔습니다.</p>}
      </div>
      <p className="muted small list-footnote">한국 시간 · Asia/Seoul. 회차 상태는 조회한 정보를 기준으로 표시합니다.</p>
    </>}
  </section>;
}
