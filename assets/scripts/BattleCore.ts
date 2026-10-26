// 烽火长歌 —— 战斗规则核心（纯 TypeScript，不依赖 Cocos；游戏、自动战斗与模拟器共用）
// 回合流程：我方三人各自掷 3D6 → 选择行动（移动/主要/附赠，反应每轮一次）→ D20 命中与豁免 → 敌人按意图行动 → 回合结算。
import { roll, rollSum, rollExpr, findPayment, slotValid } from './DiceSystem';
import type { Rng, Die } from './DiceSystem';
import { mod, check, advOf } from './RuleResolver';
import type { CheckResult } from './RuleResolver';
import { RULES, PROF, STATUS, ATTR_NAME, skillById, weaponById } from './Data';
import type { HeroInst, EnemyDef, Intent, StatusKey, SkillDef, Attr, WeaponDef } from './Data';

export type Side = 'hero' | 'enemy';
export type Status = { [k: string]: number };

export interface HeroB {
    idx: number;
    inst: HeroInst;
    row: 'front' | 'back';
    block: number;
    dice: Die[];          // 本回合独立骰池（owner = 角色 id）
    move: boolean;
    main: boolean;
    bonus: boolean;
    react: boolean;
    res: number;
    status: Status;
    stunImm: number;
    brew: number;         // 下一次治疗加成
    adv: boolean;         // 授计：下一次攻击优势
    hitRound: boolean;    // 本回合是否已触发山林猎手
    resRound: boolean;    // 本回合是否已获得军势
    loaded: boolean;      // 弩已装填
}

export interface EnemyB {
    idx: number;
    def: EnemyDef;
    hp: number;
    maxHp: number;
    block: number;
    status: Status;
    pi: number;           // 意图序号
    revealed: boolean;    // 已被识破（显示意图数值）
    charge: number;       // 蓄势加伤
    ambush: number;       // 伏击伤害（下次行动前触发）
    dmgUp: number;        // 狂暴加伤
    enraged: boolean;
    stunImm: boolean;
}

/** 战斗表现事件（界面按顺序播放）。 */
export type Fx =
    | { k: 'atk'; src: Side; from: number; to: number; c: CheckResult | null; hit: boolean; crit: boolean; dmg: number; absorbed: number }
    | { k: 'dmg'; side: Side; to: number; amt: number; absorbed: number; why: string }
    | { k: 'heal'; to: number; amt: number }
    | { k: 'block'; side: Side; to: number; amt: number }
    | { k: 'status'; side: Side; to: number; key: StatusKey; amt: number }
    | { k: 'save'; side: Side; to: number; c: CheckResult; attr: string }
    | { k: 'check'; from: number; c: CheckResult; label: string }
    | { k: 'reveal'; to: number }
    | { k: 'res'; to: number; amt: number }
    | { k: 'move'; to: number; row: 'front' | 'back' }
    | { k: 'down'; side: Side; to: number }
    | { k: 'text'; side: Side; to: number; text: string };

export interface ActResult { fx: Fx[]; log: string; }
export interface EnemyTurn { enemy: number; intent: Intent | null; fx: Fx[]; }
export interface PhaseResult { turns: EnemyTurn[]; tick: Fx[]; over: 'win' | 'lose' | null; }

export class BattleCore {
    heroes: HeroB[];
    enemies: EnemyB[];
    round = 0;
    protect: { by: number; to: number } | null = null;
    insightDone = false;
    lowHealDone = false;
    lastError = '';
    private dieSeq = 0;

    constructor(party: HeroInst[], enemies: EnemyDef[], public rng: Rng) {
        this.heroes = party.map((inst, idx) => ({
            idx, inst, row: inst.def.row, block: 0, dice: [],
            move: false, main: false, bonus: false, react: false,
            res: inst.def.resStart, status: {}, stunImm: 0, brew: 0, adv: false,
            hitRound: false, resRound: false, loaded: true,
        }));
        if (!this.heroes.some((h) => h.row === 'front' && h.inst.hp > 0)) {
            // 没有默认前排时，生命最高者站前排
            const tank = this.heroes.slice().sort((a, b) => b.inst.maxHp - a.inst.maxHp)[0];
            tank.row = 'front';
        }
        this.enemies = enemies.map((def, idx) => ({
            idx, def, hp: def.maxHp, maxHp: def.maxHp, block: 0, status: {}, pi: 0,
            revealed: false, charge: 0, ambush: 0, dmgUp: 0, enraged: false, stunImm: false,
        }));
    }

