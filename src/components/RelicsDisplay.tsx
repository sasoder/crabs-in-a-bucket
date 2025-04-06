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
    // 1. Count occurrences of each relic ID
    const relicCounts = relicIds.reduce<Record<string, number>>((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
    }, {});

    // 2. Get unique relic IDs to render
    const uniqueRelicIds = Object.keys(relicCounts);

    // 3. Map unique IDs to full Relic data and count for rendering
    const relicsToDisplay = uniqueRelicIds
        .map((id) => {
            const relic = AllRelicsData[id];
            return relic ? { ...relic, count: relicCounts[id] } : null;
        })
        .filter((item): item is Relic & { count: number } => !!item); // Type guard including count

    return (
        <div className="flex space-x-1 items-center">
            {relicsToDisplay.map((relicWithCount, index) => (
                <ItemDisplay
                    key={relicWithCount.id + "relic" + index}
                    item={relicWithCount} // Pass the whole relic object
                    itemTypeOverride="relic" // Specify the type
                    size="xl" // Use smaller size for the HUD display
                    count={relicWithCount.count} // Pass the count
                />
            ))}
        </div>
    );
};

export default RelicDisplay;

