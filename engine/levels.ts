export const LEVELS = ["1A", "1B", "2A", "2B", "3A", "3B", "4A", "4B"] as const;

export function levelIndex(level: string): number {
  const i = LEVELS.indexOf(level as (typeof LEVELS)[number]);
  return i < 0 ? 99 : i;
}

export function levelAtLeast(current: string, min: string): boolean {
  return levelIndex(current) >= levelIndex(min);
}

/** Waterloo session code, e.g. 1271 -> W27. */
export function sessionLabel(termId: string): string {
  const n = Number(termId);
  if (!Number.isFinite(n)) return termId;
  const month = n % 10;
  const year = 2000 + Math.floor(n / 10) % 100;
  const season = month === 1 ? "W" : month === 5 ? "S" : month === 9 ? "F" : "";
  return `${season}${String(year).slice(2)}`;
}

/** Winter 2027, Spring 2027, Fall 2027. */
export function sessionName(termId: string): string {
  const n = Number(termId);
  if (!Number.isFinite(n)) return termId;
  const month = n % 10;
  const year = 2000 + Math.floor(n / 10) % 100;
  const season = month === 1 ? "Winter" : month === 5 ? "Spring" : month === 9 ? "Fall" : "Term";
  return `${season} ${year}`;
}

/** Put spaces back into catalog text whose tags were stripped. */
export function readable(text: string): string {
  return text
    .replace(/([a-z)])(?=[A-Z])/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatCode(code: string): string {
  const m = code.match(/^([A-Z]+)(\d.*)$/);
  return m ? `${m[1]} ${m[2]}` : code;
}

export const LAB_COMPANIONS: Record<string, string> = {
  BIOL130: "BIOL130L",
  BIOL240: "BIOL240L",
  BIOL373: "BIOL373L",
  CHEM123: "CHEM123L",
  CHEM237: "CHEM237L",
  CHEM262: "CHEM262L",
};
