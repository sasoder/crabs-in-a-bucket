import Phaser from "phaser";

export default class Preloader extends Phaser.Scene {
    constructor() {
        super("Preloader");
    }

    preload() {
        // No assets to load for now
    }

    create() {
        // Start the main menu or game scene directly
        this.scene.start("MainMenu");
    }
}

