'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { format, getDaysInMonth, differenceInDays, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Receipt, TrendingUp, TrendingDown, CalendarDays, Wallet, Trophy, ArrowUpRight, ArrowDownRight, Pencil, Trash2, Check, Home, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import CategoryPieChart from '@/components/charts/CategoryPieChart';
import DailyBarChart from '@/components/charts/DailyBarChart';
import MonthlyLineChart from '@/components/charts/MonthlyLineChart';
import { useWallet } from '@/components/WalletProvider';
import { getBillingPeriod, getBillingPeriodLabel } from '@/utils/dateUtils';

interface Transaction {
    id: string;
    amount: number;
    date: string;
    store_name: string | null;
    item_name: string | null;
    category_id: string | null;
    memo: string | null;
}

interface FixedCost {
    id: string;
    name: string;
    amount: number;
    date_of_month: number;
    category_id: string | null;
}

interface Category {
    id: string;
    name: string;
    color: string | null;
    target_type?: string;
}

export default function AnalyticsPage() {
    const { activeWallet } = useWallet();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
    const [prevMonthTotal, setPrevMonthTotal] = useState<number>(0);
    const [categories, setCategories] = useState<Category[]>([]);
    const [fixedCostCategories, setFixedCostCategories] = useState<Category[]>([]);
    const [categoriesData, setCategoriesData] = useState<{ name: string; value: number; color: string }[]>([]);
    const [fixedCostCategoriesData, setFixedCostCategoriesData] = useState<{ name: string; value: number; color: string }[]>([]);
    const [totalSpend, setTotalSpend] = useState(0);
    const [fixedCostTotal, setFixedCostTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
    const [yearlyData, setYearlyData] = useState<{ month: string; amount: number }[]>([]);
    const [editingTx, setEditingTx] = useState<string | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editItemName, setEditItemName] = useState('');
    const [editCategoryId, setEditCategoryId] = useState('');
    const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<'variable' | 'fixed'>('variable');

    // 固定費の編集用ステート
    const [editingFixedCostId, setEditingFixedCostId] = useState<string | null>(null);
    const [editFixedCostName, setEditFixedCostName] = useState('');
    const [editFixedCostAmount, setEditFixedCostAmount] = useState('');
    const [editFixedCostDate, setEditFixedCostDate] = useState('1');
    const [editFixedCostCategory, setEditFixedCostCategory] = useState('');
    const [confirmDeleteFixedCostId, setConfirmDeleteFixedCostId] = useState<string | null>(null);

    const billingStartDay = activeWallet?.billing_start_date || 1;
    const period = getBillingPeriod(currentMonth, billingStartDay);
    const monthStr = billingStartDay === 1
        ? format(currentMonth, 'yyyy年 M月', { locale: ja })
        : getBillingPeriodLabel(period.start, period.end);

    const handlePrevMonth = () => setCurrentMonth(prev => {
        const p = getBillingPeriod(prev, billingStartDay);
        return subMonths(p.start, 1);
    });
    const handleNextMonth = () => setCurrentMonth(prev => {
        const p = getBillingPeriod(prev, billingStartDay);
        return addMonths(p.start, 1);
    });

    useEffect(() => {
        if (!activeWallet) return;
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const startPath = period.startPath;
                const endPath = period.endPath;

                // 前期間のデータも取得（比較用）
                const prevPeriod = getBillingPeriod(subMonths(period.start, 1), billingStartDay);
                const prevStartPath = prevPeriod.startPath;
                const prevEndPath = prevPeriod.endPath;

                // 5つのクエリを並列実行
                const [catsResult, fixedCatsResult, txsResult, prevTxsResult, fcResult] = await Promise.all([
                    supabase
                        .from('categories')
                        .select('id, name, color, target_type')
                        .eq('wallet_id', activeWallet?.id || '')
                        .eq('target_type', 'transaction'),
                    supabase
                        .from('categories')
                        .select('id, name, color, target_type')
                        .eq('wallet_id', activeWallet?.id || '')
                        .eq('target_type', 'fixed_cost'),
                    supabase
                        .from('transactions')
                        .select('id, amount, date, store_name, item_name, category_id, memo')
                        .eq('wallet_id', activeWallet?.id || '')
                        .gte('date', startPath)
                        .lte('date', endPath)
                        .order('date', { ascending: false }),
                    supabase
                        .from('transactions')
                        .select('amount')
                        .eq('wallet_id', activeWallet?.id || '')
                        .gte('date', prevStartPath)
                        .lte('date', prevEndPath),
                    supabase
                        .from('fixed_costs')
                        .select('id, name, amount, date_of_month, category_id')
                        .eq('wallet_id', activeWallet?.id || ''),
                ]);

                if (catsResult.error) throw catsResult.error;
                if (fixedCatsResult.error) throw fixedCatsResult.error;
                if (txsResult.error) throw txsResult.error;
                if (prevTxsResult.error) throw prevTxsResult.error;
                if (fcResult.error) throw fcResult.error;

                // クライアント側でも target_type でフィルタ（PostgRESTキャッシュ未反映時の安全策）
                const cats = ((catsResult.data || []) as Category[]).filter(c => !c.target_type || c.target_type === 'transaction');
                const fixedCats = ((fixedCatsResult.data || []) as Category[]).filter(c => c.target_type === 'fixed_cost');
                const txs = txsResult.data as Transaction[];
                const prevTxs = prevTxsResult.data as { amount: number }[];
                const fcs = fcResult.data as FixedCost[];

                setCategories(cats);
                setFixedCostCategories(fixedCats);
                setTransactions(txs || []);
                setFixedCosts(fcs || []);

                const prevTotal = (prevTxs || []).reduce((sum, tx) => sum + Number(tx.amount), 0);
                setPrevMonthTotal(prevTotal);

                // 変動費の集計
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

                // 固定費の集計
                const fcTotal = (fcs || []).reduce((sum, fc) => sum + Number(fc.amount), 0);
                setFixedCostTotal(fcTotal);

                // 固定費のカテゴリ別集計
                const fcCategoryTotals: Record<string, number> = {};
                fcs?.forEach(fc => {
                    if (fc.category_id) {
                        fcCategoryTotals[fc.category_id] = (fcCategoryTotals[fc.category_id] || 0) + Number(fc.amount);
                    }
                });
                const fcChartData = (fixedCats || []).map(c => ({
                    name: c.name,
                    color: c.color || '#cccccc',
                    value: fcCategoryTotals[c.id] || 0,
                })).filter(c => c.value > 0);
                setFixedCostCategoriesData(fcChartData);

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
            const { data: fcs } = await supabase
                .from('fixed_costs')
                .select('amount')
                .eq('wallet_id', activeWallet?.id || '') as { data: { amount: number }[] | null };
            const monthlyFixedTotal = (fcs || []).reduce((sum, fc) => sum + Number(fc.amount), 0);

            const promises = Array.from({ length: 12 }, async (_, i) => {
                const m = new Date(year, i, billingStartDay > 1 ? billingStartDay : 1);
                const mp = getBillingPeriod(m, billingStartDay);
                const { data } = await supabase
                    .from('transactions')
                    .select('amount')
                    .eq('wallet_id', activeWallet?.id || '')
                    .gte('date', mp.startPath)
                    .lte('date', mp.endPath) as { data: { amount: number }[] | null };
                const variableTotal = (data || []).reduce((sum, tx) => sum + Number(tx.amount), 0);
                return {
                    month: `${i + 1}月`,
                    amount: variableTotal + monthlyFixedTotal,
                };
            });
            const results = await Promise.all(promises);
            setYearlyData(results);
        };
        fetchYearly();
    }, [viewMode, currentMonth, activeWallet, billingStartDay]);

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

    // ======== 固定費の編集・削除 ========
    const handleDeleteFixedCost = async (id: string) => {
        try {
            const { error } = await supabase.from('fixed_costs').delete().eq('id', id);
            if (error) throw error;
            setFixedCosts(prev => prev.filter(fc => fc.id !== id));
            setConfirmDeleteFixedCostId(null);
        } catch (err: any) {
            console.error('Delete fixed cost failed:', err?.message);
            alert(`削除に失敗: ${err?.message || '不明なエラー'}`);
        }
    };

    const handleEditFixedCost = (fc: FixedCost) => {
        setEditingFixedCostId(fc.id);
        setEditFixedCostName(fc.name);
        setEditFixedCostAmount(String(fc.amount));
        setEditFixedCostDate(String(fc.date_of_month));
        setEditFixedCostCategory(fc.category_id || '');
    };

    const handleSaveFixedCostEdit = async (id: string) => {
        try {
            const dateNum = Number(editFixedCostDate);
            if (dateNum < 1 || dateNum > 31) {
                alert('日付は1〜31の範囲で入力してください。');
                return;
            }
            const { error } = await (supabase
                .from('fixed_costs') as any)
                .update({
                    name: editFixedCostName,
                    amount: Number(editFixedCostAmount),
                    date_of_month: dateNum,
                    category_id: editFixedCostCategory || null,
                })
                .eq('id', id);
            if (error) throw error;
            setFixedCosts(prev => prev.map(fc =>
                fc.id === id ? {
                    ...fc,
                    name: editFixedCostName,
                    amount: Number(editFixedCostAmount),
                    date_of_month: dateNum,
                    category_id: editFixedCostCategory || null
                } : fc
            ));
            setEditingFixedCostId(null);
        } catch (err: any) {
            alert(`編集に失敗しました: ${err?.message || '不明なエラー'}`);
        }
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

    // 前月比（変動費＋固定費の合計）
    const grandTotal = totalSpend + fixedCostTotal;
    const displayTotal = selectedCategoryId ? filteredTotal : totalSpend;
    const monthDiff = displayTotal - prevMonthTotal;
    const monthDiffPercent = prevMonthTotal > 0
        ? Math.round((monthDiff / prevMonthTotal) * 100)
        : (displayTotal > 0 ? 100 : 0);

    // 今の期間の残り日数と予測
    const today = new Date();
    const isCurrentPeriod = today >= period.start && today <= period.end;
    const daysElapsed = isCurrentPeriod ? differenceInDays(today, period.start) + 1 : differenceInDays(period.end, period.start) + 1;
    const daysInPeriod = differenceInDays(period.end, period.start) + 1;
    const projectedSpend = isCurrentPeriod && daysElapsed > 0
        ? Math.round((displayTotal / daysElapsed) * daysInPeriod)
        : displayTotal;

    // 選択中のカテゴリ名取得
    const selectedCategoryName = selectedCategoryId
        ? categories.find(c => c.id === selectedCategoryId)?.name || ''
        : '';

    // ヘルパー
    const getCategoryName = (categoryId: string | null): string => {
        if (!categoryId) return '未分類';
        const cat = categories.find(c => c.id === categoryId);
        if (cat) return cat.name;
        const fcCat = fixedCostCategories.find(c => c.id === categoryId);
        return fcCat ? fcCat.name : '未分類';
    };

    const getCategoryColor = (categoryId: string | null): string => {
        if (!categoryId) return '#cccccc';
        const cat = categories.find(c => c.id === categoryId);
        if (cat?.color) return cat.color;
        const fcCat = fixedCostCategories.find(c => c.id === categoryId);
        return fcCat?.color || '#cccccc';
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

            {/* タブ切替: 月別 / 年間 */}
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
                        <h2 className="text-sm font-bold text-gray-800 mb-3">📈 {currentMonth.getFullYear()}年 月別支出推移（変動費＋固定費）</h2>
                        <MonthlyLineChart data={yearlyData} />
                        <div className="mt-3 flex justify-between text-[10px] text-gray-400">
                            <span>年間合計: ¥{yearlyData.reduce((s, d) => s + d.amount, 0).toLocaleString()}</span>
                            <span>月平均: ¥{Math.round(yearlyData.reduce((s, d) => s + d.amount, 0) / 12).toLocaleString()}</span>
                        </div>
                    </section>
                </>
            ) : (
                <>

                    {/* ============================================================ */}
                    {/* 総支出サマリー（変動費＋固定費）— 最上部に大きく表示 */}
                    {/* ============================================================ */}
                    <section className="bg-blue-600 rounded-2xl p-5 text-white shadow-lg">
                        <p className="text-xs font-semibold opacity-70">📊 総支出（変動費＋固定費）</p>
                        <p className="text-3xl font-extrabold mt-1">¥{grandTotal.toLocaleString()}</p>
                        <div className="flex gap-6 mt-3">
                            <div>
                                <p className="text-[10px] opacity-50">変動費</p>
                                <p className="text-sm font-bold text-blue-300">¥{totalSpend.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-[10px] opacity-50">固定費</p>
                                <p className="text-sm font-bold text-emerald-300">¥{fixedCostTotal.toLocaleString()}</p>
                            </div>
                            <div className="ml-auto text-right">
                                <p className="text-[10px] opacity-50">取引数</p>
                                <p className="text-sm font-bold">{transactions.length}件 + {fixedCosts.length}件</p>
                            </div>
                        </div>
                    </section>

                    {/* ============================================================ */}
                    {/* セクション切り替えタブ: 変動費 / 固定費 */}
                    {/* ============================================================ */}
                    <div className="flex bg-gray-100 rounded-xl p-1">
                        <button
                            onClick={() => setActiveSection('variable')}
                            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${activeSection === 'variable' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                                }`}
                        >
                            <CreditCard size={14} />
                            変動費
                        </button>
                        <button
                            onClick={() => setActiveSection('fixed')}
                            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${activeSection === 'fixed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'
                                }`}
                        >
                            <Home size={14} />
                            固定費
                        </button>
                    </div>

                    {/* ============================================================ */}
                    {/* 変動費セクション */}
                    {/* ============================================================ */}
                    {activeSection === 'variable' ? (
                        <>
                            {/* 変動費の合計金額 + 前月比 */}
                            <section className="bg-blue-500 rounded-2xl p-5 text-white shadow-lg">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs font-semibold opacity-80">
                                            {selectedCategoryId ? `${selectedCategoryName} の支出` : '変動費 合計'}
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
                                    {isCurrentPeriod ? (
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
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <span className="text-sm font-bold text-gray-800">
                                                                ¥{Number(tx.amount).toLocaleString()}
                                                            </span>
                                                            <button
                                                                onClick={() => handleEditTx(tx)}
                                                                className="text-gray-400 hover:text-blue-500 transition-colors ml-1"
                                                            >
                                                                <Pencil size={12} />
                                                            </button>
                                                            {confirmDeleteTxId === tx.id ? (
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => handleDeleteTx(tx.id)}
                                                                        className="px-2 py-1 rounded bg-red-500 text-white text-[10px] font-bold hover:bg-red-600 whitespace-nowrap"
                                                                    >
                                                                        削除
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setConfirmDeleteTxId(null)}
                                                                        className="px-2 py-1 rounded bg-gray-200 text-gray-600 text-[10px] font-bold hover:bg-gray-300 whitespace-nowrap"
                                                                    >
                                                                        キャンセル
                                                                    </button>
                                                                </div>
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
                        </>
                    ) : (
                        /* ============================================================ */
                        /* 固定費セクション */
                        /* ============================================================ */
                        <>
                            {/* 固定費の合計 */}
                            <section className="bg-emerald-500 rounded-2xl p-5 text-white shadow-lg">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs font-semibold opacity-80">固定費 合計（毎月）</p>
                                        <p className="text-3xl font-extrabold mt-1">¥{fixedCostTotal.toLocaleString()}</p>
                                        <p className="text-xs opacity-70 mt-1">{fixedCosts.length} 件の固定費</p>
                                    </div>
                                </div>
                            </section>

                            {/* 固定費カテゴリ別円グラフ */}
                            {fixedCostCategoriesData.length > 0 && (
                                <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                                    <h2 className="text-sm font-bold text-gray-800 mb-2">🏷️ カテゴリ別 固定費</h2>
                                    <CategoryPieChart data={fixedCostCategoriesData} />
                                    <div className="mt-4 flex flex-col gap-2">
                                        {[...fixedCostCategoriesData]
                                            .sort((a, b) => b.value - a.value)
                                            .map(cat => {
                                                const percent = fixedCostTotal > 0 ? Math.round((cat.value / fixedCostTotal) * 100) : 0;
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

                            {/* 固定費一覧 */}
                            <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                                <h2 className="text-sm font-bold text-gray-800 mb-3">📋 固定費一覧</h2>
                                {fixedCosts.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400">
                                        <Home size={40} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">固定費が登録されていません</p>
                                        <p className="text-[10px] mt-1">設定画面から追加できます</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {fixedCosts.map(fc => (
                                            <div
                                                key={fc.id}
                                                className={`rounded-xl transition-colors group ${editingFixedCostId === fc.id ? 'bg-emerald-50 border border-emerald-200 p-3' : 'bg-gray-50 hover:bg-gray-100 p-3'}`}
                                            >
                                                {editingFixedCostId === fc.id ? (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <input
                                                                type="text"
                                                                value={editFixedCostName}
                                                                onChange={e => setEditFixedCostName(e.target.value)}
                                                                placeholder="固定費名"
                                                                className="bg-white rounded-lg px-2 py-1.5 text-sm border border-emerald-200 outline-none"
                                                                autoFocus
                                                            />
                                                            <div className="flex items-center bg-white rounded-lg border border-emerald-200">
                                                                <span className="pl-2 text-gray-400 text-xs">¥</span>
                                                                <input
                                                                    type="number"
                                                                    value={editFixedCostAmount}
                                                                    onChange={e => setEditFixedCostAmount(e.target.value)}
                                                                    className="w-full px-1 py-1.5 text-sm bg-transparent outline-none"
                                                                    placeholder="0"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="flex items-center bg-white rounded-lg border border-emerald-200">
                                                                <span className="pl-2 text-gray-400 text-xs">毎月</span>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max="31"
                                                                    value={editFixedCostDate}
                                                                    onChange={e => setEditFixedCostDate(e.target.value)}
                                                                    className="w-full px-1 py-1.5 text-sm bg-transparent outline-none text-right"
                                                                />
                                                                <span className="pr-2 text-gray-400 text-xs text-right">日</span>
                                                            </div>
                                                            <select
                                                                value={editFixedCostCategory}
                                                                onChange={e => setEditFixedCostCategory(e.target.value)}
                                                                className="w-full bg-white rounded-lg px-2 py-1.5 text-sm border border-emerald-200 outline-none appearance-none"
                                                            >
                                                                {fixedCostCategories.map(cat => (
                                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="flex gap-2 items-center justify-end mt-1">
                                                            <button onClick={() => handleSaveFixedCostEdit(fc.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 whitespace-nowrap"><Check size={12} className="inline mr-0.5" />保存</button>
                                                            <button onClick={() => setEditingFixedCostId(null)} className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-300 whitespace-nowrap">×</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div
                                                                className="w-2 h-8 rounded-full flex-shrink-0"
                                                                style={{ backgroundColor: getCategoryColor(fc.category_id) }}
                                                            />
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-gray-800 truncate">{fc.name}</p>
                                                                <p className="text-[10px] text-gray-400">
                                                                    毎月{fc.date_of_month}日 · {getCategoryName(fc.category_id)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0 pl-2">
                                                            <span className="text-sm font-bold text-gray-800 whitespace-nowrap">
                                                                ¥{Number(fc.amount).toLocaleString()}
                                                            </span>
                                                            <button
                                                                onClick={() => handleEditFixedCost(fc)}
                                                                className="text-gray-400 hover:text-emerald-500 transition-colors ml-1"
                                                            >
                                                                <Pencil size={12} />
                                                            </button>
                                                            {confirmDeleteFixedCostId === fc.id ? (
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        onClick={() => handleDeleteFixedCost(fc.id)}
                                                                        className="px-2 py-1 rounded bg-red-500 text-white text-[10px] font-bold hover:bg-red-600 whitespace-nowrap"
                                                                    >
                                                                        削除
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setConfirmDeleteFixedCostId(null)}
                                                                        className="px-2 py-1 rounded bg-gray-200 text-gray-600 text-[10px] font-bold hover:bg-gray-300 whitespace-nowrap"
                                                                    >
                                                                        キャンセル
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setConfirmDeleteFixedCostId(fc.id)}
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
                        </>
                    )}

                </> /* 月別ビューの閉じタグ */
            )}

        </div>
    );
}
