import Link from "next/link";
import { ArrowRight, Mail } from "./icons";
import Wordmark from "./Wordmark";

// Placeholder contact address and legal / social links until the real ones are decided.
export const DEMO_EMAIL = "hello@workiya.com";

const SOCIAL = [
  ["LinkedIn", "M5 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3.3 9h3.4v11.5H3.3V9Zm5.6 0h3.3v1.6"
    + "c.5-.9 1.7-1.9 3.5-1.9 3.6 0 4.3 2.3 4.3 5.4v6.4h-3.4v-5.7c0-1.4 0-3.1-1.9-3.1"
    + "s-2.2 1.5-2.2 3v5.8H8.9V9Z"],
  ["X", "M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.8 3h6.4l4.4 5.9"
    + "L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"],
  ["YouTube", "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0"
    + " 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4"
    + "s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9"
    + "l5.2 3L10 15Z"],
];

export function CtaBand() {
  return (
    <div className="band reveal" id="contact">
      <div className="wrap">
        <h2>Discover what <span className="hl">WorKiya</span> can do<br />for your field team</h2>
        <div className="ctas">
          <Link className="btn btn-white" href="/login">Log in</Link>
          <a className="btn btn-mint" href={`mailto:${DEMO_EMAIL}`}>Book a demo <ArrowRight /></a>
        </div>
      </div>
    </div>
  );
}

function FooterLinks() {
  return (
    <>
      <div>
        <h6>Product</h6>
        <a href="#features">Features</a>
        <a href="#labels">Industries</a>
        <a href="#why">Why WorKiya</a>
        <Link href="/login">Log in</Link>
      </div>
      <div>
        <h6>Solutions</h6>
        <a href="#labels">Pharma</a>
        <a href="#labels">FMCG</a>
        <a href="#labels">Field service</a>
        <a href="#labels">Distribution</a>
      </div>
      <div>
        <h6>Company</h6>
        <a href="#contact">Book a demo</a>
        <a href="#top">Privacy policy</a>
        <a href="#top">Terms of service</a>
        <a href="#top">Security</a>
      </div>
    </>
  );
}

export default function LandingFooter() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="fgrid">
          <div>
            <Wordmark size={26} light />
            <div className="contact"><span><Mail />{DEMO_EMAIL}</span></div>
          </div>
          <FooterLinks />
        </div>
        <div className="fbot">
          <span>{`© ${new Date().getFullYear()} WorKiya. All rights reserved.`}</span>
          <div className="social">
            {SOCIAL.map(([name, d]) => (
              <a key={name} href="#top" aria-label={name}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
