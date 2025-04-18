// src/game/entities/Enemy.ts
import Phaser from "phaser";
import { BaseGameEntity } from "./BaseGameEntity"; // Import the base class
import { TILE_SIZE } from "../constants"; // Import BlockType
import { Boulder } from "./Boulder"; // Keep for collision type check
import Game from "../scenes/Game"; // Import Game scene for proper access
import { Coin } from "./Coin";

export class Enemy extends BaseGameEntity {
    // Extend BaseGameEntity
    private moveSpeed = 30; // Example speed
    private moveDirection = 1; // 1 for right, -1 for left
    private health = 1; // Example health
    protected gameScene: Game; // Changed to protected to match inheritance

    private spawnTime: number; // Track when the enemy was created
    private readonly spawnGracePeriod = 250; // ms of invulnerability after spawn

    constructor(scene: Phaser.Scene, x: number, y: number) {
        // Pass texture key to base constructor
        super(scene, x, y, "enemy"); // Assuming 'enemy' texture exists
        this.gameScene = scene as Game;
        this.spawnTime = this.scene.time.now; // Record spawn time

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
        if (this.body.blocked.right && this.moveDirection === 1) {
            this.moveDirection = -1; // Move left
            this.updateFlipX();
        } else if (this.body.blocked.left && this.moveDirection === -1) {
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
        this.setVelocity(0, 0);
        this.spawnTime = this.scene.time.now; // Reset spawn time on reset too
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
        // --- Add grace period check ---
        if (
            this.active &&
            this.scene.time.now < this.spawnTime + this.spawnGracePeriod
        ) {
            return; // Exit early, no damage taken
        }
        // --- End grace period check ---

        if (!this.active) return;

        this.health -= amount;
        this.scene.tweens.add({
            targets: this,
            alpha: 0.5,
            duration: 50,
            yoyo: true,
        });

        // Flash red on taking any damage (if survived grace period)
        if (this.active && amount > 0) {
            this.setTint(0xff0000);
            this.scene.time.delayedCall(100, () => {
                if (this.active) this.clearTint();
            });
        }

        if (this.health <= 0) {
            // Award coins if slayer relic is owned
            // Correctly check for Slayer relic ID and calculate reward
            const slayerBonusPerStack = 2; // How many bonus coins per Slayer relic
            const slayerStacks = (
                this.scene.registry.get("relics") as string[]
            ).filter((relicId) => relicId === "SLAYER").length;
            const coinReward = slayerStacks * slayerBonusPerStack; // Calculate total bonus

            for (let i = 0; i < coinReward; i++) {
                Coin.spawn(
                    this.gameScene,
                    this.gameScene.coinsGroup,
                    this.x,
                    this.y
                );
            }
            this.destroy(); // Handles particles and sound
        } else if (amount > 0) {
            // Play hit sound only if damaged but not destroyed yet
            // Consider if the destroy() method already plays a sound. If so, maybe remove this one.
            // this.gameScene.sound.play("hit_light"); // Example: a lighter hit sound
        }
    }

    // Add a getter for move direction if needed by Game.ts spike handler
    getMoveDirection(): number {
        return this.moveDirection;
    }

    destroy(fromScene?: boolean): void {
        if (this.active && this.scene && this.scene.scene.key === "Game") {
            const gameScene = this.scene as Game;
            // Only trigger particles if the particleManager exists and the scene is still active
            if (gameScene.particleManager && gameScene.scene.isActive()) {
                try {
                    gameScene.particleManager.triggerParticles(
                        "enemy", // Use the specific enemy particle key
                        this.x,
                        this.y,
                        {
                            count: 12,
                            speed: 150,
                            scale: 1,
                            lifespan: 800,
                        }
                    );
                } catch (e) {
                    // Silently catch errors during scene transitions
                    console.warn(
                        "Error triggering enemy particles during scene transition"
                    );
                }
            }

            // Play destruction sound if scene is still active AND not shutting down
            if (
                this.gameScene &&
                this.gameScene.sound &&
                !gameScene.isShuttingDown
            ) {
                this.gameScene.sound.play("hit", { volume: 0.3 });
            }
        }

        super.destroy(fromScene);
    }
}

