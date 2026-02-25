import React from 'react';

interface ProgressBarProps {
    value: number;
    max: number;
    colorClass?: string;
    bgColorClass?: string;
}

export default function ProgressBar({
    value,
    max,
    colorClass = 'bg-blue-500',
    bgColorClass = 'bg-gray-100',
}: ProgressBarProps) {
    // 最低0%、最高100%に制限
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    // 予算オーバーの場合は赤色にするなどのロジックも追加可能
    const isOverBudget = value > max;
    const activeColorClass = isOverBudget ? 'bg-red-500' : colorClass;

    return (
        <div className={`w-full h-3 rounded-full overflow-hidden ${bgColorClass}`}>
            <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${activeColorClass}`}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}
