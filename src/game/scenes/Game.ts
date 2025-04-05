import Phaser from "phaser";
import { EventBus } from "../EventBus";
import { Player } from "../entities/Player";
import { TerrainManager } from "../managers/TerrainManager";
import { ShopManager } from "../managers/ShopManager";
import { TILE_SIZE, BlockType } from "../constants";
import { Boulder } from "../entities/Boulder";
import { Enemy } from "../entities/Enemy";
import { Coin } from "../entities/Coin";
import { TextureManager } from "../managers/TextureManager";
import { ParticleManager } from "../managers/ParticleManager";
import { EnemyManager } from "../managers/EnemyManager";

export default class Game extends Phaser.Scene {
    private player?: Player;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
    private TILE_SIZE = TILE_SIZE;

    private currentDepth = 0;
    private maxDepthReached = 0;
    private nextShopDepthThreshold = 10;
    private lastReportedDepth = -1;
    private totalCoinsCollected = 0;

    private textureManager!: TextureManager;
    private particleManager!: ParticleManager;
    private terrainManager!: TerrainManager;
    private shopManager!: ShopManager;
    private enemyManager!: EnemyManager;
    private bouldersGroup!: Phaser.Physics.Arcade.Group;
    private enemiesGroup!: Phaser.Physics.Arcade.Group;
    private coinsGroup!: Phaser.Physics.Arcade.Group;

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
        this.particleManager.initializeEmitters([
            "dirt_tile",
            "stone_tile",
            "gold_tile",
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
        this.enemyManager = new EnemyManager(this, this.enemiesGroup);

        this.terrainManager.generateInitialChunk();
        const groundLayer = this.terrainManager.getGroundLayer();
        const map = this.terrainManager.getMap();

        this.physics.world.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels
        );
        this.cameras.main.setBounds(
            0,
            0,
            map.widthInPixels,
            map.heightInPixels
        );

        const spawnPoint = this.terrainManager.getInitialSpawnPoint();
        this.player = new Player(this, spawnPoint.x, spawnPoint.y);

        // Set player name for reference by EnemyManager
        this.player.setName("player");

        this.physics.add.collider(this.player, groundLayer);
        this.physics.add.collider(this.bouldersGroup, groundLayer);
        this.physics.add.collider(this.enemiesGroup, groundLayer);
        this.physics.add.collider(this.coinsGroup, groundLayer);
        this.physics.add.collider(this.bouldersGroup, this.bouldersGroup);

        // Add collider between enemies to prevent stacking
        this.physics.add.collider(this.enemiesGroup, this.enemiesGroup);

        // Add collider between boulders and enemies
        this.physics.add.collider(
            this.bouldersGroup,
            this.enemiesGroup,
            this
                .handleBoulderEnemyCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );

        this.physics.add.overlap(
            this.player,
            this.enemiesGroup,
            this
                .handlePlayerEnemyCollision as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );
        this.physics.add.collider(
            this.player,
            this.bouldersGroup,
            (playerGO, boulderGO) => {
                if (
                    playerGO instanceof Player &&
                    boulderGO instanceof Boulder
                ) {
                    playerGO.handleBoulderCollision(boulderGO);
                }
            },
            undefined,
            this
        );
        this.physics.add.overlap(
            this.player,
            this.coinsGroup,
            this
                .handlePlayerCoinCollect as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
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
        EventBus.on("player-dig-attempt", this.handleDigAttempt, this);
        EventBus.on("create-explosion", this.handleCreateExplosion, this);
        EventBus.on(
            "player-damaged",
            () => this.cameras.main.flash(100, 255, 0, 0),
            this
        );
        EventBus.on("stats-changed", () => this.emitStatsUpdate(true), this);

        console.log("Game Scene Event Listeners Setup.");
    }

    private removeEventListeners() {
        EventBus.off("close-shop", this.resumeGame, this);
        EventBus.off("restart-game", this.handleRestartGame, this);
        EventBus.off("player-died", this.gameOver, this);
        EventBus.off("open-shop-requested", this.pauseForShop, this);
        EventBus.off("player-dig-attempt", this.handleDigAttempt, this);
        EventBus.off("create-explosion", this.handleCreateExplosion, this);
        EventBus.off("block-destroyed", undefined, this);
        EventBus.off("player-damaged", undefined, this);
        EventBus.off("stats-changed", undefined, this);

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
        // Calculate darkness factor (0 to 1) based on depth
        const darknessFactor = Math.min(depth / this.maxDarkeningDepth, 1);

        // Extract RGB components from surface and deep colors
        const surfaceR = (this.surfaceColor >> 16) & 0xff;
        const surfaceG = (this.surfaceColor >> 8) & 0xff;
        const surfaceB = this.surfaceColor & 0xff;

        const deepR = (this.deepColor >> 16) & 0xff;
        const deepG = (this.deepColor >> 8) & 0xff;
        const deepB = this.deepColor & 0xff;

        // Interpolate between surface and deep colors based on darkness factor
        const r = Math.floor(surfaceR + (deepR - surfaceR) * darknessFactor);
        const g = Math.floor(surfaceG + (deepG - surfaceG) * darknessFactor);
        const b = Math.floor(surfaceB + (deepB - surfaceB) * darknessFactor);

        // Convert RGB back to hex color
        const currentColor = (r << 16) | (g << 8) | b;

        // Clear previous gradient
        this.backgroundGradient.clear();

        // Set the background color
        this.cameras.main.setBackgroundColor(currentColor);
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
        const startingRowY =
            this.terrainManager.getInitialSpawnPoint().y -
            this.TILE_SIZE / 2 +
            this.TILE_SIZE;
        const calculatedDepth = Math.max(
            0,
            Math.floor((playerFeetY - startingRowY) / this.TILE_SIZE)
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

            // Update background gradient when depth changes
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

    private handleDigAttempt(data: { worldX: number; worldY: number }) {
        if (!this.terrainManager || !this.scene.isActive()) return;

        this.terrainManager.digBlockAt(data.worldX, data.worldY);
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

        console.log("Game scene shutdown complete.");
    }

    private handleBoulderEnemyCollision(boulderObj: any, enemyObj: any) {
        if (boulderObj instanceof Boulder && enemyObj instanceof Enemy) {
            return enemyObj.handleBoulderCollision(boulderObj);
        }
        return false;
    }
}

