// src/game/entities/Enemy.ts
import Phaser from "phaser";
import { BaseGameEntity } from "./BaseGameEntity"; // Import the base class
import { TILE_SIZE } from "../constants"; // Import BlockType
import { Boulder } from "./Boulder"; // Keep for collision type check
import Game from "../scenes/Game"; // Import Game scene for proper access

export class Enemy extends BaseGameEntity {
    // Extend BaseGameEntity
    private moveSpeed = 30; // Example speed
    private moveDirection = 1; // 1 for right, -1 for left
    private health = 1; // Example health
    protected gameScene: Game; // Changed to protected to match inheritance
    private recentBoulderCollisions: Map<Boulder, number> = new Map(); // Track recent collisions
    private boulderCollisionCooldown = 500; // ms between allowed collisions from same boulder

    constructor(scene: Phaser.Scene, x: number, y: number) {
        // Pass texture key to base constructor
        super(scene, x, y, "enemy"); // Assuming 'enemy' texture exists
        this.gameScene = scene as Game;

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

        // Clean up old collision records
        this.cleanupCollisionRecords(time);
    }

    /**
     * Clean up old collision records to prevent memory leaks
     */
    private cleanupCollisionRecords(currentTime: number): void {
        for (const [
            boulder,
            timestamp,
        ] of this.recentBoulderCollisions.entries()) {
            if (currentTime - timestamp > this.boulderCollisionCooldown) {
                this.recentBoulderCollisions.delete(boulder);
            }
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
        this.recentBoulderCollisions.clear(); // Clear collision history
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
        if (!this.active || !boulder.active) return false;

        // Check for recent collision with this boulder to prevent damage spam
        const currentTime = this.scene.time.now;
        const lastCollisionTime =
            this.recentBoulderCollisions.get(boulder) || 0;

        if (currentTime - lastCollisionTime < this.boulderCollisionCooldown) {
            // Recent collision with this boulder, don't process again
            return false;
        }

        // Record this collision
        this.recentBoulderCollisions.set(boulder, currentTime);

        // Use boulder's isDangerous method - no special handling for enemies
        if (boulder.isDangerous()) {
            // Apply damage to enemy
            this.takeDamage(boulder.getDamageAmount());

            // Apply knockback in opposite direction of boulder's movement
            if (this.active) {
                const angle = Phaser.Math.Angle.Between(
                    boulder.x,
                    boulder.y,
                    this.x,
                    this.y
                );
                const knockbackForce = 150; // Fixed knockback force
                this.setVelocity(
                    Math.cos(angle) * knockbackForce,
                    Math.min(-50, Math.sin(angle) * knockbackForce) // Ensure some upward bounce
                );
            }

            return true;
        } else {
            // Boulder not dangerous - just change direction
            this.changeDirection();
            return false;
        }
    }

    destroy(fromScene?: boolean): void {
        // Create explosion effect before the enemy is destroyed
        if (this.active && this.scene.scene.key === "Game") {
            // Store position before destroying
            const enemyX = this.x - TILE_SIZE / 2;
            const enemyY = this.y - TILE_SIZE / 2;

            // Access particleManager directly now that it's public
            const gameScene = this.scene as Game;
            if (gameScene.particleManager) {
                gameScene.particleManager.triggerParticles(
                    "enemy",
                    enemyX,
                    enemyY,
                    {
                        count: 12, // More particles for a good explosion effect
                        speed: 80, // Faster particles for explosion feeling
                        scale: 0.25, // Size of particles
                        lifespan: 800, // How long particles last
                    }
                );
            }
        }

        // Clear any collision records before destroying
        this.recentBoulderCollisions.clear();

        super.destroy(fromScene);
    }
}

