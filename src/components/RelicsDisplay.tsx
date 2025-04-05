import React from "react";
// Remove EventBus import if no longer needed elsewhere in the file
// import { EventBus } from "@/game/EventBus";
import type { Relic } from "@/game/data/Relics";
import { RELICS as AllRelicsData } from "@/game/data/Relics"; // Import the data map
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

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

    // Make sure TooltipProvider is an ancestor (handled in App.tsx)
    return (
        <TooltipProvider>
            <div className="flex space-x-1 items-center">
                {" "}
                {/* Reduced spacing */}
                {relicsToDisplay.map((relic) => (
                    <Tooltip key={relic.id} delayDuration={0}>
                        <TooltipTrigger asChild>
                            {/* Use button or div for better accessibility/styling */}
                            <button className="p-0 border-none bg-transparent cursor-default">
                                <img
                                    // Ensure asset path is correct - check public folder structure
                                    src={`/assets/relics/${relic.spriteKey}.png`}
                                    alt={relic.name}
                                    title={`${relic.name}: ${relic.effect}`} // Basic title attribute as fallback
                                    className="w-6 h-6 pixelated" // Smaller size?
                                />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent
                            side="bottom" // Position below the trigger
                            className="bg-gray-900 text-white border-gray-700 p-2 rounded shadow-lg" // Style tooltip
                        >
                            <p className="font-bold text-base mb-1">
                                {relic.name}
                            </p>
                            <p className="text-sm text-green-400">
                                {relic.effect}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                {relic.description}
                            </p>
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>
        </TooltipProvider>
    );
};

export default RelicDisplay;

