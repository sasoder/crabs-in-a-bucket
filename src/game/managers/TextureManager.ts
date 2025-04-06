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
        this.createCoinTexture();
        console.log("Dynamic texture generation complete.");

        // Debug: verify textures were created
        this.verifyTextures();
    }

    private verifyTextures(): void {
        const expectedTextures = [
            "dirt_tile",
            "stone_tile",
            "gold_tile",
            "coin",
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

    private createCoinTexture(): void {
        const textureKey = "coin";
        if (this.scene.textures.exists(textureKey)) return;

        const graphics = this.scene.make.graphics();
        // Gold color
        graphics.fillStyle(0xffcc00, 1); // Bright yellow gold
        graphics.fillCircle(
            this.TILE_SIZE / 2,
            this.TILE_SIZE / 2,
            this.TILE_SIZE * 0.4
        );
        // Darker outline
        graphics.lineStyle(1, 0xcca300, 1); // Darker gold outline
        graphics.strokeCircle(
            this.TILE_SIZE / 2,
            this.TILE_SIZE / 2,
            this.TILE_SIZE * 0.4
        );
        // Simple shine effect
        graphics.fillStyle(0xffff99, 0.7); // Lighter yellow, semi-transparent
        graphics.fillEllipse(
            this.TILE_SIZE * 0.4,
            this.TILE_SIZE * 0.4,
            this.TILE_SIZE * 0.15,
            this.TILE_SIZE * 0.25
        ); // Small highlight ellipse

        graphics.generateTexture(textureKey, this.TILE_SIZE, this.TILE_SIZE);
        graphics.destroy();
        console.log(`Generated texture: ${textureKey}`);
    }
}

