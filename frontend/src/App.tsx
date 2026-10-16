import { lazy, Suspense, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import PublicRoundView from './rounds/PublicRoundView.tsx';
import PublicRoundListView from './rounds/PublicRoundListView.tsx';

const ContractPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/ContractPreview.tsx'))
  : null;

export default function App() {
  const [search, setSearch] = useState(window.location.search);
  useEffect(() => {
    const update = () => setSearch(window.location.search);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const parameters = new URLSearchParams(search);
  const roundId = parameters.get('roundId');
  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState(null, '', event.currentTarget.href);
    setSearch(window.location.search);
    window.scrollTo(0, 0);
  };
  if (ContractPreview && parameters.get('preview') === 'contract') {
    return <Suspense fallback={<main className="shell"><p>개발 예제 불러오는 중…</p></main>}><ContractPreview /></Suspense>;
  }

  return (
    <main className="shell">
      <header className="page-heading">
        <div className="brand-mark" aria-hidden="true">4</div>
        <div><p className="eyebrow">AUCTION PLATFORM</p><h1>4레인 경매</h1></div>
        <span className="badge">회차 안내</span>
      </header>
      {roundId === null ? <PublicRoundListView navigate={navigate} /> : <>
        <nav className="round-navigation" aria-label="회차 탐색"><a className="quiet-link" href="/" onClick={navigate}>← 공개 회차 목록</a></nav>
        <PublicRoundView key={roundId} roundId={roundId} />
      </>}
      {import.meta.env.DEV && <footer><a className="quiet-link" href="/?preview=contract">개발용 계약 예제 열기</a></footer>}
    </main>
  );
}
