import { VyroStore } from "~/components/vyro-store/vyro-store";

/** Dev-only: the VYRO store on its own, for screenshots */
export default function DevVyro() {
  return (
    <main style={{ minHeight: "100vh", background: "#05040a" }}>
      <VyroStore onClose={() => {}} />
    </main>
  );
}
