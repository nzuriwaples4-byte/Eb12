import { useEffect } from "react";

/**
 * Console-style menu navigation for every screen:
 *   D-pad / left stick  move focus to the nearest control in that direction
 *   A / ✕               press the focused control
 *   B / ○               back (Escape, or the screen's [data-pad-back] control)
 *   LB / RB (L1 / R1)   previous / next tab in a [data-pad-tabs] row
 *   Start / Options     the screen's [data-pad-menu] control
 *
 * Gameplay owns the pad inside [data-pad="game"]; a [data-pad="ui"] overlay
 * (a store, a choice list) takes it back and scopes navigation to itself.
 */

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

type Dir = "up" | "down" | "left" | "right";

function scope(): HTMLElement | null {
  const ui = document.querySelectorAll<HTMLElement>('[data-pad="ui"]');
  if (ui.length) return ui[ui.length - 1];
  if (document.querySelector('[data-pad="game"]')) return null;
  return document.body;
}

function visible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const st = getComputedStyle(el);
  return st.visibility !== "hidden" && st.display !== "none";
}

function candidates(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
}

function focusEl(el: HTMLElement) {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function move(d: Dir) {
  const root = scope();
  if (!root) return;
  const list = candidates(root);
  if (!list.length) return;
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || cur === document.body || !root.contains(cur)) {
    focusEl(list.find((e) => e.hasAttribute("autofocus") || e.dataset.padDefault !== undefined) ?? list[0]);
    return;
  }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === cur || el.contains(cur) || cur.contains(el)) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - ax;
    const dy = r.top + r.height / 2 - ay;
    const along = d === "right" ? dx : d === "left" ? -dx : d === "down" ? dy : -dy;
    if (along <= 4) continue;
    const across = d === "left" || d === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = along + across * 2.4;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) focusEl(best);
}

function back() {
  const root = scope() ?? document.body;
  const target =
    [...root.querySelectorAll<HTMLElement>("[data-pad-back]")].filter(visible).pop() ??
    [...document.querySelectorAll<HTMLElement>("[data-pad-back]")].filter(visible).pop();
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
  target?.click();
}

function tab(step: number) {
  const root = scope();
  const row = root?.querySelector<HTMLElement>("[data-pad-tabs]");
  if (!row) return;
  const tabs = [...row.querySelectorAll<HTMLElement>("button, a[href]")].filter(visible);
  const i = tabs.findIndex((t) => t.dataset.on === "true" || t.getAttribute("aria-selected") === "true");
  const next = tabs[(Math.max(0, i) + step + tabs.length) % tabs.length];
  next?.click();
  next && focusEl(next);
}

export function markInput(kind: "pad" | "kbm") {
  if (document.documentElement.dataset.input !== kind) document.documentElement.dataset.input = kind;
}

export function useGamepadNav() {
  useEffect(() => {
    let raf = 0;
    let held: Dir | null = null;
    let repeatAt = 0;
    let prev = { a: false, b: false, lb: false, rb: false, start: false };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const pad = navigator.getGamepads?.().find(Boolean);
      if (!pad) return;
      const btn = (i: number) => !!pad.buttons[i]?.pressed;
      const x = pad.axes[0] ?? 0;
      const y = pad.axes[1] ?? 0;
      const d: Dir | null =
        btn(12) || y < -0.6 ? "up" : btn(13) || y > 0.6 ? "down" : btn(14) || x < -0.6 ? "left" : btn(15) || x > 0.6 ? "right" : null;
      if (d) {
        markInput("pad");
        if (d !== held) {
          held = d;
          repeatAt = now + 380;
          move(d);
        } else if (now > repeatAt) {
          repeatAt = now + 120;
          move(d);
        }
      } else held = null;
      const cur = { a: btn(0), b: btn(1), lb: btn(4), rb: btn(5), start: btn(9) };
      if (Object.values(cur).some(Boolean)) markInput("pad");
      const root = scope();
      if (cur.a && !prev.a && root) {
        const el = document.activeElement as HTMLElement | null;
        if (el && el !== document.body && root.contains(el)) el.click();
        else move("down");
      }
      if (cur.b && !prev.b && root) back();
      if (cur.lb && !prev.lb) tab(-1);
      if (cur.rb && !prev.rb) tab(1);
      if (cur.start && !prev.start)
        [...document.querySelectorAll<HTMLElement>("[data-pad-menu]")].filter(visible).pop()?.click();
      prev = cur;
    };
    raf = requestAnimationFrame(tick);
    const kbm = () => markInput("kbm");
    window.addEventListener("mousemove", kbm, { passive: true });
    window.addEventListener("mousedown", kbm, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", kbm);
      window.removeEventListener("mousedown", kbm);
    };
  }, []);
}
