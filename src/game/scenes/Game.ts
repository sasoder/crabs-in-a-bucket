import Phaser from "phaser";
import { EventBus } from "../EventBus";
import { Player } from "../entities/Player";
import { TerrainManager } from "../managers/TerrainManager";
import { ShopManager } from "../managers/ShopManager";
import { TILE_SIZE, BlockType } from "../constants";
import { Boulder } from "../entities/Boulder";
import { Enemy } from "../entities/Enemy";
import { Coin } from "../entities/Coin";
import { GoldEntity } from "../entities/GoldEntity";
import { TextureManager } from "../managers/TextureManager";
import { ParticleManager } from "../managers/ParticleManager";
import { EnemyManager } from "../managers/EnemyManager";

export default class Game extends Phaser.Scene {
    public player?: Player;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
    private TILE_SIZE = TILE_SIZE;

    private currentDepth = 0;
    private maxDepthReached = 0;
    private nextShopDepthThreshold = 10;
    private lastReportedDepth = -1;
    private totalCoinsCollected = 0;
    private initialPlayerY = 0;

    private textureManager!: TextureManager;
    private particleManager!: ParticleManager;
    public terrainManager!: TerrainManager;
    private shopManager!: ShopManager;
    private enemyManager?: EnemyManager;
    private bouldersGroup!: Phaser.Physics.Arcade.Group;
    private enemiesGroup!: Phaser.Physics.Arcade.Group;
    private coinsGroup!: Phaser.Physics.Arcade.Group;
    private goldEntitiesGroup!: Phaser.Physics.Arcade.Group;
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
        if (this.textures.exists("gold_tile")) {
            this.textures.addBase64(
                "gold_entity",
                this.textures.getBase64("gold_tile")
            );
        } else {
            console.warn("gold_tile texture missing for gold_entity.");
        }
    }

    create() {
        this.cursors = this.input.keyboard?.createCursorKeys();

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

        this.goldEntitiesGroup = this.physics.add.group({
            classType: GoldEntity,
            runChildUpdate: true,
            collideWorldBounds: false,
            allowGravity: true,
            gravityY: 250,
            bounceY: 0.3,
            dragX: 80,
        });

        this.particleManager = new ParticleManager(this);
        this.particleManager.initializeEmitters(["dirt_tile", "gold_entity"]);

        this.terrainManager = new TerrainManager(
            this,
            this.bouldersGroup,
            this.enemiesGroup,
            this.goldEntitiesGroup,
            this.coinsGroup,
            this.particleManager
        );
        this.shopManager = new ShopManager(this, this.registry);

        // Initialize enemy manager to handle spawning
        this.enemyManager = new EnemyManager(this, this.enemiesGroup);

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

        this.physics.add.collider(this.player, this.rowColliderGroup);
        this.physics.add.collider(this.bouldersGroup, this.rowColliderGroup);
        this.physics.add.collider(this.enemiesGroup, this.enemiesGroup);
        this.physics.add.collider(this.coinsGroup, this.rowColliderGroup);
        this.physics.add.collider(
            this.goldEntitiesGroup,
            this.rowColliderGroup
        );
        this.physics.add.collider(this.bouldersGroup, this.goldEntitiesGroup);
        this.physics.add.collider(this.enemiesGroup, this.goldEntitiesGroup);

        this.physics.add.overlap(
            this.player,
            this.enemiesGroup,
            this
                .handlePlayerEnemyCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            (playerGO, enemyGO) => {
                return (
                    playerGO instanceof Player &&
                    enemyGO instanceof Enemy &&
                    playerGO.active &&
                    enemyGO.active
                );
            },
            this
        );
        this.physics.add.collider(
            this.player,
            this.bouldersGroup,
            (playerGO, boulderGO) => {
                if (
                    playerGO instanceof Player &&
                    boulderGO instanceof Boulder &&
                    playerGO.active &&
                    boulderGO.active
                ) {
                    playerGO.handleBoulderCollision(boulderGO);
                }
            },
            undefined,
            this
        );
        this.physics.add.overlap(
            this.player,
            this.goldEntitiesGroup,
            this
                .handlePlayerGoldCollect as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            (playerGO, goldGO) => {
                return (
                    playerGO instanceof Player &&
                    goldGO instanceof GoldEntity &&
                    playerGO.active &&
                    goldGO.active
                );
            },
            this
        );
        this.physics.add.overlap(
            this.player,
            this.coinsGroup,
            this
                .handlePlayerCoinCollect as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            (playerGO, coinGO) => {
                return (
                    playerGO instanceof Player &&
                    coinGO instanceof Coin &&
                    playerGO.active &&
                    coinGO.active
                );
            },
            this
        );

        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setZoom(2);

        this.registry.set("lives", 3);
        this.registry.set("maxLives", 3);
        this.registry.set("coins", 0);
        this.registry.set("relics", [] as string[]);
        this.registry.set("consumables", [] as string[]);
        this.registry.set("totalCoinsCollected", 0);
        this.emitStatsUpdate(true);

        this.setupEventListeners();

        EventBus.emit("current-scene-ready", this);
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
            !this.player ||
            !this.player.body ||
            !this.scene.isActive()
        ) {
            return;
        }

        this.player.update(this.cursors, time, delta);

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

        // Use the player's enemy collision handler
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

    handlePlayerGoldCollect(
        playerGO: Phaser.GameObjects.GameObject,
        goldGO: Phaser.GameObjects.GameObject
    ) {
        if (
            playerGO instanceof Player &&
            goldGO instanceof GoldEntity &&
            goldGO.active
        ) {
            // Logic similar to coin collection, but maybe different value/effect
            const goldValue = 25; // Example value
            const currentCoins = this.registry.get("coins") as number;
            this.registry.set("coins", currentCoins + goldValue);

            // Update total coins collected
            let totalCoinsCollected =
                (this.registry.get("totalCoinsCollected") as number) || 0;
            totalCoinsCollected += goldValue;
            this.registry.set("totalCoinsCollected", totalCoinsCollected);

            EventBus.emit("stats-changed"); // Use the generic stats changed event

            // Trigger particle effect for gold
            if (this.particleManager) {
                this.particleManager.triggerParticles(
                    "gold_entity",
                    goldGO.x,
                    goldGO.y,
                    { count: 10, speed: 150 }
                );
            }
            // Play sound?
            // this.sound.play('gold_collect_sound');

            goldGO.destroy(); // Remove the gold entity
        }
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
        if (this.goldEntitiesGroup) {
            this.goldEntitiesGroup.destroy(true);
        }
        if (this.rowColliderGroup) {
            this.rowColliderGroup.destroy(true);
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
        this.textureManager = undefined!;
        this.particleManager = undefined!;
        this.terrainManager = undefined!;
        this.shopManager = undefined!;
        this.enemyManager = undefined!;
        this.bouldersGroup = undefined!;
        this.enemiesGroup = undefined!;
        this.coinsGroup = undefined!;
        this.goldEntitiesGroup = undefined!;
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
        this.goldEntitiesGroup.getChildren().forEach((go) => {
            const gold = go as GoldEntity;
            if (!gold.active || !gold.body) return;
            const goldTileY = Math.floor(gold.y / this.TILE_SIZE);
            if (goldTileY === clearedTileY - 1) {
            }
        });
    }
}

