import Phaser from "phaser";
import { EventBus } from "../EventBus";
import { Player } from "../Player";
import { RELICS, type Relic } from "../data/Relics";
import { CONSUMABLES, type Consumable } from "../data/Consumables";

export default class Game extends Phaser.Scene {
    private player?: Player;
    private map?: Phaser.Tilemaps.Tilemap;
    private groundLayer?: Phaser.Tilemaps.TilemapLayer;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private TILE_SIZE = 16;
    private crackTexture: string = "tile-cracked";
    private digParticles?: Phaser.GameObjects.Particles.ParticleEmitter;

    private currentDepth = 0;
    private maxDepthReached = 0;
    private nextShopDepthThreshold = 10;
    private lastReportedDepth = -1; // Track last depth sent

    private currentShopRelicIds: string[] = [];
    private currentShopConsumableIds: string[] = [];
    private currentRerollCost: number = 5;

    constructor() {
        super("Game");
    }

    preload() {
        // Create a simple colored tile for our game
        this.createTileTexture();
        this.createCrackTexture();

        // Make sure particle manager is initialized
        this.load.image("tile", undefined);
    }

    createTileTexture() {
        // Create a canvas texture for our tile
        const graphics = this.make.graphics({ x: 0, y: 0 });

        // Change tile color to something more visible (brown/dirt color)
        graphics.fillStyle(0xa67c52, 1); // Dirt/ground color
        graphics.fillRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);

