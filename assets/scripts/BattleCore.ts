// 骰命远征 —— 纯战斗规则（不依赖 cc，游戏与平衡模拟器共用）
// 杀戮尖塔式回合：掷骰 + 抽牌 → 把骰子放进卡牌骰槽触发效果 → 结束回合 → 敌人执行意图。
import { RULES, cardById, slotOk } from './Data';
import type { CardDef, EnemyDef, HeroInst, Intent, RunBuffs, BattleEntry } from './Data';

export type Rng = () => number;

export interface DieT { id: number; value: number; }
export interface CardInst { uid: number; def: CardDef; }

/** 一次出牌的结果（供表现层播放动画）。 */
export interface PlayResult {
    hits: number[];      // 每段对敌人造成的实际伤害（已扣护甲）
    block: number;
    heal: number;
    poison: number;
    drew: number;
    diceChanged: boolean;
    killed: boolean;
    text: string;
}

export interface EnemyResult {
    poisonDmg: number;
    intent: Intent;
    hits: { raw: number; real: number }[];
    gainBlock: number;
    gainStr: number;
    curse: boolean;
    enragedNow: boolean;
    heroDead: boolean;
    enemyDead: boolean;
}

export class BattleCore {
    hero: HeroInst;
    enemy: EnemyDef;
    buffs: RunBuffs;
    rng: Rng;

    block = 0;
    enemyHp = 0;
    enemyBlock = 0;
    enemyStr = 0;
    poison = 0;
    curse = 0;
    enraged = false;
    round = 1;
    intentIdx = 0;

    drawPile: CardInst[] = [];
    hand: CardInst[] = [];
    discard: CardInst[] = [];
    exhausted: CardInst[] = [];
    dice: DieT[] = [];

    private nextDie = 1;
    private gamblerFlip = false;
    private firstDie = 0;

    constructor(hero: HeroInst, deck: string[], enemy: EnemyDef, buffs: RunBuffs,
        rng: Rng = Math.random, entry: BattleEntry = null) {
        this.hero = hero;
        this.enemy = enemy;
        this.buffs = buffs;
        this.rng = rng;
        this.enemyHp = enemy.maxHp;
        if (entry && entry.hpCut > 0) {
            this.enemyHp = Math.max(1, this.enemyHp - Math.floor(enemy.maxHp * entry.hpCut));
        }
        this.firstDie = entry && entry.firstDie > 0 ? entry.firstDie : 0;
        this.drawPile = deck.map((id, i) => ({ uid: i + 1, def: cardById(id) })).filter((c) => !!c.def);
        this.shuffle(this.drawPile);
    }

    get intent(): Intent {
        const p = this.enemy.pattern;
        return p[this.intentIdx % p.length];
    }

    get heroId(): string { return this.hero.def.id; }

    /** 意图的预计伤害（含力量），供 UI 与 AI 使用。 */
    intentDamage(): { dmg: number; hits: number } {
        const it = this.intent;
        if (it.type !== 'atk' && it.type !== 'atkblock') { return { dmg: 0, hits: 0 }; }
        return { dmg: (it.dmg || 0) + this.enemyStr, hits: it.hits || 1 };
    }

    // ---------------- 基础 ----------------

    d6(): number { return 1 + Math.floor(this.rng() * 6); }

