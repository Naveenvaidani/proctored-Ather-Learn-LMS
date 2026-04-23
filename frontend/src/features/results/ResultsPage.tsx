/* eslint-disable */
/* eslint-disable react/forbid-dom-props */
import { useMemo } from "react";
import { SessionOutput } from "../engagement/types";

const fallbackOutput: SessionOutput = {
  avgHP: 87,
  focusScore: 0.82,
  quizScore: 75,
  anomalies: ["LOOKING_AWAY", "TAB_SWITCH"],
  insights: [
    "Attention decay detected; trigger shorter segments.",
    "High cognitive load; reinforce concept before next segment.",
    "Strong session consistency and stable engagement.",
  ],
};

export default function ResultsPage() {
  const sessionOutput = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("aether:session-output");
      if (!raw) return fallbackOutput;
      return JSON.parse(raw) as SessionOutput;
    } catch {
      return fallbackOutput;
    }
  }, []);

  const achievements = useMemo(() => {
    try {
      const raw = sessionStorage.getItem("aether:achievements");
      if (!raw) return ["Unbroken", "Silent Scholar"];
      const parsed = JSON.parse(raw) as string[];
      return parsed.length ? parsed : ["Unbroken", "Silent Scholar"];
    } catch {
      return ["Unbroken", "Silent Scholar"];
    }
  }, []);

  const trend = useMemo(() => {
    const avg = Math.round(sessionOutput.avgHP);
    return [
      Math.max(42, avg - 12),
      Math.max(48, avg - 8),
      Math.max(55, avg - 6),
      Math.max(62, avg - 1),
      Math.max(68, avg + 1),
      Math.min(100, avg + 3),
    ];
  }, [sessionOutput.avgHP]);

  return (
    <section className="page-grid">
      <div className="card" style={{ padding: "1rem" }}>
        <h1 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>Aether Session Output</h1>
        <p style={{ color: "var(--text-soft)" }}>
          Derived metrics only. No raw video or audio leaves the device.
        </p>
      </div>

      <div className="page-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Metric title="Average HP" value={`${Math.round(sessionOutput.avgHP)}`} tone="var(--success)" />
        <Metric title="Focus Score" value={`${Math.round(sessionOutput.focusScore * 100)}%`} tone="var(--primary)" />
        <Metric title="Quiz Score" value={`${sessionOutput.quizScore}%`} tone="var(--warning)" />
        <Metric title="Anomalies" value={`${sessionOutput.anomalies.length}`} tone="var(--danger)" />
      </div>

      <div className="card" style={{ padding: "1rem" }}>
        <h2 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>HP Timeline</h2>
        <div style={{ display: "flex", gap: 6, alignItems: "end", minHeight: 180 }}>
          {trend.map((value, idx) => (
            <div key={idx} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ height: `${value}%`, background: "var(--primary)", borderRadius: "8px 8px 0 0" }} />
              <small style={{ color: "var(--text-soft)" }}>T{idx + 1}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: "1rem" }}>
        <h2 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>Achievements</h2>
        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
          {achievements.map((badge) => (
            <span key={badge} style={{ border: "1px solid var(--border)", borderRadius: 999, padding: "0.3rem 0.7rem", color: "var(--text-soft)" }}>
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: "1rem" }}>
        <h2 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>Insights</h2>
        <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--text-soft)" }}>
          {sessionOutput.insights.map((insight) => (
            <li key={insight} style={{ marginBottom: "0.4rem" }}>{insight}</li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ padding: "1rem" }}>
        <h2 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>Weak Area Highlights</h2>
        <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--text-soft)" }}>
          <li>Graph traversal confidence dipped in timed mode.</li>
          <li>Audio environment noise raised review flags.</li>
          <li>Recommendation: 2 short focused drills and one supervised reattempt.</li>
        </ul>
      </div>

      <div className="card" style={{ padding: "1rem" }}>
        <h2 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>Session Export</h2>
        <pre style={{ margin: 0, background: "var(--bg-subtle)", borderRadius: 10, padding: "0.7rem", overflow: "auto", fontSize: 12 }}>
{JSON.stringify(
  {
    avgHP: Math.round(sessionOutput.avgHP),
    focusScore: Number(sessionOutput.focusScore.toFixed(2)),
    quizScore: sessionOutput.quizScore,
    anomalies: sessionOutput.anomalies,
    insights: sessionOutput.insights,
  },
  null,
  2,
)}
        </pre>
      </div>
    </section>
  );
}

function Metric({ title, value, tone }: { title: string; value: string; tone: string }) {
  return (
    <div className="card" style={{ padding: "0.9rem" }}>
      <p style={{ margin: "0 0 0.3rem", color: "var(--text-soft)" }}>{title}</p>
      <strong style={{ fontFamily: "var(--font-heading)", fontSize: "1.35rem", color: tone }}>{value}</strong>
    </div>
  );
}
