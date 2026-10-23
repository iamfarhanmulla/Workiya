import Link from "next/link";
import PageHeader from "@/components/PageHeader";

// An honest page for a feature that has no backend yet: what it will do, no fake numbers.
// points: short sentences; link: optional { href, label } to where related data lives today.
export default function ComingSoon({
  title, sub, icon, points, link,
}) {
  return (
    <div className="wk-app">
      <div className="wk-main">
        <PageHeader title={title} sub={sub} />
        <section className="wk-card wk-coming-soon" aria-labelledby="coming-soon-title">
          <div className="wk-empty">
            <div className="wk-empty-icon">
              <span className="material-symbols-outlined wk-icon--lg" aria-hidden="true">
                {icon}
              </span>
            </div>
            <h2 className="wk-empty-title" id="coming-soon-title">Coming soon</h2>
            <p className="wk-empty-text">{`${title} is being built. Here is what it will do:`}</p>
          </div>
          <ul className="wk-coming-list">
            {points.map((point) => (
              <li key={point}>
                <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
                {point}
              </li>
            ))}
          </ul>
          {link && (
            <div className="wk-coming-link">
              <Link href={link.href} className="wk-btn wk-btn--secondary">{link.label}</Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
