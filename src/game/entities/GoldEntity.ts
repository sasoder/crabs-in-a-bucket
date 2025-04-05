import Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import { EventBus } from "../EventBus";

// Placeholder Gold Entity - Acts like a physics object that gives coins on touch
export class GoldEntity extends Phaser.Physics.Arcade.Sprite {
    private value: number = 10; // How many coins this is worth

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        texture: string = "gold_entity" // Placeholder texture key
    ) {
        super(scene, x, y, texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(false); // Allow falling off screen
        this.setBounce(0.3);
        this.setGravityY(250); // Similar gravity to coins
        this.setDragX(80);
        this.body?.setSize(TILE_SIZE * 0.7, TILE_SIZE * 0.7); // Smaller collider

        // Consider making it circular if the sprite is round
        // this.body?.setCircle(TILE_SIZE * 0.35);
    }

    // Called when collected by the player
    collect(): void {
        // Award coins
        const currentCoins = this.scene.registry.get("coins") as number;
        this.scene.registry.set("coins", currentCoins + this.value);

        // Update total coins collected
        let totalCoinsCollected =
            (this.scene.registry.get("totalCoinsCollected") as number) || 0;
        totalCoinsCollected += this.value;
        this.scene.registry.set("totalCoinsCollected", totalCoinsCollected);

        EventBus.emit("stats-changed");

        // Play a sound? Particle effect?
        // this.scene.sound.play('coin_pickup_sound');

        this.destroy(); // Remove the gold entity from the game
    }

    // Add any other specific GoldEntity behavior here
}

