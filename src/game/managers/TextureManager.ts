import Phaser from "phaser";
import { BlockType, TILE_SIZE } from "../constants";

export class TextureManager {
    private scene: Phaser.Scene;
    private TILE_SIZE = TILE_SIZE; // Use constant

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public generateAllTextures(): void {
        console.log("Generating all dynamic textures...");
        this.createTileTexture(BlockType.DIRT, 0xa07042);
        this.createSpikeTexture();
        console.log("Dynamic texture generation complete.");

        // Debug: verify textures were created
        this.verifyTextures();
    }

    private verifyTextures(): void {
        const expectedTextures = [
            "dirt_tile",
            "stone_tile",
            "gold_tile",
            "spikes",
        ];
        console.log("Verifying generated textures...");

        for (const textureKey of expectedTextures) {
            if (this.scene.textures.exists(textureKey)) {
                const frame = this.scene.textures.getFrame(textureKey);
                console.log(
                    `✓ Texture '${textureKey}' exists with dimensions ${frame.width}x${frame.height}`
                );
            } else {
                console.error(
                    `✗ Texture '${textureKey}' was NOT created successfully`
                );
            }
        }
    }

    private createTileTexture(type: BlockType, color: number): void {
        let textureKey = "";
        switch (type) {
            case BlockType.DIRT:
                textureKey = "dirt_tile";
                break;
            default:
                console.warn(
                    `Cannot generate texture for unknown BlockType: ${type}`
                );
                return;
        }

        if (this.scene.textures.exists(textureKey)) return;

        const graphics = this.scene.make.graphics();
        graphics.fillStyle(color, 1);
        graphics.fillRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);
        graphics.lineStyle(1, 0x000000, 0.5); // Subtle border
        graphics.strokeRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);

        // Add some subtle noise/texture
        graphics.fillStyle(color - 0x101010, 0.3); // Slightly darker, semi-transparent
        for (let i = 0; i < 5; i++) {
            graphics.fillRect(
                Math.random() * this.TILE_SIZE,
                Math.random() * this.TILE_SIZE,
                2, // Small dots
                2
            );
        }

        graphics.generateTexture(textureKey, this.TILE_SIZE, this.TILE_SIZE);
        graphics.destroy();
        console.log(`Generated texture: ${textureKey}`);
    }

    /**
     * Creates a spikes texture
     */
    private createSpikeTexture(): void {
        const textureKey = "spikes";

        if (this.scene.textures.exists(textureKey)) return;

        const graphics = this.scene.make.graphics();

        // Base (similar to dirt)
        graphics.fillStyle(0xa07042, 1); // Same color as dirt
        graphics.fillRect(0, 0, this.TILE_SIZE, this.TILE_SIZE);

        // Add spikes on top
        graphics.fillStyle(0x333333, 1); // Dark gray for spikes

        // Draw 4 triangular spikes
        const spikeHeight = this.TILE_SIZE * 0.4;
        const spikeWidth = this.TILE_SIZE * 0.2;

        // Center spike
        graphics.beginPath();
        graphics.moveTo(this.TILE_SIZE / 2, this.TILE_SIZE / 2 - spikeHeight);
        graphics.lineTo(
            this.TILE_SIZE / 2 - spikeWidth / 2,
            this.TILE_SIZE / 2
        );
        graphics.lineTo(
            this.TILE_SIZE / 2 + spikeWidth / 2,
            this.TILE_SIZE / 2
        );
        graphics.closePath();
        graphics.fillPath();

        // Left spike
        graphics.beginPath();
        graphics.moveTo(this.TILE_SIZE / 4, this.TILE_SIZE / 2 - spikeHeight);
        graphics.lineTo(
            this.TILE_SIZE / 4 - spikeWidth / 2,
            this.TILE_SIZE / 2
        );
        graphics.lineTo(
            this.TILE_SIZE / 4 + spikeWidth / 2,
            this.TILE_SIZE / 2
        );
        graphics.closePath();
        graphics.fillPath();

        // Right spike
        graphics.beginPath();
        graphics.moveTo(
            (this.TILE_SIZE * 3) / 4,
            this.TILE_SIZE / 2 - spikeHeight
        );
        graphics.lineTo(
            (this.TILE_SIZE * 3) / 4 - spikeWidth / 2,
            this.TILE_SIZE / 2
        );
        graphics.lineTo(
            (this.TILE_SIZE * 3) / 4 + spikeWidth / 2,
            this.TILE_SIZE / 2
        );
        graphics.closePath();
        graphics.fillPath();

        graphics.generateTexture(textureKey, this.TILE_SIZE, this.TILE_SIZE);
        graphics.destroy();
        console.log(`Generated texture: ${textureKey}`);
    }
}

