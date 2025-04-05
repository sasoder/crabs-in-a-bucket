import Phaser from "phaser";
import { TILE_SIZE } from "../constants";

export class ParticleManager {
    private scene: Phaser.Scene;
    private blockParticleEmitters: Map<
        string,
        Phaser.GameObjects.Particles.ParticleEmitter
    > = new Map();
    private TILE_SIZE = TILE_SIZE;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public initializeEmitters(textureKeys: string[]): void {
        console.log("Initializing particle emitters...");
        textureKeys.forEach((key) => this.createBlockParticleEmitter(key));
        console.log("Particle emitter initialization complete.");
    }

    private createBlockParticleEmitter(textureKey: string): void {
        if (!this.scene.textures.exists(textureKey)) {
            console.warn(
                `Texture key "${textureKey}" not found for particle emitter creation.`
            );
            return;
        }
        if (this.blockParticleEmitters.has(textureKey)) {
            console.warn(`Emitter already exists for: ${textureKey}`);
            return; // Don't recreate
        }

        const particles = this.scene.add.particles(0, 0, textureKey, {
            lifespan: { min: 200, max: 500 }, // Duration particles exist
            speed: { min: 30, max: 80 }, // How fast particles move
            scale: { start: 0.8, end: 0 }, // Shrink over time
            gravityY: 400, // Affected by gravity
            emitting: false, // Don't start emitting immediately
            blendMode: "NORMAL",
            rotate: { min: 0, max: 360 }, // Random rotation
            alpha: { start: 0.9, end: 0.2 }, // Fade out
            frame: 0, // Use the first frame if spritesheet
        });
        particles.setDepth(1); // Ensure particles are above tiles but maybe below player
        this.blockParticleEmitters.set(textureKey, particles);
        console.log(`Created particle emitter for: ${textureKey}`);
    }

    public triggerParticles(
        textureKey: string,
        worldX: number,
        worldY: number
    ): void {
        const emitter = this.blockParticleEmitters.get(textureKey);
        if (emitter) {
            // Position emitter at the center of the block
            emitter.setPosition(
                worldX + this.TILE_SIZE / 2,
                worldY + this.TILE_SIZE / 2
            );
            // Emit a burst of particles
            emitter.explode(Phaser.Math.Between(4, 8));
        } else {
            console.warn(
                `No particle emitter found for texture key: ${textureKey}`
            );
        }
    }

    public destroyEmitters(): void {
        console.log("Destroying particle emitters...");
        this.blockParticleEmitters.forEach((emitter) => {
            emitter.destroy();
        });
        this.blockParticleEmitters.clear();
        console.log("Particle emitters destroyed.");
    }
}

