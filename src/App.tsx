import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IRefPhaserGame, PhaserGame } from "./game/PhaserGame";
import { EventBus } from "./game/EventBus";
import { ShopModal } from "./components/ShopModal";
import { StatsDisplay } from "./components/StatsDisplay";
import RelicDisplay from "./components/RelicsDisplay";
import ConsumablesDisplay from "./components/ConsumablesDisplay";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "./lib/utils";
import { GameOverModal } from "./components/GameOverModal";
import type { GameStats } from "./types/GameStats";
import type { GameOverData } from "./types/GameOverData";

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
    const [gameStats, setGameStats] = useState<GameStats | null>(null);
    const [isGameOver, setIsGameOver] = useState(false);
    const [gameOverData, setGameOverData] = useState<GameOverData | null>(null);

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

            // Listener for showing game over modal
            const handleShowGameOver = (data: GameOverData) => {
                console.log("App: Received show-game-over-modal event", data);
                setGameOverData(data);
                setIsGameOver(true);
                setIsShopOpen(false);
            };
            EventBus.on("show-game-over-modal", handleShowGameOver);

            // Cleanup listeners when component unmounts
            return () => {
                EventBus.off("update-stats", updateStats);
                EventBus.off("open-shop", openShop);
                EventBus.off("show-game-over-modal", handleShowGameOver);
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

    const closeGameOver = () => {
        setIsGameOver(false);
        setGameOverData(null);
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
                        <h1 className="text-8xl mb-4 text-white">Just Dig</h1>
                        <Button
                            variant="secondary"
                            onClick={startGame}
                            className={cn(
                                "text-xl border-2 border-t-orange-300 border-l-orange-300 border-b-orange-700 border-r-orange-700 bg-orange-500/80 hover:bg-orange-500 text-orange-950 disabled:opacity-60"
                            )}
                        >
                            Dig
                        </Button>
                        <p className="text-white/50 mt-8">
                            Controls: arrow keys move, space to dig/jump. A to
                            use items.
                        </p>
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
                <GameOverModal
                    isOpen={isGameOver}
                    onClose={closeGameOver}
                    data={gameOverData}
                />
            </div>
        </TooltipProvider>
    );
}

export default App;

