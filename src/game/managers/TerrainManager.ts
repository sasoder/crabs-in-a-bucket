// src/game/managers/TerrainManager.ts
import Phaser from "phaser";
import { TILE_SIZE, TileIndex, TILE_TO_PARTICLE_MAP } from "../constants";
import { Boulder } from "../entities/Boulder";
import { Enemy } from "../entities/Enemy";
import { Spike } from "../entities/Spike";
import { EventBus } from "../EventBus";
import { Coin } from "../entities/Coin";
import Game from "../scenes/Game";
import { ParticleManager } from "./ParticleManager";

// Remove local tile index constants since we're now importing from constants.ts

export class TerrainManager {
    private scene: Game;
    private map: Phaser.Tilemaps.Tilemap;
    private groundLayer: Phaser.Tilemaps.TilemapLayer;

    private generatedRowsMaxY: number = 0;
    private bouldersGroup: Phaser.Physics.Arcade.Group;
    private enemiesGroup: Phaser.Physics.Arcade.Group;
    private spikesGroup?: Phaser.Physics.Arcade.StaticGroup;
    private coinsGroup?: Phaser.Physics.Arcade.Group;
    private particleManager?: ParticleManager;

    // --- Row Collider Management ---
    private rowColliderGroup: Phaser.Physics.Arcade.StaticGroup;
    private rowColliders: Map<number, Phaser.GameObjects.GameObject> =
        new Map();
    // --- End Row Collider Management ---

    // Map dimensions (adjust as needed)
    private mapWidthTiles = 25;
    private mapHeightTiles = 500;
    private mapWidthPixels = this.mapWidthTiles * TILE_SIZE;
    private mapHeightPixels = this.mapHeightTiles * TILE_SIZE;

    // --- Generation Parameters (Tunable) ---
    private boulderSpawnChanceBase = 0.022;
    private enemySpawnChanceBase = 0.0035;
    private spikeSpawnChanceBase = 0.03;
    private coinSpawnChanceBase = 0.1;
    private difficultyScaleFactor = 0.008;
    private specialTileChance = 0.05; // Chance for dirt/stone tile (per tile)
    // ---------------------------------------

    // --- Initial Platform ---
    private initialPlatformRows = 5;
    private initialClearRows = 3;
    // ------------------------

    private baseEnemySpeed = 30;
    private enemySpeedDepthScale = 0.5;

    constructor(
        scene: Game,
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

        // Initialize spikesGroup as a StaticGroup
        this.spikesGroup = this.scene.physics.add.staticGroup({
            classType: Spike,
        });

        // --- Initialize new groups ---
        this.rowColliderGroup = this.scene.physics.add.staticGroup();

        // --- Create Tilemap and Layer ---
        this.map = this.scene.make.tilemap({
            tileWidth: TILE_SIZE,
            tileHeight: TILE_SIZE,
            width: this.mapWidthTiles,
            height: this.mapHeightTiles,
        });

        // Link the tileset image loaded in Preloader (ensure 'terrain_tiles' matches the key used in preload)
        const tileset = this.map.addTilesetImage(
            "terrain_tiles", // Key of the loaded tileset image
            "terrain_tiles", // Optional: Key in the cache, usually same as key
            TILE_SIZE,
            TILE_SIZE
            // 0, // margin
            // 0 // spacing
        );

        if (!tileset) {
            console.error("Failed to load 'terrain_tiles' tileset!");
            // Handle error appropriately, maybe throw or default
        } else {
            this.groundLayer = this.map.createBlankLayer(
                "Ground", // Layer name
                tileset,
                0, // x position
                0 // y position
            )!; // Use non-null assertion if confident it exists
            this.groundLayer.setDepth(0); // Keep tiles behind entities
        }
        // --- End Tilemap and Layer Creation ---

        // Set initial generation point (below clear rows)
        this.generatedRowsMaxY = this.initialClearRows * TILE_SIZE;
    }

    // --- NEW: Return the collider group ---
    public getRowColliderGroup(): Phaser.Physics.Arcade.StaticGroup {
        return this.rowColliderGroup;
    }

    // Return spikes group (updated type)
    public getSpikesGroup(): Phaser.Physics.Arcade.StaticGroup | undefined {
        return this.spikesGroup;
    }

    // --- NEW: Public getters for dimensions ---
    public getMapWidthPixels(): number {
        return this.mapWidthPixels;
    }

