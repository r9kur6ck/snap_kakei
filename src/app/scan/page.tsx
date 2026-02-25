'use client';

import React, { useState, useEffect } from 'react';
import { Camera, Clock, ChevronRight, Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import ReceiptScanner, { OcrResult } from '@/components/ReceiptScanner';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface ScanHistoryItem {
    id: string;
    store_name: string | null;
    item_name: string | null;
    amount: number;
    date: string;
    created_at: string;
}

export default function ScanPage() {
    const router = useRouter();
    const [showScanner, setShowScanner] = useState(false);
    const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // 最近のスキャン履歴を取得（直近20件）
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const { data } = await supabase
                    .from('transactions')
                    .select('id, store_name, item_name, amount, date, created_at')
                    .order('created_at', { ascending: false })
                    .limit(20) as { data: ScanHistoryItem[] | null };
                setScanHistory(data || []);
            } catch (err) {
                console.error('Failed to fetch scan history:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, []);

    // スキャン完了ハンドラ
    const handleScanComplete = (result: OcrResult) => {
        setShowScanner(false);

        // 結果をlocalStorageに保存して入力ページに渡す
        localStorage.setItem('scan_result', JSON.stringify(result));
        router.push('/input?from=scan');
    };

    if (showScanner) {
        return (
            <div className="p-6 pt-10 animate-fade-in">
                <ReceiptScanner
                    onScanComplete={handleScanComplete}
                    onCancel={() => setShowScanner(false)}
                />
            </div>
        );
    }

    return (
        <div className="p-6 pt-10 flex flex-col gap-6 animate-fade-in">
            {/* ヘッダー */}
            <header>
                <h1 className="text-2xl font-extrabold text-gray-900">📸 スキャン</h1>
                <p className="text-xs text-gray-500 mt-1">レシートを撮影してAIが自動読み取り</p>
            </header>

            {/* スキャン開始ボタン */}
            <button
                onClick={() => setShowScanner(true)}
                className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-lg flex flex-col items-center gap-3 hover:from-blue-700 hover:to-indigo-700 transition-all active:scale-[0.98]"
            >
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                    <Camera size={32} />
                </div>
                <div>
                    <p className="text-lg font-bold">レシートをスキャン</p>
                    <p className="text-xs text-blue-100">カメラまたは写真から読み取り</p>
                </div>
            </button>

            {/* 使い方ガイド */}
            <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                <h2 className="text-sm font-bold text-gray-800 mb-3">💡 使い方</h2>
                <div className="flex flex-col gap-2.5">
                    {[
                        { step: '1', text: 'スキャンボタンをタップ', sub: 'カメラまたはアルバムから選択' },
                        { step: '2', text: 'レシートを撮影', sub: '明るい場所で全体が映るように' },
                        { step: '3', text: 'AIが自動読み取り', sub: '店名・金額・品目を抽出' },
                        { step: '4', text: '入力画面で確認・保存', sub: '内容を確認して記録' },
                    ].map(item => (
                        <div key={item.step} className="flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {item.step}
                            </span>
                            <div>
                                <p className="text-sm font-semibold text-gray-800">{item.text}</p>
                                <p className="text-[10px] text-gray-400">{item.sub}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* スキャン履歴（最近の取引） */}
            <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                        <Clock size={14} className="text-gray-500" />
                        最近の記録
                    </h2>
                    <button
                        onClick={() => router.push('/analytics')}
                        className="text-[10px] text-blue-500 font-semibold flex items-center gap-0.5 hover:text-blue-600"
                    >
                        すべて見る <ChevronRight size={12} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="text-center py-6">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                ) : scanHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs">まだ記録がありません</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {scanHistory.slice(0, 8).map(item => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">
                                        {item.item_name || item.store_name || '不明'}
                                    </p>
                                    <p className="text-[10px] text-gray-400">
                                        {format(new Date(item.date), 'M/d (E)', { locale: ja })}
                                        {item.store_name && item.item_name ? ` · ${item.store_name}` : ''}
                                    </p>
                                </div>
                                <span className="text-sm font-bold text-gray-800 flex-shrink-0 ml-2">
                                    ¥{Number(item.amount).toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