    // ---------------- 查询 ----------------

    alive(h: HeroB): boolean { return h.inst.hp > 0; }
    liveHeroes(): HeroB[] { return this.heroes.filter((h) => h.inst.hp > 0); }
    liveEnemies(): EnemyB[] { return this.enemies.filter((e) => e.hp > 0); }

    get over(): 'win' | 'lose' | null {
        if (this.liveHeroes().length === 0) { return 'lose'; }
        if (this.liveEnemies().length === 0) { return 'win'; }
        return null;
    }

    weaponOf(h: HeroB): WeaponDef { return weaponById(h.inst.weapon.id); }

    atkAttr(h: HeroB): Attr {
        const w = this.weaponOf(h);
        if (w.attr !== 'finesse') { return w.attr; }
        return h.inst.def.attrs.dex > h.inst.def.attrs.str ? 'dex' : 'str';
    }

    am(h: HeroB, a: Attr): number { return mod(h.inst.def.attrs[a]); }

    atkBonus(h: HeroB): number { return this.am(h, this.atkAttr(h)) + PROF + h.inst.weapon.q; }

    heroAc(h: HeroB): number {
        return h.inst.def.ac + (this.weaponOf(h).ac || 0) - (h.status.sunder ? 2 : 0);
    }

    enemyAc(e: EnemyB): number { return e.def.ac - (e.status.sunder ? 2 : 0); }

    intentOf(e: EnemyB): Intent { return e.def.pattern[e.pi % e.def.pattern.length]; }

    skillsOf(hi: number): string[] {
        const h = this.heroes[hi];
        return ['attack', this.weaponOf(h).skill, ...h.inst.def.skills];
    }

    /** 不能使用的原因；可用返回空串。 */
    canUse(hi: number, sid: string): string {
        const h = this.heroes[hi], s = skillById(sid);
        if (!h || !this.alive(h)) { return '该角色已倒下'; }
        if (!s || this.skillsOf(hi).indexOf(sid) < 0) { return '该角色没有此技能'; }
        if (s.action === 'main' && !h.main) { return h.status.stun ? '被震慑，无法主要行动' : '本回合主要行动已用'; }
        if (s.action === 'bonus' && !h.bonus) { return '本回合附赠行动已用'; }
        const w = this.weaponOf(h);
        if (s.weapon) {
            if (h.status.disarm) { return '被缴械，无法使用武器'; }
            const attacks = s.target === 'enemy';
            if (attacks && !w.ranged && !w.reach && h.row !== 'front') { return '近战武器需在前排'; }
            if (attacks && w.reload && !h.loaded) { return '弩未装填（附赠行动装填）'; }
        }
        if (s.cost && h.res < s.cost) { return h.inst.def.res + '不足（需 ' + s.cost + '）'; }
        if (s.target === 'enemy' && this.liveEnemies().length === 0) { return '没有目标'; }
        if (sid === 'protect' && this.liveHeroes().length < 2) { return '没有可守护的队友'; }
        if (!findPayment(s.slot, h.dice)) { return '没有满足骰槽「' + s.slot + '」的骰子'; }
        return '';
    }

    /** 支付：指定骰子（必须属于该角色且未使用）或自动挑选。 */
    payment(hi: number, sid: string, diceIds?: number[]): Die[] | null {
        const h = this.heroes[hi], s = skillById(sid);
        if (diceIds && diceIds.length > 0) {
            const ds: Die[] = [];
            for (const id of diceIds) {
                const d = h.dice.find((x) => x.id === id);
                if (!d || d.used || d.owner !== h.inst.def.id || ds.indexOf(d) >= 0) { return null; }
                ds.push(d);
            }
            return slotValid(s.slot, ds.map((d) => d.value)) ? ds : null;
        }
        return findPayment(s.slot, h.dice);
    }

    defaultTarget(ti?: number): EnemyB {
        const e = ti !== undefined ? this.enemies[ti] : null;
        return e && e.hp > 0 ? e : this.liveEnemies()[0];
    }

    lowestAlly(exclude = -1): HeroB {
        const live = this.liveHeroes().filter((h) => h.idx !== exclude);
        return live.sort((a, b) => a.inst.hp / a.inst.maxHp - b.inst.hp / b.inst.maxHp)[0];
    }

