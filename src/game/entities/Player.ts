// src/game/entities/Player.ts
import Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import { EventBus } from "../EventBus"; // Import EventBus
import { Boulder } from "./Boulder"; // Import Boulder type
import { Enemy } from "./Enemy"; // Import Enemy type
import Game from "../scenes/Game";
import { Relic } from "../data/Relics";
import { Coin } from "./Coin";
// --- Import new entity types ---

export class Player extends Phaser.Physics.Arcade.Sprite {
    private moveSpeed = 80; // Base speed
    private jumpVelocity = -140; // Base jump velocity
    private bounceVelocity = -150; // Bounce after stomp
    private digCooldown = 150; // Milliseconds between digs
    private lastDigTime = 0;
    public isInvulnerable = false;
    private invulnerabilityDuration = 500; // ms
    private invulnerabilityTimer?: Phaser.Time.TimerEvent;
    private recentBoulderCollisions: Map<Boulder, number> = new Map(); // Track recent boulder collisions
    private boulderCollisionCooldown = 500; // ms between allowed boulder collisions

    // Scene reference with correct type
    private gameScene: Game;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, "player"); // Assuming 'player' spritesheet is loaded
        this.gameScene = scene as Game; // Cast scene to Game type
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true); // Keep player within horizontal bounds
        this.setGravityY(300); // Adjust gravity
        this.body?.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.9); // Adjust collider size/offset
        this.body?.setOffset(TILE_SIZE * 0.1, TILE_SIZE * 0.05);
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
        const jumpMultiplier = (
            this.scene.registry.get("relics") as string[]
        ).reduce((acc, relicId) => {
            if (relicId === "FEATHER_WEIGHT") {
                return acc * 1.2;
            }
            return acc;
        }, 1);

        this.setVelocityY(this.jumpVelocity * jumpMultiplier);
        this.scene.sound.play("jump", { volume: 0.3 });

        // basic scaling animation based on scaling factor using phaser tween. should be a pulse effect and not repeat
        this.scene.tweens.add({
            targets: this,
            scale: this.scale * 1.2,
            duration: 100,
            ease: "power2.inOut",
            yoyo: true,
            repeat: 0,
        });
        // 2. Directly attempt row clear via TerrainManager
        const checkWorldX = this.x;
        // Check slightly below the player's bottom center
        let checkWorldY = this.body!.bottom + 1; // Check just below feet

        // Access terrainManager through the typed scene reference
        let rowCleared =
            this.gameScene.terrainManager.clearCurrentRow(checkWorldY);

        if (rowCleared) {
            // this.gameScene.sound.play('dig_sound'); // Optional: Base dig sound

            // 3. Handle DRILL Relic for extra depth
            const drillRelicsCount = (
                this.scene.registry.get("relics") as string[]
            ).filter((relicId) => relicId === "DRILL").length;

            if (drillRelicsCount > 0) {
                // Loop for each drill relic to clear subsequent rows
                for (let i = 0; i < drillRelicsCount; i++) {
                    // Calculate the Y position for the next row down
                    const nextRowWorldY = checkWorldY + (i + 1) * TILE_SIZE;
                    const extraRowCleared =
                        this.gameScene.terrainManager.clearCurrentRow(
                            nextRowWorldY
                        );

                    if (extraRowCleared) {
                        // Optional: Add visual/sound for extra dig
                        // this.gameScene.sound.play('drill_sound', { volume: 0.3 });
                        this.gameScene.particleManager.triggerParticles(
                            "sand_tile",
                            this.x,
                            nextRowWorldY + TILE_SIZE / 2, // Particles at the deeper row
                            { count: 2 } // Fewer particles for extra digs?
                        );
                    } else {
                        // Stop drilling deeper if a row fails (e.g., hit bottom or empty space)
                        break;
                    }
                }
            }
        }
    }

    bounce() {
        this.setVelocityY(this.bounceVelocity);
    }

    takeDamage(amount: number = 1, source?: string): boolean {
        if (this.isInvulnerable) {
            return true; // Still alive, but took no damage
        }

        const currentLives = this.scene.registry.get("lives") as number;
        const newLives = Math.max(0, currentLives - amount);
        this.scene.registry.set("lives", newLives);

        EventBus.emit("update-stats", { lives: newLives }); // Quick update
        EventBus.emit("player-damaged"); // For effects like flashing/sound

        // Play hit sound only if not shutting down
        const gameScene = this.scene as Game;
        if (!gameScene.isShuttingDown) {
            this.scene.sound.play("hit", { volume: 0.3 });
        }

        if (newLives <= 0) {
            EventBus.emit("player-died");

            // Play death sound only if not shutting down
            if (!gameScene.isShuttingDown) {
                this.scene.sound.play("die");
            }

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

    heal(amount: number): boolean {
        const currentLives = this.scene.registry.get("lives") as number;

        const newLives = currentLives + amount;
        this.scene.registry.set("lives", newLives);

        // Play heal sound only if not shutting down
        const gameScene = this.scene as Game;
        if (!gameScene.isShuttingDown) {
            this.scene.sound.play("heal", { volume: 1 });
        }

        // Emit stats update to reflect the change in the UI
        EventBus.emit("stats-changed"); // Use stats-changed for consistency

        return true; // Healed successfully
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

    handleBoulderCollision(obstacle: Boulder) {
        if (!this.body || !obstacle.active || this.isInvulnerable) {
            return;
        }

        // Check for recent collision with this boulder to prevent damage spam
        const currentTime = this.scene.time.now;
        const lastCollisionTime =
            this.recentBoulderCollisions.get(obstacle) || 0;

        if (currentTime - lastCollisionTime < this.boulderCollisionCooldown) {
            // Recent collision with this boulder, don't process again
            return;
        }

        // Record this collision
        this.recentBoulderCollisions.set(obstacle, currentTime);

        const playerBody = this.body as Phaser.Physics.Arcade.Body;
        const obstacleVelocity = obstacle.getVelocity();

        const isLandingOnTop =
            playerBody.velocity.y > 0 &&
            playerBody.bottom <= obstacle.y - obstacle.height / 2 + 5;

        if (isLandingOnTop) {
            // Allow the player to stand on top of boulders
            this.setVelocityY(0);
            return;
        }

        // Determine if player is pushing the boulder
        const isPushingBoulder =
            // Player must be moving toward the boulder
            ((playerBody.velocity.x > 10 && this.x < obstacle.x) ||
                (playerBody.velocity.x < -10 && this.x > obstacle.x)) &&
            // And boulder should be slow or moving in same direction
            (obstacle.getVelocityMagnitude() < 30 ||
                (obstacle.getVelocity().x > 0 && playerBody.velocity.x > 0) ||
                (obstacle.getVelocity().x < 0 && playerBody.velocity.x < 0));

        if (isPushingBoulder) {
            // Player is pushing - mark boulder as safe and apply physics naturally
            obstacle.markAsSafeForPlayer();
            return;
        }

        // Check if boulder is dangerous specifically for the player
        if (obstacle.isMovingDangerously() && !obstacle.safeForPlayer) {
            this.takeDamage(1, "boulder_collision"); // Pass source

            // Boulder takes damage when it damages the player
            obstacle.takeDamage(1);

            // Apply knockback in opposite direction of boulder's movement
            const knockbackX = this.x < obstacle.x ? -120 : 120;
            const knockbackY = -100;
            this.setVelocity(knockbackX, knockbackY);
            return;
        }

        // For non-dangerous boulders, check relative velocity for minor interactions
        const velocityDiffX = Math.abs(
            playerBody.velocity.x - obstacleVelocity.x
        );

        // Slight pushback from stationary or slow-moving boulders
        const pushDirection = this.x < obstacle.x ? -1 : 1;
        const pushForce = Math.max(15, velocityDiffX * 0.4);
        this.setVelocityX(pushDirection * pushForce);

        // Mark the boulder as safe for player (but still dangerous to enemies)
        obstacle.markAsSafeForPlayer();
    }

    // Placeholder for isDangerous - might not be needed if boulder handles it
    public isDangerous(forPlayer: boolean = false): boolean {
        // Player itself isn't "dangerous" in the same way a boulder is.
        // This might be needed if other entities react to player state.
        return false;
    }

    handleEnemyCollision(enemy: Enemy): boolean {
        if (!this.body || !enemy.body || !enemy.active) {
            return false;
        }

        const playerBody = this.body as Phaser.Physics.Arcade.Body;
        const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;

        // SIMPLIFY the stomp check to be more forgiving
        const isStomping =
            playerBody.velocity.y > 0 && // Player must be moving down
            playerBody.bottom < enemyBody.top + 10; // Allow a bit more leeway

        if (isStomping) {
            // STEEL_BOOTS remains as a bonus but doesn't affect safety
            const hasSteelBoots = (
                this.scene.registry.get("relics") as string[]
            ).includes("STEEL_BOOTS");

            if (hasSteelBoots) {
                enemy.takeDamage(999);
                this.bounce();
            } else {
                this.takeDamage(1);
                enemy.takeDamage(999);
                this.bounce();
            }

            return true;
        } else if (!this.isInvulnerable) {
            // NOT a stomp - this is a side collision
            const survived = this.takeDamage();

            // Optional: might want to keep the enemy alive on side collisions
            enemy.takeDamage(999);

            if (survived) {
                const knockbackX = this.x < enemy.x ? -150 : 150;
                const knockbackY = -100;
                this.setVelocity(knockbackX, knockbackY);
            }
            return true;
        }

        return false;
    }

    // Basic movement update - REMOVED keyE parameter
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

        // Clean up old collision records to prevent memory leaks
        this.cleanupCollisionRecords(time);

        // --- Calculate effective move speed based on relics ---
        const speedMultiplier = (
            this.scene.registry.get("relics") as string[]
        ).reduce(
            (acc, relicId) => {
                if (relicId === "LIGHTNING") {
                    // Check ID directly
                    return acc * 1.2; // Apply 20% increase per stack
                }
                return acc;
            },
            1 // Start with base multiplier of 1
        );
        const effectiveMoveSpeed = this.moveSpeed * speedMultiplier;
        // --- End Calculate effective move speed ---

        if (cursors.left.isDown) {
            this.setVelocityX(-effectiveMoveSpeed); // Use effective speed
            this.setFlipX(false); // Flip sprite left
            // this.anims.play('run', true);
        } else if (cursors.right.isDown) {
            this.setVelocityX(effectiveMoveSpeed); // Use effective speed
            this.setFlipX(true); // Normal sprite direction
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

        // --- Use Consumable --- Input is now handled in Game.ts

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

    // Ensure timer is cleaned up if the player is destroyed
    destroy(fromScene?: boolean) {
        if (this.invulnerabilityTimer) {
            this.invulnerabilityTimer.remove();
            this.invulnerabilityTimer = undefined;
        }
        // Clear collision records
        this.recentBoulderCollisions.clear();
        super.destroy(fromScene);
    }
}

