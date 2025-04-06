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
        name: "Heart",
        description: "A heart pulsating with life.",
        effect: "Instantly gain 1 life.",
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
        description: "A bundle of TNT with a 3 second fuse.",
        effect: "Place a TNT on the ground. It will explode after 3 seconds, destroying terrain and damaging enemies.",
        spriteKey: "tnt",
        cost: 7,
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

