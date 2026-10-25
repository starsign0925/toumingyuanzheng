// 骰命远征 —— 战斗界面（竖屏：骰子 × 卡牌，杀戮尖塔式意图）
import { _decorator, Component, Node, Label, Graphics, Color, EventTouch, tween, Vec3, UIOpacity } from 'cc';
import { RULES, cardById, slotOk } from './Data';
import type { EnemyDef, HeroInst, RunBuffs } from './Data';
import { BattleCore } from './BattleCore';
import type { CardInst, DieT, PlayResult, EnemyResult } from './BattleCore';
import { planMove } from './BattleAI';
import {
    COL, mkNode, mkLabel, mkPanel, mkButton, setBtnEnabled,
    drawDie, mkBar, shake, floatText, mkCard, drawPanel,
} from './UI';
import type { BtnHandle, BarHandle, CardView } from './UI';
import {
    buildRig, rigIdle, heroAttack, enemyAttack, castFx, hurt, die, enrage, centerOf, burst,
} from './Figures';
import type { Rig } from './Figures';

const { ccclass } = _decorator;

const DIE_SIZE = 64;
const DIE_GAP = 78;
const CARD_W = 130, CARD_H = 186;
const ENEMY_SIZE: { [id: string]: number } = {
    imp: 110, golem: 135, viper: 120, lich: 140, troll: 155, boss: 195,
};

@ccclass('BattleScreen')
export class BattleScreen extends Component {
    private core: BattleCore = null;
    private onEnd: (won: boolean, gold: number) => void = null;
    private busy = false;
    private auto = false;
    private selDie: DieT = null;
    private selCard: CardInst = null;

    private enemyHpBar: BarHandle = null;
    private enemyHpText: Label = null;
    private intentLabel: Label = null;
    private intentPanel: Node = null;
    private enemyStatus: Label = null;
    private heroStatus: Label = null;
    private heroHpBar: BarHandle = null;
    private heroHpText: Label = null;
    private infoLabel: Label = null;
    private diceNode: Node = null;
    private handNode: Node = null;
    private logLabel: Label = null;
    private pileLabel: Label = null;
    private btnEnd: BtnHandle = null;
    private btnAuto: BtnHandle = null;
    private enemyRig: Rig = null;
    private heroRig: Rig = null;

    private static readonly EX = 210;  // 敌人立绘 x
    private static readonly EY = 415;  // 敌人立绘中心 y
    private static readonly HX = -220; // 英雄立绘 x
    private static readonly HY = -30;  // 英雄立绘中心 y
    private static readonly DICE_Y = 90;
    private static readonly HAND_Y = -390;

    init(hero: HeroInst, deck: string[], enemy: EnemyDef, buffs: RunBuffs,
        onEnd: (won: boolean, gold: number) => void, auto = false) {
        this.core = new BattleCore(hero, deck, enemy, buffs);
        this.onEnd = onEnd;
        this.auto = auto;
        this.buildUI();
        this.log('遭遇 ' + enemy.name + ' —— ' + enemy.desc);
        const c = centerOf(this.enemyRig, this.node);
        floatText(this.node, enemy.name + ' 出现了！', c.x - 60, c.y + 60, COL.gold, 28);
        this.startTurn();
    }

    // ---------------- UI ----------------

