interface PlayerStats {
    lives: number;
    coins: number;
    depth: number;
}

interface StatsDisplayProps {
    stats: PlayerStats;
}

export function StatsDisplay({ stats }: StatsDisplayProps) {
    return (
        <div className="ui-container absolute top-0 left-0 p-4 text-lg bg-transparent text-white">
            <div className="flex flex-col space-y-1">
                <div className="font-bold flex items-center">
                    <img
                        src="/assets/sprites/heart.png"
                        alt="heart"
                        style={{
                            imageRendering: "pixelated",
                            filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.5))",
                        }}
                        className="w-6 h-6 mr-2"
                    />
                    <span style={{ textShadow: "0px 2px 3px rgba(0,0,0,0.5)" }}>
                        {stats.lives}
                    </span>
                </div>
                <div className="font-bold flex items-center">
                    <img
                        src="/assets/sprites/coin.png"
                        alt="coin"
                        style={{
                            imageRendering: "pixelated",
                            filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.5))",
                        }}
                        className="w-6 h-6 mr-2"
                    />
                    <span style={{ textShadow: "0px 2px 3px rgba(0,0,0,0.5)" }}>
                        {stats.coins}
                    </span>
                </div>
                <div className="font-bold">
                    <span style={{ textShadow: "0px 2px 3px rgba(0,0,0,0.5)" }}>
                        Depth: {stats.depth}
                    </span>
                </div>
            </div>
        </div>
    );
}

