import { ArrowRight } from "./icons";

const ICONS = {
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  person: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  store: <><path d="M4 9h16l-1.5 11h-13L4 9Z" /><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" /></>,
  tool: (
    <path d={"M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.4-5.4"
      + "l-2.5 2.5-2.5-.5-.5-2.5 2.5-2.5Z"}
    />
  ),
  cross: <path d="M12 5v14M5 12h14" />,
  box: <><path d="M3.5 8 12 4l8.5 4v8L12 20l-8.5-4V8Z" /><path d="m3.5 8 8.5 4 8.5-4M12 12v8" /></>,
  camera: <><rect x="3" y="6" width="18" height="14" rx="3" /><circle cx="12" cy="13" r="3.5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};

// What different industries call their customers ([label, industry, icon, colour]) ...
const ROW_1 = [
  ["Doctor", "Pharma", "person", "#2756E0"], ["Retailer", "FMCG", "store", "#1E9E55"],
  ["Site", "Field service", "tool", "#E08A12"], ["Hospital", "Pharma", "cross", "#D9474F"],
  ["Distributor", "Distribution", "box", "#6A4BEA"], ["Chemist", "Pharma", "cross", "#1C8C83"],
  ["Outlet", "FMCG", "store", "#2756E0"], ["Dealer", "Distribution", "box", "#1E9E55"],
];
// ... and what they call the work.
const ROW_2 = [
  ["Visit", "Each stop", "pin", "#1E9E55"], ["Job", "Field service", "tool", "#2756E0"],
  ["Call", "Pharma", "person", "#6A4BEA"], ["Order", "FMCG", "box", "#E08A12"],
  ["Photo proof", "Custom field", "camera", "#1C8C83"], ["Approved", "Status", "check", "#1E9E55"],
  ["Sample given", "Custom field", "box", "#D9474F"],
  ["Demo done", "Visit type", "check", "#2756E0"],
];

function Tile({
  label, note, icon, color,
}) {
  return (
    <div className="tile">
      <i style={{ background: color }}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICONS[icon]}
        </svg>
      </i>
      <b>{label}</b>
      <small>{note}</small>
    </div>
  );
}

// Each row holds its tiles twice so the slide loops seamlessly.
function TileRow({ tiles, reverse }) {
  return (
    <div className={`row${reverse ? " rev" : ""}`}>
      {[...tiles, ...tiles].map(([label, note, icon, color], k) => (
        // eslint-disable-next-line react/no-array-index-key -- doubled list, labels repeat
        <Tile key={k} label={label} note={note} icon={icon} color={color} />
      ))}
    </div>
  );
}

function LinesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h10M4 12h16M4 17h7" strokeLinecap="round" />
    </svg>
  );
}

export default function LabelsSection() {
  return (
    <section id="labels" className="wrap">
      <div className="darkbox reveal">
        <span className="badge dark"><LinesIcon />Industries</span>
        <h2>Don&apos;t change how you talk. WorKiya will.</h2>
        <p>
          Doctors or retailers, visits or jobs: rename every label, add your own fields and visit
          types, and the whole app speaks your team&apos;s language.
        </p>
        <a className="ulink" href="#contact">See it with your labels <ArrowRight className="" /></a>
        <div className="rows" aria-hidden="true">
          <TileRow tiles={ROW_1} />
          <TileRow tiles={ROW_2} reverse />
        </div>
      </div>
    </section>
  );
}
