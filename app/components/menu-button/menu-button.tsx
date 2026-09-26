import { Link } from "react-router";
import { getAudio } from "~/game/audio";
import styles from "./menu-button.module.css";

interface Props {
  to?: string;
  onClick?: () => void;
  children: React.ReactNode;
  hint?: string;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  autoFocus?: boolean;
}

/** Big angled menu button with click sound */
export function MenuButton({ to, onClick, children, hint, disabled, variant = "ghost", autoFocus }: Props) {
  const sfx = () => {
    const a = getAudio();
    a.ensure();
    a.play("confirm");
  };
  const content = (
    <>
      <span className={styles.label}>{children}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </>
  );
  if (to && !disabled) {
    return (
      <Link
        to={to}
        className={styles.btn}
        data-variant={variant}
        onClick={sfx}
        onMouseEnter={() => getAudio().play("click")}
        autoFocus={autoFocus}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={styles.btn}
      data-variant={variant}
      disabled={disabled}
      autoFocus={autoFocus}
      onMouseEnter={() => getAudio().play("click")}
      onClick={() => {
        sfx();
        onClick?.();
      }}
    >
      {content}
    </button>
  );
}
