export interface Relic {
    id: string;
    name: string;
    description: string;
    effect: string; // For display in tooltip
    spriteKey: string; // Asset key for the icon
    // Add other properties later, like how to apply the effect
}

export const RELICS: Record<string, Relic> = {
    STEEL_TOED_BOOTS: {
        id: "STEEL_TOED_BOOTS",
        name: "Steel-Toed Boots",
        effect: "Dig Depth +1",
        description:
            "Your jump dig destroys blocks one layer deeper than normal.",
        spriteKey: "relic-heart",
    },
    IMPACT_TREMOR: {
        id: "IMPACT_TREMOR",
        name: "Impact Tremor",
        effect: "Dig Width +1",
        description:
            "Your jump dig destroys blocks two tiles wider than normal (e.g., 1 -> 3 wide).",
        spriteKey: "relic-coin",
    },
};