    // ---------------- 回合 ----------------

    /** 先手判定：全队最高敏捷修正 + D20 vs 先手 DC。 */
    initiative(): CheckResult {
        const best = Math.max(...this.liveHeroes().map((h) => this.am(h, 'dex')));
        return check(best, RULES.initDc, this.rng);
    }

    startRound(): Fx[] {
        const fx: Fx[] = [];
        this.round++;
        this.protect = null;
        for (const h of this.heroes) {
            h.dice = [];
            if (!this.alive(h)) { continue; }
            h.block = 0;
            for (let i = 0; i < RULES.dicePerTurn; i++) {
                h.dice.push({ id: ++this.dieSeq, owner: h.inst.def.id, value: roll(6, this.rng), used: false });
            }
            h.move = h.main = h.bonus = h.react = true;
            h.brew = 0;
            h.adv = false;
            h.hitRound = h.resRound = false;
            if (h.status.stun) {
                h.main = false;
                h.status.stun = 0;
                h.stunImm = 1;
                fx.push({ k: 'text', side: 'hero', to: h.idx, text: '震慑：本回合无法主要行动' });
            }
            if (h.inst.def.id === 'xu') { this.gainRes(h, 1, fx); }
        }
        return fx;
    }

    move(hi: number): ActResult | null {
        const h = this.heroes[hi];
        if (!h || !this.alive(h) || !h.move) { this.lastError = '本回合已移动'; return null; }
        h.move = false;
        h.row = h.row === 'front' ? 'back' : 'front';
        return { fx: [{ k: 'move', to: hi, row: h.row }], log: h.inst.def.name + ' 移动到' + (h.row === 'front' ? '前排' : '后排') };
    }

    reload(hi: number): ActResult | null {
        const h = this.heroes[hi];
        if (!h || !this.alive(h) || !this.weaponOf(h).reload || h.loaded || !h.bonus) {
            this.lastError = '无法装填';
            return null;
        }
        h.bonus = false;
        h.loaded = true;
        return { fx: [{ k: 'text', side: 'hero', to: hi, text: '装填完毕' }], log: h.inst.def.name + ' 装填了弩' };
    }

