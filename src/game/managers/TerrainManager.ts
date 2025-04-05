// src/game/managers/TerrainManager.ts
import Phaser from "phaser";
import { BlockType, TILE_SIZE } from "../constants";
import { Boulder } from "../entities/Boulder";
import { Enemy } from "../entities/Enemy";
import { BlockConfig } from "../types/BlockConfig";
import { EventBus } from "../EventBus"; // Import EventBus
import { Coin } from "../entities/Coin";

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
    private coinsGroup?: Phaser.Physics.Arcade.Group;
    private particleManager?: any;
    // Add a map to track block health
    private blockHealth: Map<string, number> = new Map();

    // Map dimensions (adjust as needed)
    private mapWidth = 30; // Increased width for more space
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
        enemiesGroup: Phaser.Physics.Arcade.Group,
        coinsGroup?: Phaser.Physics.Arcade.Group,
        particleManager?: any
    ) {
        this.scene = scene;
        this.bouldersGroup = bouldersGroup;
        this.enemiesGroup = enemiesGroup;
        this.coinsGroup = coinsGroup;
        this.particleManager = particleManager;

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

    // Helper method to generate unique tile key
    private getTileKey(tileX: number, tileY: number): string {
        return `${tileX},${tileY}`;
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

        const tile = this.groundLayer.getTileAt(tileX, tileY);
        const blockConfig = this.getBlockConfigFromTile(tile);

        if (tile && blockConfig?.isDestructible) {
            const blockType = blockConfig.id;
            const textureKey = blockConfig.textureKey ?? null;
            const baseCoinChance = blockConfig.dropsCoinChance ?? 0;
            const tileKey = this.getTileKey(tileX, tileY);
            const hardness = blockConfig.hardness ?? 1;

            // Initialize health if not already tracked
            if (!this.blockHealth.has(tileKey)) {
                this.blockHealth.set(tileKey, hardness);
            }

            // Get current health and reduce by 1
            let currentHealth = this.blockHealth.get(tileKey) || 0;
            currentHealth--;

            // Update health or destroy if depleted
            if (currentHealth <= 0) {
                // Block is fully destroyed
                this.groundLayer.removeTileAt(tileX, tileY);
                this.blockHealth.delete(tileKey);
                console.log(
                    `Fully destroyed block at [${tileX}, ${tileY}], type: ${BlockType[blockType]}`
                );

                // Handle block destruction effects
                this.handleBlockDestroyed(
                    tile.pixelX,
                    tile.pixelY,
                    blockType,
                    baseCoinChance,
                    textureKey
                );
            } else {
                // Block is damaged but not destroyed
                this.blockHealth.set(tileKey, currentHealth);
                console.log(
                    `Damaged block at [${tileX}, ${tileY}], type: ${BlockType[blockType]}, health: ${currentHealth}/${hardness}`
                );

                // Visual feedback for damage
                this.showBlockDamageEffect(tile, currentHealth, hardness);
            }

            result = { textureKey: textureKey, blockType: blockType };
        } else {
            console.log(
                `Failed to dig block at [${tileX}, ${tileY}] (Tile: ${tile?.index}, Config: ${blockConfig?.id}, Destructible: ${blockConfig?.isDestructible})`
            );
            result.blockType = blockConfig?.id ?? null; // Still return block type if known
        }

        return result; // Return texture key and block type
    }

    private showBlockDamageEffect(
        tile: Phaser.Tilemaps.Tile,
        currentHealth: number,
        maxHealth: number
    ) {
        // Calculate damage percentage
        const damagePercent = 1 - currentHealth / maxHealth;

        // Apply visual effect based on damage level
        // Here we're just changing the alpha, but you could use a texture or tint
        if (damagePercent <= 0.33) {
            tile.setAlpha(0.9); // Slightly damaged
        } else if (damagePercent <= 0.66) {
            tile.setAlpha(0.75); // Medium damage
        } else {
            tile.setAlpha(0.5); // Heavily damaged
        }

        // Optional: apply a crack overlay or tint
        tile.tint = 0xcccccc; // Slight gray tint

        // Create small damage particles
        if (this.particleManager) {
            const config = this.getBlockConfigFromTile(tile);
            if (config?.textureKey) {
                // Use fewer particles for damage effect
                this.particleManager.triggerParticles(
                    config.textureKey,
                    tile.pixelX,
                    tile.pixelY,
                    { count: 3 }
                );
                console.log(
                    `Triggered damage particles for ${config.textureKey} at (${tile.pixelX}, ${tile.pixelY})`
                );
            }
        }
    }

    public handleBlockDestroyed(
        worldX: number,
        worldY: number,
        blockType: BlockType,
        baseCoinChance: number,
        textureKey: string | null
    ) {
        // Show particles if particle manager exists
        if (textureKey && this.particleManager) {
            // Use stronger particle effect for complete destruction
            this.particleManager.triggerParticles(textureKey, worldX, worldY, {
                count: 30,
            });
            console.log(
                `Triggered destruction particles for ${textureKey} at (${worldX}, ${worldY})`
            );
        }

        // Handle coin spawning
        let finalCoinChance = baseCoinChance;
        const currentRelics = this.scene.registry.get("relics") as string[];
        if (currentRelics.includes("excavators-greed")) {
            finalCoinChance += 0.05;
        }

        if (finalCoinChance > 0 && Math.random() < finalCoinChance) {
            this.spawnCoin(worldX, worldY);
        }

        if (blockType === BlockType.GOLD) {
            this.spawnCoin(worldX, worldY, 3);
        }

        // Emit event with relevant data for other systems to react to
        EventBus.emit("block-destroyed", {
            worldX: worldX,
            worldY: worldY,
            blockType: blockType,
            baseCoinChance: baseCoinChance,
            textureKey: textureKey,
        });
    }

    private spawnCoin(worldX: number, worldY: number, count: number = 1) {
        if (!this.coinsGroup) {
            console.warn("Cannot spawn coin: coins group not initialized");
            return;
        }

        Coin.spawn(this.scene, this.coinsGroup, worldX, worldY, count);
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
                // Clear any health tracking for this tile
                this.blockHealth.delete(this.getTileKey(tileX, tileY));
                return null; // Indicate no tile was placed
            } else {
                console.warn(
                    `Config lookup failed for non-EMPTY type ${BlockType[blockType]}. Handling as EMPTY.`
                );
                this.groundLayer.removeTileAt(tileX, tileY);
                this.blockHealth.delete(this.getTileKey(tileX, tileY));
                return null;
            }
        }

        // Log before putting tile
        // console.log(`Attempting placeBlock [${tileX}, ${tileY}], type: ${BlockType[blockType]} (ID: ${config.id})`);

        let tile: Phaser.Tilemaps.Tile | null = null;
        try {
            // Use config.id which corresponds to the BlockType enum value / tileset GID
            tile = this.groundLayer.putTileAt(config.id, tileX, tileY);

            // Initialize block health based on hardness
            if (tile && config.hardness) {
                this.blockHealth.set(
                    this.getTileKey(tileX, tileY),
                    config.hardness
                );
            }
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

    public handleCreateExplosion(data: {
        worldX: number;
        worldY: number;
        radius: number;
    }) {
        console.warn("Explosion handling not yet implemented.", data);
        // Implementation for causing an explosion that destroys multiple blocks in an area
    }
}

