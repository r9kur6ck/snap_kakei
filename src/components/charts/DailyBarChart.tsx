'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

interface DailyBarChartProps {
    data: { day: string; amount: number }[];
}

export default function DailyBarChart({ data }: DailyBarChartProps) {
    if (data.length === 0) {
        return (
            <div className="h-48 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <p className="text-gray-400 font-medium text-sm">データがありません</p>
            </div>
        );
    }

    return (
        <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                        formatter={(value: number | undefined) => [`¥${(value || 0).toLocaleString()}`, '支出'] as [string, string]}
                        contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            fontSize: '12px',
                        }}
                        labelFormatter={(label) => `${label}日`}
                    />
                    <Bar
                        dataKey="amount"
                        fill="url(#barGradient)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={20}
                    />
                    <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                    </defs>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
