"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { setUser } from "@/store/authSlice";
import { api, getErrorMessage } from "@/lib/apiClient";
import { ArrowRight, Lock, Mail } from "@/components/marketing/icons";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
export const MISSING_MESSAGE = "Enter your work email and password.";
const NO_FIELDS_BAD = { email: false, password: false };

const EYE_OPEN = (
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>
);
const EYE_SHUT = (
  <>
    <path d={"M3 3l18 18M10.6 6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8"
      + "M6.6 6.9C4 8.6 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.2-1"}
    />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </>
);

function Alert({ message }) {
  if (!message) return null;
  return (
    <div className="alert" role="alert">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5v.01" strokeLinecap="round" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

function EmailField({ value, onChange, bad }) {
  const id = useId();
  return (
    <div className={`field rise${bad ? " bad" : ""}`} style={{ "--i": 3 }}>
      <label className="lbl" htmlFor={id}>Work email</label>
      <div className="input">
        <Mail className="ic" />
        <input
          id={id}
          type="email"
          autoComplete="username"
          placeholder="name@company.com"
          value={value}
          aria-invalid={bad || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function EyeButton({ show, onToggle }) {
  return (
    <button
      className="eye"
      type="button"
      aria-label={show ? "Hide password" : "Show password"}
      onClick={onToggle}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {show ? EYE_SHUT : EYE_OPEN}
      </svg>
    </button>
  );
}

function PasswordField({ value, onChange, bad }) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className={`field rise${bad ? " bad" : ""}`} style={{ "--i": 4 }}>
      <div className="label-row">
        <label className="lbl" htmlFor={id}>Password</label>
        {/* Placeholder until a password reset flow exists (only admins can reset today). */}
        <Link className="link" href="/login">Forgot password?</Link>
      </div>
      <div className="input">
        <Lock className="ic" width={1.8} />
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Enter your password"
          value={value}
          aria-invalid={bad || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <EyeButton show={show} onToggle={() => setShow((v) => !v)} />
      </div>
    </div>
  );
}

function RememberMe({ checked, onChange }) {
  return (
    <div className="remember rise" style={{ "--i": 5 }}>
      <label className="check">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="box">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m2.5 7.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        Keep me signed in
      </label>
    </div>
  );
}

function SubmitButton({ status }) {
  const className = ["btn", status === "loading" && "loading", status === "done" && "done"]
    .filter(Boolean).join(" ");
  return (
    <button
      className={className}
      type="submit"
      disabled={status !== "idle"}
      aria-busy={status === "loading"}
    >
      <svg className="ok" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6">
        <path d="m5 12.5 4.5 4.5L19 7.5" pathLength="30" strokeLinecap="round" />
      </svg>
      <span className="txt">{status === "done" ? "Signed in" : "Sign in"}</span>
      <ArrowRight />
      <span className="spin" aria-hidden="true" />
    </button>
  );
}

// Which fields to flag before calling the API: empty ones, and an email that isn't one.
function findMissing(email, password) {
  return {
    email: !EMAIL_PATTERN.test(email.trim()),
    password: !password,
  };
}

// Checks the fields, then signs in and opens the dashboard.
function useLoginSubmit({ email, password, rememberMe }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [bad, setBad] = useState(NO_FIELDS_BAD);

  async function submit(e) {
    e.preventDefault();
    const missing = findMissing(email, password);
    // Clear first so a second failed try shakes the fields again.
    setBad(NO_FIELDS_BAD);
    if (missing.email || missing.password) {
      setError(MISSING_MESSAGE);
      requestAnimationFrame(() => setBad(missing));
      return;
    }
    setError("");
    setStatus("loading");
    try {
      const res = await api.post("/auth/login", { email: email.trim(), password, rememberMe });
      dispatch(setUser(res.data.data.user));
      setStatus("done");
      router.push("/dashboard");
    } catch (err) {
      setStatus("idle");
      setError(getErrorMessage(err, "Login failed. Please try again."));
    }
  }

  return {
    status, error, bad, submit,
  };
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const {
    status, error, bad, submit,
  } = useLoginSubmit({ email, password, rememberMe });

  return (
    <form onSubmit={submit} noValidate>
      <Alert message={error} />
      <EmailField value={email} onChange={setEmail} bad={bad.email} />
      <PasswordField value={password} onChange={setPassword} bad={bad.password} />
      <RememberMe checked={rememberMe} onChange={setRememberMe} />
      <div className="rise" style={{ "--i": 6 }}>
        <SubmitButton status={status} />
      </div>
    </form>
  );
}
