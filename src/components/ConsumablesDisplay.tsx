import React from "react";

interface ConsumablesDisplayProps {
    consumables: string[];
}

export function ConsumablesDisplay({ consumables }: ConsumablesDisplayProps) {
    return (
        <div className="consumables mt-2 text-right">
            <h4 className="font-semibold text-sm text-gray-300 uppercase tracking-wider">
                Consumables
            </h4>
            <ul className="list-none text-xs text-white flex flex-col items-end gap-1">
                {consumables.map((item, i) => (
                    <li
                        key={i}
                        className="px-2 py-1 bg-gray-800 bg-opacity-70 rounded"
                    >
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}

