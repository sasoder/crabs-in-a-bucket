import Phaser from "phaser";
import { TILE_SIZE } from "../constants";

// Basic placeholder enemy
export class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        texture: string = "enemy"
    ) {
        // Assuming you have an 'enemy_placeholder' texture/sprite sheet loaded
        super(scene, x + TILE_SIZE / 2, y + TILE_SIZE / 2, texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true); // Keep them within bounds for now
        this.setGravityY(300); // They are affected by gravity
        // Basic horizontal movement example (replace with proper AI later)
        this.setVelocityX(Phaser.Math.Between(-30, 30) || 10);
        this.setBounceX(1); // Bounce off walls

        this.body?.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.8);
    }

    update(time: number, delta: number): void {
        // Basic patrol logic example
        if (this.body?.blocked.right) {
            this.setVelocityX(-30);
        } else if (this.body?.blocked.left) {
            this.setVelocityX(30);
        }
        // Prevent getting stuck switching directions instantly
        if (Math.abs(this.body?.velocity.x ?? 0) < 5) {
            this.setVelocityX(Phaser.Math.Between(-30, 30) || 10);
        }
    }
}

