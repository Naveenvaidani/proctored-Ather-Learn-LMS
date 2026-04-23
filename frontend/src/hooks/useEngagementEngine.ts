import { useEffect, useMemo, useRef, useState } from "react";
import {
  BehaviorMetrics,
  EngagementSnapshot,
  FaceMetrics,
  SessionOutput,
  ViolationType,
  AudioMetrics,
} from "../features/engagement/types";

interface UseEngagementEngineInput {
  faceMetrics: FaceMetrics;
  audioMetrics: AudioMetrics;
  enabled: boolean;
  rewatchCount?: number;
  responseDelay?: number;
  interactionFrequency?: number;
  quizScore?: number;
}

const defaultBehavior: BehaviorMetrics = {
  tabActive: true,
  windowFocused: true,
  idleTime: 0,
};

const defaultSnapshot: EngagementSnapshot = {
  hp: 100,
  focusScore: 1,
  cognitiveLoad: 25,
  confidenceScore: 1,
  state: "FOCUSED",
  violations: [],
};

const VIOLATION_INTERVAL_MS: Record<ViolationType, number> = {
  NO_FACE: 1000,
  MULTIPLE_FACES: 1000,
  LOOKING_AWAY: 1000,
  HEAD_DOWN: 1000,
  TALKING: 1000,
  NOISE: 1000,
  TAB_SWITCH: 700,
  INACTIVITY: 1000,
};
const MAX_NEGATIVE_HP_PER_TICK = 10;

const strictPenaltyRate: Record<ViolationType, number> = {
  NO_FACE: 3,
  MULTIPLE_FACES: 4,
  LOOKING_AWAY: 2,
  HEAD_DOWN: 3,
  TALKING: 2,
  NOISE: 1,
  TAB_SWITCH: 4,
  INACTIVITY: 1,
};

