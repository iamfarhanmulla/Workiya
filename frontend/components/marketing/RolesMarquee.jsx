const ROLES = [
  ["Medical representatives", "#2FB560"],
  ["Area sales managers", "#2756E0"],
  ["FMCG sales teams", "#7C5CFF"],
  ["Service engineers", "#F0B456"],
  ["Distributor teams", "#2FB560"],
  ["Regional heads", "#2756E0"],
  ["Merchandisers", "#7C5CFF"],
  ["Installation crews", "#F0B456"],
];

/** "Made for teams on the move": the list runs twice so the slide loops without a gap. */
export default function RolesMarquee() {
  return (
    <div className="marquee" aria-label="Who WorKiya is for">
      <div className="marquee-label">Made for teams on the move</div>
      <div className="fade-x">
        <div className="track">
          {[0, 1].map((copy) => ROLES.map(([role, color]) => (
            <span key={`${copy}-${role}`} className="role" aria-hidden={copy === 1 || undefined}>
              <i style={{ "--c": color }} />
              {role}
            </span>
          )))}
        </div>
      </div>
    </div>
  );
}
