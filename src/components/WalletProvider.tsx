'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/AuthProvider';

interface Wallet {
    id: string;
    name: string;
    owner_id: string;
    monthly_budget: number;
}

interface WalletContextType {
    wallets: Wallet[];
    activeWallet: Wallet | null;
    isLoading: boolean;
    setActiveWalletId: (id: string) => void;
}

const WalletContext = createContext<WalletContextType>({
    wallets: [],
    activeWallet: null,
    isLoading: true,
    setActiveWalletId: () => { },
});

export const useWallet = () => useContext(WalletContext);

export default function WalletProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [activeWalletId, setActiveWalletIdState] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const initializedUserIdRef = useRef<string | null>(null);

    // ウォレット一覧の取得
    useEffect(() => {
        if (!user) {
            setWallets([]);
            setActiveWalletIdState(null);
            setIsLoading(false);
            initializedUserIdRef.current = null;
            return;
        }

        // 同じユーザーで既に初期化済みならスキップ
        if (initializedUserIdRef.current === user.id) {
            return;
        }
        initializedUserIdRef.current = user.id;

        const fetchWallets = async () => {
            try {
                const initRes = await fetch('/api/init-wallet', { method: 'POST' });
                if (!initRes.ok) {
                    console.error('Wallet init failed');
                    initializedUserIdRef.current = null; // 失敗時はリトライ可能に
                    setIsLoading(false);
                    return;
                }

                const { wallet } = await initRes.json();
                if (!wallet) {
                    setIsLoading(false);
                    return;
                }

                const fetchedWallets = [wallet] as Wallet[];
                setWallets(fetchedWallets);

                const saved = localStorage.getItem(`snap_kakei_active_wallet_${user.id}`);
                if (saved && fetchedWallets.some(w => w.id === saved)) {
                    setActiveWalletIdState(saved);
                } else {
                    setActiveWalletIdState(fetchedWallets[0].id);
                }
            } catch (err) {
                console.error('Failed to fetch wallets:', err);
                initializedUserIdRef.current = null; // 失敗時はリトライ可能に
            } finally {
                setIsLoading(false);
            }
        };

        fetchWallets();
    }, [user]);

    const setActiveWalletId = (id: string) => {
        setActiveWalletIdState(id);
        if (user) {
            localStorage.setItem(`snap_kakei_active_wallet_${user.id}`, id);
        }
    };

    const activeWallet = wallets.find(w => w.id === activeWalletId) || null;

    return (
        <WalletContext.Provider value={{ wallets, activeWallet, isLoading, setActiveWalletId }}>
            {children}
        </WalletContext.Provider>
    );
}
