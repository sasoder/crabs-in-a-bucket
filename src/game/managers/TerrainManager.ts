// src/game/managers/TerrainManager.ts
import Phaser from "phaser";
import { BlockType, TILE_SIZE } from "../constants";
import { Boulder } from "../entities/Boulder";
import { Enemy } from "../entities/Enemy";
import { BlockConfig } from "../types/BlockConfig";

// --- Configuration for Block Types (Simplified) ---
const blockConfigs: Record<BlockType, BlockConfig | null> = {
    [BlockType.EMPTY]: null,
    [BlockType.DIRT]: {
        id: BlockType.DIRT,
        textureKey: "dirt_tile",
        isDestructible: true,
        hardness: 1,
        dropsCoinChance: 0.02,
    },
    // Temporarily remove STONE and GOLD configs
    // [BlockType.STONE]: { ... },
    // [BlockType.GOLD]: { ... },
    [BlockType.STONE]: null,
    [BlockType.GOLD]: null,
};
// ------------------------------------

export class TerrainManager {
    private scene: Phaser.Scene;
    private map: Phaser.Tilemaps.Tilemap;
    private groundLayer: Phaser.Tilemaps.TilemapLayer;
    private generatedRowsMaxY: number = 0;
    private bouldersGroup: Phaser.Physics.Arcade.Group;
    private enemiesGroup: Phaser.Physics.Arcade.Group;

    // Map dimensions (adjust as needed)
    private mapWidth = 50; // Increased width for more space
    private mapHeight = 500; // Keep reasonable height for performance

    // --- Generation Parameters (Tunable) ---
    private boulderSpawnChanceBase = 0.01;
    private enemySpawnChanceBase = 0.01; // Slightly increased
    // Removed stone/gold chances
    private difficultyScaleFactor = 0.0005;
    // ---------------------------------------

    // --- Initial Platform ---
    private initialPlatformRows = 5; // How many rows down the starting platform is
    private initialClearRows = 3; // How many empty rows above the platform
    // ------------------------

    constructor(
        scene: Phaser.Scene,
        bouldersGroup: Phaser.Physics.Arcade.Group,
        enemiesGroup: Phaser.Physics.Arcade.Group
    ) {
        this.scene = scene;
        this.bouldersGroup = bouldersGroup;
        this.enemiesGroup = enemiesGroup;

        // Create the map instance
        this.map = this.scene.make.tilemap({
            tileWidth: TILE_SIZE,
            tileHeight: TILE_SIZE,
            width: this.mapWidth,
            height: this.mapHeight,
        });

        // --- Simplified: Add only dirt tileset ---
        // Explicitly provide tile dimensions
        const dirtTileset = this.map.addTilesetImage(
            "dirt_tile", // texture key
            undefined, // embedded tileset name (optional, use texture key)
            TILE_SIZE, // tile width
            TILE_SIZE, // tile height
            0, // margin (default 0)
            0, // spacing (default 0)
            1 // gid (explicitly set firstgid to 1)
        );
        console.log("Created Tileset Object:", dirtTileset);

        if (!dirtTileset) {
            // Check only dirt
            console.error(
                "Failed to create dirt tileset in TerrainManager. Ensure 'dirt_tile' texture is generated in Game.ts preload."
            );
            throw new Error("Failed to create tileset");
        }

        // --- Simplified: Create layer with only dirt tileset ---
        this.groundLayer = this.map.createBlankLayer(
            "Ground",
            [dirtTileset], // Wrap the single tileset in an array
            0,
            0
        )!;

        if (!this.groundLayer) {
            console.error("Failed to create ground layer in TerrainManager");
            throw new Error("Failed to create ground layer");
        }

        // Set initial generation point (below clear rows)
        this.generatedRowsMaxY = this.initialClearRows * TILE_SIZE;
    }

    public getGroundLayer(): Phaser.Tilemaps.TilemapLayer {
        return this.groundLayer;
    }

    public getMap(): Phaser.Tilemaps.Tilemap {
        return this.map;
    }

    public getInitialSpawnPoint(): { x: number; y: number } {
        const spawnYPx =
            (this.initialPlatformRows - 1) * TILE_SIZE + TILE_SIZE / 2;
        return {
            x: this.map.widthInPixels / 2,
            y: spawnYPx,
        };
    }

