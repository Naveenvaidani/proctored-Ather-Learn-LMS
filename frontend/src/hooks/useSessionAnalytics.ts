import { useEffect, useRef, useCallback } from "react";
import { EngagementSnapshot, ViolationType } from "../features/engagement/types";
import {
  TimelineEvent,
  ViolationStats,
  SessionAnalytics,
  EngagementHeatmap,
  ViolationContribution,
  SessionExport,
} from "../features/engagement/analyticsTypes";

interface UseSessionAnalyticsInput {
  snapshot: EngagementSnapshot;
  enabled: boolean;
  courseId?: string;
  userId?: string;
  achievements: string[];
}

/**
 * Comprehensive session analytics hook
 * Tracks everything: timeline, violations, HP trajectory, heatmaps
 */
export function useSessionAnalytics({
  snapshot,
  enabled,
  courseId = "unknown",
  userId = "anonymous",
  achievements = [],
}: UseSessionAnalyticsInput) {
  const sessionIdRef = useRef<string>(`session_${Date.now()}_${Math.random()}`);
  const startTimeRef = useRef<number>(Date.now());
  const timelineRef = useRef<TimelineEvent[]>([]);
  const violationTrackerRef = useRef<Record<ViolationType, { startTime: number | null; totalDuration: number; occurrences: number; hpLosses: number[] }>>({
    NO_FACE: { startTime: null, totalDuration: 0, occurrences: 0, hpLosses: [] },
    MULTIPLE_FACES: { startTime: null, totalDuration: 0, occurrences: 0, hpLosses: [] },
    LOOKING_AWAY: { startTime: null, totalDuration: 0, occurrences: 0, hpLosses: [] },
    HEAD_DOWN: { startTime: null, totalDuration: 0, occurrences: 0, hpLosses: [] },
    TALKING: { startTime: null, totalDuration: 0, occurrences: 0, hpLosses: [] },
    NOISE: { startTime: null, totalDuration: 0, occurrences: 0, hpLosses: [] },
    TAB_SWITCH: { startTime: null, totalDuration: 0, occurrences: 0, hpLosses: [] },
    INACTIVITY: { startTime: null, totalDuration: 0, occurrences: 0, hpLosses: [] },
  });

  const hpHistoryRef = useRef<number[]>([]);
  const focusHistoryRef = useRef<number[]>([]);
  const lockTimeRef = useRef<number | null>(null);
  const lastHpRef = useRef<number>(100);
  const stateTransitionsRef = useRef<Array<{ state: string; timestamp: number }>>([]);
  const hpDropEventsRef = useRef<Array<{ timestamp: number; magnitude: number; violation: ViolationType }>>([]);

  /**
   * Record a timeline event every second
   */
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;

      const event: TimelineEvent = {
        timestamp: elapsed,
        hp: snapshot.hp,
        focusScore: snapshot.focusScore,
        cognitiveLoad: snapshot.cognitiveLoad,
        violations: [...snapshot.violations],
        state: snapshot.state as any,
      };

      timelineRef.current.push(event);
      hpHistoryRef.current.push(snapshot.hp);
      focusHistoryRef.current.push(snapshot.focusScore);

      // Track HP drops
      if (snapshot.hp < lastHpRef.current) {
        const magnitude = lastHpRef.current - snapshot.hp;
        const violation = snapshot.violations[0] || ("UNKNOWN_VIOLATION" as ViolationType);
        hpDropEventsRef.current.push({
          timestamp: elapsed,
          magnitude,
          violation,
        });
      }

      // Track lock time
      if (snapshot.hp === 0 && lockTimeRef.current === null) {
        lockTimeRef.current = elapsed;
      }

      lastHpRef.current = snapshot.hp;

      // Track state transitions
      if (
        stateTransitionsRef.current.length === 0 ||
        stateTransitionsRef.current[stateTransitionsRef.current.length - 1].state !== snapshot.state
      ) {
        stateTransitionsRef.current.push({
          state: snapshot.state,
          timestamp: elapsed,
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, snapshot]);

  /**
   * Track violation lifecycle (start/end times)
   */
  useEffect(() => {
    if (!enabled) return;

    const violationTracker = violationTrackerRef.current;

    // Track violations that are currently active vs. previously active
    const previousViolations = new Set(Object.keys(violationTracker));
    const currentViolations = new Set(snapshot.violations);

    // Handle new violations starting
    currentViolations.forEach((v) => {
      if (!violationTracker[v as ViolationType].startTime) {
        violationTracker[v as ViolationType].startTime = Date.now();
        violationTracker[v as ViolationType].occurrences += 1;
      }
    });

    // Handle violations ending
    previousViolations.forEach((v) => {
      const viol = v as ViolationType;
      if (!currentViolations.has(viol) && violationTracker[viol].startTime) {
        const duration = Date.now() - violationTracker[viol].startTime;
        violationTracker[viol].totalDuration += duration;
        violationTracker[viol].startTime = null;
      }
    });
  }, [enabled, snapshot.violations]);

  /**
   * Calculate comprehensive analytics
   */
  const analytics = useCallback((): SessionAnalytics => {
    const now = Date.now();
    const duration = now - startTimeRef.current;
    const hpHist = hpHistoryRef.current;
    const focusHist = focusHistoryRef.current;
    const timeline = timelineRef.current;

    // Compute violation statistics
    const violations: ViolationStats[] = Object.entries(violationTrackerRef.current)
      .filter(([, tracker]) => tracker.occurrences > 0)
      .map(([vType, tracker]) => {
        const totalHpLoss = tracker.hpLosses.reduce((a, b) => a + b, 0);
        return {
          type: vType as ViolationType,
          count: tracker.occurrences,
          duration: tracker.totalDuration,
          firstOccurrence: timeline.find((e) => e.violations.includes(vType as ViolationType))?.timestamp ?? 0,
          lastOccurrence:
            [...timeline].reverse().find((e) => e.violations.includes(vType as ViolationType))?.timestamp ?? 0,
          avgHPDelta: tracker.hpLosses.length > 0 ? totalHpLoss / tracker.hpLosses.length : 0,
          totalHPLoss: totalHpLoss,
        };
      });

    // Compute aggregate statistics
    const avgHP = hpHist.length > 0 ? hpHist.reduce((a, b) => a + b, 0) / hpHist.length : 100;
    const minHP = hpHist.length > 0 ? Math.min(...hpHist) : 100;
    const maxHP = hpHist.length > 0 ? Math.max(...hpHist) : 100;
    const avgFocusScore = focusHist.length > 0 ? focusHist.reduce((a, b) => a + b, 0) / focusHist.length : 1;

    const criticalCount = stateTransitionsRef.current.filter((t) => t.state === "CRITICAL").length;
    const warningCount = stateTransitionsRef.current.filter((t) => t.state === "WARNING").length;

    return {
      sessionId: sessionIdRef.current,
      startTime: startTimeRef.current,
      endTime: now,
      duration,
      timeline,
      violations,
      hpTimeline: hpHist,
      focusTimeline: focusHist,
      avgHP: Number(avgHP.toFixed(2)),
      minHP,
      maxHP,
      avgFocusScore: Number(avgFocusScore.toFixed(2)),
      lockTime: lockTimeRef.current,
      criticalCount,
      warningCount,
      totalViolations: violations.reduce((sum, v) => sum + v.count, 0),
      uniqueViolationTypes: new Set(violations.map((v) => v.type)),
      hpDropTimestamps: hpDropEventsRef.current,
    };
  }, []);

  /**
   * Generate engagement heatmap (HP loss grouped by time buckets)
   */
  const generateHeatmap = useCallback(
    (bucketDuration: number = 5000): EngagementHeatmap => {
      const timeline = timelineRef.current;
      const buckets: EngagementHeatmap["buckets"] = [];

      for (let t = 0; t < timeline[timeline.length - 1]?.timestamp || 0; t += bucketDuration) {
        const bucketTimeline = timeline.filter((e) => e.timestamp >= t && e.timestamp < t + bucketDuration);
        const hpValues = bucketTimeline.map((e) => e.hp);
        const hpLoss = hpValues[0] - hpValues[hpValues.length - 1];
        const violations = Array.from(new Set(bucketTimeline.flatMap((e) => e.violations)));

        const severity =
          hpLoss >= 15 ? "high" : hpLoss >= 8 ? "medium" : "low";

        buckets.push({
          timestamp: t,
          duration: bucketDuration,
          severity,
          hpLoss: Math.max(0, hpLoss),
          violations: violations as ViolationType[],
        });
      }

      return { buckets };
    },
    []
  );

  /**
   * Calculate per-violation contribution to HP loss
   */
  const violationContributions = useCallback((): ViolationContribution[] => {
    const violations = violationTrackerRef.current;
    const totalHpLoss = Object.values(violations).reduce((sum, v) => sum + v.hpLosses.reduce((a, b) => a + b, 0), 0);

    return Object.entries(violations)
      .filter(([, v]) => v.occurrences > 0)
      .map(([vType, v]) => ({
        violation: vType as ViolationType,
        percentOfTotal: totalHpLoss > 0 ? (v.hpLosses.reduce((a, b) => a + b, 0) / totalHpLoss) * 100 : 0,
        weight: v.hpLosses.length > 0 ? v.hpLosses.reduce((a, b) => a + b, 0) / v.hpLosses.length : 0,
        frequency: v.occurrences,
      }))
      .sort((a, b) => b.percentOfTotal - a.percentOfTotal);
  }, []);

  /**
   * Export session data in analytics format
   */
  const exportSession = useCallback((): SessionExport => {
    const sessionAnalytics = analytics();
    const hpTimeline = sessionAnalytics.hpTimeline;
    const timeline = sessionAnalytics.timeline;

    // Find worst moment (lowest HP)
    const worstMomentIdx = hpTimeline.indexOf(Math.min(...hpTimeline));
    const worstMoment = timeline[worstMomentIdx] || timeline[0];

    // Find best moment (highest focus score)
    const bestMomentIdx = sessionAnalytics.focusTimeline.indexOf(Math.max(...sessionAnalytics.focusTimeline));
    const bestMoment = timeline[bestMomentIdx] || timeline[0];

    // Find critical events (state transitions to CRITICAL)
    const criticalEvents = stateTransitionsRef.current
      .filter((t) => t.state === "CRITICAL")
      .map((t) => ({
        timestamp: t.timestamp,
        violations: timeline.find((e) => e.timestamp === t.timestamp)?.violations || [],
      }));

    return {
      metadata: {
        courseId,
        userId,
        sessionId: sessionIdRef.current,
        timestamp: new Date(sessionAnalytics.startTime).toISOString(),
        duration: `${Math.round(sessionAnalytics.duration / 1000)}s`,
      },
      summary: {
        avgHP: sessionAnalytics.avgHP,
        finalHP: hpTimeline[hpTimeline.length - 1] || 100,
        avgFocus: sessionAnalytics.avgFocusScore,
        lockTime: sessionAnalytics.lockTime ? `${Math.round(sessionAnalytics.lockTime / 1000)}s` : null,
        achievements,
      },
      violations: sessionAnalytics.violations,
      highlights: {
        worstMoment: {
          timestamp: worstMoment.timestamp,
          hp: worstMoment.hp,
          violation: worstMoment.violations[0] || ("UNKNOWN" as ViolationType),
        },
        bestMoment: {
          timestamp: bestMoment.timestamp,
          hp: bestMoment.hp,
          focusScore: bestMoment.focusScore,
        },
        criticalEvents,
      },
    };
  }, [analytics, achievements, courseId, userId]);

  return {
    analytics,
    generateHeatmap,
    violationContributions,
    exportSession,
    sessionId: sessionIdRef.current,
  };
}
