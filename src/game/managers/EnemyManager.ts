import Phaser from "phaser";
import { Enemy } from "../entities/Enemy";
import { TILE_SIZE } from "../constants";
import { EventBus } from "../EventBus";

export class EnemyManager {
    private scene: Phaser.Scene;
    private enemiesGroup: Phaser.Physics.Arcade.Group;
    private spawnTimer?: Phaser.Time.TimerEvent;
    private spawnRate = 3000; // Initial spawn rate (3 seconds)
    private maxEnemies = 15; // Initial max enemies
    private enemySpeed = 30; // Base enemy speed

    constructor(
        scene: Phaser.Scene,
        enemiesGroup: Phaser.Physics.Arcade.Group
    ) {
        this.scene = scene;
        this.enemiesGroup = enemiesGroup;

        // Enable collisions between enemies in the group
        this.scene.physics.add.collider(
            this.enemiesGroup,
            this.enemiesGroup,
            (obj1, obj2) => {
                // Simple callback that forces enemies to have slight bounce
                // and change direction on collision
                if (obj1 instanceof Enemy) obj1.changeDirection();
                if (obj2 instanceof Enemy) obj2.changeDirection();
            }
        );

        this.startSpawning();

        // Listen for depth changes to adjust difficulty
        EventBus.on("update-max-depth", this.adjustDifficulty, this);
    }

    startSpawning(): void {
        if (this.spawnTimer) {
            this.spawnTimer.remove();
        }

        this.spawnTimer = this.scene.time.addEvent({
            delay: this.spawnRate,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true,
        });
    }

    stopSpawning(): void {
        if (this.spawnTimer) {
            this.spawnTimer.remove();
            this.spawnTimer = undefined;
        }
    }

    spawnEnemy(): void {
        // Don't spawn if we're at max capacity
        if (this.enemiesGroup.countActive() >= this.maxEnemies) {
            return;
        }

        const player = this.scene.children.getByName(
            "player"
        ) as Phaser.Physics.Arcade.Sprite;
        if (!player || !player.active) return;

        // Get the terrain manager
        const terrainManager = (this.scene as any).terrainManager;
        if (!terrainManager) return;

        // Get spawn position
        const initialSpawnPoint = terrainManager.getInitialSpawnPoint();
        const spawnY = initialSpawnPoint.y - TILE_SIZE;

        // Get map width
        const map = terrainManager.getMap();
        const mapWidth = map.widthInPixels;

        // Randomly choose left or right side to spawn
        const spawnFromLeft = Phaser.Math.Between(0, 1) === 0;
        const spawnX = spawnFromLeft ? TILE_SIZE / 2 : mapWidth - TILE_SIZE / 2;
        const initialDirection = spawnFromLeft ? 1 : -1;

        // Create the enemy
        this.createEnemy(spawnX, spawnY, initialDirection);
    }

    createEnemy(
        x: number,
        y: number,
        direction: number = 1
    ): Enemy | undefined {
        // Try to get an inactive enemy first
        let enemy = this.enemiesGroup.getFirstDead(true) as Enemy;

        if (!enemy) {
            // Create new enemy if none available
            enemy = new Enemy(this.scene, x, y);
            this.enemiesGroup.add(enemy);
        } else {
            // Reset existing enemy
            enemy.setPosition(x, y);
            enemy.setActive(true);
            enemy.setVisible(true);
            if (enemy.body) {
                enemy.body.enable = true;
            }
            enemy.resetEnemy();
        }

        // Set direction and speed
        enemy.setDirection(direction);
        enemy.setSpeed(this.enemySpeed);

        return enemy;
    }

    adjustDifficulty(depth: number): void {
        // Calculate new difficulty values based on depth
        const depthFactor = Math.floor(depth / 10);

        // Increase speed as player goes deeper
        this.enemySpeed = Math.min(200, 80 + depthFactor * 10);

        // Increase max enemies (cap at 25)
        this.maxEnemies = Math.min(25, 15 + Math.floor(depth / 30));

        // Decrease spawn rate (minimum 1 second)
        this.spawnRate = Math.max(1000, 3000 - depthFactor * 200);

        // Restart timer with new spawn rate
        this.restartTimer();

        // Update speeds of all active enemies
        this.updateAllEnemies();
    }

    updateAllEnemies(): void {
        // Update all active enemies with new speed
        this.enemiesGroup.getChildren().forEach((enemy) => {
            if (enemy.active) {
                (enemy as Enemy).setSpeed(this.enemySpeed);
            }
        });
    }

    restartTimer(): void {
        this.stopSpawning();
        this.startSpawning();
    }

    cleanup(): void {
        this.stopSpawning();
        EventBus.off("update-max-depth", this.adjustDifficulty, this);
    }
}

