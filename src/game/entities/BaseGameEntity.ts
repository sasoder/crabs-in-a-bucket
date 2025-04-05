import Phaser from "phaser";
import Game from "../scenes/Game"; // Import the specific Game scene type
// import { BlockType } from "../constants"; // Not needed for ground check anymore
import { TILE_SIZE } from "../constants";

export abstract class BaseGameEntity extends Phaser.Physics.Arcade.Sprite {
    protected gameScene: Game; // Store reference to the Game scene

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        texture: string | Phaser.Textures.Texture,
        frame?: string | number
    ) {
        super(scene, x, y, texture, frame);
        this.gameScene = scene as Game; // Cast scene to Game type

        // Common setup for entities derived from this base
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);
        this.setCollideWorldBounds(true);
        this.setGravityY(300); // Default gravity

        // Add collision with the row colliders (much simpler!)
        if (this.gameScene.terrainManager) {
            this.scene.physics.add.collider(
                this,
                this.gameScene.terrainManager.getRowColliderGroup()
            );
        }
    }

    // Standard Phaser update loop - now much simpler
    preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta); // Call sprite's preUpdate

        if (!this.active || !this.body) {
            return;
        }

        // Call the entity-specific update logic defined in subclasses
        // Pass the onGround status using Phaser's built-in detection
        this.entitySpecificUpdate(time, delta, this.body.blocked.down);
    }

    /**
     * Abstract method to be implemented by subclasses for their unique update logic.
     * This is called automatically within the base class's preUpdate.
     * @param onGround - Indicates if the entity is currently on the ground.
     */
    protected abstract entitySpecificUpdate(
        time: number,
        delta: number,
        onGround: boolean
    ): void;

    // Optional: Common destroy logic if needed
    // destroy(fromScene?: boolean): void {
    //     // Cleanup specific to base entity
    //     super.destroy(fromScene);
    // }
}

