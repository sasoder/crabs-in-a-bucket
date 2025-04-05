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
        this.setFriction(0.8, 0); // Add friction for realistic rolling

        // Enable angular velocity for rotation
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.allowRotation = true;
            body.setAngularDrag(10);
        }

        // Make the boulder circular
        const radius = TILE_SIZE * 0.4;
        this.body?.setCircle(
            radius,
            (this.width - radius * 2) / 2, // Center the circle body
            (this.height - radius * 2) / 2
        );
    }

    update() {
        // Update rotation based on horizontal velocity
        if (this.body && Math.abs(this.body.velocity.x) > 10) {
            // Calculate rotation based on velocity direction
            const rotationSpeed = -this.body.velocity.x * 0.01;
            this.rotation += rotationSpeed;
        }
    }

    // Boulders might have specific behaviors later
}

