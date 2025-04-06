import Phaser from "phaser";
import { EventBus } from "../EventBus";
import { Player } from "../entities/Player";
import { TerrainManager } from "../managers/TerrainManager";
import { ShopManager } from "../managers/ShopManager";
import { TILE_SIZE } from "../constants";
import { Boulder } from "../entities/Boulder";
import { Enemy } from "../entities/Enemy";
import { Spike } from "../entities/Spike";
import { Coin } from "../entities/Coin";
import { TextureManager } from "../managers/TextureManager";
import { ParticleManager } from "../managers/ParticleManager";
import { EnemyManager } from "../managers/EnemyManager";
import { CONSUMABLES } from "../data/Consumables";
import { TNT } from "../entities/TNT";

export default class Game extends Phaser.Scene {
    public player?: Player;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
    private keySpace?: Phaser.Input.Keyboard.Key;
    private TILE_SIZE = TILE_SIZE;

    private currentDepth = 0;
    private maxDepthReached = 0;
    private nextShopDepthThreshold = 10;
    private lastReportedDepth = -1;
    private totalCoinsCollected = 0;
    private initialPlayerY = 0;

    private textureManager!: TextureManager;
    public particleManager!: ParticleManager;
    public terrainManager!: TerrainManager;
    private shopManager!: ShopManager;
    private enemyManager?: EnemyManager;
    public bouldersGroup!: Phaser.Physics.Arcade.Group;
    public enemiesGroup!: Phaser.Physics.Arcade.Group;
    public coinsGroup!: Phaser.Physics.Arcade.Group;
    public tntGroup!: Phaser.Physics.Arcade.Group;
    private rowColliderGroup!: Phaser.Physics.Arcade.StaticGroup;

    // Background gradient properties
    private backgroundGradient!: Phaser.GameObjects.Graphics;
    private surfaceColor = 0x87ceeb; // Light blue sky at surface
    private deepColor = 0x0a1a2a; // Dark blue/black for deep underground
    private maxDarkeningDepth = 100; // Depth at which max darkness is reached

    constructor() {
        super("Game");
    }

    preload() {
        this.textureManager = new TextureManager(this);
        this.textureManager.generateAllTextures();
    }

    create() {
        this.cursors = this.input.keyboard?.createCursorKeys();
        this.keySpace = this.input.keyboard?.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE
        );

        this.currentDepth = 0;
        this.maxDepthReached = 0;
        this.nextShopDepthThreshold = 10;
        this.lastReportedDepth = -1;
        this.totalCoinsCollected = 0;

        // Initialize background gradient
        this.backgroundGradient = this.add.graphics();
        this.updateBackgroundGradient(0);

        this.cameras.main.resetFX();

        this.bouldersGroup = this.physics.add.group({
            classType: Boulder,
            runChildUpdate: true,
            collideWorldBounds: false,
            allowGravity: true,
            gravityY: 200,
            bounceY: 0.1,
            dragX: 50,
        });

        // Set a name for the boulders group for easier identification
        this.bouldersGroup.name = "bouldersGroup";

        this.enemiesGroup = this.physics.add.group({
            classType: Enemy,
            runChildUpdate: true,
            collideWorldBounds: true,
            allowGravity: true,
            gravityY: 300,
            dragX: 0,
            bounceX: 0.1,
        });
        this.coinsGroup = this.physics.add.group({
            classType: Coin,
            runChildUpdate: false,
            collideWorldBounds: false,
            allowGravity: true,
            gravityY: 250,
            bounceY: 0.3,
            dragX: 80,
        });

        this.particleManager = new ParticleManager(this);
        this.particleManager.initializeEmitters(["dirt_tile", "enemy"]);

        this.terrainManager = new TerrainManager(
            this,
            this.bouldersGroup,
            this.enemiesGroup,
            this.coinsGroup,
            this.particleManager
        );
        this.shopManager = new ShopManager(this, this.registry);

        // Initialize enemy manager to handle spawning
        this.enemyManager = new EnemyManager(
            this,
            this.enemiesGroup,
            this.bouldersGroup
        );

        this.terrainManager.generateInitialChunk();
        this.rowColliderGroup = this.terrainManager.getRowColliderGroup();

