import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IRefPhaserGame, PhaserGame } from "./game/PhaserGame";
import { EventBus } from "./game/EventBus";

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

    useEffect(() => {
        // Only setup game listeners if game has started
        if (gameStarted) {
            const updateStats = (newStats: Partial<PlayerStats>) => {
                setStats((prev) => ({ ...prev, ...newStats }));
            };
            EventBus.on("ui-update-stats", updateStats);

            const openShop = () => {
                setIsShopOpen(true);
            };
            EventBus.on("open-shop", openShop);

            // Cleanup listeners when component unmounts or gameStarted becomes false
            return () => {
                EventBus.removeListener("ui-update-stats", updateStats);
                EventBus.removeListener("open-shop", openShop);
            };
        }
        // No cleanup needed if listeners weren't added
        return () => {};
    }, [gameStarted]);

    const startGame = () => {
        setGameStarted(true);
        // Ensure the event is emitted *after* the PhaserGame component is mounted
        // We might need a slight delay or ensure PhaserGame mounts immediately
        setTimeout(() => EventBus.emit("start-game"), 100); // Small delay might help, adjust if needed
    };

    const closeShop = () => {
        setIsShopOpen(false);
        EventBus.emit("close-shop");
    };

    // Event emitted from the PhaserGame component
    const currentScene = (scene: Phaser.Scene) => {
        // We could potentially use this later, but not needed for current logic
        // console.log("Current Phaser scene:", scene.scene.key);
    };

    return (
        <div className="app-container flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
            {!gameStarted ? (
                // Show Start Button if game hasn't started
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-8">Just Dig</h1>
                    <Button onClick={startGame} size="lg">
                        Start Game
                    </Button>
                </div>
            ) : (
                // Show Game and UI once started
                <>
                    <PhaserGame
                        ref={phaserRef}
                        currentActiveScene={currentScene}
                    />
                    <div className="ui-container absolute top-0 left-0 p-4 text-lg font-mono bg-black/50 rounded-br-lg">
                        <div className="player-stats">
                            <div>Lives: {stats.lives}</div>
                            <div>Coins: {stats.coins}</div>
                            <div>Depth: {stats.depth}</div>
                            {stats.relics.length > 0 && (
                                <div className="relics">
                                    <h4>Relics:</h4>
                                    <ul>
                                        {stats.relics.map((relic, i) => (
                                            <li key={i}>{relic}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {stats.consumables.length > 0 && (
                                <div className="consumables">
                                    <h4>Consumables:</h4>
                                    <ul>
                                        {stats.consumables.map((item, i) => (
                                            <li key={i}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {isShopOpen && (
                        <div className="shop-overlay fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                            <div className="shop-modal bg-card p-6 rounded-lg shadow-lg text-card-foreground w-1/2 max-w-md">
                                <h2 className="text-2xl font-bold mb-4">
                                    Shop Time!
                                </h2>
                                <p className="mb-2">
                                    You reached depth {stats.depth}!
                                </p>
                                <p className="mb-4">(Shop items go here)</p>
                                <Button onClick={closeShop}>
                                    Continue Digging
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default App;