    private shuffle<T>(a: T[]) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng() * (i + 1));
            const t = a[i]; a[i] = a[j]; a[j] = t;
        }
    }

    private addDie(v: number): DieT {
        const d = { id: this.nextDie++, value: v };
        this.dice.push(d);
        return d;
    }

    /** 掷一颗新骰（赌徒被动：每回合首个 1 点翻成 6）。 */
    private rollFace(): number {
        let v = this.d6();
        if (v === 1 && this.heroId === 'gambler' && !this.gamblerFlip) {
            this.gamblerFlip = true;
            v = 6;
        }
        return v;
    }

    drawCards(n: number): number {
        let c = 0;
        for (let i = 0; i < n && this.hand.length < RULES.maxHand; i++) {
            if (this.drawPile.length === 0) {
                if (this.discard.length === 0) { break; }
                this.drawPile = this.discard;
                this.discard = [];
                this.shuffle(this.drawPile);
            }
            this.hand.push(this.drawPile.pop());
            c++;
        }
        return c;
    }

    // ---------------- 回合 ----------------

    startTurn() {
        this.block = this.heroId === 'bulwark' ? Math.floor(this.block / 2) : 0;
        this.gamblerFlip = false;
        this.dice = [];
        const n = Math.max(1, Math.min(RULES.maxDice,
            RULES.dicePerTurn + this.buffs.extraDie + this.firstDie - this.curse));
        this.firstDie = 0;
        this.curse = 0;
        for (let i = 0; i < n; i++) { this.addDie(this.rollFace()); }
        if (this.heroId === 'astro') {
            for (const d of this.dice) { if (d.value <= 2) { d.value = this.d6(); } }
        }
        if (this.heroId === 'tinker' && this.dice.length < RULES.maxDice) { this.addDie(2); }
        this.drawCards(RULES.handSize);
    }

    canPlay(card: CardInst, die: DieT | null): boolean {
        if (this.hand.indexOf(card) < 0) { return false; }
        if (card.def.slot === 'none') {
            if (card.def.id === 'lucky' || card.def.id === 'coin') { return this.dice.length < RULES.maxDice; }
            return true;
        }
        if (!die || this.dice.indexOf(die) < 0 || !slotOk(card.def.slot, die.value)) { return false; }
        if (card.def.id === 'split' || card.def.id === 'replicate') { return this.dice.length < RULES.maxDice; }
        return true;
    }

    /** 有没有任何可出的牌。 */
    anyPlayable(): boolean {
        return this.hand.some((c) => c.def.slot === 'none' ? this.canPlay(c, null)
            : this.dice.some((d) => this.canPlay(c, d)));
    }

    private hitEnemy(raw: number, r: PlayResult) {
        const absorbed = Math.min(this.enemyBlock, raw);
        this.enemyBlock -= absorbed;
        const real = raw - absorbed;
        this.enemyHp = Math.max(0, this.enemyHp - real);
        r.hits.push(real);
    }

    private heal(n: number, r: PlayResult) {
        const before = this.hero.hp;
        this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + n);
        r.heal += this.hero.hp - before;
    }

    play(card: CardInst, die: DieT | null): PlayResult | null {
        if (!this.canPlay(card, die)) { return null; }
        const r: PlayResult = { hits: [], block: 0, heal: 0, poison: 0, drew: 0, diceChanged: false, killed: false, text: '' };
        const X = die ? die.value : 0;
        let keepDie = card.def.type === 'dice';
        // 职业被动：攻击加成
        let bonus = 0;
        if (card.def.type === 'attack' && die) {
            if (this.heroId === 'shadow' && X % 2 === 1) { bonus += RULES.shadowOddBonus; }
            if (this.heroId === 'pyro' && X === 6) { bonus += RULES.pyroSixBonus; }
        }
        const atk = (n: number) => this.hitEnemy(n + bonus, r);

        switch (card.def.id) {
            case 'strike': atk(X); break;
            case 'defend': r.block = X; break;
            case 'heavy': atk(2 * X); break;
            case 'jab': atk(X + 4); break;
            case 'twin': atk(X); atk(X); break;
            case 'guard': r.block = X + 5; break;
            case 'reroll': die.value = this.d6(); r.diceChanged = true; break;
            case 'hone': die.value = Math.min(6, X + 2); r.diceChanged = true; break;
            case 'flip': die.value = 7 - X; r.diceChanged = true; break;
            case 'split': {
                die.value = Math.floor(X / 2);
                this.addDie(Math.ceil(X / 2));
                r.diceChanged = true;
                break;
            }
            case 'leech': atk(X); this.heal(Math.ceil(X / 2), r); break;
            case 'lucky': case 'coin': this.addDie(this.d6()); r.diceChanged = true; break;
            case 'starfall': for (const d of this.dice) { d.value = this.d6(); } r.diceChanged = true; break;
            case 'starlight': atk(X + 4); r.drew = this.drawCards(1); break;
            case 'shieldbash': atk(X + Math.floor(this.block / 2)); break;
            case 'bigshield': r.block = 2 * X; break;
            case 'allin': {
                const v = this.d6();
                atk(v >= 5 ? v * 3 : v);
                r.text = '新点数 ' + v;
                break;
            }
            case 'venom': r.poison = Math.ceil(X / 2) + 1; break;
            case 'transmute': die.value = 7 - X; r.diceChanged = true; r.drew = this.drawCards(1); break;
            case 'stab2': atk(X); atk(X); break;
            case 'shadowstep': r.block = X + 3; r.drew = this.drawCards(1); break;
            case 'judgment': atk(2 * X); this.heal(2, r); break;
            case 'holylight': atk(X); this.heal(Math.floor(X / 2), r); break;
            case 'fireball': atk(16); break;
            case 'ignite': die.value = Math.min(6, X + 3); r.diceChanged = true; break;
            case 'replicate': this.addDie(X); r.diceChanged = true; break;
            case 'gearshot': atk(X + 2); atk(X + 2); break;
            default: keepDie = true;
        }
        this.block += r.block;
        this.poison += r.poison;

        if (die && !keepDie) { this.dice.splice(this.dice.indexOf(die), 1); }
        this.hand.splice(this.hand.indexOf(card), 1);
        (card.def.exhaust ? this.exhausted : this.discard).push(card);
        r.killed = this.enemyHp <= 0;
        return r;
    }

    /** 结束回合：弃手牌，敌人中毒结算并执行意图。 */
    endTurn(): EnemyResult {
        this.discard.push(...this.hand);
        this.hand = [];
        this.dice = [];
        const it = this.intent;
        const res: EnemyResult = {
            poisonDmg: 0, intent: it, hits: [], gainBlock: 0, gainStr: 0,
            curse: false, enragedNow: false, heroDead: false, enemyDead: false,
        };
        this.enemyBlock = 0;
        if (this.poison > 0) {
            res.poisonDmg = this.poison + (this.heroId === 'alch' ? RULES.alchPoisonBonus : 0);
            this.enemyHp = Math.max(0, this.enemyHp - res.poisonDmg);
            this.poison--;
            if (this.enemyHp <= 0) { res.enemyDead = true; return res; }
        }
        if (this.enemy.boss && !this.enraged && this.enemyHp <= this.enemy.maxHp * RULES.bossEnrageAt) {
            this.enraged = true;
            this.enemyStr += RULES.bossEnrageStr;
            res.enragedNow = true;
        }
        if (it.type === 'atk' || it.type === 'atkblock') {
            const n = it.hits || 1;
            for (let i = 0; i < n; i++) {
                const raw = (it.dmg || 0) + this.enemyStr;
                const absorbed = Math.min(this.block, raw);
                this.block -= absorbed;
                const real = raw - absorbed;
                this.hero.hp = Math.max(0, this.hero.hp - real);
                res.hits.push({ raw, real });
                if (this.hero.hp <= 0) { break; }
            }
        }
        if (it.block) { this.enemyBlock += it.block; res.gainBlock = it.block; }
        if (it.type === 'buff') { this.enemyStr += it.str || 0; res.gainStr = it.str || 0; }
        if (it.type === 'curse') { this.curse = 1; res.curse = true; }
        res.heroDead = this.hero.hp <= 0;
        this.intentIdx++;
        if (!res.heroDead) { this.round++; }
        return res;
    }

    rollGold(): number {
        const e = this.enemy;
        return e.goldMin + Math.floor(this.rng() * (e.goldMax - e.goldMin + 1));
    }
}
