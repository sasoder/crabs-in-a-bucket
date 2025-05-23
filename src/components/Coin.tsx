import { cn } from "@/lib/utils";

interface CoinProps {
    size?: "sm" | "md" | "lg";
    cost?: number;
    textShadow?: boolean;
    muted?: boolean;
}

const coinTextSize = {
    sm: "text-2xl",
    md: "text-3xl",
    lg: "text-4xl",
};

export default function Coin({
    size = "md",
    cost = 0,
    textShadow = true,
    muted = false,
}: CoinProps) {
    return (
        <div className="flex items-center gap-1">
            <img
                src="/assets/ui/coin.png"
                alt="coin"
                style={{
                    imageRendering: "pixelated",
                    filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.5))",
                    opacity: muted ? 0.5 : 1,
                }}
                className={cn(
                    "w-8 h-8",
                    size === "sm" && "w-4 h-4",
                    size === "lg" && "w-12 h-12"
                )}
            />
            {cost >= 0 && (
                <div
                    className={cn(coinTextSize[size])}
                    style={{
                        textShadow: textShadow
                            ? "0px 2px 3px rgba(0,0,0,0.5)"
                            : "none",
                        opacity: muted ? 0.5 : 1,
                    }}
                >
                    {cost}
                </div>
            )}
        </div>
    );
}

