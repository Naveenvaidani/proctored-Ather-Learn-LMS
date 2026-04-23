import { SessionExport } from "../features/engagement/analyticsTypes";

/**
 * Service for exporting session data in multiple formats
 */
export class SessionExportService {
  /**
   * Export session data as JSON
   */
  static exportAsJSON(data: SessionExport): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export session data as CSV
   */
  static exportAsCSV(data: SessionExport): string {
    const lines: string[] = [];

    // Metadata section
    lines.push("# SESSION METADATA");
    lines.push(`Course ID,${data.metadata.courseId}`);
    lines.push(`User ID,${data.metadata.userId}`);
    lines.push(`Session ID,${data.metadata.sessionId}`);
    lines.push(`Timestamp,${data.metadata.timestamp}`);
    lines.push(`Duration,${data.metadata.duration}`);
    lines.push("");

    // Summary section
    lines.push("# SUMMARY");
    lines.push(`Average HP,${data.summary.avgHP}`);
    lines.push(`Final HP,${data.summary.finalHP}`);
    lines.push(`Average Focus,${data.summary.avgFocus}`);
    lines.push(`Lock Time,${data.summary.lockTime || "N/A"}`);
    lines.push(`Achievements,"${data.summary.achievements.join("; ")}"`);
    lines.push("");

    // Violations section
    lines.push("# VIOLATIONS");
    lines.push('Violation Type,Occurrences,Duration (ms),First Recorded (ms),Last Recorded (ms),Avg HP Loss,Total HP Loss');
    data.violations.forEach((v) => {
      lines.push(
        `${v.type},${v.count},${v.duration},${v.firstOccurrence},${v.lastOccurrence},${v.avgHPDelta.toFixed(2)},${v.totalHPLoss}`
      );
    });
    lines.push("");

    // Highlights section
    lines.push("# HIGHLIGHTS");
    lines.push(`Worst Moment Timestamp (ms),${data.highlights.worstMoment.timestamp}`);
    lines.push(`Worst Moment HP,${data.highlights.worstMoment.hp}`);
    lines.push(`Worst Moment Violation,${data.highlights.worstMoment.violation}`);
    lines.push(`Best Moment Timestamp (ms),${data.highlights.bestMoment.timestamp}`);
    lines.push(`Best Moment HP,${data.highlights.bestMoment.hp}`);
    lines.push(`Best Moment Focus Score,${data.highlights.bestMoment.focusScore}`);

    return lines.join("\n");
  }

