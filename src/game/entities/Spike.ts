import Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import Game from "../scenes/Game";
// BaseGameEntity is not needed for a static object
// import { BaseGameEntity } from "./BaseGameEntity";

// Changed to extend Sprite directly for a simpler static object
export class Spike extends Phaser.Physics.Arcade.Sprite {
    protected gameScene: Game;
    public readonly damageAmount = 1; // Damage dealt to player/enemies

    constructor(scene: Phaser.Scene, x: number, y: number) {
        // Position origin at bottom-center for easier placement on rows
        super(scene, x + TILE_SIZE / 2, y + TILE_SIZE, "spikes");
        this.gameScene = scene as Game;

        scene.add.existing(this);
        scene.physics.add.existing(this, true); // true for static

        // Adjust body size and offset for bottom-center origin
        const bodyWidth = TILE_SIZE * 0.7;
        const bodyHeight = TILE_SIZE * 0.7;
        this.body?.setSize(bodyWidth, bodyHeight);
        // Offset Y upwards so the body aligns with the visual spike tip
        this.body?.setOffset(
            (TILE_SIZE - bodyWidth) / 2,
            TILE_SIZE - bodyHeight // Offset from bottom origin
        );

        // Add a property to easily identify spikes
        this.setData("isSpike", true);
    }

    /**
     * Spikes themselves don't take damage in the conventional sense,
     * but they can be destroyed instantly by certain interactions (like boulders).
     */
    public takeDamage(amount: number = 1): boolean {
        if (!this.active) return false;

        // Any amount of damage destroys the spike
        if (amount > 0) {
            this.destroySequence();
            return false; // Was destroyed
        }
        return true; // Still active (if damage was 0?)
    }

    private destroySequence(): void {
        if (!this.active) return;

        this.setActive(false);
        this.setVisible(false);

        // Trigger destruction particles
        if (this.gameScene.particleManager) {
            this.gameScene.particleManager.triggerParticles(
                "spikes", // Use spike texture key or a different particle type
                this.x, // Use direct x coordinate
                this.y, // Use direct y coordinate
                {
                    count: 8,
                    speed: 70, // Use a single number instead of min/max object
                    scale: 0.4, // Use a single number instead of start/end object
                }
            );
        }

        // Play destruction sound
        this.gameScene.sound.play("hit", { volume: 0.5 }); // Or a specific spike break sound

        // Use delayed call for proper cleanup after effects
        this.scene.time.delayedCall(50, () => {
            super.destroy();
        });
    }

    // Override destroy for safety, though not strictly needed now
    destroy(fromScene?: boolean): void {
        super.destroy(fromScene);
    }
}

