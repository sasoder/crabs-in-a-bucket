import Phaser from "phaser";
import { EventBus } from "../EventBus";

export default class Game extends Phaser.Scene {
    private player?: Phaser.GameObjects.Rectangle & {
        body: Phaser.Physics.Arcade.Body;
    };
    private map?: Phaser.Tilemaps.Tilemap;
    private groundLayer?: Phaser.Tilemaps.TilemapLayer;
    private tileGraphics?: Phaser.GameObjects.Graphics;
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private TILE_SIZE = 16;

    private currentDepth = 0;
    private maxDepthReached = 0;
    private nextShopDepthThreshold = 10;

    constructor() {
        super("Game");
    }

    // No preload needed here if assets are handled in Boot/Preloader

    create() {
        this.cursors = this.input.keyboard?.createCursorKeys();
        this.tileGraphics = this.add.graphics();

        this.currentDepth = 0;
        this.maxDepthReached = 0;
        this.nextShopDepthThreshold = 10;

        // --- Tilemap Setup ---
        const mapWidth = 30;
        const mapHeight = 200;
        const mapData: number[][] = [];

        // Create basic map data (1 for block, -1 for empty)
        for (let y = 0; y < mapHeight; y++) {
            mapData[y] = [];
            for (let x = 0; x < mapWidth; x++) {
                mapData[y][x] = y < 4 ? -1 : 1;
            }
        }

        // Create the map instance (data only)
        this.map = this.make.tilemap({
            data: mapData,
            tileWidth: this.TILE_SIZE,
            tileHeight: this.TILE_SIZE,
        });

        // Create a blank layer for collision detection only
        // It won't use a tileset image for rendering
        this.groundLayer =
            this.map.createBlankLayer(
                "ground",
                [], // No tileset needed for blank layer
                0,
                0,
                mapWidth,
                mapHeight,
                this.TILE_SIZE,
                this.TILE_SIZE
            ) ?? undefined;

        if (!this.groundLayer) {
            console.error("Failed to create ground layer");
            return;
        }

        // Manually add tiles with index 1 to the layer for collision
        // This populates the collision layer based on the initial map data
        this.map.forEachTile(
            (tile) => {
                if (tile.index === 1) {
                    this.groundLayer?.putTileAt(tile.index, tile.x, tile.y);
                }
            },
            this,
            0,
            0,
            mapWidth,
            mapHeight,
            { isNotEmpty: true } // Optimization: only check non-empty source tiles
        );

        // Set collision on the tiles with index 1 within the groundLayer
        this.groundLayer.setCollision(1);

        // Draw the initial visual representation of the tiles based on map data
        this.drawTiles();

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
            0xffffff
        );

        this.physics.add.existing(playerRect);
        this.player = playerRect as Phaser.GameObjects.Rectangle & {
            body: Phaser.Physics.Arcade.Body;
        };

        this.player.body.setBounce(0.1);
        this.player.body.setCollideWorldBounds(true);

        // --- Physics ---
        if (this.player && this.groundLayer) {
            this.physics.add.collider(this.player, this.groundLayer);
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

        // --- Event Listeners ---
        EventBus.on("close-shop", this.resumeGame, this);
        this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            EventBus.off("close-shop", this.resumeGame, this);
        });

        EventBus.emit("current-scene-ready", this);
    }

    // Helper function to draw the visual tiles based on the map data
    drawTiles() {
        if (!this.map) {
            console.error("Cannot draw tiles: Map missing.");
            return;
        }
        const graphics = this.tileGraphics;
        if (!graphics) {
            console.error("Cannot draw tiles: Graphics object missing.");
            return;
        }

        graphics.clear();
        graphics.fillStyle(0x888888, 1); // Grey color for blocks

        // Iterate through the base map data to draw rects
        this.map.forEachTile(
            (tile) => {
                // Draw based ONLY on the original map data index
                if (tile.index === 1) {
                    const tileX = tile.getLeft();
                    const tileY = tile.getTop();
                    graphics.fillRect(
                        tileX,
                        tileY,
                        this.TILE_SIZE,
                        this.TILE_SIZE
                    );
                }
            },
            this,
            0,
            0,
            this.map.width,
            this.map.height,
            { isNotEmpty: true } // Optimization: only iterate non-empty tiles
        );
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
            !this.map // Added map check
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
                // Check if there's a collidable tile (index 1) in the groundLayer first
                const tileInCollisionLayer = this.groundLayer.getTileAt(
                    digTileX,
                    digTileY
                );

                if (tileInCollisionLayer && tileInCollisionLayer.index === 1) {
                    // 1. Remove tile from collision layer
                    this.groundLayer.removeTileAt(digTileX, digTileY);

                    // 2. Update the underlying map data (set to empty -1)
                    this.map.putTileAt(-1, digTileX, digTileY);

                    // 3. Redraw the visual tiles based on updated map data
                    this.drawTiles();

                    // 4. Apply jump velocity only if digging was successful
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

