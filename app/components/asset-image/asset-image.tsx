import { useEffect, useRef, useState } from "react";
import { assetSources, type AssetId } from "~/data/higgsfield-assets";
import styles from "./asset-image.module.css";

interface Props {
  asset?: AssetId;
  alt: string;
  className?: string;
  /** Shown when no source loads (e.g. offline) */
  fallbackLabel?: string;
  accent?: string;
  position?: string;
}

/**
 * Higgsfield image with graceful fallback: local copy → Higgsfield CDN →
 * a styled placeholder, so the game never shows a broken image.
 */
export function AssetImage({ asset, alt, className, fallbackLabel, accent = "#3ad7ff", position }: Props) {
  const sources = asset ? assetSources(asset) : [];
  const [idx, setIdx] = useState(0);
  const src = sources[idx];
  const ref = useRef<HTMLImageElement>(null);
  // An SSR-rendered <img> can fail before hydration attaches onError
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setIdx((i) => i + 1);
  }, [src]);
  const style = { "--accent": accent, objectPosition: position } as React.CSSProperties;
  if (!src) {
    return (
      <div className={`${styles.fallback} ${className ?? ""}`} style={style} role="img" aria-label={alt}>
        <span>{fallbackLabel ?? alt.slice(0, 1)}</span>
      </div>
    );
  }
  return (
    <img
      ref={ref}
      className={`${styles.img} ${className ?? ""}`}
      style={style}
      src={src}
      alt={alt}
      onError={() => setIdx((i) => i + 1)}
      draggable={false}
    />
  );
}
