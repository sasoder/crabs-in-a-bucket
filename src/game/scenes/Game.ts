import Phaser from "phaser";
import { EventBus } from "../EventBus";
import { Player } from "../entities/Player";
import { RELICS } from "../data/Relics";
import { CONSUMABLES } from "../data/Consumables";
import { TerrainManager } from "../managers/TerrainManager";
import { TILE_SIZE, BlockType } from "../constants";
import { Boulder } from "../entities/Boulder";
import { Enemy } from "../entities/Enemy";
import { Coin } from "../entities/Coin";

export default class Game extends Phaser.Scene {
    private player?: Player;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
    private TILE_SIZE = 16;

    private currentDepth = 0;
    private maxDepthReached = 0;
    private nextShopDepthThreshold = 10;
    private lastReportedDepth = -1;
    private totalCoinsCollected = 0;

    private currentShopRelicIds: string[] = [];
    private currentShopConsumableIds: string[] = [];
    private currentRerollCost: number = 5;

    private terrainManager!: TerrainManager;
    private bouldersGroup!: Phaser.Physics.Arcade.Group;
    private enemiesGroup!: Phaser.Physics.Arcade.Group;
    private coinsGroup!: Phaser.Physics.Arcade.Group;

    private blockParticleEmitters: Map<
        string,
        Phaser.GameObjects.Particles.ParticleEmitter
    > = new Map();

    constructor() {
        super("Game");
    }

    preload() {
        this.createTileTexture(BlockType.DIRT, 0xa07042);
        this.createTileTexture(BlockType.STONE, 0x808080);
        this.createTileTexture(BlockType.GOLD, 0xffd700);
        this.createCoinTexture();

        this.load.image("boulder", "assets/entities/boulder.png");
        this.load.image("enemy", "assets/entities/enemy.png");
        this.load.spritesheet("player", "assets/entities/player.png", {
            frameWidth: 16,
            frameHeight: 32,
        });
    }

