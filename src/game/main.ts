import Phaser from "phaser";
import { Boot } from "./scenes/Boot";
import Preloader from "./scenes/Preloader";
import Game from "./scenes/Game";

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
                debug: false,
            },
        },
        render: {
            pixelArt: true,
            antialias: false,
        },
        scene: [Boot, Preloader, Game],
    };

    return new Phaser.Game(config);
}

export default launch;
export { launch };

