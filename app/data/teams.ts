export interface Team {
  id: string;
  name: string;
  short: string;
  flag: string;
  /** Primary kit color */
  kit: string;
  /** Secondary / accent kit color */
  kitAlt: string;
  /** Relative strength 1-100, drives AI difficulty */
  rating: number;
}

export const TEAMS: Team[] = [
  { id: "bra", name: "Brazil", short: "BRA", flag: "🇧🇷", kit: "#ffdd00", kitAlt: "#009c3b", rating: 92 },
  { id: "arg", name: "Argentina", short: "ARG", flag: "🇦🇷", kit: "#6cb4e4", kitAlt: "#ffffff", rating: 91 },
  { id: "fra", name: "France", short: "FRA", flag: "🇫🇷", kit: "#1f3a93", kitAlt: "#ffffff", rating: 90 },
  { id: "eng", name: "England", short: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", kit: "#ffffff", kitAlt: "#cf142b", rating: 88 },
  { id: "esp", name: "Spain", short: "ESP", flag: "🇪🇸", kit: "#c60b1e", kitAlt: "#ffc400", rating: 87 },
  { id: "ger", name: "Germany", short: "GER", flag: "🇩🇪", kit: "#ffffff", kitAlt: "#000000", rating: 86 },
  { id: "por", name: "Portugal", short: "POR", flag: "🇵🇹", kit: "#c8102e", kitAlt: "#006600", rating: 87 },
  { id: "ned", name: "Netherlands", short: "NED", flag: "🇳🇱", kit: "#ff6a00", kitAlt: "#ffffff", rating: 85 },
  { id: "ita", name: "Italy", short: "ITA", flag: "🇮🇹", kit: "#0066b3", kitAlt: "#ffffff", rating: 84 },
  { id: "bel", name: "Belgium", short: "BEL", flag: "🇧🇪", kit: "#e30613", kitAlt: "#ffd700", rating: 83 },
  { id: "cro", name: "Croatia", short: "CRO", flag: "🇭🇷", kit: "#ff0000", kitAlt: "#ffffff", rating: 82 },
  { id: "uru", name: "Uruguay", short: "URU", flag: "🇺🇾", kit: "#5ba3e0", kitAlt: "#ffffff", rating: 81 },
  { id: "mex", name: "Mexico", short: "MEX", flag: "🇲🇽", kit: "#006847", kitAlt: "#ffffff", rating: 79 },
  { id: "usa", name: "USA", short: "USA", flag: "🇺🇸", kit: "#ffffff", kitAlt: "#0a3161", rating: 77 },
  { id: "jpn", name: "Japan", short: "JPN", flag: "🇯🇵", kit: "#001f7e", kitAlt: "#ffffff", rating: 78 },
  { id: "mar", name: "Morocco", short: "MAR", flag: "🇲🇦", kit: "#c1272d", kitAlt: "#006233", rating: 80 },
];

export function getTeam(id: string): Team | undefined {
  return TEAMS.find((t) => t.id === id);
}
