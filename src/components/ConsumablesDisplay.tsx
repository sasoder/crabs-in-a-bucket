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
            {displayItems.map(
                (
                    consumable,
                    index // Added index for key uniqueness if IDs aren't unique in the array
                ) => (
                    <ItemDisplay
                        key={`${consumable.id}-${index}`} // Ensure key is unique if player can have multiple of same ID
                        item={consumable}
                        itemTypeOverride="consumable" // Specify the type
                        size="sm" // Use smaller size for the HUD display
                        // TODO: Add indication of which key activates it (1, 2, 3)
                    />
                )
            )}
            {/* Optionally show placeholder slots if less than max */}
            {Array.from({ length: MAX_DISPLAY - displayItems.length }).map(
                (_, index) => (
                    <div
                        key={`placeholder-${index}`}
                        className="w-6 h-6 border border-dashed border-gray-400 rounded"
                        title="Empty consumable slot"
                    ></div>
                )
            )}
        </div>
    );
};

export default ConsumablesDisplay;

