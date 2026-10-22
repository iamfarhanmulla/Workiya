import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Sign in · Workiya" };

function ProofCard() {
  return (
    // data-theme="light" keeps this white card readable on the dark panel in either theme.
    <div className="wk-login-proof" data-theme="light" aria-hidden="true">
      <div className="wk-login-proof-head">
        <span className="material-symbols-outlined wk-icon--fill">verified</span>
        <span className="wk-login-proof-title">Visit verified</span>
        <span className="wk-pill wk-pill--completed">GPS check-in</span>
      </div>
      <div className="wk-login-proof-stats">
        <div><span>Distance</span><strong>18 m</strong></div>
        <div><span>Time on site</span><strong>24 min</strong></div>
        <div><span>Photos</span><strong>2</strong></div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="wk-app wk-login">
      <main className="wk-login-main">
        <div className="wk-topnav-brand">
          <span className="wk-logo" aria-hidden="true">W</span>
          Workiya
        </div>

        <div className="wk-login-center">
          <div className="wk-login-panel">
            <div className="wk-login-intro">
              <h1>Sign in</h1>
              <p>Welcome back. Use your work email.</p>
            </div>
            <LoginForm />
            <p className="wk-login-help">
              Don&apos;t have an account? Ask your company admin to invite you.
            </p>
          </div>
        </div>

        <footer className="wk-login-footer">{`© ${new Date().getFullYear()} Workiya`}</footer>
      </main>

      <aside className="wk-login-aside">
        <div className="wk-login-pitch">
          <span className="wk-login-eyebrow">Field team management</span>
          <h2>Proof of every visit.</h2>
          <p>
            Plan the day, check in by GPS, report with photos and review it all in one place.
            Built for medical reps, sales teams and service engineers.
          </p>
        </div>
        <ProofCard />
      </aside>
    </div>
  );
}
