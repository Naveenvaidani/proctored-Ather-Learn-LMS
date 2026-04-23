/* eslint-disable */
/* eslint-disable react/forbid-dom-props */
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { fetchCourse } from "../../services/learning.service";
import { useFaceTracking } from "../../hooks/useFaceTracking";
import { useVoiceAnalysis } from "../../hooks/useVoiceAnalysis";
import { useEngagementEngine } from "../../hooks/useEngagementEngine";
import { usePlaybackController } from "../../hooks/usePlaybackController";
import { EngagementHud } from "../../components/engagement/EngagementHud";

const COURSE_VIDEO_URL = "https://youtu.be/ueskeotDet8?si=yP7uAD4i9iftkbbj";

const APPLIED_ALGO_MODULES = [
  { id: "m1", title: "Video: Data Analytics Foundations", type: "video" as const },
  { id: "m2", title: "Article: Data Cleaning and EDA Patterns", type: "article" as const },
  { id: "m3", title: "Interactive: KPI Dashboard Lab", type: "interactive" as const }
];

type YouTubePlayerStateChangeEvent = { data: number };

export default function CoursePage() {
  const { courseId = "1" } = useParams();
  const { data } = useQuery({ queryKey: ["course", courseId], queryFn: () => fetchCourse(courseId), retry: false });

  const course = {
    id: data?.id ?? courseId,
    title: "Applied Data Analytics",
    modules: APPLIED_ALGO_MODULES
  };

  const [activeModuleId, setActiveModuleId] = useState(course.modules[0]?.id ?? "");
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoEnded, setVideoEnded] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [tabActive, setTabActive] = useState(() => document.visibilityState === "visible" && document.hasFocus());
  const tabSwitchBufferRef = useRef<boolean[]>([]);
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const active = course.modules.find((m) => m.id === activeModuleId) ?? course.modules[0];

  useEffect(() => {
    const pushTabState = (hidden: boolean) => {
      tabSwitchBufferRef.current.push(hidden);
      if (tabSwitchBufferRef.current.length > 10) {
        tabSwitchBufferRef.current.shift();
      }

      const hiddenCount = tabSwitchBufferRef.current.reduce((sum, value) => sum + (value ? 1 : 0), 0);
      setTabActive(hiddenCount < 8);
    };

    const syncTabState = () => {
      const isHidden = document.visibilityState !== "visible" || !document.hasFocus();
      pushTabState(isHidden);
    };

    syncTabState();
    window.addEventListener("focus", syncTabState);
    window.addEventListener("blur", syncTabState);
    document.addEventListener("visibilitychange", syncTabState);
    const pollTimer = window.setInterval(syncTabState, 200);

    return () => {
      window.removeEventListener("focus", syncTabState);
      window.removeEventListener("blur", syncTabState);
      document.removeEventListener("visibilitychange", syncTabState);
      window.clearInterval(pollTimer);
    };
  }, []);

  useEffect(() => {
    setVideoProgress(0);
    setVideoEnded(false);
    setSelectedAnswers({});
    setSubmitted(false);
  }, [active.id]);

  const extractYouTubeVideoId = (url: string): string | null => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtu.be")) return parsed.pathname.replace("/", "") || null;
      if (parsed.hostname.includes("youtube.com")) {
        const watchId = parsed.searchParams.get("v");
        if (watchId) return watchId;
        const pathParts = parsed.pathname.split("/").filter(Boolean);
        if (pathParts.length >= 2 && ["shorts", "embed"].includes(pathParts[0])) return pathParts[1];
      }
      return null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (active.type !== "video") return;

    const videoId = extractYouTubeVideoId(COURSE_VIDEO_URL);
    const mountId = "course-youtube-player";
    let player: any;
    let progressInterval: number | undefined;

    setVideoProgress(0);
    setVideoEnded(false);

    if (!videoId) return;

    const createPlayer = () => {
      const ytWindow = window as any;
      if (!ytWindow.YT?.Player) return;
      player = new ytWindow.YT.Player(mountId, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            playerRef.current = player;
            playerReadyRef.current = true;
          },
          onStateChange: (event: YouTubePlayerStateChangeEvent) => {
            if (event.data === ytWindow.YT?.PlayerState.ENDED) {
              setVideoProgress(100);
              setVideoEnded(true);
            }
          },
        },
      });

      progressInterval = window.setInterval(() => {
        if (!player) return;
        const duration = player.getDuration();
        const current = player.getCurrentTime();
        if (!duration || Number.isNaN(duration)) return;
        const progress = Math.min(100, Math.max(0, (current / duration) * 100));
        setVideoProgress(progress);
      }, 1000);
    };

    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
    }

    const ytWindow = window as any;
    if (ytWindow.YT?.Player) createPlayer();
    else {
      const oldReady = ytWindow.onYouTubeIframeAPIReady;
      ytWindow.onYouTubeIframeAPIReady = () => {
        oldReady?.();
        createPlayer();
      };
    }

    return () => {
      player?.destroy();
      playerRef.current = null;
      playerReadyRef.current = false;
      if (progressInterval) window.clearInterval(progressInterval);
    };
  }, [active.type]);

  const sensorEnabled = active.type === "video";
  const { videoRef, canvasRef, metrics: faceMetrics, streamError: faceError, isReady: faceReady } = useFaceTracking(sensorEnabled);
  const { metrics: audioMetrics, bars, streamError: voiceError, isReady: audioReady } = useVoiceAnalysis(sensorEnabled);
  const validationEnabled = sensorEnabled;

  const quizQuestions = [
    {
      id: "q1",
      prompt: "In the assigned course video, what was the primary concept explained in the opening section?",
      options: [
        { id: "a", text: "Core topic definition and context" },
        { id: "b", text: "Only final exam instructions" },
        { id: "c", text: "Unrelated software installation" }
      ],
      answer: "a"
    },
    {
      id: "q2",
      prompt: "According to the lesson video, which approach best improves understanding of the topic?",
      options: [
        { id: "a", text: "Memorize terms without examples" },
        { id: "b", text: "Follow concept explanation with worked examples" },
        { id: "c", text: "Skip the main explanation section" }
      ],
      answer: "b"
    },
    {
      id: "q3",
      prompt: "What should learners do before moving to the next segment after this video?",
      options: [
        { id: "a", text: "Complete the in-course quiz based on the video" },
        { id: "b", text: "Close the session immediately" },
        { id: "c", text: "Disable validation tracking" }
      ],
      answer: "a"
    }
  ];

  const _score = quizQuestions.reduce((acc, question) => {
    if (selectedAnswers[question.id] === question.answer) {
      return acc + 1;
    }
    return acc;
  }, 0);

  const quizPercent = submitted ? Math.round((_score / Math.max(1, quizQuestions.length)) * 100) : 0;

  const { snapshot, output, achievements, isLocked } = useEngagementEngine({
    faceMetrics,
    audioMetrics,
    enabled: validationEnabled,
    rewatchCount: 0,
    responseDelay: 0,
    interactionFrequency: 1,
    quizScore: quizPercent,
  });

  useEffect(() => {
    sessionStorage.setItem("course:last-hp", String(snapshot.hp));
    sessionStorage.setItem("course:last-focus", snapshot.focusScore.toFixed(2));
    sessionStorage.setItem("course:detected-anomalies", JSON.stringify(snapshot.violations));
  }, [snapshot.hp, snapshot.focusScore, snapshot.violations]);

  usePlaybackController({
    enabled: active.type === "video",
    playerRef,
    playerReadyRef,
    stableRecoveryMs: 2000,
    flags: {
      faceDetected: faceMetrics.faceDetected,
      multipleFaces: faceMetrics.multipleFaces || faceMetrics.faceCount > 1,
      gazeOnScreen: faceMetrics.eyeGaze === "ON_SCREEN",
      headPoseValid: faceMetrics.headPose === "STABLE",
      isTalking: audioMetrics.vadState === "TALKING",
      noiseLevelHigh: audioMetrics.vadState === "NOISE",
      tabActive,
      detectionHealthy: faceReady && audioReady && !faceError && !voiceError,
      confidenceValid: snapshot.confidenceScore >= 0.7,
    },
  });

  const quizUnlocked = active.type === "video" && videoEnded;


  return (
    <section className="page-grid" style={{ gridTemplateColumns: "minmax(220px, 280px) minmax(0, 1fr)" }}>
      <aside className="card" style={{ padding: "1rem", alignSelf: "start" }}>
        <h2 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>{course.title}</h2>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {course.modules.map((module) => (
            <button
              key={module.id}
              onClick={() => setActiveModuleId(module.id)}
              style={{
                textAlign: "left",
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: module.id === active.id ? "var(--primary-soft)" : "transparent",
                color: module.id === active.id ? "var(--primary)" : "var(--text)",
                padding: "0.62rem",
                cursor: "pointer"
              }}
            >
              {module.title}
            </button>
          ))}
        </div>
      </aside>

      <motion.article className="card" style={{ padding: "1rem" }} key={active.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.24 }}>
        <h3 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>{active.title}</h3>
        <p style={{ color: "var(--text-soft)" }}>Module type: {active.type}</p>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: "0.9rem", alignItems: "start" }}>
          <div style={{ display: "grid", gap: "0.8rem" }}>
            <div style={{ minHeight: 340, borderRadius: 16, background: "var(--bg-subtle)", padding: "1rem", border: "1px solid var(--border)", display: "grid", placeItems: "center" }}>
              {active.type === "video" ? (
                <div style={{ width: "100%", maxWidth: 920, display: "grid", gap: "0.72rem" }}>
                  <div
                    id="course-youtube-player"
                    style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 12, border: "1px solid var(--border)", background: "black", overflow: "hidden" }}
                  />
                  <div style={{ display: "grid", gap: "0.42rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-soft)" }}>
                      <span>Course watch progress</span>
                      <strong>{Math.round(videoProgress)}%</strong>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: "var(--bg-elevated)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.round(videoProgress)}%`, background: "var(--primary)", transition: "width .2s ease" }} />
                    </div>
                    <p style={{ margin: 0, color: videoEnded ? "var(--success)" : "var(--text-soft)" }}>
                      {videoEnded ? "Course fully watched. Quiz unlocked in Course Studio." : "Finish watching this course video to unlock the quiz section."}
                    </p>
                    {!videoEnded ? (
                      <button
                        type="button"
                        onClick={() => {
                          setVideoProgress(100);
                          setVideoEnded(true);
                        }}
                        style={{ justifySelf: "start", border: "1px solid var(--border)", borderRadius: 10, background: "transparent", color: "var(--text)", padding: "0.38rem 0.62rem", cursor: "pointer" }}
                      >
                        Mark lesson complete
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", maxWidth: 760 }}>
                  <h4 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: "2rem" }}>{active.title}</h4>
                  {active.type === "article" ? (
                    <div style={{ textAlign: "left", color: "var(--text-soft)", marginTop: "0.8rem", display: "grid", gap: "0.55rem" }}>
                      <p style={{ margin: 0, color: "var(--text)", fontWeight: 700 }}>Data Cleaning and EDA</p>
                      <p style={{ margin: 0 }}>
                        Data cleaning (data wrangling) transforms raw datasets into analysis-ready form.
                        Exploratory Data Analysis (EDA) helps us understand structure, variable meaning,
                        granularity, temporality, and faithfulness before modeling.
                      </p>
                      <p style={{ margin: 0, color: "var(--text)", fontWeight: 700 }}>1. Structure and File Formats</p>
                      <p style={{ margin: 0 }}>
                        Structured data is often rectangular (tables or matrices). Common tabular file formats include
                        CSV (comma-delimited), TSV (tab-delimited), and JSON (nested key-value structure).
                        Practical workflow: inspect raw file rows, identify delimiters/header rows, then load carefully.
                      </p>
                      <p style={{ margin: 0, color: "var(--text)", fontWeight: 700 }}>2. Variable Types</p>
                      <p style={{ margin: 0 }}>
                        Variables are columns. Quantitative variables represent measurable amounts; qualitative
                        variables are categorical (ordinal or nominal). Storage type in memory and conceptual
                        feature type can differ, so always validate semantic meaning, not just dtype.
                      </p>
                      <p style={{ margin: 0, color: "var(--text)", fontWeight: 700 }}>3. Granularity and Temporality</p>
                      <p style={{ margin: 0 }}>
                        Granularity answers: what does one row represent? Temporality describes event time,
                        collection time, and update time. Standardize timezone assumptions and convert
                        string timestamps to datetime before temporal analysis.
                      </p>
                      <p style={{ margin: 0, color: "var(--text)", fontWeight: 700 }}>4. Faithfulness and Missing Data</p>
                      <p style={{ margin: 0 }}>
                        Check for unrealistic values, duplicates, dependency violations, and data entry artifacts.
                        For missing values, choose intentionally among dropping rows, preserving NaN, or imputation.
                        Each strategy affects bias, interpretability, and downstream model behavior.
                      </p>
                      <p style={{ margin: 0, color: "var(--text)", fontWeight: 700 }}>5. EDA Workflow Checklist</p>
                      <p style={{ margin: 0 }}>1. Inspect raw structure and metadata.</p>
                      <p style={{ margin: 0 }}>2. Validate headers, column meaning, and row granularity.</p>
                      <p style={{ margin: 0 }}>3. Profile variable types and suspicious values.</p>
                      <p style={{ margin: 0 }}>4. Normalize temporal fields and compare time-based patterns.</p>
                      <p style={{ margin: 0 }}>5. Address missingness with documented rationale.</p>
                      <p style={{ margin: 0 }}>6. Visualize trends and validate assumptions iteratively.</p>
                    </div>
                  ) : (
                    <div style={{ textAlign: "left", color: "var(--text-soft)", marginTop: "0.8rem", display: "grid", gap: "0.55rem" }}>
                      <p style={{ margin: 0, color: "var(--text)", fontWeight: 700 }}>KPI Dashboard Lab</p>
                      <p style={{ margin: 0 }}>
                        In this interactive lab, you build an analytics dashboard using realistic business metrics,
                        then interpret trends to make data-driven decisions.
                      </p>
                      <p style={{ margin: 0, color: "var(--text)", fontWeight: 700 }}>Core KPIs</p>
                      <p style={{ margin: 0 }}>1. Revenue and month-over-month growth rate.</p>
                      <p style={{ margin: 0 }}>2. Conversion rate by channel and campaign.</p>
                      <p style={{ margin: 0 }}>3. Customer retention and churn by cohort.</p>
                      <p style={{ margin: 0 }}>4. Average order value and repeat purchase ratio.</p>
                      <p style={{ margin: 0, color: "var(--text)", fontWeight: 700 }}>Lab Activities</p>
                      <p style={{ margin: 0 }}>1. Compare KPI movement across two time windows and flag anomalies.</p>
                      <p style={{ margin: 0 }}>2. Segment performance by region, product category, and traffic source.</p>
                      <p style={{ margin: 0 }}>3. Build a concise executive summary with top insights and risks.</p>
                      <p style={{ margin: 0 }}>4. Recommend one optimization experiment based on dashboard evidence.</p>
                      <p style={{ margin: 0, color: "var(--text)", fontWeight: 700 }}>Expected Outcome</p>
                      <p style={{ margin: 0 }}>
                        You should be able to identify underperforming segments quickly, explain why KPIs moved,
                        and propose actionable next steps using visual evidence from the dashboard.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {active.type === "video" && (
              <section className="card" style={{ padding: "0.9rem" }}>
                <h4 style={{ marginTop: 0, marginBottom: "0.4rem", fontFamily: "var(--font-heading)" }}>Course Studio Quiz</h4>
                {!quizUnlocked ? (
                  <p style={{ margin: 0, color: "var(--text-soft)" }}>Quiz will appear here after 100% video completion.</p>
                ) : (
                  <form
                    style={{ display: "grid", gap: "0.9rem" }}
                    onSubmit={(event) => {
                      event.preventDefault();
                      setSubmitted(true);
                    }}
                  >
                    {quizQuestions.map((question, index) => (
                      <fieldset key={question.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "0.7rem" }}>
                        <legend style={{ padding: "0 0.2rem", color: "var(--text-soft)", fontSize: 13 }}>Question {index + 1}</legend>
                        <p style={{ marginTop: 0 }}>{question.prompt}</p>
                        <div style={{ display: "grid", gap: "0.38rem" }}>
                          {question.options.map((option) => (
                            <label key={option.id} style={{ display: "flex", gap: "0.45rem", alignItems: "center" }}>
                              <input
                                type="radio"
                                name={question.id}
                                value={option.id}
                                checked={selectedAnswers[question.id] === option.id}
                                onChange={() => setSelectedAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
                              />
                              <span>{option.text}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}

                    <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                      <button type="submit" style={{ border: "1px solid var(--primary)", borderRadius: 10, background: "var(--primary)", color: "white", padding: "0.5rem 0.9rem", cursor: "pointer" }}>
                        Submit Quiz
                      </button>
                      {submitted && <strong style={{ color: "var(--primary)" }}>Score: {_score}/{quizQuestions.length}</strong>}
                    </div>
                  </form>
                )}
              </section>
            )}
          </div>

          <aside className="card" style={{ padding: "0.8rem", borderRadius: 14 }}>
            {sensorEnabled && <EngagementHud snapshot={snapshot} bars={bars} mercySeconds={snapshot.hp >= 80 ? 7 : snapshot.hp > 40 ? 5 : 2} />}
            
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, padding: "0.3rem 0.65rem", background: "var(--primary-soft)", color: "var(--primary)", marginBottom: "0.65rem", marginTop: validationEnabled ? "0.65rem" : 0 }}>
              <span>●</span>
              <span>Video and audio tracked locally only</span>
            </div>

            <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", marginBottom: "0.65rem", background: "var(--bg-subtle)" }}>
              <div style={{ background: snapshot.violations.length ? "var(--danger)" : "var(--success)", color: "white", padding: "0.45rem 0.6rem", fontWeight: 700 }}>
                {snapshot.violations.length ? `${snapshot.violations.length} Anomaly${snapshot.violations.length > 1 ? 'ies' : ''} Detected` : "All Clear"}
              </div>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: 170, objectFit: "cover", display: "block" }} />
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>

            <div style={{ display: "grid", gap: "0.42rem", marginBottom: "0.7rem" }}>
              <Row label="Face" value={faceMetrics.faceDetected ? "Detected" : "None detected"} />
              <Row label="Eye Gaze" value={faceMetrics.eyeGaze} />
              <Row label="Head Pose" value={faceMetrics.headPose} />
              <Row label="Voice" value={audioMetrics.speechPattern} />
              <Row label="Noise" value={`${Math.round(audioMetrics.noiseLevel * 100)}%`} />
              <Row label="Avg HP" value={`${output.avgHP}`} />
              <Row label="Quiz Mastery" value={`${quizPercent}%`} />
              <Row label="Session Lock" value={isLocked ? "LOCKED" : "ACTIVE"} />
            </div>

            <div style={{ height: 58, display: "flex", alignItems: "end", gap: 3, background: "var(--bg-subtle)", borderRadius: 10, padding: "0.45rem", marginBottom: "0.65rem" }}>
              {bars.map((value, idx) => (
                <span
                  key={idx}
                  style={{
                    width: 4,
                    height: `${Math.max(8, value)}%`,
                    borderRadius: 999,
                    background: audioMetrics.speechPattern === "CONTINUOUS" ? "var(--danger)" : "var(--primary)",
                  }}
                />
              ))}
            </div>

            {faceError ? <p style={{ color: "var(--danger)", marginTop: 0 }}>{faceError}</p> : null}
            {voiceError ? <p style={{ color: "var(--danger)", marginTop: 0 }}>{voiceError}</p> : null}
            {(faceError || voiceError) ? (
              <p style={{ color: "var(--warning)", marginTop: 0 }}>
                Sensor degraded. Pulse engine is active with available validated signals.
              </p>
            ) : null}

            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {snapshot.violations.length ? snapshot.violations.map((item) => (
                <span key={item} style={{ borderRadius: 999, padding: "0.25rem 0.55rem", background: "color-mix(in srgb, var(--danger) 14%, transparent)", color: "var(--danger)", fontSize: 12, fontWeight: 700 }}>{item}</span>
              )) : <span style={{ borderRadius: 999, padding: "0.25rem 0.55rem", background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)", fontSize: 12, fontWeight: 700 }}>NO_ANOMALY</span>}
            </div>

            {achievements.length ? (
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
                {achievements.map((name) => (
                  <span key={name} style={{ borderRadius: 999, padding: "0.25rem 0.55rem", background: "color-mix(in srgb, var(--primary) 16%, transparent)", color: "var(--primary)", fontSize: 12, fontWeight: 700 }}>
                    {name}
                  </span>
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      </motion.article>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, border: "1px solid var(--border)", borderRadius: 10, padding: "0.42rem 0.52rem", background: "var(--bg-elevated)", fontSize: 13 }}>
      <span style={{ color: "var(--text-soft)" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}


