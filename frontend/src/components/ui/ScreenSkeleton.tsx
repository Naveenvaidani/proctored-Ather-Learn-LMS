/* eslint-disable */
/* eslint-disable react/forbid-dom-props */
export function ScreenSkeleton() {
  return (
    <div className="app-shell page-grid" aria-busy="true">
      <div className="card" style={{ padding: "1rem" }}>
        <div style={{ height: 18, width: 190, borderRadius: 8, background: "var(--bg-subtle)" }} />
      </div>
      <div className="card" style={{ padding: "2rem", minHeight: 280 }}>
        <div style={{ height: 14, width: "56%", borderRadius: 8, background: "var(--bg-subtle)", marginBottom: 12 }} />
        <div style={{ height: 14, width: "71%", borderRadius: 8, background: "var(--bg-subtle)", marginBottom: 12 }} />
        <div style={{ height: 14, width: "43%", borderRadius: 8, background: "var(--bg-subtle)" }} />
      </div>
    </div>
  );
}


