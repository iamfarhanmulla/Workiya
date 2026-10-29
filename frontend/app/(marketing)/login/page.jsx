import Link from "next/link";
import LoginForm from "@/components/LoginForm";
import DotGrid from "@/components/marketing/DotGrid";
import {
  ArrowLeft, Bars, CameraOutline, Lock, Pin,
} from "@/components/marketing/icons";
import MapScene from "@/components/marketing/MapScene";
import ThemeToggle from "@/components/marketing/ThemeToggle";
import Wordmark from "@/components/marketing/Wordmark";

export const metadata = { title: "WorKiya Sign in" };

// The same night panel as the landing page's GPS card. Decorative, so hidden from screen readers.
function StoryPanel() {
  return (
    <aside className="aside" aria-hidden="true">
      <div className="pitch">
        <span className="badge dark"><i />Live field tracking</span>
        <h2>Every visit, <span className="hl">verified.</span></h2>
        <p>
          Plan the day, check in by GPS, report with photos and review it all in one place.
          Built for medical reps, sales teams and service engineers.
        </p>
      </div>
      <MapScene autoCount />
      <div className="trust">
        <span><Pin />GPS check-in</span>
        <span><CameraOutline />Photo proof</span>
        <span><Bars />Manager reports</span>
      </div>
    </aside>
  );
}

export default function LoginPage() {
  return (
    <div className="wkm wkm-login">
      <div className="page">
        <main className="main">
          <DotGrid />
          <div className="top">
            <Link className="home" href="/" aria-label="WorKiya home">
              <Wordmark size={30} animate />
            </Link>
            <Link className="back" href="/"><ArrowLeft /><span>Back to home</span></Link>
            <ThemeToggle />
          </div>

          <div className="center">
            <div className="panel">
              <span className="badge rise" style={{ "--i": 0 }}><i />Sign in</span>
              <h1 className="rise" style={{ "--i": 1 }}>
                Welcome <span className="hl">back</span>
              </h1>
              <p className="sub rise" style={{ "--i": 2 }}>
                Sign in with your work email to plan, check in and review visits.
              </p>
              <LoginForm />
              <p className="help rise" style={{ "--i": 7 }}>
                No account yet? Ask your company admin to invite you, or
                {" "}
                <Link className="link" href="/#contact">book a demo</Link>
                .
              </p>
            </div>
          </div>

          <footer className="foot">
            <span>{`© ${new Date().getFullYear()} WorKiya`}</span>
            <span><Lock />Secured with TLS encryption</span>
          </footer>
        </main>
        <StoryPanel />
      </div>
    </div>
  );
}
