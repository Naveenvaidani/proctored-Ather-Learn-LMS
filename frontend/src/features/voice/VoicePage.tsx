/* eslint-disable */
/* eslint-disable react/forbid-dom-props */
import { useState } from "react";
import { useVoiceAnalysis } from "../../hooks/useVoiceAnalysis";

export default function VoicePage() {
  const [enabled, setEnabled] = useState(false);
  const { metrics, bars, streamError } = useVoiceAnalysis(enabled);

  return (
    <section className="page-grid">
      <div className="card" style={{ padding: "1rem" }}>
        <h1 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>Voice Validation Engine</h1>
        <p style={{ color: "var(--text-soft)", marginTop: 0 }}>
          Local microphone processing via worker-based VAD and speech pattern detection.
        </p>

        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.75rem" }}>
          <button style={btnStyle} onClick={() => setEnabled((v) => !v)}>
            {enabled ? "Stop" : "Start"}
          </button>
          <span style={{ alignSelf: "center", color: "var(--text-soft)" }}>
            Pattern: {metrics.speechPattern} | Noise: {(metrics.noiseLevel * 100).toFixed(0)}%
          </span>
        </div>

        {streamError ? <p style={{ marginTop: 0, color: "var(--danger)" }}>{streamError}</p> : null}

        <div style={{ display: "flex", alignItems: "end", gap: 4, height: 140, background: "var(--bg-subtle)", borderRadius: 14, padding: "0.6rem" }}>
          {bars.map((h, i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: `${Math.max(8, h)}%`,
                borderRadius: 999,
                background: metrics.speechPattern === "CONTINUOUS" ? "var(--danger)" : "var(--primary)",
                opacity: 0.9,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

const btnStyle = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "transparent",
  color: "var(--text)",
  padding: "0.45rem 0.7rem",
  cursor: "pointer",
};