    /** 执行技能。非法（行动超限 / 骰子不属于该角色 / 骰槽不符等）返回 null 且不改变任何状态。 */
    act(hi: number, sid: string, diceIds?: number[], ti?: number): ActResult | null {
        const reason = this.canUse(hi, sid);
        if (reason) { this.lastError = reason; return null; }
        const pay = this.payment(hi, sid, diceIds);
        if (!pay) { this.lastError = '所选骰子不满足骰槽'; return null; }
        const h = this.heroes[hi], s: SkillDef = skillById(sid);
        for (const d of pay) { d.used = true; }
        if (s.action === 'main') { h.main = false; } else { h.bonus = false; }
        if (s.cost) { h.res -= s.cost; }
        const X = pay.length ? Math.max(...pay.map((d) => d.value)) : 0;
        const fx: Fx[] = [];
        const e = this.defaultTarget(ti);
        const name = h.inst.def.name + '「' + s.name + '」' + (pay.length ? '（' + pay.map((d) => d.value).join('+') + '）' : '');
        switch (sid) {
            case 'attack': this.weaponAttack(h, e, {}, fx); break;
            case 'cleave': {
                const a = this.weaponAttack(h, e, { bonus: X }, fx);
                if (a.hit && e.hp > 0) { this.addStatus('enemy', e.idx, 'sunder', 2, fx); }
                break;
            }
            case 'parry': this.gainBlock('hero', h.idx, X + 3, fx); break;
            case 'thrust': {
                this.weaponAttack(h, e, { bonus: Math.floor(X / 2) }, fx);
                const other = this.liveEnemies().find((o) => o !== e);
                if (other) { this.weaponAttack(h, other, { bonus: Math.floor(X / 2) }, fx); }
                break;
            }
            case 'pierce': this.weaponAttack(h, e, { auto: true, dice: 2, bonus: X }, fx); break;
            case 'punch': this.weaponAttack(h, e, { auto: true, bonus: X }, fx); break;
            case 'ambush': {
                e.ambush += rollSum(3, 8, this.rng) + this.am(h, 'int') + h.inst.weapon.q;
                fx.push({ k: 'text', side: 'enemy', to: e.idx, text: '设伏！' });
                break;
            }
            case 'bulwark': this.gainBlock('hero', h.idx, X + 4, fx); break;
            case 'brew':
                h.brew += Math.floor(X / 2);
                fx.push({ k: 'text', side: 'hero', to: h.idx, text: '药力 +' + Math.floor(X / 2) });
                break;
            case 'guard': this.gainBlock('hero', h.idx, 2 * X + 1, fx); break;
            case 'protect': {
                const t = this.lowestAlly(h.idx);
                this.protect = { by: h.idx, to: t.idx };
                this.gainBlock('hero', h.idx, X, fx);
                fx.push({ k: 'text', side: 'hero', to: t.idx, text: '受裴烈守护' });
                break;
            }
            case 'breach': {
                const bonus = X + h.res * 3;
                h.res = 0;
                this.weaponAttack(h, e, { adv: 1, bonus }, fx);
                break;
            }
            case 'insight': case 'scout': {
                const attr: Attr = sid === 'insight' ? 'int' : 'wis';
                const c = check(this.am(h, attr) + PROF, e.def.insight, this.rng);
                fx.push({ k: 'check', from: h.idx, c, label: sid === 'insight' ? '识破' : '侦察' });
                if (c.success) {
                    e.revealed = true;
                    fx.push({ k: 'reveal', to: e.idx });
                    if (sid === 'scout') { this.gainRes(h, 1, fx); } else {
                        this.addStatus('enemy', e.idx, 'sunder', 2, fx);
                        this.gainRes(h, this.insightDone ? 1 : 2, fx);
                        this.insightDone = true;
                    }
                }
                break;
            }
            case 'ploy':
                this.hurtEnemy(e, X + this.am(h, 'int'), fx, '扰敌');
                if (e.hp > 0) { this.addStatus('enemy', e.idx, 'weak', X, fx); }
                break;
            case 'chain': {
                if (e.stunImm) { fx.push({ k: 'text', side: 'enemy', to: e.idx, text: '免疫震慑' }); break; }
                const c = check(e.def.save, 8 + PROF + this.am(h, 'int'), this.rng);
                fx.push({ k: 'save', side: 'enemy', to: e.idx, c, attr: '感知' });
                if (!c.success) { this.addStatus('enemy', e.idx, 'stun', 1, fx); }
                break;
            }
            case 'plan':
                for (const o of this.liveHeroes()) { o.adv = true; this.gainBlock('hero', o.idx, 4, fx); }
                fx.push({ k: 'text', side: 'hero', to: h.idx, text: '授计：全队攻击优势' });
                break;
            case 'snare': this.addStatus('enemy', e.idx, 'bleed', Math.floor(X / 2) + 1, fx); break;
            case 'volley': {
                const n = Math.max(1, h.res);
                h.res = 0;
                for (let i = 0; i < n; i++) {
                    const t = e.hp > 0 ? e : this.liveEnemies()[0];
                    if (!t) { break; }
                    this.weaponAttack(h, t, {}, fx);
                }
                break;
            }
            case 'aid': {
                const t = this.lowestAlly();
                this.heal(h, t, roll(4, this.rng) + Math.floor(X / 2), fx);
                break;
            }
            case 'cleanse':
                for (const o of this.liveHeroes()) {
                    o.status.bleed = o.status.poison = o.status.burn = o.status.fear = 0;
                    if (X === 6) { this.heal(h, o, 3, fx); }
                }
                fx.push({ k: 'text', side: 'hero', to: h.idx, text: '解毒' });
                break;
            case 'needle': {
                const c = check(this.am(h, 'wis') + PROF, this.enemyAc(e), this.rng, this.heroAdv(h));
                if (c.success) {
                    const dmg = rollSum(c.crit ? 2 : 1, 4, this.rng) + this.am(h, 'wis');
                    const r = this.hurtEnemy(e, Math.max(1, dmg), null, '');
                    fx.push({ k: 'atk', src: 'hero', from: h.idx, to: e.idx, c, hit: true, crit: c.crit, dmg: r.real, absorbed: r.absorbed });
                    if (e.hp > 0) { this.addStatus('enemy', e.idx, 'poison', Math.floor(X / 2) + 1, fx); }
                } else {
                    fx.push({ k: 'atk', src: 'hero', from: h.idx, to: e.idx, c, hit: false, crit: false, dmg: 0, absorbed: 0 });
                }
                break;
            }
            case 'revive': {
                const brew = h.brew;
                h.brew = 0;
                for (const o of this.liveHeroes()) {
                    h.brew = brew;
                    this.heal(h, o, roll(4, this.rng) + this.am(h, 'wis'), fx);
                }
                h.brew = 0;
                break;
            }
        }
        return { fx, log: name };
    }

