import { AttributeBuilder } from "~/components/attribute-builder/attribute-builder";
import { caps, startAttrs } from "~/data/attributes";

/** Dev preview of the upgrade screen */
export default function DevBuilder() {
  const c = caps("slasher", 77);
  const a = startAttrs("slasher", 77);
  for (const k of Object.keys(a) as (keyof typeof a)[]) a[k] = Math.min(c[k], a[k] + 18);
  return (
    <AttributeBuilder
      name="Jordan Reed"
      nickname="Launch"
      archetype="slasher"
      heightIn={77}
      attrs={a}
      caps={c}
      sp={120}
      onConfirm={() => {}}
    />
  );
}