    private buildUI() {
        const root = this.node;
        const enemy = this.core.enemy;
        const EX = BattleScreen.EX, EY = BattleScreen.EY;
        const HX = BattleScreen.HX, HY = BattleScreen.HY;

        mkLabel(root, enemy.name + (enemy.boss ? '【首领】' : enemy.elite ? '【精英】' : ''),
            24, enemy.elite || enemy.boss ? COL.red : COL.text, 0, 610);
        this.enemyHpBar = mkBar(root, 400, 20, 0, 578);
        this.enemyHpText = mkLabel(root, '', 15, COL.text, 0, 578);
        this.intentPanel = mkPanel(root, 170, 34, EX, 520, COL.panel, 8, COL.border, 2).node;
        this.intentLabel = mkLabel(root, '', 16, COL.text, EX, 520);
        this.enemyRig = buildRig(root, enemy.id, ENEMY_SIZE[enemy.id] || 130, EX, EY, true);
        rigIdle(this.enemyRig);
        this.enemyStatus = mkLabel(root, '', 14, COL.dim, EX, EY - (ENEMY_SIZE[enemy.id] || 130) / 2 - 14);

        this.heroRig = buildRig(root, this.core.hero.def.id, 130, HX, HY);
        rigIdle(this.heroRig);
        this.heroHpBar = mkBar(root, 210, 20, HX, -118);
        this.heroHpText = mkLabel(root, '', 15, COL.text, HX, -118);
        this.heroStatus = mkLabel(root, '', 14, COL.dim, HX, -148);
        mkLabel(root, this.core.hero.def.name, 15, COL.gold, HX, -170);
        mkLabel(root, this.core.hero.def.passive, 10.5, COL.dim, HX, -192, 220);

        this.infoLabel = mkLabel(root, '', 16, COL.gold, 0, 240);
        this.diceNode = mkNode(root, 'dice', 0, 0, 0, BattleScreen.DICE_Y);
        this.handNode = mkNode(root, 'hand', 0, 0, 0, BattleScreen.HAND_Y);
        this.logLabel = mkLabel(root, '', 15, COL.text, 0, -170, 660);
        this.pileLabel = mkLabel(root, '', 13, COL.dim, 0, -556);
        mkLabel(root, '规则：掷骰后把骰子放进卡牌触发效果。敌人头顶显示下回合意图。', 12, COL.dim, 0, -580);

        this.btnEnd = mkButton(root, '结束回合', 150, 62, 272, -230, 20, () => this.onEndTurn());
        this.btnAuto = mkButton(root, '', 130, 62, -285, -230, 17, () => {
            this.auto = !this.auto;
            this.refresh();
            if (this.auto && !this.busy) { this.scheduleOnce(() => this.autoStep(), 0.4); }
        });
    }

    // ---------------- 回合 ----------------

    private startTurn() {
        this.core.startTurn();
        this.busy = false;
        this.selDie = null;
        this.selCard = null;
        this.refresh();
        // 骰子入场翻滚 + 手牌弹入
        this.diceNode.children.forEach((d, i) => {
            d.setScale(0.2, 0.2, 1);
            d.angle = (Math.random() - 0.5) * 160;
            tween(d).delay(i * 0.05).to(0.16, { scale: new Vec3(1.2, 1.2, 1), angle: 0 })
                .to(0.1, { scale: Vec3.ONE }).start();
        });
        this.handNode.children.forEach((c, i) => {
            c.setScale(0.4, 0.4, 1);
            tween(c).delay(0.15 + i * 0.06).to(0.18, { scale: new Vec3(1.1, 1.1, 1) })
                .to(0.1, { scale: Vec3.ONE }).start();
        });
        if (this.auto) { this.scheduleOnce(() => this.autoStep(), 0.6); }
    }

    private autoStep() {
        if (!this.auto || this.busy || !this.node.isValid) { return; }
        const m = planMove(this.core);
        if (!m) { this.onEndTurn(); return; }
        this.playCard(m.card, m.die);
        this.scheduleOnce(() => this.autoStep(), 0.5);
    }

    // ---------------- 交互 ----------------

    private onDieTap(die: DieT) {
        if (this.busy || this.auto) { return; }
        if (this.selCard && this.core.canPlay(this.selCard, die)) {
            this.playCard(this.selCard, die);
            return;
        }
        this.selDie = this.selDie === die ? null : die;
        this.refresh();
    }

    private onCardTap(card: CardInst) {
        if (this.busy || this.auto) { return; }
        if (card.def.slot === 'none') {
            if (this.core.canPlay(card, null)) { this.playCard(card, null); }
            return;
        }
        if (this.selDie && this.core.canPlay(card, this.selDie)) {
            this.playCard(card, this.selDie);
            return;
        }
        // 选中/取消该卡；若已有选中骰但不合法则提示
        if (this.selDie && !this.core.canPlay(card, this.selDie)) {
            this.log(card.def.name + '：' + card.def.desc + '（骰槽不匹配）');
        }
        this.selCard = this.selCard === card ? null : card;
        this.refresh();
    }

