export interface BlockConfig {
    id: number; // Matches BlockType enum
    textureKey: string;
    isDestructible: boolean;
    hardness?: number; // How many hits to break? (Default 1)
    dropsCoinChance?: number; // Chance to drop a coin when broken (e.g., 0.05 for 5%)
}

