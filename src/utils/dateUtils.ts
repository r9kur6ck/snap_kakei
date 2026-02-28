import { format, addMonths, subMonths, setDate, subDays } from 'date-fns';

/**
 * 指定された集計開始日 (startDay) に基づいて、
 * 基準日 (referenceDate) が属する「請求サイクル期間」の開始日と終了日を返す。
 *
 * 例:
 *   startDay = 25, referenceDate = 3月10日 → { start: 2月25日, end: 3月24日 }
 *   startDay = 25, referenceDate = 3月26日 → { start: 3月25日, end: 4月24日 }
 *   startDay = 1  (デフォルト)             → 従来の月初〜月末と同等
 *
 * @param referenceDate 基準となる日付（通常は「今日」）
 * @param startDay 集計開始日（1〜28）
 * @returns { start: Date, end: Date, startPath: string, endPath: string }
 */
export function getBillingPeriod(referenceDate: Date, startDay: number = 1) {
    const safeStartDay = Math.max(1, Math.min(28, startDay));

    let periodStart: Date;

    if (safeStartDay === 1) {
        // 従来通り: 月初〜月末
        periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    } else {
        // referenceDate の日が startDay 以上なら、当月の startDay が開始日
        // referenceDate の日が startDay 未満なら、前月の startDay が開始日
        if (referenceDate.getDate() >= safeStartDay) {
            periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), safeStartDay);
        } else {
            periodStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, safeStartDay);
        }
    }

    // 終了日 = 次の期間の開始日の前日
    const nextPeriodStart = addMonths(periodStart, 1);
    const periodEnd = subDays(nextPeriodStart, 1);

    return {
        start: periodStart,
        end: periodEnd,
        startPath: format(periodStart, 'yyyy-MM-dd'),
        endPath: format(periodEnd, 'yyyy-MM-dd'),
    };
}

/**
 * 指定された期間をN期間分前後にずらす。
 * 分析画面の月送り（前月・翌月）に使用。
 *
 * @param currentPeriodStart 現在の期間の開始日
 * @param startDay 集計開始日（1〜28）
 * @param offset ずらす月数（-1 = 前月, +1 = 翌月）
 */
export function shiftBillingPeriod(currentPeriodStart: Date, startDay: number, offset: number) {
    const shifted = addMonths(currentPeriodStart, offset);
    return getBillingPeriod(shifted, startDay);
}

/**
 * ある期間内に含まれる固定費の支払日かどうかを判定するヘルパー。
 * 固定費リマインダー表示などに使用。
 *
 * @param dateOfMonth 固定費の支払日 (1〜31)
 * @param periodStart 集計期間の開始日
 * @param periodEnd 集計期間の終了日
 * @param today 今日の日付
 * @returns 今日以降で期間内に支払い予定がある場合 true
 */
export function isFixedCostUpcoming(
    dateOfMonth: number,
    periodStart: Date,
    periodEnd: Date,
    today: Date
): boolean {
    // periodStart〜periodEnd のそれぞれの月について確認
    const months: Date[] = [];
    let cursor = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
    const endCursor = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
    while (cursor <= endCursor) {
        months.push(new Date(cursor));
        cursor = addMonths(cursor, 1);
    }

    for (const m of months) {
        const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
        const actualDay = Math.min(dateOfMonth, daysInMonth);
        const paymentDate = new Date(m.getFullYear(), m.getMonth(), actualDay);
        if (paymentDate >= periodStart && paymentDate <= periodEnd && paymentDate >= today) {
            return true;
        }
    }
    return false;
}

/**
 * 期間のラベルを生成する（例: "2/25 〜 3/24"）
 */
export function getBillingPeriodLabel(start: Date, end: Date): string {
    return `${format(start, 'M/d')} 〜 ${format(end, 'M/d')}`;
}
