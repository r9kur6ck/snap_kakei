'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

type CategoryData = {
    name: string;
    value: number;
    color: string;
};

interface CategoryPieChartProps {
    data: CategoryData[];
}

export default function CategoryPieChart({ data }: CategoryPieChartProps) {
    // データの合計が0の場合は「データなし」表示にする
    const total = data.reduce((sum, item) => sum + item.value, 0);

    if (total === 0) {
        return (
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl my-4 border border-dashed border-gray-300">
                <p className="text-gray-400 font-medium">支出データがありません</p>
            </div>
        );
    }

    return (
        <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        formatter={(value: number | undefined) => [`¥ ${(value || 0).toLocaleString()}`, '金額'] as [string, string]}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                </PieChart>
            </ResponsiveContainer>

            {/* グラフ中央のテキスト */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs text-gray-500 font-medium">今月の支出</span>
                <span className="text-lg font-bold text-gray-800">
                    ¥{total.toLocaleString()}
                </span>
            </div>
        </div>
    );
}
