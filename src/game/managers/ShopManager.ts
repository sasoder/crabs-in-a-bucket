// src/game/managers/ShopManager.ts
import Phaser from "phaser";
import { EventBus } from "../EventBus";
import { RELICS } from "../data/Relics";
import { CONSUMABLES } from "../data/Consumables";

const MAX_CONSUMABLES = 3; // Define max consumables capacity globally or as a constant

export class ShopManager {
    private scene: Phaser.Scene;
    private registry: Phaser.Data.DataManager;
    private currentShopRelicIds: string[] = [];
    private currentShopConsumableIds: string[] = [];
    private currentRerollCost: number = 5;
    private maxDepthReached: number = 0; // Need this for cost calculation

    constructor(scene: Phaser.Scene, registry: Phaser.Data.DataManager) {
        this.scene = scene;
        this.registry = registry;
        this.setupEventListeners();
    }

    private setupEventListeners() {
        EventBus.on("request-shop-reroll", this.handleShopReroll, this);
        EventBus.on("purchase-item", this.handlePurchaseAttempt, this);
        // Consider adding listeners for depth updates if needed for dynamic costs outside of opening
        EventBus.on(
            "update-max-depth",
            (depth: number) => {
                this.maxDepthReached = depth;
            },
            this
        );
    }

    private removeEventListeners() {
        EventBus.off("request-shop-reroll", this.handleShopReroll, this);
        EventBus.off("purchase-item", this.handlePurchaseAttempt, this);
        EventBus.off("update-max-depth", undefined, this);
    }

    public openShop(currentMaxDepth: number) {
        this.maxDepthReached = currentMaxDepth; // Update depth when opening
        const shopSelection = this._selectShopItems();
        this.currentShopRelicIds = shopSelection.relicIds;
        this.currentShopConsumableIds = shopSelection.consumableIds;
        // Fixed reroll cost
        this.currentRerollCost = 5;
        const inventoryIsFull =
            (this.registry.get("consumables") as string[]).length >=
            MAX_CONSUMABLES;

        // Emit event for UI to display the shop
        EventBus.emit("open-shop-requested", {
            // Changed event name slightly
            relicIds: this.currentShopRelicIds,
            consumableIds: this.currentShopConsumableIds,
            rerollCost: this.currentRerollCost,
            inventoryIsFull: inventoryIsFull, // Add inventory status
        });
    }

    private _selectShopItems(): {
        relicIds: string[];
        consumableIds: string[];
    } {
        const allRelicIds = Object.keys(RELICS);
        const allConsumableIds = Object.keys(CONSUMABLES);

        const currentRelicsOwned = this.registry.get("relics") as string[];
        const availableRelics = allRelicIds.filter(
            (id) =>
                !currentRelicsOwned.includes(id) || RELICS[id].allowDuplicates
        );
        const availableConsumables = allConsumableIds; // Consumables can be bought multiple times

        const shuffledRelics = Phaser.Utils.Array.Shuffle(availableRelics);
        const shuffledConsumables =
            Phaser.Utils.Array.Shuffle(availableConsumables);

        // Offer slightly more items? Tunable.
        const numRelicsToPick = Math.min(3, shuffledRelics.length);
        const numConsumablesToPick = Math.min(3, shuffledConsumables.length);

        return {
            relicIds: shuffledRelics.slice(0, numRelicsToPick),
            consumableIds: shuffledConsumables.slice(0, numConsumablesToPick),
        };
    }

    private handleShopReroll() {
        const currentCoins = this.registry.get("coins") as number;

        if (currentCoins >= this.currentRerollCost) {
            this.registry.set("coins", currentCoins - this.currentRerollCost);

            // Increase reroll cost by a fixed amount
            this.currentRerollCost += 2;

            const shopSelection = this._selectShopItems();
            this.currentShopRelicIds = shopSelection.relicIds;
            this.currentShopConsumableIds = shopSelection.consumableIds;

            const inventoryIsFull =
                (this.registry.get("consumables") as string[]).length >=
                MAX_CONSUMABLES;

            // Emit event for UI to update
            EventBus.emit("update-shop-items", {
                relicIds: this.currentShopRelicIds,
                consumableIds: this.currentShopConsumableIds,
                rerollCost: this.currentRerollCost,
                inventoryIsFull: inventoryIsFull, // Add inventory status
            });

            // Notify Game scene to update stats display
            EventBus.emit("stats-changed");
        } else {
            EventBus.emit("show-notification", "Not enough coins!");
        }
    }

