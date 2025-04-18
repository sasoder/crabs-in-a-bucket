// src/game/entities/Boulder.ts
import Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import Game from "../scenes/Game";
import { Player } from "./Player";
import { Enemy } from "./Enemy";
import { Spike } from "./Spike";

export class Boulder extends Phaser.Physics.Arcade.Image {
    protected gameScene: Game;
    private health = 3;
    private damageAmount = 1;
    public safeForPlayer = false;
    private safeDuration = 300;
    private safeTimer?: Phaser.Time.TimerEvent;

    private previousVelocityY = 0;
    private lastImpactTime = 0;
    private readonly LANDING_IMPACT_COOLDOWN = 150;

    private readonly DANGEROUS_VELOCITY_THRESHOLD = 30;
    private readonly IMPACT_DAMAGE_VELOCITY_Y = 40;
    private readonly WEAR_AND_TEAR_DAMAGE = 1;

    // Flag to track if we were falling
    private wasFalling = false;

    // Add spawn grace period tracking
    private spawnTime: number;
    private readonly spawnGracePeriod = 250; // ms of invulnerability after spawn

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x + TILE_SIZE / 2, y + TILE_SIZE / 2, "boulder");
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.gameScene = scene as Game;

        // Record spawn time
        this.spawnTime = this.scene.time.now;

        this.setCollideWorldBounds(true);
        this.setBounce(0.2);
        this.setGravityY(300);
        this.setImmovable(false);
        this.setFriction(0.3);
        this.setMass(2);

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.allowRotation = true;
            body.setAngularDrag(20);
            body.setBounce(0);
            body.useDamping = true;
            body.setDrag(0.98);

            const radius = TILE_SIZE * 0.4;
            body.setCircle(
                radius,
                (this.width - radius * 2) / 2,
                (this.height - radius * 2) / 2
            );
        }

        if (this.gameScene.terrainManager) {
            this.scene.physics.add.collider(
                this,
                this.gameScene.terrainManager.getRowColliderGroup(),
                this.handleImpact,
                undefined,
                this
            );
        }
    }

    update(time: number, delta: number): void {
        if (!this.body) return;
        const body = this.body as Phaser.Physics.Arcade.Body;

        // Track if we're falling faster than the landing impact threshold
        if (body.velocity.y > this.IMPACT_DAMAGE_VELOCITY_Y) {
            this.wasFalling = true;
        }

        // Store previous velocity for impact detection
        this.previousVelocityY = body.velocity.y;

        if (Math.abs(body.velocity.x) > 5) {
            // Fix rotation direction - positive velocity should result in clockwise rotation
            const rotationSpeed = body.velocity.x * 0.002;
            this.rotation += rotationSpeed;
        } else {
            this.setAngularVelocity(body.angularVelocity * 0.9);
        }

        // Check for landing damage on each update
        this.checkForLandingDamage();
    }

    private handleImpact: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
        _boulder,
        _rowCollider
    ) => {
        // Always check for landing damage on collision
        this.checkForLandingDamage();
    };

    private checkForLandingDamage(): void {
        if (!this.body || !this.active) return;

        const body = this.body as Phaser.Physics.Arcade.Body;
        const currentTime = this.scene.time.now;

        // Skip ALL landing logic during grace period
        if (currentTime < this.spawnTime + this.spawnGracePeriod) {
            this.wasFalling = false; // Reset falling state during grace period
            return; // Exit early
        }

        // Boulder must have been falling faster than threshold and now be nearly stopped vertically
        const stoppedFalling = Math.abs(body.velocity.y) < 10;
        const cooldownOver =
            currentTime - this.lastImpactTime > this.LANDING_IMPACT_COOLDOWN;

        // Check if we were falling hard and have now stopped
        if (this.wasFalling && stoppedFalling && cooldownOver) {
            this.lastImpactTime = currentTime;
            this.wasFalling = false; // Reset falling state

            // Take damage from the impact
            this.takeDamage(this.WEAR_AND_TEAR_DAMAGE);

            // Play visual and audio effects
            this.playImpactEffects();

            // Damage anything below
            this.damageEntitiesBelow();
        }
    }

    private playImpactEffects(): void {
        if (!this.active || !this.body) return;
        const body = this.body as Phaser.Physics.Arcade.Body;

        this.gameScene.tweens.add({
            targets: this,
            scaleX: 1.1,
            scaleY: 0.9,
            duration: 80,
            yoyo: true,
            ease: "Sine.easeInOut",
        });
        if (this.gameScene.particleManager) {
            this.gameScene.particleManager.triggerParticles(
                "boulder",
                this.x,
                this.y,
                {
                    count: 5,
                    speed: 40,
                    lifespan: 500,
                    scale: 0.8,
                }
            );
        }
    }

    private damageEntitiesBelow(): void {
        if (!this.body || !this.active) return;
        const body = this.body as Phaser.Physics.Arcade.Body;

        const impactRadius = TILE_SIZE * 0.6;
        const impactCheckY = body.bottom + TILE_SIZE * 0.5;

        const targets: Phaser.GameObjects.GameObject[] = [
            ...(this.gameScene.enemiesGroup?.getChildren() || []),
            ...(this.gameScene.terrainManager
                ?.getSpikesGroup()
                ?.getChildren() || []),
        ];
        if (this.gameScene.player) {
            targets.push(this.gameScene.player);
        }

        targets.forEach((targetGO) => {
            if (
                !(
                    targetGO instanceof Player ||
                    targetGO instanceof Enemy ||
                    targetGO instanceof Spike
                ) ||
                !targetGO.active
            ) {
                return;
            }

            const target = targetGO;
            let targetBody:
                | Phaser.Physics.Arcade.Body
                | Phaser.Physics.Arcade.StaticBody
                | null = null;

            if ("body" in target && target.body) {
                targetBody = target.body;
            }

            if (!targetBody) return;

            // Check if entity is below the boulder when it lands
            if (
                Math.abs(targetBody.center.x - this.x) < impactRadius &&
                targetBody.center.y > body.bottom &&
                targetBody.center.y < impactCheckY
            ) {
                // Damage enemies when landed upon
                if (target instanceof Enemy) {
                    target.takeDamage(999); // Apply lethal damage
                } else if (target instanceof Player) {
                    if (!this.safeForPlayer) {
                        target.takeDamage(1, "boulder_land");
                    }
                } else if (target instanceof Spike) {
                    target.takeDamage(999);
                    this.takeDamage(1);
                }
            }
        });
    }

    /**
     * Applies damage to another object upon collision.
     * Assumes the decision to deal damage was already made (e.g., based on velocity).
     * Handles different damage amounts/effects based on target type.
     * @param otherObject The object the boulder collided with.
     * @returns True if the other object was actively damaged, false otherwise.
     */
    public dealDamageOnCollision(
        otherObject: Player | Enemy | Spike // Simplified type, no Boulder here
    ): boolean {
        if (
            !this.active ||
            !("body" in otherObject) ||
            !otherObject.body ||
            !otherObject.active
        ) {
            return false; // Cannot deal damage if inactive or target invalid
        }

        let damaged = false;
        const selfDamage = this.WEAR_AND_TEAR_DAMAGE; // Wear-and-tear damage

        // --- ADDED CHECK: Only take self-damage if moving dangerously ---
        const shouldTakeSelfDamage = this.isMovingDangerously();
        // --- END CHECK ---

        if (otherObject instanceof Player) {
            // Player damage is handled in Game.ts handlePlayerBoulderCollision
            // This method might not even be called for Player if logic is fully in Game.ts
            // However, if called, apply damage:
            if (!this.safeForPlayer) {
                // Still respect safety flag
                otherObject.takeDamage(this.damageAmount, "boulder_collision");
                // --- USE CHECK FOR SELF-DAMAGE ---
                if (shouldTakeSelfDamage) {
                    this.takeDamage(selfDamage);
                }
                // --- END CHECK ---
                damaged = true;
                // this.playCollisionHitEffect(); // Play effect on successful hit
            }
            this.markAsSafeForPlayer(); // Mark safe regardless of damage dealt this frame
        } else if (otherObject instanceof Enemy) {
            // Instantly kill enemies
            otherObject.takeDamage(999);
            // --- USE CHECK FOR SELF-DAMAGE ---
            if (shouldTakeSelfDamage) {
                this.takeDamage(selfDamage);
            }
            // --- END CHECK ---
            damaged = true;
            // this.playCollisionHitEffect();
        } else if (otherObject instanceof Spike) {
            // Destroy spikes
            otherObject.takeDamage(999); // Use takeDamage which handles destruction

            this.takeDamage(selfDamage);

            damaged = true; // Spike was "damaged" (destroyed)
            // this.playCollisionHitEffect();
        }

        return damaged;
    }

    public isMovingDangerously(): boolean {
        if (!this.body || !this.active) return false;
        const body = this.body as Phaser.Physics.Arcade.Body;
        const velocityMagnitude = body.velocity.length();
        return velocityMagnitude > this.DANGEROUS_VELOCITY_THRESHOLD;
    }

    markAsSafeForPlayer(): void {
        if (this.safeTimer) {
            this.safeTimer.remove();
        }
        this.safeForPlayer = true;

        this.safeTimer = this.scene.time.delayedCall(this.safeDuration, () => {
            this.safeForPlayer = false;
            this.safeTimer = undefined;
        });
    }

    getVelocity(): Phaser.Math.Vector2 {
        if (!this.body) return Phaser.Math.Vector2.ZERO;
        const body = this.body as Phaser.Physics.Arcade.Body;
        return body.velocity;
    }

    getVelocityMagnitude(): number {
        if (!this.body) return 0;
        const body = this.body as Phaser.Physics.Arcade.Body;
        return body.velocity.length();
    }

    public getDamageAmount(): number {
        return this.damageAmount;
    }

    public takeDamage(amount: number = 1): boolean {
        // Grace period check remains here for direct damage calls
        if (
            this.active &&
            this.scene.time.now < this.spawnTime + this.spawnGracePeriod
        ) {
            return true; // Still alive, just invulnerable
        }

        if (!this.active) return false;

        this.health -= amount;

        this.scene.tweens.add({
            targets: this,
            alpha: {
                from: Math.max(0.1, this.health / 3 - 0.3),
                to: this.health / 3,
            },
            duration: 150,
            ease: "Power1",
            onStart: () => {
                if (this.alpha < 0.1) this.setAlpha(0.1);
            },
            onComplete: () => {
                if (this.active) this.setAlpha(this.health / 3);
            },
        });

        if (this.health <= 0) {
            this.explode();
            return false;
        }

        return true;
    }

    private explode(): void {
        if (!this.active) return;

        this.setActive(false);
        this.setVisible(false);
        if (this.body) {
            this.body.enable = false;
        }

        // Only play sound if not shutting down
        if (!this.gameScene.isShuttingDown) {
            this.scene.sound.play("hit", { volume: 0.3 });
        }

        if (this.gameScene.particleManager) {
            this.gameScene.particleManager.triggerParticles(
                "boulder",
                this.x,
                this.y,
                {
                    count: 15,
                    speed: 45,
                    lifespan: 450,
                    scale: 0.8,
                }
            );
        }

        if (this.safeTimer) {
            this.safeTimer.remove();
            this.safeTimer = undefined;
        }

        this.scene.time.delayedCall(50, () => {
            super.destroy();
        });
    }

    destroy(fromScene?: boolean) {
        if (this.safeTimer) {
            this.safeTimer.remove();
            this.safeTimer = undefined;
        }
        if (this.body) {
            this.body.enable = false;
        }
        super.destroy(fromScene);
    }
}

