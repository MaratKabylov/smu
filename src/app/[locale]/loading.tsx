export default function PublicRouteLoading() {
  return (
    <main className="route-loading" aria-busy="true" aria-live="polite">
      <div className="route-loading-inner">
        <span className="route-loading-spinner" aria-hidden="true" />
        <span>Загрузка страницы…</span>
      </div>
    </main>
  );
}
