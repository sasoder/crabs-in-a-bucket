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
                        style={{ imageRendering: "pixelated" }}
                        className="w-6 h-6 mr-2"
                    />
                    {stats.lives}
                </div>
                <div className="font-bold flex items-center">
                    <img
                        src="/assets/sprites/coin.png"
                        alt="coin"
                        style={{ imageRendering: "pixelated" }}
                        className="w-6 h-6 mr-2"
                    />
                    {stats.coins}
                </div>
                <div className="font-bold">Depth: {stats.depth}</div>
            </div>
        </div>
    );
}

