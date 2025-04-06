import Phaser from "phaser";
import { Enemy } from "../entities/Enemy";
import Game from "../scenes/Game"; // Import Game scene type

export class EnemyManager {
    private scene: Game; // Use Game type
    private enemiesGroup: Phaser.Physics.Arcade.Group;

    constructor(
        scene: Phaser.Scene,
        enemiesGroup: Phaser.Physics.Arcade.Group,
        bouldersGroup?: Phaser.Physics.Arcade.Group
    ) {
        this.scene = scene as Game; // Cast to Game
        this.enemiesGroup = enemiesGroup;

        // Note: Collision handling is now centralized in Game.ts setupCollisions()
        // This class now focuses on enemy spawning and management logic
    }

    // Method to spawn enemies at specific positions
    spawnEnemy(x: number, y: number): Enemy | undefined {
        const enemy = this.enemiesGroup.get(x, y) as Enemy;
        if (enemy) {
            enemy.resetEnemy();
            return enemy;
        }
        return undefined;
    }

    cleanup(): void {
        // Additional cleanup if needed
    }
}

