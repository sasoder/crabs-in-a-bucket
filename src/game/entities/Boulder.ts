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
        this.body?.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.8); // Slightly smaller collider
    }

    // Boulders might have specific behaviors later
}

