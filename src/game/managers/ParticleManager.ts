import Phaser from "phaser";

// Define a particle options interface
export interface ParticleOptions {
    count?: number; // How many particles to emit
    speed?: number; // Speed range or single value
    scale?: { start: number; end: number } | number; // Scale range or single value
    lifespan?: number; // Lifespan modifier
    gravityY?: number; // Optional gravity override
    alpha?: { start: number; end: number } | number; // Alpha range or single value
    angle?: { min: number; max: number } | number; // Angle range or single value
    blendMode?: string; // Direct string as used in examples ("ADD", "NORMAL", etc.)
}

export class ParticleManager {
    private scene: Phaser.Scene;
    private emitters: Map<
        string,
        Phaser.GameObjects.Particles.ParticleEmitter
    > = new Map();

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        console.log("ParticleManager created in scene:", scene.scene.key);
    }

    public initializeEmitters(textureKeys: string[]): void {
        // Log how many emitters we're initializing
        console.log(
            `Initializing ${textureKeys.length} particle emitters:`,
            textureKeys
        );

        textureKeys.forEach((key) => {
            if (!this.scene.textures.exists(key)) {
                console.warn(
                    `ParticleManager: Texture key "${key}" not found.`
                );
                return;
            }

            console.log(`Creating emitter for: ${key}`);

            // Use a simpler, consistent config with higher maxParticles
            const emitter = this.scene.add.particles(0, 0, key, {
                speed: { min: 40, max: 80 }, // Add some speed variation
                scale: { start: 0.6, end: 0.1 },
                alpha: { start: 1, end: 0.3 },
                lifespan: { min: 600, max: 1000 }, // Add lifespan variation
                blendMode: Phaser.BlendModes.NORMAL,
                gravityY: 250, // Consistent gravity
                maxParticles: 300, // INCREASED: Allow more particles for row clearing bursts
                quantity: 5, // Default quantity per trigger (can be overridden)
                frequency: -1, // Explode only when told
            });

            emitter.setDepth(1000);
            this.emitters.set(key, emitter);

            console.log(`Emitter created for "${key}" and added to map.`);

            // Simplified debug check
            if (this.scene.textures.exists(key)) {
                console.log(`Texture "${key}" exists.`);
            }
        });
    }

    public triggerParticles(
        textureKey: string,
        worldX: number,
        worldY: number,
        options?: ParticleOptions
    ): void {
        console.log(
            `Trying to trigger particles for "${textureKey}" at (${worldX}, ${worldY})`
        );

        // Debug available emitters
        console.log("Available emitters:", Array.from(this.emitters.keys()));

        const emitter = this.emitters.get(textureKey);
        if (!emitter) {
            console.warn(
                `ParticleManager: Emitter for key "${textureKey}" not found.`
            );
            return;
        }

        // Apply options if provided
        if (options) {
            if (options.speed !== undefined) emitter.speed = options.speed;
            if (options.lifespan !== undefined)
                emitter.lifespan = options.lifespan;
            if (options.gravityY !== undefined)
                emitter.gravityY = options.gravityY;
            if (options.scale !== undefined) {
                // Handle both number and object scale types
                if (typeof options.scale === "number") {
                    emitter.scaleX = emitter.scaleY = options.scale;
                } else {
                    // Set scale as object with start/end
                    emitter.scale = options.scale as any;
                }
            }
            if (options.blendMode !== undefined)
                emitter.blendMode = options.blendMode;
        }

        // Move the emitter to the target position
        emitter.setPosition(worldX, worldY);

        // Use explode for a burst of particles
        const count = options?.count || 8;
        console.log(`Exploding ${count} particles`);

        // Explicitly call explode with just count
        emitter.explode(count);
    }

    public destroy(): void {
        console.log("Destroying all particle emitters");
        this.emitters.forEach((emitter) => {
            emitter.destroy();
        });
        this.emitters.clear();
    }
}

