// src/game/entities/Player.ts
import Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import { EventBus } from "../EventBus"; // Import EventBus
import { Boulder } from "./Boulder"; // Import Boulder type
import { Enemy } from "./Enemy"; // Import Enemy type

export class Player extends Phaser.Physics.Arcade.Sprite {
    private moveSpeed = 80; // Adjust as needed
    private jumpVelocity = -200; // Adjust as needed
    private bounceVelocity = -100; // Bounce after stomp
    private digCooldown = 150; // Milliseconds between digs
    private lastDigTime = 0;
    public isInvulnerable = false;
    private invulnerabilityDuration = 500; // ms
    private invulnerabilityTimer?: Phaser.Time.TimerEvent;

    private readonly VELOCITY_DAMAGE_THRESHOLD_X = 50;
    private readonly VELOCITY_DAMAGE_THRESHOLD_Y = 50;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, "player"); // Assuming 'player' spritesheet is loaded
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true); // Keep player within horizontal bounds
        this.setGravityY(300); // Adjust gravity
        this.body?.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.9); // Adjust collider size/offset
        this.body?.setOffset(TILE_SIZE * 0.1, TILE_SIZE * 0.05);

        // Add animations if using a spritesheet
        // this.anims.create({...});
        // this.anims.play('idle');
    }

    private canJumpOrDig(): boolean {
        return (
            ((this.body?.blocked.down || this.body?.touching.down) &&
                this.scene.time.now > this.lastDigTime + this.digCooldown) ||
            false
        );
    }

    private attemptJumpAndDig() {
        if (!this.canJumpOrDig()) {
            return;
        }

        this.lastDigTime = this.scene.time.now;

        // 1. Trigger Jump
        this.setVelocityY(this.jumpVelocity);
        // Play jump animation if available
        // this.anims.play('jump', true);

        // 2. Trigger Dig Event (coordinates directly below player center)
        const digWorldX = this.x;
        // Adjust Y slightly below the player's bottom edge
        const digWorldY = this.body!.bottom + TILE_SIZE / 2; // Use body bottom
        EventBus.emit("player-dig-attempt", {
            worldX: digWorldX,
            worldY: digWorldY,
        });
        console.log(`Dig attempt emitted at ${digWorldX}, ${digWorldY}`);
    }

    bounce() {
        this.setVelocityY(this.bounceVelocity);
    }

    takeDamage(amount: number = 1): boolean {
        if (this.isInvulnerable) {
            return true; // Still alive, but took no damage
        }

        const currentLives = this.scene.registry.get("lives") as number;
        const newLives = Math.max(0, currentLives - amount);
        this.scene.registry.set("lives", newLives);
        EventBus.emit("update-stats", { lives: newLives }); // Quick update
        EventBus.emit("player-damaged"); // For effects like flashing/sound

        console.log(`Player took damage! Lives remaining: ${newLives}`);

        if (newLives <= 0) {
            EventBus.emit("player-died");
            // Optionally play death animation, disable input etc.
            this.setActive(false); // Stop updates
            this.setVisible(false); // Hide
            this.body!.enable = false; // Disable physics
            return false; // Player is dead
        } else {
            // Become invulnerable briefly
            this.setTemporaryInvulnerability(this.invulnerabilityDuration);
            return true; // Player survived
        }
    }

    setTemporaryInvulnerability(duration: number) {
        if (this.isInvulnerable) {
            // If already invulnerable, potentially reset the timer
            // Or just return, depending on desired behavior
            return;
        }
        this.isInvulnerable = true;
        this.setAlpha(0.5); // Visual feedback

        // Clear existing timer if any
        if (this.invulnerabilityTimer) {
            this.invulnerabilityTimer.remove();
        }

        // Set a timer to remove invulnerability
        this.invulnerabilityTimer = this.scene.time.delayedCall(
            duration,
            () => {
                this.isInvulnerable = false;
                this.setAlpha(1);
                this.invulnerabilityTimer = undefined; // Clear the timer reference
            }
        );
    }

    handleBoulderCollision(boulder: Boulder) {
        if (!this.body || !boulder.body) {
            return; // Safety check
        }

        const playerBody = this.body as Phaser.Physics.Arcade.Body;
        const boulderBody = boulder.body as Phaser.Physics.Arcade.Body;

        // Check if player is landing on top (give some tolerance)
        const isLandingOnTop =
            playerBody.velocity.y > 0 &&
            playerBody.bottom <= boulderBody.top + 5;

        if (isLandingOnTop) {
            // console.log("Player landed on boulder, no damage.");
            return; // No damage if landing directly on top
        }

        const velocityXDiff = playerBody.velocity.x - boulderBody.velocity.x;
        const velocityYDiff = playerBody.velocity.y - boulderBody.velocity.y;

        const takesDamage =
            playerBody.position.y > boulderBody.position.y &&
            (Math.abs(velocityXDiff) > this.VELOCITY_DAMAGE_THRESHOLD_X ||
                velocityYDiff > this.VELOCITY_DAMAGE_THRESHOLD_Y);

        if (takesDamage) {
            console.log(
                `Player hit by boulder! VelDiff: (${velocityXDiff.toFixed(
                    1
                )}, ${velocityYDiff.toFixed(1)})`
            );
            this.takeDamage();
        } else {
            // It's just a push, physics engine handles it
            // console.log("Player pushed by boulder, no damage.");
        }
    }

    handleEnemyCollision(enemy: Enemy) {
        if (!this.body || !enemy.body || !enemy.active) {
            return false;
        }

        const playerBody = this.body as Phaser.Physics.Arcade.Body;
        const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;

        const touchingDown =
            playerBody.velocity.y > 0 && playerBody.bottom <= enemyBody.top + 5;

        if (touchingDown) {
            console.log("Enemy stomped!");
            enemy.takeDamage(999);
            this.bounce();

            // Award coins
            const coinReward = 5;
            const currentCoins = this.scene.registry.get("coins") as number;
            this.scene.registry.set("coins", currentCoins + coinReward);

            // Update total coins collected
            let totalCoinsCollected =
                (this.scene.registry.get("totalCoinsCollected") as number) || 0;
            totalCoinsCollected += coinReward;
            this.scene.registry.set("totalCoinsCollected", totalCoinsCollected);

            EventBus.emit("stats-changed");
            return true;
        } else if (!this.isInvulnerable) {
            console.log("Player hit enemy side-on!");
            const survived = this.takeDamage();
            if (survived) {
                const knockbackX = this.x < enemy.x ? -150 : 150;
                const knockbackY = -100;
                this.setVelocity(knockbackX, knockbackY);
                this.setTemporaryInvulnerability(500);
            }
            enemy.takeDamage(999);
            return true;
        }

        return false;
    }

    // Basic movement update
    update(
        cursors: Phaser.Types.Input.Keyboard.CursorKeys,
        time: number,
        delta: number
    ) {
        // Skip update if player is inactive (e.g., after dying)
        if (!this.active) {
            this.setVelocity(0);
            return;
        }

        if (cursors.left.isDown) {
            this.setVelocityX(-this.moveSpeed);
            this.setFlipX(true); // Flip sprite left
            // this.anims.play('run', true);
        } else if (cursors.right.isDown) {
            this.setVelocityX(this.moveSpeed);
            this.setFlipX(false); // Normal sprite direction
            // this.anims.play('run', true);
        } else {
            this.setVelocityX(0);
            // Play idle animation if on ground
            if (this.body?.blocked.down || this.body?.touching.down) {
                // this.anims.play('idle', true);
            }
        }

        // --- Jump / Dig ---
        if (cursors.up.isDown) {
            this.attemptJumpAndDig();
        }

        // Prevent sticking to walls when falling
        if (
            !this.body?.blocked.down &&
            !this.body?.touching.down &&
            this.body?.velocity.x !== 0
        ) {
            if (this.body?.blocked.left || this.body?.blocked.right) {
                this.setVelocityX(0);
            }
        }
    }

    // Ensure timer is cleaned up if the player is destroyed
    destroy(fromScene?: boolean) {
        if (this.invulnerabilityTimer) {
            this.invulnerabilityTimer.remove();
            this.invulnerabilityTimer = undefined;
        }
        super.destroy(fromScene);
    }
}

