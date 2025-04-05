// src/game/entities/Boulder.ts
import Phaser from "phaser";
import { TILE_SIZE } from "../constants";

export class Boulder extends Phaser.Physics.Arcade.Image {
    constructor(scene: Phaser.Scene, x: number, y: number) {
        // Assuming you have a 'boulder' texture loaded
        super(scene, x + TILE_SIZE / 2, y + TILE_SIZE / 2, "boulder"); // Center in tile
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(false); // Let them fall off-screen
        this.setBounce(0.1);
        this.setGravityY(300); // Adjust gravity as needed
        this.setImmovable(false); // They should be pushable/affected by physics

        // Make the boulder circular
        const radius = TILE_SIZE * 0.4; // Adjust radius as needed
        this.body?.setCircle(
            radius,
            (this.width - radius * 2) / 2, // Center the circle body
            (this.height - radius * 2) / 2
        );
    }

    // Boulders might have specific behaviors later
}

