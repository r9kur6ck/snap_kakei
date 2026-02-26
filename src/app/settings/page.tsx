'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Home, Zap, Wifi, CreditCard, Landmark, Download, Pencil, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useWallet } from '@/components/WalletProvider';

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
}

// 固定費の種類アイコンを推測するヘルパー
const getFixedCostIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('家賃') || lower.includes('住宅') || lower.includes('ローン') || lower.includes('マンション')) return Home;
    if (lower.includes('電気') || lower.includes('ガス') || lower.includes('光熱')) return Zap;
    if (lower.includes('通信') || lower.includes('スマホ') || lower.includes('ネット') || lower.includes('Wi-Fi')) return Wifi;
    if (lower.includes('保険') || lower.includes('年金')) return Landmark;
    return CreditCard;
};



export default function SettingsPage() {
    const { activeWallet, refreshWallet } = useWallet();
    const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // 新規追加フォーム用
    const [newName, setNewName] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [newDateOfMonth, setNewDateOfMonth] = useState('1');
    const [newCategoryId, setNewCategoryId] = useState('');
    const [isSaving, setIsSaving] = useState(false);


    // 予算設定
    const [monthlyBudget, setMonthlyBudget] = useState('150000');
    const [budgetSaved, setBudgetSaved] = useState(false);

    // 固定費編集用
    const [editingCostId, setEditingCostId] = useState<string | null>(null);
    const [editCostName, setEditCostName] = useState('');
    const [editCostAmount, setEditCostAmount] = useState('');
    const [editCostDate, setEditCostDate] = useState('1');
    const [editCostCategory, setEditCostCategory] = useState('');

    // 削除確認用
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // データ取得
    useEffect(() => {
        if (!activeWallet) return;
        const fetchData = async () => {
            try {
                const { data: cats } = await supabase
                    .from('categories')
                    .select('id, name, color')
                    .eq('wallet_id', activeWallet?.id || '') as { data: Category[] | null; error: any };
                setCategories(cats || []);
                if (cats && cats.length > 0) {
                    setNewCategoryId(cats[0].id);
                }

                const { data: costs } = await supabase
                    .from('fixed_costs')
                    .select('id, name, amount, date_of_month, category_id')
                    .eq('wallet_id', activeWallet?.id || '')
                    .order('date_of_month') as { data: FixedCost[] | null; error: any };
                setFixedCosts(costs || []);
            } catch (err) {
                console.error('Failed to load data:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [activeWallet]);

    // 予算の読み込み (walletから)
    useEffect(() => {
        if (activeWallet) {
            setMonthlyBudget(String(activeWallet.monthly_budget || 150000));
        }
    }, [activeWallet]);

    // 予算の保存 (walletに保存)
    const handleSaveBudget = async () => {
        if (!activeWallet) return;
        try {
            const { error } = await (supabase.from('wallets') as any)
                .update({ monthly_budget: Number(monthlyBudget) })
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
                const catName = getCategoryName(tx.category_id);
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

    // 固定費の追加
    const handleAdd = async () => {
        if (!newName || !newAmount) {
            alert('費目名と金額を入力してください');
            return;
        }
        setIsSaving(true);
        try {
            const { data, error } = await supabase
                .from('fixed_costs')
                .insert({
                    wallet_id: activeWallet?.id,
                    user_id: '00000000-0000-0000-0000-000000000000',
                    name: newName,
                    amount: Number(newAmount),
                    date_of_month: Number(newDateOfMonth),
                    category_id: newCategoryId || null,
                } as any)
                .select() as { data: FixedCost[] | null; error: any };

            if (error) throw error;
            if (data) {
                setFixedCosts(prev => [...prev, ...data].sort((a, b) => a.date_of_month - b.date_of_month));
            }
            // フォームリセット
            setNewName('');
            setNewAmount('');
            setNewDateOfMonth('1');
            setShowForm(false);
        } catch (err: any) {
            console.error('Failed to add fixed cost:', err?.message, err?.code, err?.hint, JSON.stringify(err));
            alert(`保存に失敗しました: ${err?.message || '不明なエラー'}`);
        } finally {
            setIsSaving(false);
        }
    };

    // 固定費の削除
    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .from('fixed_costs')
                .delete()
                .eq('id', id);
            if (error) throw error;
            setFixedCosts(prev => prev.filter(c => c.id !== id));
            setConfirmDeleteId(null);
        } catch (err: any) {
            console.error('Delete failed:', err?.message, JSON.stringify(err));
            alert(`削除に失敗しました: ${err?.message || '不明なエラー'}`);
        }
    };



    // 固定費の編集開始
    const handleEditCost = (cost: FixedCost) => {
        setEditingCostId(cost.id);
        setEditCostName(cost.name);
        setEditCostAmount(String(cost.amount));
        setEditCostDate(String(cost.date_of_month));
        setEditCostCategory(cost.category_id || '');
    };

    // 固定費の編集保存
    const handleSaveCostEdit = async (id: string) => {
        try {
            const { error } = await (supabase.from('fixed_costs') as any)
                .update({
                    name: editCostName,
                    amount: Number(editCostAmount),
                    date_of_month: Number(editCostDate),
                    category_id: editCostCategory || null,
                })
                .eq('id', id);
            if (error) throw error;
            setFixedCosts(prev => prev.map(c =>
                c.id === id ? { ...c, name: editCostName, amount: Number(editCostAmount), date_of_month: Number(editCostDate), category_id: editCostCategory || null } : c
            ).sort((a, b) => a.date_of_month - b.date_of_month));
            setEditingCostId(null);
        } catch (err: any) {
            alert(`編集に失敗しました: ${err?.message || '不明なエラー'}`);
        }
    };

    // カテゴリ名ヘルパー
    const getCategoryName = (id: string | null) => {
        if (!id) return '未分類';
        return categories.find(c => c.id === id)?.name || '未分類';
    };



    const totalFixed = fixedCosts.reduce((sum, c) => sum + Number(c.amount), 0);

    return (
        <div className="p-6 pt-10 flex flex-col gap-5 animate-fade-in relative">

            {isLoading && (
                <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            )}

            {/* ヘッダー */}
            <header>
                <h1 className="text-xl font-bold text-gray-800">⚙️ 設定</h1>
                <p className="text-xs text-gray-400 mt-1">固定費の管理ができます</p>
            </header>

            {/* 固定費合計 */}
            <section className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
                <p className="text-xs font-semibold opacity-80">毎月の固定費合計</p>
                <p className="text-3xl font-extrabold mt-1">¥{totalFixed.toLocaleString()}</p>
                <p className="text-xs opacity-70 mt-1">{fixedCosts.length} 件の固定費</p>
            </section>

            {/* 固定費一覧 */}
            <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-sm font-bold text-gray-800">📋 固定費一覧</h2>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                        <Plus size={14} />
                        追加
                    </button>
                </div>

                {/* 追加フォーム */}
                {showForm && (
                    <div className="bg-blue-50 rounded-xl p-4 mb-4 flex flex-col gap-3 animate-fade-in">
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="費目名（例：家賃、電気代）"
                            className="w-full bg-white rounded-lg px-3 py-2 text-sm outline-none border border-blue-100 focus:border-blue-300 transition-colors"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-gray-500 font-medium mb-1 block">金額</label>
                                <div className="flex items-center bg-white rounded-lg border border-blue-100">
                                    <span className="pl-2 text-gray-400 text-sm">¥</span>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={newAmount}
                                        onChange={e => setNewAmount(e.target.value)}
                                        placeholder="0"
                                        className="w-full px-2 py-2 text-sm bg-transparent outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-medium mb-1 block">引落日</label>
                                <select
                                    value={newDateOfMonth}
                                    onChange={e => setNewDateOfMonth(e.target.value)}
                                    className="w-full bg-white rounded-lg px-3 py-2 text-sm outline-none border border-blue-100 appearance-none cursor-pointer"
                                >
                                    {Array.from({ length: 31 }, (_, i) => (
                                        <option key={i + 1} value={i + 1}>{i + 1}日</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-medium mb-1 block">カテゴリ</label>
                            <select
                                value={newCategoryId}
                                onChange={e => setNewCategoryId(e.target.value)}
                                className="w-full bg-white rounded-lg px-3 py-2 text-sm outline-none border border-blue-100 appearance-none cursor-pointer"
                            >
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>

                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowForm(false)}
                                className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleAdd}
                                disabled={isSaving}
                                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300"
                            >
                                {isSaving ? '保存中...' : '保存'}
                            </button>
                        </div>
                    </div>
                )}

                {/* 固定費リスト */}
                {fixedCosts.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <CreditCard size={40} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">固定費が登録されていません</p>
                        <p className="text-[10px] mt-1">上の「追加」ボタンから追加できます</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {fixedCosts.map(cost => {
                            const Icon = getFixedCostIcon(cost.name);
                            if (editingCostId === cost.id) {
                                return (
                                    <div key={cost.id} className="bg-blue-50 rounded-xl p-3 border border-blue-200 flex flex-col gap-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="text"
                                                value={editCostName}
                                                onChange={e => setEditCostName(e.target.value)}
                                                placeholder="費目名"
                                                className="bg-white rounded-lg px-2 py-1.5 text-sm border border-blue-200 outline-none"
                                                autoFocus
                                            />
                                            <div className="flex items-center bg-white rounded-lg border border-blue-200">
                                                <span className="pl-2 text-gray-400 text-xs">¥</span>
                                                <input
                                                    type="number"
                                                    value={editCostAmount}
                                                    onChange={e => setEditCostAmount(e.target.value)}
                                                    className="w-full px-1 py-1.5 text-sm bg-transparent outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <select
                                                value={editCostDate}
                                                onChange={e => setEditCostDate(e.target.value)}
                                                className="bg-white rounded-lg px-2 py-1.5 text-sm border border-blue-200 outline-none appearance-none"
                                            >
                                                {Array.from({ length: 31 }, (_, i) => (
                                                    <option key={i + 1} value={i + 1}>{i + 1}日</option>
                                                ))}
                                            </select>
                                            <select
                                                value={editCostCategory}
                                                onChange={e => setEditCostCategory(e.target.value)}
                                                className="bg-white rounded-lg px-2 py-1.5 text-sm border border-blue-200 outline-none appearance-none"
                                            >
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleSaveCostEdit(cost.id)} className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 flex items-center justify-center gap-1">
                                                <Check size={12} />保存
                                            </button>
                                            <button onClick={() => setEditingCostId(null)} className="flex-1 py-1.5 rounded-lg bg-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-300">
                                                キャンセル
                                            </button>
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div
                                    key={cost.id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                                            <Icon size={18} className="text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{cost.name}</p>
                                            <p className="text-[10px] text-gray-400">
                                                毎月{cost.date_of_month}日 · {getCategoryName(cost.category_id)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-gray-800">
                                            ¥{Number(cost.amount).toLocaleString()}
                                        </span>
                                        <button
                                            onClick={() => handleEditCost(cost)}
                                            className="text-gray-400 hover:text-blue-500 transition-colors"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        {confirmDeleteId === cost.id ? (
                                            <>
                                                <button
                                                    onClick={() => handleDelete(cost.id)}
                                                    className="px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-bold hover:bg-red-600"
                                                >
                                                    削除
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(null)}
                                                    className="px-2 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px] font-bold hover:bg-gray-300"
                                                >
                                                    やめる
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmDeleteId(cost.id)}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* 予算設定 */}
            <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                <h2 className="text-sm font-bold text-gray-800 mb-3">💰 月間予算設定</h2>
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 flex-1">
                        <span className="pl-3 text-gray-400 text-sm">¥</span>
                        <input
                            type="number"
                            inputMode="numeric"
                            value={monthlyBudget}
                            onChange={e => setMonthlyBudget(e.target.value)}
                            className="w-full px-2 py-2.5 text-sm bg-transparent outline-none font-bold"
                        />
                    </div>
                    <button
                        onClick={handleSaveBudget}
                        className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${budgetSaved
                            ? 'bg-green-100 text-green-600'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        {budgetSaved ? '✓ 保存済' : '保存'}
                    </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">ホーム画面の予算計算に使用されます</p>
            </section>

            {/* CSVエクスポート */}
            <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                <h2 className="text-sm font-bold text-gray-800 mb-3">📁 データ管理</h2>
                <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-semibold transition-colors border border-gray-200"
                >
                    <Download size={16} />
                    CSVエクスポート
                </button>
                <p className="text-[10px] text-gray-400 mt-2">全取引データをCSVファイルとしてダウンロードできます</p>
            </section>

            {/* 固定費の説明 */}
            <section className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <h3 className="text-xs font-bold text-gray-600 mb-2">💡 固定費とは？</h3>
                <ul className="text-[11px] text-gray-500 flex flex-col gap-1">
                    <li>🏠 家賃・住宅ローン — 住居に関する費用</li>
                    <li>⚡ 光熱費 — 電気、ガス、水道の基本料金</li>
                    <li>📱 通信費 — スマートフォンやインターネットの月額料金</li>
                    <li>🛡️ 保険料 — 生命保険、医療保険など</li>
                    <li>💳 サブスクリプション — 定期的に支払うサービス料金</li>
                </ul>
            </section>

        </div>
    );
}