        // Add a more visible border
        graphics.lineStyle(2, 0x000000, 1);
        graphics.strokeRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);

        // Add some texture detail to make it look more like dirt/ground
        graphics.lineStyle(1, 0x8e6343, 0.5);
        graphics.lineBetween(
            0,
            this.TILE_SIZE / 3,
            this.TILE_SIZE,
            this.TILE_SIZE / 3
        );
        graphics.lineBetween(
            0,
            (this.TILE_SIZE * 2) / 3,
            this.TILE_SIZE,
            (this.TILE_SIZE * 2) / 3
        );

        graphics.generateTexture("tile", this.TILE_SIZE, this.TILE_SIZE);
        graphics.destroy();
    }

    createCrackTexture() {
        // Create a cracked tile texture
        const graphics = this.make.graphics({ x: 0, y: 0 });

        // Same base as the tile
        graphics.fillStyle(0xa67c52, 1);
        graphics.fillRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);

        // Add crack patterns
        graphics.lineStyle(2, 0x000000, 1);
        graphics.strokeRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);

        // Draw cracks
        graphics.lineStyle(2, 0x000000, 1);
        graphics.lineBetween(
            this.TILE_SIZE / 2,
            this.TILE_SIZE / 2,
            this.TILE_SIZE,
            this.TILE_SIZE / 4
        );
        graphics.lineBetween(
            this.TILE_SIZE / 2,
            this.TILE_SIZE / 2,
            this.TILE_SIZE / 4,
            this.TILE_SIZE
        );
        graphics.lineBetween(
            this.TILE_SIZE / 2,
            this.TILE_SIZE / 2,
            this.TILE_SIZE,
            (this.TILE_SIZE * 3) / 4
        );

        graphics.generateTexture(
            this.crackTexture,
            this.TILE_SIZE,
            this.TILE_SIZE
        );
        graphics.destroy();
    }

    create() {
        this.cursors = this.input.keyboard?.createCursorKeys();

        this.currentDepth = 0;
        this.maxDepthReached = 0;
        this.nextShopDepthThreshold = 10;

        // Set a visible background color to contrast with the tiles
        this.cameras.main.setBackgroundColor(0x87ceeb); // Sky blue background

        // Create a background grid to show tile positions
        // this.createBackgroundGrid(); // DISABLED FOR PERFORMANCE TEST

        // --- Tilemap Setup ---
        const mapWidth = 30;
        const mapHeight = 500;
        const mapData: number[][] = [];

        // Create basic map data (1 for block, 0 for empty)
        for (let y = 0; y < mapHeight; y++) {
            mapData[y] = [];
            for (let x = 0; x < mapWidth; x++) {
                // Create a platform at the top with more terrain
                if (y < 4) {
                    mapData[y][x] = 0; // Empty at the very top
                } else if (y === 4) {
                    mapData[y][x] = 1; // Solid ground at y=4
                } else {
                    // Create some basic terrain pattern with more gaps
                    mapData[y][x] = Math.random() < 0.8 ? 1 : 0;
                }
            }
        }

        // Create the map instance with data
        this.map = this.make.tilemap({
            data: mapData,
            tileWidth: this.TILE_SIZE,
            tileHeight: this.TILE_SIZE,
        });

        // Add a tileset to the map
        const tileset = this.map.addTilesetImage("tile");

        if (!tileset) {
            console.error("Failed to create tileset");
            return;
        }

        // Create a layer with the tileset
        this.groundLayer = this.map.createLayer(0, tileset, 0, 0) || undefined;

        if (!this.groundLayer) {
            console.error("Failed to create ground layer");
            return;
        }

        // Set collision for tile index 1, excluding empty tiles (0)
        this.groundLayer.setCollisionByExclusion([0]);

        // Set bounds
        this.cameras.main.setBounds(
            0,
            0,
            this.map.widthInPixels,
            this.map.heightInPixels
        );
        this.physics.world.setBounds(
            0,
            0,
            this.map.widthInPixels,
            this.map.heightInPixels
        );

        // --- Player Setup ---
        const mapTopTileY = 4;
        const firstTileYPx = mapTopTileY * this.TILE_SIZE;
        const spawnX = this.map.widthInPixels / 2;
        const spawnY = firstTileYPx - this.TILE_SIZE / 2;

        this.player = new Player(this, spawnX, spawnY);

        // --- Physics ---
        if (this.player && this.groundLayer) {
            this.physics.add.collider(
                this.player,
                this.groundLayer,
                undefined,
                undefined,
                this
            );
        } else {
            console.error("Player or groundLayer missing for collision setup");
        }

        // --- Camera ---
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setZoom(2);

        // --- Initial State & UI ---
        const initialRelics: string[] = [
            RELICS.STEEL_TOED_BOOTS.id,
            RELICS.IMPACT_TREMOR.id,
        ];
        this.registry.set("lives", 3);
        this.registry.set("coins", 100);
        this.registry.set("relics", initialRelics);
        this.registry.set("consumables", [] as string[]);

        // --- Emit Initial Stats ---
        this.emitStatsUpdate(true);

        // --- Initialize Particle Emitter (but don't start it yet) ---
        // Make sure 'tile' texture is loaded in preload
        this.digParticles = this.add.particles(0, 0, "tile", {
            speed: 100,
            scale: { start: 0.2, end: 0.01 },
            quantity: 5,
            lifespan: 300,
            gravityY: 200,
            emitting: false, // Start paused
        });
        this.digParticles.setDepth(1); // Ensure particles are above tiles if needed

        // --- Event Listeners ---
        EventBus.on("close-shop", this.resumeGame, this);
        EventBus.on("request-shop-reroll", this.handleShopReroll, this);
        EventBus.on("purchase-item", this.handlePurchaseAttempt, this);
        EventBus.on("player-dig-attempt", this.handleDigAttempt, this);

        EventBus.emit("current-scene-ready", this);
    }

    createBackgroundGrid() {
        const mapWidth = 30;
        const mapHeight = 500;

        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0xdddddd, 0.3);

        // Draw vertical lines
        for (let x = 0; x <= mapWidth; x++) {
            graphics.lineBetween(
                x * this.TILE_SIZE,
                0,
                x * this.TILE_SIZE,
                mapHeight * this.TILE_SIZE
            );
        }

        // Draw horizontal lines
        for (let y = 0; y <= mapHeight; y++) {
            graphics.lineBetween(
                0,
                y * this.TILE_SIZE,
                mapWidth * this.TILE_SIZE,
                y * this.TILE_SIZE
            );
        }
    }

    resumeGame() {
        console.log("Resuming game scene...");
        this.scene.resume();
    }

    update(time: number, delta: number) {
        if (
            !this.cursors ||
            !this.player ||
            !this.player.body ||
            !this.groundLayer ||
            !this.map
        ) {
            return;
        }

        // --- Depth Calculation ---
        const playerBottomY = this.player.y + this.player.height / 2;
        const startingRowY = 4 * this.TILE_SIZE;
        const calculatedDepth = Math.max(
            0,
            Math.floor((playerBottomY - startingRowY) / this.TILE_SIZE)
        );

        let depthJustIncreased = false;
        if (calculatedDepth > this.maxDepthReached) {
            this.maxDepthReached = calculatedDepth;
            depthJustIncreased = true;
        }

        // Always update currentDepth for display purposes, even if not max
        if (calculatedDepth !== this.currentDepth) {
            this.currentDepth = calculatedDepth;
            this.emitStatsUpdate();
        }

        // --- Shop Trigger Check ---
        if (
            depthJustIncreased &&
            this.currentDepth >= this.nextShopDepthThreshold
        ) {
            this.nextShopDepthThreshold += 10;
            this.openShop();
            return;
        }

        // --- Player Update (Pass Delta Time) ---
        if (this.player && this.scene.isActive()) {
            this.player.update(time, delta);
        }
    }

    // Helper to emit stats only when changed or forced
    emitStatsUpdate(force = false) {
        const currentLives = this.registry.get("lives");
        const currentCoins = this.registry.get("coins");
        const currentRelics = this.registry.get("relics");
        const currentConsumables = this.registry.get("consumables");
        const depthToShow = this.maxDepthReached;

        const changed = force || depthToShow !== this.lastReportedDepth;

        if (changed) {
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
        if (!this.groundLayer || !this.TILE_SIZE || !this.digParticles) return;

        const digTileX = this.groundLayer.worldToTileX(data.worldX);
        const digTileY = this.groundLayer.worldToTileY(data.worldY);

        if (digTileX === null || digTileY === null) return;

        const tileToRemove = this.groundLayer.getTileAt(digTileX, digTileY);

        if (tileToRemove && tileToRemove.index === 1) {
            const tilePixelX = digTileX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const tilePixelY = digTileY * this.TILE_SIZE + this.TILE_SIZE / 2;

            this.digParticles.setPosition(tilePixelX, tilePixelY);
            this.digParticles.explode(15);

            const placedTile = this.groundLayer.putTileAt(
                0,
                digTileX,
                digTileY
            );

            if (!placedTile) {
                console.warn(
                    `Failed to place empty tile at ${digTileX}, ${digTileY}`
                );
            }
        }
    }

    private _selectShopItems(): {
        relicIds: string[];
        consumableIds: string[];
    } {
        const allRelicIds = Object.keys(RELICS);
        const allConsumableIds = Object.keys(CONSUMABLES);

        const shuffledRelics = Phaser.Utils.Array.Shuffle(allRelicIds);
        const shuffledConsumables =
            Phaser.Utils.Array.Shuffle(allConsumableIds);

        const numRelicsToPick = Math.min(2, shuffledRelics.length);
        const numConsumablesToPick = Math.min(2, shuffledConsumables.length);

        return {
            relicIds: shuffledRelics.slice(0, numRelicsToPick),
            consumableIds: shuffledConsumables.slice(0, numConsumablesToPick),
        };
    }

    private openShop() {
        const shopSelection = this._selectShopItems();
        this.currentShopRelicIds = shopSelection.relicIds;
        this.currentShopConsumableIds = shopSelection.consumableIds;
        this.currentRerollCost = 5;

        console.log(
            "Opening Shop with:",
            shopSelection,
            "Cost:",
            this.currentRerollCost
        );

        EventBus.emit("open-shop", {
            relicIds: this.currentShopRelicIds,
            consumableIds: this.currentShopConsumableIds,
            rerollCost: this.currentRerollCost,
        });
        this.scene.pause();
    }

    private handleShopReroll() {
        const currentCoins = this.registry.get("coins") as number;

        if (currentCoins >= this.currentRerollCost) {
            this.registry.set("coins", currentCoins - this.currentRerollCost);

            this.currentRerollCost += 1;

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

        if (data.itemType === "relic") {
            const relic = RELICS[data.itemId];
            itemCost = relic ? 100 : 9999;
            if (relic && currentCoins >= itemCost) {
                const currentRelics = this.registry.get("relics") as string[];
                if (!currentRelics.includes(data.itemId)) {
                    this.registry.set("coins", currentCoins - itemCost);
                    this.registry.set("relics", [
                        ...currentRelics,
                        data.itemId,
                    ]);
                    canPurchase = true;
                    console.log(`Purchased Relic: ${data.itemId}`);
                } else {
                    console.log(`Already own Relic: ${data.itemId}`);
                }
            }
        } else if (data.itemType === "consumable") {
            const consumable = CONSUMABLES[data.itemId];
            itemCost = consumable ? consumable.cost : 9999;
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
                    console.log(`Purchased Consumable: ${data.itemId}`);
                } else {
                    console.log("Consumable inventory full.");
                }
            }
        }

        if (canPurchase) {
            this.emitStatsUpdate(true);
            EventBus.emit("item-purchased", {
                itemId: data.itemId,
                itemType: data.itemType,
            });
        } else if (itemCost > currentCoins) {
            console.log("Not enough coins for purchase.");
        }
    }
}

