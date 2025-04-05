import Phaser from "phaser";
import { EventBus } from "../EventBus";

export default class Game extends Phaser.Scene {
    private player?: Phaser.GameObjects.Rectangle & {
        body: Phaser.Physics.Arcade.Body;
    };
    private map?: Phaser.Tilemaps.Tilemap;
    private groundLayer?: Phaser.Tilemaps.TilemapLayer;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private TILE_SIZE = 16;

    private currentDepth = 0;
    private maxDepthReached = 0;
    private nextShopDepthThreshold = 10;

    constructor() {
        super("Game");
    }

    preload() {
        // Create a simple colored tile for our game
        this.createTileTexture();
    }

    createTileTexture() {
        // Create a canvas texture for our tile
        const graphics = this.make.graphics({ x: 0, y: 0 });
        graphics.fillStyle(0x3498db, 1); // Blue color for blocks
        graphics.fillRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);
        graphics.lineStyle(1, 0x000000, 1);
        graphics.strokeRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);
        graphics.generateTexture("tile", this.TILE_SIZE, this.TILE_SIZE);
        graphics.destroy();
    }

    create() {
        this.cursors = this.input.keyboard?.createCursorKeys();

        this.currentDepth = 0;
        this.maxDepthReached = 0;
        this.nextShopDepthThreshold = 10;

        // --- Tilemap Setup ---
        const mapWidth = 30;
        const mapHeight = 200;
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

        // Set collision for tile index 1
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
        const playerWidth = this.TILE_SIZE;
        const playerHeight = this.TILE_SIZE * 1.5;
        const spawnX = this.map.widthInPixels / 2;
        const spawnY = firstTileYPx - playerHeight / 2;

        const playerRect = this.add.rectangle(
            spawnX,
            spawnY,
            playerWidth,
            playerHeight,
            0xff0000
        );

        this.physics.add.existing(playerRect);
        this.player = playerRect as Phaser.GameObjects.Rectangle & {
            body: Phaser.Physics.Arcade.Body;
        };

        this.player.body.setBounce(0.1);
        this.player.body.setCollideWorldBounds(true);

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
        this.registry.set("lives", 3);
        this.registry.set("coins", 0);
        this.registry.set("relics", []);
        this.registry.set("consumables", []);
        EventBus.emit("ui-update-stats", {
            lives: this.registry.get("lives"),
            coins: this.registry.get("coins"),
            depth: this.currentDepth,
        });

        // Enable physics debug to see collision bodies
        this.physics.world.createDebugGraphic();

        // --- Event Listeners ---
        EventBus.on("close-shop", this.resumeGame, this);
        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            EventBus.off("close-shop", this.resumeGame, this);
        });

        EventBus.emit("current-scene-ready", this);
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

        if (calculatedDepth > this.maxDepthReached) {
            this.maxDepthReached = calculatedDepth;
            this.currentDepth = this.maxDepthReached;
            EventBus.emit("ui-update-stats", { depth: this.currentDepth });

            // --- Shop Trigger Check ---
            if (this.currentDepth >= this.nextShopDepthThreshold) {
                this.nextShopDepthThreshold += 10;
                this.scene.pause();
                EventBus.emit("open-shop");
                return;
            }
        }

        // --- Movement & Digging ---
        const speed = 150;
        const isTouchingGround = this.player.body.blocked.down;

        // Horizontal Movement
        if (this.cursors.left.isDown) {
            this.player.body.setVelocityX(-speed);
        } else if (this.cursors.right.isDown) {
            this.player.body.setVelocityX(speed);
        } else {
            this.player.body.setVelocityX(0);
        }

        // Jumping and Digging
        if (this.cursors.space.isDown && isTouchingGround) {
            const digWorldY = this.player.y + this.player.height / 2 + 1; // Slightly below player feet
            const digTileX = this.groundLayer.worldToTileX(this.player.x);
            const digTileY = this.groundLayer.worldToTileY(digWorldY);

            if (digTileX !== undefined && digTileY !== undefined) {
                // Check if there's a collidable tile at that position
                const tileToRemove = this.groundLayer.getTileAt(
                    digTileX,
                    digTileY
                );

                if (tileToRemove && tileToRemove.index === 1) {
                    // Remove the tile
                    this.groundLayer.removeTileAt(digTileX, digTileY);

                    // Apply jump velocity
                    this.player.body.setVelocityY(-250);
                }
            } else {
                // If no tile to dig, still allow jumping
                this.player.body.setVelocityY(-250);
            }
        } else if (this.cursors.space.isDown && !isTouchingGround) {
            // Optional: Allow jump input buffering or mid-air jump later?
            // For now, do nothing if space pressed mid-air.
        }
    }
}

