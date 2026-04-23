/* eslint-disable react/forbid-dom-props */
import { EngagementSnapshot } from "../../features/engagement/types";

interface EngagementHudProps {
  snapshot: EngagementSnapshot;
  bars: number[];
  mercySeconds: number;
}

export function EngagementHud({ snapshot, bars, mercySeconds }: EngagementHudProps) {
  const hpColor = snapshot.hp > 60 ? "var(--success)" : snapshot.hp > 25 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="card" style={{ padding: "0.85rem", borderRadius: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.55rem" }}>
        <strong style={{ fontFamily: "var(--font-heading)" }}>AETHER PULSE++</strong>
        <span style={{ color: "var(--text-soft)", fontSize: 12 }}>Mercy: {mercySeconds}s</span>
      </div>

      <div style={{ marginBottom: "0.45rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
          <span>HP {snapshot.hp}</span>
          <span>{snapshot.state}</span>
        </div>
        <div style={{ height: 8, background: "var(--bg-subtle)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${snapshot.hp}%`, height: "100%", background: hpColor, transition: "width 180ms ease" }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.6rem" }}>
        <Metric title="Focus Score" value={`${Math.round(snapshot.focusScore * 100)}%`} />
        <Metric title="Cognitive Load" value={`${snapshot.cognitiveLoad}`} />
      </div>

      <div style={{ display: "flex", alignItems: "end", gap: 3, height: 54, background: "var(--bg-subtle)", borderRadius: 10, padding: "0.45rem" }}>
        {bars.slice(0, 30).map((value, idx) => (
          <span
            key={idx}
            style={{
              width: 4,
              height: `${Math.max(8, value)}%`,
              borderRadius: 999,
              background:
                snapshot.violations.includes("TALKING") || snapshot.violations.includes("NOISE")
                  ? "var(--danger)"
                  : "var(--primary)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "0.45rem" }}>
      <div style={{ color: "var(--text-soft)", fontSize: 12 }}>{title}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}
