import Phaser from "phaser";

export class Player extends Phaser.Physics.Arcade.Sprite {
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
    private jumpKey: Phaser.Input.Keyboard.Key | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        const playerTextureKey = "player_rect";
        const width = 12;
        const height = 20;

        // Create the red rectangle texture if it doesn't exist
        if (!scene.textures.exists(playerTextureKey)) {
            const graphics = scene.add.graphics();
            graphics.fillStyle(0xff0000, 1); // Red color
            // Draw rectangle at (0, 0) within a texture of size (width, height)
            graphics.fillRect(0, 0, width, height);
            graphics.generateTexture(playerTextureKey, width, height);
            graphics.destroy();
        }

        // Use the generated texture key
        super(scene, x, y, playerTextureKey);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Set rectangular physics body
        this.setSize(width, height);

        // Set up physics properties
        this.setBounce(0.1); // Slight bounce on landing
        this.setCollideWorldBounds(true); // Keep player within game bounds

        // Initialize keyboard controls
        if (scene.input.keyboard) {
            this.cursors = scene.input.keyboard.createCursorKeys();
            this.jumpKey = scene.input.keyboard.addKey(
                Phaser.Input.Keyboard.KeyCodes.SPACE
            );
        } else {
            console.error("Keyboard plugin is not enabled in the scene");
        }
    }

    update() {
        if (!this.cursors || !this.jumpKey || !this.body) {
            return; // Exit if controls or body aren't initialized
        }

        // Horizontal Movement
        if (this.cursors.left.isDown) {
            this.setVelocityX(-160);
            // Consider adding animation logic here: this.anims.play('left', true);
        } else if (this.cursors.right.isDown) {
            this.setVelocityX(160);
            // Consider adding animation logic here: this.anims.play('right', true);
        } else {
            this.setVelocityX(0);
            // Consider adding idle animation logic here: this.anims.play('turn');
        }

        // Jumping and Digging
        // Check if the jump key is down AND the player is touching the ground
        if (this.jumpKey.isDown && this.body.blocked.down) {
            const digWorldY = this.y + this.displayHeight / 2 + 1; // Check slightly below player feet
            const digWorldX = this.x;

            // Access the ground layer (assuming it exists in the scene context)
            // We might need a cleaner way to pass the layer reference, but this works for now
            const gameScene = this.scene as any; // Cast to access scene properties
            const groundLayer = gameScene.groundLayer as
                | Phaser.Tilemaps.TilemapLayer
                | undefined;
            const TILE_SIZE = gameScene.TILE_SIZE as number | undefined;

            if (groundLayer && TILE_SIZE) {
                const digTileX = groundLayer.worldToTileX(digWorldX);
                const digTileY = groundLayer.worldToTileY(digWorldY);

                if (digTileX !== null && digTileY !== null) {
                    const tileToRemove = groundLayer.getTileAt(
                        digTileX,
                        digTileY
                    );

                    if (tileToRemove && tileToRemove.index === 1) {
                        // --- Tile Removal & Effects (moved from Game.ts) ---
                        try {
                            const tileX = digTileX * TILE_SIZE + TILE_SIZE / 2;
                            const tileY = digTileY * TILE_SIZE + TILE_SIZE / 2;
                            const particles = this.scene.add.particles(
                                tileX,
                                tileY,
                                "tile",
                                {
                                    speed: 100,
                                    scale: { start: 0.2, end: 0.01 },
                                    quantity: 5,
                                    lifespan: 300,
                                    gravityY: 200,
                                }
                            );
                            this.scene.time.delayedCall(500, () =>
                                particles.destroy()
                            );
                        } catch (error) {
                            console.warn("Could not create particles:", error);
                        }
                        groundLayer.removeTileAt(digTileX, digTileY); // Remove tile
                    }
                }
            }

            // Apply jump velocity regardless of digging success
            this.setVelocityY(-330); // Adjust jump power as needed
        }
    }
}

