"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BattleCore = void 0;
// 骰命远征 —— 纯战斗规则（不依赖 cc，游戏与平衡模拟器共用）
// 杀戮尖塔式回合：掷骰 + 抽牌 → 把骰子放进卡牌骰槽触发效果 → 结束回合 → 敌人执行意图。
const Data_1 = require("./Data");
class BattleCore {
    constructor(hero, deck, enemy, buffs, rng = Math.random) {
        this.block = 0;
        this.enemyHp = 0;
        this.enemyBlock = 0;
        this.enemyStr = 0;
        this.poison = 0;
        this.curse = 0;
        this.enraged = false;
        this.round = 1;
        this.intentIdx = 0;
        this.drawPile = [];
        this.hand = [];
        this.discard = [];
        this.exhausted = [];
        this.dice = [];
        this.nextDie = 1;
        this.gamblerFlip = false;
        this.hero = hero;
        this.enemy = enemy;
        this.buffs = buffs;
        this.rng = rng;
        this.enemyHp = enemy.maxHp;
        this.drawPile = deck.map((id, i) => ({ uid: i + 1, def: (0, Data_1.cardById)(id) })).filter((c) => !!c.def);
        this.shuffle(this.drawPile);
    }
    get intent() {
        const p = this.enemy.pattern;
        return p[this.intentIdx % p.length];
    }
    get heroId() { return this.hero.def.id; }
    /** 意图的预计伤害（含力量），供 UI 与 AI 使用。 */
    intentDamage() {
        const it = this.intent;
        if (it.type !== 'atk' && it.type !== 'atkblock') {
            return { dmg: 0, hits: 0 };
        }
        return { dmg: (it.dmg || 0) + this.enemyStr, hits: it.hits || 1 };
    }
    // ---------------- 基础 ----------------
    d6() { return 1 + Math.floor(this.rng() * 6); }
    shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng() * (i + 1));
            const t = a[i];
            a[i] = a[j];
            a[j] = t;
        }
    }
    addDie(v) {
        const d = { id: this.nextDie++, value: v };
        this.dice.push(d);
        return d;
    }
    /** 掷一颗新骰（赌徒被动：每回合首个 1 点翻成 6）。 */
    rollFace() {
        let v = this.d6();
        if (v === 1 && this.heroId === 'gambler' && !this.gamblerFlip) {
            this.gamblerFlip = true;
            v = 6;
        }
        return v;
    }
    drawCards(n) {
        let c = 0;
        for (let i = 0; i < n && this.hand.length < Data_1.RULES.maxHand; i++) {
            if (this.drawPile.length === 0) {
                if (this.discard.length === 0) {
                    break;
                }
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
        const n = Math.max(1, Math.min(Data_1.RULES.maxDice, Data_1.RULES.dicePerTurn + this.buffs.extraDie - this.curse));
        this.curse = 0;
        for (let i = 0; i < n; i++) {
            this.addDie(this.rollFace());
        }
        if (this.heroId === 'astro') {
            for (const d of this.dice) {
                if (d.value <= 2) {
                    d.value = this.d6();
                }
            }
        }
        if (this.heroId === 'tinker' && this.dice.length < Data_1.RULES.maxDice) {
            this.addDie(2);
        }
        this.drawCards(Data_1.RULES.handSize);
    }
    canPlay(card, die) {
        if (this.hand.indexOf(card) < 0) {
            return false;
        }
        if (card.def.slot === 'none') {
            if (card.def.id === 'lucky' || card.def.id === 'coin') {
                return this.dice.length < Data_1.RULES.maxDice;
            }
            return true;
        }
        if (!die || this.dice.indexOf(die) < 0 || !(0, Data_1.slotOk)(card.def.slot, die.value)) {
            return false;
        }
        if (card.def.id === 'split' || card.def.id === 'replicate') {
            return this.dice.length < Data_1.RULES.maxDice;
        }
        return true;
    }
    /** 有没有任何可出的牌。 */
    anyPlayable() {
        return this.hand.some((c) => c.def.slot === 'none' ? this.canPlay(c, null)
            : this.dice.some((d) => this.canPlay(c, d)));
    }
    hitEnemy(raw, r) {
        const absorbed = Math.min(this.enemyBlock, raw);
        this.enemyBlock -= absorbed;
        const real = raw - absorbed;
        this.enemyHp = Math.max(0, this.enemyHp - real);
        r.hits.push(real);
    }
    heal(n, r) {
        const before = this.hero.hp;
        this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + n);
        r.heal += this.hero.hp - before;
    }
    play(card, die) {
        if (!this.canPlay(card, die)) {
            return null;
        }
        const r = { hits: [], block: 0, heal: 0, poison: 0, drew: 0, diceChanged: false, killed: false, text: '' };
        const X = die ? die.value : 0;
        let keepDie = card.def.type === 'dice';
        // 职业被动：攻击加成
        let bonus = 0;
        if (card.def.type === 'attack' && die) {
            if (this.heroId === 'shadow' && X % 2 === 1) {
                bonus += Data_1.RULES.shadowOddBonus;
            }
            if (this.heroId === 'pyro' && X === 6) {
                bonus += Data_1.RULES.pyroSixBonus;
            }
        }
        const atk = (n) => this.hitEnemy(n + bonus, r);
        switch (card.def.id) {
            case 'strike':
                atk(X);
                break;
            case 'defend':
                r.block = X;
                break;
            case 'heavy':
                atk(2 * X);
                break;
            case 'jab':
                atk(X + 4);
                break;
            case 'twin':
                atk(X);
                atk(X);
                break;
            case 'guard':
                r.block = X + 5;
                break;
            case 'reroll':
                die.value = this.d6();
                r.diceChanged = true;
                break;
            case 'hone':
                die.value = Math.min(6, X + 2);
                r.diceChanged = true;
                break;
            case 'flip':
                die.value = 7 - X;
                r.diceChanged = true;
                break;
            case 'split': {
                die.value = Math.floor(X / 2);
                this.addDie(Math.ceil(X / 2));
                r.diceChanged = true;
                break;
            }
            case 'leech':
                atk(X);
                this.heal(Math.ceil(X / 2), r);
                break;
            case 'lucky':
            case 'coin':
                this.addDie(this.d6());
                r.diceChanged = true;
                break;
            case 'starfall':
                for (const d of this.dice) {
                    d.value = this.d6();
                }
                r.diceChanged = true;
                break;
            case 'starlight':
                atk(X + 4);
                r.drew = this.drawCards(1);
                break;
            case 'shieldbash':
                atk(X + Math.floor(this.block / 2));
                break;
            case 'bigshield':
                r.block = 2 * X;
                break;
            case 'allin': {
                const v = this.d6();
                atk(v >= 5 ? v * 3 : v);
                r.text = '新点数 ' + v;
                break;
            }
            case 'venom':
                r.poison = Math.ceil(X / 2) + 1;
                break;
            case 'transmute':
                die.value = 7 - X;
                r.diceChanged = true;
                r.drew = this.drawCards(1);
                break;
            case 'stab2':
                atk(X);
                atk(X);
                break;
            case 'shadowstep':
                r.block = X + 3;
                r.drew = this.drawCards(1);
                break;
            case 'judgment':
                atk(2 * X);
                this.heal(2, r);
                break;
            case 'holylight':
                atk(X);
                this.heal(Math.floor(X / 2), r);
                break;
            case 'fireball':
                atk(16);
                break;
            case 'ignite':
                die.value = Math.min(6, X + 3);
                r.diceChanged = true;
                break;
            case 'replicate':
                this.addDie(X);
                r.diceChanged = true;
                break;
            case 'gearshot':
                atk(X + 2);
                atk(X + 2);
                break;
            default: keepDie = true;
        }
        this.block += r.block;
        this.poison += r.poison;
        if (die && !keepDie) {
            this.dice.splice(this.dice.indexOf(die), 1);
        }
        this.hand.splice(this.hand.indexOf(card), 1);
        (card.def.exhaust ? this.exhausted : this.discard).push(card);
        r.killed = this.enemyHp <= 0;
        return r;
    }
    /** 结束回合：弃手牌，敌人中毒结算并执行意图。 */
    endTurn() {
        this.discard.push(...this.hand);
        this.hand = [];
        this.dice = [];
        const it = this.intent;
        const res = {
            poisonDmg: 0, intent: it, hits: [], gainBlock: 0, gainStr: 0,
            curse: false, enragedNow: false, heroDead: false, enemyDead: false,
        };
        this.enemyBlock = 0;
        if (this.poison > 0) {
            res.poisonDmg = this.poison + (this.heroId === 'alch' ? Data_1.RULES.alchPoisonBonus : 0);
            this.enemyHp = Math.max(0, this.enemyHp - res.poisonDmg);
            this.poison--;
            if (this.enemyHp <= 0) {
                res.enemyDead = true;
                return res;
            }
        }
        if (this.enemy.boss && !this.enraged && this.enemyHp <= this.enemy.maxHp * Data_1.RULES.bossEnrageAt) {
            this.enraged = true;
            this.enemyStr += Data_1.RULES.bossEnrageStr;
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
                if (this.hero.hp <= 0) {
                    break;
                }
            }
        }
        if (it.block) {
            this.enemyBlock += it.block;
            res.gainBlock = it.block;
        }
        if (it.type === 'buff') {
            this.enemyStr += it.str || 0;
            res.gainStr = it.str || 0;
        }
        if (it.type === 'curse') {
            this.curse = 1;
            res.curse = true;
        }
        res.heroDead = this.hero.hp <= 0;
        this.intentIdx++;
        if (!res.heroDead) {
            this.round++;
        }
        return res;
    }
    rollGold() {
        const e = this.enemy;
        return e.goldMin + Math.floor(this.rng() * (e.goldMax - e.goldMin + 1));
    }
}
exports.BattleCore = BattleCore;
