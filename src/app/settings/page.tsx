'use client';

import React, { useEffect, useState } from 'react';
import { Download, Palette, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useWallet } from '@/components/WalletProvider';
import { useTheme } from 'next-themes';
import { AccordionItem } from '@/components/Accordion';

interface Category {
    id: string;
    name: string;
    color: string | null;
}

export default function SettingsPage() {
    const { activeWallet, refreshWallet } = useWallet();
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 予算設定
    const [monthlyBudget, setMonthlyBudget] = useState('150000');
    const [billingStartDate, setBillingStartDate] = useState('1');
    const [budgetSaved, setBudgetSaved] = useState(false);

    // テーマ設定
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // データ取得
    useEffect(() => {
        if (!activeWallet) return;
        const fetchData = async () => {
            try {
                const { data: cats } = await supabase
                    .from('categories')
                    .select('id, name, color')
                    .eq('wallet_id', activeWallet?.id || '')
                    .eq('target_type', 'transaction') as { data: Category[] | null; error: any };
                setCategories(cats || []);
            } catch (err) {
                console.error('Failed to load data:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
        setMounted(true);
    }, [activeWallet]);

    // 予算の読み込み (walletから)
    useEffect(() => {
        if (activeWallet) {
            setMonthlyBudget(String(activeWallet.monthly_budget || 150000));
            setBillingStartDate(String(activeWallet.billing_start_date || 1));
        }
    }, [activeWallet]);

    // 予算の保存 (walletに保存)
    const handleSaveBudget = async () => {
        if (!activeWallet) return;
        try {
            const { error } = await (supabase.from('wallets') as any)
                .update({ monthly_budget: Number(monthlyBudget), billing_start_date: Number(billingStartDate) })
                .eq('id', activeWallet.id);
            if (error) throw error;
            await refreshWallet();
            setBudgetSaved(true);
            setTimeout(() => setBudgetSaved(false), 2000);
        } catch (err) {
            console.error('Budget save failed:', err);
            alert('予算の保存に失敗しました');
        }
    };

    // CSVエクスポート
    const handleExportCSV = async () => {
        try {
            const { data: txs, error } = await supabase
                .from('transactions')
                .select('date, store_name, item_name, amount, category_id, memo')
                .eq('wallet_id', activeWallet?.id || '')
                .order('date', { ascending: false }) as { data: any[] | null; error: any };
            if (error) throw error;
            if (!txs || txs.length === 0) {
                alert('エクスポートするデータがありません');
                return;
            }
            const header = '日付,店舗,品名,金額,カテゴリ,メモ\n';
            const rows = txs.map(tx => {
                const catName = categories.find(c => c.id === tx.category_id)?.name || '未分類';
                return `${tx.date},${tx.store_name || ''},${tx.item_name || ''},${tx.amount},${catName},${tx.memo || ''}`;
            }).join('\n');
            const bom = '\uFEFF';
            const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `snap_kakei_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('CSV export failed:', err);
            alert('CSVエクスポートに失敗しました');
        }
    };

    return (
        <div className="p-6 pt-10 flex flex-col animate-fade-in relative">

            {isLoading && (
                <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            )}

            {/* ヘッダー */}
            <header className="mb-6">
                <h1 className="text-xl font-bold text-gray-800">⚙️ 設定</h1>
                <p className="text-xs text-gray-400 mt-1">アプリの各種設定を行います</p>
            </header>

            {/* 予算設定 */}
            <AccordionItem title={<><Settings size={18} className="text-emerald-500" /> 月間予算設定</>} defaultOpen={true}>
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 flex-1 mt-2">
                        <span className="pl-3 text-gray-400 text-sm">¥</span>
                        <input
                            type="number"
                            inputMode="numeric"
                            value={monthlyBudget}
                            onChange={e => setMonthlyBudget(e.target.value)}
                            className="w-full px-2 py-2.5 text-sm bg-transparent outline-none font-bold"
                        />
                    </div>
                </div>

                <div className="mt-4">
                    <label className="text-xs font-semibold text-gray-600 mb-1.5 block">📅 集計開始日</label>
                    <select
                        value={billingStartDate}
                        onChange={e => setBillingStartDate(e.target.value)}
                        className="w-full bg-gray-50 rounded-lg px-3 py-2.5 text-sm outline-none border border-gray-200 appearance-none cursor-pointer font-bold"
                    >
                        {Array.from({ length: 28 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>毎月 {i + 1}日 から集計</option>
                        ))}
                    </select>
                    <p className="text-[10px] text-gray-400 mt-1.5">給料日などに合わせて集計期間の開始日を設定できます（1日＝従来通り月初〜月末）</p>
                </div>

                <button
                    onClick={handleSaveBudget}
                    className={`w-full mt-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${budgetSaved
                        ? 'bg-green-100 text-green-600'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                >
                    {budgetSaved ? '✓ 保存済' : '設定を保存'}
                </button>
            </AccordionItem>

            {/* テーマ設定 */}
            {mounted && (
                <AccordionItem title={<><Palette size={18} className="text-pink-500" /> テーマ設定</>}>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <button
                            onClick={() => setTheme('light')}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-blue-200'}`}
                        >
                            <div className="w-6 h-6 rounded-full mb-2" style={{ backgroundColor: '#3b82f6' }}></div>
                            <span className={`text-xs font-semibold ${theme === 'light' ? 'text-blue-700' : 'text-gray-600'}`}>ブルー (標準)</span>
                        </button>

                        <button
                            onClick={() => setTheme('nature')}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${theme === 'nature' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 bg-white hover:border-emerald-200'}`}
                        >
                            <div className="w-6 h-6 rounded-full mb-2" style={{ backgroundColor: '#10b981' }}></div>
                            <span className={`text-xs font-semibold ${theme === 'nature' ? 'text-emerald-700' : 'text-gray-600'}`}>ネイチャー</span>
                        </button>

                        <button
                            onClick={() => setTheme('sakura')}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${theme === 'sakura' ? 'border-rose-400 bg-rose-50' : 'border-gray-100 bg-white hover:border-rose-200'}`}
                        >
                            <div className="w-6 h-6 rounded-full mb-2" style={{ backgroundColor: '#fb7185' }}></div>
                            <span className={`text-xs font-semibold ${theme === 'sakura' ? 'text-rose-700' : 'text-gray-600'}`}>サクラ</span>
                        </button>

                        <button
                            onClick={() => setTheme('monochrome')}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${theme === 'monochrome' ? 'border-gray-600 bg-gray-100' : 'border-gray-100 bg-white hover:border-gray-300'}`}
                        >
                            <div className="w-6 h-6 rounded-full mb-2" style={{ backgroundColor: '#4b5563' }}></div>
                            <span className={`text-xs font-semibold ${theme === 'monochrome' ? 'text-gray-800' : 'text-gray-600'}`}>モノクロ</span>
                        </button>
                    </div>
                </AccordionItem>
            )}

            {/* CSVエクスポート */}
            <AccordionItem title={<><Download size={18} className="text-amber-500" /> データ管理</>}>
                <div className="mt-2">
                    <button
                        onClick={handleExportCSV}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-semibold transition-colors border border-gray-200"
                    >
                        <Download size={16} />
                        CSVエクスポート
                    </button>
                    <p className="text-[10px] text-gray-400 mt-2">全取引データをCSVファイルとしてダウンロードできます</p>
                </div>
            </AccordionItem>
        </div>
    );
}