    private playCard(card: CardInst, die: DieT) {
        if (this.busy) { return; }
        const r = this.core.play(card, die);
        if (!r) { return; }
        this.selDie = null;
        this.selCard = null;
        if (r.killed) { this.busy = true; }
        // 表现：攻击→英雄出手；技能/骰子→施法光环
        const enemyPos = centerOf(this.enemyRig, this.node);
        const heroPos = centerOf(this.heroRig, this.node);
        const enemyTop = enemyPos.y + this.enemyRig.size / 2;
        if (card.def.type === 'attack' && r.hits.length > 0) {
            heroAttack(this.heroRig, this.node, enemyPos);
        } else {
            castFx(this.heroRig, this.node);
        }
        // 命中反馈
        let t = 0.35;
        for (const h of r.hits) {
            const hh = h;
            this.scheduleOnce(() => {
                hurt(this.enemyRig, Math.min(1.4, 0.7 + hh / 25));
                shake(this.node, hh >= 14 ? 6 : 3);
                floatText(this.node, '-' + hh, enemyPos.x, enemyTop, COL.red, hh >= 14 ? 36 : 28);
            }, t);
            t += 0.16;
        }
        if (r.block > 0) {
            this.scheduleOnce(() => floatText(this.node, '+' + r.block + ' 护甲', heroPos.x, heroPos.y + 60, COL.blue, 24), 0.3);
        }
        if (r.heal > 0) {
            this.scheduleOnce(() => floatText(this.node, '+' + r.heal, heroPos.x, heroPos.y + 88, COL.green, 24), 0.4);
        }
        if (r.poison > 0) {
            this.scheduleOnce(() => floatText(this.node, '中毒 +' + r.poison, enemyPos.x, enemyTop + 36, new Color(120, 220, 110, 255), 22), 0.4);
        }
        if (r.drew > 0) { this.log('抽了 ' + r.drew + ' 张牌'); }
        this.log(this.cardText(card, die ? die.value : 0, r));
        this.scheduleOnce(() => {
            this.refresh();
            if (r.killed) { this.winBattle(); }
        }, Math.max(t, 0.5));
    }

    private cardText(card: CardInst, X: number, r: PlayResult): string {
        const dmg = r.hits.reduce((a, b) => a + b, 0);
        const parts: string[] = [];
        if (dmg > 0) { parts.push('造成 ' + dmg + ' 伤害'); }
        if (r.block > 0) { parts.push('获得 ' + r.block + ' 护甲'); }
        if (r.poison > 0) { parts.push('中毒+' + r.poison); }
        if (r.heal > 0) { parts.push('回复 ' + r.heal); }
        if (r.diceChanged) { parts.push('骰子已变化'); }
        if (r.text) { parts.push(r.text); }
        return card.def.name + '（' + X + '点）' + (parts.length ? '：' + parts.join('，') : '');
    }

    private winBattle() {
        this.busy = true;
        die(this.enemyRig);
        const c = centerOf(this.enemyRig, this.node);
        floatText(this.node, '击败！', c.x, c.y, COL.gold, 32);
        this.scheduleOnce(() => this.onEnd(true, this.core.rollGold()), 1.1);
    }

    private onEndTurn() {
        if (this.busy) { return; }
        this.busy = true;
        this.refresh();
        const res = this.core.endTurn();
        this.enemyPhase(res);
    }

