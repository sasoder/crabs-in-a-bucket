import Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import Game from "../scenes/Game";
// BaseGameEntity is not needed for a static object
// import { BaseGameEntity } from "./BaseGameEntity";

// Changed to extend Sprite directly for a simpler static object
export class Spike extends Phaser.Physics.Arcade.Sprite {
    protected health: number;
    protected gameScene: Game;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, "spikes");
        this.gameScene = scene as Game;
        this.health = 1; // Set initial health

        // Add to scene and enable physics
        scene.add.existing(this);
        scene.physics.add.existing(this, true); // true for static

        // Set physics body properties
        this.body?.setSize(TILE_SIZE * 0.7, TILE_SIZE * 0.7);
        this.body?.setOffset(TILE_SIZE * 0.15, TILE_SIZE * 0.15);
    }

    /**
     * Take damage and handle destruction
     */
    public takeDamage(amount: number = 1): boolean {
        if (!this.active) return false;

        this.health -= amount;

        // Visual feedback
        this.scene.tweens.add({
            targets: this,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
        });

        if (this.health <= 0) {
            // Create destruction particles
            if (this.gameScene.particleManager) {
                this.gameScene.particleManager.triggerParticles(
                    "spikes",
                    this.x,
                    this.y,
                    { count: 5 }
                );
            }

            // Play destruction sound
            this.gameScene.sound.play("hit");

            this.destroy();
            return false;
        }

        return true;
    }
}

