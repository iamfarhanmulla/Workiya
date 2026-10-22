"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { setUser } from "@/store/authSlice";
import { api, getErrorMessage } from "@/lib/apiClient";

function EmailField({ value, onChange }) {
  const inputId = useId();
  return (
    <div className="wk-field">
      <label className="wk-label" htmlFor={inputId}>Work email</label>
      <div className="wk-input-wrap">
        <span className="material-symbols-outlined" aria-hidden="true">mail</span>
        <input
          id={inputId}
          className="wk-input wk-login-input"
          type="email"
          autoComplete="username"
          placeholder="name@company.com"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
      </div>
    </div>
  );
}

function PasswordField({ value, onChange }) {
  const inputId = useId();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="wk-field">
      <div className="wk-login-label-row">
        <label className="wk-label" htmlFor={inputId}>Password</label>
        {/* Placeholder until a forgot-password page exists. <Link> would change it to */}
        {/* client-side navigation, so the plain anchor is kept for now. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- placeholder link */}
        <a href="/">Forgot password?</a>
      </div>
      <div className="wk-input-wrap">
        <span className="material-symbols-outlined" aria-hidden="true">lock</span>
        <input
          id={inputId}
          className="wk-input wk-login-input wk-login-input--suffix"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Enter password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
        <span className="wk-input-suffix">
          <button
            type="button"
            className="wk-btn wk-btn--ghost wk-btn--icon wk-btn--sm"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((v) => !v)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </button>
        </span>
      </div>
    </div>
  );
}

function FormError({ message }) {
  if (!message) return null;
  return (
    <div className="wk-banner wk-banner--danger" role="alert">
      <span className="material-symbols-outlined" aria-hidden="true">error</span>
      <div>{message}</div>
    </div>
  );
}

export default function LoginForm() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password, rememberMe });
      dispatch(setUser(res.data.data.user));
      router.push("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err, "Login failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="wk-login-form" onSubmit={handleSubmit}>
      <FormError message={error} />

      <EmailField value={email} onChange={setEmail} />
      <PasswordField value={password} onChange={setPassword} />

      <label className="wk-check">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
        />
        Keep me signed in for 30 days
      </label>

      <button
        type="submit"
        className="wk-btn wk-btn--primary wk-btn--lg wk-btn--block"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
