"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planStep = planStep;
exports.runPlan = runPlan;
exports.pickReward = pickReward;
const Data_1 = require("./Data");
const DiceSystem_1 = require("./DiceSystem");
const RuleResolver_1 = require("./RuleResolver");
/** 敌人本回合对该角色的期望伤害。 */
function incoming(core, h) {
    let sum = 0;
    const live = core.liveHeroes();
    const front = live.filter((x) => x.row === 'front');
    for (const e of core.liveEnemies()) {
        const it = core.intentOf(e);
        if (e.status.stun) {
            continue;
        }
        if (it.type === 'atk') {
            const pool = it.ranged || e.charge > 0 || !front.length ? live : front;
            if (pool.indexOf(h) < 0) {
                continue;
            }
            const avg = (0, DiceSystem_1.exprAvg)(it.dmg) + e.dmgUp + e.charge;
            sum += avg * (it.hits || 1) / pool.length * (0, RuleResolver_1.successChance)(e.def.atk, core.heroAc(h));
        }
        else if (it.type === 'aoe') {
            sum += ((0, DiceSystem_1.exprAvg)(it.dmg) + e.dmgUp) * 0.75;
        }
    }
    return sum;
}
function threat(core, e) {
    const it = core.intentOf(e);
    if (e.status.stun) {
        return 0;
    }
    if (it.type === 'atk') {
        return ((0, DiceSystem_1.exprAvg)(it.dmg) + e.dmgUp + e.charge) * (it.hits || 1);
    }
    if (it.type === 'aoe') {
        return ((0, DiceSystem_1.exprAvg)(it.dmg) + e.dmgUp) * core.liveHeroes().length * 0.8;
    }
    if (it.type === 'hex') {
        return it.status === 'stun' ? 8 : 5;
    }
    return 2;
}
function weaponDmg(core, h) {
    return (core.weaponOf(h).die + 1) / 2 + core.am(h, core.atkAttr(h)) + h.inst.weapon.q +
        (h.inst.def.id === 'ye' && !h.hitRound ? 2.5 : 0);
}
function hitP(core, h, e, adv = 0) {
    return (0, RuleResolver_1.successChance)(core.atkBonus(h), core.enemyAc(e), adv || (h.adv ? 1 : 0));
}
/** 优先能击杀的目标，其次威胁高、血量低的目标。 */
function bestEnemy(core, dmg) {
    let best = null, bs = -1e9;
    for (const e of core.liveEnemies()) {
        const ehp = e.hp + e.block;
        const s = (ehp <= dmg ? 100 : 0) + threat(core, e) * 0.6 - ehp * 0.3;
        if (s > bs) {
            bs = s;
            best = e;
        }
    }
    return best;
}
function blockVal(core, h, amt) {
    return Math.min(amt, incoming(core, h)) + (h.inst.def.id === 'pei' && !h.resRound ? 1 : 0);
}
function killBonus(e, dmg) {
    return e && e.hp + e.block <= dmg ? 6 : 0;
}
function scoreSkill(core, hi, sid) {
    if (core.canUse(hi, sid)) {
        return { score: -1 };
    }
    const h = core.heroes[hi], s = (0, Data_1.skillById)(sid);
    const pay = (0, DiceSystem_1.findPayment)(s.slot, h.dice);
    const X = pay.length ? Math.max(...pay.map((d) => d.value)) : 0;
    const wd = weaponDmg(core, h);
    const wis = core.am(h, 'wis');
    let score = 0, e = null;
    switch (sid) {
        case 'attack':
            e = bestEnemy(core, wd);
            score = hitP(core, h, e) * wd + killBonus(e, wd) * 0.6;
            break;
        case 'cleave':
            e = bestEnemy(core, wd + X);
            score = hitP(core, h, e) * (wd + X + 2) + killBonus(e, wd + X) * 0.6;
            break;
        case 'parry':
            score = blockVal(core, h, X + 3);
            break;
        case 'bulwark':
            score = blockVal(core, h, X + 4);
            break;
        case 'guard':
            score = blockVal(core, h, 2 * X + 1);
            break;
        case 'thrust':
            e = bestEnemy(core, wd);
            score = hitP(core, h, e) * (wd + X / 2) * Math.min(2, core.liveEnemies().length);
            break;
        case 'pierce':
            e = bestEnemy(core, wd * 2 + X);
            score = wd * 2 + X - (core.weaponOf(h).die + 1) / 2 + killBonus(e, wd * 2 + X);
            break;
        case 'punch':
            e = bestEnemy(core, wd + X);
            score = wd + X + killBonus(e, wd + X);
            break;
        case 'ambush': {
            const d = 13.5 + core.am(h, 'int') + h.inst.weapon.q;
            e = bestEnemy(core, d);
            score = d * 0.9 + (e.hp + e.block <= d ? threat(core, e) * 0.5 : 0);
            break;
        }
        case 'brew': {
            const t = core.lowestAlly();
            score = h.main && t && t.inst.maxHp - t.inst.hp > 8 ? Math.floor(X / 2) * 0.7 : 0;
            break;
        }
        case 'protect': {
            const t = core.lowestAlly(h.idx);
            score = t ? (t.inst.hp / t.inst.maxHp < 0.6 ? Math.min(incoming(core, t), 9) * 0.8 : 0) + blockVal(core, h, X) * 0.5 : 0;
            break;
        }
        case 'breach': {
            const d = wd + X + h.res * 3;
            e = bestEnemy(core, d);
            score = hitP(core, h, e, 1) * d + killBonus(e, d) * 0.6;
            break;
        }
        case 'insight':
        case 'scout': {
            const pool = core.liveEnemies().filter((x) => sid === 'insight' ? !x.status.sunder : !x.revealed)
                .sort((a, b) => b.hp - a.hp);
            if (!pool.length) {
                break;
            }
            e = pool[0];
            const p = (0, RuleResolver_1.successChance)(core.am(h, sid === 'insight' ? 'int' : 'wis') + 2, e.def.insight);
            const allyAtk = core.liveHeroes().filter((o) => o.main).length;
            score = p * (sid === 'scout' ? (e.revealed ? 1.5 : 2.7)
                : (!e.revealed ? 1.2 : 0) + (h.res < h.inst.def.resMax ? 3 : 0) + allyAtk * 1.2);
            break;
        }
        case 'ploy': {
            e = core.liveEnemies().sort((a, b) => threat(core, b) - threat(core, a))[0];
            const it = core.intentOf(e);
            const d = X + core.am(h, 'int');
            score = d + (it.type === 'atk' ? Math.min(X, threat(core, e)) * 0.8 : 0) + killBonus(e, d);
            break;
        }
        case 'chain': {
            const cands = core.liveEnemies().filter((x) => !x.stunImm && !x.status.stun)
                .sort((a, b) => threat(core, b) - threat(core, a));
            if (!cands.length) {
                break;
            }
            e = cands[0];
            score = (1 - (0, RuleResolver_1.successChance)(e.def.save, 10 + core.am(h, 'int'))) * threat(core, e) * 1.1;
            break;
        }
        case 'plan': {
            const n = core.liveHeroes().filter((o) => o.main && !o.adv && !core.canUse(o.idx, 'attack')).length;
            const blk = core.liveHeroes().reduce((v, o) => v + Math.min(4, incoming(core, o)), 0);
            score = n * 2 + blk;
            break;
        }
        case 'snare': {
            const n = Math.floor(X / 2) + 1;
            e = core.liveEnemies().sort((a, b) => b.hp - a.hp)[0];
            score = Math.min(e.hp, n * (n + 1) / 2) * 0.7;
            break;
        }
        case 'volley': {
            e = bestEnemy(core, wd);
            score = Math.max(1, h.res) * hitP(core, h, e) * wd;
            break;
        }
        case 'aid': {
            const t = core.lowestAlly();
            const miss = t.inst.maxHp - t.inst.hp;
            score = miss < 5 ? 0 : Math.min(miss, 2.5 + X / 2 + h.brew) * (t.inst.hp / t.inst.maxHp < 0.5 ? 1.4 : 0.8);
            break;
        }
        case 'cleanse': {
            let v = 0;
            for (const o of core.liveHeroes()) {
                v += (o.status.bleed || 0) * 1.5 + (o.status.poison || 0) * 1.5 + (o.status.burn || 0) * 3 + (o.status.fear ? 2 : 0);
                if (X === 6) {
                    v += Math.min(o.inst.maxHp - o.inst.hp, 3) * 0.6;
                }
            }
            score = v;
            break;
        }
        case 'needle': {
            e = bestEnemy(core, 2.5 + wis);
            const n = Math.floor(X / 2) + 1;
            score = (0, RuleResolver_1.successChance)(wis + 2, core.enemyAc(e)) * (2.5 + wis + n * (n + 1) / 2 * 0.6);
            break;
        }
        case 'revive': {
            let v = 0;
            for (const o of core.liveHeroes()) {
                v += Math.min(o.inst.maxHp - o.inst.hp, 2.5 + wis);
            }
            score = v * 0.9;
            break;
        }
    }
    // 别把 6 点浪费在非「指定 6」的技能上
    if (s.slot !== 'six' && pay.some((d) => d.value === 6) && core.skillsOf(hi).indexOf('pierce') >= 0 && h.main) {
        score -= 2;
    }
    return { score, target: e ? e.idx : undefined };
}
/** 选出当前收益最高的一步；没有值得做的行动时返回 null（结束回合）。 */
function planStep(core) {
    let best = null;
    for (const h of core.liveHeroes()) {
        const w = core.weaponOf(h);
        if (h.move && h.main && h.row === 'back' && !w.ranged && !w.reach && h.inst.def.id !== 'xu') {
            const p = { hero: h.idx, kind: 'move', score: 6 };
            if (!best || p.score > best.score) {
                best = p;
            }
        }
        if (h.move && h.row === 'front' && w.ranged && h.inst.hp / h.inst.maxHp < 0.4 &&
            core.liveHeroes().filter((o) => o.row === 'front').length > 1) {
            const p = { hero: h.idx, kind: 'move', score: 3 };
            if (!best || p.score > best.score) {
                best = p;
            }
        }
        if (w.reload && !h.loaded && h.bonus && h.main) {
            const p = { hero: h.idx, kind: 'reload', score: 6.5 };
            if (!best || p.score > best.score) {
                best = p;
            }
        }
        for (const sid of core.skillsOf(h.idx)) {
            const r = scoreSkill(core, h.idx, sid);
            if (r.score > 0.5 && (!best || r.score > best.score)) {
                best = { hero: h.idx, kind: 'skill', skill: sid, target: r.target, score: r.score };
            }
        }
    }
    return best;
}
/** 执行一步计划，返回结果（供模拟器/自动战斗）。 */
function runPlan(core, p) {
    if (p.kind === 'move') {
        return core.move(p.hero);
    }
    if (p.kind === 'reload') {
        return core.reload(p.hero);
    }
    return core.act(p.hero, p.skill, undefined, p.target);
}
/** 奖励选择：残血先补给，其次升品，再看新武器是否更好，最后强身。 */
function pickReward(party, opts) {
    const ratio = party.reduce((s, h) => s + h.hp / h.maxHp, 0) / party.length;
    const heal = opts.find((o) => o.kind === 'heal');
    if (heal && ratio < 0.55) {
        return heal;
    }
    const up = opts.find((o) => o.kind === 'upgrade');
    if (up) {
        return up;
    }
    const w = opts.find((o) => o.kind === 'weapon' && o.w.q > party[o.hero].weapon.q);
    if (w) {
        return w;
    }
    return heal || opts.find((o) => o.kind === 'vigor') || opts[0];
}
