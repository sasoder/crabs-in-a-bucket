// src/game/managers/TerrainManager.ts
import Phaser from "phaser";
import { TILE_SIZE } from "../constants"; // Keep TILE_SIZE for row height
import { Boulder } from "../entities/Boulder";
import { Enemy } from "../entities/Enemy";
// import { BlockConfig } from "../types/BlockConfig"; // Not needed
import { EventBus } from "../EventBus";
import { Coin } from "../entities/Coin";
import { GoldEntity } from "../entities/GoldEntity";
import Game from "../scenes/Game"; // Import Game scene type

// --- Remove BlockType and blockConfigs ---

export class TerrainManager {
    private scene: Game; // Use specific Game type
    // --- Remove map and groundLayer ---
    // private map: Phaser.Tilemaps.Tilemap;
    // private groundLayer: Phaser.Tilemaps.TilemapLayer;

    private generatedRowsMaxY: number = 0;
    private bouldersGroup: Phaser.Physics.Arcade.Group;
    private enemiesGroup: Phaser.Physics.Arcade.Group;
    private goldEntitiesGroup: Phaser.Physics.Arcade.Group;
    private coinsGroup?: Phaser.Physics.Arcade.Group;
    private particleManager?: any; // Assuming ParticleManager exists

    // --- NEW: Row Management ---
    private rowColliderGroup: Phaser.Physics.Arcade.StaticGroup;
    private rowVisualsGroup: Phaser.GameObjects.Group;
    private rowColliders: Map<number, Phaser.GameObjects.GameObject> =
        new Map();
    private rowVisuals: Map<number, Phaser.GameObjects.GameObject> = new Map();
    // --------------------------

    // Map dimensions (adjust as needed)
    private mapWidthTiles = 30; // Width in terms of tiles/columns
    private mapHeightTiles = 500; // Max height in terms of tiles/rows
    private mapWidthPixels = this.mapWidthTiles * TILE_SIZE;
    private mapHeightPixels = this.mapHeightTiles * TILE_SIZE;

    // --- Generation Parameters (Tunable) ---
    private boulderSpawnChanceBase = 0.005;
    private enemySpawnChanceBase = 0.008;
    private goldEntitySpawnChanceBase = 0.004;
    private difficultyScaleFactor = 0.0003;
    // ---------------------------------------

    // --- Initial Platform ---
    private initialPlatformRows = 5; // How many rows down the starting platform is
    private initialClearRows = 3; // How many empty rows above the platform
    // ------------------------

    private baseEnemySpeed = 30; // Define a base speed
    private enemySpeedDepthScale = 0.5; // How much speed increases per row depth

    constructor(
        scene: Game, // Use specific Game type
        bouldersGroup: Phaser.Physics.Arcade.Group,
        enemiesGroup: Phaser.Physics.Arcade.Group,
        goldEntitiesGroup: Phaser.Physics.Arcade.Group,
        coinsGroup?: Phaser.Physics.Arcade.Group,
        particleManager?: any
    ) {
        this.scene = scene;
        this.bouldersGroup = bouldersGroup;
        this.enemiesGroup = enemiesGroup;
        this.goldEntitiesGroup = goldEntitiesGroup;
        this.coinsGroup = coinsGroup;
        this.particleManager = particleManager;

        // --- Initialize new groups ---
        this.rowColliderGroup = this.scene.physics.add.staticGroup();
        this.rowVisualsGroup = this.scene.add.group();
        // -----------------------------

        // --- Remove tilemap and layer creation ---

        // Set initial generation point (below clear rows)
        this.generatedRowsMaxY = this.initialClearRows * TILE_SIZE;

        console.log("TerrainManager initialized for row-based system.");
    }

    // --- NEW: Public getters for dimensions ---
    public getMapWidthPixels(): number {
        return this.mapWidthPixels;
    }

    public getMapHeightPixels(): number {
        return this.mapHeightPixels;
    }
    // --- END NEW ---

    // --- NEW: Return the collider group ---
    public getRowColliderGroup(): Phaser.Physics.Arcade.StaticGroup {
        return this.rowColliderGroup;
    }
    // --- REMOVED getGroundLayer ---
    // --- REMOVED getMap ---

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
        console.log(
            `Generating initial platform at row Y=${this.initialPlatformRows}`
        );
        const platformWorldY = this.initialPlatformRows * TILE_SIZE;
        this.generateRow(platformWorldY, true); // Force generate platform row

        // Generate some rows below the platform to start
        const initialWorldDepthRows = 20;
        const startY = (this.initialPlatformRows + 1) * TILE_SIZE;
        const endY = startY + initialWorldDepthRows * TILE_SIZE;

