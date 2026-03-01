'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Camera, Calendar, Tag, Store, ShoppingBag, Plus, Trash2, Home, Zap, Wifi, CreditCard, Landmark, Pencil, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import ReceiptScanner, { OcrResult } from '@/components/ReceiptScanner';
import { useWallet } from '@/components/WalletProvider';

interface TransactionFormItem {
    id: string; // React key用のユニークID
    amount: string;
    itemName: string;
    categoryId: string;
    memo: string;
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
}

const getFixedCostIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('家賃') || lower.includes('住宅') || lower.includes('ローン') || lower.includes('マンション')) return Home;
    if (lower.includes('電気') || lower.includes('ガス') || lower.includes('光熱')) return Zap;
    if (lower.includes('通信') || lower.includes('スマホ') || lower.includes('ネット') || lower.includes('Wi-Fi')) return Wifi;
    if (lower.includes('保険') || lower.includes('年金')) return Landmark;
    return CreditCard;
};


export default function InputPage() {
    const { activeWallet } = useWallet();
    const [activeTab, setActiveTab] = useState<'variable' | 'fixed'>('variable');

    // 変動費関連ステート
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [storeName, setStoreName] = useState('');
    const [items, setItems] = useState<TransactionFormItem[]>([]);
    const [defaultCategoryId, setDefaultCategoryId] = useState('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showScanner, setShowScanner] = useState(false);

    // 固定費関連ステート
    const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
    const [fixedCategories, setFixedCategories] = useState<Category[]>([]);
    const [showFixedForm, setShowFixedForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [newDateOfMonth, setNewDateOfMonth] = useState('1');
    const [newFixedCategoryId, setNewFixedCategoryId] = useState('');
    const [isSavingFixed, setIsSavingFixed] = useState(false);
    const [editingCostId, setEditingCostId] = useState<string | null>(null);
    const [editCostName, setEditCostName] = useState('');
    const [editCostAmount, setEditCostAmount] = useState('');
    const [editCostDate, setEditCostDate] = useState('1');
    const [editCostCategory, setEditCostCategory] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);


    // OCR結果を受け取ってフォームに反映するハンドラ（複数レシート対応）
    const handleScanComplete = (results: OcrResult[]) => {
        applyOcrResults(results, defaultCategoryId, categories);
        setShowScanner(false);
    };

    // OCR結果をフォームに適用するヘルパー
    const applyOcrResults = (
        results: OcrResult[],
        defCatId: string,
        cats: Category[]
    ) => {
        if (results.length === 0) return;

        // 最初のレシートの日付と店名を使う
        const first = results[0];
        if (first.date) setDate(first.date);
        if (first.storeName) setStoreName(first.storeName);

        let allItems: TransactionFormItem[] = [];
        const ts = Date.now();

        results.forEach((result, rIdx) => {
            let receiptItems: TransactionFormItem[] = [];
            let itemsTotal = 0;

            if (result.items && result.items.length > 0) {
                receiptItems = result.items.map((item, index) => {
                    let matchedCategoryId = defCatId;
                    if (item.categoryName) {
                        const found = cats.find(c => c.name.includes(item.categoryName!) || item.categoryName!.includes(c.name));
                        if (found) matchedCategoryId = found.id;
                    }
                    const itemAmount = item.amount || 0;
                    itemsTotal += itemAmount;
                    return {
                        id: `${ts}_${rIdx}_${index}`,
                        amount: itemAmount ? itemAmount.toString() : '',
                        itemName: item.itemName || '',
                        categoryId: matchedCategoryId,
                        memo: results.length > 1 ? `レシート${rIdx + 1}` : '',
                    };
                });

                // 差額調整行
                if (result.totalAmount && result.totalAmount > 0) {
                    const diff = result.totalAmount - itemsTotal;
                    if (diff !== 0) {
                        receiptItems.push({
                            id: `${ts}_${rIdx}_adj`,
                            amount: diff.toString(),
                            itemName: diff > 0 ? '消費税・調整分' : '割引・調整分',
                            categoryId: defCatId,
                            memo: results.length > 1 ? `レシート${rIdx + 1} 自動調整` : '自動調整',
                        });
                    }
                }
            } else if (result.totalAmount && result.totalAmount > 0) {
                receiptItems = [{
                    id: `${ts}_${rIdx}_total`,
                    amount: result.totalAmount.toString(),
                    itemName: result.storeName || 'スキャン結果',
                    categoryId: defCatId,
                    memo: results.length > 1 ? `レシート${rIdx + 1}` : '',
                }];
            }

            allItems = [...allItems, ...receiptItems];
        });

        if (allItems.length > 0) {
            setItems(allItems);
        } else if (items.length === 0) {
            handleAddItem();
        }
    };

    // データ初期取得
    useEffect(() => {
        if (!activeWallet) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 変動費カテゴリ取得
                const { data: transCats, error: transError } = await supabase
                    .from('categories')
                    .select('id, name, color')
                    .eq('wallet_id', activeWallet?.id || '')
                    .eq('target_type', 'transaction')
                    .order('created_at') as { data: Category[] | null, error: any };

                if (transError) throw transError;
                if (transCats && transCats.length > 0) {
                    setCategories(transCats);
                    setDefaultCategoryId(transCats[0].id);

                    // 初期行セットアップ（OCRスキャン結果引き継ぎなど省略した部分はここに合わせて簡素化）
                    if (items.length === 0) {
                        setItems([{ id: Date.now().toString(), amount: '', itemName: '', categoryId: transCats[0].id, memo: '' }]);
                    }
                }

                // 固定費関連データ取得
                const { data: fixCats } = await supabase
                    .from('categories')
                    .select('id, name, color')
                    .eq('wallet_id', activeWallet?.id || '')
                    .eq('target_type', 'fixed_cost') as { data: Category[] | null; error: any };
                setFixedCategories(fixCats || []);
                if (fixCats && fixCats.length > 0) {
                    setNewFixedCategoryId(fixCats[0].id);
                }

                const { data: costs } = await supabase
                    .from('fixed_costs')
                    .select('id, name, amount, date_of_month, category_id')
                    .eq('wallet_id', activeWallet?.id || '')
                    .order('date_of_month') as { data: FixedCost[] | null; error: any };
                setFixedCosts(costs || []);


            } catch (err) {
                console.error('Failed to load initial data', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeWallet]);

    // 変動費：明細行の追加
    const handleAddItem = () => {
        setItems(prev => [
            ...prev,
            { id: Date.now().toString(), amount: '', itemName: '', categoryId: defaultCategoryId, memo: '' }
        ]);
    };

    // 変動費：明細行の削除
    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    // 変動費：明細行の更新
    const handleItemChange = (id: string, field: keyof TransactionFormItem, value: string) => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            return { ...item, [field]: value };
        }));
    };

    // 変動費：送信処理
    const handleSubmitVariable = async (e: React.FormEvent) => {
        e.preventDefault();

        // 有効な（金額が入力されている）行のみ抽出
        const validItems = items.filter(item => item.amount && item.categoryId);
        if (validItems.length === 0) {
            alert('金額を入力してください');
            return;
        }

        setIsSubmitting(true);

        try {
            // Supabaseへ複数行の支出データを一括保存 (バルクインサート)
            const insertData = validItems.map(item => ({
                wallet_id: activeWallet?.id,
                amount: Number(item.amount),
                date: date,
                store_name: storeName || null,
                item_name: item.itemName || null,
                category_id: item.categoryId,
                memo: item.memo || null,
            }));

            const { error } = await supabase.from('transactions').insert(insertData as any);

            if (error) throw error;

            alert(`${validItems.length}件の支出を登録しました！`);
            // フォームをリセットし、初期状態の1行に戻す
            setStoreName('');
            setItems([{
                id: Date.now().toString(),
                amount: '',
                itemName: '',
                categoryId: defaultCategoryId,
                memo: ''
            }]);

        } catch (err: any) {
            console.error(err);
            alert('保存に失敗しました: ' + (err.message || '不明なエラー'));
        } finally {
            setIsSubmitting(false);
        }
    };


    /* --- 固定費関連の処理 --- */
    const handleAddFixedCost = async () => {
        if (!newName || !newAmount) {
            alert('費目名と金額を入力してください');
            return;
        }
        setIsSavingFixed(true);
        try {
            const { data, error } = await supabase
                .from('fixed_costs')
                .insert({
                    wallet_id: activeWallet?.id,
                    user_id: '00000000-0000-0000-0000-000000000000',
                    name: newName,
                    amount: Number(newAmount),
                    date_of_month: Number(newDateOfMonth),
                    category_id: newFixedCategoryId || null,
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
            setShowFixedForm(false);
        } catch (err: any) {
            console.error('Failed to add fixed cost:', err?.message);
            alert(`保存に失敗しました: ${err?.message || '不明なエラー'}`);
        } finally {
            setIsSavingFixed(false);
        }
    };

    const handleDeleteFixedCost = async (id: string) => {
        try {
            const { error } = await supabase
                .from('fixed_costs')
                .delete()
                .eq('id', id);
            if (error) throw error;
            setFixedCosts(prev => prev.filter(c => c.id !== id));
            setConfirmDeleteId(null);
        } catch (err: any) {
            console.error('Delete failed:', err?.message);
            alert(`削除に失敗しました: ${err?.message || '不明なエラー'}`);
        }
    };

    const handleEditCost = (cost: FixedCost) => {
        setEditingCostId(cost.id);
        setEditCostName(cost.name);
        setEditCostAmount(String(cost.amount));
        setEditCostDate(String(cost.date_of_month));
        setEditCostCategory(cost.category_id || '');
    };

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

    const getFixedCategoryName = (id: string | null) => {
        if (!id) return '未分類';
        return fixedCategories.find(c => c.id === id)?.name || '未分類';
    };


    return (
        <div className="p-6 pt-10 flex flex-col animate-fade-in relative min-h-screen">
            {isLoading && (
                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center rounded-2xl">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            )}

            {/* スキャナーモーダル */}
            {showScanner && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm animate-fade-in relative">
                        <ReceiptScanner
                            onScanComplete={handleScanComplete}
                            onCancel={() => setShowScanner(false)}
                        />
                    </div>
                </div>
            )}

            <header className="mb-4">
                <h1 className="text-xl font-bold text-gray-800">支出の入力</h1>
                <p className="text-sm text-gray-500 mt-1">日々の変動費や、毎月の固定費を登録します</p>
            </header>

            {/* タブナビゲーション */}
            <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
                <button
                    onClick={() => setActiveTab('variable')}
                    className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'variable' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    変動費
                </button>
                <button
                    onClick={() => setActiveTab('fixed')}
                    className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'fixed' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    固定費
                </button>
            </div>

            {/* -------------------- 変動費タブ内容 -------------------- */}
            {activeTab === 'variable' && (
                <div className="animate-fade-in pb-20">
                    {/* スキャンへの導線 */}
                    <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex items-center justify-between shadow-sm mb-4">
                        <div>
                            <h3 className="font-bold text-blue-800 text-sm">レシートをスキャンしましょう！</h3>
                            <p className="text-xs text-blue-600 mt-1">カメラで撮影してカンタンに入力できます</p>
                        </div>
                        <button
                            type="button"
                            className="bg-blue-600 text-white rounded-full p-3 shadow-md hover:bg-blue-700 transition transform hover:scale-105 cursor-pointer"
                            onClick={() => setShowScanner(true)}
                        >
                            <Camera size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmitVariable} className="flex flex-col gap-5">
                        {/* 共通情報: 日付と店名 */}
                        <div className="bg-white rounded-2xl p-4 shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-gray-100 divide-y divide-gray-50">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">レシート共通情報</h3>
                            {/* 日付 */}
                            <div className="flex items-center py-3 gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                                    <Calendar size={18} />
                                </div>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="flex-1 bg-transparent text-gray-800 font-medium outline-none"
                                    required
                                />
                            </div>
                            {/* 店名 */}
                            <div className="flex items-center py-3 gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                                    <Store size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={storeName}
                                    onChange={(e) => setStoreName(e.target.value)}
                                    className="flex-1 bg-transparent text-gray-800 font-medium outline-none placeholder-gray-400"
                                    placeholder="店名を入力"
                                />
                            </div>
                        </div>

                        {/* 明細リスト */}
                        <div className="flex items-center justify-between mt-2">
                            <h3 className="text-sm font-bold text-gray-800 pl-1">購入明細</h3>
                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-1.5 px-3 rounded-full flex items-center gap-1 transition-colors"
                            >
                                <Plus size={14} /> 追加
                            </button>
                        </div>

                        <div className="flex flex-col gap-3">
                            {items.map((item, index) => (
                                <div key={item.id} className="bg-white rounded-2xl p-4 shadow-[0_2px_15px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col gap-3 relative animate-fade-in">
                                    {/* 削除ボタン (複数ある場合のみ表示) */}
                                    {items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="absolute top-3 right-3 text-gray-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}

                                    {/* 金額 */}
                                    <div className="flex items-end gap-2 pr-6">
                                        <span className="text-xl font-bold text-gray-400 pb-1">¥</span>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            value={item.amount}
                                            onChange={(e) => handleItemChange(item.id, 'amount', e.target.value)}
                                            className="w-full text-3xl font-extrabold text-gray-900 bg-transparent outline-none placeholder-gray-200 border-b border-gray-100 pb-1"
                                            placeholder="0"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                        {/* 品目 */}
                                        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl">
                                            <ShoppingBag size={14} className="text-gray-400 min-w-[14px]" />
                                            <input
                                                type="text"
                                                value={item.itemName}
                                                onChange={(e) => handleItemChange(item.id, 'itemName', e.target.value)}
                                                className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder-gray-400"
                                                placeholder="品目を入力"
                                            />
                                        </div>
                                        {/* カテゴリ */}
                                        <div className="flex items-center gap-2 bg-blue-50/50 p-2 rounded-xl">
                                            <Tag size={14} className="text-blue-400 min-w-[14px]" />
                                            <select
                                                value={item.categoryId}
                                                onChange={(e) => handleItemChange(item.id, 'categoryId', e.target.value)}
                                                className="w-full bg-transparent text-sm text-gray-800 outline-none appearance-none cursor-pointer"
                                                required
                                            >
                                                <option value="" disabled>カテゴリ</option>
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 合計表示 */}
                        <div className="flex justify-between items-center px-2 text-gray-500 font-semibold mb-2">
                            <span>合計金額</span>
                            <span className="text-xl text-gray-800">
                                ¥{items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toLocaleString()}
                            </span>
                        </div>

                        {/* 送信ボタン */}
                        <button
                            type="submit"
                            disabled={isSubmitting || isLoading}
                            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:shadow-none"
                        >
                            {isSubmitting ? '保存中...' : '記録する'}
                        </button>
                    </form>
                </div>
            )}

            {/* -------------------- 固定費タブ内容 -------------------- */}
            {activeTab === 'fixed' && (
                <div className="animate-fade-in pb-20">
                    {/* 固定費合計表示 */}
                    <section className="bg-emerald-500 rounded-2xl p-5 text-white shadow-lg mb-6">
                        <p className="text-xs font-semibold opacity-80">毎月の固定費合計</p>
                        <p className="text-3xl font-extrabold mt-1">
                            ¥{fixedCosts.reduce((sum, c) => sum + Number(c.amount), 0).toLocaleString()}
                        </p>
                        <p className="text-xs opacity-70 mt-1">{fixedCosts.length} 件の固定費</p>
                    </section>

                    <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-sm font-bold text-gray-800">📋 固定費一覧</h2>
                            <button
                                onClick={() => setShowFixedForm(!showFixedForm)}
                                className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                            >
                                <Plus size={14} />
                                追加
                            </button>
                        </div>

                        {/* 追加フォーム */}
                        {showFixedForm && (
                            <div className="bg-emerald-50 rounded-xl p-4 mb-4 flex flex-col gap-3 animate-fade-in">
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="費目名（例：家賃、電気代）"
                                    className="w-full bg-white rounded-lg px-3 py-2 text-sm outline-none border border-emerald-100 focus:border-emerald-300 transition-colors"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] text-gray-500 font-medium mb-1 block">金額</label>
                                        <div className="flex items-center bg-white rounded-lg border border-emerald-100">
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
                                            className="w-full bg-white rounded-lg px-3 py-2 text-sm outline-none border border-emerald-100 appearance-none cursor-pointer"
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
                                        value={newFixedCategoryId}
                                        onChange={e => setNewFixedCategoryId(e.target.value)}
                                        className="w-full bg-white rounded-lg px-3 py-2 text-sm outline-none border border-emerald-100 appearance-none cursor-pointer"
                                    >
                                        {fixedCategories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2 mt-1">
                                    <button
                                        onClick={() => setShowFixedForm(false)}
                                        className="flex-1 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
                                    >
                                        キャンセル
                                    </button>
                                    <button
                                        onClick={handleAddFixedCost}
                                        disabled={isSavingFixed}
                                        className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:bg-gray-300"
                                    >
                                        {isSavingFixed ? '保存中...' : '保存'}
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
                                            <div key={cost.id} className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 flex flex-col gap-2 animate-fade-in">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input
                                                        type="text"
                                                        value={editCostName}
                                                        onChange={e => setEditCostName(e.target.value)}
                                                        placeholder="費目名"
                                                        className="bg-white rounded-lg px-2 py-1.5 text-sm border border-emerald-200 outline-none"
                                                        autoFocus
                                                    />
                                                    <div className="flex items-center bg-white rounded-lg border border-emerald-200">
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
                                                        className="bg-white rounded-lg px-2 py-1.5 text-sm border border-emerald-200 outline-none appearance-none"
                                                    >
                                                        {Array.from({ length: 31 }, (_, i) => (
                                                            <option key={i + 1} value={i + 1}>{i + 1}日</option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        value={editCostCategory}
                                                        onChange={e => setEditCostCategory(e.target.value)}
                                                        className="bg-white rounded-lg px-2 py-1.5 text-sm border border-emerald-200 outline-none appearance-none"
                                                    >
                                                        {fixedCategories.map(cat => (
                                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="flex gap-2 mt-1">
                                                    <button onClick={() => handleSaveCostEdit(cost.id)} className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center justify-center gap-1">
                                                        <Check size={12} />保存
                                                    </button>
                                                    <button onClick={() => setEditingCostId(null)} className="flex-1 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50">
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
                                                        毎月{cost.date_of_month}日 · {getFixedCategoryName(cost.category_id)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-sm font-bold text-gray-800 whitespace-nowrap">
                                                    ¥{Number(cost.amount).toLocaleString()}
                                                </span>
                                                <button
                                                    onClick={() => handleEditCost(cost)}
                                                    className="text-gray-400 hover:text-emerald-500 transition-colors ml-1"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                {confirmDeleteId === cost.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleDeleteFixedCost(cost.id)}
                                                            className="px-2 py-1 rounded bg-red-500 text-white text-[10px] font-bold hover:bg-red-600 whitespace-nowrap"
                                                        >
                                                            削除
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDeleteId(null)}
                                                            className="px-2 py-1 rounded bg-gray-200 text-gray-600 text-[10px] font-bold hover:bg-gray-300 whitespace-nowrap"
                                                        >
                                                            キャンセル
                                                        </button>
                                                    </div>
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
                </div>
            )}
        </div>
    );
}
