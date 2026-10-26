// 烽火长歌 —— 平衡模拟器 + 第一阶段验收自测（复用游戏的 BattleCore / BattleAI / Data）
// 用法：sim.ps1 [每阵容局数] [report|selftest]
import { makeHero, heroById, encounter, STAGES, RULES, rewardOptions, applyReward, PARTY_NOTES, weaponById } from '../assets/scripts/Data';
import type { HeroInst, NodeKind, EnemyDef } from '../assets/scripts/Data';
import { BattleCore } from '../assets/scripts/BattleCore';
import { planStep, runPlan, pickReward } from '../assets/scripts/BattleAI';
import { slotValid, findPayment } from '../assets/scripts/DiceSystem';
import type { Die } from '../assets/scripts/DiceSystem';
import { mod } from '../assets/scripts/RuleResolver';

declare const process: { argv: string[] };
declare const console: { log: (...a: unknown[]) => void };

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function fight(party: HeroInst[], enemies: EnemyDef[], rng: () => number): { won: boolean; rounds: number } {
    const core = new BattleCore(party, enemies, rng);
    if (!core.initiative().success) { core.endRound(); }
    while (!core.over && core.round < 40) {
        core.startRound();
        for (let guard = 0; guard < 30 && !core.over; guard++) {
            const p = planStep(core);
            if (!p || !runPlan(core, p)) { break; }
        }
        if (core.over) { break; }
        core.endRound();
    }
    return { won: core.over === 'win', rounds: core.round };
}

const STAGE_ROUTE: NodeKind[] = ['battle', 'battle', 'event', 'elite', 'rest', 'boss'];

interface RunOut { cleared: boolean; depth: number; diedAt: string; rounds: number; fights: number; }

function run(ids: string[], rng: () => number): RunOut {
    const party = ids.map((id) => makeHero(heroById(id)));
    let depth = 0, rounds = 0, fights = 0;
    for (let s = 0; s < STAGES.length; s++) {
        for (const node of STAGE_ROUTE) {
            if (node === 'battle' || node === 'elite' || node === 'boss') {
                const r = fight(party, encounter(node, s, rng), rng);
                rounds += r.rounds; fights++;
                if (!r.won) { return { cleared: false, depth, diedAt: node, rounds, fights }; }
                for (const h of party) {
                    h.hp = h.hp <= 0 ? RULES.reviveHp : Math.min(h.maxHp, h.hp + Math.round(h.maxHp * RULES.battleHeal));
                }
                if (node !== 'boss') {
                    applyReward(party, pickReward(party, rewardOptions(party, rng, node === 'elite' ? 1 : 0)));
                }
            } else if (node === 'event') {
                for (const h of party) { h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * 0.1)); }
            } else if (node === 'rest') {
                for (const h of party) { h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * RULES.restHeal)); }
            }
            depth++;
        }
        for (const h of party) { h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * RULES.stageHeal)); }
    }
    return { cleared: true, depth, diedAt: '', rounds, fights };
}

function pct(n: number, d: number): string { return ((100 * n) / Math.max(1, d)).toFixed(1).padStart(5) + '%'; }

function report(N: number) {
    console.log('\n=== 三人远征（每阵容 ' + N + ' 局，四区 × 6 节点 = 24） ===');
    console.log('阵容                    通关率   平均进度   死因(普通/精英/首领)   每战回合');
    let sum = 0;
    const rates: number[] = [];
    PARTY_NOTES.forEach((pn, pi) => {
        const rng = mulberry32(1000 + pi);
        let clear = 0, depth = 0, rounds = 0, fights = 0;
        const death: { [k: string]: number } = { battle: 0, elite: 0, boss: 0 };
        for (let i = 0; i < N; i++) {
            const r = run(pn.ids, rng);
            if (r.cleared) { clear++; } else { death[r.diedAt]++; }
            depth += r.depth; rounds += r.rounds; fights += r.fights;
        }
        const name = pn.ids.map((id) => heroById(id).name).join('+');
        rates.push(clear / N);
        sum += clear / N;
        console.log(name.padEnd(14, '　') + pct(clear, N) + '   ' + (depth / N).toFixed(1).padStart(5) + '/24   ' +
            pct(death.battle, N) + pct(death.elite, N) + pct(death.boss, N) + '   ' + (rounds / Math.max(1, fights)).toFixed(1));
    });
    console.log('平均通关率 ' + (100 * sum / PARTY_NOTES.length).toFixed(1) + '%，最强-最弱差距 ' +
        (100 * (Math.max(...rates) - Math.min(...rates))).toFixed(1) + ' 个百分点');
}

// ---------------- 第一阶段验收自测 ----------------

