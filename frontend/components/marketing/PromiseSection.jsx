import PromiseQuote from "./PromiseQuote";
import Wordmark from "./Wordmark";

// Counts are plain facts about the product, not customer numbers.
const STATS = [
  [3, "steps", "From plan to proof"],
  [1, "app", "For reps, managers and admins"],
  [0, "paper", "No more visit diaries or Excel reports"],
];

export default function PromiseSection() {
  return (
    <section className="sec" id="why">
      <div className="wrap">
        <div className="quote">
          <div className="qmark reveal">&quot;</div>
          <PromiseQuote />
          <div className="who reveal">
            <Wordmark size={20} />
            <b>Our promise</b>
            <small>The WorKiya team</small>
          </div>
        </div>
        <div className="stats reveal">
          {STATS.map(([value, unit, text]) => (
            <div key={unit}>
              <strong><span className="count" data-to={value}>0</span> {unit}</strong>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
