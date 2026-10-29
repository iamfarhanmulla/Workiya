/** Left half of a feature card: step number, title, text and three ticked points. */
export default function CardText({
  num, label, from, to, title, text, ticks,
}) {
  return (
    <div className="hc-txt">
      <span className="hc-num"><b style={{ "--c1": from, "--c2": to }}>{num}</b>{label}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      <ul className="ticks">{ticks.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  );
}
