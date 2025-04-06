// src/game/entities/Boulder.ts
import Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import Game from "../scenes/Game";

export class Boulder extends Phaser.Physics.Arcade.Image {
    protected gameScene: Game;
    private health = 3;
    private damageAmount = 1; // Default damage amount
    private damageThreshold = 150; // Min velocity difference to cause damage for player
    private movementThreshold = 35; // Balanced threshold for determining if boulder is moving enough to damage enemies
    private _isDangerous = false; // Track if boulder is in a dangerous state
    private lastVelocityMagnitude = 0; // Track the last velocity for more consistent state management
    private safeForPlayer = false; // Track if boulder was just pushed by player
    private safeDuration = 500; // Increased from 300 to 500ms for more reliable safety period
    private safeTimer?: Phaser.Time.TimerEvent; // Timer for resetting safe status
    private lastPlayerInteraction = 0; // Track when player last interacted with boulder

    // For tracking falling impact
    private previousVelocityY = 0; // Track previous velocity for impact detection
    private fallingVelocityThreshold = 120; // Minimum velocity to cause impact damage
    private lastImpactTime = 0; // Prevent multiple impacts in quick succession
    private impactCooldown = 150; // Cooldown between allowed impacts in ms

    constructor(scene: Phaser.Scene, x: number, y: number) {
        // Assuming you have a 'boulder' texture loaded
        super(scene, x + TILE_SIZE / 2, y + TILE_SIZE / 2, "boulder"); // Center in tile
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.gameScene = scene as Game;

        this.setCollideWorldBounds(true); // Let them fall off-screen
        this.setBounce(0.3); // Slightly higher bounce for more dynamic collisions
        this.setGravityY(300); // Adjust gravity as needed
        this.setImmovable(false); // They should be pushable/affected by physics
        this.setFriction(0.2); // Add friction for realistic rolling
        this.setMass(2); // Higher mass than default for momentum calculations

        // Enable angular velocity for rotation
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.allowRotation = true;
            body.setAngularDrag(10);
        }

        // Make the boulder circular
        const radius = TILE_SIZE * 0.4;
        this.body?.setCircle(
            radius,
            (this.width - radius * 2) / 2, // Center the circle body
            (this.height - radius * 2) / 2
        );

        // Add collision with the row colliders
        if (this.gameScene.terrainManager) {
            this.scene.physics.add.collider(
                this,
                this.gameScene.terrainManager.getRowColliderGroup(),
                this.handleImpact,
                undefined,
                this
            );
        }