    // ---------------- 结算辅助 ----------------

    private heroAdv(h: HeroB): number {
        const a = advOf(h.adv ? 1 : 0, h.status.fear ? -1 : 0);
        h.adv = false;
        return a;
    }

    private weaponAttack(h: HeroB, e: EnemyB,
        o: { adv?: number; bonus?: number; auto?: boolean; dice?: number }, fx: Fx[]): { hit: boolean } {
        const w = this.weaponOf(h);
        const adv = advOf(o.adv || 0, this.heroAdv(h));
        const c = o.auto ? null : check(this.atkBonus(h), this.enemyAc(e), this.rng, adv);
        const hit = o.auto || c.success;
        const crit = !!c && c.crit;
        if (w.reload) { h.loaded = false; }
        if (!hit) {
            fx.push({ k: 'atk', src: 'hero', from: h.idx, to: e.idx, c, hit: false, crit: false, dmg: 0, absorbed: 0 });
            return { hit: false };
        }
        let dmg = rollSum((o.dice || 1) * (crit ? 2 : 1), w.die, this.rng) +
            this.am(h, this.atkAttr(h)) + h.inst.weapon.q + (o.bonus || 0);
        if (h.inst.def.id === 'ye' && !h.hitRound) {
            h.hitRound = true;
            dmg += roll(4, this.rng);
            this.gainRes(h, 1, fx);
        }
        const r = this.hurtEnemy(e, Math.max(1, dmg), null, '');
        fx.push({ k: 'atk', src: 'hero', from: h.idx, to: e.idx, c, hit: true, crit, dmg: r.real, absorbed: r.absorbed });
        if (e.hp <= 0) { fx.push({ k: 'down', side: 'enemy', to: e.idx }); }
        return { hit: true };
    }

    /** 敌人受伤：护甲先吸收。fx 非空时记录一条 dmg 事件。 */
    private hurtEnemy(e: EnemyB, amt: number, fx: Fx[] | null, why: string): { real: number; absorbed: number } {
        const absorbed = Math.min(e.block, amt);
        e.block -= absorbed;
        const real = amt - absorbed;
        e.hp = Math.max(0, e.hp - real);
        if (fx) {
            fx.push({ k: 'dmg', side: 'enemy', to: e.idx, amt: real, absorbed, why });
            if (e.hp <= 0) { fx.push({ k: 'down', side: 'enemy', to: e.idx }); }
        }
        if (e.def.boss && !e.enraged && e.hp > 0 && e.hp <= e.maxHp * RULES.enrageAt) {
            e.enraged = true;
            e.dmgUp += RULES.enrageDmg;
        }
        return { real, absorbed };
    }

    private hurtHero(h: HeroB, amt: number, fx: Fx[], why: string | null): { real: number; absorbed: number } {
        const absorbed = Math.min(h.block, amt);
        h.block -= absorbed;
        const real = amt - absorbed;
        h.inst.hp = Math.max(0, h.inst.hp - real);
        if (absorbed > 0 && h.inst.def.id === 'pei' && !h.resRound) {
            h.resRound = true;
            this.gainRes(h, 1, fx);
        }
        if (why !== null) { fx.push({ k: 'dmg', side: 'hero', to: h.idx, amt: real, absorbed, why }); }
        if (h.inst.hp <= 0) { this.downHero(h, fx); }
        return { real, absorbed };
    }

    private downHero(h: HeroB, fx: Fx[]) {
        h.block = 0;
        h.status = {};
        h.dice = [];
        h.move = h.main = h.bonus = h.react = false;
        if (this.protect && (this.protect.by === h.idx || this.protect.to === h.idx)) { this.protect = null; }
        fx.push({ k: 'down', side: 'hero', to: h.idx });
    }