    private enemyPhase(res: EnemyResult) {
        const layer = this.node;
        const ePos = centerOf(this.enemyRig, layer);
        const hPos = centerOf(this.heroRig, layer);
        const lines: string[] = [];
        let t = 0;

        if (res.poisonDmg > 0) {
            lines.push('中毒 -' + res.poisonDmg);
            this.scheduleOnce(() => {
                floatText(layer, '毒 -' + res.poisonDmg, ePos.x, ePos.y + this.enemyRig.size / 2, new Color(120, 220, 110, 255), 24);
            }, t);
            t += 0.35;
        }
        if (res.enemyDead) {
            lines.push('毒发身亡！');
            this.log(lines.join('；'));
            this.scheduleOnce(() => this.winBattle(), t + 0.2);
            return;
        }
        if (res.enragedNow) {
            this.scheduleOnce(() => {
                enrage(this.enemyRig);
                floatText(layer, '魔龙狂暴！力量+' + RULES.bossEnrageStr, ePos.x - 30, ePos.y + 70, COL.red, 26);
            }, t);
            t += 0.7;
        }
        const it = res.intent;
        if (res.curse) {
            lines.push('遭到诅咒：下回合 -1 骰');
            this.scheduleOnce(() => floatText(layer, '诅咒！', hPos.x, hPos.y + 90, new Color(190, 90, 220, 255), 24), t);
            t += 0.4;
        }
        if (res.gainStr > 0) {
            lines.push('力量+' + res.gainStr);
            this.scheduleOnce(() => {
                castFx(this.enemyRig, layer);
                floatText(layer, '力量+' + res.gainStr, ePos.x, ePos.y + this.enemyRig.size / 2, COL.gold, 22);
            }, t);
            t += 0.5;
        }
        if (res.gainBlock > 0) {
            lines.push('格挡+' + res.gainBlock);
            this.scheduleOnce(() => floatText(layer, '护甲+' + res.gainBlock, ePos.x, ePos.y + this.enemyRig.size / 2, COL.blue, 22), t);
            t += 0.4;
        }
        if (res.hits.length > 0) {
            lines.push('攻击 ' + res.hits.map((h) => h.real).join('+') + (res.hits.some((h) => h.real < h.raw) ? '(被护甲抵挡)' : ''));
            const impact = 0.5;
            this.scheduleOnce(() => {
                enemyAttack(this.enemyRig, layer, hPos);
            }, t);
            let tt = t + impact;
            for (const h of res.hits) {
                const hh = h;
                this.scheduleOnce(() => {
                    hurt(this.heroRig, hh.real > 0 ? 1 : 0.5);
                    const heavy = this.core.enemy.id === 'troll' || this.core.enemy.id === 'golem' || this.core.enemy.boss;
                    shake(this.node, hh.real > 0 ? (heavy ? 8 : 4) : 2);
                    floatText(layer, hh.real > 0 ? '-' + hh.real : '格挡', hPos.x, hPos.y + 70,
                        hh.real > 0 ? COL.red : COL.blue, hh.real > 0 ? 30 : 22);
                    this.refresh();
                }, tt);
                tt += 0.28;
            }
            t = tt;
        }
        this.log(lines.join('；'));
        this.scheduleOnce(() => {
            this.refresh();
            if (res.heroDead) {
                die(this.heroRig);
                this.scheduleOnce(() => this.onEnd(false, 0), 0.8);
                return;
            }
            this.startTurn();
        }, t + 0.5);
    }

    // ---------------- 刷新 ----------------

