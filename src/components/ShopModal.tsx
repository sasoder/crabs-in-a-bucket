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
import type { Consumable } from "@/game/data/Consumables";
import { CONSUMABLES as AllConsumablesData } from "@/game/data/Consumables";
import ItemDisplay from "./ItemDisplay"; // Import the reusable component
import { cn } from "@/lib/utils";
import Coin from "./Coin";

interface ShopModalProps {
    isOpen: boolean;
    onClose: () => void;
    playerCoins: number; // Receive player's current coins
}

// Basic wood texture simulation using gradients and color stops
const woodFrameStyle =
    "border-4 border-t-[#a0704f] border-l-[#a0704f] border-b-[#5a3d2b] border-r-[#5a3d2b] p-1"; // Simulate bevel

export function ShopModal({ isOpen, onClose, playerCoins }: ShopModalProps) {
    const [relics, setRelics] = useState<Relic[]>([]);
    const [consumables, setConsumables] = useState<Consumable[]>([]);
    const [rerollCost, setRerollCost] = useState(5);
    const [canAffordReroll, setCanAffordReroll] = useState(false);
    const [purchasedItemIds, setPurchasedItemIds] = useState<Set<string>>(
        new Set()
    );

    // --- DEBUG LOG ---
    console.log("ShopModal Rendering. State:", {
        relics,
        consumables,
        rerollCost,
        purchasedItemIds: Array.from(purchasedItemIds),
    });

    // Effect to update items when shop opens or items are rerolled
    useEffect(() => {
        const handleShopUpdate = (data: {
            relicIds: string[];
            consumableIds: string[];
            rerollCost: number;
        }) => {
            // --- DEBUG LOG ---
            console.log("ShopModal: handleShopUpdate received data:", data);

            const newRelics = data.relicIds
                .map((id) => AllRelicsData[id])
                .filter((r): r is Relic => !!r);
            const newConsumables = data.consumableIds
                .map((id) => AllConsumablesData[id])
                .filter((c): c is Consumable => !!c);

            // --- DEBUG LOG ---
            console.log("ShopModal: Fetched items:", {
                newRelics,
                newConsumables,
            });

            setRelics(newRelics);
            setConsumables(newConsumables);
            setRerollCost(data.rerollCost);
            setPurchasedItemIds(new Set()); // Clear purchased items on update/reroll
        };

        // Use the same handler for initial open and subsequent updates
        EventBus.on("open-shop", handleShopUpdate);
        EventBus.on("update-shop-items", handleShopUpdate);

        // --- DEBUG LOG ---
        console.log("ShopModal: Subscribed to shop events");

        return () => {
            EventBus.off("open-shop", handleShopUpdate);
            EventBus.off("update-shop-items", handleShopUpdate);
            // --- DEBUG LOG ---
            console.log("ShopModal: Unsubscribed from shop events");
        };
    }, []); // Run only once to set up listeners

    // Effect to track successful purchases and disable buttons
    useEffect(() => {
        const handleItemPurchased = (data: {
            itemId: string;
            itemType: "relic" | "consumable";
        }) => {
            console.log(
                `ShopModal: Item ${data.itemId} purchased. Adding to purchased set.`
            );
            setPurchasedItemIds((prev) => new Set(prev).add(data.itemId));
        };

        EventBus.on("item-purchased", handleItemPurchased);
        return () => {
            EventBus.off("item-purchased", handleItemPurchased);
        };
    }, []);

    // Effect to recalculate if player can afford reroll
    useEffect(() => {
        setCanAffordReroll(playerCoins >= rerollCost);
    }, [playerCoins, rerollCost]);

    const handleClose = () => {
        EventBus.emit("close-shop"); // Tell Phaser the shop is closing
        onClose(); // Update React state in App.tsx
    };

    const handleReroll = () => {
        if (canAffordReroll) {
            console.log("ShopModal: Emitting request-shop-reroll");
            EventBus.emit("request-shop-reroll");
        }
    };

    const handlePurchase = (item: Relic | Consumable) => {
        const itemType = "cost" in item ? "consumable" : "relic";
        const cost = getItemCost(item);
        if (playerCoins >= cost && !purchasedItemIds.has(item.id)) {
            console.log(
                `ShopModal: Emitting purchase-item for ${itemType} ${item.id}`
            );
            EventBus.emit("purchase-item", { itemId: item.id, itemType });
        } else {
            console.warn(
                `ShopModal: Cannot purchase ${
                    item.id
                } (Coins: ${playerCoins}, Cost: ${cost}, Purchased: ${purchasedItemIds.has(
                    item.id
                )})`
            );
        }
    };

    const getItemCost = (item: Relic | Consumable): number => {
        // FIXME: Relics need a cost property in Relics.ts! Defaulting to 100 for now.
        // Use a more reasonable default like 10 or check the image? Image has 10 coins.
        return "cost" in item ? item.cost : 10; // Assuming relic cost is 10 based on image
    };

    return (
        <AlertDialog
            open={isOpen}
            onOpenChange={(open: boolean) => !open && handleClose()}
        >
            <div className="texture">
                <AlertDialogContent
                    className={cn(
                        "sm:max-w-[450px] p-0 border-none shadow-none border-radius", // Remove default padding and borders
                        "bg-[#3a2416]" // Dark wood base for outer frame
                    )}
                >
                    <div className={cn(woodFrameStyle)}>
                        {" "}
                        {/* Outer frame */}
                        <div className={cn("p-4")}>
                            {" "}
                            {/* Inner panel */}
                            <AlertDialogHeader className="mb-4">
                                <AlertDialogTitle
                                    className={cn("text-4xl text-center")}
                                >
                                    You found a chest!
                                </AlertDialogTitle>
                                <AlertDialogDescription
                                    className={cn(
                                        "text-xl text-center text-secondary px-12"
                                    )}
                                >
                                    As you make your way deeper, you can
                                    exchange your coins for tools and relics.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            {/* Relics Section */}
                            <div className={cn("p-4 my-2")}>
                                <h3
                                    className={cn(
                                        "text-3xl mb-3 text-amber-300"
                                    )}
                                >
                                    Relics
                                </h3>
                                <div className="flex justify-around gap-4 py-2 min-h-[80px] items-center">
                                    {relics.length > 0 ? (
                                        relics.map((relic) => {
                                            const cost = getItemCost(relic);
                                            const cannotAfford =
                                                playerCoins < cost;
                                            const isPurchased =
                                                purchasedItemIds.has(relic.id);
                                            return (
                                                <ItemDisplay
                                                    key={relic.id}
                                                    item={relic}
                                                    itemTypeOverride="relic"
                                                    onPurchase={() =>
                                                        handlePurchase(relic)
                                                    }
                                                    background={false}
                                                    showPrice={true}
                                                    disabled={
                                                        cannotAfford ||
                                                        isPurchased
                                                    }
                                                    size="xxl" // Adjusted size
                                                />
                                            );
                                        })
                                    ) : (
                                        <p className="text-sm opacity-80">
                                            No relics available.
                                        </p>
                                    )}
                                </div>
                            </div>
                            {/* Consumables Section */}
                            <div className={cn("p-4 my-2")}>
                                <h3
                                    className={cn(
                                        "text-3xl mb-3 text-amber-300"
                                    )}
                                >
                                    Consumables
                                </h3>
                                <div className="flex justify-around gap-4 py-2 min-h-[80px] items-center">
                                    {consumables.length > 0 ? (
                                        consumables.map((consumable) => {
                                            const cost =
                                                getItemCost(consumable);
                                            const cannotAfford =
                                                playerCoins < cost;
                                            const isPurchased =
                                                purchasedItemIds.has(
                                                    consumable.id
                                                );
                                            // TODO: Check if inventory is full (needs info from Game.ts)
                                            const inventoryFull = false; // Placeholder
                                            return (
                                                <ItemDisplay
                                                    key={consumable.id}
                                                    item={consumable}
                                                    itemTypeOverride="consumable"
                                                    onPurchase={() =>
                                                        handlePurchase(
                                                            consumable
                                                        )
                                                    }
                                                    background={false}
                                                    showPrice={true}
                                                    disabled={
                                                        cannotAfford ||
                                                        isPurchased ||
                                                        inventoryFull
                                                    }
                                                    size="xxl" // Adjusted size
                                                />
                                            );
                                        })
                                    ) : (
                                        <p className="text-sm opacity-80">
                                            No consumables available.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <AlertDialogFooter className="flex flex-row justify-between items-center pt-0 sm:justify-between">
                                {/* Basic button styling, might need custom CSS for exact pixel look */}
                                <Button
                                    variant="secondary"
                                    onClick={handleReroll}
                                    disabled={!canAffordReroll}
                                    className={cn(
                                        "text-xl border-2 border-t-amber-300 border-l-amber-300 border-b-amber-700 border-r-amber-700 bg-amber-500/80 hover:bg-amber-500 text-amber-950 disabled:opacity-60"
                                    )}
                                >
                                    Reroll{" "}
                                    <Coin
                                        size="sm"
                                        cost={rerollCost}
                                        textShadow={false}
                                    />
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={handleClose}
                                    className={cn(
                                        "text-xl border-2 border-t-orange-300 border-l-orange-300 border-b-orange-700 border-r-orange-700 bg-orange-500/80 hover:bg-orange-500 text-orange-950 disabled:opacity-60"
                                    )}
                                >
                                    Keep Digging
                                </Button>
                            </AlertDialogFooter>
                        </div>
                    </div>
                </AlertDialogContent>
            </div>
        </AlertDialog>
    );
}

