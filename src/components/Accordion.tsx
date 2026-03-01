'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface AccordionItemProps {
    title: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

export function AccordionItem({ title, children, defaultOpen = false }: AccordionItemProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-5 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-left"
            >
                <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                    {title}
                </div>
                {isOpen ? (
                    <ChevronUp size={18} className="text-gray-400" />
                ) : (
                    <ChevronDown size={18} className="text-gray-400" />
                )}
            </button>
            <div
                className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
                    }`}
            >
                <div className="p-5 pt-0 border-t border-gray-50">
                    {children}
                </div>
            </div>
        </div>
    );
}
