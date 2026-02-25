'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

interface MonthlyLineChartProps {
    data: { month: string; amount: number }[];
}

export default function MonthlyLineChart({ data }: MonthlyLineChartProps) {
    if (data.length === 0) {
        return (
            <div className="h-48 flex items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <p className="text-gray-400 font-medium text-sm">データがありません</p>
            </div>
        );
    }

    return (
        <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`}
                    />
                    <Tooltip
                        formatter={(value: number | undefined) => [`¥${(value || 0).toLocaleString()}`, '支出'] as [string, string]}
                        contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            fontSize: '12px',
                        }}
                        labelFormatter={(label) => `${label}`}
                    />
                    <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="url(#lineGradient)"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                    />
                    <defs>
                        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                    </defs>
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