    private heal(src: HeroB, t: HeroB, amt: number, fx: Fx[]) {
        if (!t || !this.alive(t)) { return; }
        let a = amt + src.brew;
        src.brew = 0;
        if (src.inst.def.id === 'xu' && !this.lowHealDone && t.inst.hp < t.inst.maxHp / 2) {
            this.lowHealDone = true;
            a += 4;
        }
        const real = Math.min(t.inst.maxHp - t.inst.hp, Math.max(0, a));
        t.inst.hp += real;
        fx.push({ k: 'heal', to: t.idx, amt: real });
    }

    private gainBlock(side: Side, to: number, amt: number, fx: Fx[]) {
        if (side === 'hero') { this.heroes[to].block += amt; } else { this.enemies[to].block += amt; }
        fx.push({ k: 'block', side, to, amt });
    }

    private gainRes(h: HeroB, n: number, fx: Fx[]) {
        const before = h.res;
        h.res = Math.min(h.inst.def.resMax, h.res + n);
        if (h.res > before) { fx.push({ k: 'res', to: h.idx, amt: h.res - before }); }
    }

    addStatus(side: Side, to: number, key: StatusKey, amt: number, fx: Fx[]) {
        const st = side === 'hero' ? this.heroes[to].status : this.enemies[to].status;
        const info = STATUS[key];
        const stack = key === 'bleed' || key === 'poison' || key === 'weak';
        st[key] = Math.min(info.max, stack ? (st[key] || 0) + amt : Math.max(st[key] || 0, amt));
        fx.push({ k: 'status', side, to, key, amt });
    }

    // ---------------- 敌方回合 ----------------

    endRound(): PhaseResult {
        const turns: EnemyTurn[] = [];
        for (const h of this.heroes) { for (const d of h.dice) { d.used = true; } } // 未使用的骰子清空
        for (const e of this.enemies) {
            if (e.hp <= 0 || this.over) { continue; }
            const fx: Fx[] = [];
            e.block = 0;
            if (e.ambush > 0) {
                const a = e.ambush;
                e.ambush = 0;
                this.hurtEnemy(e, a, fx, '伏击');
                if (e.hp <= 0) { turns.push({ enemy: e.idx, intent: null, fx }); continue; }
            }
            const it = this.intentOf(e);
            e.pi++;
            if (e.status.stun) {
                e.status.stun = 0;
                e.stunImm = true;
                fx.push({ k: 'text', side: 'enemy', to: e.idx, text: '被震慑，跳过行动' });
                turns.push({ enemy: e.idx, intent: null, fx });
                continue;
            }
            e.stunImm = false;
            this.execIntent(e, it, fx);
            turns.push({ enemy: e.idx, intent: it, fx });
        }
        const tick: Fx[] = [];
        if (!this.over) { this.tickStatus(tick); }
        return { turns, tick, over: this.over };
    }

    private pickTarget(e: EnemyB, it: Intent): HeroB | null {
        const live = this.liveHeroes();
        if (!live.length) { return null; }
        const front = live.filter((h) => h.row === 'front');
        const pool = it.ranged || e.charge > 0 || front.length === 0 ? live : front;
        let t = pool[Math.floor(this.rng() * pool.length)];
        const p = this.protect;
        if (p && p.to === t.idx && p.by !== t.idx) {
            const g = this.heroes[p.by];
            if (this.alive(g) && g.react) { t = g; g.react = false; this.protect = null; }
        }
        return t;
    }

