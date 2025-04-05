// src/game/entities/Boulder.ts
import Phaser from "phaser";
import { TILE_SIZE } from "../constants";

export class Coin extends Phaser.Physics.Arcade.Image {
    constructor(scene: Phaser.Scene, x: number, y: number) {
        // Texture key is 'coin', set in Game scene preload/createCoinTexture
        super(scene, x, y, "coin"); // Use x, y directly now, group handles placement

        // Explicitly enable physics for this object within the constructor
        scene.physics.world.enable(this);

        // Now set physics properties
        this.setCollideWorldBounds(false); // Let them fall off-screen
        this.setBounce(1); // Less bounce than originally planned
        this.setDragX(80); // Apply drag/friction
        this.setGravityY(250); // Match group setting or adjust if needed
        this.setCircle(TILE_SIZE * 0.4); // Use circular body matching the texture
        // this.body?.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.8); // Use setCircle instead
        this.setImmovable(false); // Coins should be movable
    }

    // Group's `get` method handles reuse, but you could add custom activate/deactivate if needed
    // activate() {
    //     this.setActive(true);
    //     this.setVisible(true);
    //     this.body.enable = true;
    //     // Reset any specific coin state if necessary
    // }

    // deactivate() {
    //     // Called by killAndHide
    //     this.setActive(false);
    //     this.setVisible(false);
    //     this.body.enable = false;
    // }
}

