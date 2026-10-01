import { useSearchParams } from "react-router";
import { Flight } from "~/components/flight/flight";
import { cityFor } from "~/data/cities";
import { getTeam } from "~/data/ebl";

/** Dev-only: /dev/flight?from=nyc&to=sea&t=12 freezes the flight for screenshots */
export default function DevFlight() {
  const [params] = useSearchParams();
  const to = params.get("to") ?? "sea";
  const t = params.get("t");
  return (
    <Flight
      from={cityFor(params.get("from") ?? "nyc")}
      to={cityFor(to)}
      team={getTeam(to)}
      tag={params.get("tag") ?? undefined}
      at={t === null ? undefined : Number(t)}
      onDone={() => {}}
    />
  );
}