    public generateInitialChunk(): void {
        // Generate the initial solid platform first
        console.log(
            `Generating initial platform at row Y=${this.initialPlatformRows}`
        );
        const platformTileY = this.initialPlatformRows;
        for (let tileX = 0; tileX < this.mapWidth; tileX++) {
            this.placeBlock(tileX, platformTileY, BlockType.DIRT); // Solid dirt platform
        }

        // Generate some rows below the platform to start
        const initialWorldDepth = 20; // How many rows to generate initially below platform
        const startY = (this.initialPlatformRows + 1) * TILE_SIZE;
        const endY = startY + initialWorldDepth * TILE_SIZE;

        console.log(`Generating initial chunk from Y=${startY} to Y=${endY}`);
        for (let y = startY; y < endY; y += TILE_SIZE) {
            this.generateRow(y);
        }
        this.generatedRowsMaxY = endY;
        this.updateCollision();
    }

    public update(cameraBottomY: number): void {
        const generationThreshold = cameraBottomY + TILE_SIZE * 10; // Generate further ahead

        if (generationThreshold > this.generatedRowsMaxY) {
            const startY = this.generatedRowsMaxY;
            const endY = generationThreshold;
            for (let y = startY; y < endY; y += TILE_SIZE) {
                this.generateRow(y);
            }
            this.generatedRowsMaxY = endY;
            this.updateCollision();
        }
    }

    public digBlockAt(worldX: number, worldY: number): string | null {
        const tileX = this.groundLayer.worldToTileX(worldX);
        const tileY = this.groundLayer.worldToTileY(worldY);

        if (tileX === null || tileY === null) return null;

        const tileToRemove = this.groundLayer.getTileAt(tileX, tileY);
        const blockConfig = this.getBlockConfigFromTile(tileToRemove);

        if (tileToRemove && blockConfig?.isDestructible) {
            this.groundLayer.removeTileAt(tileX, tileY);
            console.log(`Dug block at [${tileX}, ${tileY}]`);
            // --- Return textureKey if available ---
            return blockConfig.textureKey ?? null;
        }
        console.log(
            `Failed to dig block at [${tileX}, ${tileY}] (Tile: ${tileToRemove?.index}, Config: ${blockConfig?.id})`
        );
        return null; // No block removed or no texture key
    }

    public getBlockConfigFromTile(
        tile: Phaser.Tilemaps.Tile | null
    ): BlockConfig | null {
        if (!tile || tile.index === -1) return null;
        // Find the BlockType enum value matching the tile index
        // This assumes your tileset assigns indices matching BlockType values (Dirt=1, Stone=2)
        const blockType = Object.values(BlockType).find(
            (type) => typeof type === "number" && type === tile.index
        ) as BlockType | undefined;
        // Need to cast here because TS doesn't know blockType is constrained by the simplified enum
        return blockType !== undefined ? blockConfigs[blockType] : null;
    }

    private placeBlock(
        tileX: number,
        tileY: number,
        blockType: BlockType
    ): Phaser.Tilemaps.Tile | null {
        // Ensure tileX and tileY are valid before proceeding
        if (
            tileX < 0 ||
            tileX >= this.mapWidth ||
            tileY < 0 ||
            tileY >= this.mapHeight
        ) {
            console.warn(
                `placeBlock called with invalid coordinates: [${tileX}, ${tileY}]`
            );
            return null;
        }

        const config = blockConfigs[blockType]; // Get config *before* logging it

        console.log(
            `Attempting placeBlock [${tileX}, ${tileY}], type: ${BlockType[blockType]} (${blockType}), config.id: ${config?.id}`
        );
        console.log("Looked up config:", config); // Log the config itself
        console.log("Ground Layer Obj:", this.groundLayer);
        console.log("Ground Layer Tileset(s):", this.groundLayer.tileset);
        console.log("Tile Coordinates (X, Y):", tileX, tileY);

        if (!config) {
            console.warn("Config lookup failed! Handling as EMPTY.");
            this.groundLayer.removeTileAt(tileX, tileY);
            return null;
        }

        console.log("Config ID to place:", config.id);

        let tile: Phaser.Tilemaps.Tile | null = null;
        try {
            // Now we know config.id is a number
            tile = this.groundLayer.putTileAt(config.id, tileX, tileY);
        } catch (error) {
            console.error("!!! ERROR during putTileAt !!!");
            // Log the definite config.id
            console.error("Arguments passed:", config.id, tileX, tileY);
            console.error("Layer state:", this.groundLayer);
            console.error("Error object:", error);
            throw error; // Re-throw the error after logging
        }

        console.log("Result of putTileAt:", tile);
        if (tile) {
            console.log("Tile placed successfully:", tile.index);
        } else {
            console.warn(
                `putTileAt returned null for config.id ${config.id} at [${tileX}, ${tileY}]`
            );
        }
        return tile;
    }

