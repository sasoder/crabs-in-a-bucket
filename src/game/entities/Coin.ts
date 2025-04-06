// src/game/entities/Boulder.ts
import Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import { EventBus } from "../EventBus";
import Game from "../scenes/Game";

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

    static spawn(
        scene: Phaser.Scene,
        coinsGroup: Phaser.Physics.Arcade.Group,
        worldX: number,
        worldY: number,
        count: number = 1
    ) {
        const spawnCenterX = worldX + TILE_SIZE / 2;
        const spawnCenterY = worldY + TILE_SIZE / 2;

        for (let i = 0; i < count; i++) {
            const offsetX =
                count > 1
                    ? Phaser.Math.Between(-TILE_SIZE * 0.2, TILE_SIZE * 0.2)
                    : 0;
            const offsetY =
                count > 1
                    ? Phaser.Math.Between(-TILE_SIZE * 0.2, TILE_SIZE * 0.2)
                    : 0;

            const coin = coinsGroup.get(
                spawnCenterX + offsetX,
                spawnCenterY + offsetY,
                "coin"
            ) as Coin | null;

            if (coin) {
                coin.setActive(true);
                coin.setVisible(true);
                coin.setScale(0.8);

                // Add glow effect
                if (coin.postFX) {
                    coin.postFX.addGlow(0xffff07, 0.5, 0, false, 0.1, 10);
                }

                const body = coin.body as Phaser.Physics.Arcade.Body | null;
                if (body) {
                    body.enable = true;
                    body.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.8);
                    const boostX = Phaser.Math.Between(-100, 100);
                    const boostY = Phaser.Math.Between(-100, -40);
                    body.setVelocity(boostX, boostY);
                    body.setCollideWorldBounds(false);
                    body.allowGravity = true;
                    body.setBounce(0.3, 0.3);
                    body.setDragX(80);
                } else {
                    console.warn(
                        "Failed to get physics body for spawned coin."
                    );
                }
            } else {
                console.warn("Failed to get coin from group.");
            }
        }
    }

    static handlePlayerCoinCollect(
        scene: Phaser.Scene,
        coinsGroup: Phaser.Physics.Arcade.Group,
        player: Phaser.GameObjects.GameObject,
        coin: Phaser.GameObjects.GameObject
    ) {
        if (!(coin instanceof Coin) || !coin.active || !player.active) {
            return;
        }

        let coinValue = 1;
        const currentRelics = scene.registry.get("relics") as string[];
        if (currentRelics.includes("prospectors-pendant")) {
            coinValue = Math.ceil(coinValue * 1.25);
        }

        const currentCoins = scene.registry.get("coins") as number;
        scene.registry.set("coins", currentCoins + coinValue);

        // Update total coins collected in the game scene
        let totalCoinsCollected =
            (scene.registry.get("totalCoinsCollected") as number) || 0;
        totalCoinsCollected += coinValue;
        scene.registry.set("totalCoinsCollected", totalCoinsCollected);

        EventBus.emit("stats-changed");

        // Trigger coin collection particles
        const gameScene = scene as Game;
        if (gameScene.particleManager) {
            gameScene.particleManager.triggerParticles("coin", coin.x, coin.y, {
                count: 10,
                speed: 50,
                lifespan: 400,
                scale: 0.4,
            });
        }

        coinsGroup.killAndHide(coin);
        if (coin.body) {
            (coin.body as Phaser.Physics.Arcade.Body).enable = false;
        }

        // Play coin sound directly without checking
        scene.sound.play("collectcoin", { volume: 0.4 });
    }
}

