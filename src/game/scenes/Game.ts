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
import { ParticleManager } from "../managers/ParticleManager";
import { EnemyManager } from "../managers/EnemyManager";
import { CONSUMABLES } from "../data/Consumables";
import { TNT } from "../entities/TNT";
import { RELICS } from "../data/Relics";

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
    private maxDarkeningDepth = 75; // Depth at which max darkness is reached

    private heartStoneTimer?: Phaser.Time.TimerEvent; // Timer for Heart Stone relic

    // Post processing FX
    private bloomFX?: Phaser.FX.Bloom;

    // FX intensity control
    private bloomIntensity = 0.6; // Increased intensity for softer focus effect

    constructor() {
        super("Game");
    }

    preload() {
        // Remove TextureManager initialization and usage
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
        // Set depth for all boulders to be above the tiles
        this.bouldersGroup.setDepth(10);

        this.enemiesGroup = this.physics.add.group({
            classType: Enemy,
            runChildUpdate: true,
            collideWorldBounds: true,
            allowGravity: true,
            gravityY: 300,
            dragX: 0,
            bounceX: 0.1,
        });
        // Set depth for all enemies to be above the tiles
        this.enemiesGroup.setDepth(10);

        this.coinsGroup = this.physics.add.group({
            classType: Coin,
            runChildUpdate: false,
            collideWorldBounds: false,
            allowGravity: true,
            gravityY: 250,
            bounceY: 0.3,
            dragX: 80,
        });
        // Set depth for all coins to be above the tiles
        this.coinsGroup.setDepth(10);

        this.particleManager = new ParticleManager(this);
        // Initialize with ALL required particle texture keys
        this.particleManager.initializeEmitters([
            "sand_tile",
            "dirt_tile",
            "stone_tile",
            "enemy",
            "coin",
            "boulder",
            "spikes",
        ]);

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
        // Set the player's depth to be above the tiles, same as other entities
        this.player.setDepth(10);

        const backgroundSound = this.sound.add("bg"); // here "true" means to loop

        // Only play background music if it's not already playing
        if (!this.sound.get("bg") || !this.sound.get("bg").isPlaying) {
            backgroundSound.play({ volume: 1, loop: true });
        }

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
        // Set depth for all TNT to be above the tiles
        this.tntGroup.setDepth(10);

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

        // --- Heart Stone Timer ---
        this.setupHeartStoneTimer();
        // --- End Heart Stone Timer ---

        EventBus.emit("current-scene-ready", this);

        // --- Add Post Processing FX ---
        this.applyPostProcessingEffects();
        // --- End Post Processing FX ---
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
            this.physics.add.overlap(
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
            this.player,
            this.bouldersGroup,
            // Use the generic ArcadePhysicsCallback signature
            this
                .handlePlayerBoulderCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            // Process callback remains the same for initial filtering
            (player, boulder) =>
                player instanceof Player &&
                boulder instanceof Boulder &&
                player.active &&
                boulder.active,
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
            this.enemiesGroup,
            this.bouldersGroup,
            // Use the generic ArcadePhysicsCallback signature
            this
                .handleEnemyBoulderCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            // Process callback remains the same
            (enemy, boulder) =>
                enemy instanceof Enemy &&
                boulder instanceof Boulder &&
                enemy.active &&
                boulder.active,
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
        // Type check inside the handler
        if (!(playerGO instanceof Player) || !(boulderGO instanceof Boulder))
            return;

        const player = playerGO as Player;
        const boulder = boulderGO as Boulder;

        if (!player.active || !boulder.active) return;

        // Mark the boulder as safe whenever the player touches it.
        // This prevents immediate damage if the player initiates contact.
        boulder.markAsSafeForPlayer();

        // Let the Boulder's logic decide if damage should occur based on its state.
        boulder.dealDamageOnCollision(player);
    }

    private handleEnemyBoulderCollision(
        enemyGO:
            | Phaser.Types.Physics.Arcade.GameObjectWithBody
            | Phaser.Tilemaps.Tile,
        boulderGO:
            | Phaser.Types.Physics.Arcade.GameObjectWithBody
            | Phaser.Tilemaps.Tile
    ) {
        // Type check inside the handler
        if (!(enemyGO instanceof Enemy) || !(boulderGO instanceof Boulder))
            return;

        const enemy = enemyGO as Enemy;
        const boulder = boulderGO as Boulder;

        if (!enemy.active || !boulder.active) return;

        // Get the bodies for position and velocity checks
        const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
        const boulderBody = boulder.body as Phaser.Physics.Arcade.Body;

        // Check if this is a TOP-DOWN collision (enemy on boulder)
        const isVerticalCollision =
            enemyBody.bottom <= boulderBody.top + 8 && // Enemy's feet are at/above boulder's top
            Math.abs(enemyBody.center.x - boulderBody.center.x) <
                boulderBody.width * 0.7; // Horizontally aligned

        if (isVerticalCollision) {
            // Enemy is landing on or standing on boulder - NEVER damage the enemy
            if (
                Math.abs(enemyBody.velocity.x) > 20 &&
                Math.abs(boulderBody.velocity.x) < 10
            ) {
                // Only change direction if moving toward boulder center
                if (
                    (enemyBody.center.x < boulderBody.center.x &&
                        enemy.getMoveDirection() === 1) ||
                    (enemyBody.center.x > boulderBody.center.x &&
                        enemy.getMoveDirection() === -1)
                ) {
                    enemy.changeDirection();
                }
            }
            return; // Exit early, no damage to either
        }

        // This must be a SIDE collision if we got here
        if (boulder.isMovingDangerously()) {
            // Boulder is moving significantly, damage the enemy
            enemy.takeDamage(999); // Kill enemy
            boulder.takeDamage(1); // Small damage to boulder
        } else {
            // Slow/stationary boulder, enemy just turns around
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

        // Damage player immediately on contact, pass source string
        player.takeDamage(spike.damageAmount, "spike");
        spike.takeDamage(1);
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

        // Since we're using overlap, let's directly get enemy and spike positions
        const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
        const spikeBody = spike.body as Phaser.Physics.Arcade.StaticBody;

        // Check if enemy is falling onto spike from above
        const isFalling = enemyBody.velocity.y > 20; // More lenient threshold
        const isAboveSpike =
            // Check if enemy's bottom is near the spike's top collision area
            enemyBody.bottom >= spikeBody.top - 5 &&
            enemyBody.bottom <= spikeBody.top + spikeBody.height * 0.4;

        // Check if horizontally aligned with the spike
        const isAlignedWithSpike =
            Math.abs(enemyBody.center.x - spikeBody.center.x) <
            spikeBody.width * 0.7;

        // Check if this is a vertical landing interaction
        if (isFalling && isAboveSpike && isAlignedWithSpike) {
            // Only damage if we haven't just damaged this enemy (prevent multiple damage ticks)
            if (!enemy.getData("recentlyDamagedBySpike")) {
                enemy.takeDamage(spike.damageAmount);

                // Set a flag to prevent damage spam
                enemy.setData("recentlyDamagedBySpike", true);
                this.time.delayedCall(200, () => {
                    if (enemy.active)
                        enemy.setData("recentlyDamagedBySpike", false);
                });
            }
            return;
        }

        // Handle side collision - enemy walking into spike from side
        const isWalkingIntoSpike =
            (enemyBody.velocity.x > 0 &&
                enemyBody.right >= spikeBody.left &&
                enemyBody.right <= spikeBody.left + 10) ||
            (enemyBody.velocity.x < 0 &&
                enemyBody.left <= spikeBody.right &&
                enemyBody.left >= spikeBody.right - 10);

        if (isWalkingIntoSpike) {
            // Check direction and flip if needed
            if (enemyBody.velocity.x > 0 && enemy.getMoveDirection() === 1) {
                enemy.changeDirection();
            } else if (
                enemyBody.velocity.x < 0 &&
                enemy.getMoveDirection() === -1
            ) {
                enemy.changeDirection();
            }
        }
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

        // Let the boulder handle damage dealing (it will destroy the spike)
        boulder.dealDamageOnCollision(spike);
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
        EventBus.on("relics-changed", this.setupHeartStoneTimer, this);
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
        EventBus.off("relics-changed", this.setupHeartStoneTimer, this);
    }

    resumeGame() {
        if (this.scene.isPaused("Game")) {
            this.scene.resume();
            this.input.keyboard?.resetKeys();
            this.input.keyboard?.enableGlobalCapture();
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
                darknessFactor * 100 // Use the capped darknessFactor percentage
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
            this.scene.pause();
            this.input.keyboard?.disableGlobalCapture();
            this.input.keyboard?.resetKeys();
            EventBus.emit("open-shop", shopData);
            this.sound.play("buy");
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
        // Call shutdown explicitly to clean up resources
        this.shutdown();
        // Then start a new game scene
        this.scene.start("Game");
    }

    shutdown() {
        // --- Clear Heart Stone Timer ---
        if (this.heartStoneTimer) {
            this.heartStoneTimer.remove();
            this.heartStoneTimer = undefined;
        }
        // --- End Clear Heart Stone Timer ---

        if (this.shopManager) {
            this.shopManager.destroy();
        }
        if (this.particleManager) {
            // Use the new destroy method
            this.particleManager.destroy();
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
        this.particleManager = undefined!;
        this.terrainManager = undefined!;
        this.shopManager = undefined!;
        this.enemyManager = undefined!;
        this.bouldersGroup = undefined!;
        this.enemiesGroup = undefined!;
        this.coinsGroup = undefined!;
        this.tntGroup = undefined!;
        this.rowColliderGroup = undefined!;

        this.heartStoneTimer = undefined; // Ensure property is cleared

        // Clean up post-processing effects
        // Reset camera effects - check if bloomFX exists before removing
        if (this.bloomFX) {
            // Use the generic remove method for Post FX pipelines
            this.cameras.main.postFX.remove(this.bloomFX);
            this.bloomFX = undefined;
        }
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

            // Define a threshold for damaging collisions between boulders
            const BOULDER_COLLISION_DAMAGE_THRESHOLD = 100; // Adjust as needed

            // Only apply damage for significant collisions
            if (relativeVelocity > BOULDER_COLLISION_DAMAGE_THRESHOLD) {
                // Calculate damage based on impact force (e.g., 1 damage point)
                const impactDamage = 1; // Simple damage for now

                // Both boulders take damage from a significant collision
                boulder1.takeDamage(impactDamage);
                boulder2.takeDamage(impactDamage);

                // Generate impact particles at collision point if significant
                if (this.particleManager) {
                    const collisionX = (boulder1.x + boulder2.x) / 2;
                    const collisionY = (boulder1.y + boulder2.y) / 2;

                    this.particleManager.triggerParticles(
                        "boulder", // Use boulder particle effect
                        collisionX,
                        collisionY,
                        {
                            count: Math.min(
                                6,
                                Math.floor(relativeVelocity / 50) // Fewer particles than explode
                            ),
                            speed: 40, // Slower speed for impact
                            scale: 0.6,
                            lifespan: 300,
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
        let usedSuccessfully = false;
        this.sound.play("tick");

        // --- Apply Consumable Effects ---
        switch (consumableIdToUse) {
            case "HEART_ROOT":
                usedSuccessfully = this.player.heal(1);
                break;
            case "GEODE":
                // Give player random amount of coins (3-15)
                const coinAmount = Phaser.Math.Between(2, 15);

                for (let i = 0; i < coinAmount; i++) {
                    Coin.spawn(
                        this,
                        this.coinsGroup,
                        this.player.x,
                        this.player.y
                    );
                }

                // Play coin sound
                this.sound.play("tick");

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
            EventBus.emit("stats-changed"); // Update UI after using consumable
        } else {
        }
    }

    /**
     * Sets up or resets the timer for the Heart Stone relic.
     */
    private setupHeartStoneTimer(): void {
        // Clear existing timer if it exists
        if (this.heartStoneTimer) {
            this.heartStoneTimer.remove();
            this.heartStoneTimer = undefined;
        }

        // Check if the player has any Heart Stone relics
        const relics = (this.registry.get("relics") as string[]) || [];
        const heartStoneCount = relics.filter(
            (id) => id === RELICS.HEART_STONE.id
        ).length;

        if (heartStoneCount > 0) {
            // Create a new looping timer
            this.heartStoneTimer = this.time.addEvent({
                delay: 60000, // 60 seconds
                callback: this.onHeartStoneTick,
                callbackScope: this,
                loop: true,
            });
        }
    }

    /**
     * Called every 60 seconds by the heartStoneTimer.
     */
    private onHeartStoneTick(): void {
        if (!this.player || !this.player.active) {
            return;
        }

        const relics = (this.registry.get("relics") as string[]) || [];
        const heartStoneCount = relics.filter(
            (id) => id === RELICS.HEART_STONE.id
        ).length;

        if (heartStoneCount > 0) {
            this.player.heal(heartStoneCount); // Heal amount based on relic count
        } else {
            // This case should theoretically not happen if the timer is managed correctly,
            // but good for safety.
            console.warn(
                "Heart Stone Tick: Timer fired but no Heart Stone relic found. Stopping timer."
            );
            this.heartStoneTimer?.remove();
            this.heartStoneTimer = undefined;
        }
    }

    /**
     * Apply post-processing effects to the main camera
     */
    private applyPostProcessingEffects(): void {
        // Clear any existing effects first
        if (this.bloomFX) {
            this.cameras.main.postFX.remove(this.bloomFX);
            this.bloomFX = undefined;
        }

        // Apply bloom effect
        this.bloomFX = this.cameras.main.postFX.addBloom(
            0xffffff,
            1,
            1,
            1,
            this.bloomIntensity
        );
    }
}

