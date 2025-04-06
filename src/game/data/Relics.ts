export interface Relic {
    id: string;
    name: string;
    description: string;
    effect: string; // For display in tooltip
    spriteKey: string; // Asset key for the icon
    cost: number; // How much it costs in the shop
}

export const RELICS: Record<string, Relic> = {
    STEEL_TOED_BOOTS: {
        id: "STEEL_TOED_BOOTS",
        name: "Steel-Toed Boots",
        effect: "Dig Depth +1",
        description:
            "Your jump dig destroys blocks one layer deeper than normal.",
        spriteKey: "heart",
        cost: 10,
    },
    IMPACT_TREMOR: {
        id: "IMPACT_TREMOR",
        name: "Impact Tremor",
        effect: "Dig Width +1",
        description:
            "Your jump dig destroys blocks two tiles wider than normal (e.g., 1 -> 3 wide).",
        spriteKey: "coin",
        cost: 10,
    },
    FEATHER_WEIGHT: {
        id: "FEATHER_WEIGHT",
        name: "Feather Weight",
        effect: "Jump Height +10%",
        description: "Your jump is higher than normal.",
        spriteKey: "feather",
        cost: 10,
    },
};

