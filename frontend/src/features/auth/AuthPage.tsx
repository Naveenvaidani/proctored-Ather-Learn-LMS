/* eslint-disable */
/* eslint-disable react/forbid-dom-props */
import { FormEvent, type CSSProperties, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { login, signup } from "../../services/auth.service";
import { useSessionStore } from "../../store/session-store";

const DEV_RECAPTCHA_TOKEN = "dev-recaptcha-bypass";

export default function AuthPage() {
  const navigate = useNavigate();
  const setSession = useSessionStore((s) => s.setSession);
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!isSignup) {
        return login({
          email,
          password,
          recaptchaToken: DEV_RECAPTCHA_TOKEN
        });
      }

      const [firstName, ...rest] = name.trim().split(" ");
      const lastName = rest.join(" ") || undefined;

      return signup({
        firstName: firstName || "Learner",
        lastName,
        email,
        password,
        recaptchaToken: DEV_RECAPTCHA_TOKEN
      });
    },
    onSuccess: (data) => {
      setSession(data.token, data.user);
      navigate("/dashboard");
    }
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className="page-grid">
      <div className="card" style={{ padding: "2rem", maxWidth: 520, margin: "0 auto", width: "100%" }}>
        <h1 style={{ fontFamily: "var(--font-heading)", marginTop: 0 }}>{isSignup ? "Create your Aether account" : "Welcome back"}</h1>
        <p style={{ color: "var(--text-soft)", marginTop: 0 }}>Minimal friction, maximum security.</p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.8rem" }}>
          {isSignup && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required style={inputStyle} />
          )}
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" required style={inputStyle} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" required style={inputStyle} />
          <button type="submit" disabled={mutation.isPending} style={primaryBtn}>
            {mutation.isPending ? "Authenticating..." : isSignup ? "Sign up" : "Login"}
          </button>
        </form>
        {mutation.error && <p style={{ color: "var(--danger)", marginBottom: 0 }}>{(mutation.error as Error).message}</p>}
        <button onClick={() => setIsSignup(!isSignup)} style={ghostBtn}>
          {isSignup ? "Already have an account? Login" : "Need an account? Sign up"}
        </button>
      </div>
    </motion.section>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  padding: "0.75rem 0.85rem"
};

const primaryBtn: CSSProperties = {
  borderRadius: 12,
  border: "1px solid transparent",
  background: "var(--primary)",
  color: "white",
  padding: "0.8rem 1rem",
  cursor: "pointer",
  fontWeight: 600
};

const ghostBtn: CSSProperties = {
  marginTop: "0.8rem",
  border: "none",
  background: "transparent",
  color: "var(--text-soft)",
  cursor: "pointer",
  padding: 0
};


