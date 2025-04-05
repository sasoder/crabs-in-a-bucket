// src/game/data/Consumables.ts
export interface Consumable {
    id: string;
    name: string;
    description: string;
    effect: string;
    spriteKey: string; // Filename for the icon (e.g., 'heart_root.png')
    cost: number; // How much it costs in the shop
}

export const CONSUMABLES: { [key: string]: Consumable } = {
    HEART_ROOT: {
        id: "HEART_ROOT",
        name: "Heart Root",
        description: "A gnarled root pulsating with life.",
        effect: "Instantly restores 1 lost life.",
        spriteKey: "heart",
        cost: 15,
    },
    GEODE: {
        id: "GEODE",
        name: "Geode",
        description: "Crack it open and see what's inside.",
        effect: "Wanna gamble?",
        spriteKey: "coin",
        cost: 5,
    },
    TNT: {
        id: "TNT",
        name: "TNT",
        description: "A bundle of TNT.",
        effect: "Explodes",
        spriteKey: "tnt",
        cost: 10,
    },
    // Add more consumables here
};

// Function to get a consumable by ID (optional but helpful)
export function getConsumableById(id: string): Consumable | undefined {
    return CONSUMABLES[id];
}

