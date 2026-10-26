// 烽火长歌 —— 判定规则（纯规则，不依赖 Cocos）：属性修正、DC、优势劣势、命中与豁免
import { d20 } from './DiceSystem';
import type { Rng, D20Roll } from './DiceSystem';

/** 属性修正值 = ⌊(属性值 − 10) ÷ 2⌋ */
export function mod(score: number): number {
    return Math.floor((score - 10) / 2);
}

export function signed(n: number): string {
    return n >= 0 ? '+' + n : '' + n;
}

/** 合并优势/劣势来源：同时存在则抵消；同向来源不叠加。 */
export function advOf(...sources: number[]): number {
    const a = sources.some((s) => s > 0), d = sources.some((s) => s < 0);
    return a === d ? 0 : a ? 1 : -1;
}

export interface CheckResult {
    roll: D20Roll;
    bonus: number;
    total: number;
    dc: number;
    success: boolean;
    crit: boolean;   // 天然 20
    fumble: boolean; // 天然 1
}

/** 检定 / 命中 / 豁免通用：D20 + 加值 ≥ DC。天然 20 必定成功（暴击），天然 1 必定失败。 */
export function check(bonus: number, dc: number, rng: Rng, adv = 0): CheckResult {
    const r = d20(rng, adv);
    const crit = r.nat === 20, fumble = r.nat === 1;
    const total = r.nat + bonus;
    return { roll: r, bonus, total, dc, success: crit || (!fumble && total >= dc), crit, fumble };
}

export function checkText(c: CheckResult): string {
    const nat = c.roll.rolls.length > 1 ? '[' + c.roll.rolls.join('/') + ']' : '' + c.roll.nat;
    return 'D20 ' + nat + signed(c.bonus) + '=' + c.total + ' vs ' + c.dc +
        (c.crit ? ' 大成功' : c.fumble ? ' 大失败' : c.success ? ' 成功' : ' 失败');
}

const DC_NAMES: [number, string][] = [[22, '极难'], [18, '很困难'], [15, '困难'], [12, '中等'], [10, '普通'], [0, '极易']];

export function dcName(dc: number): string {
    for (const [v, n] of DC_NAMES) { if (dc >= v) { return n; } }
    return '极易';
}

/** 成功概率（用于 AI 估值与 UI 提示）。 */
export function successChance(bonus: number, dc: number, adv = 0): number {
    const p = Math.min(0.95, Math.max(0.05, (21 - (dc - bonus)) / 20));
    return adv > 0 ? 1 - (1 - p) * (1 - p) : adv < 0 ? p * p : p;
}