export function useEngagementEngine({
  faceMetrics,
  audioMetrics,
  enabled,
  rewatchCount = 0,
  responseDelay = 0,
  interactionFrequency = 1,
  quizScore = 0,
}: UseEngagementEngineInput) {
  const fusionWorkerRef = useRef<Worker | null>(null);
  const violationStartRef = useRef<Record<string, number>>({});
  const violationLastSeenRef = useRef<Record<string, number>>({});
  const hpHistoryRef = useRef<number[]>([]);
  const lastInteractionRef = useRef<number>(Date.now());
  const achievedRef = useRef<Set<string>>(new Set());
  const hasTalkingRef = useRef<boolean>(false);
  const violationLastPenaltyRef = useRef<Record<string, number>>({});
  const violationOccurrenceHistoryRef = useRef<Record<ViolationType, number[]>>({
    NO_FACE: [],
    MULTIPLE_FACES: [],
    LOOKING_AWAY: [],
    HEAD_DOWN: [],
    TALKING: [],
    NOISE: [],
    TAB_SWITCH: [],
    INACTIVITY: [],
  });
  const stableSinceRef = useRef<number | null>(null);
  const lastRecoveryAtRef = useRef<number>(0);

  const [behaviorMetrics, setBehaviorMetrics] = useState<BehaviorMetrics>(defaultBehavior);
  const [snapshot, setSnapshot] = useState<EngagementSnapshot>(defaultSnapshot);
  const [achievements, setAchievements] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const onActivity = () => {
      lastInteractionRef.current = Date.now();
    };

    const onVisibility = () => {
      setBehaviorMetrics((prev) => ({
        ...prev,
        tabActive: document.visibilityState === "visible",
      }));
    };

    const onFocus = () => {
      setBehaviorMetrics((prev) => ({ ...prev, windowFocused: true }));
    };

    const onBlur = () => {
      setBehaviorMetrics((prev) => ({ ...prev, windowFocused: false }));
    };

    const idleTimer = window.setInterval(() => {
      setBehaviorMetrics((prev) => ({
        ...prev,
        idleTime: Date.now() - lastInteractionRef.current,
      }));
    }, 300);

    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(idleTimer);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const worker = new Worker("/workers/engagementWorker.js");
    fusionWorkerRef.current = worker;

    worker.onmessage = (event) => {
      const { focusScore, violations, confidenceScore } = event.data as {
        focusScore: number;
        violations: ViolationType[];
        confidenceScore: number;
      };

      setSnapshot((prev) => ({ ...prev, focusScore, violations, confidenceScore }));
    };

    return () => {
      worker.terminate();
      fusionWorkerRef.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !fusionWorkerRef.current) return;

    fusionWorkerRef.current.postMessage({
      faceMetrics,
      audioMetrics,
      behaviorMetrics,
    });
  }, [audioMetrics, behaviorMetrics, enabled, faceMetrics]);

  useEffect(() => {
    if (!enabled) return;

    const interval = window.setInterval(() => {
      setSnapshot((prev) => {
        const now = Date.now();
        const currentViolations = prev.violations;

        currentViolations.forEach((violation) => {
          violationLastSeenRef.current[violation] = now;
        });

        const graceMs = 1500;
        const effectiveViolations = Object.entries(violationLastSeenRef.current)
          .filter(([, lastSeen]) => now - lastSeen <= graceMs)
          .map(([violation]) => violation as ViolationType);

        const staleViolations = Object.entries(violationLastSeenRef.current)
          .filter(([, lastSeen]) => now - lastSeen > graceMs)
          .map(([violation]) => violation);

        staleViolations.forEach((violation) => {
          delete violationLastSeenRef.current[violation];
          delete violationStartRef.current[violation];
        });

        effectiveViolations.forEach((violation) => {
          if (!violationStartRef.current[violation]) {
            violationStartRef.current[violation] = now;
            violationOccurrenceHistoryRef.current[violation] = [
              ...violationOccurrenceHistoryRef.current[violation].filter((timestamp) => now - timestamp <= 30000),
              now,
            ];
          }
        });

        hasTalkingRef.current = hasTalkingRef.current || effectiveViolations.includes("TALKING");

        const mercy = prev.hp >= 80 ? 7000 : prev.hp > 40 ? 5000 : 2000;

        let hpDelta = 0;

        effectiveViolations.forEach((violation) => {
          const startedAt = violationStartRef.current[violation] ?? now;
          const elapsed = now - startedAt;
          const lastPenaltyAt = violationLastPenaltyRef.current[violation] ?? 0;
          const dueByInterval = now - lastPenaltyAt >= VIOLATION_INTERVAL_MS[violation];
          const repeatedCount = violationOccurrenceHistoryRef.current[violation].filter((timestamp) => now - timestamp <= 30000).length;
          const escalationMultiplier = repeatedCount >= 3 ? 1.5 : 1;

          if (violation === "TAB_SWITCH") {
            if (dueByInterval) {
              hpDelta -= Math.round(strictPenaltyRate.TAB_SWITCH * escalationMultiplier);
              violationLastPenaltyRef.current[violation] = now;
            }
            return;
          }

          if (violation === "NO_FACE" || violation === "MULTIPLE_FACES" || violation === "HEAD_DOWN") {
            if (dueByInterval) {
              hpDelta -= Math.round(strictPenaltyRate[violation] * escalationMultiplier);
              violationLastPenaltyRef.current[violation] = now;
            }
            return;
          }

          if (!dueByInterval) return;

          if (elapsed >= mercy) {
            const rate = strictPenaltyRate[violation] ?? 2;
            const severityBoost = elapsed >= mercy * 2 ? 1.25 : 1;
            hpDelta -= Math.round(rate * escalationMultiplier * severityBoost);
            violationLastPenaltyRef.current[violation] = now;
          }
        });

        if (hpDelta < -MAX_NEGATIVE_HP_PER_TICK) {
          hpDelta = -MAX_NEGATIVE_HP_PER_TICK;
        }

        const highRiskCombo =
          effectiveViolations.includes("TALKING") &&
          (effectiveViolations.includes("NO_FACE") || effectiveViolations.includes("LOOKING_AWAY") || effectiveViolations.includes("HEAD_DOWN"));
        if (highRiskCombo) {
          hpDelta -= 1;
        }

        const stableFocus =
          prev.focusScore > 0.8 &&
          faceMetrics.faceDetected &&
          faceMetrics.eyeGaze === "ON_SCREEN" &&
          faceMetrics.headPose === "STABLE" &&
          audioMetrics.vadState === "CLEAN" &&
          audioMetrics.noiseLevel <= Math.max(0.2, audioMetrics.noiseThreshold) &&
          behaviorMetrics.tabActive &&
          behaviorMetrics.windowFocused &&
          behaviorMetrics.idleTime <= 5000;

        if (stableFocus && !effectiveViolations.length) {
          if (stableSinceRef.current === null) {
            stableSinceRef.current = now;
          }

          if (now - stableSinceRef.current >= 5000 && now - lastRecoveryAtRef.current >= 5000 && prev.hp < 100) {
            hpDelta += 1;
            lastRecoveryAtRef.current = now;
          }
        } else {
          stableSinceRef.current = null;
        }

        const hp = Math.max(0, Math.min(100, prev.hp + hpDelta));

        hpHistoryRef.current = [...hpHistoryRef.current, hp].slice(-300);

        const cognitiveLoad = Math.max(
          0,
          Math.min(
            100,
            18 + rewatchCount * 10 + responseDelay * 0.05 + (1 / Math.max(0.2, interactionFrequency)) * 18,
          ),
        );

        const hasCriticalViolation =
          effectiveViolations.includes("NO_FACE") ||
          effectiveViolations.includes("MULTIPLE_FACES") ||
          effectiveViolations.includes("HEAD_DOWN") ||
          effectiveViolations.includes("TAB_SWITCH");

        const state =
          hp <= 40 || (hasCriticalViolation && prev.focusScore < 0.25)
            ? "CRITICAL"
            : hp <= 80 || effectiveViolations.length > 0 || prev.focusScore < 0.65
              ? "WARNING"
              : cognitiveLoad > 65 && prev.focusScore >= 0.7
                ? "FOCUSED_BUT_STRUGGLING"
                : "FOCUSED";

        if (!effectiveViolations.length && !achievedRef.current.has("Unbroken")) {
          achievedRef.current.add("Unbroken");
          setAchievements((old) => [...old, "Unbroken"]);
        }

        if (quizScore >= 90 && !achievedRef.current.has("First-Try Hero")) {
          achievedRef.current.add("First-Try Hero");
          setAchievements((old) => [...old, "First-Try Hero"]);
        }

        if (!hasTalkingRef.current && !achievedRef.current.has("Silent Scholar")) {
          achievedRef.current.add("Silent Scholar");
          setAchievements((old) => [...old, "Silent Scholar"]);
        }

        return {
          ...prev,
          hp,
          cognitiveLoad,
          state,
        };
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [enabled, interactionFrequency, quizScore, responseDelay, rewatchCount]);

  const output: SessionOutput = useMemo(() => {
    const hpHistory = hpHistoryRef.current;
    const avgHP = hpHistory.length
      ? Number((hpHistory.reduce((sum, value) => sum + value, 0) / hpHistory.length).toFixed(2))
      : 100;

    const anomalies = Array.from(new Set(snapshot.violations));

    const insights: string[] = [];
    if (snapshot.focusScore < 0.65) insights.push("Attention decay detected; trigger shorter segments.");
    if (snapshot.cognitiveLoad > 70) insights.push("High cognitive load; reinforce concept before next segment.");
    if (!anomalies.length) insights.push("Strong session consistency and stable engagement.");

    return {
      avgHP,
      focusScore: Number(snapshot.focusScore.toFixed(2)),
      quizScore,
      anomalies,
      insights,
    };
  }, [quizScore, snapshot.cognitiveLoad, snapshot.focusScore, snapshot.violations]);

  return {
    behaviorMetrics,
    snapshot,
    output,
    achievements,
    isLocked: snapshot.hp <= 0,
  };
}
