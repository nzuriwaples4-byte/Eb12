import { useSearchParams } from "react-router";
import { VyroStore } from "~/components/vyro-store/vyro-store";

/** Dev-only: a brand store on its own, for screenshots (?brand=vanta) */
export default function DevVyro() {
  const [q] = useSearchParams();
  return (
    <main style={{ minHeight: "100vh", background: "#05040a" }}>
      <VyroStore brand={q.get("brand") === "vanta" ? "vanta" : "vyro"} onClose={() => {}} />
    </main>
  );
}
