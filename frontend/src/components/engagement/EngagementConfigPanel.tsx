/* eslint-disable react/forbid-dom-props */
import { memo, useState } from "react";
import {
  EngagementConfigService,
  useEngagementConfig,
} from "../../services/engagementConfig.service";
import { ViolationType } from "../../features/engagement/types";

/**
 * Configuration panel for adjusting HP engine behavior
 */
export const EngagementConfigPanel = memo(function EngagementConfigPanel() {
  const { config, preset, applyPreset, resetToDefault } = useEngagementConfig();
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [editedPenalties, setEditedPenalties] = useState<Record<ViolationType, number>>(config.penaltyMap);

  const handlePresetChange = (newPreset: "default" | "lenient" | "strict") => {
    applyPreset(newPreset);
  };

  const handlePenaltyChange = (violation: ViolationType, value: number) => {
    setEditedPenalties((prev) => ({ ...prev, [violation]: value }));
  };

  const handleApplyPenalties = () => {
    Object.entries(editedPenalties).forEach(([violation, penalty]) => {
      EngagementConfigService.updatePenalty(violation as ViolationType, penalty);
    });
  };

  const violationTypes: ViolationType[] = [
    "NO_FACE",
    "MULTIPLE_FACES",
    "LOOKING_AWAY",
    "HEAD_DOWN",
    "TALKING",
    "NOISE",
    "TAB_SWITCH",
    "INACTIVITY",
  ];

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Preset Selection */}
      <section className="card" style={{ padding: "1rem" }}>
        <h3 style={{ marginTop: 0, marginBottom: "0.8rem", fontFamily: "var(--font-heading)" }}>
          Configuration Presets
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.6rem" }}>
          {(["default", "lenient", "strict"] as const).map((p) => (
            <button
              key={p}
              onClick={() => handlePresetChange(p)}
              style={{
                border: preset === p ? "2px solid var(--primary)" : "1px solid var(--border)",
                borderRadius: 10,
                background: preset === p ? "var(--primary-soft)" : "transparent",
                color: preset === p ? "var(--primary)" : "var(--text)",
                padding: "0.7rem 0.9rem",
                cursor: "pointer",
                fontWeight: preset === p ? 600 : 500,
                transition: "all 200ms ease",
              }}
            >
              {p === "default" && "📊 Default (FDA)"}
              {p === "lenient" && "🤝 Lenient"}
              {p === "strict" && "⚖️ Strict"}
            </button>
          ))}
        </div>
        <p style={{ margin: "0.8rem 0 0", color: "var(--text-soft)", fontSize: 13 }}>
          {preset === "default" && "FDA-aligned fair enforcement with 7s mercy window"}
          {preset === "lenient" && "Forgiving for practice modules with 10s mercy and HP recovery"}
          {preset === "strict" && "High-stakes enforcement with 5s mercy and higher penalties"}
        </p>
      </section>

      {/* Core Settings */}
      <section className="card" style={{ padding: "1rem" }}>
        <h3 style={{ marginTop: 0, marginBottom: "0.8rem", fontFamily: "var(--font-heading)" }}>
          Core Parameters
        </h3>
        <div style={{ display: "grid", gap: "0.8rem" }}>
          <SettingRow
            label="Mercy Window"
            value={`${config.baseMercyMs / 1000}s`}
            description="Grace period before HP penalty applies"
            color="var(--primary)"
          />
          <SettingRow
            label="Max HP Loss/Tick"
            value={`${config.maxNegativeHpPerTick}`}
            description="Maximum HP decrease per second"
            color="var(--warning)"
          />
          <SettingRow
            label="Pre-Mercy Trigger"
            value={`${config.preeMercyThresholdMs / 1000}s`}
            description="Early warning penalty (50% value)"
            color="var(--primary)"
          />
          <SettingRow
            label="Escalation Multiplier"
            value={`${config.escalationMultiplier}×`}
            description="Penalty increase after 2× mercy window"
            color="var(--danger)"
          />
          <SettingRow
            label="HP Recovery"
            value={config.enableHPRecovery ? "✅ Enabled" : "❌ Disabled"}
            description="Allow automatic HP increase"
            color={config.enableHPRecovery ? "var(--success)" : "var(--text-soft)"}
          />
        </div>
      </section>

      {/* Advanced Penalty Tuning */}
      {isAdvanced && (
        <section className="card" style={{ padding: "1rem", border: "2px dashed var(--primary)" }}>
          <h3 style={{ marginTop: 0, marginBottom: "0.8rem", fontFamily: "var(--font-heading)" }}>
            ⚙️ Advanced: Penalty Values
          </h3>
          <p style={{ margin: "0 0 0.8rem", color: "var(--text-soft)", fontSize: 13 }}>
            Customize individual violation penalties. Changes apply immediately.
          </p>

          <div style={{ display: "grid", gap: "0.6rem" }}>
            {violationTypes.map((violation) => (
              <div key={violation} style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
                <label style={{ flex: "0 0 140px", fontWeight: 500 }}>{violation}</label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={editedPenalties[violation] || 0}
                  onChange={(e) => handlePenaltyChange(violation, Number(e.target.value))}
                  style={{ flex: "1 0 auto", maxWidth: 200 }}
                />
                <span
                  style={{
                    flex: "0 0 40px",
                    textAlign: "right",
                    fontWeight: 600,
                    color: "var(--primary)",
                  }}
                >
                  {editedPenalties[violation]}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleApplyPenalties}
            style={{
              marginTop: "1rem",
              border: "none",
              borderRadius: 8,
              background: "var(--primary)",
              color: "white",
              padding: "0.6rem 1rem",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ✓ Apply Custom Penalties
          </button>
        </section>
      )}

      {/* Toggle Advanced */}
      <button
        onClick={() => setIsAdvanced(!isAdvanced)}
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "transparent",
          color: "var(--primary)",
          padding: "0.5rem 0.9rem",
          cursor: "pointer",
          fontWeight: 500,
          fontSize: 13,
        }}
      >
        {isAdvanced ? "▼ Hide Advanced Settings" : "▶ Show Advanced Settings"}
      </button>

      {/* Reset Button */}
      <button
        onClick={resetToDefault}
        style={{
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          background: "var(--bg-subtle)",
          color: "var(--text-soft)",
          padding: "0.5rem 0.9rem",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        ↺ Reset to Factory Defaults
      </button>
    </div>
  );
});

interface SettingRowProps {
  label: string;
  value: string | number;
  description?: string;
  color?: string;
}

const SettingRow = memo(function SettingRow({ label, value, description, color }: SettingRowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.7rem",
        background: "var(--bg-subtle)",
        borderRadius: 8,
        borderLeft: `4px solid ${color || "var(--primary)"}`,
      }}
    >
      <div>
        <strong style={{ fontSize: 14 }}>{label}</strong>
        {description && (
          <p style={{ margin: "0.25rem 0 0", fontSize: 12, color: "var(--text-soft)" }}>{description}</p>
        )}
      </div>
      <div
        style={{
          fontSize: "1.2rem",
          fontWeight: 700,
          color: color || "var(--primary)",
          marginLeft: "1rem",
        }}
      >
        {value}
      </div>
    </div>
  );
});
