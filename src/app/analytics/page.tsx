'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, getDaysInMonth, differenceInDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Receipt, TrendingUp, TrendingDown, CalendarDays, Wallet, Trophy, ArrowUpRight, ArrowDownRight, Pencil, Trash2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import CategoryPieChart from '@/components/charts/CategoryPieChart';
import DailyBarChart from '@/components/charts/DailyBarChart';
import MonthlyLineChart from '@/components/charts/MonthlyLineChart';
import { useWallet } from '@/components/WalletProvider';

interface Transaction {
    id: string;
    amount: number;
    date: string;
    store_name: string | null;
    item_name: string | null;
    category_id: string | null;
    memo: string | null;
}

interface Category {
    id: string;
    name: string;
    color: string | null;
}

export default function AnalyticsPage() {
    const { activeWallet } = useWallet();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [prevMonthTotal, setPrevMonthTotal] = useState<number>(0);
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoriesData, setCategoriesData] = useState<{ name: string; value: number; color: string }[]>([]);
    const [totalSpend, setTotalSpend] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
    const [yearlyData, setYearlyData] = useState<{ month: string; amount: number }[]>([]);
    const [editingTx, setEditingTx] = useState<string | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editItemName, setEditItemName] = useState('');
    const [editCategoryId, setEditCategoryId] = useState('');
    const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);

    const monthStr = format(currentMonth, 'yyyy年 M月', { locale: ja });

    const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
    const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));

    useEffect(() => {
        if (!activeWallet) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const startPath = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
                const endPath = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

                // 前月のデータも取得（比較用）
                const prevMonth = subMonths(currentMonth, 1);
                const prevStartPath = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
                const prevEndPath = format(endOfMonth(prevMonth), 'yyyy-MM-dd');

                // カテゴリ一覧
                const { data: cats, error: catError } = await supabase
                    .from('categories')
                    .select('id, name, color')
                    .eq('wallet_id', activeWallet?.id || '') as { data: Category[] | null; error: any };
                if (catError) throw catError;
                setCategories(cats || []);

                // 今月の支出
                const { data: txs, error: txError } = await supabase
                    .from('transactions')
                    .select('id, amount, date, store_name, item_name, category_id, memo')
                    .eq('wallet_id', activeWallet?.id || '')
                    .gte('date', startPath)
                    .lte('date', endPath)
                    .order('date', { ascending: false }) as { data: Transaction[] | null; error: any };
                if (txError) throw txError;
                setTransactions(txs || []);

                // 前月の支出合計
                const { data: prevTxs, error: prevTxError } = await supabase
                    .from('transactions')
                    .select('amount')
                    .eq('wallet_id', activeWallet?.id || '')
                    .gte('date', prevStartPath)
                    .lte('date', prevEndPath) as { data: { amount: number }[] | null; error: any };
                if (prevTxError) throw prevTxError;
                const prevTotal = (prevTxs || []).reduce((sum, tx) => sum + Number(tx.amount), 0);
                setPrevMonthTotal(prevTotal);

                // 集計
                let total = 0;
                const categoryTotals: Record<string, number> = {};
                txs?.forEach(tx => {
                    total += Number(tx.amount);
                    if (tx.category_id) {
                        categoryTotals[tx.category_id] = (categoryTotals[tx.category_id] || 0) + Number(tx.amount);
                    }
                });
                setTotalSpend(total);

                const chartData = (cats || []).map(c => ({
                    name: c.name,
                    color: c.color || '#cccccc',
                    value: categoryTotals[c.id] || 0,
                })).filter(c => c.value > 0);
                setCategoriesData(chartData);

            } catch (err) {
                console.error('Failed to fetch analytics data:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [currentMonth, activeWallet]);

    // 年間データ取得
    useEffect(() => {
        if (viewMode !== 'yearly') return;
        const fetchYearly = async () => {
            const year = currentMonth.getFullYear();
            const promises = Array.from({ length: 12 }, async (_, i) => {
                const m = new Date(year, i, 1);
                const s = format(startOfMonth(m), 'yyyy-MM-dd');
                const e = format(endOfMonth(m), 'yyyy-MM-dd');
                const { data } = await supabase
                    .from('transactions')
                    .select('amount')
                    .eq('wallet_id', activeWallet?.id || '')
                    .gte('date', s)
                    .lte('date', e) as { data: { amount: number }[] | null };
                return {
                    month: `${i + 1}月`,
                    amount: (data || []).reduce((sum, tx) => sum + Number(tx.amount), 0),
                };
            });
            const results = await Promise.all(promises);
            setYearlyData(results);
        };
        fetchYearly();
    }, [viewMode, currentMonth, activeWallet]);

    // 取引の削除
    const handleDeleteTx = async (id: string) => {
        try {
            const { error } = await supabase.from('transactions').delete().eq('id', id);
            if (error) throw error;
            setTransactions(prev => prev.filter(tx => tx.id !== id));
            setConfirmDeleteTxId(null);
        } catch (err: any) {
            console.error('Delete failed:', err?.message, JSON.stringify(err));
            alert(`削除に失敗: ${err?.message || '不明なエラー'}`);
        }
    };

    // 取引の編集開始
    const handleEditTx = (tx: Transaction) => {
        setEditingTx(tx.id);
        setEditAmount(String(tx.amount));
        setEditItemName(tx.item_name || '');
        setEditCategoryId(tx.category_id || '');
    };

    const handleSaveEdit = async (id: string) => {
        const { error } = await (supabase
            .from('transactions') as any)
            .update({
                amount: Number(editAmount),
                item_name: editItemName || null,
                category_id: editCategoryId || null,
            })
            .eq('id', id);
        if (!error) {
            setTransactions(prev => prev.map(tx =>
                tx.id === id ? { ...tx, amount: Number(editAmount), item_name: editItemName, category_id: editCategoryId } : tx
            ));
        }
        setEditingTx(null);
    };

    // ======== カテゴリ絞り込み ========
    const filteredTransactions = useMemo(() => {
        if (!selectedCategoryId) return transactions;
        return transactions.filter(tx => tx.category_id === selectedCategoryId);
    }, [transactions, selectedCategoryId]);

    const filteredTotal = useMemo(() => {
        return filteredTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
    }, [filteredTransactions]);

    // ======== 分析用の算出ロジック ========

    // 日別支出データ
    const dailyData = useMemo(() => {
        const daysInMonth = getDaysInMonth(currentMonth);
        const dailyMap: Record<number, number> = {};
        filteredTransactions.forEach(tx => {
            const day = parseInt(tx.date.split('-')[2], 10);
            dailyMap[day] = (dailyMap[day] || 0) + Number(tx.amount);
        });
        return Array.from({ length: daysInMonth }, (_, i) => ({
            day: String(i + 1),
            amount: dailyMap[i + 1] || 0,
        }));
    }, [filteredTransactions, currentMonth]);

    // 1日あたりの平均支出
    const dailyAverage = useMemo(() => {
        const daysWithSpend = dailyData.filter(d => d.amount > 0).length;
        return daysWithSpend > 0 ? Math.round(filteredTotal / daysWithSpend) : 0;
    }, [dailyData, filteredTotal]);

    // 最も支出が多い日
    const highestDay = useMemo(() => {
        const sorted = [...dailyData].sort((a, b) => b.amount - a.amount);
        return sorted[0] || { day: '-', amount: 0 };
    }, [dailyData]);

    // 支出TOP5ランキング 
    const topItems = useMemo(() => {
        return [...filteredTransactions]
            .sort((a, b) => Number(b.amount) - Number(a.amount))
            .slice(0, 5);
    }, [filteredTransactions]);

    // 前月比
    const displayTotal = selectedCategoryId ? filteredTotal : totalSpend;
    const monthDiff = displayTotal - prevMonthTotal;
    const monthDiffPercent = prevMonthTotal > 0
        ? Math.round((monthDiff / prevMonthTotal) * 100)
        : (displayTotal > 0 ? 100 : 0);

    // 今月の残り日数と予測
    const today = new Date();
    const isCurrentMonth = format(currentMonth, 'yyyy-MM') === format(today, 'yyyy-MM');
    const daysElapsed = isCurrentMonth ? today.getDate() : getDaysInMonth(currentMonth);
    const daysInMonth = getDaysInMonth(currentMonth);
    const projectedSpend = isCurrentMonth && daysElapsed > 0
        ? Math.round((displayTotal / daysElapsed) * daysInMonth)
        : displayTotal;

    // 選択中のカテゴリ名取得
    const selectedCategoryName = selectedCategoryId
        ? categories.find(c => c.id === selectedCategoryId)?.name || ''
        : '';

    // ヘルパー
    const getCategoryName = (categoryId: string | null): string => {
        if (!categoryId) return '未分類';
        const cat = categories.find(c => c.id === categoryId);
        return cat ? cat.name : '未分類';
    };

    const getCategoryColor = (categoryId: string | null): string => {
        if (!categoryId) return '#cccccc';
        const cat = categories.find(c => c.id === categoryId);
        return cat?.color || '#cccccc';
    };

    return (
        <div className="p-6 pt-10 flex flex-col gap-5 animate-fade-in relative">

            {isLoading && (
                <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            )}

            {/* ヘッダー：月切り替え */}
            <header className="flex items-center justify-between">
                <button onClick={handlePrevMonth} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                    <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <h1 className="text-xl font-bold text-gray-800">{monthStr}</h1>
                <button onClick={handleNextMonth} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
                    <ChevronRight size={20} className="text-gray-600" />
                </button>
            </header>

            {/* タブ切替 */}
            <div className="flex bg-gray-100 rounded-xl p-1">
                <button
                    onClick={() => setViewMode('monthly')}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${viewMode === 'monthly' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
                        }`}
                >
                    月別
                </button>
                <button
                    onClick={() => setViewMode('yearly')}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${viewMode === 'yearly' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
                        }`}
                >
                    年間
                </button>
            </div>

            {/* 年間ビュー */}
            {viewMode === 'yearly' ? (
                <>
                    <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                        <h2 className="text-sm font-bold text-gray-800 mb-3">📈 {currentMonth.getFullYear()}年 月別支出推移</h2>
                        <MonthlyLineChart data={yearlyData} />
                        <div className="mt-3 flex justify-between text-[10px] text-gray-400">
                            <span>年間合計: ¥{yearlyData.reduce((s, d) => s + d.amount, 0).toLocaleString()}</span>
                            <span>月平均: ¥{Math.round(yearlyData.reduce((s, d) => s + d.amount, 0) / 12).toLocaleString()}</span>
                        </div>
                    </section>
                </>
            ) : (
                <>

                    {/* 合計金額 + 前月比 */}
                    <section className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-semibold opacity-80">
                                    {selectedCategoryId ? `${selectedCategoryName} の支出` : '合計支出'}
                                </p>
                                <p className="text-3xl font-extrabold mt-1">¥{displayTotal.toLocaleString()}</p>
                                <p className="text-xs opacity-70 mt-1">{filteredTransactions.length} 件の取引</p>
                            </div>
                            {!selectedCategoryId && (
                                <div className="bg-white/15 rounded-xl px-3 py-2 text-right backdrop-blur-sm">
                                    <p className="text-[10px] opacity-70">前月比</p>
                                    <div className="flex items-center gap-1">
                                        {monthDiff >= 0 ? (
                                            <ArrowUpRight size={14} className="text-red-300" />
                                        ) : (
                                            <ArrowDownRight size={14} className="text-green-300" />
                                        )}
                                        <span className={`text-sm font-bold ${monthDiff >= 0 ? 'text-red-200' : 'text-green-200'}`}>
                                            {monthDiff >= 0 ? '+' : ''}{monthDiffPercent}%
                                        </span>
                                    </div>
                                    <p className="text-[10px] opacity-60 mt-0.5">
                                        {monthDiff >= 0 ? '+' : ''}¥{monthDiff.toLocaleString()}
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* カテゴリフィルター */}
                    {categories.length > 0 && (
                        <section className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                            <button
                                onClick={() => setSelectedCategoryId(null)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${selectedCategoryId === null
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                            >
                                すべて
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(
                                        selectedCategoryId === cat.id ? null : cat.id
                                    )}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${selectedCategoryId === cat.id
                                        ? 'text-white shadow-md'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                    style={selectedCategoryId === cat.id ? { backgroundColor: cat.color || '#6366f1' } : {}}
                                >
                                    <span
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: cat.color || '#ccc' }}
                                    />
                                    {cat.name}
                                </button>
                            ))}
                        </section>
                    )}

                    {/* サマリー統計カード */}
                    <section className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-2xl p-3 shadow-[0_4px_15px_rgb(0,0,0,0.03)] border border-gray-100 text-center">
                            <Wallet size={18} className="mx-auto text-blue-500 mb-1" />
                            <p className="text-[10px] text-gray-400 font-medium">1日平均</p>
                            <p className="text-sm font-bold text-gray-800">¥{dailyAverage.toLocaleString()}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-3 shadow-[0_4px_15px_rgb(0,0,0,0.03)] border border-gray-100 text-center">
                            <CalendarDays size={18} className="mx-auto text-indigo-500 mb-1" />
                            <p className="text-[10px] text-gray-400 font-medium">最高額日</p>
                            <p className="text-sm font-bold text-gray-800">{highestDay.day}日</p>
                            <p className="text-[10px] text-gray-400">¥{highestDay.amount.toLocaleString()}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-3 shadow-[0_4px_15px_rgb(0,0,0,0.03)] border border-gray-100 text-center">
                            {isCurrentMonth ? (
                                <>
                                    <TrendingUp size={18} className="mx-auto text-amber-500 mb-1" />
                                    <p className="text-[10px] text-gray-400 font-medium">月末予測</p>
                                    <p className="text-sm font-bold text-gray-800">¥{projectedSpend.toLocaleString()}</p>
                                </>
                            ) : (
                                <>
                                    <TrendingDown size={18} className="mx-auto text-emerald-500 mb-1" />
                                    <p className="text-[10px] text-gray-400 font-medium">前月合計</p>
                                    <p className="text-sm font-bold text-gray-800">¥{prevMonthTotal.toLocaleString()}</p>
                                </>
                            )}
                        </div>
                    </section>

                    {/* 日別支出チャート */}
                    <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                        <h2 className="text-sm font-bold text-gray-800 mb-3">📊 日別支出</h2>
                        <DailyBarChart data={dailyData} />
                    </section>

                    {/* カテゴリ別チャート */}
                    {categoriesData.length > 0 && (
                        <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                            <h2 className="text-sm font-bold text-gray-800 mb-2">🏷️ カテゴリ別</h2>
                            <CategoryPieChart data={categoriesData} />
                            <div className="mt-4 flex flex-col gap-2">
                                {[...categoriesData]
                                    .sort((a, b) => b.value - a.value)
                                    .map(cat => {
                                        const percent = Math.round((cat.value / totalSpend) * 100);
                                        return (
                                            <div key={cat.name} className="flex items-center gap-3">
                                                <div
                                                    className="w-3 h-3 rounded-full shadow-sm flex-shrink-0"
                                                    style={{ backgroundColor: cat.color }}
                                                />
                                                <span className="text-xs text-gray-600 font-medium flex-1 truncate">{cat.name}</span>
                                                <div className="flex-1">
                                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                        <div
                                                            className="h-1.5 rounded-full transition-all"
                                                            style={{ width: `${percent}%`, backgroundColor: cat.color }}
                                                        />
                                                    </div>
                                                </div>
                                                <span className="text-xs text-gray-500 w-8 text-right">{percent}%</span>
                                                <span className="text-xs text-gray-800 font-bold min-w-[60px] text-right">
                                                    ¥{cat.value.toLocaleString()}
                                                </span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </section>
                    )}

                    {/* 支出TOP5ランキング */}
                    {topItems.length > 0 && (
                        <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                            <h2 className="text-sm font-bold text-gray-800 mb-3">🏆 支出ランキング TOP5</h2>
                            <div className="flex flex-col gap-2">
                                {topItems.map((tx, i) => (
                                    <div
                                        key={tx.id}
                                        className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50"
                                    >
                                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold
                                    ${i === 0 ? 'bg-amber-100 text-amber-600' :
                                                i === 1 ? 'bg-gray-200 text-gray-600' :
                                                    i === 2 ? 'bg-orange-100 text-orange-600' :
                                                        'bg-gray-100 text-gray-400'}`}
                                        >
                                            {i + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 truncate">
                                                {tx.item_name || tx.store_name || '不明'}
                                            </p>
                                            <p className="text-[10px] text-gray-400">
                                                {tx.date} · {getCategoryName(tx.category_id)}
                                            </p>
                                        </div>
                                        <span className="text-sm font-bold text-gray-800">
                                            ¥{Number(tx.amount).toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 取引一覧 */}
                    <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                        <h2 className="text-sm font-bold text-gray-800 mb-3">📋 取引一覧</h2>

                        {transactions.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <Receipt size={40} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm">この月の取引はありません</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {filteredTransactions.map(tx => (
                                    <div
                                        key={tx.id}
                                        className={`rounded-xl transition-colors group ${editingTx === tx.id ? 'bg-blue-50 border border-blue-200 p-3' : 'bg-gray-50 hover:bg-gray-100 p-3'
                                            }`}
                                    >
                                        {editingTx === tx.id ? (
                                            <div className="flex flex-col gap-2">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        type="text"
                                                        value={editItemName}
                                                        onChange={e => setEditItemName(e.target.value)}
                                                        placeholder="品名"
                                                        className="bg-white rounded-lg px-2 py-1.5 text-sm border border-blue-200 outline-none"
                                                        autoFocus
                                                    />
                                                    <div className="flex items-center bg-white rounded-lg border border-blue-200">
                                                        <span className="pl-2 text-gray-400 text-xs">¥</span>
                                                        <input
                                                            type="number"
                                                            value={editAmount}
                                                            onChange={e => setEditAmount(e.target.value)}
                                                            className="w-full px-1 py-1.5 text-sm bg-transparent outline-none"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    <select
                                                        value={editCategoryId}
                                                        onChange={e => setEditCategoryId(e.target.value)}
                                                        className="flex-1 bg-white rounded-lg px-2 py-1.5 text-sm border border-blue-200 outline-none appearance-none"
                                                    >
                                                        {categories.map(cat => (
                                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                        ))}
                                                    </select>
                                                    <button onClick={() => handleSaveEdit(tx.id)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"><Check size={12} className="inline mr-0.5" />保存</button>
                                                    <button onClick={() => setEditingTx(null)} className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-300">×</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div
                                                        className="w-2 h-8 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: getCategoryColor(tx.category_id) }}
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-gray-800 truncate">
                                                            {tx.item_name || tx.store_name || '不明'}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400">
                                                            {tx.date} {tx.store_name && tx.item_name ? `· ${tx.store_name}` : ''} · {getCategoryName(tx.category_id)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-sm font-bold text-gray-800">
                                                        ¥{Number(tx.amount).toLocaleString()}
                                                    </span>
                                                    <button
                                                        onClick={() => handleEditTx(tx)}
                                                        className="text-gray-400 hover:text-blue-500 transition-colors"
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                    {confirmDeleteTxId === tx.id ? (
                                                        <>
                                                            <button
                                                                onClick={() => handleDeleteTx(tx.id)}
                                                                className="px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold hover:bg-red-600"
                                                            >
                                                                削除
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmDeleteTxId(null)}
                                                                className="px-2 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px] font-bold hover:bg-gray-300"
                                                            >
                                                                やめる
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmDeleteTxId(tx.id)}
                                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                </> /* 月別ビューの閉じタグ */
            )}

        </div>
    );
}
