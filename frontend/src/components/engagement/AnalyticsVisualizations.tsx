/* eslint-disable react/forbid-dom-props */
import { memo } from "react";
import { TimelineEvent } from "../../features/engagement/analyticsTypes";

interface HPTimelineProps {
  timeline: TimelineEvent[];
  width?: number;
  height?: number;
}

/**
 * Visual timeline of HP changes over session
 * Shows HP trajectory with state transitions
 */
export const HPTimeline = memo(function HPTimeline({
  timeline,
  width = 600,
  height = 180,
}: HPTimelineProps) {
  if (!timeline || timeline.length === 0) {
    return <div style={{ padding: "1rem", color: "var(--text-soft)" }}>No data available</div>;
  }

  const padding = { top: 20, right: 40, bottom: 30, left: 50 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const maxTime = timeline[timeline.length - 1].timestamp;
  const minHP = Math.min(...timeline.map((e) => e.hp));
  const maxHP = Math.max(...timeline.map((e) => e.hp));

  const yScale = (hp: number) => innerHeight - ((hp - minHP) / (maxHP - minHP || 1)) * innerHeight;
  const xScale = (timestamp: number) => (timestamp / maxTime) * innerWidth;

  const points = timeline
    .map((event) => `${padding.left + xScale(event.timestamp)},${padding.top + yScale(event.hp)}`)
    .join(" ");

  // Color state transitions
  const stateColors: Record<string, string> = {
    FOCUSED: "var(--success)",
    WARNING: "var(--warning)",
    CRITICAL: "var(--danger)",
    LOCKED: "var(--danger)",
  };

  return (
    <svg width={width} height={height} style={{ border: "1px solid var(--border)", borderRadius: 10 }}>
      {/* Grid lines */}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="var(--border)" strokeWidth="1" />
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--border)" strokeWidth="1" />

      {/* HP curve */}
      <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="2" />

      {/* State regions */}
      {timeline.map((event, idx) => {
        if (idx === 0 || event.state !== timeline[idx - 1]?.state) {
          const x = padding.left + xScale(event.timestamp);
          const color = stateColors[event.state] || "var(--text-soft)";
          return (
            <g key={idx}>
              <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke={color} strokeWidth="1" strokeDasharray="4" opacity="0.4" />
              <text x={x + 5} y={15} fontSize="11" fill={color} opacity="0.7">
                {event.state}
              </text>
            </g>
          );
        }
        return null;
      })}

      {/* Axis labels */}
      <text x={padding.left - 10} y={padding.top - 5} fontSize="12" fill="var(--text-soft)" textAnchor="end">
        {maxHP}
      </text>
      <text x={padding.left - 10} y={height - padding.bottom + 15} fontSize="12" fill="var(--text-soft)" textAnchor="end">
        {minHP}
      </text>
      <text x={width - 30} y={height - 5} fontSize="12" fill="var(--text-soft)">
        {Math.round(maxTime / 1000)}s
      </text>
    </svg>
  );
});

interface EngagementHeatmapProps {
  buckets: Array<{
    timestamp: number;
    severity: "low" | "medium" | "high";
    hpLoss: number;
  }>;
  width?: number;
}

/**
 * Heatmap showing engagement risk periods (HP loss per time bucket)
 */
export const EngagementHeatmapVisualization = memo(function EngagementHeatmapVisualization({
  buckets,
  width = 800,
}: EngagementHeatmapProps) {
  if (!buckets || buckets.length === 0) {
    return <div style={{ padding: "1rem", color: "var(--text-soft)" }}>No heatmap data</div>;
  }

  const bucketWidth = Math.max(8, width / buckets.length);
  const maxHpLoss = Math.max(...buckets.map((b) => b.hpLoss), 1);

  const severityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "var(--danger)";
      case "medium":
        return "var(--warning)";
      default:
        return "var(--success)";
    }
  };

  return (
    <div style={{ display: "flex", gap: "2px", alignItems: "flex-end", height: 120, background: "var(--bg-subtle)", padding: "1rem", borderRadius: 10, overflow: "auto" }}>
      {buckets.map((bucket, idx) => (
        <div
          key={idx}
          style={{
            flex: "0 0 auto",
            width: bucketWidth,
            height: `${Math.max(8, (bucket.hpLoss / maxHpLoss) * 100)}%`,
            background: severityColor(bucket.severity),
            borderRadius: 2,
            opacity: 0.8,
          }}
          title={`Bucket ${idx}: -${Math.round(bucket.hpLoss)} HP`}
        />
      ))}
    </div>
  );
});

interface FocusScoreTrendProps {
  focusTimeline: number[];
  width?: number;
  height?: number;
}

/**
 * Mini line graph showing focus score trends
 */
export const FocusScoreTrend = memo(function FocusScoreTrend({
  focusTimeline,
  width = 300,
  height = 120,
}: FocusScoreTrendProps) {
  if (!focusTimeline || focusTimeline.length === 0) {
    return <div style={{ padding: "0.5rem", color: "var(--text-soft)" }}>No focus data</div>;
  }

  const padding = 10;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const xScale = (idx: number) => (idx / (focusTimeline.length - 1 || 1)) * innerWidth;
  const yScale = (score: number) => innerHeight - score * innerHeight;

  const points = focusTimeline
    .map((score, idx) => `${padding + xScale(idx)},${padding + yScale(score)}`)
    .join(" ");

  return (
    <svg width={width} height={height} style={{ border: "1px solid var(--border)", borderRadius: 8 }}>
      <rect x={0} y={0} width={width} height={height} fill="var(--bg-subtle)" />
      <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="2" opacity="0.7" />
    </svg>
  );
});
