import Phaser from "phaser";

export default class Preloader extends Phaser.Scene {
    constructor() {
        super("Preloader");
    }

    preload() {
        // Display a loading bar
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(
            this.cameras.main.width / 2 - 160,
            this.cameras.main.height / 2 - 25,
            320,
            50
        );

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const loadingText = this.make.text({
            x: width / 2,
            y: height / 2 - 50,
            text: "Loading...",
            style: {
                font: "20px monospace",
                color: "#ffffff", // Changed fill to color
            },
        });
        loadingText.setOrigin(0.5, 0.5);

        const percentText = this.make.text({
            x: width / 2,
            y: height / 2,
            text: "0%",
            style: {
                font: "18px monospace",
                color: "#ffffff", // Changed fill to color
            },
        });
        percentText.setOrigin(0.5, 0.5);

        this.load.on("progress", (value: number) => {
            percentText.setText(parseInt(String(value * 100)) + "%"); // Fixed calculation
            progressBar.clear();
            progressBar.fillStyle(0xffffff, 1);
            progressBar.fillRect(
                width / 2 - 150,
                height / 2 - 15,
                300 * value,
                30
            );
        });

        this.load.on("complete", () => {
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();
            percentText.destroy();
            this.scene.start("Game"); // Start Game scene after loading
        });

        // --- Load your actual game assets here ---
        // Examples (replace with your actual paths and keys):
        this.load.image("dirt_tile", "assets/tiles/dirt.png");
        this.load.image("stone_tile", "assets/tiles/stone.png");
        this.load.image("gold_tile", "assets/tiles/gold.png");
        this.load.image("coin", "assets/ui/coin.png");
        this.load.image("heart", "assets/ui/heart.png");
        this.load.image("feather", "assets/relics/feather.png");
        this.load.image("lightning", "assets/relics/lightning.png");
        this.load.image("slayer", "assets/relics/slayer.png");
        this.load.image("spikes", "assets/entities/spikes.png");
        this.load.image("geode", "assets/consumables/geode.png");
        this.load.spritesheet("player", "assets/entities/player.png", {
            frameWidth: 32, // Adjust frame size
            frameHeight: 32,
        });
        this.load.spritesheet("enemy", "assets/entities/enemy.png", {
            frameWidth: 32, // Adjust frame size
            frameHeight: 32,
        });
        // Add boulder image
        this.load.image("boulder", "assets/entities/boulder.png");
        // this.load.audio('jumpSound', 'assets/audio/jump.wav');
        // this.load.audio('coinSound', 'assets/audio/coin.wav');
        // ... load all other assets needed by the Game scene ...

        // // Load relic images (if not already handled by React/CSS)
        // this.load.image(
        //     "relic_steel_toed_boots",
        //     "assets/relics/steel_toed_boots.png"
        // );
        // this.load.image(
        //     "relic_impact_tremor",
        //     "assets/relics/impact_tremor.png"
        // );
        // ... add all other relic images ...

        // Load consumable images
        this.load.image("tnt", "assets/consumables/tnt.png");

        // Load sound effects
        this.load.audio("hit", "assets/audio/hit.wav");
        this.load.audio("collectcoin", "assets/audio/collectcoin.wav");
        this.load.audio("jump", "assets/audio/jump.wav");
        this.load.audio("tick", "assets/audio/tick.wav");
        this.load.audio("explosion", "assets/audio/explosion.wav");
        // ... add all other consumable images ...
    }

    create() {
        // Assets are loaded, 'complete' event listener handles starting the next scene.
        // You might emit scene-ready here if needed for other logic, but
        // for simply starting the next scene, the 'complete' listener is sufficient.
        // EventBus.emit('current-scene-ready', this);
    }
}

