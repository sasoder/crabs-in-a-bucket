import Phaser from "phaser";
import { TILE_SIZE } from "../constants";

// Define a particle options interface
interface ParticleOptions {
    count?: number; // How many particles to emit
    speed?: number; // Speed modifier
    scale?: number; // Scale modifier
    lifespan?: number; // Lifespan modifier
}

export class ParticleManager {
    private scene: Phaser.Scene;
    private TILE_SIZE = TILE_SIZE;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public initializeEmitters(textureKeys: string[]): void {
        // Create a simple square particle texture if it doesn't exist
        if (!this.scene.textures.exists("particle")) {
            const graphics = this.scene.make.graphics({ x: 0, y: 0 });
            graphics.fillStyle(0xffffff);
            graphics.fillRect(0, 0, 8, 8);
            graphics.generateTexture("particle", 8, 8);
            graphics.destroy();
        }

        // Log the available textures for debugging
        const availableTextures: string[] = [];
        this.scene.textures.each((texture: Phaser.Textures.Texture) => {
            availableTextures.push(texture.key);
        }, this);
    }

    public triggerParticles(
        textureKey: string,
        worldX: number,
        worldY: number,
        options?: ParticleOptions
    ): void {
        // Center position
        const centerX = worldX + this.TILE_SIZE / 2;
        const centerY = worldY + this.TILE_SIZE / 2;

        // Number of particles to create
        const count = options?.count || 8;

        // Create individual particle sprites using the actual block texture
        for (let i = 0; i < count; i++) {
            // Create a particle
            const particle = this.scene.add.sprite(
                centerX,
                centerY,
                textureKey
            );

            // Set particle properties
            particle.setAlpha(0.9);
            particle.setDepth(1000); // Very high depth

            // Small scale for particles (between 0.1 and 0.3 of original size)
            const baseScale = options?.scale || 0.2;
            particle.setScale(baseScale + Math.random() * 0.1);

            // Random velocity
            const angle = Math.random() * Math.PI * 2;
            const baseSpeed = options?.speed || 20;
            const speed = baseSpeed / 2 + Math.random() * baseSpeed;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            // Add slight rotation
            const rotation = Math.random() * 0.1 - 0.05;

            // Animate with tweens
            this.scene.tweens.add({
                targets: particle,
                x: particle.x + vx,
                y: particle.y + vy,
                alpha: 0,
                scale: particle.scale * 0.5,
                rotation: particle.rotation + rotation,
                duration: (options?.lifespan || 500) + Math.random() * 300,
                ease: "Power2",
                onComplete: () => {
                    particle.destroy();
                },
            });
        }
    }
}

