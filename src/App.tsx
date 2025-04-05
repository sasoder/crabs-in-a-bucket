import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IRefPhaserGame, PhaserGame } from "./game/PhaserGame";
import { EventBus } from "./game/EventBus";
import { ShopModal } from "./components/ShopModal";
import { StatsDisplay } from "./components/StatsDisplay";
import { RelicsDisplay } from "./components/RelicsDisplay";
import { ConsumablesDisplay } from "./components/ConsumablesDisplay";

interface PlayerStats {
    lives: number;
    coins: number;
    depth: number;
    relics: string[];
    consumables: string[];
}

function App() {
    // References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [gameStarted, setGameStarted] = useState(false);
    const [stats, setStats] = useState<PlayerStats>({
        lives: 3,
        coins: 0,
        depth: 0,
        relics: [],
        consumables: [],
    });
    const [isShopOpen, setIsShopOpen] = useState(false);
    const [canMoveSprite, setCanMoveSprite] = useState(true);

    useEffect(() => {
        // Only setup game listeners if game has started
        if (gameStarted) {
            const updateStats = (newStats: Partial<PlayerStats>) => {
                setStats((prev) => ({ ...prev, ...newStats }));
            };
            EventBus.on("update-stats", updateStats);

            const openShop = () => {
                setIsShopOpen(true);
            };
            EventBus.on("open-shop", openShop);

            // Cleanup listeners when component unmounts or gameStarted becomes false
            return () => {
                EventBus.off("update-stats", updateStats);
                EventBus.off("open-shop", openShop);
            };
        } else {
            // Set gameStarted to true after the initial render
            setGameStarted(true);
        }
        // No cleanup needed if listeners weren't added
        return () => {};
    }, [gameStarted]);

    const startGame = () => {
        setGameStarted(true);
        setTimeout(() => EventBus.emit("start-game"), 100);
    };

    const closeShop = () => {
        setIsShopOpen(false);
        EventBus.emit("close-shop");
    };

    // Event emitted from the PhaserGame component
    const currentScene = (scene: Phaser.Scene) => {
        setCanMoveSprite(scene.scene.key === "MainMenu");
    };

    return (
        <div
            id="app"
            className="h-screen w-screen bg-gray-800 flex justify-center items-center"
        >
            {!gameStarted ? (
                // Show Start Button if game hasn't started
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-8 text-white">
                        Just Dig
                    </h1>
                    <Button onClick={startGame} size="lg">
                        Start Game
                    </Button>
                </div>
            ) : (
                // Add a relative container around the game and its UI
                <div className="relative">
                    <PhaserGame
                        ref={phaserRef}
                        currentActiveScene={currentScene}
                    />
                    {/* StatsDisplay is now positioned relative to this div */}
                    <StatsDisplay stats={stats} />

                    {/* RelicsDisplay: Top Center */}
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 p-4">
                        <RelicsDisplay relics={stats.relics} />
                    </div>

                    {/* ConsumablesDisplay: Top Right */}
                    <div className="absolute top-0 right-0 p-4">
                        <ConsumablesDisplay consumables={stats.consumables} />
                    </div>
                </div>
            )}
            <ShopModal isOpen={isShopOpen} onClose={closeShop} />
        </div>
    );
}

export default App;