    public getMapHeightPixels(): number {
        return this.mapHeightPixels;
    }
    // --- END NEW ---

    public getInitialSpawnPoint(): { x: number; y: number } {
        // Spawn player slightly above the first platform row
        const spawnYPx =
            (this.initialPlatformRows - 1) * TILE_SIZE + TILE_SIZE / 2;
        return {
            x: this.mapWidthPixels / 2,
            y: spawnYPx,
        };
    }

    public generateInitialChunk(): void {
        // Generate the initial solid dirt platform first
        const platformWorldY = this.initialPlatformRows * TILE_SIZE;

        // First create all row colliders/visuals
        this.generateRowOnly(platformWorldY, true); // Force generate platform row

        // Generate some rows below the platform to start
        const initialWorldDepthRows = 20;
        const startY = (this.initialPlatformRows + 1) * TILE_SIZE;
        const endY = startY + initialWorldDepthRows * TILE_SIZE;

        for (let y = startY; y < endY; y += TILE_SIZE) {
            this.generateRowOnly(y);
        }

        // Then spawn entities on all the created rows
        // Including platform row (but spawnEntitiesOnRow prevents spawns on platform)
        this.spawnEntitiesOnRow(platformWorldY);
        for (let y = startY; y < endY; y += TILE_SIZE) {
            this.spawnEntitiesOnRow(y);
        }

        this.generatedRowsMaxY = endY;
    }

    public update(cameraBottomY: number): void {
        // Calculate a threshold far enough below the camera to trigger a chunk generation
        const generationThreshold = cameraBottomY + TILE_SIZE * 10;

        if (generationThreshold > this.generatedRowsMaxY) {
            // Instead of generating row by row, generate a chunk of 20 rows at once
            const startY = this.generatedRowsMaxY;
            const chunkSize = 20 * TILE_SIZE; // 20 rows per chunk
            const endY = startY + chunkSize;

            // First, generate ALL row colliders in the chunk
            for (let y = startY; y < endY; y += TILE_SIZE) {
                if (y >= (this.initialPlatformRows + 1) * TILE_SIZE) {
                    // Create the row collider and visual first
                    this.generateRowOnly(y);
                }
            }

            // THEN, spawn entities on the rows (after ALL colliders exist)
            for (let y = startY; y < endY; y += TILE_SIZE) {
                if (y >= (this.initialPlatformRows + 1) * TILE_SIZE) {
                    // Now populate the rows with entities
                    this.spawnEntitiesOnRow(y);
                }
            }

            this.generatedRowsMaxY = endY;
        }
    }

    public clearCurrentRow(triggerWorldY: number): boolean {
        const playerRowYBelow = Math.floor(triggerWorldY / TILE_SIZE) + 1;
        const playerCurrentRow = playerRowYBelow - 1;
        const targetTileY = playerRowYBelow; // Row index to clear

        const collider = this.rowColliders.get(targetTileY);

        if (collider) {
            // Remove collider
            this.rowColliderGroup.remove(collider, true, true);
            this.rowColliders.delete(targetTileY);

            // --- Store tile types before removing them for particle effects ---
            const tileTypes: TileIndex[] = [];

            for (let tileX = 0; tileX < this.mapWidthTiles; tileX++) {
                // Get the tile before removing it
                const tile = this.map.getTileAt(
                    tileX,
                    targetTileY,
                    true,
                    this.groundLayer
                );
                if (tile) {
                    tileTypes[tileX] = tile.index as TileIndex;
                } else {
                    tileTypes[tileX] = TileIndex.SAND; // Default if no tile found
                }

                // Remove the tile
                this.map.removeTileAt(
                    tileX,
                    targetTileY,
                    false,
                    false,
                    this.groundLayer
                );
            }

            // Update tilemap layer
            this.groundLayer?.update();

            // --- Clear Spikes Above (Simplified) ---
            if (this.spikesGroup) {
                const rowAboveWorldY = playerCurrentRow * TILE_SIZE;
                this.spikesGroup.getChildren().forEach((spikeGO) => {
                    const spike = spikeGO as Spike;
                    if (!spike.active) return;
                    if (
                        spike.y > rowAboveWorldY &&
                        spike.y < rowAboveWorldY + TILE_SIZE * 1.2
                    ) {
                        spike.takeDamage(1);
                    }
                });
            }

            // --- Trigger particles based on tile types ---
            if (this.particleManager) {
                const particleY = targetTileY * TILE_SIZE + TILE_SIZE / 2;

                for (let i = 0; i < this.mapWidthTiles; i++) {
                    const particleX = i * TILE_SIZE + TILE_SIZE / 2;
                    const tileType = tileTypes[i];

                    // Get the particle emitter name from the map
                    const particleName =
                        TILE_TO_PARTICLE_MAP[tileType] || "sand_tile";

                    if (particleName) {
                        this.particleManager.triggerParticles(
                            particleName,
                            particleX,
                            particleY,
                            { count: 5 }
                        );
                    }
                }
            }

            EventBus.emit("dirt-row-cleared", { tileY: targetTileY });
            return true;
        } else {
            return false;
        }
    }

