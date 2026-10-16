import { lazy, Suspense } from 'react';

const ContractPreview = import.meta.env.DEV
  ? lazy(() => import('./dev/ContractPreview.tsx'))
  : null;

export default function App() {
  if (ContractPreview && new URLSearchParams(window.location.search).get('preview') === 'contract') {
    return <Suspense fallback={<main className="shell"><p>개발 예제 불러오는 중…</p></main>}><ContractPreview /></Suspense>;
  }

  return (
    <main className="shell">
      <header className="page-heading">
        <div className="brand-mark" aria-hidden="true">4</div>
        <div><p className="eyebrow">AUCTION PLATFORM</p><h1>4레인 경매</h1></div>
        <span className="badge">개발 셸</span>
      </header>
      <section className="panel empty-state">
        <p className="eyebrow">서비스 연결 준비</p>
        <h2>경매 기능을 구현하고 있습니다.</h2>
        <p>현재 화면은 실행 가능한 프런트엔드 골격입니다. 로그인·상품 조회·입찰·실시간 연결은 아직 구현되지 않았습니다.</p>
        <p>표시할 실제 회차와 경매 상태가 없습니다.</p>
        {import.meta.env.DEV && <a className="button primary" href="/?preview=contract">개발용 계약 예제 열기</a>}
      </section>
    </main>
  );
}
