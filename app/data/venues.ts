export type VenueTheme = "harbor" | "cage" | "neon" | "park" | "crown";

export interface Venue {
  id: string;
  name: string;
  district: string;
  theme: VenueTheme;
  timeOfDay: string;
  /** Sky gradient top → horizon */
  sky: [string, string];
  fog: string;
  fogDensity: number;
  /** Floor base color and paint colors */
  floor: string;
  paint: string;
  paintAlt: string;
  line: string;
  /** Low roughness makes a wet, reflective court */
  wet: boolean;
  sun: { color: string; intensity: number; dir: [number, number, number] };
  hemi: { sky: string; ground: string; intensity: number };
  lamps: { color: string; intensity: number };
  crowd: number;
  storm: boolean;
  music: { bpm: number; root: number; mood: "chill" | "grimy" | "night" | "bright" | "epic" };
  accent: string;
}

export const VENUES: Venue[] = [
  {
    id: "pier-9",
    name: "Pier 9",
    district: "Harbor Heights",
    theme: "harbor",
    timeOfDay: "Sunset",
    sky: ["#2a3a78", "#ff9a5a"],
    fog: "#e7916a",
    fogDensity: 0.012,
    floor: "#6d6a6f",
    paint: "#1f6fb2",
    paintAlt: "#d9542c",
    line: "#f4efe6",
    wet: false,
    sun: { color: "#ffb27a", intensity: 2.6, dir: [-0.6, 0.35, -0.7] },
    hemi: { sky: "#ffd0a8", ground: "#3a2c3a", intensity: 0.9 },
    lamps: { color: "#ffd9a0", intensity: 0.6 },
    crowd: 26,
    storm: false,
    music: { bpm: 88, root: 45, mood: "chill" },
    accent: "#ff9a5a",
  },
  {
    id: "the-cage",
    name: "The Cage",
    district: "Underline District",
    theme: "cage",
    timeOfDay: "Night",
    sky: ["#07070b", "#2a1a14"],
    fog: "#1c120e",
    fogDensity: 0.03,
    floor: "#3e3a38",
    paint: "#8a1a24",
    paintAlt: "#262222",
    line: "#e8d8b8",
    wet: false,
    sun: { color: "#ff9a40", intensity: 0.5, dir: [0.2, 1, 0.3] },
    hemi: { sky: "#ff9a50", ground: "#120a08", intensity: 0.45 },
    lamps: { color: "#ff9a3a", intensity: 3.2 },
    crowd: 34,
    storm: false,
    music: { bpm: 84, root: 40, mood: "grimy" },
    accent: "#ff5a3a",
  },
  {
    id: "neon-alley",
    name: "Neon Alley",
    district: "Little Seoul",
    theme: "neon",
    timeOfDay: "Rainy night",
    sky: ["#05030d", "#2a0f3a"],
    fog: "#1a0a26",
    fogDensity: 0.035,
    floor: "#26222e",
    paint: "#4a1f7a",
    paintAlt: "#1b3a5a",
    line: "#f0e6ff",
    wet: true,
    sun: { color: "#a070ff", intensity: 0.35, dir: [0.3, 1, 0.2] },
    hemi: { sky: "#b070ff", ground: "#0a0510", intensity: 0.5 },
    lamps: { color: "#ff4fd8", intensity: 2.6 },
    crowd: 22,
    storm: false,
    music: { bpm: 92, root: 42, mood: "night" },
    accent: "#ff4fd8",
  },
  {
    id: "queensway",
    name: "Queensway Park",
    district: "Queensway",
    theme: "park",
    timeOfDay: "Afternoon",
    sky: ["#3f8fe0", "#cfe8ff"],
    fog: "#cfe3f5",
    fogDensity: 0.008,
    floor: "#2f6a4a",
    paint: "#b8412e",
    paintAlt: "#e2b93a",
    line: "#fbf8f0",
    wet: false,
    sun: { color: "#fff2dc", intensity: 3.2, dir: [0.5, 0.9, 0.35] },
    hemi: { sky: "#cfe8ff", ground: "#3a5a2a", intensity: 1.1 },
    lamps: { color: "#ffffff", intensity: 0 },
    crowd: 44,
    storm: false,
    music: { bpm: 96, root: 47, mood: "bright" },
    accent: "#2bd67b",
  },
  {
    id: "the-crown",
    name: "The Crown",
    district: "Meridian Tower Rooftop",
    theme: "crown",
    timeOfDay: "Thunderstorm",
    sky: ["#040611", "#1c2440"],
    fog: "#0d1224",
    fogDensity: 0.02,
    floor: "#15151c",
    paint: "#2a2410",
    paintAlt: "#e2b23a",
    line: "#e8c870",
    wet: true,
    sun: { color: "#9fb4ff", intensity: 0.6, dir: [0.3, 1, -0.4] },
    hemi: { sky: "#6070b0", ground: "#07080f", intensity: 0.55 },
    lamps: { color: "#ffe2a0", intensity: 2.8 },
    crowd: 30,
    storm: true,
    music: { bpm: 80, root: 38, mood: "epic" },
    accent: "#ffc93a",
  },
];

export function getVenue(id: string): Venue {
  return VENUES.find((v) => v.id === id) ?? VENUES[0];
}
