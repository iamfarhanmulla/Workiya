import { Camera, Plus } from "../icons";
import CardText from "./CardText";

function PostHead({
  initials, color, name, time,
}) {
  return (
    <div className="post-h">
      <span className="av" style={{ background: color }}>{initials}</span>
      {name}
      <time>{time}</time>
    </div>
  );
}

// Sample activity feed. Illustration only.
function Feed() {
  return (
    <div className="feed">
      <div className="post" style={{ "--n": 0 }}>
        <PostHead initials="RK" color="#2756E0" name="Rahul K." time="10:42" />
        <p>Checked in at <b>Dr. Mehta Clinic</b> <em>· 18 m away · 24 min on site</em></p>
        <div className="acts">
          <span className="approve">Approve</span>
          <span className="ask">Ask a question</span>
        </div>
      </div>
      <div className="post" style={{ "--n": 1 }}>
        <PostHead initials="SA" color="#1E9E55" name="Sana A." time="11:30" />
        <div className="file"><i><Camera /></i>Added 3 photos at City Care Pharmacy</div>
      </div>
    </div>
  );
}

export default function ReviewCard() {
  return (
    <article className="hcard" data-head="0">
      <CardText
        num="04"
        label="Review"
        from="#5B9BFF"
        to="#1F45C0"
        title="Review in one tap"
        text={"Every visit arrives with its proof. Approve it, or ask a question, and the rep"
          + " sees it right away."}
        ticks={["Approve or send back", "Ask a question on any visit", "Every decision is logged"]}
      />
      <div className="hc-vis" aria-hidden="true">
        <div className="ui feedbox">
          <div className="ui-top">
            Activity
            <span className="chipbtn"><Plus />Assign visit</span>
          </div>
          <Feed />
        </div>
      </div>
    </article>
  );
}
