/* eslint-disable react/forbid-dom-props */
import { memo } from "react";
import { SessionAnalytics, ViolationContribution, EngagementHeatmap } from "../../features/engagement/analyticsTypes";
import { HPTimeline, EngagementHeatmapVisualization, FocusScoreTrend } from "./AnalyticsVisualizations";

interface AnalyticsDashboardProps {
  analytics: SessionAnalytics;
  heatmap: EngagementHeatmap;
  contributions: ViolationContribution[];
}

/**
 * Comprehensive analytics dashboard displaying all engagement metrics
 */
export const AnalyticsDashboard = memo(function AnalyticsDashboard({
  analytics,
  heatmap,
  contributions,
}: AnalyticsDashboardProps) {
  const timeFormatter = (ms: number) => {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Summary Cards */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.9rem" }}>
        <SummaryCard
          label="Average HP"
          value={`${analytics.avgHP}`}
          unit="/100"
          color={analytics.avgHP > 70 ? "var(--success)" : analytics.avgHP > 40 ? "var(--warning)" : "var(--danger)"}
        />
        <SummaryCard
          label="Peak HP"
          value={`${analytics.maxHP}`}
          unit="/100"
          color="var(--primary)"
        />
        <SummaryCard
          label="Lowest HP"
          value={`${analytics.minHP}`}
          unit="/100"
          color={analytics.minHP === 0 ? "var(--danger)" : "var(--warning)"}
        />
        <SummaryCard
          label="Focus Score"
          value={`${Math.round(analytics.avgFocusScore * 100)}%`}
          color={analytics.avgFocusScore > 0.7 ? "var(--success)" : "var(--warning)"}
        />
        <SummaryCard
          label="Session Duration"
          value={timeFormatter(analytics.duration)}
          color="var(--primary)"
        />
        <SummaryCard
          label="Lock Time"
          value={analytics.lockTime ? timeFormatter(analytics.lockTime) : "Never"}
          color={analytics.lockTime ? "var(--danger)" : "var(--success)"}
        />
      </section>

      {/* State Distribution */}
      <section className="card" style={{ padding: "1rem" }}>
        <h3 style={{ marginTop: 0, marginBottom: "0.8rem", fontFamily: "var(--font-heading)" }}>Engagement State Timeline</h3>
        <HPTimeline timeline={analytics.timeline} width={Math.min(800, window.innerWidth - 60)} height={200} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.6rem", marginTop: "0.8rem" }}>
          <StateCounter label="Critical" count={analytics.criticalCount} color="var(--danger)" />
          <StateCounter label="Warning" count={analytics.warningCount} color="var(--warning)" />
          <StateCounter label="Total Violations" count={analytics.totalViolations} color="var(--primary)" />
        </div>
      </section>

      {/* HP Loss Heatmap */}
      <section className="card" style={{ padding: "1rem" }}>
        <h3 style={{ marginTop: 0, marginBottom: "0.8rem", fontFamily: "var(--font-heading)" }}>Engagement Heatmap (Risk Periods)</h3>
        <EngagementHeatmapVisualization buckets={heatmap.buckets} width={Math.min(800, window.innerWidth - 60)} />
        <div style={{ color: "var(--text-soft)", fontSize: 13, marginTop: "0.5rem" }}>
          ▰ <span style={{ color: "var(--success)" }}>Low risk</span> • ▰ <span style={{ color: "var(--warning)" }}>Medium risk</span> • ▰ <span style={{ color: "var(--danger)" }}>High risk</span>
        </div>
      </section>

      {/* Focus Score Trend */}
      <section className="card" style={{ padding: "1rem" }}>
        <h3 style={{ marginTop: 0, marginBottom: "0.8rem", fontFamily: "var(--font-heading)" }}>Focus Score Trend</h3>
        <FocusScoreTrend focusTimeline={analytics.focusTimeline} />
      </section>

      {/* Violation Breakdown */}
      <section className="card" style={{ padding: "1rem" }}>
        <h3 style={{ marginTop: 0, marginBottom: "0.8rem", fontFamily: "var(--font-heading)" }}>Violation Analysis</h3>

        {contributions.length === 0 ? (
          <p style={{ color: "var(--text-soft)" }}>No violations recorded. Excellent engagement!</p>
        ) : (
          <div style={{ display: "grid", gap: "0.8rem" }}>
            {contributions.map((contrib) => (
              <div
                key={contrib.violation}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "0.8rem",
                  background: "var(--bg-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                  <strong>{contrib.violation}</strong>
                  <span style={{ color: "var(--text-soft)" }}>
                    {contrib.frequency}× • {contrib.percentOfTotal.toFixed(1)}% of HP loss
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: 999, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${contrib.percentOfTotal}%`,
                      background: "var(--primary)",
                      transition: "width 200ms ease",
                    }}
                  />
                </div>
              </div>
            ))}

            {/* HP Drop Timestamps */}
            {analytics.hpDropTimestamps.length > 0 && (
              <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                <h4 style={{ margin: "0 0 0.6rem 0", fontSize: 14 }}>Critical HP Drop Events ({analytics.hpDropTimestamps.length})</h4>
                <div style={{ maxHeight: 300, overflow: "auto", display: "grid", gap: "0.4rem" }}>
                  {analytics.hpDropTimestamps.slice(-10).map((drop, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "var(--bg-elevated)",
                        padding: "0.5rem 0.6rem",
                        borderRadius: 6,
                        fontSize: 12,
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "var(--text-soft)" }}>{timeFormatter(drop.timestamp)}</span>
                      <span style={{ color: "var(--danger)", fontWeight: 600 }}>-{Math.round(drop.magnitude)} HP</span>
                      <span style={{ color: "var(--primary)" }}>{drop.violation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Detailed Violation Stats */}
      {analytics.violations.length > 0 && (
        <section className="card" style={{ padding: "1rem" }}>
          <h3 style={{ marginTop: 0, marginBottom: "0.8rem", fontFamily: "var(--font-heading)" }}>Violation Statistics</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-soft)" }}>Violation</th>
                  <th style={{ textAlign: "center", padding: "0.5rem", color: "var(--text-soft)" }}>Count</th>
                  <th style={{ textAlign: "center", padding: "0.5rem", color: "var(--text-soft)" }}>Duration</th>
                  <th style={{ textAlign: "center", padding: "0.5rem", color: "var(--text-soft)" }}>Avg HP Loss</th>
                  <th style={{ textAlign: "center", padding: "0.5rem", color: "var(--text-soft)" }}>Total Loss</th>
                </tr>
              </thead>
              <tbody>
                {analytics.violations.map((viol) => (
                  <tr key={viol.type} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem", fontWeight: 500 }}>{viol.type}</td>
                    <td style={{ textAlign: "center", padding: "0.5rem" }}>{viol.count}</td>
                    <td style={{ textAlign: "center", padding: "0.5rem" }}>{timeFormatter(viol.duration)}</td>
                    <td style={{ textAlign: "center", padding: "0.5rem", color: "var(--primary)" }}>
                      {Math.round(viol.avgHPDelta * 10) / 10}
                    </td>
                    <td style={{ textAlign: "center", padding: "0.5rem", fontWeight: 600, color: "var(--danger)" }}>
                      -{Math.round(viol.totalHPLoss)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
});

interface SummaryCardProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
}

const SummaryCard = memo(function SummaryCard({ label, value, unit, color }: SummaryCardProps) {
  return (
    <div
      className="card"
      style={{
        padding: "1rem",
        borderLeft: `4px solid ${color || "var(--primary)"}`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div style={{ color: "var(--text-soft)", fontSize: 12, marginBottom: "0.25rem" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 700, color: color || "var(--primary)" }}>
        {value}
        {unit && <span style={{ fontSize: "0.9rem", marginLeft: "0.25rem", opacity: 0.6 }}>{unit}</span>}
      </div>
    </div>
  );
});

interface StateCounterProps {
  label: string;
  count: number;
  color?: string;
}

const StateCounter = memo(function StateCounter({ label, count, color }: StateCounterProps) {
  return (
    <div
      style={{
        background: "var(--bg-subtle)",
        border: `1px solid ${color}`,
        borderRadius: 8,
        padding: "0.6rem 0.8rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-soft)" }}>{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 700, color }}>{count}</div>
    </div>
  );
});
