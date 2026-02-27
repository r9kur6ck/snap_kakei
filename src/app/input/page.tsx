'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Camera, Calendar, Tag, Store, ShoppingBag, AlignLeft, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import ReceiptScanner, { OcrResult } from '@/components/ReceiptScanner';
import { Database } from '@/types/database.types';
import { useWallet } from '@/components/WalletProvider';

interface TransactionFormItem {
    id: string; // React key用のユニークID
    amount: string;
    itemName: string;
    categoryId: string;
    memo: string;
}

export default function InputPage() {
    const { activeWallet } = useWallet();
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [storeName, setStoreName] = useState('');

    // 複数行の入力状態を管理
    const [items, setItems] = useState<TransactionFormItem[]>([]);

    // 初期カテゴリIDを保持（新規行追加時に使う）
    const [defaultCategoryId, setDefaultCategoryId] = useState('');

    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showScanner, setShowScanner] = useState(false);

    // OCR結果を受け取ってフォームに反映するハンドラ（複数レシート対応）
    const handleScanComplete = (results: OcrResult[]) => {
        applyOcrResults(results, defaultCategoryId, categories);
        setShowScanner(false);
    };

    // OCR結果をフォームに適用するヘルパー
    const applyOcrResults = (
        results: OcrResult[],
        defCatId: string,
        cats: { id: string; name: string }[]
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

    // マウント時にカテゴリ一覧をSupabaseから取得
    useEffect(() => {
        if (!activeWallet) return;
        const fetchCategories = async () => {
            try {
                const { data, error } = await supabase
                    .from('categories')
                    .select('id, name')
                    .eq('wallet_id', activeWallet?.id || '')
                    .eq('target_type', 'transaction')
                    .order('created_at') as { data: { id: string; name: string }[] | null, error: any };

                if (error) throw error;

                if (data && data.length > 0) {
                    setCategories(data);
                    setDefaultCategoryId(data[0].id); // 初期値をセット

                    // スキャンページからの結果があれば反映（複数レシート対応）
                    const scanResultsStr = localStorage.getItem('scan_results');
                    if (scanResultsStr) {
                        localStorage.removeItem('scan_results');
                        try {
                            const scanResults: OcrResult[] = JSON.parse(scanResultsStr);
                            // applyOcrResultsはまだマウント中なので直接処理
                            const first = scanResults[0];
                            if (first?.date) setDate(first.date);
                            if (first?.storeName) setStoreName(first.storeName);

                            const ts = Date.now();
                            let allItems: TransactionFormItem[] = [];
                            scanResults.forEach((result, rIdx) => {
                                let receiptItems: TransactionFormItem[] = [];
                                let itemsTotal = 0;
                                if (result.items && result.items.length > 0) {
                                    receiptItems = result.items.map((item, index) => {
                                        let matchedCategoryId = data[0].id;
                                        if (item.categoryName) {
                                            const found = data.find(c => c.name.includes(item.categoryName!));
                                            if (found) matchedCategoryId = found.id;
                                        }
                                        const itemAmount = item.amount || 0;
                                        itemsTotal += itemAmount;
                                        return {
                                            id: `${ts}_${rIdx}_${index}`,
                                            amount: itemAmount ? itemAmount.toString() : '',
                                            itemName: item.itemName || '',
                                            categoryId: matchedCategoryId,
                                            memo: scanResults.length > 1 ? `レシート${rIdx + 1}` : '',
                                        };
                                    });
                                    if (result.totalAmount && result.totalAmount > 0) {
                                        const diff = result.totalAmount - itemsTotal;
                                        if (diff !== 0) {
                                            receiptItems.push({
                                                id: `${ts}_${rIdx}_adj`,
                                                amount: diff.toString(),
                                                itemName: diff > 0 ? '消費税・調整分' : '割引・調整分',
                                                categoryId: data[0].id,
                                                memo: scanResults.length > 1 ? `レシート${rIdx + 1} 自動調整` : '自動調整',
                                            });
                                        }
                                    }
                                } else if (result.totalAmount && result.totalAmount > 0) {
                                    receiptItems = [{
                                        id: `${ts}_${rIdx}_total`,
                                        amount: result.totalAmount.toString(),
                                        itemName: result.storeName || 'スキャン結果',
                                        categoryId: data[0].id,
                                        memo: scanResults.length > 1 ? `レシート${rIdx + 1}` : '',
                                    }];
                                }
                                allItems = [...allItems, ...receiptItems];
                            });
                            if (allItems.length > 0) setItems(allItems);
                        } catch { /* ignore parse error */ }
                    } else {
                        // 初期表示で空の1行を作成
                        setItems([{
                            id: Date.now().toString(),
                            amount: '',
                            itemName: '',
                            categoryId: data[0].id,
                            memo: ''
                        }]);
                    }
                }
            } catch (err) {
                console.error('Failed to load categories', err);
                alert('カテゴリの読み込みに失敗しました');
            } finally {
                setIsLoading(false);
            }
        };

        fetchCategories();
    }, [activeWallet]);

    // 明細行の追加
    const handleAddItem = () => {
        setItems(prev => [
            ...prev,
            { id: Date.now().toString(), amount: '', itemName: '', categoryId: defaultCategoryId, memo: '' }
        ]);
    };

    // 明細行の削除
    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    // 品名からカテゴリを自動推測するヘルパー
    const suggestCategory = (itemName: string): string | null => {
        const name = itemName.toLowerCase();
        const mapping: Record<string, string[]> = {
            '食費': ['肉', '魚', '野菜', '果物', '米', 'パン', '牛乳', '卵', '豆腐', '納豆', '弁当', 'おにぎり', 'ラーメン', 'コーヒー', '茶', 'ジュース', 'ビール', '酒', 'ワイン', '菓子', 'チョコ', 'ケーキ', 'アイス', 'ヨーグルト', 'チーズ', 'ハム', 'ソーセージ', 'バター', '醤油', '味噌', '塩', '砂糖', '油', '調味料', 'マヨネーズ', 'ケチャップ', 'ドレッシング', 'お菓子', 'スナック', 'サンドイッチ', 'ハンバーガー', 'ピザ', '寿司', '刺身', '天ぷら', 'うどん', 'そば', 'カレー', 'スープ', 'サラダ', 'おにぎり', '弁当', '飲料', '水'],
            '日用品': ['ティッシュ', 'トイレットペーパー', '洗剤', 'シャンプー', '石鹸', '⟡き粉', '柔軟剤', 'ラップ', 'ゴミ袋', 'スポンジ', '歯ブラシ', '歯磨き粉', '電池', '電球'],
            '交通費': ['電車', 'バス', 'タクシー', 'ガソリン', '駐車', '高速', 'ETC', 'ICカード', 'Suica', 'PASMO'],
            '趣味': ['本', '雑誌', '映画', 'ゲーム', '音楽', 'ライブ', 'コンサート', 'ジム', 'ヨガ', 'スポーツ'],
        };

        for (const [catName, keywords] of Object.entries(mapping)) {
            if (keywords.some(kw => name.includes(kw))) {
                const cat = categories.find(c => c.name.includes(catName));
                if (cat) return cat.id;
            }
        }
        return null;
    };

    // 明細行の更新
    const handleItemChange = (id: string, field: keyof TransactionFormItem, value: string) => {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const updated = { ...item, [field]: value };
            // 品名変更時にカテゴリを自動推測
            if (field === 'itemName' && value.length >= 2) {
                const suggested = suggestCategory(value);
                if (suggested) updated.categoryId = suggested;
            }
            return updated;
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
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

    return (
        <div className="p-6 pt-10 flex flex-col gap-6 animate-fade-in relative">
            {(isLoading || isSubmitting) && (
                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center rounded-2xl">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            )}

            {/* スキャナーのモーダル表示 */}
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

            <header className="mb-2 text-center">
                <h1 className="text-xl font-bold text-gray-800">支出の入力</h1>
                <p className="text-sm text-gray-500 mt-1">手動で記録するか、レシートをスキャンします</p>
            </header>

            {/* スキャンへの導線 */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100 flex items-center justify-between shadow-sm">
                <div>
                    <h3 className="font-bold text-blue-800 text-sm">レシートがありますか？</h3>
                    <p className="text-xs text-blue-600 mt-1">AIが自動で読み取ります</p>
                </div>
                <button
                    type="button"
                    className="bg-blue-600 text-white rounded-full p-3 shadow-md hover:bg-blue-700 transition transform hover:scale-105 cursor-pointer"
                    onClick={() => setShowScanner(true)}
                >
                    <Camera size={20} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-2">
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
                    className="mt-4 w-full bg-gray-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-black transition-colors disabled:bg-gray-300 disabled:shadow-none"
                >
                    {isSubmitting ? '保存中...' : '記録する'}
                </button>
            </form>
        </div>
    );
}
