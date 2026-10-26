// 烽火长歌 —— 骰子系统（纯规则，不依赖 Cocos）
// D20 决定成败；每名角色每回合独立 3D6 支付技能骰槽；D4–D12 结算伤害与治疗。

export type Rng = () => number;

export function roll(sides: number, rng: Rng): number {
    return 1 + Math.floor(rng() * sides);
}

export function rollSum(n: number, sides: number, rng: Rng): number {
    let s = 0;
    for (let i = 0; i < n; i++) { s += roll(sides, rng); }
    return s;
}

/** 骰子表达式：nDd+b（如 2D6+3）。 */
export interface DiceExpr { n: number; d: number; b?: number; }

/** 掷表达式；crit=true 时骰子数量翻倍（加值不翻倍）。 */
export function rollExpr(e: DiceExpr, rng: Rng, crit = false): number {
    return rollSum(crit ? e.n * 2 : e.n, e.d, rng) + (e.b || 0);
}

export function exprText(e: DiceExpr): string {
    const b = e.b || 0;
    return e.n + 'D' + e.d + (b > 0 ? '+' + b : b < 0 ? '' + b : '');
}

export function exprAvg(e: DiceExpr): number {
    return e.n * (e.d + 1) / 2 + (e.b || 0);
}

export interface D20Roll { rolls: number[]; nat: number; adv: number; }

/** D20：adv>0 优势（掷两次取高），adv<0 劣势（取低）；多个来源不叠加。 */
export function d20(rng: Rng, adv = 0): D20Roll {
    const a = roll(20, rng);
    if (adv === 0) { return { rolls: [a], nat: a, adv: 0 }; }
    const b = roll(20, rng);
    return { rolls: [a, b], nat: adv > 0 ? Math.max(a, b) : Math.min(a, b), adv: adv > 0 ? 1 : -1 };
}

// ---------------- 行动骰池与骰槽 ----------------

/** 骰槽条件。pair/triple/straight 为组合骰槽（需多颗骰子）；none = 不消耗骰子。 */
export type SlotT = 'any' | 'min4' | 'max3' | 'odd' | 'even' | 'six' | 'pair' | 'triple' | 'straight' | 'none';

export const SLOT_TEXT: { [k: string]: string } = {
    any: '任意', min4: '≥4', max3: '≤3', odd: '奇数', even: '偶数', six: '6',
    pair: '对子', triple: '三条', straight: '顺子', none: '无',
};

/** 骰槽需要的骰子数量。 */
export function slotSize(slot: SlotT): number {
    switch (slot) {
        case 'none': return 0;
        case 'pair': return 2;
        case 'triple': case 'straight': return 3;
        default: return 1;
    }
}

export function singleOk(slot: SlotT, v: number): boolean {
    switch (slot) {
        case 'any': return true;
        case 'min4': return v >= 4;
        case 'max3': return v <= 3;
        case 'odd': return v % 2 === 1;
        case 'even': return v % 2 === 0;
        case 'six': return v === 6;
    }
    return false;
}

/** 判断一组骰面是否恰好满足骰槽（数量必须一致）。 */
export function slotValid(slot: SlotT, vals: number[]): boolean {
    if (vals.length !== slotSize(slot)) { return false; }
    switch (slot) {
        case 'none': return true;
        case 'pair': return vals[0] === vals[1];
        case 'triple': return vals[0] === vals[1] && vals[1] === vals[2];
        case 'straight': {
            const s = vals.slice().sort((a, b) => a - b);
            return s[1] === s[0] + 1 && s[2] === s[1] + 1;
        }
        default: return singleOk(slot, vals[0]);
    }
}

/** 行动骰：归属于某名角色（owner），使用后 used=true，回合结束清空。 */
export interface Die { id: number; owner: string; value: number; used: boolean; }

function combos<T>(arr: T[], k: number): T[][] {
    const out: T[][] = [];
    const pick = (start: number, cur: T[]) => {
        if (cur.length === k) { out.push(cur.slice()); return; }
        for (let i = start; i < arr.length; i++) { cur.push(arr[i]); pick(i + 1, cur); cur.pop(); }
    };
    pick(0, []);
    return out;
}

/** 自动支付：从未使用的骰子中找出满足骰槽的一组（优先点数最高的组合）。 */
export function findPayment(slot: SlotT, dice: Die[]): Die[] | null {
    const n = slotSize(slot);
    if (n === 0) { return []; }
    const free = dice.filter((d) => !d.used).sort((a, b) => b.value - a.value);
    if (free.length < n) { return null; }
    for (const c of combos(free, n)) {
        if (slotValid(slot, c.map((d) => d.value))) { return c; }
    }
    return null;
}
