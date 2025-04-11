// src/components/ItemDisplay.tsx
import React from "react";
import type { Relic } from "@/game/data/Relics";
import type { Consumable } from "@/game/data/Consumables";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    // TooltipProvider should wrap the application (e.g., in App.tsx)
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils"; // For conditional classes
import Coin from "./Coin";

// Type guard to differentiate items
// We'll assume Relics might have a 'type' like 'passive' later,
// or check for a property unique to one type (like 'cost' on Consumable)
function isRelic(item: Relic | Consumable): item is Relic {
    return !("cost" in item);
}

interface ItemDisplayProps {
    item: Relic | Consumable;
    itemTypeOverride?: "relic" | "consumable"; // Optional override if type guard is unreliable
    onPurchase?: (item: Relic | Consumable) => void; // Callback for shop purchase clicks
    showPrice?: boolean; // Flag to display price (for shop)
    disabled?: boolean; // Flag to disable interaction (e.g., can't afford)
    size?: "sm" | "md" | "lg" | "xl" | "xxl"; // Optional size variants
    className?: string; // Allow custom styling
    background?: boolean; // Flag to display background of button
    count?: number; // Add count prop
}

const ItemDisplay: React.FC<ItemDisplayProps> = ({
    item,
    itemTypeOverride,
    onPurchase,
    showPrice = false,
    disabled = false,
    size = "md",
    background = false,
    count, // Destructure count
    className,
}) => {
    // Determine item type primarily by override, then by type guard
    const itemTypeFolder = itemTypeOverride
        ? itemTypeOverride === "relic"
            ? "relics"
            : "consumables"
        : isRelic(item)
        ? "relics"
        : "consumables";

    const assetPath = `/assets/${itemTypeFolder}/${item.spriteKey}.png`;

    const handlePurchaseClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent potential parent handlers
        if (onPurchase && !disabled) {
            onPurchase(item);
        }
    };

    const sizeClasses = {
        sm: "w-6 h-6",
        md: "w-8 h-8",
        lg: "w-10 h-10",
        xl: "w-12 h-12",
        xxl: "w-16 h-16",
    };

    const cost = !isRelic(item) ? (item as Consumable).cost : undefined;

    return (
        <Tooltip delayDuration={0} disableHoverableContent>
            <TooltipTrigger asChild>
                <div
                    className={cn(
                        "flex flex-col items-center space-y-1",
                        className
                    )}
                >
                    <Button
                        variant="outline" // Use outline for a clearer clickable area
                        className={cn(
                            "p-1 h-auto w-auto border rounded relative", // Added relative positioning
                            onPurchase ? "cursor-pointer" : "cursor-default", // Cursor indicates clickability
                            sizeClasses[size], // Apply size class to button padding indirectly via content size
                            disabled ? "opacity-50" : "", // Disable styling
                            background
                                ? ""
                                : "bg-transparent hover:bg-transparent shadow-none border-none" // Apply background if enabled
                        )}
                        onClick={onPurchase ? handlePurchaseClick : undefined}
                        disabled={disabled}
                    >
                        <img
                            src={assetPath}
                            alt={item.name}
                            style={{
                                imageRendering: "pixelated",
                                filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.5))",
                            }}
                            className={cn(
                                "object-contain", // Ensure image fits
                                sizeClasses[size], // Apply size class to image itself,
                                "hover:scale-120 transition-all duration-200"
                            )}
                            onError={(e) => {
                                // Fallback or error logging if image fails
                                console.warn(
                                    `Failed to load image: ${assetPath}`
                                );
                                (e.target as HTMLImageElement).style.display =
                                    "none"; // Hide broken image icon
                                // Optionally show a placeholder
                            }}
                        />
                        {/* Display count if greater than 1 */}
                        {count && count > 1 && (
                            <span
                                className="absolute bottom-0 right-0 text-xl px-1 py-0.5 text-white"
                                style={{
                                    textShadow: "1px 1px 2px rgba(0,0,0,0.7)",
                                    fontWeight: "100",
                                }} // Add text shadow for readability
                            >
                                x{count}
                            </span>
                        )}
                    </Button>
                    {showPrice && cost !== undefined && (
                        <Coin size="sm" cost={cost} muted={disabled} />
                    )}
                </div>
            </TooltipTrigger>
            <TooltipContent
                side="bottom"
                className={cn(
                    "max-w-[230px] z-50",
                    "bg-[#5a3d2b] border-[#a0704f] text-amber-100" // Chest colors
                )}
                style={{
                    filter: "drop-shadow(0px 0px 15px rgba(0,0,0,0.5))",
                }}
            >
                <p className="text-2xl mb-1 font-bold text-white">
                    {item.name}
                </p>
                <p className="text-base mt-1">{item.description}</p>
                {item.effect && (
                    <p className="text-base text-green-300 mt-1">
                        {item.effect}
                    </p>
                )}
            </TooltipContent>
        </Tooltip>
    );
};

export default ItemDisplay;

