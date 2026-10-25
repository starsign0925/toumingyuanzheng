// 骰命远征 —— 战斗 AI（自动战斗 / 平衡模拟器共用，不依赖 cc）
// 贪心：枚举所有「卡牌 × 骰子」组合，按收益打分，每次打出最高分的一张。
import { RULES, slotOk } from './Data';
import type { CardDef } from './Data';
import { BattleCore } from './BattleCore';
import type { CardInst, DieT } from './BattleCore';

export interface AiMove { card: CardInst; die: DieT | null; }

/** 一颗骰子对手牌的「可用价值」：当前手牌里最好的非骰子牌能打出的收益。 */
function bestUse(core: BattleCore, v: number, skip: CardInst | null): number {
    let best = 0;
    for (const c of core.hand) {
        if (c === skip || c.def.type === 'dice' || !slotOk(c.def.slot, v)) { continue; }
        best = Math.max(best, payoff(core, c.def, v));
    }
    return best;
}

function incomingLeft(core: BattleCore): number {
    const it = core.intentDamage();
    return Math.max(0, it.dmg * it.hits - core.block);
}

/** 非骰子牌打出的估值。 */
function payoff(core: BattleCore, def: CardDef, X: number): number {
    const id = core.heroId;
    let bonus = 0;
    if (def.type === 'attack') {
        if (id === 'shadow' && X % 2 === 1) { bonus = RULES.shadowOddBonus; }
        if (id === 'pyro' && X === 6) { bonus = RULES.pyroSixBonus; }
    }
    const dmg = (n: number) => {
        const v = n + bonus;
        return v >= core.enemyHp + core.enemyBlock ? v + 30 : v; // 斩杀奖励
    };
    const blk = (n: number) => Math.min(n, incomingLeft(core)) * 1.1 + Math.max(0, n - incomingLeft(core)) *
        (id === 'bulwark' ? 0.45 : 0.1);
    const missing = core.hero.maxHp - core.hero.hp;
    const heal = (n: number) => Math.min(n, missing) * 0.9;
    switch (def.id) {
        case 'strike': return dmg(X);
        case 'defend': return blk(X);
        case 'heavy': return dmg(2 * X);
        case 'jab': return dmg(X + 4);
        case 'twin': case 'stab2': return dmg(2 * X + bonus); // 两段合计 2X+2×加成（斩杀按总伤判断）
        case 'guard': return blk(X + 5);
        case 'leech': return dmg(X) + heal(Math.ceil(X / 2));
        case 'starlight': return dmg(X + 4) + 2;
        case 'shieldbash': return dmg(X + Math.floor(core.block / 2));
        case 'bigshield': return blk(2 * X);
        case 'allin': return 6.5 + bonus;
        case 'venom': { const pz = Math.ceil(X / 2) + 1; return pz * Math.min(3, core.enemyHp / 10) * 1.2; }
        case 'shadowstep': return blk(X + 3) + 2;
        case 'judgment': return dmg(2 * X) + heal(2);
        case 'holylight': return dmg(X) + heal(Math.floor(X / 2));
        case 'fireball': return dmg(16);
        case 'gearshot': return dmg(2 * X + 4 + bonus);
    }
    return X;
}

/** 骰子牌（改变骰子）的估值：改动前后该骰子的可用价值差。 */
function diceGain(core: BattleCore, c: CardInst, d: DieT | null): number {
    const id = c.def.id;
    const freeCards = core.hand.filter((h) => h !== c && h.def.type !== 'dice').length;
    const extraDieWorth = freeCards > core.dice.length ? 6 : 0.5;
    if (id === 'lucky' || id === 'coin') { return extraDieWorth; }
    if (id === 'starfall') {
        const avg = core.dice.reduce((s, x) => s + x.value, 0) / Math.max(1, core.dice.length);
        return (3.5 - avg) * core.dice.length * 1.5;
    }
    if (!d) { return 0; }
    const cur = bestUse(core, d.value, c);
    const after = (v: number) => bestUse(core, v, c);
    switch (id) {
        case 'reroll': {
            let e = 0;
            for (let v = 1; v <= 6; v++) { e += after(v); }
            return e / 6 - cur;
        }
        case 'hone': return after(Math.min(6, d.value + 2)) - cur;
        case 'flip': return after(7 - d.value) - cur;
        case 'ignite': return after(Math.min(6, d.value + 3)) - cur;
        case 'transmute': return after(7 - d.value) - cur + 2;
        case 'split': return freeCards > core.dice.length
            ? after(Math.floor(d.value / 2)) + after(Math.ceil(d.value / 2)) - cur : -1;
        case 'replicate': return freeCards > core.dice.length ? cur : -1;
    }
    return 0;
}

// 选牌估值（模拟器用来模拟玩家拿牌）
const PICK: { [id: string]: number } = {
    heavy: 7, twin: 6, jab: 6, guard: 5, reroll: 4, hone: 5, flip: 5, split: 3, leech: 8, lucky: 7,
    starfall: 5, starlight: 7, shieldbash: 6, bigshield: 6, allin: 6, coin: 6, venom: 7, transmute: 5,
    stab2: 7, shadowstep: 6, judgment: 7, holylight: 7, fireball: 5, ignite: 6, replicate: 5, gearshot: 7,
};

/** 从奖励中挑一张；返回 null 表示跳过。 */
export function pickReward(options: string[], deckSize: number): string | null {
    let best: string | null = null, bv = 0;
    for (const id of options) {
        const v = PICK[id] || 3;
        if (v > bv) { bv = v; best = id; }
    }
    return deckSize >= 16 && bv < 7 ? null : best;
}

/** 规划下一步；返回 null 表示结束回合。 */
export function planMove(core: BattleCore): AiMove | null {
    let best: AiMove | null = null, bestScore = 0.01;
    for (const c of core.hand) {
        const opts: (DieT | null)[] = c.def.slot === 'none' ? [null] : core.dice;
        for (const d of opts) {
            if (!core.canPlay(c, d)) { continue; }
            let s: number;
            if (c.def.type === 'dice') {
                s = diceGain(core, c, d);
            } else {
                // 用掉这颗骰子的机会成本：它对其他牌的最佳价值
                const other = bestUse(core, d.value, c);
                s = payoff(core, c.def, d.value) - other * 0.25;
            }
            if (s > bestScore) { bestScore = s; best = { card: c, die: d }; }
        }
    }
    return best;
}
