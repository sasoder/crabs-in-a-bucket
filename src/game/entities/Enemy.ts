// src/game/entities/Enemy.ts
import Phaser from "phaser";
import { BaseGameEntity } from "./BaseGameEntity"; // Import the base class
import { TILE_SIZE } from "../constants"; // Import BlockType
import { Boulder } from "./Boulder"; // Keep for collision type check

export class Enemy extends BaseGameEntity {
    // Extend BaseGameEntity
    private moveSpeed = 30; // Example speed
    private moveDirection = 1; // 1 for right, -1 for left
    private health = 1; // Example health

    constructor(scene: Phaser.Scene, x: number, y: number) {
        // Pass texture key to base constructor
        super(scene, x, y, "enemy"); // Assuming 'enemy' texture exists

        // Specific Enemy setup
        this.body?.setSize(TILE_SIZE * 0.7, TILE_SIZE * 0.8);
        this.body?.setOffset(TILE_SIZE * 0.15, TILE_SIZE * 0.1);
        this.setBounceX(1); // Bounce off vertical walls (world bounds)
        this.setCollideWorldBounds(true); // Ensure this is explicitly true here too

        // Random initial direction
        this.moveDirection = Math.random() < 0.5 ? 1 : -1;
        this.updateFlipX();
    }

    // Implement the abstract method from the base class
    protected entitySpecificUpdate(
        time: number,
        delta: number,
        onGround: boolean
    ): void {
        if (!this.active || !this.body) {
            return;
        }

        // Check for collisions with walls (world bounds)
        if (this.body.blocked.right) {
            this.moveDirection = -1; // Move left
            this.updateFlipX();
        } else if (this.body.blocked.left) {
            this.moveDirection = 1; // Move right
            this.updateFlipX();
        }

        // Only move horizontally when on ground
        if (onGround) {
            this.setVelocityX(this.moveDirection * this.moveSpeed);
        } else {
            // Optional: Slightly reduce horizontal speed when falling?
            // this.setVelocityX(this.moveDirection * this.moveSpeed * 0.8);
        }
    }

    // Keep changeDirection for external calls or potential future use
    changeDirection(): void {
        this.moveDirection *= -1; // Flip direction
        this.updateFlipX();
    }

    resetEnemy(): void {
        this.health = 1;
        this.moveDirection = Math.random() < 0.5 ? 1 : -1;
        this.updateFlipX();
        this.setAlpha(1);
        // Ensure velocity is reset if needed
        this.setVelocity(0, 0);
    }

    setDirection(direction: number): void {
        this.moveDirection = direction < 0 ? -1 : 1;
        this.updateFlipX();
    }

    private updateFlipX() {
        this.setFlipX(this.moveDirection === -1);
    }

    setSpeed(speed: number): void {
        this.moveSpeed = speed;
    }

    takeDamage(amount: number): void {
        if (!this.active) return;

        this.health -= amount;
        // console.log(`Enemy took ${amount} damage, health: ${this.health}`);
        this.scene.tweens.add({
            targets: this,
            alpha: 0.5,
            duration: 50,
            yoyo: true,
        });

        if (this.health <= 0) {
            // console.log("Enemy defeated!");
            this.destroy();
        }
    }

    handleBoulderCollision(boulder: Boulder): boolean {
        if (!this.active || !boulder.active || !boulder.body) return false;

        const boulderBody = boulder.body as Phaser.Physics.Arcade.Body;
        if (boulderBody.velocity.y > 50) {
            // console.log("Enemy crushed by boulder!");
            this.takeDamage(999);
            return true;
        }
        return false;
    }

    destroy(fromScene?: boolean): void {
        super.destroy(fromScene);
    }
}

