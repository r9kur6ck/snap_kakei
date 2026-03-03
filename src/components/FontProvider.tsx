'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type FontContextType = {
    font: string;
    setFont: (font: string) => void;
};

const FontContext = createContext<FontContextType>({ font: 'mplus', setFont: () => { } });

export function FontProvider({ children }: { children: React.ReactNode }) {
    const [font, setFontState] = useState('mplus');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('app-font');
        if (stored) {
            setFontState(stored);
            document.documentElement.setAttribute('data-font', stored);
        } else {
            document.documentElement.setAttribute('data-font', 'mplus');
        }
        setMounted(true);
    }, []);

    const setFont = (newFont: string) => {
        setFontState(newFont);
        localStorage.setItem('app-font', newFont);
        document.documentElement.setAttribute('data-font', newFont);
    };

    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <FontContext.Provider value={{ font, setFont }}>
            {children}
        </FontContext.Provider>
    );
}

export const useFont = () => useContext(FontContext);
