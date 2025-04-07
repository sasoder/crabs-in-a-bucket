import React, { useState, useEffect, useRef } from "react";
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
    "border-8 border-t-[#b88a5f] border-l-[#b88a5f] border-b-[#4a2e1e] border-r-[#4a2e1e] p-1"; // Simulate thicker, beveled wood frame

export function ShopModal({ isOpen, onClose, playerCoins }: ShopModalProps) {
    const [relics, setRelics] = useState<Relic[]>([]);
    const [consumables, setConsumables] = useState<Consumable[]>([]);
    const [rerollCost, setRerollCost] = useState(5);
    const [canAffordReroll, setCanAffordReroll] = useState(false);
    const [purchasedItemIds, setPurchasedItemIds] = useState<Set<string>>(
        new Set()
    );
    const [inventoryIsFull, setInventoryIsFull] = useState(false);
    const [canCloseShop, setCanCloseShop] = useState(false); // State for closability
    const closeTimerRef = useRef<NodeJS.Timeout | null>(null); // Ref for timer ID (can be timeout or interval)
    const [countdownSeconds, setCountdownSeconds] = useState(3); // State for countdown display

    // Effect to update items when shop opens or items are rerolled
    useEffect(() => {
        const handleShopUpdate = (data: {
            relicIds: string[];
            consumableIds: string[];
            rerollCost: number;
            inventoryIsFull: boolean;
        }) => {
            const newRelics = data.relicIds
                .map((id) => AllRelicsData[id])
                .filter((r): r is Relic => !!r);
            const newConsumables = data.consumableIds
                .map((id) => AllConsumablesData[id])
                .filter((c): c is Consumable => !!c);

            setRelics(newRelics);
            setConsumables(newConsumables);
            setRerollCost(data.rerollCost);
            setInventoryIsFull(data.inventoryIsFull);
            setPurchasedItemIds(new Set()); // Clear purchased items on update/reroll
        };

        // Use the same handler for initial open and subsequent updates
        EventBus.on("open-shop", handleShopUpdate);
        EventBus.on("update-shop-items", handleShopUpdate);

        return () => {
            EventBus.off("open-shop", handleShopUpdate);
            EventBus.off("update-shop-items", handleShopUpdate);
        };
    }, []); // Run only once to set up listeners

    useEffect(() => {
        if (isOpen) {
            setCountdownSeconds(3);
            setCanCloseShop(false);
            if (closeTimerRef.current) {
                clearInterval(closeTimerRef.current);
            }
            closeTimerRef.current = setInterval(() => {
                setCountdownSeconds((prevSeconds) => {
                    const nextSeconds = prevSeconds - 1;
                    if (nextSeconds <= 0) {
                        if (closeTimerRef.current) {
                            clearInterval(closeTimerRef.current);
                            closeTimerRef.current = null;
                        }
                        setCanCloseShop(true);
                        return 0;
                    }
                    return nextSeconds;
                });
            }, 1000);
        } else {
            if (closeTimerRef.current) {
                clearInterval(closeTimerRef.current);
                closeTimerRef.current = null;
            }
            setCanCloseShop(false);
        }

        return () => {
            if (closeTimerRef.current) {
                clearInterval(closeTimerRef.current);
                closeTimerRef.current = null;
            }
        };
    }, [isOpen]);

    useEffect(() => {
        const handleItemPurchased = (data: {
            itemId: string;
            itemType: "relic" | "consumable";
        }) => {
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

    // Add keyboard listener for closing keys
    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            // Only process if shop is open and closable
            if (isOpen && canCloseShop) {
                // Check for allowed keys: Enter, Space, Arrow Keys
                if (
                    event.key === "Enter" ||
                    event.key === " " || // Space bar
                    event.key.startsWith("Arrow") // ArrowLeft, ArrowRight, ArrowUp, ArrowDown
                ) {
                    event.preventDefault(); // Prevent default browser actions (like scrolling with space/arrows)
                    handleClose();
                }
            }
        };

        window.addEventListener("keydown", handleKeyPress);
        return () => {
            window.removeEventListener("keydown", handleKeyPress);
        };
    }, [isOpen, canCloseShop]); // Depend on isOpen and canCloseShop

    const handleClose = () => {
        // Only close if allowed
        if (!canCloseShop) return;

        EventBus.emit("close-shop"); // Tell Phaser the shop is closing
        onClose(); // Update React state in App.tsx
    };

    const handleReroll = () => {
        if (canAffordReroll) {
            EventBus.emit("request-shop-reroll");
        }
    };

    const handlePurchase = (
        item: Relic | Consumable,
        itemType: "relic" | "consumable"
    ) => {
        const cost = getItemCost(item);
        if (playerCoins >= cost && !purchasedItemIds.has(item.id)) {
            EventBus.emit("purchase-item", { itemId: item.id, itemType });
        } else {
            console.warn(
                `ShopModal: Cannot purchase ${
                    item.id
                } (Type: ${itemType}, Coins: ${playerCoins}, Cost: ${cost}, Purchased: ${purchasedItemIds.has(
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
                {" "}
                {/* Ensure texture wraps if needed */}
                <AlertDialogContent
                    className={cn(
                        "sm:max-w-[475px] p-0 border-none shadow-none", // Removed border-radius, increased max-width slightly
                        "bg-[#3a2416]" // Dark wood base for outer frame/background
                    )}
                >
                    <div className={cn(woodFrameStyle)}>
                        {" "}
                        {/* Outer frame */}
                        <div
                            className={cn(
                                "p-6 bg-[#5a3d2b] shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]" // Inner panel slightly lighter, increased padding, subtle inner shadow
                            )}
                        >
                            <AlertDialogHeader className="mb-4">
                                <AlertDialogTitle
                                    className={cn("text-4xl text-center")}
                                    style={{
                                        fontWeight: "100",
                                    }}
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
                            <div className={cn("my-2")}>
                                <h3
                                    className={cn(
                                        "text-3xl mb-2 text-amber-200 text-center"
                                    )}
                                >
                                    Relics
                                </h3>
                                <div className="p-4 bg-[#c1a37e] rounded shadow-inner border border-[#a0704f]">
                                    <div className="flex justify-around gap-4 py-2 min-h-[80px] items-center">
                                        {relics.length > 0 ? (
                                            relics.map((relic) => {
                                                const cost = getItemCost(relic);
                                                const cannotAfford =
                                                    playerCoins < cost;
                                                const isPurchased =
                                                    purchasedItemIds.has(
                                                        relic.id
                                                    );
                                                return (
                                                    <ItemDisplay
                                                        key={relic.id}
                                                        item={relic}
                                                        itemTypeOverride="relic"
                                                        onPurchase={() =>
                                                            handlePurchase(
                                                                relic,
                                                                "relic"
                                                            )
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
                            </div>
                            {/* Consumables Section */}
                            <div className={cn("my-2")}>
                                <h3
                                    className={cn(
                                        "text-3xl mb-2 text-amber-200 text-center"
                                    )}
                                >
                                    Items{" "}
                                    {inventoryIsFull && (
                                        <span className="text-lg text-red-400">
                                            (your inventory is full)
                                        </span>
                                    )}
                                </h3>
                                <div className="p-4 bg-[#c1a37e] rounded shadow-inner border border-[#a0704f]">
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
                                                const inventoryFull =
                                                    inventoryIsFull;

                                                return (
                                                    <ItemDisplay
                                                        key={consumable.id}
                                                        item={consumable}
                                                        itemTypeOverride="consumable"
                                                        onPurchase={() =>
                                                            handlePurchase(
                                                                consumable,
                                                                "consumable"
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
                            </div>
                            <AlertDialogFooter className="flex flex-row justify-between items-center pt-2 sm:justify-between">
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
                                    disabled={!canCloseShop} // Disable button during delay
                                    className={cn(
                                        "text-xl border-2 border-t-orange-300 border-l-orange-300 border-b-orange-700 border-r-orange-700 bg-orange-500/80 hover:bg-orange-500 text-orange-950 disabled:opacity-60"
                                    )}
                                >
                                    {canCloseShop
                                        ? "Keep Digging"
                                        : `Keep digging in ${countdownSeconds}s...`}
                                </Button>
                            </AlertDialogFooter>
                        </div>
                    </div>
                </AlertDialogContent>
            </div>
        </AlertDialog>
    );
}

