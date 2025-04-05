import Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import { Boulder } from "./Boulder";

// Basic enemy with goomba-like walking behavior
export class Enemy extends Phaser.Physics.Arcade.Sprite {
    private health = 1; // Simple health for now
    private walkSpeed = 40; // Default walk speed
    private direction = 1; // 1 = right, -1 = left

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        texture: string = "enemy"
    ) {
        // Center the enemy in the tile
        super(scene, x + TILE_SIZE / 2, y + TILE_SIZE / 2, texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Set appropriate display size
        // this.setDisplaySize(TILE_SIZE, TILE_SIZE);

        this.setCollideWorldBounds(true);
        this.setGravityY(300);

        // Configure physics body for enemy-to-enemy collisions
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setBounce(0.2); // Add slight bounce
            body.setCollideWorldBounds(true);
            // Set a slight offset to prevent enemies from overlapping at same Y position
            body.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.8);
            body.setOffset(TILE_SIZE * 0.1, TILE_SIZE * 0.1);
        }

        // Initialize direction and velocity
        this.direction = Phaser.Math.Between(0, 1) ? 1 : -1;
        this.updateMovement();

        // Make sure we're visible
        this.setDepth(5); // Higher depth to ensure visibility
        this.setAlpha(1);

        // Debug tinting to check if the sprite is loading at all
        this.setTint(0xff0000); // Temporary red tint to ensure visibility
    }

    // Method to handle boulder collisions
    handleBoulderCollision(boulder: Boulder): boolean {
        if (!this.active || !boulder.active) return false;

        // Check if boulder is moving fast enough to damage
        const boulderBody = boulder.body as Phaser.Physics.Arcade.Body;

        if (
            boulderBody &&
            (Math.abs(boulderBody.velocity.x) > 50 ||
                Math.abs(boulderBody.velocity.y) > 100)
        ) {
            // Fast-moving boulder kills the enemy
            this.takeDamage(999);
            return true;
        } else {
            // For slower boulders, just reverse direction
            this.changeDirection();
            return false;
        }
    }

    // Simple function to change walking direction
    changeDirection(): void {
        this.direction *= -1; // Reverse direction
        this.updateMovement();
    }

    // Keeping patrol behavior method for compatibility with existing code
    setPatrolBehavior(enabled: boolean): void {
        // This method exists for backwards compatibility
    }

    takeDamage(amount: number): void {
        this.health -= amount;
        if (this.health <= 0) {
            this.die();
        } else {
            // Flash feedback
            this.scene?.tweens.add({
                targets: this,
                alpha: 0.5,
                duration: 80,
                yoyo: true,
            });
        }
    }

    private die(): void {
        console.log("Enemy died!");
        this.setActive(false);
        this.setVisible(false);
        if (this.body) {
            (this.body as Phaser.Physics.Arcade.Body).enable = false;
        }
    }

    // Add these new methods for controlling enemy movement
    setDirection(direction: number): void {
        // Normalize to exactly 1 or -1
        this.direction = direction > 0 ? 1 : -1;
        this.updateMovement();
    }

    setSpeed(speed: number): void {
        this.walkSpeed = speed;
        this.updateMovement();
    }

    // Helper to update movement based on direction and speed
    private updateMovement(): void {
        this.setVelocityX(this.direction * this.walkSpeed);
        this.flipX = this.direction < 0;
    }

    // Also update resetEnemy to use these methods
    resetEnemy(): void {
        this.health = 1;
        this.alpha = 1;

        // Reset direction randomly
        const newDirection = Phaser.Math.Between(0, 1) ? 1 : -1;
        this.setDirection(newDirection);

        // Reset any tweens or timers if needed
        if (this.scene) {
            this.scene.tweens.killTweensOf(this);
        }
    }

    update(): void {
        if (!this.active) return; // Skip update if inactive/dead

        const body = this.body as Phaser.Physics.Arcade.Body | null;
        if (!body) return;

        // Ensure velocity is maintained
        if (Math.abs(body.velocity.x) < this.walkSpeed * 0.9) {
            this.updateMovement();
        }

        // Change direction when hitting walls or if blocked by collision
        if (
            (body.blocked.right && this.direction > 0) ||
            (body.blocked.left && this.direction < 0) ||
            (body.touching.right && this.direction > 0) ||
            (body.touching.left && this.direction < 0)
        ) {
            this.changeDirection();
        }

        // After collision, make sure we're moving in the right direction again
        if (body.touching.left || body.touching.right) {
            this.scene.time.delayedCall(100, () => {
                if (this.active && this.body) {
                    this.updateMovement();
                }
            });
        }
    }
}

