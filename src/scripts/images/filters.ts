import type { CandidateImage } from "./types.ts";

const EXCLUDE_PATTERNS = [
  "flag", "coat_of_arms", "emblem", "logo", "icon", "medal",
  "map", "diagram", "chart", "plan_of", "order_of_battle",
  "insignia", "badge", "stamp", "postage", "ribbon", ".svg",
  "commons-logo", "wikidata", "wikipedia", "wikimedia", "portrait_placeholder",
];

const DESC_EXCLUDE = ["map of", "diagram of", "chart showing", "coat of arms", "battle plan"];

const TRUSTED_SOURCE = /loc\.gov|archives\.gov|nara|archive\.org|si\.edu|iwm\.org\.uk|nps\.gov|wikimedia/i;

export function isQualityImage(img: CandidateImage): boolean {
  if (!img.url) return false;

  // Dimension checks (when available)
  if (img.width && img.height) {
    if (img.width < 400 || img.height < 300) return false;
    const ratio = img.width / img.height;
    if (ratio < 0.3 || ratio > 4.0) return false;
  }

  // Title exclusions
  const lowerTitle = (img.title || "").toLowerCase();
  if (EXCLUDE_PATTERNS.some((p) => lowerTitle.includes(p))) return false;

  // Description exclusions (title often contains description)
  if (DESC_EXCLUDE.some((p) => lowerTitle.includes(p))) return false;

  return true;
}

export function scoreImage(img: CandidateImage): number {
  let score = 0;

  // Size score
  const area = (img.width || 0) * (img.height || 0);
  score += Math.min(4, area / 800_000);

  // Description quality bonus
  if ((img.title || "").length > 20) score += 1;

  // Trusted source boost
  if (TRUSTED_SOURCE.test(`${img.source} ${img.landingUrl || ""}`)) score += 2;

  // Metadata bonuses
  if (img.creator) score += 0.5;
  if (img.license && img.license !== "unknown") score += 0.4;

  return score;
}

export function filterAndRank(candidates: CandidateImage[], maxImages: number): CandidateImage[] {
  // Deduplicate by URL
  const unique = new Map<string, CandidateImage>();
  for (const img of candidates) {
    if (!isQualityImage(img)) continue;
    const key = img.url.toLowerCase();
    if (!unique.has(key)) unique.set(key, img);
  }

  // Score and sort
  return Array.from(unique.values())
    .sort((a, b) => scoreImage(b) - scoreImage(a))
    .slice(0, maxImages);
}
