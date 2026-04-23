/* eslint-disable */
/* eslint-disable react/forbid-dom-props */
import { useThemeStore } from "../themes/theme";

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div style={{ display: "flex", gap: "0.4rem", padding: "0.2rem", border: "1px solid var(--border)", borderRadius: "999px" }}>
      {(["light", "dark", "system"] as const).map((option) => (
        <button
          key={option}
          onClick={() => setMode(option)}
          style={{
            border: 0,
            borderRadius: "999px",
            padding: "0.35rem 0.75rem",
            background: mode === option ? "var(--primary-soft)" : "transparent",
            color: mode === option ? "var(--primary)" : "var(--text-soft)",
            cursor: "pointer"
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}


