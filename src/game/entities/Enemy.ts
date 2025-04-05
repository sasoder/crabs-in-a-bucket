import Phaser from "phaser";
import { TILE_SIZE } from "../constants";

// Basic placeholder enemy
export class Enemy extends Phaser.Physics.Arcade.Sprite {
    private health = 1; // Simple health for now

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        texture: string = "enemy"
    ) {
        // Assuming you have an 'enemy' texture loaded
        super(scene, x + TILE_SIZE / 2, y + TILE_SIZE / 2, texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true); // Keep them within bounds for now
        this.setGravityY(300); // They are affected by gravity
        // Basic horizontal movement example (replace with proper AI later)
        this.setVelocityX(Phaser.Math.Between(-30, 30) || 10);
        this.setBounceX(1); // Bounce off walls

        this.body?.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.8);
        this.setDepth(0); // Ensure enemies are behind player if overlapping
    }

    takeDamage(amount: number): void {
        this.health -= amount;
        console.log(`Enemy took ${amount} damage, health: ${this.health}`);

        if (this.health <= 0) {
            this.die();
        }
        // Optional: Add visual feedback like flashing
        this.scene?.tweens.add({
            targets: this,
            alpha: 0.5,
            duration: 80,
            yoyo: true,
        });
    }

    private die(): void {
        console.log("Enemy died!");
        // Disable physics and hide
        this.setActive(false);
        this.setVisible(false);
        if (this.body) {
            (this.body as Phaser.Physics.Arcade.Body).enable = false;
        }
        // Consider adding particles or death animation here
        // Instead of destroying immediately, let the group handle cleanup if needed,
        // or destroy after a delay for animations.
        // this.destroy(); // Use cautiously, might interfere with group management
    }

    update(time: number, delta: number): void {
        if (!this.active) return; // Skip update if inactive/dead

        // Basic patrol logic example
        const body = this.body as Phaser.Physics.Arcade.Body | null;
        if (!body) return;

        if (body.blocked.right) {
            this.setVelocityX(-30);
        } else if (body.blocked.left) {
            this.setVelocityX(30);
        }
        // Prevent getting stuck switching directions instantly
        if (Math.abs(body.velocity.x ?? 0) < 5) {
            this.setVelocityX(Phaser.Math.Between(-30, 30) || 10);
        }
    }
}

