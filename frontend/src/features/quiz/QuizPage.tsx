/* eslint-disable */
/* eslint-disable react/forbid-dom-props */
import { type CSSProperties, type ChangeEvent, type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchGenAIJobStatus, fetchQuiz, startGenAIJob, submitQuiz } from "../../services/learning.service";
import { toClock } from "../../utils/format";

const DEFAULT_VIDEO_URL = "https://youtu.be/37x5dKW-X5U?si=L2RpeC0NZGY8jalW";
const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|playlist\?list=)|youtu\.be\/)[A-Za-z0-9_-]+([&?][^\s]*)?$/i;
const MONGO_ID_REGEX = /^[a-f\d]{24}$/i;

type YouTubePlayerStateChangeEvent = { data: number };

const fallbackQuiz = {
  id: "live",
  title: "Applied Algorithms Checkpoint",
  durationSeconds: 300,
  questions: [
    {
      id: "q1",
      prompt: "Mastering Recurrences: Which recurrence solves to O(n log n)?",
      options: ["O(n)", "O(log n)", "O(n log n)", "O(n^2)"],
      answer: "O(n log n)",
      explanation: "T(n)=2T(n/2)+n solves to O(n log n), matching recurrence expansion levels.",
    },
    {
      id: "q2",
      prompt: "Time Complexity Patterns: Which class dominates as n becomes very large?",
      options: ["O(log n)", "O(n)", "O(n log n)", "O(n^2)"],
      answer: "O(n^2)",
      explanation: "Among these options, quadratic growth increases the fastest.",
    },
  ],
};

