export const parseNumeric = (value?: string | number | null) => {
  if (value === null || value === undefined) return undefined;

  let cleaned: string | number = value;

  // Support formatted numeric strings (e.g. "12,345.6")
  if (typeof cleaned === "string") {
    cleaned = cleaned.replace(/,/g, "");
  }

  const numeric = typeof cleaned === "number" ? cleaned : Number(cleaned);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const getTotalFromValue = (value?: number, percent?: number) => {
  if (value === undefined || percent === undefined || percent === 0) return undefined;
  const ratio = percent / 100;
  if (ratio <= 0) return undefined;
  return value / ratio;
};

export const deriveAbstainValue = (
  yesValue?: number,
  yesPercent?: number,
  noValue?: number,
  noPercent?: number,
  abstainPercent?: number
) => {
  if (abstainPercent === undefined) return undefined;
  if (abstainPercent <= 0) return 0;
  const total =
    getTotalFromValue(yesValue, yesPercent) ??
    getTotalFromValue(noValue, noPercent);
  if (total === undefined) return undefined;
  return (abstainPercent / 100) * total;
};

export const deriveCcAbstainCount = (
  yesCount?: number,
  noCount?: number,
  yesPercent?: number,
  noPercent?: number,
  abstainPercent?: number
) => {
  if (abstainPercent === undefined) return undefined;
  if (abstainPercent <= 0) return 0;
  const knownCount = (yesCount ?? 0) + (noCount ?? 0);
  const nonAbstainPercent = (yesPercent ?? 0) + (noPercent ?? 0);
  if (knownCount === 0 || nonAbstainPercent <= 0) return undefined;
  const total = knownCount / (nonAbstainPercent / 100);
  const abstainCount = total - knownCount;
  return Math.max(0, Math.round(abstainCount));
};