    /**
     * Generates just the row collider and places tiles onto the tilemap layer.
     * @param worldY The world Y coordinate of the top of the row to generate.
     * @param forceGenerate Skip checks, used for initial platform.
     */
    private generateRowOnly(worldY: number, forceGenerate = false): void {
        const tileY = Math.floor(worldY / TILE_SIZE);

        if (
            tileY < 0 ||
            tileY >= this.mapHeightTiles ||
            this.rowColliders.has(tileY)
        ) {
            return;
        }

        // Skip generation above initial platform unless forced
        if (!forceGenerate && tileY <= this.initialPlatformRows) {
            return;
        }

        // Create collider
        const colliderYOffset = TILE_SIZE * 0.9;
        const colliderHeight = TILE_SIZE * 0.1;

        const collider = this.scene.physics.add.staticImage(
            0,
            worldY + colliderYOffset,
            ""
        );
        collider.setVisible(false);
        collider.body.setSize(this.mapWidthPixels + 30, colliderHeight);
        collider.body.setOffset(0, 0);
        collider.setData("isRowCollider", true);
        collider.setData("rowY", tileY);

        this.rowColliderGroup.add(collider);
        this.rowColliders.set(tileY, collider);

        // Place Tiles onto Tilemap Layer
        for (let tileX = 0; tileX < this.mapWidthTiles; tileX++) {
            // Determine tile index
            // Use SAND for the platform, otherwise default to SAND before random variations
            let tileIndex = forceGenerate ? TileIndex.SAND : TileIndex.SAND;

            // Apply variations only for non-platform rows
            if (!forceGenerate) {
                const randomChance = Math.random();
                if (randomChance < this.specialTileChance) {
                    tileIndex =
                        Math.random() < 0.5 ? TileIndex.DIRT : TileIndex.STONE;
                }
            }

            // Place the tile
            this.map.putTileAt(tileIndex, tileX, tileY, true, this.groundLayer);
        }
    }

