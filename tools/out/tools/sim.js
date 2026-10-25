"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 骰命远征 —— 平衡性模拟器（单人冒险 · 骰子卡牌）
// 用与游戏完全相同的 BattleCore + BattleAI 批量跑远征，输出各英雄通关率。
const BattleCore_1 = require("../assets/scripts/BattleCore");
const BattleAI_1 = require("../assets/scripts/BattleAI");
const Data_1 = require("../assets/scripts/Data");
function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const STAT = { fights: 0, rounds: 0, plays: 0 };
function fight(hero, deck, enemy, buffs, rng, entry) {
    const core = new BattleCore_1.BattleCore(hero, deck, enemy, buffs, rng, entry);
    STAT.fights++;
    for (let round = 0; round < 60; round++) {
        core.startTurn();
        for (let step = 0; step < 30; step++) {
            const m = (0, BattleAI_1.planMove)(core);
            if (!m) {
                break;
            }
            core.play(m.card, m.die);
            STAT.plays++;
            if (core.enemyHp <= 0) {
                STAT.rounds += core.round;
                return true;
            }
        }
        const r = core.endTurn();
        if (r.enemyDead) {
            STAT.rounds += core.round;
            return true;
        }
        if (r.heroDead) {
            return false;
        }
    }
    return false;
}
// 每关典型路线：5 个节点 + 首领（与地图生成的平均构成接近）
const STAGE_ROUTE = ['battle', 'battle', 'event', 'elite', 'rest', 'boss'];
function run(def, rng) {
    const hero = (0, Data_1.makeHero)(def);
    const deck = (0, Data_1.starterDeck)(def);
    const buffs = { extraDie: 0 };
    let depth = 0;
    for (let s = 0; s < Data_1.STAGES.length; s++) {
        for (const node of STAGE_ROUTE) {
            let enemy = null;
            if (node === 'battle') {
                enemy = (0, Data_1.scaleEnemy)(Data_1.NORMAL_ENEMIES[Math.floor(rng() * Data_1.NORMAL_ENEMIES.length)], s);
            }
            if (node === 'elite') {
                enemy = (0, Data_1.scaleEnemy)(Data_1.ELITES[Math.floor(rng() * Data_1.ELITES.length)], s);
            }
            if (node === 'boss') {
                enemy = Data_1.STAGES[s].boss;
            }
            if (node === 'event') {
                hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.2);
            }
            if (node === 'rest') {
                if (hero.hp < hero.maxHp * 0.7) {
                    hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * Data_1.RULES.restHealPct);
                }
                else {
                    const i = deck.indexOf('strike');
                    if (i >= 0) {
                        deck.splice(i, 1);
                    }
                }
            }
            if (enemy) {
                const tier = (0, Data_1.fateTier)(1 + Math.floor(rng() * 6));
                if (!fight(hero, deck, enemy, buffs, rng, (0, Data_1.fateBattleEntry)(node, tier))) {
                    return { cleared: false, depth, diedAt: enemy.id, deck: deck.length };
                }
                if (def.id === 'cleric') {
                    hero.hp = Math.min(hero.maxHp, hero.hp + Data_1.RULES.clericWinHeal);
                }
                if (node === 'boss' && s < Data_1.STAGES.length - 1) {
                    hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.4); // 过关恢复 40%
                }
                if (node !== 'boss') {
                    let rt = tier;
                    if (node === 'elite' && rt < 3) {
                        rt += 1;
                    }
                    const picks = (0, BattleAI_1.pickRewards)((0, Data_1.rewardOptions)(def.id, rng, rt === 3), deck.length, rt === 2 ? 2 : 1);
                    for (const p of picks) {
                        deck.push(p);
                    }
                }
            }
            depth++;
        }
    }
    return { cleared: true, depth, diedAt: '', deck: deck.length };
}
function pct(n, d) {
    return (d === 0 ? 0 : (100 * n / d)).toFixed(1).padStart(5) + '%';
}
function duel(def, e, n, rng) {
    let w = 0;
    for (let i = 0; i < n; i++) {
        if (fight((0, Data_1.makeHero)(def), (0, Data_1.starterDeck)(def), e, { extraDie: 0 }, rng)) {
            w++;
        }
    }
    return w / n;
}
function calibrate(target, runs) {
    console.log('=== 生命校准：通关率目标 ' + (target * 100).toFixed(0) + '%（每次评估 ' + runs + ' 局，固定种子） ===');
    for (const def of Data_1.HEROES) {
        const rate = (hp) => {
            const rng = mulberry32(777);
            const d = { ...def, maxHp: Math.round(hp) };
            let c = 0;
            for (let i = 0; i < runs; i++) {
                if (run(d, rng).cleared) {
                    c++;
                }
            }
            return c / runs;
        };
        let lo = 20, hi = 200;
        for (let it = 0; it < 12; it++) {
            const mid = (lo + hi) / 2;
            if (rate(mid) < target) {
                lo = mid;
            }
            else {
                hi = mid;
            }
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
    const all = [...Data_1.NORMAL_ENEMIES, ...Data_1.ELITES, Data_1.BOSS];
    console.log('=== 单人远征（每英雄 ' + N + ' 局） ===');
    console.log('英雄        通关率  平均进度  死因分布(普通/精英/首领) | 初始牌组满血单挑：' + all.map((e) => e.id).join(' / ') +
        ' | 每战回合 出牌');
    const rates = [];
    for (const def of Data_1.HEROES) {
        STAT.fights = 0;
        STAT.rounds = 0;
        STAT.plays = 0;
        let clear = 0, depth = 0;
        const death = { n: 0, e: 0, b: 0 };
        for (let i = 0; i < N; i++) {
            const r = run(def, rng);
            if (r.cleared) {
                clear++;
            }
            else if (Data_1.STAGES.some((st) => st.boss.id === r.diedAt)) {
                death.b++;
            }
            else if (r.diedAt === 'lich' || r.diedAt === 'troll') {
                death.e++;
            }
            else {
                death.n++;
            }
            depth += r.depth;
        }
        const wins = STAT.fights;
        const avgRounds = STAT.rounds / Math.max(1, wins);
        const avgPlays = STAT.plays / Math.max(1, wins);
        const duels = all.map((e) => pct(duel(def, e, Math.max(200, N >> 3), rng), 1).replace('%', '') + '%');
        rates.push(clear / N);
        console.log(def.name.padEnd(6, '　') + pct(clear, N) + '   ' + (depth / N).toFixed(2) + '/24   ' +
            pct(death.n, N) + pct(death.e, N) + pct(death.b, N) + ' | ' + duels.join(' ') +
            ' | ' + avgRounds.toFixed(1) + ' ' + avgPlays.toFixed(1));
    }
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    console.log('平均通关率 ' + (mean * 100).toFixed(1) + '%，最强-最弱差距 ' +
        ((Math.max(...rates) - Math.min(...rates)) * 100).toFixed(1) + ' 个百分点');
}
main();
