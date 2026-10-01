import { Glyph } from "~/components/glyph/glyph";
import { ACTION_LABEL, PLATFORM_INFO, type Action, type Platform } from "~/platform/platform";
import styles from "./controller-map.module.css";

const FACE: { action: Action; pos: "top" | "left" | "right" | "bottom"; text: string }[] = [
  { action: "trick", pos: "top", text: "Trick" },
  { action: "shoot", pos: "left", text: "Shoot" },
  { action: "juke", pos: "right", text: "Juke / Back" },
  { action: "lob", pos: "bottom", text: "Lob / OK" },
];

/** A controller drawn with this platform's buttons and what they do */
export function ControllerMap({ platform }: { platform: Platform }) {
  const info = PLATFORM_INFO[platform];
  if (platform === "pc")
    return (
      <div className={styles.wrap} data-platform="pc">
        <header>
          <strong>{info.name}</strong>
          <small>
            {info.pad} · {info.resolution}
          </small>
        </header>
        <div className={styles.keys}>
          {(["move", "camera", "sprint", "shoot", "juke", "trick", "lob", "special", "interact", "menu"] as Action[]).map(
            (a) => (
              <div key={a}>
                <Glyph action={a} platform="pc" />
                <span>{ACTION_LABEL[a]}</span>
              </div>
            ),
          )}
        </div>
        <p className={styles.note}>Plug in any controller and prompts switch to it automatically.</p>
      </div>
    );
  return (
    <div className={styles.wrap} data-platform={platform}>
      <header>
        <strong>{info.name}</strong>
        <small>
          {info.pad} · {info.resolution}
        </small>
      </header>
      <div className={styles.pad}>
        <div className={styles.shoulders}>
          <span>
            <Glyph action="tabPrev" platform={platform} /> Prev tab
          </span>
          <span>
            Sprint <Glyph action="sprint" platform={platform} />
          </span>
          <span>
            Special <Glyph action="special" platform={platform} />
          </span>
        </div>
        <div className={styles.body}>
          <div className={styles.stick} data-side="l">
            <Glyph action="move" platform={platform} />
            <small>Move</small>
          </div>
          <div className={styles.center}>
            <Glyph action="menu" platform={platform} />
            <small>Pause</small>
            {platform === "steamdeck" && <i className={styles.trackpads}>Trackpads: camera &amp; menus</i>}
          </div>
          <div className={styles.faces}>
            <div className={styles.diamond}>
              {FACE.map((f) => (
                <span key={f.action} data-pos={f.pos}>
                  <Glyph action={f.action} platform={platform} />
                </span>
              ))}
            </div>
            <ul className={styles.legend}>
              {FACE.map((f) => (
                <li key={f.action}>
                  <Glyph action={f.action} platform={platform} /> {f.text}
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.stick} data-side="r">
            <Glyph action="camera" platform={platform} />
            <small>Camera</small>
          </div>
        </div>
      </div>
      <p className={styles.note}>
        Menus: D-pad to move · <Glyph action="confirm" platform={platform} /> select ·{" "}
        <Glyph action="back" platform={platform} /> back · <Glyph action="tabPrev" platform={platform} />
        <Glyph action="tabNext" platform={platform} /> switch tabs
      </p>
    </div>
  );
}