    createTileTexture(type: BlockType, color: number) {
        let textureKey = "";
        switch (type) {
            case BlockType.DIRT:
                textureKey = "dirt_tile";
                break;
            case BlockType.STONE:
                textureKey = "stone_tile";
                break;
            case BlockType.GOLD:
                textureKey = "gold_tile";
                break;
            default:
                console.warn(
                    `Cannot generate texture for unknown BlockType: ${type}`
                );
                return;
        }

        if (this.textures.exists(textureKey)) return;

        const graphics = this.make.graphics();
        graphics.fillStyle(color, 1);
        graphics.fillRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);
        graphics.lineStyle(1, 0x000000, 0.5);
        graphics.strokeRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);

        graphics.fillStyle(color - 0x101010, 0.3);
        for (let i = 0; i < 5; i++) {
            graphics.fillRect(
                Math.random() * this.TILE_SIZE,
                Math.random() * this.TILE_SIZE,
                2,
                2
            );
        }

        graphics.generateTexture(textureKey, this.TILE_SIZE, this.TILE_SIZE);
        graphics.destroy();
        console.log(`Generated texture: ${textureKey}`);
    }

    createCoinTexture() {
        const textureKey = "coin";
        if (this.textures.exists(textureKey)) return;

        const graphics = this.make.graphics();
        graphics.fillStyle(0xffcc00, 1);
        graphics.fillCircle(
            this.TILE_SIZE / 2,
            this.TILE_SIZE / 2,
            this.TILE_SIZE * 0.4
        );
        graphics.lineStyle(1, 0xcca300, 1);
        graphics.strokeCircle(
            this.TILE_SIZE / 2,
            this.TILE_SIZE / 2,
            this.TILE_SIZE * 0.4
        );
        graphics.fillStyle(0xffff99, 0.7);
        graphics.fillEllipse(
            this.TILE_SIZE * 0.4,
            this.TILE_SIZE * 0.4,
            this.TILE_SIZE * 0.15,
            this.TILE_SIZE * 0.25
        );

        graphics.generateTexture(textureKey, this.TILE_SIZE, this.TILE_SIZE);
        graphics.destroy();
        console.log(`Generated texture: ${textureKey}`);
    }

    create() {
        this.cursors = this.input.keyboard?.createCursorKeys();

        this.currentDepth = 0;
        this.maxDepthReached = 0;
        this.nextShopDepthThreshold = 10;
        this.lastReportedDepth = -1;
        this.totalCoinsCollected = 0;
        this.blockParticleEmitters = new Map();

        this.cameras.main.setBackgroundColor(0x87ceeb);
        this.cameras.main.resetFX();

        this.bouldersGroup = this.physics.add.group({
            classType: Boulder,
            runChildUpdate: false,
            collideWorldBounds: false,
            allowGravity: true,
            gravityY: 200,
            bounceY: 0.1,
            dragX: 50,
        });
        this.enemiesGroup = this.physics.add.group({
            classType: Enemy,
            runChildUpdate: true,
            collideWorldBounds: true,
            allowGravity: true,
            gravityY: 300,
            dragX: 100,
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

        this.terrainManager = new TerrainManager(
            this,
            this.bouldersGroup,
            this.enemiesGroup
        );
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

        this.physics.add.collider(this.player, groundLayer);
        this.physics.add.collider(this.bouldersGroup, groundLayer);
        this.physics.add.collider(this.enemiesGroup, groundLayer);
        this.physics.add.collider(this.coinsGroup, groundLayer);
        this.physics.add.collider(this.bouldersGroup, this.bouldersGroup);

        this.physics.add.overlap(
            this.player,
            this.enemiesGroup,
            this.handlePlayerEnemyCollision,
            undefined,
            this
        );
        this.physics.add.collider(
            this.player,
            this.bouldersGroup,
            this.handlePlayerBoulderCollision,
            undefined,
            this
        );
        this.physics.add.overlap(
            this.player,
            this.coinsGroup,
            this.handlePlayerCoinCollect,
            undefined,
            this
        );

        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setZoom(2);

        this.registry.set("lives", 3);
        this.registry.set("coins", 0);
        this.registry.set("relics", [] as string[]);
        this.registry.set("consumables", [] as string[]);
        this.emitStatsUpdate(true);

        this.createBlockParticleEmitter("dirt_tile");
        this.createBlockParticleEmitter("stone_tile");
        this.createBlockParticleEmitter("gold_tile");

        this.setupEventListeners();

        EventBus.emit("current-scene-ready", this);
    }

    private setupEventListeners() {
        this.removeEventListeners();

        EventBus.on("close-shop", this.resumeGame, this);
        EventBus.on("request-shop-reroll", this.handleShopReroll, this);
        EventBus.on("purchase-item", this.handlePurchaseAttempt, this);
        EventBus.on("player-dig-attempt", this.handleDigAttempt, this);
        EventBus.on("create-explosion", this.handleCreateExplosion, this);
        EventBus.on("block-destroyed", this.handleBlockDestroyed, this);
        EventBus.on("restart-game", this.handleRestartGame, this);
    }

    private removeEventListeners() {
        EventBus.off("close-shop", this.resumeGame, this);
        EventBus.off("request-shop-reroll", this.handleShopReroll, this);
        EventBus.off("purchase-item", this.handlePurchaseAttempt, this);
        EventBus.off("player-dig-attempt", this.handleDigAttempt, this);
        EventBus.off("create-explosion", this.handleCreateExplosion, this);
        EventBus.off("block-destroyed", this.handleBlockDestroyed, this);
        EventBus.off("restart-game", this.handleRestartGame, this);
    }

    resumeGame() {
        console.log("Resuming game scene...");
        this.scene.resume();
        this.input.keyboard?.resetKeys();
    }

    update(time: number, delta: number) {
        if (!this.cursors || !this.player || !this.player.body) {
            return;
        }

        if (this.player && this.scene.isActive()) {
            this.player.update(this.cursors, time, delta);
        }

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
        }

        if (calculatedDepth !== this.currentDepth || depthJustIncreased) {
            this.currentDepth = calculatedDepth;
            this.emitStatsUpdate();
        }

        if (
            depthJustIncreased &&
            this.maxDepthReached > 0 &&
            this.maxDepthReached >= this.nextShopDepthThreshold
        ) {
            this.openShop();
            this.nextShopDepthThreshold += 10;
            return;
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
        const depthToShow = this.maxDepthReached;

        const depthChanged = depthToShow !== this.lastReportedDepth;

        if (force || depthChanged) {
            this.lastReportedDepth = depthToShow;
            EventBus.emit("update-stats", {
                lives: currentLives,
                coins: currentCoins,
                depth: depthToShow,
                relics: currentRelics,
                consumables: currentConsumables,
            });
        }
    }

    private handleDigAttempt(data: { worldX: number; worldY: number }) {
        if (!this.terrainManager || !this.scene.isActive()) return;

        const destroyedBlockInfo = this.terrainManager.digBlockAt(
            data.worldX,
            data.worldY
        );

        if (destroyedBlockInfo?.textureKey) {
            this.triggerParticles(
                destroyedBlockInfo.textureKey,
                data.worldX,
                data.worldY
            );
        }
    }

    handlePlayerEnemyCollision(
        playerGO:
            | Phaser.Tilemaps.Tile
            | Phaser.Physics.Arcade.Body
            | Phaser.Physics.Arcade.StaticBody
            | Phaser.GameObjects.GameObject,
        enemyGO:
            | Phaser.Tilemaps.Tile
            | Phaser.Physics.Arcade.Body
            | Phaser.Physics.Arcade.StaticBody
            | Phaser.GameObjects.GameObject
    ) {
        if (!(playerGO instanceof Player) || !(enemyGO instanceof Enemy)) {
            return;
        }
        const player = playerGO as Player;
        const enemy = enemyGO as Enemy;

        const playerBody = player.body as Phaser.Physics.Arcade.Body;
        const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;

        const touchingDown =
            playerBody.velocity.y > 0 && playerBody.bottom <= enemyBody.top + 5;

        if (touchingDown) {
            console.log("Enemy stomped!");
            enemy.destroy();
            player.bounce();
            const coinReward = 5;
            const currentCoins = this.registry.get("coins") as number;
            this.registry.set("coins", currentCoins + coinReward);
            this.totalCoinsCollected += coinReward;
            this.emitStatsUpdate(true);
        } else {
            this.handlePlayerDamage(player);
        }
    }

    handlePlayerBoulderCollision(
        playerGO:
            | Phaser.Tilemaps.Tile
            | Phaser.Physics.Arcade.Body
            | Phaser.Physics.Arcade.StaticBody
            | Phaser.GameObjects.GameObject,
        boulderGO:
            | Phaser.Tilemaps.Tile
            | Phaser.Physics.Arcade.Body
            | Phaser.Physics.Arcade.StaticBody
            | Phaser.GameObjects.GameObject
    ) {
        if (!(playerGO instanceof Player) || !(boulderGO instanceof Boulder)) {
            return;
        }
        const player = playerGO as Player;
        const boulder = boulderGO as Boulder;

        if (
            Math.abs(
                (boulder.body?.velocity.x || 0) - (player.body?.velocity.x || 0)
            ) > 1 ||
            Math.abs(
                (boulder.body?.velocity.y || 0) - (player.body?.velocity.y || 0)
            ) > 1
        ) {
            console.log("Player hit by boulder!");
            this.handlePlayerDamage(player);
        }
    }

    handlePlayerDamage(player: Player) {
        const currentLives = this.registry.get("lives") as number;
        const newLives = currentLives - 1;
        this.registry.set("lives", newLives);
        this.emitStatsUpdate(true);

        console.log(`Player took damage! Lives remaining: ${newLives}`);

        this.cameras.main.flash(100, 255, 0, 0);

        if (newLives <= 0) {
            this.gameOver();
        }
    }

    gameOver() {
        console.log("GAME OVER");
        this.scene.pause();
        EventBus.emit("show-game-over-modal", {
            score: this.maxDepthReached,
            totalCoins: this.totalCoinsCollected,
            relics: this.registry.get("relics") as string[],
        });
    }

    private _selectShopItems(): {
        relicIds: string[];
        consumableIds: string[];
    } {
        const allRelicIds = Object.keys(RELICS);
        const allConsumableIds = Object.keys(CONSUMABLES);

        const availableRelics = allRelicIds.filter(
            (id) => !(this.registry.get("relics") as string[]).includes(id)
        );
        const availableConsumables = allConsumableIds;

        const shuffledRelics = Phaser.Utils.Array.Shuffle(availableRelics);
        const shuffledConsumables =
            Phaser.Utils.Array.Shuffle(availableConsumables);

        const numRelicsToPick = Math.min(2, shuffledRelics.length);
        const numConsumablesToPick = Math.min(2, shuffledConsumables.length);

        return {
            relicIds: shuffledRelics.slice(0, numRelicsToPick),
            consumableIds: shuffledConsumables.slice(0, numConsumablesToPick),
        };
    }

    private openShop() {
        this.scene.pause();
        const shopSelection = this._selectShopItems();
        this.currentShopRelicIds = shopSelection.relicIds;
        this.currentShopConsumableIds = shopSelection.consumableIds;
        this.currentRerollCost = 5 + Math.floor(this.maxDepthReached / 10);

        console.log(
            `Opening Shop at Depth ${this.maxDepthReached}. Items:`,
            shopSelection,
            `Reroll Cost:`,
            this.currentRerollCost
        );

        EventBus.emit("open-shop", {
            relicIds: this.currentShopRelicIds,
            consumableIds: this.currentShopConsumableIds,
            rerollCost: this.currentRerollCost,
        });
    }

    private handleShopReroll() {
        const currentCoins = this.registry.get("coins") as number;

        if (currentCoins >= this.currentRerollCost) {
            this.registry.set("coins", currentCoins - this.currentRerollCost);

            this.currentRerollCost =
                Math.ceil(this.currentRerollCost * 1.5) + 1;

            const shopSelection = this._selectShopItems();
            this.currentShopRelicIds = shopSelection.relicIds;
            this.currentShopConsumableIds = shopSelection.consumableIds;

            console.log(
                "Rerolling Shop. New Items:",
                shopSelection,
                "New Cost:",
                this.currentRerollCost
            );

            EventBus.emit("update-shop-items", {
                relicIds: this.currentShopRelicIds,
                consumableIds: this.currentShopConsumableIds,
                rerollCost: this.currentRerollCost,
            });

            this.emitStatsUpdate(true);
        } else {
            console.log("Not enough coins to reroll.");
        }
    }

    private handlePurchaseAttempt(data: {
        itemId: string;
        itemType: "relic" | "consumable";
    }) {
        console.log(`Attempting to purchase ${data.itemType}: ${data.itemId}`);
        const currentCoins = this.registry.get("coins") as number;
        let itemCost = 0;
        let canPurchase = false;
        let purchaseMessage = "";

        const BASE_RELIC_COST = 15;
        const BASE_CONSUMABLE_COST = 8;

        if (data.itemType === "relic") {
            const relic = RELICS[data.itemId];
            itemCost = relic
                ? BASE_RELIC_COST + Math.floor(this.maxDepthReached / 5)
                : 9999;
            if (relic && currentCoins >= itemCost) {
                const currentRelics = this.registry.get("relics") as string[];
                if (!currentRelics.includes(data.itemId)) {
                    this.registry.set("coins", currentCoins - itemCost);
                    this.registry.set("relics", [
                        ...currentRelics,
                        data.itemId,
                    ]);
                    canPurchase = true;
                    purchaseMessage = `Purchased Relic: ${relic.name}`;
                } else {
                    purchaseMessage = `Already own Relic: ${relic.name}`;
                }
            } else if (relic) {
                purchaseMessage = "Not enough coins!";
            }
        } else if (data.itemType === "consumable") {
            const consumable = CONSUMABLES[data.itemId];
            itemCost = consumable ? BASE_CONSUMABLE_COST : 9999;
            if (consumable && currentCoins >= itemCost) {
                const currentConsumables = this.registry.get(
                    "consumables"
                ) as string[];
                if (currentConsumables.length < 3) {
                    this.registry.set("coins", currentCoins - itemCost);
                    this.registry.set("consumables", [
                        ...currentConsumables,
                        data.itemId,
                    ]);
                    canPurchase = true;
                    purchaseMessage = `Purchased Consumable: ${consumable.name}`;
                } else {
                    purchaseMessage = "Consumable inventory full!";
                }
            } else if (consumable) {
                purchaseMessage = "Not enough coins!";
            }
        }

        if (canPurchase) {
            this.emitStatsUpdate(true);
            EventBus.emit("item-purchased", {
                itemId: data.itemId,
                itemType: data.itemType,
            });
            console.log(purchaseMessage);
        } else {
            console.log(purchaseMessage || "Purchase failed.");
        }
    }

    private createBlockParticleEmitter(textureKey: string) {
        if (!this.textures.exists(textureKey)) {
            console.warn(
                `Texture key "${textureKey}" not found for particle emitter creation.`
            );
            return;
        }
        if (this.blockParticleEmitters.has(textureKey)) {
            return;
        }
        const particles = this.add.particles(0, 0, textureKey, {
            lifespan: { min: 200, max: 500 },
            speed: { min: 30, max: 80 },
            scale: { start: 0.8, end: 0 },
            gravityY: 400,
            emitting: false,
            blendMode: "NORMAL",
            rotate: { min: 0, max: 360 },
            alpha: { start: 0.9, end: 0.2 },
        });
        particles.setDepth(1);
        this.blockParticleEmitters.set(textureKey, particles);
        console.log(`Created particle emitter for: ${textureKey}`);
    }

    private handleCreateExplosion(data: {
        worldX: number;
        worldY: number;
        radius: number;
    }) {
        console.warn("Explosion handling is temporarily simplified/disabled.");
    }

    private triggerParticles(
        textureKey: string,
        worldX: number,
        worldY: number
    ) {
        const emitter = this.blockParticleEmitters.get(textureKey);
        if (emitter) {
            emitter.setPosition(worldX, worldY);
            emitter.explode(5);
        } else {
            console.warn(
                `No particle emitter found for texture key: ${textureKey}`
            );
        }
    }

    private handleBlockDestroyed(data: {
        worldX: number;
        worldY: number;
        blockType: BlockType;
        baseCoinChance: number;
        textureKey: string | null;
    }) {
        if (data.textureKey) {
            this.triggerParticles(data.textureKey, data.worldX, data.worldY);
        }
        const finalCoinChance = data.baseCoinChance;

        if (Math.random() < finalCoinChance) {
            const coin = this.coinsGroup.get(
                data.worldX + TILE_SIZE / 2,
                data.worldY + TILE_SIZE / 2,
                "coin"
            ) as Coin;
            if (coin) {
                coin.setActive(true);
                coin.setVisible(true);
                const boostX = Phaser.Math.Between(-10, 10);
                const boostY = Phaser.Math.Between(-60, -20);
                if (coin.body) {
                    coin.body.enable = true;
                    coin.setVelocity(boostX, boostY);
                } else {
                    console.warn("Failed to enable body for spawned coin.");
                }
                console.log(
                    `Spawned coin from block type ${
                        BlockType[data.blockType]
                    } at (${data.worldX}, ${data.worldY})`
                );
            }
        }
    }

    private handlePlayerCoinCollect(playerGO: any, coinGO: any) {
        if (
            !(coinGO instanceof Coin) ||
            !coinGO.active ||
            !(playerGO instanceof Player && playerGO === this.player)
        ) {
            return;
        }
        const coin = coinGO as Coin;

        const currentCoins = this.registry.get("coins") as number;
        const coinValue = 1;
        this.registry.set("coins", currentCoins + coinValue);
        this.totalCoinsCollected += coinValue;

        this.emitStatsUpdate(true);

        this.coinsGroup.killAndHide(coin);
        if (coin.body) {
            coin.body.enable = false;
        }

        // play sound
        this.sound.play("coin_collect");

        console.log(`Collected coin. Total: ${this.registry.get("coins")}`);
    }

    private handleRestartGame() {
        console.log("Restarting game from GameOver modal...");
        this.scene.start("Game");
    }

    shutdown() {
        console.log("Game scene shutting down...");

        this.blockParticleEmitters.forEach((emitter) => {
            emitter.destroy();
        });
        this.blockParticleEmitters.clear();
        console.log("Destroyed particle emitters.");

        this.removeEventListeners();
        console.log("Removed event listeners.");

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

        if (this.terrainManager) {
            console.log("Cleaned up TerrainManager (if applicable).");
        }

        this.cameras.main.stopFollow();

        if (this.player) {
            this.player.destroy();
            this.player = undefined;
        }

        this.cursors = undefined;
    }
}

