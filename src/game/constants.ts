export const TILE_SIZE = 16;
export const INITIAL_ROWS = 20; // Starting rows to generate
export const ROWS_PER_SHOP = 10; // How many rows until the shop appears

export const DEPTH_INCREMENT = TILE_SIZE; // How much depth increases per row

// Tile indices for the terrain tilemap
export enum TileIndex {
    EMPTY = -1,
    SAND = 0,
    DIRT = 1,
    STONE = 2,
}

// Maps tile indices to particle emitter names
export const TILE_TO_PARTICLE_MAP: Record<TileIndex, string> = {
    [TileIndex.EMPTY]: "", // No particles for empty tiles
    [TileIndex.SAND]: "sand_tile",
    [TileIndex.DIRT]: "dirt_tile", // Adjust if the emitter name is different
    [TileIndex.STONE]: "stone_tile", // Adjust if the emitter name is different
};

// This might no longer be used if TextureManager is removed, but keeping it
// in case other parts of the codebase reference it
export enum BlockType {
    EMPTY = 0,
    SAND = 1,
}

export enum EntityType {
    PLAYER,
    BOULDER,
    GOLD_ENTITY,
    ENEMY_BASIC, // Placeholder for a simple enemy
}

