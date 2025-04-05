// src/game/managers/TerrainManager.ts
import Phaser from "phaser";
import { BlockType, TILE_SIZE } from "../constants";
import { Boulder } from "../entities/Boulder";
import { Enemy } from "../entities/Enemy";
import { BlockConfig } from "../types/BlockConfig";
import { EventBus } from "../EventBus"; // Import EventBus

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
    [BlockType.STONE]: {
        id: BlockType.STONE,
        textureKey: "stone_tile",
        isDestructible: true,
        hardness: 3, // Harder than dirt
        dropsCoinChance: 0.01, // Lower chance than dirt
    },
    [BlockType.GOLD]: {
        id: BlockType.GOLD,
        textureKey: "gold_tile",
        isDestructible: true,
        hardness: 2, // Easier than stone? Maybe drop more coins?
        dropsCoinChance: 1, // Higher chance for gold
    },
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
    private stoneSpawnChanceBase = 0.1; // Chance to replace dirt with stone
    private goldSpawnChanceBase = 0.02; // Chance to replace dirt/stone with gold
    private difficultyScaleFactor = 0.0005; // Increases enemy/boulder/rarity with depth
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

        // --- Add all required tilesets ---
        // Ensure texture keys match those generated in Game.ts preload
        const dirtTileset = this.map.addTilesetImage(
            "dirt_tile",
            undefined,
            TILE_SIZE,
            TILE_SIZE,
            0,
            0,
            BlockType.DIRT
        );
        const stoneTileset = this.map.addTilesetImage(
            "stone_tile",
            undefined,
            TILE_SIZE,
            TILE_SIZE,
            0,
            0,
            BlockType.STONE
        );
        const goldTileset = this.map.addTilesetImage(
            "gold_tile",
            undefined,
            TILE_SIZE,
            TILE_SIZE,
            0,
            0,
            BlockType.GOLD
        );

        // Log creation results for debugging
        console.log("Created Dirt Tileset:", dirtTileset);
        console.log("Created Stone Tileset:", stoneTileset);
        console.log("Created Gold Tileset:", goldTileset);

        const tilesets = [dirtTileset, stoneTileset, goldTileset].filter(
            (ts) => ts !== null
        ) as Phaser.Tilemaps.Tileset[];

        if (tilesets.length < 3) {
            // Check if all 3 were created
            console.error(
                `Failed to create one or more tilesets in TerrainManager. Check texture keys: 'dirt_tile', 'stone_tile', 'gold_tile'. Created:`,
                tilesets.map((ts) => ts.name)
            );
            // Optionally throw an error or handle differently
            throw new Error("Failed to create all required tilesets");
        }

        // --- Create layer with all tilesets ---
        this.groundLayer = this.map.createBlankLayer(
            "Ground",
            tilesets, // Pass the array of valid tilesets
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

    public digBlockAt(
        worldX: number,
        worldY: number
    ): { textureKey: string | null; blockType: BlockType | null } {
        const tileX = this.groundLayer.worldToTileX(worldX);
        const tileY = this.groundLayer.worldToTileY(worldY);
        let result: { textureKey: string | null; blockType: BlockType | null } =
            { textureKey: null, blockType: null };

        if (tileX === null || tileY === null) return result;

        const tileToRemove = this.groundLayer.getTileAt(tileX, tileY);
        const blockConfig = this.getBlockConfigFromTile(tileToRemove);

        if (tileToRemove && blockConfig?.isDestructible) {
            const blockType = blockConfig.id;
            const textureKey = blockConfig.textureKey ?? null;
            const baseCoinChance = blockConfig.dropsCoinChance ?? 0;

            this.groundLayer.removeTileAt(tileX, tileY); // Remove the tile first
            console.log(
                `Dug block at [${tileX}, ${tileY}], type: ${BlockType[blockType]}`
            );

            // Emit event with relevant data
            EventBus.emit("block-destroyed", {
                worldX: tileToRemove.pixelX, // Use tile's pixel coords for accurate spawning
                worldY: tileToRemove.pixelY,
                blockType: blockType,
                baseCoinChance: baseCoinChance,
                textureKey: textureKey, // Pass texture key for particles
            });

            result = { textureKey: textureKey, blockType: blockType };
        } else {
            console.log(
                `Failed to dig block at [${tileX}, ${tileY}] (Tile: ${tileToRemove?.index}, Config: ${blockConfig?.id}, Destructible: ${blockConfig?.isDestructible})`
            );
            result.blockType = blockConfig?.id ?? null; // Still return block type if known
        }

        return result; // Return texture key and block type
    }

    public getBlockConfigFromTile(
        tile: Phaser.Tilemaps.Tile | null
    ): BlockConfig | null {
        if (!tile || tile.index === -1) return null;
        // Find the BlockType enum value matching the tile index
        // Tileset GIDs ensure tile.index directly maps to BlockType enum value
        const blockType = tile.index as BlockType; // Direct cast should be safe now
        return blockConfigs[blockType] ?? null; // Use the direct blockType value
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

        const config = blockConfigs[blockType]; // Get config

        if (!config) {
            // Handle EMPTY case explicitly
            if (blockType === BlockType.EMPTY) {
                // Ensure tile is actually removed if it exists
                this.groundLayer.removeTileAt(tileX, tileY);
                return null; // Indicate no tile was placed
            } else {
                console.warn(
                    `Config lookup failed for non-EMPTY type ${BlockType[blockType]}. Handling as EMPTY.`
                );
                this.groundLayer.removeTileAt(tileX, tileY);
                return null;
            }
        }

        // Log before putting tile
        // console.log(`Attempting placeBlock [${tileX}, ${tileY}], type: ${BlockType[blockType]} (ID: ${config.id})`);

        let tile: Phaser.Tilemaps.Tile | null = null;
        try {
            // Use config.id which corresponds to the BlockType enum value / tileset GID
            tile = this.groundLayer.putTileAt(config.id, tileX, tileY);
        } catch (error) {
            console.error(
                `!!! ERROR during putTileAt [${tileX}, ${tileY}] with ID ${config.id} !!!`
            );
            console.error("Layer state:", this.groundLayer);
            console.error("Error object:", error);
            // Decide if you want to re-throw or handle gracefully
            // throw error;
            return null; // Return null on error
        }

        // console.log("Result of putTileAt:", tile ? `Index ${tile.index}` : 'null');
        if (!tile) {
            console.warn(
                `putTileAt returned null for config.id ${config.id} at [${tileX}, ${tileY}]`
            );
        }
        return tile;
    }

    private generateRow(worldY: number): void {
        const tileY = this.groundLayer.worldToTileY(worldY);
        if (tileY === null || tileY < 0 || tileY >= this.mapHeight) return;

        const depthFactor = Math.max(0, worldY) * this.difficultyScaleFactor;
        const currentBoulderChance = this.boulderSpawnChanceBase + depthFactor;
        const currentEnemyChance = this.enemySpawnChanceBase + depthFactor;
        // Adjust stone/gold chance based on depth too
        const currentStoneChance = this.stoneSpawnChanceBase + depthFactor * 2; // Stone becomes more common faster
        const currentGoldChance = this.goldSpawnChanceBase + depthFactor * 0.5; // Gold rarity increases slower

        for (let tileX = 0; tileX < this.mapWidth; tileX++) {
            const worldX = this.groundLayer.tileToWorldX(tileX);
            let blockToPlace: BlockType = BlockType.EMPTY; // Default to empty

            // Determine base block type (Dirt or Empty)
            // Basic terrain pattern - higher chance of blocks deeper down
            const baseFillChance = 0.6 + Math.min(0.35, depthFactor * 5); // Increase density with depth up to 95%
            if (Math.random() < baseFillChance) {
                // Start with DIRT, then potentially upgrade
                blockToPlace = BlockType.DIRT;

                // Chance to upgrade Dirt -> Stone
                if (Math.random() < currentStoneChance) {
                    blockToPlace = BlockType.STONE;
                }

                // Chance to upgrade (Dirt or Stone) -> Gold
                // Check *after* stone, so gold can replace stone too
                if (Math.random() < currentGoldChance) {
                    blockToPlace = BlockType.GOLD;
                }
            }

            // Check for Boulder spawn (overrides block placement)
            let isBoulderSpot = false;
            if (
                blockToPlace !== BlockType.EMPTY &&
                Math.random() < currentBoulderChance
            ) {
                const boulder = new Boulder(
                    this.scene,
                    worldX! + TILE_SIZE / 2,
                    worldY + TILE_SIZE / 2 // Place boulder centered in the tile's Y
                );
                this.bouldersGroup.add(boulder);
                blockToPlace = BlockType.EMPTY; // Clear the tile where the boulder will be
                isBoulderSpot = true;
            }

            // Place the determined block (or clear if EMPTY/Boulder)
            // This uses the refined placeBlock which handles EMPTY correctly
            this.placeBlock(tileX, tileY, blockToPlace);

            // Check for Enemy spawn (only if spot is truly EMPTY and not a boulder spot)
            if (
                blockToPlace === BlockType.EMPTY &&
                !isBoulderSpot &&
                Math.random() < currentEnemyChance
            ) {
                const tileBelow = this.groundLayer.getTileAt(tileX, tileY + 1);
                const configBelow = this.getBlockConfigFromTile(tileBelow);

                // Spawn if block below is solid (any type, configBelow will be null for EMPTY)
                if (configBelow) {
                    // Double-check current spot is actually empty on the map before spawning
                    const tileAtSpawn = this.groundLayer.getTileAt(
                        tileX,
                        tileY
                    );
                    // Check if tile is null (doesn't exist) or index is -1 (explicitly empty)
                    if (!tileAtSpawn || tileAtSpawn.index === -1) {
                        const enemy = new Enemy(
                            this.scene,
                            worldX! + TILE_SIZE / 2,
                            worldY + TILE_SIZE / 2 // Center enemy Y too
                        );
                        this.enemiesGroup.add(enemy);
                        // console.log(`Spawned enemy at ${tileX}, ${tileY}`);
                    }
                }
            }
        }
    }

    private updateCollision(): void {
        // Set collision for DIRT, STONE, GOLD. Exclude EMPTY (-1 and potentially 0).
        // BlockType enum: EMPTY=0, DIRT=1, STONE=2, GOLD=3
        // Exclude -1 (no tile) and 0 (EMPTY tile type)
        this.groundLayer.setCollisionByExclusion([-1, BlockType.EMPTY]);
        // Alternatively, be explicit about colliding tiles:
        // this.groundLayer.setCollision([BlockType.DIRT, BlockType.STONE, BlockType.GOLD]);
        console.log("Updated ground layer collision (Dirt, Stone, Gold).");
    }
}

