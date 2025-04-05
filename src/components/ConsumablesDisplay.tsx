import React from "react";
import type { Consumable } from "@/game/data/Consumables";
import { CONSUMABLES as AllConsumablesData } from "@/game/data/Consumables";
import ItemDisplay from "./ItemDisplay";
// TooltipProvider should be handled in App.tsx

interface ConsumablesDisplayProps {
    consumableIds: string[]; // Array of consumable IDs held by the player
    // TODO: Consider adding quantity for stackable consumables later
}

const ConsumablesDisplay: React.FC<ConsumablesDisplayProps> = ({
    consumableIds,
}) => {
    // For now, just display one icon per ID. Later, group stacks.
    const consumablesToDisplay = consumableIds
        .map((id) => AllConsumablesData[id])
        .filter((consumable): consumable is Consumable => !!consumable);

    // Limit display to max carriable (e.g., 3) if needed by design
    const MAX_DISPLAY = 3;
    const displayItems = consumablesToDisplay.slice(0, MAX_DISPLAY);

    return (
        <div className="flex space-x-1 items-center">
            {/* Always show 3 slots */}
            {Array.from({ length: MAX_DISPLAY }).map((_, index) => (
                <div
                    key={`slot-${index}`}
                    className="relative w-8 h-8 border border-dashed border-gray-400 rounded"
                    title={
                        displayItems[index]
                            ? displayItems[index].name
                            : "Empty consumable slot"
                    }
                >
                    {/* Show consumable on top of the slot if it exists */}
                    {displayItems[index] && (
                        <ItemDisplay
                            item={displayItems[index]}
                            itemTypeOverride="consumable"
                            size="md"
                            className="absolute inset-0" // Position over the placeholder
                        />
                    )}
                </div>
            ))}
        </div>
    );
};

export default ConsumablesDisplay;

