export const TILE_SIZE = 16;
export const INITIAL_ROWS = 20; // Starting rows to generate
export const ROWS_PER_SHOP = 10; // How many rows until the shop appears

export const DEPTH_INCREMENT = TILE_SIZE; // How much depth increases per row

export enum BlockType {
    EMPTY = 0,
    DIRT = 1,
    GOLD = 2,
    STONE = 3,
}

export enum EntityType {
    PLAYER,
    BOULDER,
    ENEMY_BASIC, // Placeholder for a simple enemy
}

