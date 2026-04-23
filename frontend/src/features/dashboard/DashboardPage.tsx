/* eslint-disable */
/* eslint-disable react/forbid-dom-props */
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { fetchDashboard } from "../../services/learning.service";
import { toPercent } from "../../utils/format";

const architectureMandates = [
  "Monorepo with shared contracts",
  "13+ modular backend domains",
  "React 19 + Vite SPA",
  "Type safety across all API boundaries",
  "Dependency injection in backend",
  "Repository pattern for database access",
  "Security-first validation and authorization",
  "Observability with Sentry and structured logs",
];

const moduleMap = [
  "auth",
  "users",
  "courses",
  "quizzes",
  "genAI",
  "anomalies",
  "courseRegistration",
  "notifications",
  "auditTrails",
  "announcements",
  "projects",
  "reports",
  "setting",
];

const phases = [
  {
    id: "P1",
    name: "Foundation",
    timeline: "Weeks 1-4",
    summary: "Auth, roles, course CRUD, enrollment, and stable staging deployment.",
  },
  {
    id: "P2",
    name: "Assessment",
    timeline: "Weeks 5-8",
    summary: "AI quiz generation, grading, and instant learner feedback loops.",
  },
  {
    id: "P3",
    name: "Integrity",
    timeline: "Weeks 9-12",
    summary: "Proctoring, anomaly signals, and submission review workflows.",
  },
  {
    id: "P4",
    name: "Scale & Polish",
    timeline: "Weeks 13-16",
    summary: "Performance hardening, testing depth, and production reliability.",
  },
];

const fallback = {
  greeting: "Welcome to ViBe Control Center",
  recommendations: [
    "Keep backend and frontend health green before learner sessions.",
    "Use AI quiz generation after video completion for active recall.",
    "Review integrity flags in proctoring before publishing grades."
  ],
  courses: [
    { id: "1", title: "Applied Algorithms", progress: 68, activeModule: "Recurrence & Divide-Conquer" },
    { id: "2", title: "Systems Thinking", progress: 41, activeModule: "Latency and Throughput" }
  ]
};

export default function DashboardPage() {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboard, retry: false });
  const payload = data ?? fallback;

  return (
    <section className="page-grid">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="card" style={{ padding: "1.25rem" }}>
        <h1 style={{ margin: 0, fontFamily: "var(--font-heading)" }}>{payload.greeting}</h1>
        <p style={{ color: "var(--text-soft)", marginBottom: 0 }}>
          Production-grade Aether Learn experience for students, teachers, and admins.
        </p>
      </motion.div>

      <div className="page-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        <MetricCard title="Uptime Target" value="99.9%" subtitle="Operational reliability goal" />
        <MetricCard title="Concurrency Target" value="1000+" subtitle="Concurrent active learners" />
        <MetricCard title="Backend Domains" value="13" subtitle="Pluggable modules" />
        <MetricCard title="Type Safety" value="Strict" subtitle="Frontend + backend contracts" />
      </div>

      <div className="card" style={{ padding: "1rem" }}>
        <h2 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>Architectural Mandates</h2>
        <div className="page-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {architectureMandates.map((mandate) => (
            <div key={mandate} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "0.75rem", display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
              <span style={{ color: "var(--success)", fontWeight: 700 }}>✓</span>
              <span style={{ color: "var(--text-soft)" }}>{mandate}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="page-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {payload.courses.map((course, idx) => (
          <motion.article
            key={course.id}
            className="card"
            style={{ padding: "1rem" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: idx * 0.06 }}
          >
            <h3 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>{course.title}</h3>
            <p style={{ color: "var(--text-soft)", marginTop: 0 }}>{course.activeModule}</p>
            <div style={{ height: 8, borderRadius: 999, background: "var(--bg-subtle)", overflow: "hidden" }}>
              <div style={{ width: `${course.progress}%`, height: "100%", background: "var(--primary)" }} />
            </div>
            <p style={{ marginBottom: 0, color: "var(--text-soft)" }}>Progress {toPercent(course.progress)}</p>
            <Link to={`/course/${course.id}`} style={{ color: "var(--primary)", display: "inline-block", marginTop: "0.6rem" }}>Continue</Link>
          </motion.article>
        ))}
      </div>

      <div className="card" style={{ padding: "1rem" }}>
        <h2 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>Module Architecture Map</h2>
        <p style={{ color: "var(--text-soft)", marginTop: 0 }}>Bounded domain modules that can be switched by environment flags.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
          {moduleMap.map((moduleName) => (
            <span key={moduleName} style={{ border: "1px solid var(--border)", borderRadius: 999, padding: "0.3rem 0.7rem", color: "var(--text-soft)" }}>
              {moduleName}
            </span>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: "1rem" }}>
        <h2 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>Implementation Phases</h2>
        <div className="page-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {phases.map((phase) => (
            <article key={phase.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "0.75rem" }}>
              <div style={{ color: "var(--primary)", fontWeight: 700 }}>{phase.id}</div>
              <h3 style={{ margin: "0.2rem 0", fontFamily: "var(--font-heading)" }}>{phase.name}</h3>
              <div style={{ color: "var(--text-soft)", fontSize: 13 }}>{phase.timeline}</div>
              <p style={{ marginBottom: 0, color: "var(--text-soft)" }}>{phase.summary}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="page-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Link className="card" to="/quiz/live" style={{ padding: "0.9rem", textDecoration: "none", color: "inherit" }}>
          <h3 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>AI Quiz Builder</h3>
          <p style={{ marginBottom: 0, color: "var(--text-soft)" }}>Generate quiz automatically after video completion.</p>
        </Link>
        <Link className="card" to="/proctoring" style={{ padding: "0.9rem", textDecoration: "none", color: "inherit" }}>
          <h3 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>Integrity Monitor</h3>
          <p style={{ marginBottom: 0, color: "var(--text-soft)" }}>Track facial, focus, and anomaly signals during assessments.</p>
        </Link>
        <Link className="card" to="/results" style={{ padding: "0.9rem", textDecoration: "none", color: "inherit" }}>
          <h3 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>Outcome Analytics</h3>
          <p style={{ marginBottom: 0, color: "var(--text-soft)" }}>Review score, behavior flags, and learning progression.</p>
        </Link>
      </div>

      <div className="card" style={{ padding: "1rem" }}>
        <h2 style={{ marginTop: 0, fontFamily: "var(--font-heading)" }}>Smart Recommendations</h2>
        <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--text-soft)" }}>
          {payload.recommendations.map((tip) => (
            <li key={tip} style={{ marginBottom: "0.45rem" }}>{tip}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <article className="card" style={{ padding: "0.9rem" }}>
      <p style={{ margin: 0, color: "var(--text-soft)" }}>{title}</p>
      <h3 style={{ margin: "0.25rem 0", fontFamily: "var(--font-heading)", fontSize: "1.35rem" }}>{value}</h3>
      <p style={{ marginBottom: 0, color: "var(--text-soft)" }}>{subtitle}</p>
    </article>
  );
}


