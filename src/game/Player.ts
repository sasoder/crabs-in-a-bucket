import Phaser from "phaser";
import { EventBus } from "./EventBus"; // Make sure EventBus is correctly imported

const PLAYER_WIDTH = 12;
const PLAYER_HEIGHT = 20;
const PLAYER_TEXTURE_KEY = "player_rect";

export class Player extends Phaser.Physics.Arcade.Sprite {
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
    private jumpKey: Phaser.Input.Keyboard.Key | null = null;
    private moveSpeed = 150; // Pixels per second
    private jumpVelocity = -150; // Negative for upward velocity
    private lastJumpTime = 0;
    private jumpCooldown = 300; // Milliseconds

    constructor(scene: Phaser.Scene, x: number, y: number) {
        // Create the red rectangle texture if it doesn't exist
        // Ideally, move this to a Preload scene later for better organization
        if (!scene.textures.exists(PLAYER_TEXTURE_KEY)) {
            const graphics = scene.add.graphics();
            graphics.fillStyle(0xff0000, 1); // Red color
            graphics.fillRect(0, 0, PLAYER_WIDTH, PLAYER_HEIGHT);
            graphics.generateTexture(
                PLAYER_TEXTURE_KEY,
                PLAYER_WIDTH,
                PLAYER_HEIGHT
            );
            graphics.destroy();
        }

        super(scene, x, y, PLAYER_TEXTURE_KEY);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setSize(PLAYER_WIDTH, PLAYER_HEIGHT);
        this.setBounce(0.1);
        this.setCollideWorldBounds(true);

        if (scene.input.keyboard) {
            this.cursors = scene.input.keyboard.createCursorKeys();
            this.jumpKey = scene.input.keyboard.addKey(
                Phaser.Input.Keyboard.KeyCodes.SPACE
            );
        } else {
            console.error("Keyboard plugin is not enabled in the scene");
        }

        // Add a simple visual representation if no sprite exists
        if (!this.texture || this.texture.key === "__MISSING") {
            this.setSize(16, 16);
            // Optional: Add a graphics object child for visualization
            const graphics = scene.make.graphics({
                x: -this.width / 2,
                y: -this.height / 2,
            });
            graphics.fillStyle(0xff0000, 1); // Red color
            graphics.fillRect(0, 0, this.width, this.height);
            // this.add(graphics);
        }
    }

    update(time: number, delta: number) {
        if (!this.cursors || !this.jumpKey || !this.body) {
            return;
        }

        const body = this.body as Phaser.Physics.Arcade.Body; // Type assertion for velocity access

        // Horizontal Movement
        if (this.cursors.left.isDown) {
            body.setVelocityX(-this.moveSpeed); // Use base speed directly (Phaser handles delta internally for setVelocity)
            this.setFlipX(true); // Flip sprite left
        } else if (this.cursors.right.isDown) {
            body.setVelocityX(this.moveSpeed);
            this.setFlipX(false); // Normal sprite orientation
        } else {
            body.setVelocityX(0);
        }

        // Jumping and Digging Intention
        const canJump = body.blocked.down || body.touching.down; // More reliable ground check
        if (
            this.cursors.space.isDown &&
            canJump &&
            time > this.lastJumpTime + this.jumpCooldown
        ) {
            body.setVelocityY(this.jumpVelocity);
            this.lastJumpTime = time;

            // Calculate potential dig location
            const digX = this.x;
            const digY = body.bottom + 8; // 8 pixels below feet center, adjust TILE_SIZE?

            // Emit an event asking the scene to handle the dig action
            EventBus.emit("player-dig-attempt", {
                worldX: digX,
                worldY: digY,
            });
        }
    }
}

