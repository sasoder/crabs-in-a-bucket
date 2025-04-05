import Phaser from "phaser";
import { Enemy } from "../entities/Enemy";
import Game from "../scenes/Game"; // Import Game scene type

export class EnemyManager {
    private scene: Game; // Use Game type
    private enemiesGroup: Phaser.Physics.Arcade.Group;

    constructor(
        scene: Phaser.Scene,
        enemiesGroup: Phaser.Physics.Arcade.Group
    ) {
        this.scene = scene as Game; // Cast to Game
        this.enemiesGroup = enemiesGroup;

        // Setup collision between enemies
        this.scene.physics.add.collider(
            this.enemiesGroup,
            this.enemiesGroup,
            (obj1, obj2) => {
                if (obj1 instanceof Enemy && obj1.active) {
                    obj1.changeDirection();
                    obj1.body?.velocity.x &&
                        obj1.setVelocityX(obj1.body.velocity.x * 1.1);
                }
                if (obj2 instanceof Enemy && obj2.active) {
                    obj2.changeDirection();
                    obj2.body?.velocity.x &&
                        obj2.setVelocityX(obj2.body.velocity.x * 1.1);
                }
            }
        );
    }

    cleanup(): void {
        // EventBus.off("update-max-depth", this.adjustDifficulty, this);
    }
}

