/**
 * The 12 EBL home cities. After the draft you fly to your team's city and
 * the walkable hub takes on its look until you retire or sign elsewhere.
 */

export type Landmark = "spire" | "needle" | "mountains" | "strip" | "bridges" | "hills" | "skyline" | "harbor";

export interface CityTheme {
  teamId: string;
  city: string;
  state: string;
  /** Airport code for the flight board */
  airport: string;
  tagline: string;
  sky: [string, string];
  fog: string;
  sun: string;
  sunIntensity: number;
  hemi: [string, string];
  leaves: [string, string];
  palms: boolean;
  rain: boolean;
  landmark: Landmark;
  /** Accent for signs and the landmark */
  accent: string;
}

const T = (t: CityTheme) => t;

export const CITIES: Record<string, CityTheme> = {
  nyc: T({ teamId: "nyc", city: "New York", state: "NY", airport: "JFK", tagline: "The city that never sleeps", sky: ["#4f86c8", "#f6c998"], fog: "#e9c7a3", sun: "#ffd6a8", sunIntensity: 3.3, hemi: ["#cfe0ff", "#6a5446"], leaves: ["#3e7a36", "#5c9443"], palms: false, rain: false, landmark: "spire", accent: "#1f8fff" }),
  lva: T({ teamId: "lva", city: "Las Vegas", state: "NV", airport: "LAS", tagline: "Victor Kane's glass city", sky: ["#2a1a5e", "#ff7a59"], fog: "#d98a6a", sun: "#ffb27a", sunIntensity: 2.6, hemi: ["#ffd0e8", "#6a4a3a"], leaves: ["#6f8f3a", "#8aa04a"], palms: true, rain: false, landmark: "strip", accent: "#ff3a6e" }),
  atl: T({ teamId: "atl", city: "Atlanta", state: "GA", airport: "ATL", tagline: "The A", sky: ["#3f7fd0", "#ffd9a0"], fog: "#e8cfa8", sun: "#ffe0b0", sunIntensity: 3.4, hemi: ["#d6e6ff", "#6a5a3a"], leaves: ["#2f6e2c", "#4c8a3a"], palms: false, rain: false, landmark: "skyline", accent: "#c9a24a" }),
  sds: T({ teamId: "sds", city: "San Diego", state: "CA", airport: "SAN", tagline: "Sunshine and sea breeze", sky: ["#3a9be6", "#fff0c8"], fog: "#f2e6c8", sun: "#fff2cc", sunIntensity: 3.6, hemi: ["#e0f2ff", "#8a7a5a"], leaves: ["#3f8a3a", "#5aa04a"], palms: true, rain: false, landmark: "harbor", accent: "#2ec4b6" }),
  phx: T({ teamId: "phx", city: "Phoenix", state: "AZ", airport: "PHX", tagline: "The Valley of the Sun", sky: ["#e0702a", "#ffd27a"], fog: "#e8b27a", sun: "#ffb35a", sunIntensity: 3.6, hemi: ["#ffe2c0", "#8a5a3a"], leaves: ["#7a8a3a", "#9aa04a"], palms: true, rain: false, landmark: "mountains", accent: "#ff6b1a" }),
  pit: T({ teamId: "pit", city: "Pittsburgh", state: "PA", airport: "PIT", tagline: "The City of Bridges", sky: ["#6a7f9a", "#d8d2c4"], fog: "#c8c4bc", sun: "#ffe8c8", sunIntensity: 2.6, hemi: ["#d8dde6", "#5a5048"], leaves: ["#3a6a32", "#567a3a"], palms: false, rain: false, landmark: "bridges", accent: "#ffb81c" }),
  sea: T({ teamId: "sea", city: "Seattle", state: "WA", airport: "SEA", tagline: "Rain, coffee and buckets", sky: ["#5a6a7a", "#b8c4cc"], fog: "#9aa6ae", sun: "#e8eef4", sunIntensity: 1.8, hemi: ["#c8d4de", "#4a5048"], leaves: ["#2a5a32", "#3a6e3a"], palms: false, rain: true, landmark: "needle", accent: "#6a3fc8" }),
  mia: T({ teamId: "mia", city: "Miami", state: "FL", airport: "MIA", tagline: "Neon nights, ocean days", sky: ["#2a8fd8", "#ffb3c7"], fog: "#f2c4c8", sun: "#ffe0d0", sunIntensity: 3.5, hemi: ["#ffe0f0", "#7a6a5a"], leaves: ["#3a9a4a", "#5ab05a"], palms: true, rain: false, landmark: "harbor", accent: "#ff4fd8" }),
  chi: T({ teamId: "chi", city: "Chicago", state: "IL", airport: "ORD", tagline: "The Windy City", sky: ["#4a78b8", "#e6dcc8"], fog: "#d6d0c4", sun: "#fff0d8", sunIntensity: 3.0, hemi: ["#d6e0f0", "#5a5048"], leaves: ["#3a6e34", "#5a8a40"], palms: false, rain: false, landmark: "skyline", accent: "#3b4a5c" }),
  hou: T({ teamId: "hou", city: "Houston", state: "TX", airport: "IAH", tagline: "Space City", sky: ["#3a7ac8", "#ffe2a8"], fog: "#ead6b0", sun: "#ffe6b8", sunIntensity: 3.5, hemi: ["#dce8ff", "#6a5a3e"], leaves: ["#3a7a34", "#5a9442"], palms: true, rain: false, landmark: "skyline", accent: "#00b4d8" }),
  por: T({ teamId: "por", city: "Portland", state: "OR", airport: "PDX", tagline: "Bridges, trees and drizzle", sky: ["#6a7a86", "#c4ccc8"], fog: "#a8b2ae", sun: "#eef2e8", sunIntensity: 2.0, hemi: ["#d0dad4", "#4a5442"], leaves: ["#245a2c", "#346e34"], palms: false, rain: true, landmark: "mountains", accent: "#2f7d3a" }),
  las: T({ teamId: "las", city: "Los Angeles", state: "CA", airport: "LAX", tagline: "Hills, palms and the brightest lights", sky: ["#3a8ad8", "#ffc9a0"], fog: "#f0cfb0", sun: "#ffdcae", sunIntensity: 3.6, hemi: ["#e0ecff", "#8a6a4a"], leaves: ["#4a8a3a", "#6aa04a"], palms: true, rain: false, landmark: "hills", accent: "#b8c4d6" }),
};

export function cityFor(teamId: string | null | undefined): CityTheme {
  return (teamId && CITIES[teamId]) || CITIES.nyc;
}
