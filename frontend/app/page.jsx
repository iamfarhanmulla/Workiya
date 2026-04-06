import TestimonialSlider from "@/components/TestimonialSlider";
import LoginForm from "@/components/LoginForm";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21.8 12.23c0-.76-.07-1.5-.2-2.2H12v4.16h5.49a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.05-4.4 3.05-7.6Z" fill="#4285F4" />
    <path d="M12 22c2.76 0 5.08-.91 6.77-2.47l-3.3-2.56c-.91.61-2.08.97-3.47.97-2.67 0-4.94-1.8-5.75-4.22H2.84v2.64A10 10 0 0 0 12 22Z" fill="#34A853" />
    <path d="M6.25 13.72A5.97 5.97 0 0 1 5.93 12c0-.6.11-1.18.32-1.72V7.64H2.84a10 10 0 0 0 0 8.72l3.41-2.64Z" fill="#FBBC04" />
    <path d="M12 6.06c1.5 0 2.85.52 3.91 1.53l2.93-2.93C17.07 2.99 14.76 2 12 2A10 10 0 0 0 2.84 7.64l3.41 2.64c.81-2.42 3.08-4.22 5.75-4.22Z" fill="#EA4335" />
  </svg>
);

const WorkiyaBrandIcon = () => (
  <div className="brand-mark-inner">
    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>work</span>
  </div>
);

const SSOIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="14" r="2" fill="currentColor" />
    <path d="M8.76 10.76a4.75 4.75 0 0 1 6.48 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M5.52 7.52a9.25 9.25 0 0 1 12.96 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 17v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-form-panel">
          <div className="brand">
            <div className="brand-mark">
              <WorkiyaBrandIcon />
            </div>
            <span className="brand-name">WorKiya</span>
          </div>

          <div className="intro-copy">
            <h1>Welcome back to WorKiya</h1>
            <p>Enter your credentials to access your workforce dashboard.</p>
          </div>

          <div className="auth-options">
            <button type="button" className="social-button">
              <GoogleIcon />
              <span>Google</span>
            </button>
            <button type="button" className="social-button">
              <SSOIcon />
              <span>SSO</span>
            </button>
          </div>

          <div className="divider">
            <span>Or continue with email</span>
          </div>

          <LoginForm />

          <hr className="support-divider" />
          <p className="support-copy">
            Don&apos;t have an account? <a href="/">Contact your Admin</a>
          </p>
        </div>

        <div className="login-visual-panel">
          <div className="visual-overlay" />
          <div className="visual-rings" />
          <TestimonialSlider />
        </div>
      </section>

      <footer className="page-footer">
        <a href="/">Privacy Policy</a>
        <a href="/">Terms of Service</a>
        <a href="/">Help Center</a>
      </footer>
    </main>
  );
}
