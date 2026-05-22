export const TRAIT_COPY = {
  empathy: {
    label: "Empathy",
    low: "Keeps the exchange crisp and direct.",
    mid: "Balances warmth with professional distance.",
    high: "Creates immediate safety and reassurance.",
  },
  rapport: {
    label: "Rapport",
    low: "Formal and interview-room focused.",
    mid: "Friendly without losing structure.",
    high: "Builds easy conversational chemistry.",
  },
  exploration: {
    label: "Exploration",
    low: "Stays close to the planned questions.",
    mid: "Adds selective follow-up depth.",
    high: "Probes deeply for signal and examples.",
  },
  speed: {
    label: "Pace",
    low: "Moves slowly and gives thinking space.",
    mid: "Keeps a calm, steady rhythm.",
    high: "Pushes the conversation forward quickly.",
  },
} as const;

export function traitDescription(
  value: number,
  key: keyof typeof TRAIT_COPY,
): string {
  if (value >= 8) {
    return TRAIT_COPY[key].high;
  }

  if (value >= 5) {
    return TRAIT_COPY[key].mid;
  }

  return TRAIT_COPY[key].low;
}
