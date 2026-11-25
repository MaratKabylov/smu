export default function AdminRouteLoading() {
  return (
    <div className="route-loading" aria-busy="true" aria-live="polite">
      <div className="route-loading-inner">
        <span className="route-loading-spinner" aria-hidden="true" />
        <span>Загрузка раздела…</span>
      </div>
    </div>
  );
}
