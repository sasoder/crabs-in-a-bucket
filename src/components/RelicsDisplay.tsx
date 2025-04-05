import React from "react";

interface RelicsDisplayProps {
    relics: string[];
}

export function RelicsDisplay({ relics }: RelicsDisplayProps) {
    return (
        <div className="relics mt-2 text-center">
            <h4 className="font-semibold text-sm text-gray-300 uppercase tracking-wider">
                Relics
            </h4>
            <ul className="list-none text-xs text-white flex flex-wrap justify-center gap-2 max-w-[200px]">
                {relics.map((relic, i) => (
                    <li
                        key={i}
                        className="px-2 py-1 bg-gray-800 bg-opacity-70 rounded"
                    >
                        {relic}
                    </li>
                ))}
            </ul>
        </div>
    );
}

