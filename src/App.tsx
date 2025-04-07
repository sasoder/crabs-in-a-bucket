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

// Define the game state type
type GameState = "not-started" | "crab-intro" | "lore" | "controls" | "playing";

// Add CSS for consistent button position
const buttonStyle = {
    position: "fixed",
    bottom: "calc(50vh - 150px)",
    left: "50%",
    transform: "translateX(-50%)",
} as const;

function App() {
    // References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    // Replace gameStarted with gameState for more detailed control
    const [gameState, setGameState] = useState<GameState>("not-started");
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
        // Only setup game listeners if game has started playing
        if (gameState === "playing") {
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
    }, [gameState]);

    const startGame = () => {
        // Update to set the crab intro state instead of starting game
        setGameState("crab-intro");
    };

    const startActualGame = () => {
        setGameState("playing");
        // Emit when actual gameplay starts
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

    // Render the appropriate content based on game state
    const renderContent = () => {
        switch (gameState) {
            case "not-started":
                return (
                    <div className="text-center flex flex-col items-center">
                        <div className="flex flex-row items-center">
                            <img
                                src="assets/entities/enemy.png"
                                alt="Crabs in a Bucket Logo"
                                className="w-16 mx-auto mb-4"
                                style={{
                                    imageRendering: "pixelated",
                                    filter: "drop-shadow(0 0 15px rgba(255, 255, 255, 0.2))",
                                }}
                            />
                        </div>
                        <h1
                            className="text-8xl mb-4 text-white"
                            style={{
                                textShadow:
                                    "0 0 50px rgba(254, 254, 254, 0.25)",
                            }}
                        >
                            Crabs in a Bucket
                        </h1>
                        <div className="mt-auto">
                            <Button
                                variant="secondary"
                                onClick={startGame}
                                className={cn(
                                    "cursor-pointer",
                                    "text-xl border-2 border-t-amber-300 border-l-amber-300 border-b-amber-700 border-r-amber-700 bg-amber-500/80 hover:bg-amber-500 text-amber-950 disabled:opacity-60"
                                )}
                                style={buttonStyle}
                            >
                                Begin
                            </Button>
                        </div>
                    </div>
                );

            case "crab-intro":
                return (
                    <div className="text-center flex flex-col items-center justify-center max-w-lg">
                        <div className="flex justify-center mb-6">
                            <img
                                src="assets/entities/enemy.png"
                                alt="Crab"
                                className="w-20 mx-auto"
                                style={{
                                    imageRendering: "pixelated",
                                    filter: "drop-shadow(0 0 15px rgba(255, 255, 255, 0.2))",
                                }}
                            />
                        </div>
                        <p
                            className="text-2xl text-white mb-8"
                            style={{
                                textShadow: "0 0 10px rgba(255, 255, 255, 0.3)",
                            }}
                        >
                            The crabs tell of treasures buried in the shifting
                            sands...
                        </p>
                        <div className="mt-auto">
                            <Button
                                variant="secondary"
                                onClick={() => setGameState("lore")}
                                className={cn(
                                    "cursor-pointer",
                                    "text-xl border-2 border-t-amber-300 border-l-amber-300 border-b-amber-700 border-r-amber-700 bg-amber-500/80 hover:bg-amber-500 text-amber-950 disabled:opacity-60"
                                )}
                                style={buttonStyle}
                            >
                                Tell me more...
                            </Button>
                        </div>
                    </div>
                );

            case "lore":
                return (
                    <div className="text-center flex flex-col items-center gap-8 justify-center max-w-lg">
                        <div className="flex flex-row items-center justify-center gap-4">
                            <img
                                src="assets/ui/heart.png"
                                alt="Heart Stone"
                                className="w-20 mx-auto"
                                style={{
                                    imageRendering: "pixelated",
                                    filter: "drop-shadow(0 0 15px rgba(255, 255, 255, 0.2))",
                                }}
                            />
                            <img
                                src="assets/relics/slayer.png"
                                alt="Slayer"
                                className="w-20 mx-auto"
                                style={{
                                    imageRendering: "pixelated",
                                    filter: "drop-shadow(0 0 15px rgba(255, 255, 255, 0.2))",
                                }}
                            />
                            <img
                                src="assets/relics/feather.png"
                                alt="Feather"
                                className="w-20 mx-auto"
                                style={{
                                    imageRendering: "pixelated",
                                    filter: "drop-shadow(0 0 15px rgba(255, 255, 255, 0.2))",
                                }}
                            />
                        </div>
                        <p
                            className="text-2xl text-white mb-8"
                            style={{
                                textShadow: "0 0 10px rgba(255, 255, 255, 0.3)",
                            }}
                        >
                            Ancient relics lie in the depths below. Only the
                            brave who dig deep enough can claim what time has
                            forgotten.
                        </p>
                        <div className="mt-auto">
                            <Button
                                variant="secondary"
                                onClick={() => setGameState("controls")}
                                className={cn(
                                    "cursor-pointer",
                                    "text-xl border-2 border-t-amber-300 border-l-amber-300 border-b-amber-700 border-r-amber-700 bg-amber-500/80 hover:bg-amber-500 text-amber-950 disabled:opacity-60"
                                )}
                                style={buttonStyle}
                            >
                                I'm brave!!!
                            </Button>
                        </div>
                    </div>
                );

            case "controls":
                return (
                    <div className="text-center flex flex-col items-center justify-center">
                        <h2
                            className="text-2xl text-white mb-8"
                            style={{
                                textShadow: "0 0 10px rgba(255, 255, 255, 0.3)",
                            }}
                        >
                            How to play
                        </h2>
                        <div className="flex flex-wrap justify-center gap-10 mb-10">
                            <div className="flex flex-col items-center">
                                <div className="flex gap-2">
                                    <img
                                        src="assets/ui/left.png"
                                        alt="Left"
                                        className="w-12 h-12"
                                        style={{
                                            imageRendering: "pixelated",
                                            filter: "drop-shadow(0 0 15px rgba(255, 255, 255, 0.2))",
                                        }}
                                    />
                                    <img
                                        src="assets/ui/up.png"
                                        alt="Up"
                                        className="w-12 h-12"
                                        style={{
                                            imageRendering: "pixelated",
                                            filter: "drop-shadow(0 0 15px rgba(255, 255, 255, 0.2))",
                                        }}
                                    />
                                    <img
                                        src="assets/ui/right.png"
                                        alt="Right"
                                        className="w-12 h-12"
                                        style={{
                                            imageRendering: "pixelated",
                                            filter: "drop-shadow(0 0 15px rgba(255, 255, 255, 0.2))",
                                        }}
                                    />
                                </div>
                                <p className="text-white mt-3 text-xl">
                                    Move and dig
                                </p>
                            </div>
                            <div className="flex flex-col items-center">
                                <img
                                    src="assets/ui/spacebar.png"
                                    alt="Spacebar"
                                    className="h-12"
                                    style={{
                                        imageRendering: "pixelated",
                                        filter: "drop-shadow(0 0 15px rgba(255, 255, 255, 0.2))",
                                    }}
                                />
                                <p className="text-white mt-3 text-xl">
                                    Use items
                                </p>
                            </div>
                        </div>
                        <div className="mt-auto">
                            <Button
                                variant="secondary"
                                onClick={startActualGame}
                                className={cn(
                                    "cursor-pointer",
                                    "text-xl border-2 border-t-amber-300 border-l-amber-300 border-b-amber-700 border-r-amber-700 bg-amber-500/80 hover:bg-amber-500 text-amber-950 disabled:opacity-60"
                                )}
                                style={buttonStyle}
                            >
                                I'm ready
                            </Button>
                        </div>
                    </div>
                );

            case "playing":
                return (
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
                );
        }
    };

    return (
        // Wrap the relevant parts (HUD, Shop) in TooltipProvider
        <TooltipProvider>
            <div
                id="app"
                className="h-screen w-screen bg-[#87ceeb]/20 flex justify-center items-center relative"
            >
                {renderContent()}
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

                {/* GitHub Link Footer */}
                <a
                    href="https://github.com/sasoder"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-4 text-white/70 hover:text-white text-sm transition-colors"
                >
                    @sasoder
                </a>

                <div className="absolute bottom-4 left-4 text-sm text-white/70 hover:text-white transition-colors">
                    Very much inspired by{" "}
                    <a
                        href="https://b-random9.itch.io/burrow"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        https://b-random9.itch.io/burrow
                    </a>
                </div>
            </div>
        </TooltipProvider>
    );
}

export default App;

