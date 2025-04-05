import Phaser from "phaser";
import { EventBus } from "./EventBus"; // Make sure EventBus is correctly imported

// Configuration Constants
const MOVE_VELOCITY = 200;
const JUMP_VELOCITY = -130;
const PLAYER_WIDTH = 12;
const PLAYER_HEIGHT = 20;
const PLAYER_TEXTURE_KEY = "player_rect";

export class Player extends Phaser.Physics.Arcade.Sprite {
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
    private jumpKey: Phaser.Input.Keyboard.Key | null = null;

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
    }

    update() {
        if (!this.cursors || !this.jumpKey || !this.body) {
            return;
        }

        // Horizontal Movement
        if (this.cursors.left.isDown) {
            this.setVelocityX(-MOVE_VELOCITY);
        } else if (this.cursors.right.isDown) {
            this.setVelocityX(MOVE_VELOCITY);
        } else {
            this.setVelocityX(0);
        }

        // Jumping and Digging Intention
        if (
            Phaser.Input.Keyboard.JustDown(this.jumpKey) && // Use JustDown to prevent rapid fire digging
            this.body.blocked.down
        ) {
            // Request jump velocity immediately
            this.setVelocityY(JUMP_VELOCITY);

            // Calculate potential dig location
            const digWorldY = this.y + this.displayHeight / 2 + 1; // Below feet
            const digWorldX = this.x;

            // Emit an event asking the scene to handle the dig action
            EventBus.emit("player-dig-attempt", {
                worldX: digWorldX,
                worldY: digWorldY,
            });
        }
    }
}

