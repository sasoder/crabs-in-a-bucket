import React from "react";
// Remove EventBus import if no longer needed elsewhere in the file
// import { EventBus } from "@/game/EventBus";
import type { Relic } from "@/game/data/Relics";
import { RELICS as AllRelicsData } from "@/game/data/Relics"; // Import the data map
import ItemDisplay from "./ItemDisplay"; // Import the new component
// TooltipProvider should be handled in App.tsx

// Define props interface
interface RelicDisplayProps {
    relicIds: string[]; // Accept relic IDs as props
}

// Update component signature to accept props
const RelicDisplay: React.FC<RelicDisplayProps> = ({ relicIds }) => {
    // Map IDs from props to full Relic data for rendering
    const relicsToDisplay = relicIds
        .map((id) => AllRelicsData[id])
        .filter((relic): relic is Relic => !!relic); // Type guard for filtering

    return (
        <div className="flex space-x-1 items-center">
            {relicsToDisplay.map((relic, index) => (
                <ItemDisplay
                    key={relic.id + "relic" + index}
                    item={relic}
                    itemTypeOverride="relic" // Specify the type
                    size="lg" // Use smaller size for the HUD display
                />
            ))}
        </div>
    );
};

export default RelicDisplay;