    private generateRow(worldY: number): void {
        const tileY = this.groundLayer.worldToTileY(worldY);
        if (tileY === null || tileY < 0 || tileY >= this.mapHeight) return; // Bounds check

        const depthFactor = Math.max(0, worldY) * this.difficultyScaleFactor;
        const currentBoulderChance = this.boulderSpawnChanceBase + depthFactor;
        const currentEnemyChance = this.enemySpawnChanceBase + depthFactor;

        for (let tileX = 0; tileX < this.mapWidth; tileX++) {
            const worldX = this.groundLayer.tileToWorldX(tileX);
            let blockToPlace: BlockType = BlockType.EMPTY; // Default to empty

            // Basic terrain pattern - higher chance of blocks deeper down, more gaps near surface
            const baseFillChance = 0.6 + Math.min(0.35, depthFactor * 5); // Increase density with depth up to 95%
            if (Math.random() < baseFillChance) {
                blockToPlace = BlockType.DIRT; // Default solid block is dirt
            }

            // Decide if Boulder (overrides other blocks)
            if (
                blockToPlace !== BlockType.EMPTY &&
                Math.random() < currentBoulderChance
            ) {
                const boulder = new Boulder(
                    this.scene,
                    worldX! + TILE_SIZE / 2,
                    worldY + TILE_SIZE / 2
                ); // Center boulder in tile
                this.bouldersGroup.add(boulder);
                blockToPlace = BlockType.EMPTY; // Leave space where boulder spawns
            } else if (blockToPlace !== BlockType.EMPTY) {
                // Only place if it's not empty and not replaced by a boulder
                this.placeBlock(tileX, tileY, blockToPlace);
            } else {
                // Ensure empty space is explicitly cleared if needed (though placeBlock handles EMPTY)
                this.placeBlock(tileX, tileY, BlockType.EMPTY);
            }

            // Decide if Enemy spawns (only in empty spaces *above* a solid block)
            if (
                blockToPlace === BlockType.EMPTY &&
                Math.random() < currentEnemyChance
            ) {
                const tileBelow = this.groundLayer.getTileAt(tileX, tileY + 1);
                const configBelow = this.getBlockConfigFromTile(tileBelow);
                // Spawn only if space above is empty and space below is solid ground
                if (configBelow && configBelow.id !== BlockType.EMPTY) {
                    // Check space *directly* above spawn point is also empty
                    const tileAtSpawn = this.groundLayer.getTileAt(
                        tileX,
                        tileY
                    );
                    if (
                        !tileAtSpawn ||
                        tileAtSpawn.index === -1 ||
                        tileAtSpawn.index === BlockType.EMPTY
                    ) {
                        const enemy = new Enemy(
                            this.scene,
                            worldX! + TILE_SIZE / 2,
                            worldY + TILE_SIZE / 2
                        );
                        this.enemiesGroup.add(enemy);
                        console.log(`Spawned enemy at ${tileX}, ${tileY}`);
                    }
                }
            }
        }
    }

    private updateCollision(): void {
        // Update collision based on tile index (only index 1 should collide now)
        // Or set explicitly if needed: this.groundLayer.setCollision(BlockType.DIRT);
        this.groundLayer.setCollisionByExclusion([-1]); // Collide with everything except index -1 (EMPTY)
        console.log("Updated ground layer collision map (Simplified).");
    }
}