export default function QuizPage() {
  const { data } = useQuery({ queryKey: ["quiz", "live"], queryFn: () => fetchQuiz("live"), retry: false });
  const quiz = data ?? fallbackQuiz;

  const [videoUrl, setVideoUrl] = useState(DEFAULT_VIDEO_URL);
  const [courseId, setCourseId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [videoEnded, setVideoEnded] = useState(false);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [videoLoadedForGeneration, setVideoLoadedForGeneration] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(quiz.durationSeconds);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittedQuestionId, setSubmittedQuestionId] = useState<string | null>(null);
  const [engagementHp] = useState(() => Number(sessionStorage.getItem("aether:last-hp") ?? "85"));

  const mutation = useMutation({ mutationFn: () => submitQuiz(quiz.id, answers) });
  const generateMutation = useMutation({
    mutationFn: () =>
      startGenAIJob({
        type: "VIDEO",
        url: videoUrl,
        uploadParameters: {
          courseId,
          versionId,
          videoItemBaseName: "Portal Video",
          quizItemBaseName: "Applied Algorithms Quiz",
          questionsPerQuiz: 5,
        },
      }),
    onSuccess: (result) => {
      setGenerationJobId(result.jobId);
      setVideoLoadedForGeneration(videoUrl);
    },
  });

  const { data: jobStatus } = useQuery({
    queryKey: ["genai-job-status", generationJobId],
    queryFn: () => fetchGenAIJobStatus(generationJobId as string),
    enabled: !!generationJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "COMPLETED" || status === "FAILED" || status === "ABORTED") return false;
      return 3000;
    },
  });

  const isVideoUrlValid = YOUTUBE_URL_REGEX.test(videoUrl.trim());
  const isCourseIdValid = MONGO_ID_REGEX.test(courseId.trim());
  const isVersionIdValid = MONGO_ID_REGEX.test(versionId.trim());
  const canGenerate = videoEnded && isVideoUrlValid && isCourseIdValid && isVersionIdValid;

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
    setTimeLeft(quiz.durationSeconds);
  }, [quiz.durationSeconds]);

  useEffect(() => {
    const timer = window.setInterval(() => setTimeLeft((v) => Math.max(v - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const videoId = extractYouTubeVideoId(videoUrl);
    const mountId = "youtube-player-mount";
    let player: any;

    setVideoEnded(false);
    if (!videoId) return;

    const createPlayer = () => {
      const ytWindow = window as any;
      if (!ytWindow.YT?.Player) return;
      player = new ytWindow.YT.Player(mountId, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (event: YouTubePlayerStateChangeEvent) => {
            if (event.data === ytWindow.YT?.PlayerState.ENDED) setVideoEnded(true);
          },
        },
      });
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

    return () => player?.destroy();
  }, [videoUrl]);

  useEffect(() => {
    if (!canGenerate) return;
    if (generateMutation.isPending) return;
    if (videoLoadedForGeneration === videoUrl && generationJobId) return;
    generateMutation.mutate();
  }, [canGenerate, generateMutation, generationJobId, videoLoadedForGeneration, videoUrl]);

  const question = quiz.questions[index];
  const progress = useMemo(() => ((index + 1) / quiz.questions.length) * 100, [index, quiz.questions.length]);
  const finalScore = mutation.data?.score ?? null;
  const requiresRewatch = finalScore !== null && finalScore < 50;
  const canUnlockNextSegment = finalScore !== null && finalScore >= 50;
  const adaptiveInsight =
    finalScore === null
      ? ""
      : engagementHp > 90 && finalScore > 80
        ? "Difficulty increased for next segment."
        : engagementHp > 80 && finalScore < 50
          ? "Concept reinforcement enabled before progression."
          : "Difficulty remains stable for next segment.";

  const onKeyPick = (event: KeyboardEvent<HTMLDivElement>) => {
    const numeric = Number(event.key);
    if (numeric >= 1 && numeric <= question.options.length) {
      const picked = question.options[numeric - 1];
      setAnswers((prev) => ({ ...prev, [question.id]: picked }));
    }
    if (event.key.toLowerCase() === "enter") setSubmittedQuestionId(question.id);
  };

  return (
    <section className="card" style={{ padding: "1rem" }}>
      <div style={{ marginBottom: "1.2rem", padding: "0.9rem", border: "1px solid var(--border)", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>Course Video Quiz Generation</h2>
        <p style={{ marginTop: 0, color: "var(--text-soft)" }}>
          Watch the full course video, then quiz generation starts automatically.
        </p>

        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Video URL
          <input
            value={videoUrl}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setVideoUrl(event.target.value)}
            style={{ width: "100%", marginTop: "0.25rem", padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }}
          />
        </label>

        {!isVideoUrlValid ? <div style={{ color: "var(--danger)", marginBottom: "0.5rem" }}>Enter a valid YouTube link.</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem", marginBottom: "0.7rem" }}>
          <label style={{ display: "block" }}>
            Course ID
            <input
              value={courseId}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setCourseId(event.target.value)}
              placeholder="24-char Mongo ID"
              style={{ width: "100%", marginTop: "0.25rem", padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }}
            />
          </label>
          <label style={{ display: "block" }}>
            Version ID
            <input
              value={versionId}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setVersionId(event.target.value)}
              placeholder="24-char Mongo ID"
              style={{ width: "100%", marginTop: "0.25rem", padding: "0.55rem", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }}
            />
          </label>
        </div>

        {(courseId && !isCourseIdValid) || (versionId && !isVersionIdValid) ? <div style={{ color: "var(--danger)", marginBottom: "0.5rem" }}>Course ID and Version ID must be valid Mongo IDs.</div> : null}

        <div id="youtube-player-mount" style={{ width: "100%", maxWidth: 900, aspectRatio: "16 / 9", background: "#000", borderRadius: 14, overflow: "hidden", marginBottom: "0.7rem", border: "1px solid var(--border)" }} />

        <div style={{ color: "var(--text-soft)" }}>Video status: {videoEnded ? "Completed" : "In progress"}</div>
        <div style={{ color: canGenerate ? "var(--success)" : "var(--text-soft)" }}>Quiz generation: {canGenerate ? "Triggered" : "Waiting for video completion and valid input"}</div>
        {generateMutation.error ? <div style={{ color: "var(--danger)" }}>Failed to start AI quiz generation.</div> : null}
        {generationJobId ? <div style={{ marginTop: "0.4rem", color: "var(--text-soft)" }}>Job ID: {generationJobId}</div> : null}
        {jobStatus ? <div style={{ marginTop: "0.2rem", color: "var(--text-soft)" }}>Job status: {jobStatus.status}{jobStatus.currentTask ? ` (${jobStatus.currentTask.type}: ${jobStatus.currentTask.status})` : ""}</div> : null}
      </div>

      <header style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-heading)" }}>{quiz.title}</h1>
          <p style={{ color: "var(--text-soft)", marginBottom: 0 }}>One question at a time. Keyboard shortcuts: 1-4, Enter.</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <strong>{toClock(timeLeft)}</strong>
          <div style={{ color: "var(--text-soft)" }}>Question {index + 1}/{quiz.questions.length}</div>
        </div>
      </header>

      <div style={{ margin: "1rem 0", height: 8, background: "var(--bg-subtle)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: "var(--primary)" }} />
      </div>

      <div tabIndex={0} onKeyDown={onKeyPick} style={{ outline: "none" }}>
        <h2 style={{ fontFamily: "var(--font-heading)" }}>{question.prompt}</h2>
        <div className="page-grid">
          {question.options.map((option, i) => {
            const selected = answers[question.id] === option;
            return (
              <button
                key={option}
                onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))}
                style={{ textAlign: "left", border: "1px solid var(--border)", borderRadius: 12, background: selected ? "var(--primary-soft)" : "transparent", color: selected ? "var(--primary)" : "var(--text)", padding: "0.7rem", cursor: "pointer" }}
              >
                {i + 1}. {option}
              </button>
            );
          })}
        </div>
      </div>

      <footer style={{ marginTop: "1rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button onClick={() => setSubmittedQuestionId(question.id)} style={actionBtn}>Submit Answer</button>
        <button onClick={() => setIndex((v) => Math.max(v - 1, 0))} disabled={index === 0} style={ghostBtn}>Back</button>
        <button onClick={() => setIndex((v) => Math.min(v + 1, quiz.questions.length - 1))} disabled={index === quiz.questions.length - 1} style={ghostBtn}>Next</button>
        <button onClick={() => mutation.mutate()} style={ghostBtn} disabled={mutation.isPending}>Finalize Quiz</button>
      </footer>

      {submittedQuestionId === question.id ? (
        <div style={{ marginTop: "0.9rem", padding: "0.8rem", borderRadius: 12, background: "var(--bg-subtle)" }}>
          <strong>Feedback:</strong> {answers[question.id] === question.answer ? "Correct." : "Not correct yet."} {question.explanation}
        </div>
      ) : null}

      {mutation.data ? (
        <div style={{ marginTop: "0.8rem", padding: "0.7rem", borderRadius: 12, background: "var(--bg-subtle)" }}>
          <p style={{ color: "var(--success)", margin: 0 }}>Final score: {mutation.data.score}</p>
          <p style={{ color: "var(--text-soft)", margin: "0.3rem 0 0" }}>Previous engagement HP: {engagementHp}</p>
          {requiresRewatch ? <p style={{ color: "var(--warning)", margin: "0.4rem 0 0" }}>Mastery gate: score below 50%. Rewatch is required before unlocking next segment.</p> : null}
          {canUnlockNextSegment ? <p style={{ color: "var(--success)", margin: "0.4rem 0 0" }}>Mastery gate: passed. Next segment unlocked.</p> : null}
          {adaptiveInsight ? <p style={{ color: "var(--text-soft)", margin: "0.4rem 0 0" }}>{adaptiveInsight}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

const actionBtn: CSSProperties = {
  border: "none",
  borderRadius: 12,
  background: "var(--primary)",
  color: "white",
  padding: "0.65rem 0.9rem",
  cursor: "pointer",
};

const ghostBtn: CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "transparent",
  color: "var(--text)",
  padding: "0.65rem 0.9rem",
  cursor: "pointer",
};
