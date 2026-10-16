import { lazy, Suspense, useEffect, useState } from 'react';
import PublicRoundView from './rounds/PublicRoundView.tsx';

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
      {roundId === null ? <section className="panel empty-state">
        <p className="eyebrow">AUCTION INFORMATION</p>
        <h2>회차 링크로 접속해 주세요.</h2>
        <p>전달받은 회차 링크를 열면 공개 일정과 진행 상태를 확인할 수 있습니다.</p>
      </section> : <PublicRoundView key={roundId} roundId={roundId} />}
      {import.meta.env.DEV && <footer><a className="quiet-link" href="/?preview=contract">개발용 계약 예제 열기</a></footer>}
    </main>
  );
}