  /**
   * Download export as file
   */
  static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate human-readable session report
   */
  static generateHTMLReport(data: SessionExport): string {
    const statusColor = (hp: number) => {
      if (hp > 70) return "#22c55e"; // green
      if (hp > 40) return "#f59e0b"; // orange
      return "#ef4444"; // red
    };

    const focusColor = (focus: number) => {
      if (focus > 0.7) return "#22c55e";
      if (focus > 0.5) return "#f59e0b";
      return "#ef4444";
    };

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Session Report - ${data.metadata.sessionId}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 2rem; color: #333; }
            h1 { color: #1f2937; }
            h2 { color: #374151; margin-top: 2rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
            .card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
            .metric { display: inline-block; margin: 1rem 1.5rem 1rem 0; }
            .metric-value { font-size: 2rem; font-weight: bold; color:  #1f2937; }
            .metric-label { font-size: 0.875rem; color: #6b7280; }
            .status-good { color: #22c55e; }
            .status-warning { color: #f59e0b; }
            .status-critical { color: #ef4444; }
            table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
            th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #e5e7eb; }
            th { background: #f3f4f6; font-weight: 600; }
            .violation-high { background: #fee2e2; }
            .violation-medium { background: #fef3c7; }
            .violation-low { background: #d1fae5; }
          </style>
        </head>
        <body>
          <h1>Learning Session Report</h1>
          <div class="card">
            <p><strong>Session ID:</strong> ${data.metadata.sessionId}</p>
            <p><strong>Course:</strong> ${data.metadata.courseId}</p>
            <p><strong>Timestamp:</strong> ${data.metadata.timestamp}</p>
            <p><strong>Duration:</strong> ${data.metadata.duration}</p>
          </div>

          <h2>Performance Summary</h2>
          <div class="card">
            <div class="metric">
              <div class="metric-label">Average HP</div>
              <div class="metric-value" style="color: ${statusColor(data.summary.avgHP)}">${data.summary.avgHP}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Final HP</div>
              <div class="metric-value" style="color: ${statusColor(data.summary.finalHP)}">${data.summary.finalHP}</div>
            </div>
            <div class="metric">
              <div class="metric-label">Focus Score</div>
              <div class="metric-value" style="color: ${focusColor(data.summary.avgFocus)}">${(data.summary.avgFocus * 100).toFixed(0)}%</div>
            </div>
            <div class="metric">
              <div class="metric-label">Session Status</div>
              <div class="metric-value${data.summary.lockTime ? ' status-critical' : ' status-good'}">
                ${data.summary.lockTime ? '❌ LOCKED' : '✅ ACTIVE'}
              </div>
            </div>
          </div>

          <h2>Violations & Anomalies</h2>
          <div class="card">
            <table>
              <thead>
                <tr>
                  <th>Anomaly Type</th>
                  <th>Count</th>
                  <th>Total Duration</th>
                  <th>Avg HP Loss</th>
                  <th>Total HP Loss</th>
                </tr>
              </thead>
              <tbody>
                ${data.violations
                  .sort((a, b) => b.totalHPLoss - a.totalHPLoss)
                  .map((v) => {
                    let rowClass = "violation-low";
                    if (v.totalHPLoss > 40) rowClass = "violation-high";
                    else if (v.totalHPLoss > 15) rowClass = "violation-medium";
                    return `
                      <tr class="${rowClass}">
                        <td><strong>${v.type}</strong></td>
                        <td>${v.count}</td>
                        <td>${(v.duration / 1000).toFixed(1)}s</td>
                        <td>${v.avgHPDelta.toFixed(1)}</td>
                        <td><strong>-${Math.round(v.totalHPLoss)}</strong></td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>

          <h2>Key Events</h2>
          <div class="card">
            <h3>Worst Moment</h3>
            <p>
              <strong>Time:</strong> ${(data.highlights.worstMoment.timestamp / 1000).toFixed(1)}s<br/>
              <strong>HP:</strong> ${data.highlights.worstMoment.hp}<br/>
              <strong>Trigger:</strong> ${data.highlights.worstMoment.violation}
            </p>

            <h3>Best Moment</h3>
            <p>
              <strong>Time:</strong> ${(data.highlights.bestMoment.timestamp / 1000).toFixed(1)}s<br/>
              <strong>HP:</strong> ${data.highlights.bestMoment.hp}<br/>
              <strong>Focus Score:</strong> ${(data.highlights.bestMoment.focusScore * 100).toFixed(0)}%
            </p>

            ${
              data.highlights.criticalEvents.length > 0
                ? `
              <h3>Critical Events (${data.highlights.criticalEvents.length})</h3>
              <ul>
                ${data.highlights.criticalEvents
                  .map(
                    (e) =>
                      `<li>At ${(e.timestamp / 1000).toFixed(1)}s: ${e.violations.join(", ")}</li>`
                  )
                  .join("")}
              </ul>
            `
                : ""
            }
          </div>

          <h2>Achievements</h2>
          <div class="card">
            ${
              data.summary.achievements.length > 0
                ? `<ul>
              ${data.summary.achievements.map((a) => `<li>🏆 ${a}</li>`).join("")}
            </ul>`
                : "<p>No achievements unlocked this session.</p>"
            }
          </div>

          <hr style="margin: 2rem 0; border: none; border-top: 2px solid #e5e7eb;" />
          <p style="color: #9ca3af; font-size: 0.875rem;">
            Generated on ${new Date().toLocaleString()} | Aether Learn Analytics
          </p>
        </body>
      </html>
    `;
  }
}
