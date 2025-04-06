import React from "react";
import type { Consumable } from "@/game/data/Consumables";
import { CONSUMABLES as AllConsumablesData } from "@/game/data/Consumables";
import ItemDisplay from "./ItemDisplay";
// TooltipProvider should be handled in App.tsx

interface ConsumablesDisplayProps {
    consumableIds: string[]; // Array of consumable IDs held by the player (newest is last)
}

const ConsumablesDisplay: React.FC<ConsumablesDisplayProps> = ({
    consumableIds,
}) => {
    // Map IDs to actual consumable data
    const consumablesToDisplay = consumableIds
        .map((id) => AllConsumablesData[id])
        .filter((consumable): consumable is Consumable => !!consumable);

    // Limit visual display to avoid excessive overlap, e.g., max 3-4 visible
    const MAX_VISUAL_STACK = 3;
    const itemsToShow = consumablesToDisplay.slice(-MAX_VISUAL_STACK); // Get the last N items

    const stackOffset = 4; // Pixels to offset each stacked item vertically and horizontally

    return (
        <div
            className="relative h-10 w-10 flex items-center justify-center" // Container to hold the stack
            title={
                consumablesToDisplay.length > 0
                    ? `Next up: ${
                          consumablesToDisplay[consumablesToDisplay.length - 1]
                              ?.name
                      }`
                    : "No consumables"
            }
        >
            {/* Placeholder if empty */}
            {itemsToShow.length === 0 && (
                <div className="absolute inset-0 border border-dashed border-secondary/80 rounded opacity-50"></div>
            )}

            {/* Render the stack */}
            {itemsToShow.map((item, index) => {
                // Calculate offset: items deeper in the stack (earlier in itemsToShow) get more offset
                const depth = itemsToShow.length - 1 - index; // 0 for top item, 1 for next, etc.
                const xOffset = depth * stackOffset;
                const yOffset = depth * stackOffset;

                return (
                    <div
                        key={`${item.id}-${index}`} // Use a unique key
                        className="absolute"
                        style={{
                            // Apply transform for offset
                            transform: `translate(${xOffset}px, ${yOffset}px)`,
                            // Higher index (top of stack) gets higher z-index
                            zIndex: index,
                        }}
                    >
                        <ItemDisplay
                            item={item}
                            itemTypeOverride="consumable"
                            size="md"
                            background // Give items a background/border
                        />
                    </div>
                );
            })}
        </div>
    );
};

export default ConsumablesDisplay;

