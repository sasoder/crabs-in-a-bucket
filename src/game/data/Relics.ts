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
        effect: "Jump on enemies to damage them",
        description: "A pair of steel boots, very durable and protective.",
        spriteKey: "steel_boots",
        cost: 25,
        allowDuplicates: false,
    },
    DRILL: {
        id: "DRILL",
        name: "Drill",
        effect: "Dig Depth +1",
        description: "A massive drill, capable of digging deeper than normal.",
        spriteKey: "drill",
        cost: 15,
        allowDuplicates: true,
    },
    FEATHER_WEIGHT: {
        id: "FEATHER_WEIGHT",
        name: "Feather",
        effect: "Jump Height +20%",
        description: "A discarded feather, light and airy.",
        spriteKey: "feather",
        cost: 5,
        allowDuplicates: true,
    },
    HEART_STONE: {
        id: "HEART_STONE",
        name: "Heart Stone",
        effect: "Gain +1 heart every 30 seconds",
        description:
            "An ancient, small stone in the shape of a heart, imbued with the essence of life.",
        spriteKey: "heart_stone",
        cost: 10,
        allowDuplicates: true,
    },
    LIGHTNING: {
        id: "LIGHTNING",
        name: "Lightning",
        effect: "Move Speed +20%",
        description: "A bolt of lightning, charged with energy.",
        spriteKey: "lightning",
        cost: 5,
        allowDuplicates: true,
    },
    SLAYER: {
        id: "SLAYER",
        name: "Slayer Skull",
        effect: "Gain +2 coins for every enemy killed",
        description: "What's your Slayer level? My Slayer level is 99.",
        spriteKey: "slayer",
        cost: 10,
        allowDuplicates: true,
    },
};

