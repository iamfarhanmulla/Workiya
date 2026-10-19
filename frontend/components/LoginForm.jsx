"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { setUser } from "@/store/authSlice";
import { api, getErrorMessage } from "@/lib/apiClient";

const EmailIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 7.75A2.75 2.75 0 0 1 6.75 5h10.5A2.75 2.75 0 0 1 20 7.75v8.5A2.75 2.75 0 0 1 17.25 19H6.75A2.75 2.75 0 0 1 4 16.25v-8.5Zm2.21-1.25 5.33 4.26a.75.75 0 0 0 .92 0l5.33-4.26H6.21Zm12.29 1.92-4.77 3.81a2.25 2.25 0 0 1-2.81 0L5.5 8.42v7.83c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V8.42Z"
      fill="currentColor"
    />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M7.75 10V8.5a4.25 4.25 0 1 1 8.5 0V10h.5A2.25 2.25 0 0 1 19 12.25v6.5A2.25 2.25 0 0 1 16.75 21h-9.5A2.25 2.25 0 0 1 5 18.75v-6.5A2.25 2.25 0 0 1 7.25 10h.5Zm1.5 0h5.5V8.5a2.75 2.75 0 1 0-5.5 0V10Zm-2 2.25v6.5c0 .41.34.75.75.75h8.5c.41 0 .75-.34.75-.75v-6.5a.75.75 0 0 0-.75-.75h-8.5a.75.75 0 0 0-.75.75Zm4.75 1.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Z"
      fill="currentColor"
    />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 6c4.94 0 8.28 4.34 9.43 5.98a.75.75 0 0 1 0 .84C20.28 14.46 16.94 18.8 12 18.8S3.72 14.46 2.57 12.82a.75.75 0 0 1 0-.84C3.72 10.34 7.06 6 12 6Zm0 1.5c-3.83 0-6.67 3.24-7.86 4.9 1.19 1.67 4.03 4.9 7.86 4.9 3.83 0 6.67-3.23 7.86-4.9-1.19-1.66-4.03-4.9-7.86-4.9Zm0 1.8a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2Zm0 1.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z"
      fill="currentColor"
    />
  </svg>
);

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M13.22 5.97a.75.75 0 0 1 1.06 0l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06l3.97-3.97H5a.75.75 0 0 1 0-1.5h12.19l-3.97-3.97a.75.75 0 0 1 0-1.06Z"
      fill="currentColor"
    />
  </svg>
);

function EmailField({ value, onChange }) {
  return (
    <label className="field">
      <span>Email Address</span>
      <div className="input-shell">
        <EmailIcon />
        <input
          type="email"
          placeholder="name@company.com"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
      </div>
    </label>
  );
}

function PasswordField({ value, onChange }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <label className="field">
      <div className="field-heading">
        <span>Password</span>
        <a href="/">Forgot password?</a>
      </div>
      <div className="input-shell">
        <LockIcon />
        <input
          type={showPassword ? "text" : "password"}
          placeholder="********"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
        <button
          type="button"
          className="icon-button"
          aria-label="Show password"
          onClick={() => setShowPassword((v) => !v)}
        >
          <EyeIcon />
        </button>
      </div>
    </label>
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
    <form className="login-form" onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}

      <EmailField value={email} onChange={setEmail} />
      <PasswordField value={password} onChange={setPassword} />

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
        />
        <span>Keep me signed in for 30 days</span>
      </label>

      <button type="submit" className="submit-button" disabled={loading}>
        <span>{loading ? "Signing in..." : "Sign In"}</span>
        {!loading && <ArrowIcon />}
      </button>
    </form>
  );
}
