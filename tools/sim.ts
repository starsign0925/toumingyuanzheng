// 骰命远征 —— 平衡性模拟器（单人冒险 · 骰子卡牌）
// 用与游戏完全相同的 BattleCore + BattleAI 批量跑远征，输出各英雄通关率。
import { BattleCore } from '../assets/scripts/BattleCore';
import { planMove, pickReward } from '../assets/scripts/BattleAI';
import {
    HEROES, NORMAL_ENEMIES, ELITES, BOSS, RULES, makeHero, starterDeck, rewardOptions,
} from '../assets/scripts/Data';
import type { EnemyDef, HeroDef, HeroInst, RunBuffs } from '../assets/scripts/Data';

declare const process: { argv: string[] };
declare const console: { log: (...a: unknown[]) => void };

function mulberry32(seed: number) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const STAT = { fights: 0, rounds: 0, plays: 0 };

function fight(hero: HeroInst, deck: string[], enemy: EnemyDef, buffs: RunBuffs, rng: () => number): boolean {
    const core = new BattleCore(hero, deck, enemy, buffs, rng);
    STAT.fights++;
    for (let round = 0; round < 60; round++) {
        core.startTurn();
        for (let step = 0; step < 30; step++) {
            const m = planMove(core);
            if (!m) { break; }
            core.play(m.card, m.die);
            STAT.plays++;
            if (core.enemyHp <= 0) { STAT.rounds += core.round; return true; }
        }
        const r = core.endTurn();
        if (r.enemyDead) { STAT.rounds += core.round; return true; }
        if (r.heroDead) { return false; }
    }
    return false;
}

// 典型路线：8 个节点（与地图生成的平均构成接近）
const ROUTE = ['battle', 'battle', 'event', 'elite', 'battle', 'rest', 'elite', 'boss'];

interface RunOut { cleared: boolean; depth: number; diedAt: string; deck: number; }

function run(def: HeroDef, rng: () => number): RunOut {
    const hero = makeHero(def);
    const deck = starterDeck(def);
    const buffs: RunBuffs = { extraDie: 0 };
    let depth = 0;
    for (const node of ROUTE) {
        let enemy: EnemyDef | null = null;
        if (node === 'battle') { enemy = NORMAL_ENEMIES[Math.floor(rng() * NORMAL_ENEMIES.length)]; }
        if (node === 'elite') { enemy = ELITES[Math.floor(rng() * ELITES.length)]; }
        if (node === 'boss') { enemy = BOSS; }
        if (node === 'event') { hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.2); }
        if (node === 'rest') {
            if (hero.hp < hero.maxHp * 0.7) {
                hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * RULES.restHealPct);
            } else {
                const i = deck.indexOf('strike');
                if (i >= 0) { deck.splice(i, 1); }
            }
        }
        if (enemy) {
            if (!fight(hero, deck, enemy, buffs, rng)) {
                return { cleared: false, depth, diedAt: enemy.id, deck: deck.length };
            }
            if (def.id === 'cleric') { hero.hp = Math.min(hero.maxHp, hero.hp + RULES.clericWinHeal); }
            if (node !== 'boss') {
                const pick = pickReward(rewardOptions(def.id, rng, node === 'elite'), deck.length);
                if (pick) { deck.push(pick); }
            }
        }
        depth++;
    }
    return { cleared: true, depth, diedAt: '', deck: deck.length };
}

function pct(n: number, d: number): string {
    return (d === 0 ? 0 : (100 * n / d)).toFixed(1).padStart(5) + '%';
}

function duel(def: HeroDef, e: EnemyDef, n: number, rng: () => number): number {
    let w = 0;
    for (let i = 0; i < n; i++) {
        if (fight(makeHero(def), starterDeck(def), e, { extraDie: 0 }, rng)) { w++; }
    }
    return w / n;
}

function calibrate(target: number, runs: number) {
    console.log('=== 生命校准：通关率目标 ' + (target * 100).toFixed(0) + '%（每次评估 ' + runs + ' 局，固定种子） ===');
    for (const def of HEROES) {
        const rate = (hp: number) => {
            const rng = mulberry32(777);
            const d = { ...def, maxHp: Math.round(hp) };
            let c = 0;
            for (let i = 0; i < runs; i++) { if (run(d, rng).cleared) { c++; } }
            return c / runs;
        };
        let lo = 20, hi = 200;
        for (let it = 0; it < 12; it++) {
            const mid = (lo + hi) / 2;
            if (rate(mid) < target) { lo = mid; } else { hi = mid; }
        }
        const sug = Math.round(hi);
        console.log(def.name.padEnd(6, '　') + ' 当前HP ' + String(def.maxHp).padStart(3) +
            ' → 建议HP ' + String(sug).padStart(3) + '（该值通关率 ' + (rate(sug) * 100).toFixed(1) + '%）');
    }
}

function main() {
    if (process.argv[3] === 'calib') {
        calibrate(parseFloat(process.argv[4] || '0.5'), parseInt(process.argv[2] || '600', 10));
        return;
    }
    const N = parseInt(process.argv[2] || '3000', 10);
    const rng = mulberry32(20261025);
    const all = [...NORMAL_ENEMIES, ...ELITES, BOSS];
    console.log('=== 单人远征（每英雄 ' + N + ' 局） ===');
    console.log('英雄        通关率  平均进度  死因分布(普通/精英/首领) | 初始牌组满血单挑：' + all.map((e) => e.id).join(' / ') +
        ' | 每战回合 出牌');
    const rates: number[] = [];
    for (const def of HEROES) {
        STAT.fights = 0; STAT.rounds = 0; STAT.plays = 0;
        let clear = 0, depth = 0;
        const death = { n: 0, e: 0, b: 0 };
        for (let i = 0; i < N; i++) {
            const r = run(def, rng);
            if (r.cleared) { clear++; } else if (r.diedAt === 'boss') { death.b++; }
            else if (r.diedAt === 'lich' || r.diedAt === 'troll') { death.e++; } else { death.n++; }
            depth += r.depth;
        }
        const wins = STAT.fights;
        const avgRounds = STAT.rounds / Math.max(1, wins);
        const avgPlays = STAT.plays / Math.max(1, wins);
        const duels = all.map((e) => pct(duel(def, e, Math.max(200, N >> 3), rng), 1).replace('%', '') + '%');
        rates.push(clear / N);
        console.log(def.name.padEnd(6, '　') + pct(clear, N) + '   ' + (depth / N).toFixed(2) + '/8   ' +
            pct(death.n, N) + pct(death.e, N) + pct(death.b, N) + ' | ' + duels.join(' ') +
            ' | ' + avgRounds.toFixed(1) + ' ' + avgPlays.toFixed(1));
    }
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    console.log('平均通关率 ' + (mean * 100).toFixed(1) + '%，最强-最弱差距 ' +
        ((Math.max(...rates) - Math.min(...rates)) * 100).toFixed(1) + ' 个百分点');
}

main();
