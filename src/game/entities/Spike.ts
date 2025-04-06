import Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import { Boulder } from "./Boulder";
import Game from "../scenes/Game";

export class Spike extends Phaser.Physics.Arcade.Image {
    private health = 1;
    protected gameScene: Game;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, "spikes");
        this.gameScene = scene as Game;
        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            // Prevent spikes from falling or being pushed
            body.setAllowGravity(false);
            body.setImmovable(true);

            // Configure the body size and offset
            body.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.8);
            body.setOffset(TILE_SIZE * 0.1, TILE_SIZE * 0.1);

            // No need for updateFromGameObject for dynamic bodies configured this way
        }
    }

    /**
     * Take damage when hit
     * @param amount Amount of damage to take (defaults to 1)
     * @returns true if the spike is still intact, false if destroyed
     */
    public takeDamage(amount: number = 1): boolean {
        if (!this.active) return false;

        this.health -= amount;

        // If spike is destroyed, trigger particles if available
        if (this.health <= 0) {
            if (this.gameScene.particleManager) {
                this.gameScene.particleManager.triggerParticles(
                    "spikes",
                    this.x,
                    this.y,
                    { count: 5 }
                );
            }

            // Play sound if available
            if (this.gameScene.sound) {
                this.gameScene.sound.play("hit");
            }

            this.destroy();
            return false;
        }

        return true;
    }

    /**
     * Handle collision with a boulder
     */
    public handleBoulderCollision(boulder: Boulder): boolean {
        if (!this.active || !boulder.active) return false;

        // Use boulder's isDangerous method to determine if we take damage
        if (boulder.isDangerous()) {
            // Take damage from the boulder
            this.takeDamage(1);

            // Boulder takes damage when it hits the spike
            boulder.takeDamage(1);

            return true;
        }

        return false;
    }
}