        console.log(`Generating initial chunk from Y=${startY} to Y=${endY}`);
        for (let y = startY; y < endY; y += TILE_SIZE) {
            this.generateRow(y);
        }
        this.generatedRowsMaxY = endY;
        // --- REMOVED updateCollision call --- Collision is handled per-sprite
    }

    public update(cameraBottomY: number): void {
        const generationThreshold = cameraBottomY + TILE_SIZE * 10; // Generate further ahead

        if (generationThreshold > this.generatedRowsMaxY) {
            const startY = this.generatedRowsMaxY;
            const endY = generationThreshold;
            for (let y = startY; y < endY; y += TILE_SIZE) {
                // Only generate rows below the initial platform naturally
                if (y >= (this.initialPlatformRows + 1) * TILE_SIZE) {
                    this.generateRow(y);
                }
            }
            this.generatedRowsMaxY = endY;
        }
    }

    public clearCurrentRow(triggerWorldY: number): boolean {
        // Calculate which row the player is currently on
        const playerRowY = Math.floor(triggerWorldY / TILE_SIZE);

        // Get the current row the player is standing on (not the one below)
        const targetRowWorldY = playerRowY * TILE_SIZE;
        const targetTileY = playerRowY; // Current row index, not the one below

        console.log(
            `Attempting to clear row at tileY=${targetTileY} (WorldY ~${targetRowWorldY})`
        );

        const collider = this.rowColliders.get(targetTileY);
        const visual = this.rowVisuals.get(targetTileY);

        if (collider) {
            console.log(`Clearing collider for row ${targetTileY}`);
            this.rowColliderGroup.remove(collider, true, true); // Remove from group, destroy GO, destroy body
            this.rowColliders.delete(targetTileY);

            if (visual) {
                console.log(`Clearing visual for row ${targetTileY}`);
                this.rowVisualsGroup.remove(visual, true); // Remove from group, destroy GO
                this.rowVisuals.delete(targetTileY);
            }

            // Trigger particles across the cleared row
            if (this.particleManager) {
                const particleY = targetRowWorldY + TILE_SIZE / 2;
                for (let i = 0; i < this.mapWidthTiles; i++) {
                    this.particleManager.triggerParticles(
                        "dirt_tile", // Use dirt texture key for particles for now
                        i * TILE_SIZE + TILE_SIZE / 2,
                        particleY,
                        { count: 3 } // Adjust count as needed
                    );
                }
            }

            // Optional: Emit an event that a row was cleared
            EventBus.emit("dirt-row-cleared", { tileY: targetTileY });
            return true; // Row cleared
        } else {
            return false; // No row to clear
        }
    }

    private spawnCoin(worldX: number, worldY: number, count: number = 1) {
        if (!this.coinsGroup) {
            console.warn("Cannot spawn coin: coins group not initialized");
            return;
        }
        Coin.spawn(this.scene, this.coinsGroup, worldX, worldY, count);
    }
    public hasRowColliderAt(tileY: number): boolean {
        return this.rowColliders.has(tileY);
    }
    /**
     * Generates a single row's collider and visuals.
     * @param worldY The world Y coordinate of the top of the row to generate.
     * @param forceGenerate Skip checks, used for initial platform.
     */
    private generateRow(worldY: number, forceGenerate = false): void {
        const tileY = Math.floor(worldY / TILE_SIZE);
        if (
            tileY < 0 ||
            tileY >= this.mapHeightTiles ||
            this.rowColliders.has(tileY)
        ) {
            return; // Out of bounds or already generated
        }

        // Skip generation above initial platform unless forced
        if (!forceGenerate && tileY <= this.initialPlatformRows) {
            return;
        }

        // 1. Create Row Collider (Invisible Static Sprite)
        const colliderHeight = TILE_SIZE * 0.1;

        // Create a proper-sized rectangle for the collider
        const fullWidth = this.mapWidthPixels;

        // We'll create this as a rectangle physics body that spans the entire width
        const colliderSprite = this.scene.physics.add.staticImage(
            0, // Left X
            worldY + TILE_SIZE - colliderHeight * 5, // Position exactly at the bottom of the row
            "dirt_tile" // Need a texture key but we'll make it invisible
        );

        // Now set the actual size of the physics body
        colliderSprite.displayWidth = fullWidth; // Make the sprite visually wide (though invisible)
        colliderSprite.displayHeight = colliderHeight; // And the right height

        // Set physics body to match
        colliderSprite.body.setSize(fullWidth, colliderHeight);
        colliderSprite.body.offset.x = fullWidth / 2;
        colliderSprite.body.offset.y = 0; // No vertical offset needed

        // Set debug properties - useful for testing
        colliderSprite.body.debugBodyColor = 0xff0000;

        // Hide the sprite, we just want the physics body
        colliderSprite.setVisible(false);

        this.rowColliderGroup.add(colliderSprite);
        this.rowColliders.set(tileY, colliderSprite);

        // 2. Create Row Visual (e.g., Brown Rectangle)
        // Use a TileSprite for seamless texture if available and desired
        const visual = this.scene.add.tileSprite(
            this.mapWidthPixels / 2, // Center X
            worldY + TILE_SIZE / 2, // Center Y
            this.mapWidthPixels, // Full width
            TILE_SIZE, // Full height
            "dirt_tile" // Use the dirt texture
        );
        // Fallback to rectangle if texture fails?
        // const visual = this.scene.add.rectangle(
        //     this.mapWidthPixels / 2, // Center X
        //     worldY + TILE_SIZE / 2,    // Center Y
        //     this.mapWidthPixels,    // Full width
        //     TILE_SIZE,              // Full height
        //     0x8B4513                // Brown color for dirt
        // );
        this.rowVisualsGroup.add(visual);
        this.rowVisuals.set(tileY, visual);

        // 3. Spawn Entities *ABOVE* the newly generated row's surface
        const spawnWorldY = worldY - TILE_SIZE / 2;
        if (tileY <= this.initialPlatformRows) return;

        const depthInRows = tileY - (this.initialPlatformRows + 1); // Rows below platform
        const depthFactor =
            Math.max(0, depthInRows) * this.difficultyScaleFactor;

        const currentBoulderChance = this.boulderSpawnChanceBase + depthFactor;
        const currentEnemyChance = this.enemySpawnChanceBase + depthFactor;
        const currentGoldChance =
            this.goldEntitySpawnChanceBase + depthFactor * 0.8;

        // Calculate current enemy speed based on depth
        const currentEnemySpeed = Math.min(
            100, // Max speed cap
            this.baseEnemySpeed + depthInRows * this.enemySpeedDepthScale
        );

        for (let tileX = 0; tileX < this.mapWidthTiles; tileX++) {
            const spawnWorldX = tileX * TILE_SIZE + TILE_SIZE / 2;

            if (Math.random() < currentBoulderChance) {
                const boulder = new Boulder(
                    this.scene,
                    spawnWorldX,
                    spawnWorldY
                );
                this.bouldersGroup.add(boulder);
            } else if (Math.random() < currentGoldChance) {
                if (this.coinsGroup) {
                    Coin.spawn(
                        this.scene,
                        this.coinsGroup,
                        spawnWorldX,
                        spawnWorldY,
                        1
                    );
                }
            } else if (Math.random() < currentEnemyChance) {
                const enemy = new Enemy(this.scene, spawnWorldX, spawnWorldY);
                enemy.setSpeed(currentEnemySpeed);
                this.enemiesGroup.add(enemy);
            }
        }
    }
    // --- END REVISED ---

    // --- REMOVED updateCollision ---

    // --- REVISED handleCreateExplosion --- Works on rows now
    public handleCreateExplosion(data: {
        worldX: number;
        worldY: number;
        radius: number;
    }) {
        console.log(
            "Handling explosion at:",
            data.worldX,
            data.worldY,
            "Radius:",
            data.radius
        );
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
                boulder.destroy();
            }
        });
        // Damage Gold Entities
        this.goldEntitiesGroup?.getChildren().forEach((goldGO) => {
            const gold = goldGO as GoldEntity;
            if (!gold.active) return;
            const distSq = Phaser.Math.Distance.Squared(
                explosionWorldX,
                explosionWorldY,
                gold.x,
                gold.y
            );
            if (distSq <= radiusSq) {
                // Maybe drop coins instead of just destroying?
                this.spawnCoin(gold.x, gold.y, 5); // Example: drop 5 coins
                gold.destroy();
            }
        });
    }
    // --- END REVISED ---

    // Optional: Add cleanup method
    public destroy() {
        this.rowColliders.clear();
        this.rowVisuals.clear();
        this.rowColliderGroup.destroy(true); // Destroy children
        this.rowVisualsGroup.destroy(true); // Destroy children
        console.log("TerrainManager destroyed.");
    }

    /**
     * Check if there's a solid row beneath an entity at the specified position.
     * Entities can use this to determine if they should fall.
     * @param worldX X position in world coordinates
     * @param worldY Y position in world coordinates
     * @returns true if there's a solid row directly below the position
     */
    public hasGroundBelow(worldX: number, worldY: number): boolean {
        // Calculate the row directly below the entity
        const entityRowY = Math.floor(worldY / TILE_SIZE);
        const rowBelowY = entityRowY + 1;

        // Check if that row has a collider
        return this.rowColliders.has(rowBelowY);
    }

    /**
     * Check if an entity is at or near a row boundary and should be supported.
     * Use this for precise checking when entities are moving vertically.
     * @param worldY Y position in world coordinates
     * @returns true if the entity is at a position where it should be supported by a row
     */
    public isAtRowBoundary(worldY: number): boolean {
        // Get the position within the current tile
        const tileY = Math.floor(worldY / TILE_SIZE);
        const posWithinTile = worldY - tileY * TILE_SIZE;

        // If we're within the bottom boundary region of the tile (80-100% of tile height)
        // Consider this the "ground support zone"
        const supportZoneStart = TILE_SIZE * 0.8; // 80% of the way down the tile
        return posWithinTile >= supportZoneStart && posWithinTile <= TILE_SIZE;
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