    private execIntent(e: EnemyB, it: Intent, fx: Fx[]) {
        switch (it.type) {
            case 'atk': {
                const hits = it.hits || 1;
                for (let i = 0; i < hits && this.liveHeroes().length; i++) {
                    const before = this.protect;
                    const t = this.pickTarget(e, it);
                    if (before && !this.protect) {
                        fx.push({ k: 'text', side: 'hero', to: t.idx, text: '守护！' });
                        if (!t.resRound) { t.resRound = true; this.gainRes(t, 1, fx); }
                    }
                    const c = check(e.def.atk, this.heroAc(t), this.rng, e.status.fear ? -1 : 0);
                    if (!c.success) {
                        fx.push({ k: 'atk', src: 'enemy', from: e.idx, to: t.idx, c, hit: false, crit: false, dmg: 0, absorbed: 0 });
                        continue;
                    }
                    const dmg = rollExpr(it.dmg, this.rng, c.crit) + e.dmgUp + e.charge - (e.status.weak || 0);
                    e.status.weak = 0;
                    const after: Fx[] = []; // 军势/倒下等后续事件排在命中之后
                    const r = this.hurtHero(t, Math.max(1, dmg), after, null);
                    fx.push({ k: 'atk', src: 'enemy', from: e.idx, to: t.idx, c, hit: true, crit: c.crit, dmg: r.real, absorbed: r.absorbed });
                    fx.push(...after);
                }
                e.charge = 0;
                break;
            }
            case 'aoe':
                for (const h of this.liveHeroes()) {
                    const c = check(this.am(h, it.save || 'dex'), it.dc || 12, this.rng);
                    fx.push({ k: 'save', side: 'hero', to: h.idx, c, attr: '敏捷' });
                    const full = rollExpr(it.dmg, this.rng) + e.dmgUp;
                    this.hurtHero(h, Math.max(1, c.success ? Math.floor(full / 2) : full), fx, '范围');
                }
                break;
            case 'block': this.gainBlock('enemy', e.idx, it.block || 0, fx); break;
            case 'charge':
                e.charge += it.amount || 0;
                fx.push({ k: 'text', side: 'enemy', to: e.idx, text: '蓄势冲锋 +' + it.amount });
                break;
            case 'hex': {
                const live = this.liveHeroes();
                if (!live.length) { break; }
                const t = live[Math.floor(this.rng() * live.length)];
                if (it.status === 'stun' && t.stunImm > 0) {
                    fx.push({ k: 'text', side: 'hero', to: t.idx, text: '免疫震慑' });
                    break;
                }
                const attr = it.save || 'con';
                const c = check(this.am(t, attr), it.dc || 12, this.rng);
                fx.push({ k: 'save', side: 'hero', to: t.idx, c, attr: ATTR_NAME[attr] });
                if (!c.success) { this.addStatus('hero', t.idx, it.status, it.amount || 1, fx); }
                break;
            }
        }
    }

    /** 回合结算：持续伤害与持续时间衰减（护甲无法抵挡持续伤害）。 */
    private tickStatus(fx: Fx[]) {
        const dot = (st: Status, onDmg: (amt: number, why: string) => void) => {
            if (st.bleed > 0) { onDmg(st.bleed, '流血'); st.bleed--; }
            if (st.poison > 0) { onDmg(st.poison, '中毒'); st.poison--; }
            if (st.burn > 0) { onDmg(3, '燃烧'); st.burn--; }
            for (const k of ['sunder', 'fear', 'disarm']) { if (st[k] > 0) { st[k]--; } }
            st.weak = 0;
        };
        for (const h of this.liveHeroes()) {
            dot(h.status, (amt, why) => {
                if (!this.alive(h)) { return; }
                const b = h.block;
                h.block = 0;
                this.hurtHero(h, amt, fx, why);
                h.block = this.alive(h) ? b : 0;
            });
            if (h.stunImm > 0) { h.stunImm--; }
        }
        for (const e of this.liveEnemies()) {
            dot(e.status, (amt, why) => {
                if (e.hp <= 0) { return; }
                const b = e.block;
                e.block = 0;
                this.hurtEnemy(e, amt, fx, why);
                e.block = e.hp > 0 ? b : 0;
            });
        }
    }

    rollGold(): number {
        return this.enemies.reduce((s, e) => s + e.def.gold[0] +
            Math.floor(this.rng() * (e.def.gold[1] - e.def.gold[0] + 1)), 0);
    }

    /** 意图文字（未识破时数值显示为 ?）。 */
    intentText(e: EnemyB): string {
        const it = this.intentOf(e);
        const show = e.revealed;
        const dmgTxt = (x: { n: number; d: number; b?: number }) => {
            if (!show) { return '?'; }
            const b = (x.b || 0) + e.dmgUp + (it.type === 'atk' ? e.charge : 0);
            return x.n + 'D' + x.d + (b > 0 ? '+' + b : b < 0 ? '' + b : '');
        };
        switch (it.type) {
            case 'atk': return (it.ranged ? '远攻 ' : '攻击 ') + dmgTxt(it.dmg) + ((it.hits || 1) > 1 ? ' ×' + it.hits : '');
            case 'aoe': return '范围 ' + dmgTxt(it.dmg);
            case 'block': return '防御 ' + (show ? it.block : '?');
            case 'charge': return '冲锋 +' + (show ? it.amount : '?');
            case 'hex': return '符咒 ' + STATUS[it.status].name;
        }
        return '';
    }
}
