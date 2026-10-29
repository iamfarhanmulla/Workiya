import { Check, Pin } from "../icons";
import CardText from "./CardText";

// Sample day plan. Illustration only.
const VISITS = [
  {
    name: "Dr. Mehta Clinic", note: "Cardiologist · 10:30", state: "done", pill: ["ok", "Verified"],
  },
  {
    name: "City Care Pharmacy", note: "Chemist · 11:15", state: "done", pill: ["ok", "Verified"],
  },
  {
    name: "Sunrise Hospital", note: "Dr. Iyer · 14:30", state: "now", pill: ["go", "Now"],
  },
  {
    name: "Dr. Kapoor", note: "Pediatrician · 16:00", state: "next", pill: ["later", "Planned"],
  },
];

export default function PlanCard() {
  return (
    <article className="hcard" data-head="0">
      <CardText
        num="01"
        label="Plan"
        from="#A48BFF"
        to="#6A4BEA"
        title="Plan the day in minutes"
        text={"Managers assign visits, or reps build their own plan from their list of doctors,"
          + " stores or sites. Everyone opens the app and knows where to go next."}
        ticks={[
          "Managers assign, or reps plan",
          "Doctors, stores or sites in one list",
          "Works on web and mobile",
        ]}
      />
      <div className="hc-vis" aria-hidden="true">
        <div className="plan">
          <div className="plan-top">Today&apos;s visits <span>2 of 4 done</span></div>
          <div className="plan-prog"><i /></div>
          {VISITS.map((v, n) => (
            <div key={v.name} className="pv" style={{ "--n": n }}>
              <span className={`pv-ic ${v.state}`}>{v.state === "done" ? <Check /> : <Pin />}</span>
              <div><b>{v.name}</b><small>{v.note}</small></div>
              <span className={`pill ${v.pill[0]}`}>{v.pill[1]}</span>
            </div>
          ))}
          <span className="plan-btn"><Pin />Check in at next visit</span>
        </div>
      </div>
    </article>
  );
}
