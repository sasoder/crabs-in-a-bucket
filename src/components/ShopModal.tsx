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
import { Separator } from "@/components/ui/separator"; // For visual separation

interface ShopModalProps {
    isOpen: boolean;
    onClose: () => void;
    playerCoins: number; // Receive player's current coins
}

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
        // FIXME: Needs actual relic cost from Relics.ts
        const cost = "cost" in item ? item.cost : 100;
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
        return "cost" in item ? item.cost : 100;
    };

    return (
        <AlertDialog
            open={isOpen}
            onOpenChange={(open: boolean) => !open && handleClose()}
        >
            <AlertDialogContent className="sm:max-w-[525px] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 border-gray-300 dark:border-gray-700">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">
                        You found a chest!
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-center text-gray-600 dark:text-gray-400">
                        You can exchange your coins for tools and relics.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <Separator className="my-4 bg-gray-300 dark:bg-gray-700" />

                {/* Relics Section */}
                <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
                        Relics
                    </h3>
                    <div className="flex justify-around gap-4 py-2">
                        {relics.length > 0 ? (
                            relics.map((relic) => {
                                // --- DEBUG LOG ---
                                console.log(
                                    "ShopModal: Rendering Relic ItemDisplay for:",
                                    relic.id
                                );
                                const cost = getItemCost(relic);
                                const cannotAfford = playerCoins < cost;
                                const isPurchased = purchasedItemIds.has(
                                    relic.id
                                );
                                return (
                                    <ItemDisplay
                                        key={relic.id}
                                        item={relic}
                                        itemTypeOverride="relic"
                                        onPurchase={() => handlePurchase(relic)}
                                        showPrice={true}
                                        disabled={cannotAfford || isPurchased}
                                        size="lg"
                                    />
                                );
                            })
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                No relics available.
                            </p>
                        )}
                    </div>
                </div>

                <Separator className="my-4 bg-gray-300 dark:bg-gray-700" />

                {/* Consumables Section */}
                <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
                        Consumables
                    </h3>
                    <div className="flex justify-around gap-4 py-2">
                        {consumables.length > 0 ? (
                            consumables.map((consumable) => {
                                // --- DEBUG LOG ---
                                console.log(
                                    "ShopModal: Rendering Consumable ItemDisplay for:",
                                    consumable.id
                                );
                                const cost = getItemCost(consumable);
                                const cannotAfford = playerCoins < cost;
                                const isPurchased = purchasedItemIds.has(
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
                                            handlePurchase(consumable)
                                        }
                                        showPrice={true}
                                        disabled={
                                            cannotAfford ||
                                            isPurchased ||
                                            inventoryFull
                                        }
                                        size="lg"
                                    />
                                );
                            })
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                No consumables available.
                            </p>
                        )}
                    </div>
                </div>

                <Separator className="my-4 bg-gray-300 dark:bg-gray-700" />

                <AlertDialogFooter className="flex flex-row justify-between items-center pt-4">
                    <Button
                        variant="outline"
                        onClick={handleReroll}
                        disabled={!canAffordReroll}
                        className="border-yellow-500 text-yellow-600 hover:bg-yellow-50 dark:border-yellow-400 dark:text-yellow-300 dark:hover:bg-yellow-900/50 disabled:opacity-50"
                    >
                        Reroll ({rerollCost} Coins)
                    </Button>
                    <Button
                        variant="outline"
                        className="text-black"
                        onClick={handleClose}
                    >
                        Keep Digging
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

