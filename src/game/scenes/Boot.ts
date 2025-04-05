import { Scene } from "phaser";

export class Boot extends Scene {
    constructor() {
        super("Boot");
    }

    preload() {
        // No assets needed for the simplified Preloader
    }

    create() {
        this.scene.start("Preloader");
    }
}

