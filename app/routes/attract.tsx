import { useSearchParams } from "react-router";
import { GameView } from "~/components/game-view/game-view";

/** Dev-only: CPU vs CPU match for screenshots / soak testing. /dev/attract?p=kairo&o=monarch&v=the-crown */
export default function Attract() {
  const [q] = useSearchParams();
  return (
    <GameView
      config={{
        playerId: q.get("p") ?? "kairo",
        opponentId: q.get("o") ?? "brick",
        venueId: q.get("v") ?? "the-cage",
        target: Number(q.get("t") ?? 21),
        difficulty: 1,
        useHiggsfield: q.get("hf") !== "0",
        shadows: true,
        cameraShake: true,
        cpuVsCpu: q.get("cpu") !== "0",
      }}
      onFinish={() => {}}
      onQuit={() => {}}
    />
  );
}