    /**
     * Spawns entities on an existing row.
     * @param worldY The world Y coordinate of the top of the row.
     */
    private spawnEntitiesOnRow(worldY: number): void {
        const tileY = Math.floor(worldY / TILE_SIZE);

        // Check that the row exists
        if (!this.rowColliders.has(tileY)) {
            return;
        }

        // Don't spawn entities on initial platform rows
        if (tileY <= this.initialPlatformRows) return;

        // Calculate spawn chances based on depth
        const depthInRows = tileY - (this.initialPlatformRows + 1); // Rows below platform
        const depthFactor =
            Math.max(0, depthInRows) * this.difficultyScaleFactor;

        const currentBoulderChance = this.boulderSpawnChanceBase;
        const currentEnemyChance = this.enemySpawnChanceBase + depthFactor;
        const currentSpikeChance = this.spikeSpawnChanceBase + depthFactor;
        const currentCoinChance = this.coinSpawnChanceBase;

        // Calculate enemy speed based on depth
        const currentEnemySpeed = Math.min(
            100, // Max speed cap
            this.baseEnemySpeed + depthInRows * this.enemySpeedDepthScale
        );

        // Determine exact spawn surface Y coordinate
        const colliderYOffset = TILE_SIZE * 0.9;
        const colliderHeight = TILE_SIZE * 0.1;
        const spawnSurfaceY = worldY + colliderYOffset - colliderHeight / 2; // Surface is top of collider
        const spikeSpawnY = worldY; // Adjust spike spawn Y for top of row

        // Iterate through each tile position in the row
        for (let tileX = 0; tileX < this.mapWidthTiles; tileX++) {
            const spawnWorldX = tileX * TILE_SIZE + TILE_SIZE / 2;

            // Check for existing entities at this position
            let spaceOccupied = false;
            let occupyingEntityInfo = "None"; // For logging

            // Define a precise area for checking entity overlap
            const safeSpawnCheckArea = {
                x: spawnWorldX - TILE_SIZE / 2,
                y: spawnSurfaceY - TILE_SIZE / 2,
                width: TILE_SIZE,
                height: TILE_SIZE,
            };

            // Check all entity groups to see if the space is already occupied
            const groupsToCheck = [
                this.bouldersGroup,
                this.enemiesGroup,
                this.spikesGroup,
                // Don't check coins group here, as they shouldn't block others
            ];

            for (const group of groupsToCheck) {
                if (!group) continue;

                group.getChildren().forEach((go) => {
                    // Added check to prevent reading body of already potentially destroyed object
                    if (!go || !go.body) return;

                    const body = go.body as
                        | Phaser.Physics.Arcade.Body
                        | Phaser.Physics.Arcade.StaticBody;

                    // Check if entity bounds overlap with our safe spawn area
                    const entityBounds = {
                        x: body.position.x,
                        y: body.position.y,
                        width: body.width,
                        height: body.height,
                    };

                    if (
                        entityBounds.x <
                            safeSpawnCheckArea.x + safeSpawnCheckArea.width &&
                        entityBounds.x + entityBounds.width >
                            safeSpawnCheckArea.x &&
                        entityBounds.y <
                            safeSpawnCheckArea.y + safeSpawnCheckArea.height &&
                        entityBounds.y + entityBounds.height >
                            safeSpawnCheckArea.y
                    ) {
                        spaceOccupied = true;
                        // Get more info about the blocking entity
                        const entityType =
                            (go.constructor as any).name || "Unknown";
                        occupyingEntityInfo = `${entityType} at (${body.position.x.toFixed(
                            1
                        )}, ${body.position.y.toFixed(1)})`;
                    }
                });

                if (spaceOccupied) break; // Stop checking groups if occupied
            }

            // Check Boulder
            const tryBoulder = Math.random() < currentBoulderChance;
            if (tryBoulder) {
                try {
                    const spawnY = spawnSurfaceY - TILE_SIZE / 2 - 2; // Added - 2 buffer
                    const boulder = new Boulder(
                        this.scene,
                        spawnWorldX - TILE_SIZE / 2, // Center horizontally
                        spawnY // Position slightly above the surface
                    );

                    if (boulder) {
                        boulder.setDepth(10);
                        this.bouldersGroup.add(boulder);
                        // Log successful spawn

                        // We continue immediately after spawning a boulder
                    }
                } catch (error) {
                    console.error("Error spawning boulder:", error);
                }
                continue; // Move to next tile position after attempting boulder
            }

            // Check Enemy - only if boulder didn't spawn
            const tryEnemy = Math.random() < currentEnemyChance;
            if (tryEnemy) {
                try {
                    const spawnY = spawnSurfaceY - TILE_SIZE / 2 - 2; // Added - 2 buffer
                    const enemy = new Enemy(
                        this.scene,
                        spawnWorldX - TILE_SIZE / 2, // Center horizontally
                        spawnY // Position slightly above the surface
                    );

                    if (enemy) {
                        enemy.setDepth(10);
                        enemy.setSpeed(currentEnemySpeed);
                        this.enemiesGroup.add(enemy);
                    }
                } catch (error) {
                    console.error("Error spawning enemy:", error);
                }
                continue; // Move to next tile position after attempting enemy
            }

            // Check Spike - only if boulder/enemy didn't spawn
            const trySpike = Math.random() < currentSpikeChance;
            if (trySpike && this.spikesGroup) {
                // Log spawn attempt

                try {
                    const spike = new Spike(
                        this.scene,
                        spawnWorldX - TILE_SIZE / 2, // Adjust X because origin is center
                        spikeSpawnY + 9 // Y is the top of the row + offset
                    );

                    if (spike) {
                        spike.setDepth(10);
                        this.spikesGroup.add(spike);
                    }
                } catch (error) {
                    console.error("Error spawning spike:", error);
                }
                continue; // Move to next tile position after attempting spike
            }

            const tryCoin = Math.random() < currentCoinChance;
            if (tryCoin && this.coinsGroup) {
                try {
                    const spawnY = spawnSurfaceY - TILE_SIZE / 2 - 2; // Added - 2 buffer
                    Coin.spawn(
                        this.scene,
                        this.coinsGroup,
                        spawnWorldX - TILE_SIZE / 2, // Center horizontally
                        spawnY // Position slightly above the surface
                    );

                    // Ensure coins have proper depth
                    this.coinsGroup.setDepth(10);
                } catch (error) {
                    console.error("Error spawning coin:", error);
                }
                // No continue here, allow checking next tile
            }
        }
    }

