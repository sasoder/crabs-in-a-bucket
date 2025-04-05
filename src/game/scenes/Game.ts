import Phaser from "phaser";
import { EventBus } from "../EventBus";
import { Player } from "../Player";
import { RELICS, type Relic } from "../data/Relics";

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
        const mapHeight = 20;
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
        const initialRelics: Relic[] = [
            RELICS.STEEL_TOED_BOOTS,
            RELICS.IMPACT_TREMOR,
        ];
        this.registry.set("lives", 3);
        this.registry.set("coins", 0);
        this.registry.set("relics", initialRelics);
        this.registry.set("consumables", []);

        // --- Emit Initial Stats ---
        this.emitStatsUpdate(); // Use a helper function

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
        EventBus.on(
            "start-game",
            () => {
                // This is just a placeholder since we're already in the Game scene
                // We can use this to reset the game if needed
                console.log("Game started via start-game event");
            },
            this
        );
        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            EventBus.off("close-shop", this.resumeGame, this);
            EventBus.off("start-game");
        });

        EventBus.on("player-dig-attempt", this.handleDigAttempt, this);

        EventBus.emit("current-scene-ready", this);
    }

    createBackgroundGrid() {
        const mapWidth = 30;
        const mapHeight = 20;

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
            this.currentDepth = this.maxDepthReached;
            depthJustIncreased = true; // Flag that depth increased this frame
        }

        // --- Emit Stats Update (Only if depth increased) ---
        if (depthJustIncreased) {
            this.emitStatsUpdate(); // Use the helper
        }

        // --- Shop Trigger Check ---
        if (
            depthJustIncreased &&
            this.currentDepth >= this.nextShopDepthThreshold
        ) {
            this.nextShopDepthThreshold += 10;
            this.scene.pause();
            EventBus.emit("open-shop");
            return; // Stop update if paused for shop
        }

        // --- Player Update (Pass Delta Time) ---
        if (this.player) {
            this.player.update(time, delta); // Pass time and delta to player
        }
    }

    // Helper to emit stats only when changed
    emitStatsUpdate(force = false) {
        const currentLives = this.registry.get("lives");
        const currentCoins = this.registry.get("coins");
        const currentRelics = this.registry.get("relics");
        const currentConsumables = this.registry.get("consumables");
        // Only update depth if it's a new whole number
        const depthChanged = this.currentDepth !== this.lastReportedDepth;

        // Check if anything significant changed (or if forced)
        // TODO: Compare relic/consumable arrays more robustly if needed
        if (
            force ||
            depthChanged // || other conditions like lives change, coin change etc.
            // You'll need to call emitStatsUpdate() whenever lives/coins change too
        ) {
            this.lastReportedDepth = this.currentDepth; // Update last reported depth
            EventBus.emit("update-stats", {
                lives: currentLives,
                coins: currentCoins,
                depth: this.currentDepth,
                relics: currentRelics,
                consumables: currentConsumables,
            });
            // console.log("Stats Updated:", this.currentDepth); // For debugging
        }
    }

    private handleDigAttempt(data: { worldX: number; worldY: number }) {
        if (!this.groundLayer || !this.TILE_SIZE || !this.digParticles) return; // Ensure emitter exists

        const digTileX = this.groundLayer.worldToTileX(data.worldX);
        const digTileY = this.groundLayer.worldToTileY(data.worldY);

        if (digTileX === null || digTileY === null) return; // Check for null

        const tileToRemove = this.groundLayer.getTileAt(digTileX, digTileY);

        // Check if it's a destructible tile (assuming index 1 is destructible)
        if (tileToRemove && tileToRemove.index === 1) {
            // --- Tile Removal & Effects ---
            const tilePixelX = digTileX * this.TILE_SIZE + this.TILE_SIZE / 2;
            const tilePixelY = digTileY * this.TILE_SIZE + this.TILE_SIZE / 2;

            // Use the existing emitter
            this.digParticles.setPosition(tilePixelX, tilePixelY);
            this.digParticles.explode(15); // Emit 5 particles at the new location

            // Replace the tile with an empty one (0 index)
            const placedTile = this.groundLayer.putTileAt(
                0,
                digTileX,
                digTileY
            );

            if (!placedTile) {
                console.warn(
                    `Failed to place empty tile at ${digTileX}, ${digTileY}`
                );
            } else {
                // Optional: You might need to recalculate collisions for the layer if needed immediately
                // this.groundLayer.calculateFacesWithin(digTileX - 1, digTileY - 1, 3, 3);
            }

            // TODO: Add logic here to check for enemies within the dig area (digTileX, digTileY)
            // and kill them if necessary.
        }
    }
}

