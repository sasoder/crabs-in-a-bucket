import Phaser from "phaser";
import { Boot } from "./scenes/Boot";
import Preloader from "./scenes/Preloader";
import { MainMenu } from "./scenes/MainMenu";
import Game from "./scenes/Game";
import { GameOver } from "./scenes/GameOver";

function launch(containerId: string): Phaser.Game {
    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 800,
        height: 600,
        parent: containerId,
        physics: {
            default: "arcade",
            arcade: {
                gravity: { x: 0, y: 400 },
                debug: true,
            },
        },
        render: {
            pixelArt: true,
            antialias: false,
        },
        scene: [Boot, Preloader, MainMenu, Game, GameOver],
    };

    return new Phaser.Game(config);
}

export default launch;
export { launch };