function selftest() {
    let pass = 0, fail = 0;
    const ok = (cond: boolean, msg: string) => {
        if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); }
    };
    const rng = mulberry32(7);
    const dummy: EnemyDef = {
        id: 'dummy', name: '木桩', visual: 'golem', maxHp: 100000, ac: 1, atk: 0, save: -10, insight: 1,
        gold: [0, 0], desc: '', pattern: [{ type: 'block', block: 0 }],
    };
    const mk = () => new BattleCore(['pei', 'shen', 'ye'].map((id) => makeHero(heroById(id))), [dummy, dummy], rng);
    const setDice = (core: BattleCore, hi: number, vals: number[]) => {
        core.heroes[hi].dice = vals.map((v, i) => ({ id: 900 + hi * 10 + i, owner: core.heroes[hi].inst.def.id, value: v, used: false }));
    };

    // 1. 骰子不会跨角色串用
    {
        const c = mk(); c.startRound();
        setDice(c, 0, [2, 2, 2]); setDice(c, 1, [6, 6, 6]);
        ok(c.act(0, 'guard', [c.heroes[1].dice[0].id]) === null, '裴烈不能使用沈知远的骰子');
        ok(c.heroes[1].dice.every((d) => !d.used), '非法支付不消耗他人骰子');
        ok(c.heroes[0].bonus === true, '非法支付不消耗行动');
        const r = c.act(0, 'guard', [c.heroes[0].dice[0].id]);
        ok(!!r, '使用自己的骰子成功');
        ok(c.act(1, 'insight', [c.heroes[0].dice[1].id]) === null, '沈知远不能使用裴烈的骰子');
        ok(c.heroes[0].dice.filter((d) => d.used).length === 1, '同一颗骰子只被消费一次');
    }
    // 2. 行动不会超限
    {
        const c = mk(); c.startRound();
        setDice(c, 0, [5, 5, 1]);
        ok(!!c.act(0, 'attack', [], 0), '主要行动：普通攻击');
        ok(c.act(0, 'cleave', undefined, 0) === null, '第二次主要行动被拒绝');
        ok(!!c.act(0, 'guard'), '附赠行动：格挡（≤3）');
        ok(c.act(0, 'protect') === null, '第二次附赠行动被拒绝');
        ok(!!c.move(0) && c.move(0) === null, '每回合只能移动一次');
        setDice(c, 2, [6, 4, 3]);
        const used = c.heroes[2].dice.filter((d) => d.used).length;
        ok(c.act(2, 'guard') === null && c.heroes[2].dice.filter((d) => d.used).length === used, '不能使用别人的职业技能');
    }
    // 3. 骰槽与组合识别
    ok(slotValid('pair', [3, 3]) && !slotValid('pair', [3, 4]), '对子识别');
    ok(slotValid('triple', [5, 5, 5]) && !slotValid('triple', [5, 5, 4]), '三条识别');
    ok(slotValid('straight', [4, 2, 3]) && !slotValid('straight', [1, 2, 4]), '顺子识别');
    ok(slotValid('min4', [4]) && !slotValid('min4', [3]) && slotValid('six', [6]) && !slotValid('odd', [2]), '单骰骰槽');
    {
        const ds: Die[] = [{ id: 1, owner: 'a', value: 2, used: false }, { id: 2, owner: 'a', value: 2, used: true }];
        ok(findPayment('pair', ds) === null, '已用骰子不参与组合支付');
    }
    // 4. 伤害结算正确（范围检查）
    {
        let bad = 0;
        for (let i = 0; i < 4000; i++) {
            const c = mk(); c.startRound();
            const h = c.heroes[0], w = weaponById(h.inst.weapon.id);
            const m = mod(h.inst.def.attrs.str);
            const r = c.act(0, 'attack', [], 0);
            const a = r.fx.find((f) => f.k === 'atk') as { hit: boolean; crit: boolean; dmg: number };
            if (a.hit) {
                const max = w.die * (a.crit ? 2 : 1) + m, min = Math.max(1, (a.crit ? 2 : 1) + m);
                if (a.dmg < min || a.dmg > max) { bad++; }
            } else if (a.dmg !== 0) { bad++; }
        }
        ok(bad === 0, '普通攻击伤害始终在 [骰数+修正, 骰面×骰数+修正] 内（异常 ' + bad + '）');
        let bad2 = 0;
        for (let i = 0; i < 2000; i++) {
            const c = mk(); c.startRound();
            setDice(c, 2, [6, 1, 1]);
            const r = c.act(2, 'pierce', undefined, 0);
            const a = r.fx.find((f) => f.k === 'atk') as { dmg: number };
            const m = mod(17); // 叶青敏捷
            if (a.dmg < 2 + m + 6 || a.dmg > 16 + m + 6 + 4) { bad2++; }
        }
        ok(bad2 === 0, '穿云箭必中且伤害 = 2×武器骰 + 修正 + X（+山林猎手 1D4）（异常 ' + bad2 + '）');
    }
    // 5. 状态上限与震慑免疫
    {
        const c = mk(); c.startRound();
        c.addStatus('enemy', 0, 'bleed', 20, []);
        ok(c.enemies[0].status.bleed === 10, '流血层数上限 10');
        c.addStatus('enemy', 0, 'stun', 1, []);
        c.endRound();
        ok(c.enemies[0].stunImm && !c.enemies[0].status.stun, '震慑后获得免疫');
        c.startRound();
        setDice(c, 1, [3, 3, 1]);
        const r = c.act(1, 'chain', undefined, 0);
        ok(!!r && !c.enemies[0].status.stun, '免疫期间无法再次震慑');
    }
    // 6. 回合结束清空未用骰子，下一回合重新掷骰
    {
        const c = mk(); c.startRound();
        const ids = c.heroes[0].dice.map((d) => d.id);
        c.endRound();
        ok(c.heroes[0].dice.every((d) => d.used), '回合结束未用骰子作废');
        c.startRound();
        ok(c.heroes[0].dice.length === 3 && c.heroes[0].dice.every((d) => ids.indexOf(d.id) < 0 && !d.used), '新回合重新掷 3D6');
    }
    console.log('\n=== 第一阶段验收自测：通过 ' + pass + ' / ' + (pass + fail) + (fail ? '，失败 ' + fail : '') + ' ===');
}

const N = Number(process.argv[2]) || 1000;
const mode = process.argv[3] || 'report';
if (mode === 'selftest') { selftest(); } else { selftest(); report(N); }