        // Use getters for map dimensions
        const mapWidth = this.terrainManager.getMapWidthPixels();
        const mapHeight = this.terrainManager.getMapHeightPixels();

        this.physics.world.setBounds(0, 0, mapWidth, mapHeight);
        this.cameras.main.setBounds(0, 0, mapWidth, mapHeight);

        const spawnPoint = this.terrainManager.getInitialSpawnPoint();
        this.initialPlayerY = spawnPoint.y;
        this.player = new Player(this, spawnPoint.x, spawnPoint.y);
        this.player.setName("player");

        // Create TNT group
        this.tntGroup = this.physics.add.group({
            classType: TNT,
            runChildUpdate: true,
            collideWorldBounds: true,
            allowGravity: true,
            gravityY: 300,
            bounceY: 0.2,
        });
        this.tntGroup.name = "tntGroup";

        // Set up collision handling in a more declarative way
        this.setupCollisions();

        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setZoom(2);

        this.registry.set("lives", 3);
        this.registry.set("coins", 0);
        this.registry.set("relics", [] as string[]);
        this.registry.set("consumables", [] as string[]);
        this.registry.set("totalCoinsCollected", 0);
        this.emitStatsUpdate(true);

        this.setupEventListeners();

        EventBus.emit("current-scene-ready", this);
    }

    /**
     * Set up all collisions in one place for better organization
     */
    private setupCollisions(): void {
        if (!this.player) return;

        // --- Static Collisions (No Custom Handler Needed Here) ---
        this.physics.add.collider(this.player, this.rowColliderGroup);
        // Boulders need impact handler with rows (already set in Boulder constructor)
        // this.physics.add.collider(this.bouldersGroup, this.rowColliderGroup); // Handled in Boulder
        this.physics.add.collider(this.enemiesGroup, this.rowColliderGroup);
        this.physics.add.collider(this.coinsGroup, this.rowColliderGroup);
        this.physics.add.collider(this.tntGroup, this.rowColliderGroup);

        // --- Spike Collisions ---
        const spikesGroup = this.terrainManager.getSpikesGroup();
        if (spikesGroup) {
            // Player <-> Spikes (Immediate Damage)
            this.physics.add.collider(
                // Use collider for solid interaction
                this.player,
                spikesGroup,
                this
                    .handlePlayerSpikeCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
                undefined,
                this
            );

            // Enemy <-> Spikes (Immediate Damage)
            this.physics.add.collider(
                // Use collider for solid interaction
                this.enemiesGroup,
                spikesGroup,
                this
                    .handleEnemySpikeCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
                undefined,
                this
            );

            // Boulder <-> Spikes (Boulder Destroys Spike if Moving)
            this.physics.add.collider(
                this.bouldersGroup,
                spikesGroup,
                this
                    .handleBoulderSpikeCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
                undefined,
                this
            );

            // TNT <-> Spikes (TNT might destroy spike? Optional)
            this.physics.add.collider(this.tntGroup, spikesGroup); // TNT might just bounce/rest on it
            // No need for spike-row, spike-spike, spike-boulder (handled above)
        }

        // --- Player <-> TNT ---
        this.physics.add.collider(this.player, this.tntGroup); // Standard physics interaction

        // --- TNT Collisions ---
        this.physics.add.collider(this.tntGroup, this.bouldersGroup);
        this.physics.add.collider(this.tntGroup, this.enemiesGroup);

        // --- Boulder <-> Boulder ---
        this.physics.add.collider(
            this.bouldersGroup,
            this.bouldersGroup,
            this.handleBoulderBoulderCollision, // Keep existing handler
            undefined,
            this
        );

        // --- Enemy <-> Enemy ---
        this.physics.add.collider(
            this.enemiesGroup,
            this.enemiesGroup,
            (obj1, obj2) => {
                // Keep existing turn-around logic
                if (obj1 instanceof Enemy && obj1.active)
                    obj1.changeDirection();
                if (obj2 instanceof Enemy && obj2.active)
                    obj2.changeDirection();
            }
        );

        // --- Player <-> Enemy ---
        this.physics.add.overlap(
            // Overlap is fine for player/enemy interaction check
            this.player,
            this.enemiesGroup,
            this
                .handlePlayerEnemyCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            (obj1, obj2) =>
                obj1 instanceof Player &&
                obj2 instanceof Enemy &&
                obj1.active &&
                obj2.active,
            this
        );

        // --- Player <-> Boulder ---
        this.physics.add.collider(
            // Use collider for physics push interaction
            this.player,
            this.bouldersGroup,
            this
                .handlePlayerBoulderCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );

        // --- Player <-> Coin ---
        this.physics.add.overlap(
            // Overlap is fine for collection
            this.player,
            this.coinsGroup,
            this
                .handlePlayerCoinCollect as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            (obj1, obj2) =>
                obj1 instanceof Player &&
                obj2 instanceof Coin &&
                obj1.active &&
                obj2.active,
            this
        );

        // --- Enemy <-> Boulder ---
        this.physics.add.collider(
            // Collider for physics interaction
            this.enemiesGroup,
            this.bouldersGroup,
            this
                .handleEnemyBoulderCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );
    }

    private handlePlayerBoulderCollision(
        playerGO:
            | Phaser.Types.Physics.Arcade.GameObjectWithBody
            | Phaser.Tilemaps.Tile,
        boulderGO:
            | Phaser.Types.Physics.Arcade.GameObjectWithBody
            | Phaser.Tilemaps.Tile
    ): void {
        if (!(playerGO instanceof Player) || !(boulderGO instanceof Boulder))
            return;
        if (!playerGO.active || !boulderGO.active) return;

        const player = playerGO as Player;
        const boulder = boulderGO as Boulder;

        // Let the boulder handle dealing damage if it's dangerous
        const dealtDamage = boulder.dealDamageOnCollision(player);

        // If no damage was dealt (boulder wasn't dangerous or player was safe),
        // treat it as a push interaction.
        if (!dealtDamage) {
            boulder.markAsSafeForPlayer(); // Mark safe even on gentle push
            // Optional: Apply a small push force to the boulder from the player?
            // This can be tricky to get right, relying on physics engine might be better.
        }
        // Player's specific reaction (like knockback) can be handled in player.takeDamage
    }

    private handleEnemyBoulderCollision(
        enemyGO:
            | Phaser.Types.Physics.Arcade.GameObjectWithBody
            | Phaser.Tilemaps.Tile,
        boulderGO:
            | Phaser.Types.Physics.Arcade.GameObjectWithBody
            | Phaser.Tilemaps.Tile
    ) {
        if (!(enemyGO instanceof Enemy) || !(boulderGO instanceof Boulder))
            return;
        if (!enemyGO.active || !boulderGO.active) return;

        const enemy = enemyGO as Enemy;
        const boulder = boulderGO as Boulder;

        // Let the boulder handle dealing damage if it's dangerous
        const dealtDamage = boulder.dealDamageOnCollision(enemy);

        if (dealtDamage) {
            // Enemy might have specific reaction handled in its takeDamage
        } else {
            // If boulder wasn't dangerous, enemy might just turn around
            enemy.changeDirection();
        }
    }

    private handlePlayerSpikeCollision(
        playerGO:
            | Phaser.Types.Physics.Arcade.GameObjectWithBody
            | Phaser.Tilemaps.Tile,
        spikeGO:
            | Phaser.Types.Physics.Arcade.GameObjectWithBody
            | Phaser.Tilemaps.Tile
    ) {
        if (!(playerGO instanceof Player) || !(spikeGO instanceof Spike))
            return;
        if (!playerGO.active || !spikeGO.active) return;

        const player = playerGO as Player;
        const spike = spikeGO as Spike;

        // Damage player immediately on contact
        player.takeDamage(spike.damageAmount, "spike"); // Pass damage type if needed
    }

    private handleEnemySpikeCollision(
        enemyGO:
            | Phaser.Types.Physics.Arcade.GameObjectWithBody
            | Phaser.Tilemaps.Tile,
        spikeGO:
            | Phaser.Types.Physics.Arcade.GameObjectWithBody
            | Phaser.Tilemaps.Tile
    ) {
        if (!(enemyGO instanceof Enemy) || !(spikeGO instanceof Spike)) return;
        if (!enemyGO.active || !spikeGO.active) return;

        const enemy = enemyGO as Enemy;
        const spike = spikeGO as Spike;

        // Damage enemy immediately
        enemy.takeDamage(spike.damageAmount); // Spikes might insta-kill enemies or just damage
        // Optionally make enemy change direction if it survives
        // enemy.changeDirection();
    }

    private handleBoulderSpikeCollision(
        boulderGO:
            | Phaser.Types.Physics.Arcade.GameObjectWithBody
            | Phaser.Tilemaps.Tile,
        spikeGO:
            | Phaser.Types.Physics.Arcade.GameObjectWithBody
            | Phaser.Tilemaps.Tile
    ) {
        if (!(boulderGO instanceof Boulder) || !(spikeGO instanceof Spike))
            return;
        if (!boulderGO.active || !spikeGO.active) return;

        const boulder = boulderGO as Boulder;
        const spike = spikeGO as Spike;

        // Let the boulder handle damage dealing if it's moving dangerously
        boulder.dealDamageOnCollision(spike);
        // If the boulder wasn't moving dangerously, they just collide statically.
    }

    private setupEventListeners() {
        this.removeEventListeners();

        EventBus.on("close-shop", this.resumeGame, this);
        EventBus.on("restart-game", this.handleRestartGame, this);
        EventBus.on("player-died", this.gameOver, this);
        EventBus.on("open-shop-requested", this.pauseForShop, this);
        EventBus.on("create-explosion", this.handleCreateExplosion, this);
        EventBus.on(
            "player-damaged",
            () => this.cameras.main.flash(100, 255, 0, 0),
            this
        );
        EventBus.on("stats-changed", () => this.emitStatsUpdate(true), this);
        EventBus.on(
            "dirt-row-cleared",
            (data: { tileY: number }) => {
                this.checkEntitiesFalling(data.tileY);
            },
            this
        );
        EventBus.on("use-consumable-requested", this.useConsumable, this);

        console.log("Game Scene Event Listeners Setup.");
    }

    private removeEventListeners() {
        EventBus.off("close-shop", this.resumeGame, this);
        EventBus.off("restart-game", this.handleRestartGame, this);
        EventBus.off("player-died", this.gameOver, this);
        EventBus.off("open-shop-requested", this.pauseForShop, this);
        EventBus.off("create-explosion", this.handleCreateExplosion, this);
        EventBus.off("player-damaged", undefined, this);
        EventBus.off("stats-changed", undefined, this);
        EventBus.off("dirt-row-cleared", undefined, this);
        EventBus.off("player-dig", undefined, this);
        EventBus.off("place-bomb", undefined, this);
        EventBus.off("use-consumable-requested", this.useConsumable, this);

        console.log("Game Scene Event Listeners Removed.");
    }

    resumeGame() {
        console.log("Resuming game scene...");
        if (this.scene.isPaused("Game")) {
            this.scene.resume();
            this.input.keyboard?.resetKeys();
            this.input.keyboard?.enableGlobalCapture();
        } else {
            console.warn(
                "Attempted to resume game scene, but it wasn't paused."
            );
        }
    }

    updateBackgroundGradient(depth: number) {
        const darknessFactor = Math.min(depth / this.maxDarkeningDepth, 1);

        const surfaceColor = Phaser.Display.Color.ValueToColor(
            this.surfaceColor
        );
        const deepColor = Phaser.Display.Color.ValueToColor(this.deepColor);

        const interpolatedColor =
            Phaser.Display.Color.Interpolate.ColorWithColor(
                surfaceColor,
                deepColor,
                100,
                depth
            );

        const colorValue = Phaser.Display.Color.GetColor(
            interpolatedColor.r,
            interpolatedColor.g,
            interpolatedColor.b
        );

        this.cameras.main.setBackgroundColor(colorValue);
        this.backgroundGradient.clear();
    }

    update(time: number, delta: number) {
        if (
            !this.cursors ||
            !this.keySpace ||
            !this.player ||
            !this.player.body ||
            !this.scene.isActive()
        ) {
            return;
        }

        this.player.update(this.cursors, time, delta);

        if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
            this.useConsumable();
        }

        const playerFeetY = this.player.body.bottom;
        const calculatedDepth = Math.max(
            0,
            Math.floor((playerFeetY - this.initialPlayerY) / this.TILE_SIZE)
        );

        let depthJustIncreased = false;
        if (calculatedDepth > this.maxDepthReached) {
            this.maxDepthReached = calculatedDepth;
            depthJustIncreased = true;
            EventBus.emit("update-max-depth", this.maxDepthReached);
        }

        if (calculatedDepth !== this.currentDepth || depthJustIncreased) {
            this.currentDepth = calculatedDepth;
            this.emitStatsUpdate();

            this.updateBackgroundGradient(this.currentDepth);
        }

        if (
            depthJustIncreased &&
            this.maxDepthReached > 0 &&
            this.maxDepthReached >= this.nextShopDepthThreshold
        ) {
            console.log(
                `Shop threshold reached at depth ${this.maxDepthReached}`
            );
            this.shopManager.openShop(this.maxDepthReached);
            this.nextShopDepthThreshold += 10;
        }

        if (this.scene.isActive()) {
            const cameraBottomY =
                this.cameras.main.scrollY +
                this.cameras.main.height / this.cameras.main.zoom;
            this.terrainManager.update(cameraBottomY);
        }
    }

    emitStatsUpdate(force = false) {
        const currentLives = this.registry.get("lives");
        const currentCoins = this.registry.get("coins");
        const currentRelics = this.registry.get("relics");
        const currentConsumables = this.registry.get("consumables");
        const currentMaxLives = this.registry.get("maxLives");
        const depthToShow = this.maxDepthReached;
        this.totalCoinsCollected =
            this.registry.get("totalCoinsCollected") || 0;

        const depthChanged = depthToShow !== this.lastReportedDepth;

        if (force || depthChanged) {
            this.lastReportedDepth = depthToShow;
            EventBus.emit("update-stats", {
                lives: currentLives,
                maxLives: currentMaxLives,
                coins: currentCoins,
                depth: depthToShow,
                relics: currentRelics,
                consumables: currentConsumables,
            });
        }
    }

    handlePlayerEnemyCollision(
        playerGO: Phaser.GameObjects.GameObject,
        enemyGO: Phaser.GameObjects.GameObject
    ) {
        if (
            !(playerGO instanceof Player) ||
            !(enemyGO instanceof Enemy) ||
            !playerGO.active ||
            !enemyGO.active ||
            playerGO !== this.player
        ) {
            return;
        }
        // Delegate to player, which should check for stomp vs regular collision
        playerGO.handleEnemyCollision(enemyGO as Enemy);
    }

    handlePlayerCoinCollect(
        playerGO: Phaser.GameObjects.GameObject,
        coinGO: Phaser.GameObjects.GameObject
    ) {
        if (!this.player || playerGO !== this.player) {
            return;
        }

        // Use the static method from Coin class
        Coin.handlePlayerCoinCollect(this, this.coinsGroup, playerGO, coinGO);
    }

    gameOver() {
        console.log("GAME OVER triggered");
        if (!this.scene.isPaused("Game")) {
            this.scene.pause();
            this.input.keyboard?.disableGlobalCapture();
            this.input.keyboard?.resetKeys();
            this.totalCoinsCollected =
                this.registry.get("totalCoinsCollected") || 0;
            EventBus.emit("show-game-over-modal", {
                score: this.maxDepthReached,
                totalCoins: this.totalCoinsCollected,
                relics: this.registry.get("relics") as string[],
            });
        }
    }

    private pauseForShop(shopData: {
        relicIds: string[];
        consumableIds: string[];
        rerollCost: number;
    }) {
        if (!this.scene.isPaused("Game")) {
            console.log("Pausing game for shop...");
            this.scene.pause();
            this.input.keyboard?.disableGlobalCapture();
            this.input.keyboard?.resetKeys();
            EventBus.emit("open-shop", shopData);
        }
    }

    private handleCreateExplosion(data: {
        worldX: number;
        worldY: number;
        radius: number;
    }) {
        if (this.terrainManager) {
            this.terrainManager.handleCreateExplosion(data);
        }
    }

    private handleRestartGame() {
        console.log("Restarting game from GameOver modal...");
        this.scene.start("Game");
    }

    shutdown() {
        console.log("Game scene shutting down...");

        if (this.shopManager) {
            this.shopManager.destroy();
        }
        if (this.particleManager) {
            this.particleManager.destroyEmitters();
        }
        if (this.enemyManager) {
            this.enemyManager.cleanup();
        }

        this.removeEventListeners();

        if (this.bouldersGroup) {
            this.bouldersGroup.destroy(true);
        }
        if (this.enemiesGroup) {
            this.enemiesGroup.destroy(true);
        }
        if (this.coinsGroup) {
            this.coinsGroup.destroy(true);
        }
        if (this.tntGroup) {
            this.tntGroup.destroy(true);
        }
        if (this.rowColliderGroup) {
            this.rowColliderGroup.destroy(true);
        }

        // Clean up the spikes group
        const spikesGroup = this.terrainManager?.getSpikesGroup();
        if (spikesGroup) {
            spikesGroup.destroy(true);
        }

        console.log("Destroyed physics groups.");

        this.cameras.main.stopFollow();
        this.cameras.main.resetFX();

        // Clean up background gradient
        if (this.backgroundGradient) {
            this.backgroundGradient.clear();
            this.backgroundGradient.destroy();
        }

        if (this.player) {
            this.player.destroy();
            this.player = undefined;
        }

        this.cursors = undefined;
        this.keySpace = undefined;
        this.textureManager = undefined!;
        this.particleManager = undefined!;
        this.terrainManager = undefined!;
        this.shopManager = undefined!;
        this.enemyManager = undefined!;
        this.bouldersGroup = undefined!;
        this.enemiesGroup = undefined!;
        this.coinsGroup = undefined!;
        this.tntGroup = undefined!;
        this.rowColliderGroup = undefined!;

        console.log("Game scene shutdown complete.");
    }

    checkEntitiesFalling(clearedTileY: number) {
        const checkY = clearedTileY * this.TILE_SIZE;

        this.enemiesGroup.getChildren().forEach((go) => {
            const enemy = go as Enemy;
            if (!enemy.active || !enemy.body) return;
            const enemyTileY = Math.floor(enemy.y / this.TILE_SIZE);
            if (enemyTileY === clearedTileY - 1) {
            }
        });
        this.bouldersGroup.getChildren().forEach((go) => {
            const boulder = go as Boulder;
            if (!boulder.active || !boulder.body) return;
            const boulderTileY = Math.floor(boulder.y / this.TILE_SIZE);
            if (boulderTileY === clearedTileY - 1) {
            }
        });
    }

    /**
     * Handle a boulder colliding with an enemy
     */
    handleEnemyBoulderCollision(
        object1:
            | Phaser.Types.Physics.Arcade.GameObjectWithBody
            | Phaser.Tilemaps.Tile,
        object2:
            | Phaser.Types.Physics.Arcade.GameObjectWithBody
            | Phaser.Tilemaps.Tile
    ) {
        let enemy: Enemy | null = null;
        let boulder: Boulder | null = null;

        if (object1 instanceof Enemy && object2 instanceof Boulder) {
            enemy = object1;
            boulder = object2;
        } else if (object1 instanceof Boulder && object2 instanceof Enemy) {
            boulder = object1;
            enemy = object2;
        }

        if (!enemy || !boulder || !enemy.active || !boulder.active) {
            return;
        }

        // Delegate to enemy's collision handler
        enemy.handleBoulderCollision(boulder);
    }

    /**
     * Handle collisions between boulders - apply damage on high-velocity impacts
     */
    private handleBoulderBoulderCollision: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback =
        (object1, object2) => {
            // Ensure both objects are Boulders and active
            if (
                !(object1 instanceof Boulder) ||
                !(object2 instanceof Boulder) ||
                !object1.active ||
                !object2.active
            ) {
                return;
            }

            const boulder1 = object1 as Boulder;
            const boulder2 = object2 as Boulder;

            // Ensure both boulders have physics bodies
            if (!boulder1.body || !boulder2.body) {
                return;
            }

            // Calculate relative velocity for collision force
            const vx1 = boulder1.body.velocity.x;
            const vy1 = boulder1.body.velocity.y;
            const vx2 = boulder2.body.velocity.x;
            const vy2 = boulder2.body.velocity.y;

            // Calculate relative velocity magnitude
            const relativeVelocity = Math.sqrt(
                Math.pow(vx1 - vx2, 2) + Math.pow(vy1 - vy2, 2)
            );

            // Only apply damage for significant collisions
            if (relativeVelocity > 150) {
                // Calculate damage based on impact force (1 or 2 damage points)
                const impactDamage = Math.min(
                    2,
                    Math.ceil(relativeVelocity / 200)
                );

                // Both boulders take damage
                boulder1.takeDamage(impactDamage);
                boulder2.takeDamage(impactDamage);

                // Generate impact particles at collision point if significant
                if (relativeVelocity > 200 && this.particleManager) {
                    const collisionX = (boulder1.x + boulder2.x) / 2;
                    const collisionY = (boulder1.y + boulder2.y) / 2;

                    this.particleManager.triggerParticles(
                        "dirt_tile",
                        collisionX,
                        collisionY,
                        {
                            count: Math.min(
                                10,
                                Math.floor(relativeVelocity / 30)
                            ),
                        }
                    );
                }
            }
        };

    /**
     * Handles the logic for using the LAST acquired (newest) consumable.
     */
    private useConsumable(): void {
        if (!this.player || !this.player.active) return;

        const currentConsumables = [
            ...(this.registry.get("consumables") as string[]),
        ];
        if (currentConsumables.length === 0) {
            console.log("No consumables to use.");
            return;
        }

        // Use the LAST item (LIFO stack behavior)
        const consumableIdToUse =
            currentConsumables[currentConsumables.length - 1];
        const consumableData = CONSUMABLES[consumableIdToUse];

        if (!consumableData) {
            console.warn(`Unknown consumable ID: ${consumableIdToUse}`);
            currentConsumables.pop(); // Remove the unknown consumable from the end
            this.registry.set("consumables", currentConsumables);
            EventBus.emit("stats-changed"); // Update UI
            return;
        }

        console.log(
            `Attempting to use newest consumable: ${consumableData.name}`
        );
        let usedSuccessfully = false;

        // --- Apply Consumable Effects ---
        switch (consumableIdToUse) {
            case "HEART_ROOT":
                usedSuccessfully = this.player.heal(1);
                break;
            case "GEODE":
                // Give player random amount of coins (3-15)
                const coinAmount = Phaser.Math.Between(3, 15);
                const currentCoins = this.registry.get("coins") as number;
                this.registry.set("coins", currentCoins + coinAmount);

                // Update total coins collected
                let totalCoinsCollected =
                    (this.registry.get("totalCoinsCollected") as number) || 0;
                totalCoinsCollected += coinAmount;
                this.registry.set("totalCoinsCollected", totalCoinsCollected);

                // Play coin sound
                this.sound.play("collectcoin");

                usedSuccessfully = true;
                EventBus.emit("stats-changed"); // Update UI
                break;
            case "BOULDER":
                if (this.player && this.bouldersGroup) {
                    // Place boulder at player's feet
                    const playerX =
                        Math.floor(this.player.x / TILE_SIZE) * TILE_SIZE;
                    const playerY =
                        Math.floor(
                            (this.player.y + this.player.height / 2) / TILE_SIZE
                        ) * TILE_SIZE;

                    // Create the boulder entity
                    this.bouldersGroup.add(new Boulder(this, playerX, playerY));

                    usedSuccessfully = true;
                }
                break;
            case "TNT":
                if (this.player && this.tntGroup) {
                    // Place TNT at player's feet
                    const playerX =
                        Math.floor(this.player.x / TILE_SIZE) * TILE_SIZE;
                    const playerY =
                        Math.floor(
                            (this.player.y + this.player.height / 2) / TILE_SIZE
                        ) * TILE_SIZE;

                    // Create the TNT entity
                    this.tntGroup.add(new TNT(this, playerX, playerY));

                    usedSuccessfully = true;
                }
                break;
            default:
                console.warn(
                    `No action defined for consumable: ${consumableIdToUse}`
                );
                usedSuccessfully = false;
        }

        // --- Remove from Inventory if Used Successfully ---
        if (usedSuccessfully) {
            currentConsumables.pop(); // Remove the LAST item
            this.registry.set("consumables", currentConsumables);
            console.log(
                `Used ${consumableData.name}. Remaining:`,
                currentConsumables
            );
            EventBus.emit("stats-changed"); // Update UI after using consumable
        } else {
            console.log(
                `Failed to use ${consumableData.name} (e.g., already at max health).`
            );
        }
    }
}

