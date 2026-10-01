import { useSearchParams } from "react-router";
import { ShoeDealContracts } from "~/components/shoe-deal/shoe-deal";
import { dealOffers, type BrandId } from "~/data/deals";

/** Dev-only: /dev/deal?fans=70&season=2&signed=vanta shows the shoe deal contracts */
export default function DevDeal() {
  const [q] = useSearchParams();
  const season = Number(q.get("season") ?? 1);
  const offers = dealOffers(
    {
      name: "Jordan Reed",
      nickname: "Launch",
      archetype: "slasher",
      heightIn: 77,
      skin: "#6b4430",
      hair: "fade",
      hairColor: "#140f0c",
      number: "7",
    },
    { fans: Number(q.get("fans") ?? 70), ovr: Number(q.get("ovr") ?? 78), season, champion: false },
  );
  return (
    <ShoeDealContracts
      offers={offers}
      athlete={{ name: "Jordan Reed", number: "7", team: "Atlanta Titans" }}
      season={season}
      signed={(q.get("signed") as BrandId | null) ?? undefined}
      onSign={() => {}}
      onDecline={() => {}}
    />
  );
}
