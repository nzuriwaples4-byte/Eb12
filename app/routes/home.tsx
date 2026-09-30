import { MenuButton } from "~/components/menu-button/menu-button";
import { AssetImage } from "~/components/asset-image/asset-image";
import { BOOK, CHAPTERS, STORY_TITLE } from "~/data/story";
import { useProgress } from "~/hooks/use-progress";
import type { Route } from "./+types/home";
import styles from "./home.module.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Concrete Crown — Streetball" },
    { name: "description", content: "1-on-1 streetball with a story. Five courts, five kings, one comeback." },
  ];
}

export default function Home() {
  const [progress] = useProgress();
  const next = CHAPTERS.find((c) => !progress.beaten.includes(c.id));
  return (
    <main className={styles.home}>
      <div className={styles.art}>
        <AssetImage
          asset="key-art"
          alt="Kairo 'Static' Vance dunking in a thunderstorm"
          fallbackLabel=" "
          position="70% 40%"
        />
      </div>
      <div className={styles.glow} />
      <section className={styles.panel}>
        <p className={styles.kicker}>1-on-1 Streetball</p>
        <h1 className={styles.logo}>
          Concrete
          <br />
          <span>Crown</span>
        </h1>
        <p className={styles.sub}>
          {BOOK}: {STORY_TITLE}
        </p>
        <nav className={styles.menu}>
          <MenuButton
            to="/story"
            variant="primary"
            hint={next ? `Ch. ${next.number} · ${next.title}` : "Completed"}
            autoFocus
          >
            Story Mode
          </MenuButton>
          <MenuButton to="/career" hint="High school → college → EBL draft">
            EBL Career
          </MenuButton>
          <MenuButton to="/city" hint="Walk the city · shops · courts">
            Enter the City
          </MenuButton>
          <MenuButton to="/play" hint="Solo · local versus · tag team co-op">
            Quick Match
          </MenuButton>
          <MenuButton to="/online" hint="1v1 a friend with a room code">
            Play Online
          </MenuButton>
          <MenuButton to="/crib" hint="House & bodyguards">
            The Crib
          </MenuButton>
          <MenuButton to="/roster" hint="Meet the circuit">
            Roster
          </MenuButton>
          <MenuButton to="/settings" hint="Audio · controls · graphics">
            Settings
          </MenuButton>
        </nav>
        <p className={styles.foot}>
          Keyboard or gamepad · Characters, portraits & 3D models generated with Higgsfield AI
        </p>
      </section>
    </main>
  );
}
