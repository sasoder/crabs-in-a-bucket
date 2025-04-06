import Phaser from "phaser";
import { EventBus } from "../EventBus";
import { TILE_SIZE } from "../constants";
import Game from "../scenes/Game";

export class TNT extends Phaser.Physics.Arcade.Sprite {
    private gameScene: Game;
    private explosionTimer: Phaser.Time.TimerEvent;
    private tickSound?: Phaser.Sound.BaseSound;
    private explosionRadius = 3 * TILE_SIZE; // 3 tile radius
    private explosionDamage = 999;
    private tickInterval = 1000; // 1 second between ticks
    private countdownSeconds = 5;
    private currentTick = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x + TILE_SIZE / 2, y + TILE_SIZE / 2, "tnt");
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.gameScene = scene as Game;

        this.setCollideWorldBounds(true);
        this.setBounce(0.2);
        this.setGravityY(300);
        this.setFriction(1); // High friction to prevent sliding

        // Set high drag to prevent excessive rolling
        if (this.body) {
            const body = this.body as Phaser.Physics.Arcade.Body;
            body.setMass(2); // Heavier than default
        }

        // Set up the countdown with ticking
        this.startCountdown();

        // Set up collision with terrain
        if (this.gameScene.terrainManager) {
            this.scene.physics.add.collider(
                this,
                this.gameScene.terrainManager.getRowColliderGroup()
            );
        }

        // Make the sprite slightly smaller than a full tile
        this.setDisplaySize(TILE_SIZE * 0.85, TILE_SIZE * 0.85);
    }

    private startCountdown(): void {
        this.currentTick = 0;

        // Create and play tick sound
        this.tickSound = this.scene.sound.add("tick", { loop: false });

        // Play the first tick immediately
        this.playTick();

        // Set up the explosion timer
        this.explosionTimer = this.scene.time.addEvent({
            delay: this.tickInterval,
            callback: this.onTick,
            callbackScope: this,
            repeat: this.countdownSeconds - 1, // -1 because we already played the first tick
        });
    }

    private onTick(): void {
        this.currentTick++;

        // Play tick sound and flash the TNT
        this.playTick();

        // If we've reached the countdown limit, explode
        if (this.currentTick >= this.countdownSeconds) {
            this.explode();
        }
    }

    private playTick(): void {
        // Play the tick sound
        if (this.tickSound && this.tickSound.isPlaying) {
            this.tickSound.stop();
        }
        this.tickSound?.play();

        // Visual feedback - flash the TNT
        this.scene.tweens.add({
            targets: this,
            alpha: 0.6,
            duration: 100,
            yoyo: true,
            ease: "Power1",
        });

        // Scale pulse for better visual feedback as time runs out
        const scaleFactor = 1 + this.currentTick * 0.05; // Increases as countdown progresses
        this.scene.tweens.add({
            targets: this,
            scaleX: scaleFactor,
            scaleY: scaleFactor,
            duration: 200,
            yoyo: true,
        });
    }

    private explode(): void {
        if (!this.active) return;

        // Play explosion sound
        this.scene.sound.play("explosion");

        // Explosion effect with particles if available
        if (this.gameScene.particleManager) {
            this.gameScene.particleManager.triggerParticles(
                "dirt_tile",
                this.x,
                this.y,
                { count: 250, speed: 100 }
            );
        }

        // Emit event for terrain destruction and damage
        EventBus.emit("create-explosion", {
            worldX: this.x,
            worldY: this.y,
            radius: this.explosionRadius,
        });

        // Apply damage to any entities in range
        this.damageEntitiesInRange();

        // Destroy the TNT
        this.destroy();
    }

    private damageEntitiesInRange(): void {
        // Damage enemies in range
        if (this.gameScene.enemiesGroup) {
            this.gameScene.enemiesGroup.getChildren().forEach((entity) => {
                const enemy = entity as Phaser.Physics.Arcade.Sprite;
                if (
                    enemy.active &&
                    Phaser.Math.Distance.Between(
                        this.x,
                        this.y,
                        enemy.x,
                        enemy.y
                    ) <= this.explosionRadius
                ) {
                    // Use damage mechanism if available
                    if (
                        "takeDamage" in enemy &&
                        typeof enemy.takeDamage === "function"
                    ) {
                        enemy.takeDamage(this.explosionDamage);
                    }
                }
            });
        }

        // Damage boulders in range
        if (this.gameScene.bouldersGroup) {
            this.gameScene.bouldersGroup.getChildren().forEach((entity) => {
                const boulder = entity as Phaser.Physics.Arcade.Sprite;
                if (
                    boulder.active &&
                    Phaser.Math.Distance.Between(
                        this.x,
                        this.y,
                        boulder.x,
                        boulder.y
                    ) <= this.explosionRadius
                ) {
                    // Use damage mechanism if available
                    if (
                        "takeDamage" in boulder &&
                        typeof boulder.takeDamage === "function"
                    ) {
                        boulder.takeDamage(this.explosionDamage);
                    }
                }
            });
        }

        // Check if player is in range and damage them too
        if (this.gameScene.player && this.gameScene.player.active) {
            const distance = Phaser.Math.Distance.Between(
                this.x,
                this.y,
                this.gameScene.player.x,
                this.gameScene.player.y
            );

            if (distance <= this.explosionRadius) {
                // Use player's damage mechanism
                if (
                    "takeDamage" in this.gameScene.player &&
                    typeof this.gameScene.player.takeDamage === "function"
                ) {
                    this.gameScene.player.takeDamage(1); // Only deal 1 damage to player
                }
            }
        }
    }

    destroy(fromScene?: boolean) {
        // Clean up timers and sounds
        if (this.explosionTimer) {
            this.explosionTimer.remove();
        }

        if (this.tickSound && this.tickSound.isPlaying) {
            this.tickSound.stop();
        }

        super.destroy(fromScene);
    }
}

