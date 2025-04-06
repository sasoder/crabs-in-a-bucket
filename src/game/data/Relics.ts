export interface Relic {
    id: string;
    name: string;
    description: string;
    effect: string; // For display in tooltip
    spriteKey: string; // Asset key for the icon
    cost: number; // How much it costs in the shop
    allowDuplicates?: boolean; // Whether the relic can be purchased multiple times
}

export const RELICS: Record<string, Relic> = {
    STEEL_BOOTS: {
        id: "STEEL_BOOTS",
        name: "Steel Boots",
        effect: "Enemy Bonk",
        description: "Your can jump on enemies to damage them.",
        spriteKey: "steel_boots",
        cost: 20,
        allowDuplicates: false,
    },
    DRILL: {
        id: "DRILL",
        name: "Drill",
        effect: "Dig Depth +1",
        description: "Your dig destroys blocks one layer deeper than normal.",
        spriteKey: "drill",
        cost: 20,
        allowDuplicates: true,
    },
    FEATHER_WEIGHT: {
        id: "FEATHER_WEIGHT",
        name: "Feather Weight",
        effect: "Jump Height +10%",
        description: "Your jump is higher than normal.",
        spriteKey: "feather",
        cost: 5,
        allowDuplicates: true,
    },
    LIGHTNING: {
        id: "LIGHTNING",
        name: "Lightning",
        effect: "Move Speed +10%",
        description: "You move faster than normal.",
        spriteKey: "lightning",
        cost: 5,
        allowDuplicates: true,
    },
    SLAYER: {
        id: "SLAYER",
        name: "Slayer",
        effect: "Enemy Kill reward +2",
        description: "Gain +2 coins for every enemy killed.",
        spriteKey: "slayer",
        cost: 10,
        allowDuplicates: true,
    },
};

