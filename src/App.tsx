import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IRefPhaserGame, PhaserGame } from "./game/PhaserGame";
import { EventBus } from "./game/EventBus";
import { ShopModal } from "./components/ShopModal";
import { StatsDisplay } from "./components/StatsDisplay";
import RelicDisplay from "./components/RelicsDisplay";
import ConsumablesDisplay from "./components/ConsumablesDisplay";
import { TooltipProvider } from "@/components/ui/tooltip";

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

            // Cleanup listeners when component unmounts
            return () => {
                EventBus.off("update-stats", updateStats);
                EventBus.off("open-shop", openShop);
            };
        }
        // No effect or cleanup needed if game hasn't started
    }, [gameStarted]);

    const startGame = () => {
        setGameStarted(true);
        // Emit immediately when game is started via button click
        EventBus.emit("start-game");
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
        // Wrap the relevant parts (HUD, Shop) in TooltipProvider
        <TooltipProvider>
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
                            <RelicDisplay relicIds={stats.relics} />
                        </div>

                        {/* ConsumablesDisplay: Top Right */}
                        <div className="absolute top-0 right-0 p-4">
                            <ConsumablesDisplay
                                consumableIds={stats.consumables}
                            />
                        </div>
                    </div>
                )}
                <ShopModal
                    isOpen={isShopOpen}
                    onClose={closeShop}
                    playerCoins={stats.coins}
                />
            </div>
        </TooltipProvider>
    );
}

export default App;