    // --- REVISED handleCreateExplosion --- Works on rows now
    public handleCreateExplosion(data: {
        worldX: number;
        worldY: number;
        radius: number;
    }) {
        const radiusSq = data.radius * data.radius;
        const centerTileX = Math.floor(data.worldX / TILE_SIZE);
        const centerTileY = Math.floor(data.worldY / TILE_SIZE);
        const tileRadius = Math.ceil(data.radius / TILE_SIZE);

        // Clear rows within the blast radius
        for (let dy = -tileRadius; dy <= tileRadius; dy++) {
            const targetTileY = centerTileY + dy;
            const rowWorldY = targetTileY * TILE_SIZE;

            // Check vertical distance roughly
            const yDist = data.worldY - (rowWorldY + TILE_SIZE / 2);
            if (yDist * yDist > radiusSq) continue; // Skip row if too far vertically

            // Attempt to clear the entire row if any part is within radius (simplification)
            // A more precise check could iterate columns, but clearing full row is simpler
            // Check horizontal distance of row center to explosion center
            const xDist = data.worldX - this.mapWidthPixels / 2;
            const checkRadiusSq =
                radiusSq +
                (this.mapWidthPixels / 2) * (this.mapWidthPixels / 2); // Allow hitting edge
            if (xDist * xDist + yDist * yDist <= checkRadiusSq) {
                this.clearCurrentRow(rowWorldY - TILE_SIZE / 2); // Pass Y above the target row
            }
        }

        // Damage/Destroy Entities in blast radius (remains similar)
        const explosionWorldX = data.worldX;
        const explosionWorldY = data.worldY;

        // Damage Enemies
        this.enemiesGroup?.getChildren().forEach((enemyGO) => {
            const enemy = enemyGO as Enemy;
            if (!enemy.active) return;
            const distSq = Phaser.Math.Distance.Squared(
                explosionWorldX,
                explosionWorldY,
                enemy.x,
                enemy.y
            );
            if (distSq <= radiusSq) {
                enemy.takeDamage(999); // Instant kill in blast
            }
        });

        // Damage Spikes - Use direct distance check
        this.spikesGroup?.getChildren().forEach((spikeGO) => {
            const spike = spikeGO as Spike;
            if (!spike.active) return;

            const distSq = Phaser.Math.Distance.Squared(
                explosionWorldX,
                explosionWorldY,
                spike.x, // Spike's position
                spike.y
            );

            if (distSq <= radiusSq) {
                spike.takeDamage(1); // Kill spike in explosion
            }
        });

        // Damage Boulders
        this.bouldersGroup?.getChildren().forEach((boulderGO) => {
            const boulder = boulderGO as Boulder;
            if (!boulder.active) return;
            const distSq = Phaser.Math.Distance.Squared(
                explosionWorldX,
                explosionWorldY,
                boulder.x,
                boulder.y
            );
            if (distSq <= radiusSq) {
                // Apply enough damage to destroy boulder in explosion
                boulder.takeDamage(3);
            }
        });
    }
    // --- END REVISED ---

    // Optional: Add cleanup method
    public destroy() {
        this.rowColliders.clear();
        this.rowColliderGroup.destroy(true);
        this.spikesGroup?.destroy(true);

        // Destroy tilemap resources
        this.groundLayer?.destroy();
        this.map?.destroy();

        // Clear references
        this.particleManager = undefined;
        this.coinsGroup = undefined;
        this.spikesGroup = undefined;
        // bouldersGroup and enemiesGroup are passed in, so ownership might be in the Scene
    }

    /**
     * Gets the Y coordinate where an entity should be positioned to stand on a row.
     * This helps entities "snap" to the surface of a row when walking on it.
     *
     * @param rowY The row index (not world coordinate)
     * @param entityHeight The height of the entity in pixels
     * @returns The world Y coordinate where the entity's bottom should be positioned
     */
    public getRowSurfaceY(rowY: number, entityHeight: number): number {
        // Row world Y is the top of the row
        const rowTopY = rowY * TILE_SIZE;

        // Return the position for the entity's bottom to be exactly at the row's top
        return rowTopY - entityHeight / 2;
    }
}

