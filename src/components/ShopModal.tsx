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

interface ShopModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ShopModal({ isOpen, onClose }: ShopModalProps) {
    const handleClose = () => {
        EventBus.emit("close-shop"); // Tell Phaser the shop is closing
        onClose(); // Update React state
    };

    return (
        <AlertDialog
            open={isOpen}
            onOpenChange={(open: boolean) => !open && handleClose()}
        >
            <AlertDialogContent className="sm:max-w-[425px]">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-2xl font-bold text-black">
                        A magical shop appears!
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Click on an item to purchase it.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-4 py-4">
                    {/* TODO: Add Shop Items Here */}
                    <p>Shop items will appear here...</p>
                </div>
                <AlertDialogFooter>
                    <Button type="button" onClick={handleClose}>
                        Close
                    </Button>
                    {/* TODO: Add purchase logic */}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

