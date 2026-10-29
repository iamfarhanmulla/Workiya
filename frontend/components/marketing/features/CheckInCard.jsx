import MapScene from "../MapScene";
import CardText from "./CardText";

export default function CheckInCard() {
  return (
    <article className="hcard" data-head="0">
      <CardText
        num="02"
        label="Check in"
        from="#3FD07A"
        to="#1E9E55"
        title="GPS check-in that proves the visit"
        text={"Reps can only check in when they're really at the clinic or store. Distance, time on"
          + " site and photos are saved with every visit."}
        ticks={["Distance from the location", "Time spent on site", "Photos and notes as proof"]}
      />
      <div className="hc-vis night" aria-hidden="true">
        <MapScene />
      </div>
    </article>
  );
}
