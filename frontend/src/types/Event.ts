export const eventOptions = [
    "3x3",
    "2x2",
    "4x4",
    "Pyraminx",
    "Skewb",
    "One-Handed",
    "Clock",
    "3x3-Blindfolded",
] as const;

export type Event = typeof eventOptions[number];
