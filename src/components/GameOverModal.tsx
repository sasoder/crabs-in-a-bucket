import React, { useState, useEffect } from "react";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { EventBus } from "@/game/EventBus";
import type { Relic } from "@/game/data/Relics";
import { RELICS as AllRelicsData } from "@/game/data/Relics";
import ItemDisplay from "./ItemDisplay"; // Reuse the item display
import { Separator } from "@/components/ui/separator"; // For visual separation
import { cn } from "@/lib/utils";
import Coin from "./Coin"; // Reuse the coin display

interface GameOverData {
    score: number;
    totalCoins: number;
    relics: string[]; // Array of relic IDs
}

interface GameOverModalProps {
    isOpen: boolean;
    onClose: () => void; // Callback to close the modal in App.tsx
    data: GameOverData | null; // Data from the game over event
}

// Type for storing relic data along with its count
type RelicWithCount = Relic & { count: number };

// Basic wood texture simulation using gradients and color stops (similar to ShopModal)
const woodFrameStyle =
    "border-4 border-t-[#a0704f] border-l-[#a0704f] border-b-[#5a3d2b] border-r-[#5a3d2b] p-1";

export function GameOverModal({ isOpen, onClose, data }: GameOverModalProps) {
    const [collectedRelics, setCollectedRelics] = useState<RelicWithCount[]>(
        []
    ); // State now holds relics with counts

    useEffect(() => {
        if (data?.relics) {
            // 1. Count occurrences of each relic ID
            const relicCounts = data.relics.reduce<Record<string, number>>(
                (acc, id) => {
                    acc[id] = (acc[id] || 0) + 1;
                    return acc;
                },
                {}
            );

            // 2. Get unique relic IDs
            const uniqueRelicIds = Object.keys(relicCounts);

            // 3. Map unique IDs to full Relic data and count
            const relicsWithCounts = uniqueRelicIds
                .map((id) => {
                    const relic = AllRelicsData[id];
                    return relic ? { ...relic, count: relicCounts[id] } : null;
                })
                .filter((item): item is RelicWithCount => !!item); // Type guard

            setCollectedRelics(relicsWithCounts);
        } else {
            setCollectedRelics([]);
        }
    }, [data]); // Update relics when data changes

    const handleRestart = () => {
        console.log("GameOverModal: Emitting restart-game");
        EventBus.emit("restart-game"); // Tell Phaser Game scene to restart
        onClose(); // Close the modal in React
    };

    if (!data) {
        return null; // Don't render if no data yet
    }

    return (
        <AlertDialog
            open={isOpen}
            onOpenChange={(open: boolean) => !open && onClose()} // Allow closing by clicking outside (optional)
        >
            <AlertDialogContent
                className={cn(
                    "sm:max-w-[450px] p-0 border-none shadow-none border-radius", // Remove default styling
                    "bg-[#3a2416]" // Dark wood base
                )}
            >
                <div className={cn(woodFrameStyle)}>
                    {" "}
                    {/* Outer frame */}
                    <div className={cn("p-4 bg-[#d2b48c] rounded")}>
                        {" "}
                        {/* Inner parchment-like panel */}
                        <AlertDialogHeader className="mb-4 text-center">
                            <AlertDialogTitle
                                className={cn(
                                    "text-4xl text-[#5a3d2b] text-center"
                                )} // Dark brown title
                            >
                                Game Over!
                            </AlertDialogTitle>
                            <AlertDialogDescription
                                className={cn(
                                    "text-xl text-secondary px-6 text-[#7b5e45] text-center" // Lighter brown text
                                )}
                            >
                                Your journey ends here... for now.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        {/* Stats Section */}
                        <div className="text-center my-4 p-2 bg-[#c1a37e] rounded shadow-inner">
                            <p className="text-2xl mb-1 text-[#5a3d2b]">
                                Final Depth:{" "}
                                <span className="font-bold">{data.score}</span>{" "}
                                meters
                            </p>
                            <div className="flex justify-center items-center text-2xl text-[#5a3d2b]">
                                Total Coins Collected:
                                <div className="ml-2">
                                    <Coin
                                        size="md"
                                        cost={data.totalCoins}
                                        textShadow={false}
                                    />
                                </div>
                            </div>
                        </div>
                        <Separator className="my-4 bg-[#a0704f]" />
                        {/* Relics Collected Section */}
                        <div
                            className={cn(
                                "p-4 my-2 bg-[#c1a37e] rounded shadow-inner"
                            )}
                        >
                            <h3
                                className={cn(
                                    "text-2xl mb-3 text-center text-[#5a3d2b]"
                                )}
                            >
                                Relics Collected:
                            </h3>
                            <div className="flex flex-wrap justify-center gap-4 py-2 min-h-[60px] items-center">
                                {collectedRelics.length > 0 ? (
                                    collectedRelics.map((relicWithCount) => (
                                        <ItemDisplay
                                            key={relicWithCount.id}
                                            item={relicWithCount}
                                            itemTypeOverride="relic"
                                            background={false}
                                            showPrice={false}
                                            disabled={true}
                                            size="lg"
                                            count={relicWithCount.count}
                                        />
                                    ))
                                ) : (
                                    <p className="text-sm text-[#7b5e45] opacity-80">
                                        None this run.
                                    </p>
                                )}
                            </div>
                        </div>
                        <AlertDialogFooter className="flex flex-row justify-center items-center pt-4 sm:justify-center">
                            <Button
                                variant="secondary"
                                onClick={handleRestart}
                                className={cn(
                                    "text-xl border-2 border-t-orange-300 border-l-orange-300 border-b-orange-700 border-r-orange-700 bg-orange-500/80 hover:bg-orange-500 text-orange-950 disabled:opacity-60"
                                )}
                            >
                                Try Again
                            </Button>
                        </AlertDialogFooter>
                    </div>
                </div>
            </AlertDialogContent>
        </AlertDialog>
    );
}