        // Boulder-boulder collisions are handled in Game.ts
    }

    preUpdate(time: number, delta: number): void {
        // Update dangerous state on every physics frame for reliability
        this.updateDangerousState();

        // Store previous velocity for impact detection
        if (this.body) {
            this.previousVelocityY = this.body.velocity.y;
        }

        // Update rotation based on horizontal velocity (moved from update to preUpdate)
        if (this.body && Math.abs(this.body.velocity.x) > 10) {
            // Calculate rotation based on velocity direction
            const rotationSpeed = -this.body.velocity.x * 0.01;
            this.rotation += rotationSpeed;
        }
    }

    update() {
        // This method can still be called from Game.ts, but we move critical
        // physics-dependent logic to preUpdate for reliability
    }

    /**
     * Physics collision callback that handles impacts
     */
    private handleImpact: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
        _obj1,
        _obj2
    ) => {
        this.checkForLandingDamage();
    };

    /**
     * Check if the boulder should take damage from landing
     */
    private checkForLandingDamage(): void {
        if (!this.body || !this.active) return;

        const currentTime = this.scene.time.now;

        // Check for a significant impact (falling and then stopping)
        if (
            this.previousVelocityY > this.fallingVelocityThreshold &&
            Math.abs(this.body.velocity.y) < 20 && // Now relatively stopped
            currentTime - this.lastImpactTime > this.impactCooldown // Not recently impacted
        ) {
            // Calculate damage based on fall velocity
            const impactForce =
                this.previousVelocityY / this.fallingVelocityThreshold;
            const damageToDeal = Math.min(2, Math.ceil(impactForce * 0.8));

            if (damageToDeal > 0) {
                this.lastImpactTime = currentTime;
                this.takeDamage(damageToDeal);

                // Add visual feedback - subtle flash and shake
                this.gameScene.tweens.add({
                    targets: this,
                    alpha: { from: 0.4, to: this.alpha },
                    duration: 150,
                    ease: "Power2",
                });

                // Create dust particles on impact if available
                if (this.gameScene.particleManager) {
                    this.gameScene.particleManager.triggerParticles(
                        "dirt_tile",
                        this.x,
                        this.y + this.height / 2,
                        { count: 5 }
                    );
                }
            }
        }
    }

    /**
     * Update the boulder's dangerous state based on its current velocity
     */
    private updateDangerousState() {
        if (!this.body) return;

        // Calculate velocity magnitude (speed)
        const velocityMagnitude = Math.sqrt(
            Math.pow(this.body.velocity.x, 2) +
                Math.pow(this.body.velocity.y, 2)
        );

        // Use hysteresis to prevent rapid flipping between states
        // Only change state when crossing threshold by a significant amount
        if (
            !this._isDangerous &&
            velocityMagnitude > this.movementThreshold + 10
        ) {
            this._isDangerous = true;
        } else if (
            this._isDangerous &&
            velocityMagnitude < this.movementThreshold - 10
        ) {
            this._isDangerous = false;
        }

        // Store the last velocity magnitude
        this.lastVelocityMagnitude = velocityMagnitude;
    }

    /**
     * Mark this boulder as safe for player after being pushed
     * It will still be dangerous to enemies
     */
    markAsSafeForPlayer(): void {
        // Cancel any existing timers first
        if (this.safeTimer) {
            this.safeTimer.remove();
        }

        this.safeForPlayer = true;
        this.lastPlayerInteraction = this.scene.time.now;

        // Set timer to reset the safe status
        this.safeTimer = this.scene.time.delayedCall(this.safeDuration, () => {
            this.safeForPlayer = false;
            this.safeTimer = undefined;
        });
    }

    /**
     * Get velocity information for damage calculations
     */
    getVelocity(): Phaser.Math.Vector2 {
        if (!this.body) return new Phaser.Math.Vector2(0, 0);
        return this.body.velocity;
    }

    /**
     * Get the current velocity magnitude
     */
    getVelocityMagnitude(): number {
        return this.lastVelocityMagnitude;
    }

    /**
     * Check if the boulder is moving enough to cause damage to enemies
     * Requires significant movement to cause damage
     */
    isMoving(): boolean {
        if (!this.body) return false;

        // Calculate velocity magnitude (speed)
        const velocityMagnitude = Math.sqrt(
            Math.pow(this.body.velocity.x, 2) +
                Math.pow(this.body.velocity.y, 2)
        );

        return velocityMagnitude > this.movementThreshold;
    }

    /**
     * Check if the boulder is in a dangerous state
     * @param forPlayer If true, check if dangerous specifically for player
     */
    isDangerous(forPlayer: boolean = false): boolean {
        // For player, honor the safe period after being pushed
        if (forPlayer && this.safeForPlayer) {
            return false;
        }

        // Require more movement (higher threshold) to damage player than enemies
        if (forPlayer) {
            return (
                this._isDangerous &&
                this.lastVelocityMagnitude > this.movementThreshold * 1.5
            );
        }

        return this._isDangerous;
    }

    /**
     * Get the damage threshold for player collisions
     */
    public getDamageThreshold(): number {
        return this.damageThreshold;
    }

    /**
     * Get the current damage amount
     */
    public getDamageAmount(): number {
        return this.damageAmount;
    }

    /**
     * Take damage when the boulder damages something else
     * @param amount Amount of damage to take (defaults to 1)
     * @returns true if the boulder is still intact, false if destroyed
     */
    public takeDamage(amount: number = 1): boolean {
        this.health -= amount;

        // Update opacity based on remaining health
        const newOpacity = Math.max(0.3, this.health / 3);
        this.setAlpha(newOpacity);

        // Add a flash effect to show damage
        this.scene.tweens.add({
            targets: this,
            alpha: { from: 0.1, to: newOpacity },
            duration: 200,
            ease: "Power2",
        });

        // If boulder is destroyed, trigger particles if available
        if (this.health <= 0) {
            if (this.gameScene.particleManager) {
                this.gameScene.particleManager.triggerParticles(
                    "dirt_tile",
                    this.x,
                    this.y,
                    { count: 10 }
                );
            }
            this.destroy();
            return false;
        }

        return true;
    }

    // Ensure timers are cleaned up if the boulder is destroyed
    destroy(fromScene?: boolean) {
        if (this.safeTimer) {
            this.safeTimer.remove();
            this.safeTimer = undefined;
        }
        super.destroy(fromScene);
    }
}

