import { ViolationType } from "./types";

/**
 * Point-in-time event snapshot during session
 */
export interface TimelineEvent {
  timestamp: number; // milliseconds from session start
  hp: number;
  focusScore: number;
  cognitiveLoad: number;
  violations: ViolationType[];
  state: "FOCUSED" | "WARNING" | "CRITICAL" | "LOCKED" | "FOCUSED_BUT_STRUGGLING";
}

/**
 * Aggregated violation statistics
 */
export interface ViolationStats {
  type: ViolationType;
  count: number; // total occurrences
  duration: number; // total milliseconds active
  firstOccurrence: number; // timestamp of first detection
  lastOccurrence: number; // timestamp of last detection
  avgHPDelta: number; // average HP lost per occurrence
  totalHPLoss: number; // cumulative HP lost from this violation
}

/**
 * Session-level analytics summary
 */
export interface SessionAnalytics {
  sessionId: string;
  startTime: number;
  endTime: number;
  duration: number; // milliseconds
  timeline: TimelineEvent[];
  violations: ViolationStats[];
  hpTimeline: number[]; // HP values over time
  focusTimeline: number[]; // focus scores over time
  avgHP: number;
  minHP: number;
  maxHP: number;
  avgFocusScore: number;
  lockTime: number | null; // when HP hit 0, or null if never
  criticalCount: number; // number of times entered CRITICAL state
  warningCount: number; // number of times entered WARNING state
  totalViolations: number;
  uniqueViolationTypes: Set<ViolationType>;
  hpDropTimestamps: Array<{ timestamp: number; magnitude: number; violation: ViolationType }>;
}

/**
 * Heatmap data: HP drops grouped by time buckets
 */
export interface EngagementHeatmap {
  buckets: Array<{
    timestamp: number; // bucket start time
    duration: number; // bucket duration (e.g., 5 seconds)
    severity: "low" | "medium" | "high"; // based on HP loss in bucket
    hpLoss: number;
    violations: ViolationType[];
  }>;
}

/**
 * Per-violation contribution to overall HP loss
 */
export interface ViolationContribution {
  violation: ViolationType;
  percentOfTotal: number;
  weight: number; // penalty value
  frequency: number;
}

/**
 * Export format for session data
 */
export interface SessionExport {
  metadata: {
    courseId: string;
    userId: string;
    sessionId: string;
    timestamp: string;
    duration: string;
  };
  summary: {
    avgHP: number;
    finalHP: number;
    avgFocus: number;
    lockTime: string | null;
    achievements: string[];
  };
  violations: ViolationStats[];
  highlights: {
    worstMoment: { timestamp: number; hp: number; violation: ViolationType };
    bestMoment: { timestamp: number; hp: number; focusScore: number };
    criticalEvents: Array<{ timestamp: number; violations: ViolationType[] }>;
  };
}
