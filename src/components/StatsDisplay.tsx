import Coin from "./Coin";

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
        <div className="ui-container absolute top-0 left-0 p-0 text-3xl bg-transparent text-white">
            <div className="flex flex-col space-y-1">
                <div className=" flex items-center">
                    {Array.from({ length: stats.lives }).map((_, index) => (
                        <img
                            key={index}
                            src="/assets/ui/heart.png"
                            alt="heart"
                            style={{
                                imageRendering: "pixelated",
                                filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.5))",
                            }}
                            className="w-8 h-8 mr-2"
                        />
                    ))}
                </div>
                <div className="flex items-center">
                    <Coin size="md" cost={stats.coins} />
                </div>
                <div className="ml-2">
                    <span style={{ textShadow: "0px 2px 3px rgba(0,0,0,0.5)" }}>
                        {stats.depth} m
                    </span>
                </div>
            </div>
        </div>
    );
}