    private refresh() {
        const core = this.core;
        const it = core.intent;
        const idmg = core.intentDamage();
        // 敌人
        this.enemyHpBar.set(core.enemyHp / core.enemy.maxHp);
        this.enemyHpText.string = core.enemyHp + ' / ' + core.enemy.maxHp;
        let chip = '', chipCol = COL.panel;
        if (it.type === 'atk' || it.type === 'atkblock') {
            chip = '⚔ ' + idmg.dmg + (idmg.hits > 1 ? '×' + idmg.hits : '');
            chipCol = new Color(140, 46, 38, 255);
            if (it.type === 'atkblock' && it.block) { chip += '  盾' + it.block; }
        } else if (it.type === 'block') { chip = '盾 ' + it.block; chipCol = new Color(70, 100, 140, 255); }
        else if (it.type === 'buff') { chip = '强化 +' + it.str; chipCol = new Color(150, 100, 40, 255); }
        else if (it.type === 'curse') { chip = '诅咒 -1骰'; chipCol = new Color(100, 56, 120, 255); }
        this.intentLabel.string = chip;
        drawPanel(this.intentPanel.getComponent(Graphics), 170, 34, chipCol, 8, COL.border, 2);
        const est: string[] = [];
        if (core.enemyBlock > 0) { est.push('护甲 ' + core.enemyBlock); }
        if (core.poison > 0) { est.push('毒 ' + core.poison); }
        if (core.enemyStr > 0) { est.push('力量 ' + core.enemyStr); }
        if (core.enraged) { est.push('狂暴'); }
        this.enemyStatus.string = est.join('　') || ' ';
        // 英雄
        const h = core.hero;
        this.heroHpBar.set(h.hp / h.maxHp);
        this.heroHpText.string = Math.ceil(h.hp) + ' / ' + h.maxHp + (core.block > 0 ? '　+' + core.block + '甲' : '');
        this.heroStatus.string = 'HP ' + Math.ceil(h.hp) + '/' + h.maxHp + '  护甲 ' + core.block +
            (core.curse > 0 ? '  受诅咒' : '');
        this.infoLabel.string = '回合 ' + core.round + '　骰子 ' + core.dice.length;
        this.pileLabel.string = '牌库 ' + core.drawPile.length + '　弃牌 ' + core.discard.length +
            (core.exhausted.length ? '　消耗 ' + core.exhausted.length : '');

        // 骰子
        this.diceNode.removeAllChildren();
        const n = core.dice.length;
        for (let i = 0; i < n; i++) {
            const d = core.dice[i];
            const x = -((n - 1) * DIE_GAP) / 2 + i * DIE_GAP;
            const usable = !this.selCard || this.selCard.def.slot === 'none' ||
                (d !== undefined && slotOk(this.selCard.def.slot, d.value));
            const dn = mkNode(this.diceNode, 'die' + i, DIE_SIZE, DIE_SIZE, x, this.selDie === d ? 12 : 0);
            drawDie(dn.addComponent(Graphics), DIE_SIZE, { value: d.value, sel: this.selDie === d });
            if (!usable) {
                const op = dn.addComponent(UIOpacity);
                op.opacity = 110;
            } else if (this.selCard) {
                tween(dn).repeatForever(tween(dn).to(0.4, { scale: new Vec3(1.1, 1.1, 1) }).to(0.4, { scale: Vec3.ONE })).start();
            }
            const dd = d;
            dn.on(Node.EventType.TOUCH_END, () => this.onDieTap(dd));
        }

        // 手牌
        this.handNode.removeAllChildren();
        const m = core.hand.length;
        const span = Math.min(600, (m - 1) * 150);
        for (let i = 0; i < m; i++) {
            const c = core.hand[i];
            const x = m === 1 ? 0 : -span / 2 + i * (span / (m - 1));
            const lift = this.selCard === c ? 26 : 0;
            const cn = mkCard(this.handNode, c.def, x, lift, CARD_W, CARD_H);
            const playable = core.anyPlayable() && (c.def.slot === 'none'
                ? core.canPlay(c, null)
                : core.dice.some((d) => core.canPlay(c, d)));
            const dimmed = this.selDie && c.def.slot !== 'none' && !slotOk(c.def.slot, this.selDie.value);
            if (!playable || dimmed) {
                const op = cn.node.addComponent(UIOpacity);
                op.opacity = dimmed ? 110 : 150;
            }
            const cc = c;
            cn.node.on(Node.EventType.TOUCH_END, () => this.onCardTap(cc));
        }

        const locked = this.busy || this.auto;
        setBtnEnabled(this.btnEnd, !locked, 150, 62);
        setBtnEnabled(this.btnAuto, true, 130, 62);
        this.btnAuto.label.string = this.auto ? '自动:开' : '自动:关';
    }

    private log(msg: string) {
        if (this.logLabel) { this.logLabel.string = msg; }
    }
}
