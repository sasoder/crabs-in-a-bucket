import Phaser from "phaser";

export class Player extends Phaser.Physics.Arcade.Sprite {
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
    private jumpKey: Phaser.Input.Keyboard.Key | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        const playerTextureKey = "player_circle";
        const radius = 16; // Radius of the circle

        // Create the red circle texture if it doesn't exist
        if (!scene.textures.exists(playerTextureKey)) {
            const graphics = scene.add.graphics();
            graphics.fillStyle(0xff0000, 1); // Red color
            // Draw circle at (radius, radius) within a texture of size (radius*2, radius*2)
            graphics.fillCircle(radius, radius, radius);
            graphics.generateTexture(playerTextureKey, radius * 2, radius * 2);
            graphics.destroy();
        }

        // Use the generated texture key
        super(scene, x, y, playerTextureKey);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Set display size if needed (adjust 32x32 to your desired player size)
        // this.setDisplaySize(32, 32); // Remove - let the asset define size
        // Optional: Set a tint for the default texture rectangle
        // this.setTint(0xff0000); // Remove - tint not needed for loaded asset

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

        // Jumping
        // Check if the jump key is down AND the player is touching the ground
        // Use `body.blocked.down` or `body.touching.down` - blocked is often more reliable for ground checks
        if (this.jumpKey.isDown && this.body.blocked.down) {
            this.setVelocityY(-330); // Adjust jump power as needed
        }
    }
}

