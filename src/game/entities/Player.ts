// src/game/entities/Player.ts
import Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import { EventBus } from "../EventBus"; // Import EventBus

export class Player extends Phaser.Physics.Arcade.Sprite {
    private moveSpeed = 80; // Adjust as needed
    private jumpVelocity = -200; // Adjust as needed
    private bounceVelocity = -100; // Bounce after stomp
    private digCooldown = 150; // Milliseconds between digs
    private lastDigTime = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, "player"); // Assuming 'player' spritesheet is loaded
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(true); // Keep player within horizontal bounds
        this.setGravityY(300); // Adjust gravity
        this.body?.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.9); // Adjust collider size/offset
        this.body?.setOffset(TILE_SIZE * 0.1, TILE_SIZE * 0.05);

        // Add animations if using a spritesheet
        // this.anims.create({...});
        // this.anims.play('idle');
    }

    private canJumpOrDig(): boolean {
        return (
            ((this.body?.blocked.down || this.body?.touching.down) &&
                this.scene.time.now > this.lastDigTime + this.digCooldown) ||
            false
        );
    }

    private attemptJumpAndDig() {
        if (!this.canJumpOrDig()) {
            return;
        }

        this.lastDigTime = this.scene.time.now;

        // 1. Trigger Jump
        this.setVelocityY(this.jumpVelocity);
        // Play jump animation if available
        // this.anims.play('jump', true);

        // 2. Trigger Dig Event (coordinates directly below player center)
        const digWorldX = this.x;
        // Adjust Y slightly below the player's bottom edge
        const digWorldY = this.body!.bottom + TILE_SIZE / 2; // Use body bottom
        EventBus.emit("player-dig-attempt", {
            worldX: digWorldX,
            worldY: digWorldY,
        });
        console.log(`Dig attempt emitted at ${digWorldX}, ${digWorldY}`);
    }

    bounce() {
        this.setVelocityY(this.bounceVelocity);
    }

    // Basic movement update
    update(
        cursors: Phaser.Types.Input.Keyboard.CursorKeys,
        time: number,
        delta: number
    ) {
        if (cursors.left.isDown) {
            this.setVelocityX(-this.moveSpeed);
            this.setFlipX(true); // Flip sprite left
            // this.anims.play('run', true);
        } else if (cursors.right.isDown) {
            this.setVelocityX(this.moveSpeed);
            this.setFlipX(false); // Normal sprite direction
            // this.anims.play('run', true);
        } else {
            this.setVelocityX(0);
            // Play idle animation if on ground
            if (this.body?.blocked.down || this.body?.touching.down) {
                // this.anims.play('idle', true);
            }
        }

        // --- Jump / Dig ---
        if (cursors.up.isDown) {
            this.attemptJumpAndDig();
        }

        // Prevent sticking to walls when falling
        if (
            !this.body?.blocked.down &&
            !this.body?.touching.down &&
            this.body?.velocity.x !== 0
        ) {
            if (this.body?.blocked.left || this.body?.blocked.right) {
                this.setVelocityX(0);
            }
        }
    }
}

