// src/game/data/Consumables.ts
export interface Consumable {
    id: string;
    name: string;
    description: string;
    effect: string;
    spriteKey: string; // Filename for the icon (e.g., 'heart_root.png')
    cost: number; // How much it costs in the shop
    isEntity: boolean;
}

export const CONSUMABLES: { [key: string]: Consumable } = {
    HEART_ROOT: {
        id: "HEART_ROOT",
        name: "Heart Root",
        description: "A gnarled root pulsating with life.",
        effect: "Instantly restores 1 lost life.",
        spriteKey: "heart",
        cost: 15,
        isEntity: false,
    },
    GEODE: {
        id: "GEODE",
        name: "Geode",
        description: "Crack it open and see what's inside.",
        effect: "Earn a random amount of coins.",
        spriteKey: "geode",
        cost: 5,
        isEntity: false,
    },
    TNT: {
        id: "TNT",
        name: "TNT",
        description: "A bundle of TNT with a 5 second fuse.",
        effect: "Explodes after 5 seconds, destroying terrain and damaging enemies.",
        spriteKey: "tnt",
        cost: 10,
        isEntity: true,
    },
    BOULDER: {
        id: "BOULDER",
        name: "Boulder",
        description: "A large rock.",
        effect: "Place a boulder on the ground.",
        spriteKey: "boulder",
        cost: 3,
        isEntity: true,
    },
};

// Function to get a consumable by ID (optional but helpful)
export function getConsumableById(id: string): Consumable | undefined {
    return CONSUMABLES[id];
}

