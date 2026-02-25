'use client';

import React, { useEffect, useState } from 'react';
import CategoryPieChart from "@/components/charts/CategoryPieChart";
import ProgressBar from "@/components/ui/ProgressBar";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ja } from "date-fns/locale";
import { supabase } from '@/lib/supabase/client';
import { Bell } from 'lucide-react';

export default function Home() {
  const currentDate = new Date();
  const currentMonthStr = format(currentDate, 'yyyy年 M月', { locale: ja });

  const [monthlyBudget, setMonthlyBudget] = useState(150000);
  const [currentSpend, setCurrentSpend] = useState(0);
  const [fixedCostTotal, setFixedCostTotal] = useState(0);
  const [upcomingFixedCosts, setUpcomingFixedCosts] = useState<{ name: string; amount: number; date_of_month: number }[]>([]);
  const [categoriesData, setCategoriesData] = useState<{ name: string, value: number, color: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 予算をlocalStorageから読み込み
  useEffect(() => {
    const saved = localStorage.getItem('snap_kakei_budget');
    if (saved) setMonthlyBudget(Number(saved));
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const startPath = format(startOfMonth(currentDate), 'yyyy-MM-dd');
        const endPath = format(endOfMonth(currentDate), 'yyyy-MM-dd');

        // 1. カテゴリ一覧を取得 (色のマッピング用)
        const { data: catsMap, error: catError } = await supabase
          .from('categories')
          .select('id, name, color') as { data: { id: string; name: string; color: string | null }[] | null, error: any };

        if (catError) throw catError;

        // 2. 今月の支出を取得
        const { data: txs, error: txError } = await supabase
          .from('transactions')
          .select('amount, category_id')
          .gte('date', startPath)
          .lte('date', endPath) as { data: { amount: number, category_id: string | null }[] | null, error: any };

        if (txError) throw txError;

        // 集計ロジック
        let total = 0;
        const categoryTotals: Record<string, number> = {};

        txs?.forEach(tx => {
          total += Number(tx.amount);
          if (tx.category_id) {
            categoryTotals[tx.category_id] = (categoryTotals[tx.category_id] || 0) + Number(tx.amount);
          }
        });

        // グラフ用データに成形
        const chartData = catsMap?.map(c => ({
          name: c.name,
          color: c.color || '#cccccc',
          value: categoryTotals[c.id || ''] || 0
        })).filter(c => c.value > 0) || []; // 値が0のカテゴリは非表示

        setCurrentSpend(total);
        setCategoriesData(chartData);

        // 3. 固定費を取得
        const { data: fixedCosts, error: fcError } = await supabase
          .from('fixed_costs')
          .select('name, amount, date_of_month') as { data: { name: string; amount: number; date_of_month: number }[] | null, error: any };
        if (fcError) throw fcError;
        const fcTotal = (fixedCosts || []).reduce((sum, fc) => sum + Number(fc.amount), 0);
        setFixedCostTotal(fcTotal);

        // 今月の残りの固定費（引落予定）を計算
        const today = new Date().getDate();
        const upcoming = (fixedCosts || [])
          .filter((fc: any) => fc.date_of_month >= today)
          .sort((a: any, b: any) => a.date_of_month - b.date_of_month)
          .slice(0, 3)
          .map((fc: any) => ({ name: fc.name, amount: fc.amount, date_of_month: fc.date_of_month }));
        setUpcomingFixedCosts(upcoming);

      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const totalMonthly = currentSpend + fixedCostTotal;
  const remainingBudget = Math.max(monthlyBudget - totalMonthly, 0);
  const isOverBudget = totalMonthly > monthlyBudget;

  return (
    <div className="p-6 pt-10 flex flex-col gap-6 animate-fade-in relative">

      {isLoading && (
        <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* ヘッダー部分 */}
      <header className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
            Snap Kakei
          </h1>
          <p className="text-sm text-gray-500 font-medium">{currentMonthStr}の家計簿</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm shadow-blue-200">
          <span className="text-lg">👤</span>
        </div>
      </header>

      {/* 残額サマリーカード */}
      <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-xs text-gray-500 font-semibold mb-1">
              {isOverBudget ? '予算超過額' : '今月使えるお金'}
            </p>
            <p className={`text-3xl font-extrabold tracking-tight ${isOverBudget ? 'text-red-600' : 'text-gray-900'}`}>
              ¥{Math.abs(monthlyBudget - totalMonthly).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400">予算 ¥{monthlyBudget.toLocaleString()}</p>
          </div>
        </div>

        <ProgressBar
          value={totalMonthly}
          max={monthlyBudget}
          colorClass={isOverBudget ? "bg-red-500" : "bg-gradient-to-r from-blue-500 to-indigo-500"}
        />

        <div className="flex justify-between mt-2">
          <span className="text-[10px] font-medium text-gray-500">
            支出 ¥{totalMonthly.toLocaleString()}
          </span>
          <span className={`text-[10px] font-medium ${isOverBudget ? 'text-red-500' : 'text-gray-500'}`}>
            {Math.round((totalMonthly / monthlyBudget) * 100)}% 消化
          </span>
        </div>

        {/* 内訳 */}
        <div className="flex justify-between mt-3 pt-3 border-t border-gray-100">
          <div className="text-center">
            <p className="text-[10px] text-gray-400">変動費</p>
            <p className="text-xs font-bold text-gray-700">¥{currentSpend.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-400">固定費</p>
            <p className="text-xs font-bold text-emerald-600">¥{fixedCostTotal.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-gray-400">合計</p>
            <p className="text-xs font-bold text-gray-800">¥{totalMonthly.toLocaleString()}</p>
          </div>
        </div>
      </section>

      {/* 次の固定費引落し予定 */}
      {upcomingFixedCosts.length > 0 && (
        <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
            <Bell size={14} className="text-amber-500" />
            今月の引落し予定
          </h2>
          <div className="flex flex-col gap-2">
            {upcomingFixedCosts.map((fc, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-md">
                    {fc.date_of_month}日
                  </span>
                  <span className="text-sm text-gray-700 font-medium">{fc.name}</span>
                </div>
                <span className="text-sm font-bold text-gray-800">¥{Number(fc.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* カテゴリ別支出チャート */}
      <section className="bg-white rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 mt-2">
        <h2 className="text-sm font-bold text-gray-800 mb-2">支出カテゴリ</h2>
        <CategoryPieChart data={categoriesData} />

        {/* レジェンド (カテゴリ一覧) */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {categoriesData.map(cat => (
            <div key={cat.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: cat.color }}
              />
              <div className="flex-1 flex justify-between">
                <span className="text-xs text-gray-600 font-medium truncate">{cat.name}</span>
                <span className="text-xs text-gray-800 font-bold ml-1">
                  ¥{cat.value.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