    private handlePurchaseAttempt(data: {
        itemId: string;
        itemType: "relic" | "consumable";
    }) {
        const currentCoins = this.registry.get("coins") as number;
        let itemCost = 0;
        let canPurchase = false;
        let purchaseMessage = "";
        let notification = "";

        if (data.itemType === "relic") {
            const relic = RELICS[data.itemId];
            if (!relic) {
                console.error(`Invalid relic ID: ${data.itemId}`);
                return;
            }

            itemCost = relic.cost;
            const currentRelics = this.registry.get("relics") as string[];

            if (currentCoins >= itemCost) {
                this.registry.set("coins", currentCoins - itemCost);
                this.registry.set("relics", [...currentRelics, data.itemId]);
                canPurchase = true;
                purchaseMessage = `Purchased Relic: ${relic.name}`;
                notification = "Relic Purchased!";
                this.scene.sound.play("buy", { volume: 0.5 });
                this.applyRelicEffect(data.itemId); // Apply effect immediately
                EventBus.emit("relics-changed");
            } else {
                purchaseMessage = "Not enough coins!";
                notification = "Not enough coins!";
            }
        } else if (data.itemType === "consumable") {
            const consumable = CONSUMABLES[data.itemId];
            if (!consumable) {
                console.error(`Invalid consumable ID: ${data.itemId}`);
                return;
            }

            itemCost = consumable.cost;
            const currentConsumables = this.registry.get(
                "consumables"
            ) as string[];

            if (currentConsumables.length >= MAX_CONSUMABLES) {
                purchaseMessage = "Consumable inventory full!";
                notification = "Inventory Full!";
            } else if (currentCoins >= itemCost) {
                this.registry.set("coins", currentCoins - itemCost);
                this.registry.set("consumables", [
                    ...currentConsumables,
                    data.itemId,
                ]);
                canPurchase = true;
                purchaseMessage = `Purchased Consumable: ${consumable.name}`;
                notification = "Consumable Purchased!";
                this.scene.sound.play("buy", { volume: 0.5 });
            } else {
                purchaseMessage = "Not enough coins!";
                notification = "Not enough coins!";
            }
        }

        EventBus.emit("show-notification", notification);

        if (canPurchase) {
            // Notify Game scene to update stats display
            EventBus.emit("stats-changed");
            // Notify UI that item was purchased to potentially remove it from view
            EventBus.emit("item-purchased", {
                itemId: data.itemId,
                itemType: data.itemType,
            });
        }
    }

    // This function might need access to the player object or other game elements
    // depending on the complexity of relic effects. Keep it here for now.
    private applyRelicEffect(relicId: string) {
        const relic = RELICS[relicId];
        if (!relic) return;

        // Example: Symbiotic Worm
        if (relicId === "symbiotic-worm") {
            const currentMaxLives = this.registry.get("maxLives") || 3;
            const currentLives = this.registry.get("lives");
            this.registry.set("maxLives", currentMaxLives + 1);
            // Heal only if below the new max lives
            this.registry.set(
                "lives",
                Math.min(currentLives + 1, currentMaxLives + 1)
            );
            // Notify Game scene to update stats display
            EventBus.emit("stats-changed");
        }

        // Add logic for other relics here
        // e.g., if (relicId === 'steel-toed-boots') { EventBus.emit('increase-dig-depth'); }
        // e.g., if (relicId === 'runner-s-wraps') { EventBus.emit('increase-move-speed'); }
        // These events would be listened to by the Player or relevant entity/manager.
    }

    public destroy() {
        this.removeEventListeners();
    }
}

