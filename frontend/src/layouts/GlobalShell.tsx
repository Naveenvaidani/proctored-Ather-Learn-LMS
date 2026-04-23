/* eslint-disable */
/* eslint-disable react/forbid-dom-props */
import { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import { ThemeToggle } from "../components/ThemeToggle";
import { useUiStore } from "../store/ui-store";

const links = [
  { to: "/course/1", label: "Course Studio" },
  { to: "/proctoring", label: "Pulse Engine" },
  { to: "/results", label: "Analytics" }
];

export function GlobalShell({ children }: PropsWithChildren) {
  const focusMode = useUiStore((s) => s.focusMode);
  const setFocusMode = useUiStore((s) => s.setFocusMode);

  return (
    <div className="app-shell">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26 }}
        className="card"
        style={{
          display: "grid",
          gap: "0.85rem",
          padding: "0.85rem 1rem",
          marginBottom: "1rem"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <button
              onClick={() => setFocusMode(!focusMode)}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 999,
                background: focusMode ? "var(--primary-soft)" : "transparent",
                color: focusMode ? "var(--primary)" : "var(--text-soft)",
                padding: "0.45rem 0.9rem",
                cursor: "pointer"
              }}
            >
              {focusMode ? "Focus On" : "Focus Off"}
            </button>
            <ThemeToggle />
          </div>
        </div>
        {!focusMode && (
          <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                style={({ isActive }) => ({
                  padding: "0.44rem 0.75rem",
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: isActive ? "var(--primary-soft)" : "transparent",
                  color: isActive ? "var(--primary)" : "var(--text-soft)",
                  fontSize: ".9rem"
                })}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}
      </motion.header>
      {children}
    </div>
  );
}


