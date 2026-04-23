/* eslint-disable */
/* eslint-disable react/forbid-dom-props */
import { useEffect, useMemo, useState } from "react";
import { useAdaptiveSignal } from "../../hooks/useAdaptiveSignal";
import { useFaceTracking } from "../../hooks/useFaceTracking";
import { useVoiceAnalysis } from "../../hooks/useVoiceAnalysis";
import { useEngagementEngine } from "../../hooks/useEngagementEngine";
import { EngagementHud } from "../../components/engagement/EngagementHud";
import { recordAnomaly } from "../../services/anomaly.service";
import "./proctoring.css";

const MONGO_ID_REGEX = /^[a-f\d]{24}$/i;

export default function ProctoringPage() {
  const [active, setActive] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quizScore, setQuizScore] = useState(75);
  const [apiError, setApiError] = useState<string | null>(null);
  const [violationLog, setViolationLog] = useState<Array<{ label: string; time: string }>>([]);

  const { setBehaviorSignal } = useAdaptiveSignal();
  const sensorEnabled = active;
  const { videoRef, canvasRef, metrics: faceMetrics, streamError: faceError } = useFaceTracking(sensorEnabled);
  const { metrics: audioMetrics, bars, streamError: voiceError } = useVoiceAnalysis(sensorEnabled);
  const validationEnabled = sensorEnabled;

  const { snapshot, output, achievements, isLocked } = useEngagementEngine({
    faceMetrics,
    audioMetrics,
    enabled: validationEnabled,
    rewatchCount: 1,
    responseDelay: 340,
    interactionFrequency: 1.4,
    quizScore,
  });

  const idsValid = useMemo(
    () =>
      MONGO_ID_REGEX.test(courseId.trim()) &&
      MONGO_ID_REGEX.test(versionId.trim()) &&
      MONGO_ID_REGEX.test(itemId.trim()),
    [courseId, itemId, versionId],
  );

  const mercySeconds = snapshot.hp >= 80 ? 7 : snapshot.hp > 40 ? 5 : 2;

  useEffect(() => {
    if (snapshot.state === "CRITICAL") setBehaviorSignal("critical");
    else if (snapshot.state === "WARNING") setBehaviorSignal("warning");
    else setBehaviorSignal("steady");
  }, [setBehaviorSignal, snapshot.state]);

  useEffect(() => {
    sessionStorage.setItem("aether:last-hp", String(snapshot.hp));
    sessionStorage.setItem("aether:last-focus", snapshot.focusScore.toFixed(2));
    sessionStorage.setItem("aether:session-output", JSON.stringify(output));
    sessionStorage.setItem("aether:achievements", JSON.stringify(achievements));
  }, [achievements, output, snapshot.focusScore, snapshot.hp]);

  useEffect(() => {
    if (!snapshot.violations.length) return;

    const latest = snapshot.violations[0];
    const now = new Date().toLocaleTimeString();

    setViolationLog((prev) => {
      if (prev[0]?.label === latest) return prev;
      return [{ label: latest, time: now }, ...prev].slice(0, 10);
    });

    if (!idsValid) return;

    const typeMap: Record<string, "NO_FACE" | "FOCUS" | "MULTIPLE_FACES" | "VOICE_DETECTION"> = {
      NO_FACE: "NO_FACE",
      LOOKING_AWAY: "FOCUS",
      HEAD_DOWN: "FOCUS",
      MULTIPLE_FACES: "MULTIPLE_FACES",
      TALKING: "VOICE_DETECTION",
      NOISE: "VOICE_DETECTION",
      TAB_SWITCH: "FOCUS",
      INACTIVITY: "FOCUS",
    };

    const mapped = typeMap[latest];
    if (!mapped) return;

    void (async () => {
      try {
        setApiError(null);
        await recordAnomaly({
          type: mapped,
          courseId: courseId.trim(),
          versionId: versionId.trim(),
          itemId: itemId.trim(),
        });
      } catch (error) {
        setApiError(error instanceof Error ? error.message : "Failed to record anomaly");
      }
    })();
  }, [courseId, idsValid, itemId, snapshot.violations, versionId]);

  const lockMessage = isLocked
    ? "Session locked. HP reached 0. Restart monitoring to continue."
    : "";

  const latestLabels = snapshot.violations.length ? snapshot.violations : ["READY"];

  return (
    <section className="page-grid proctoring-layout">
      <div className="card proctoring-main">
        <div className="proctoring-overlay-label">Privacy-first local validation</div>
        <h1 className="proctoring-title">Aether Learn - Cognitive Validation</h1>
        <p className="proctoring-subtitle">
          Camera and microphone are tracked locally for validation only. Raw frames and audio are not stored.
        </p>

        <div className="proctoring-input-grid">
          <input value={courseId} onChange={(e) => setCourseId(e.target.value)} placeholder="Course ID" style={fieldStyle} />
          <input value={versionId} onChange={(e) => setVersionId(e.target.value)} placeholder="Version ID" style={fieldStyle} />
          <input value={itemId} onChange={(e) => setItemId(e.target.value)} placeholder="Item ID" style={fieldStyle} />
        </div>

        <div className="proctoring-controls">
          <button style={btnStyle} onClick={() => setActive((v) => !v)}>
            {active ? "Stop Validation" : "Start Validation"}
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-soft)" }}>
            Quiz Score
            <input
              value={quizScore}
              type="number"
              min={0}
              max={100}
              onChange={(e) => setQuizScore(Number(e.target.value))}
              style={{ ...fieldStyle, width: 90 }}
            />
          </label>
        </div>

        <div className="proctoring-video-shell">
          <video ref={videoRef} autoPlay playsInline muted className="proctoring-video" />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <div className="proctoring-overlay">
            <div className="proctoring-privacy-banner">
              <span>●</span>
              <span>Video and audio are validated locally only</span>
            </div>

            <div className="proctoring-overlay-card">
              <div className="proctoring-overlay-label">{active ? "Monitoring live" : "Waiting to start"}</div>
              <div style={{ display: "grid", gap: 4 }}>
                <div><strong>Face:</strong> {faceMetrics.faceDetected ? "Detected" : "Missing"}</div>
                <div><strong>Eyes:</strong> {faceMetrics.eyeGaze}</div>
                <div><strong>Pose:</strong> {faceMetrics.headPose}</div>
                <div><strong>Mic:</strong> {audioMetrics.vadState}</div>
                <div><strong>Audio Cal:</strong> {audioMetrics.isCalibrated ? "Ready" : "Calibrating"}</div>
                <div><strong>Confidence:</strong> {Math.round(snapshot.confidenceScore * 100)}%</div>
              </div>
            </div>

            <div className="proctoring-anomaly-strip">
              {latestLabels.map((label) => (
                <span className="proctoring-chip" key={label}>
                  {label === "READY" ? "No anomalies yet" : `Anomaly: ${label}`}
                </span>
              ))}
            </div>
          </div>
        </div>

        {!idsValid && (courseId || versionId || itemId) ? (
          <p className="proctoring-alert" style={{ color: "var(--warning)" }}>Use valid Mongo IDs to persist violations.</p>
        ) : null}
        {faceError ? <p className="proctoring-alert" style={{ color: "var(--danger)" }}>{faceError}</p> : null}
        {voiceError ? <p className="proctoring-alert" style={{ color: "var(--danger)" }}>{voiceError}</p> : null}
        {(faceError || voiceError) ? (
          <p className="proctoring-alert" style={{ color: "var(--warning)" }}>
            Sensor degraded. Pulse engine remains active with available validated signals.
          </p>
        ) : null}
        {apiError ? <p className="proctoring-alert" style={{ color: "var(--danger)" }}>{apiError}</p> : null}
        {lockMessage ? <p className="proctoring-alert" style={{ color: "var(--danger)" }}>{lockMessage}</p> : null}
      </div>

      <aside className="page-grid proctoring-right">
        <EngagementHud snapshot={snapshot} bars={bars} mercySeconds={mercySeconds} />

        <div className="card proctoring-card">
          <h3 className="proctoring-title">Session Output</h3>
          <pre className="proctoring-output">
            {JSON.stringify(output, null, 2)}
          </pre>
        </div>

        <div className="card proctoring-card">
          <h3 className="proctoring-title">Violations</h3>
          <div className="proctoring-grid">
            {!violationLog.length ? (
              <div style={{ color: "var(--text-soft)" }}>No violations yet.</div>
            ) : (
              violationLog.map((v) => (
                <div key={`${v.label}${v.time}`} className="proctoring-list-item">
                  <strong>{v.label}</strong>
                  <div className="proctoring-list-time">{v.time}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card proctoring-card">
          <h3 className="proctoring-title">Achievements</h3>
          <div className="proctoring-badge-row">
            {!achievements.length ? (
              <span style={{ color: "var(--text-soft)" }}>No badges yet.</span>
            ) : (
              achievements.map((a) => (
                <span key={a} className="proctoring-badge">{a}</span>
              ))
            )}
          </div>
        </div>
      </aside>
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

const fieldStyle = {
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "transparent",
  color: "var(--text)",
  padding: "0.45rem 0.6rem",
};
