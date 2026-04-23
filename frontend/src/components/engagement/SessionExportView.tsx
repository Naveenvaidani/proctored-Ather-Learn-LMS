/* eslint-disable react/forbid-dom-props */
import { memo, useState } from "react";
import { SessionExport } from "../../features/engagement/analyticsTypes";
import { SessionExportService } from "../../services/sessionExport.service";

interface SessionExportViewProps {
  sessionData: SessionExport;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal allowing users to view and export session analytics
 */
export const SessionExportView = memo(function SessionExportView({
  sessionData,
  isOpen,
  onClose,
}: SessionExportViewProps) {
  const [selectedFormat, setSelectedFormat] = useState<"json" | "csv" | "html">("json");

  const handleExport = () => {
    let content: string;
    let mimeType: string;
    let filename: string;

    const timestamp = new Date(sessionData.metadata.timestamp).toISOString().split("T")[0];

    if (selectedFormat === "json") {
      content = SessionExportService.exportAsJSON(sessionData);
      mimeType = "application/json";
      filename = `session-${sessionData.metadata.sessionId}-${timestamp}.json`;
    } else if (selectedFormat === "csv") {
      content = SessionExportService.exportAsCSV(sessionData);
      mimeType = "text/csv";
      filename = `session-${sessionData.metadata.sessionId}-${timestamp}.csv`;
    } else {
      content = SessionExportService.generateHTMLReport(sessionData);
      mimeType = "text/html";
      filename = `session-${sessionData.metadata.sessionId}-${timestamp}.html`;
    }

    SessionExportService.downloadFile(content, filename, mimeType);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: 600,
          padding: "1.5rem",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: "1.2rem", fontFamily: "var(--font-heading)" }}>
          Export Session Data
        </h2>

        <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-subtle)", borderRadius: 10 }}>
          <h4 style={{ margin: "0 0 0.8rem 0", fontSize: 14 }}>Session Information</h4>
          <div style={{ display: "grid", gap: "0.5rem", fontSize: 13, color: "var(--text-soft)" }}>
            <p style={{ margin: 0 }}>
              <strong>Course:</strong> {sessionData.metadata.courseId}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Session ID:</strong> <code style={{ fontSize: 11 }}>{sessionData.metadata.sessionId}</code>
            </p>
            <p style={{ margin: 0 }}>
              <strong>Duration:</strong> {sessionData.metadata.duration}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Final HP:</strong> {sessionData.summary.finalHP}/100
            </p>
            <p style={{ margin: 0 }}>
              <strong>Focus Score:</strong> {(sessionData.summary.avgFocus * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.8rem", fontWeight: 600 }}>Export Format</label>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {(["json", "csv", "html"] as const).map((format) => (
              <label key={format} style={{ display: "flex", gap: "0.6rem", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="export-format"
                  value={format}
                  checked={selectedFormat === format}
                  onChange={() => setSelectedFormat(format)}
                />
                <span style={{ textTransform: "uppercase", fontWeight: 500 }}>
                  {format}
                  {format === "json" && " (machine-readable)"}
                  {format === "csv" && " (spreadsheet-compatible)"}
                  {format === "html" && " (formatted report)"}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.8rem", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text)",
              padding: "0.6rem 1rem",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            style={{
              border: "none",
              borderRadius: 8,
              background: "var(--primary)",
              color: "white",
              padding: "0.6rem 1.2rem",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ⬇ Download {selectedFormat.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
});

interface ExportButtonProps {
  sessionData: SessionExport;
}

/**
 * Simple button to trigger export modal
 */
export function ExportButton({ sessionData }: ExportButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={{
          border: "1px solid var(--primary)",
          borderRadius: 8,
          background: "var(--primary)",
          color: "white",
          padding: "0.5rem 0.9rem",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        ⬇ Export Session
      </button>
      <SessionExportView
        sessionData={sessionData}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
