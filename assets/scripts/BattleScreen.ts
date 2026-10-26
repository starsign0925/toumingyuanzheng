// 烽火长歌 —— 战斗界面（竖屏）：上方敌人与意图，中部三名角色，下方当前行动者的独立骰池与技能
import { _decorator, Component, Node, Label, Graphics, Color, tween, Tween, Vec3, UIOpacity, HorizontalTextAlignment } from 'cc';
import { STATUS, skillById, weaponName } from './Data';
import type { HeroInst, EnemyDef } from './Data';
import { SLOT_TEXT } from './DiceSystem';
import { checkText, signed } from './RuleResolver';
import { BattleCore } from './BattleCore';
import type { Fx, ActResult, PhaseResult } from './BattleCore';
import { planStep, runPlan } from './BattleAI';
import {
    COL, mkNode, mkLabel, mkPanel, mkButton, setBtnEnabled, drawDie, mkBar, shake, floatText, drawPanel,
} from './UI';
import type { BtnHandle, BarHandle } from './UI';
import { buildRig, rigIdle, heroAttack, enemyAttack, castFx, hurt, die, enrage, centerOf, burst } from './Figures';
import type { Rig } from './Figures';

const { ccclass } = _decorator;

const LEFT = HorizontalTextAlignment.LEFT;
const RIGHT = HorizontalTextAlignment.RIGHT;
const XS: { [n: number]: number[] } = { 1: [0], 2: [-160, 160], 3: [-230, 0, 230] };
const EY = 430;
const HERO_Y = { front: 150, back: 112 };
const DIE = 58;

const INTENT_COL: { [k: string]: Color } = {
    atk: new Color(150, 44, 36, 255),     // 红色刀锋
    aoe: new Color(120, 30, 70, 255),     // 危险区域
    block: new Color(56, 92, 140, 255),   // 蓝色盾牌
    charge: new Color(170, 130, 30, 255), // 黄色箭头
    hex: new Color(100, 56, 130, 255),    // 紫色符纹
};

interface HeroUI { tap: Node; ring: Graphics; hp: BarHandle; hpText: Label; info: Label; status: Label; name: Label; }
interface EnemyUI { chip: Node; chipG: Graphics; chipL: Label; hp: BarHandle; hpText: Label; status: Label; name: Label; ring: Graphics; }

@ccclass('BattleScreen')
export class BattleScreen extends Component {
    private core: BattleCore = null;
    private onEnd: (won: boolean, gold: number) => void = null;
    private busy = true;
    private auto = false;
    private active = 0;
    private target = 0;
    private selDice: number[] = [];
    private heroRigs: Rig[] = [];
    private enemyRigs: Rig[] = [];
    private heroUI: HeroUI[] = [];
    private enemyUI: EnemyUI[] = [];
    private panel: Node = null;
    private logLabel: Label = null;
    private roundLabel: Label = null;
    private enraged: boolean[] = [];

    init(party: HeroInst[], enemies: EnemyDef[], onEnd: (won: boolean, gold: number) => void, auto = false) {
        this.core = new BattleCore(party, enemies, Math.random);
        this.onEnd = onEnd;
        this.auto = auto;
        this.active = this.core.liveHeroes()[0].idx;
        this.buildUI();
        this.log('遭遇：' + enemies.map((e) => e.name).join('、'));
        const c = this.core.initiative();
        this.refresh();
        this.scheduleOnce(() => {
            this.log('先手检定（全队最高敏捷）：' + checkText(c));
            if (c.success) {
                this.banner('我 方 先 手', COL.gold);
                this.scheduleOnce(() => this.startTurn(), 0.8);
            } else {
                this.banner('敌 军 先 手', COL.red);
                this.scheduleOnce(() => this.enemyPhase(this.core.endRound()), 0.8);
            }
        }, 0.5);
    }

    // ---------------- 构建 ----------------

    private buildUI() {
        const root = this.node, core = this.core;
        this.roundLabel = mkLabel(root, '', 18, COL.gold, 0, 615);
        this.logLabel = mkLabel(root, '', 14, COL.text, 0, 252, 680);
        const ex = XS[core.enemies.length] || XS[3];
        core.enemies.forEach((e, i) => {
            const size = e.def.boss ? 165 : e.def.elite ? 135 : 108;
            const ring = mkNode(root, 'ering', 4, 4, ex[i], EY - size / 2 + 4).addComponent(Graphics);
            const rig = buildRig(root, e.def.visual, size, ex[i], EY, true);
            rigIdle(rig, i * 0.15);
            rig.root.on(Node.EventType.TOUCH_END, () => this.onEnemyTap(i));
            this.enemyRigs.push(rig);
            this.enraged.push(false);
            const chip = mkPanel(root, 196, 34, ex[i], 565, INTENT_COL.atk, 8, COL.border, 2);
            const chipL = mkLabel(chip.node, '', 15, new Color(255, 246, 224, 255), 0, 0);
            const name = mkLabel(root, e.def.name + (e.def.boss ? '【首领】' : e.def.elite ? '【精英】' : ''), 15,
                e.def.boss || e.def.elite ? COL.red : COL.text, ex[i], 334);
            const hp = mkBar(root, 180, 16, ex[i], 312);
            const hpText = mkLabel(root, '', 12, COL.text, ex[i], 312);
            const status = mkLabel(root, '', 12, COL.dim, ex[i], 290, 220);
            this.enemyUI.push({ chip: chip.node, chipG: chip.g, chipL, hp, hpText, status, name, ring });
        });
        const hx = XS[core.heroes.length] || XS[3];
        core.heroes.forEach((h, i) => {
            const tap = mkPanel(root, 220, 228, hx[i], 108, new Color(50, 36, 26, 255), 10, null, 0);
            const ring = tap.g;
            tap.node.on(Node.EventType.TOUCH_END, () => this.onHeroTap(i));
            const rig = buildRig(root, h.inst.def.visual, 100, hx[i], HERO_Y[h.row]);
            rigIdle(rig, i * 0.2);
            this.heroRigs.push(rig);
            const name = mkLabel(root, '', 14, COL.gold, hx[i], 56);
            const hp = mkBar(root, 180, 16, hx[i], 36);
            const hpText = mkLabel(root, '', 12, COL.text, hx[i], 36);
            const info = mkLabel(root, '', 12, COL.text, hx[i], 15, 216);
            const status = mkLabel(root, '', 11.5, COL.dim, hx[i], -5, 216);
            this.heroUI.push({ tap: tap.node, ring, hp, hpText, info, status, name });
        });
    }

    // ---------------- 回合 ----------------

    private startTurn() {
        const fx = this.core.startRound();
        this.busy = false;
        this.selDice = [];
        if (!this.core.heroes[this.active] || !this.core.alive(this.core.heroes[this.active])) {
            this.active = this.core.liveHeroes()[0].idx;
        }
        this.refresh();
        this.playFx(fx, 0.3);
        this.banner('第 ' + this.core.round + ' 回合', COL.gold);
        this.rollDiceIn();
        if (this.auto) { this.scheduleOnce(() => this.autoStep(), 0.8); }
    }

    private onEndTurn() {
        if (this.busy) { return; }
        this.busy = true;
        this.selDice = [];
        this.enemyPhase(this.core.endRound());
    }

    private enemyPhase(res: PhaseResult) {
        this.refresh();
        this.banner('敌 方 回 合', new Color(230, 120, 90, 255));
        let t = 0.7;
        const lines: string[] = [];
        for (const turn of res.turns) {
            const ui = this.enemyUI[turn.enemy];
            const e = this.core.enemies[turn.enemy];
            this.at(t, () => {
                if (!ui.chip.isValid) { return; }
                tween(ui.chip).to(0.1, { scale: new Vec3(1.2, 1.2, 1) }).to(0.12, { scale: Vec3.ONE }).start();
            });
            if (turn.intent) { lines.push(e.def.name + '：' + this.intentWord(turn.intent.type)); }
            t = this.playFx(turn.fx, t + 0.15) + 0.2;
        }
        t = this.playFx(res.tick, t);
        this.log(lines.join('；') || '敌军按兵不动');
        this.at(t + 0.3, () => {
            this.refresh();
            if (res.over === 'win') { this.winBattle(); return; }
            if (res.over === 'lose') { this.loseBattle(); return; }
            this.startTurn();
        });
    }

    private intentWord(t: string): string {
        return t === 'atk' ? '攻击' : t === 'aoe' ? '范围打击' : t === 'block' ? '防御' : t === 'charge' ? '蓄势冲锋' : '施放符咒';
    }

    private winBattle() {
        this.busy = true;
        this.core.enemies.forEach((e, i) => { if (this.enemyUI[i].chip.isValid) { this.enemyUI[i].chip.active = false; } });
        this.banner('胜 利', COL.gold);
        const c = new Vec3(0, EY, 0);
        burst(this.node, c, COL.gold, 14, 90);
        const gold = this.core.rollGold();
        floatText(this.node, '+' + gold + ' 钱', 0, EY - 40, COL.gold, 30);
        this.scheduleOnce(() => this.onEnd(true, gold), 1.3);
    }

    private loseBattle() {
        this.busy = true;
        this.banner('全 军 覆 没', COL.red);
        this.scheduleOnce(() => this.onEnd(false, 0), 1.4);
    }

    // ---------------- 交互 ----------------

    private onHeroTap(i: number) {
        if (this.busy || this.auto || !this.core.alive(this.core.heroes[i]) || i === this.active) { return; }
        this.active = i;
        this.selDice = [];
        this.refresh();
    }

    private onEnemyTap(i: number) {
        if (this.core.enemies[i].hp <= 0) { return; }
        this.target = i;
        const e = this.core.enemies[i];
        this.log(e.def.name + '：' + e.def.desc + '（防御 ' + this.core.enemyAc(e) + '，识破 DC ' + e.def.insight + '）');
        this.refresh();
    }

    private onDieTap(id: number) {
        if (this.busy || this.auto) { return; }
        const k = this.selDice.indexOf(id);
        if (k >= 0) { this.selDice.splice(k, 1); } else { this.selDice.push(id); }
        this.refresh();
    }

    private useSkill(sid: string) {
        if (this.busy || this.auto) { return; }
        const s = skillById(sid);
        const reason = this.core.canUse(this.active, sid);
        if (reason) { this.log(s.name + '：' + reason); return; }
        const r = this.core.act(this.active, sid, this.selDice.length ? this.selDice : undefined, this.target);
        if (!r) { this.log(s.name + '：' + this.core.lastError + '（再点一次骰子可取消选择）'); return; }
        this.afterAct(r);
    }

    private onMove() {
        if (this.busy || this.auto) { return; }
        const r = this.core.move(this.active);
        if (r) { this.afterAct(r); } else { this.log(this.core.lastError); }
    }

    private onReload() {
        if (this.busy || this.auto) { return; }
        const r = this.core.reload(this.active);
        if (r) { this.afterAct(r); } else { this.log(this.core.lastError); }
    }

    private afterAct(r: ActResult) {
        this.busy = true;
        this.selDice = [];
        this.log(r.log + this.fxSummary(r.fx));
        this.refresh();
        const t = this.playFx(r.fx, 0);
        this.at(t + 0.15, () => {
            if (this.core.over === 'win') { this.winBattle(); return; }
            this.busy = false;
            const h = this.core.heroes[this.active];
            if (!this.core.alive(h) || (!h.main && !h.bonus)) {
                const next = this.core.liveHeroes().find((o) => o.main || o.bonus);
                if (next) { this.active = next.idx; }
            }
            this.refresh();
            if (this.auto) { this.scheduleOnce(() => this.autoStep(), 0.3); }
        });
    }

    private autoStep() {
        if (!this.auto || this.busy || !this.node.isValid || this.core.over) { return; }
        const p = planStep(this.core);
        if (!p) { this.onEndTurn(); return; }
        this.active = p.hero;
        if (p.target !== undefined) { this.target = p.target; }
        const r = runPlan(this.core, p);
        if (!r) { this.onEndTurn(); return; }
        this.afterAct(r);
    }

    private fxSummary(fx: Fx[]): string {
        const parts: string[] = [];
        for (const f of fx) {
            if (f.k === 'atk' && f.src === 'hero') {
                parts.push(f.hit ? (f.crit ? '暴击 ' : '命中 ') + f.dmg + (f.c ? '（' + checkText(f.c) + '）' : '（必中）')
                    : '未命中（' + checkText(f.c) + '）');
            } else if (f.k === 'heal') { parts.push('恢复 ' + f.amt); }
            else if (f.k === 'block') { parts.push('护甲 +' + f.amt); }
            else if (f.k === 'status') { parts.push(STATUS[f.key].name + ' ' + f.amt); }
            else if (f.k === 'check') { parts.push(f.label + ' ' + checkText(f.c)); }
            else if (f.k === 'save') { parts.push('豁免 ' + checkText(f.c)); }
            else if (f.k === 'dmg' && f.side === 'enemy') { parts.push('伤害 ' + f.amt); }
        }
        return parts.length ? '：' + parts.join('，') : '';
    }

    // ---------------- 表现 ----------------

    private at(t: number, fn: () => void) {
        if (t <= 0) { fn(); } else { this.scheduleOnce(fn, t); }
    }

    private hPos(i: number): Vec3 { return centerOf(this.heroRigs[i], this.node); }
    private ePos(i: number): Vec3 { return centerOf(this.enemyRigs[i], this.node); }

    private ft(text: string, p: Vec3, color: Color, size = 24, dy = 60) {
        floatText(this.node, text, p.x, p.y + dy, color, size);
    }

    /** 按顺序播放事件，返回结束时刻。 */
    private playFx(list: Fx[], t0: number): number {
        let t = t0;
        for (const f of list) {
            switch (f.k) {
                case 'atk': {
                    if (f.src === 'hero') {
                        const rig = this.heroRigs[f.from];
                        const tp = this.ePos(f.to);
                        const hit = heroAttack(rig, this.node, tp, t);
                        this.at(hit, () => {
                            if (f.hit) {
                                hurt(this.enemyRigs[f.to], f.crit ? 1.4 : 1);
                                shake(this.node, f.crit ? 7 : 3);
                                this.ft((f.crit ? '暴击 ' : '') + '-' + f.dmg + (f.absorbed ? '（挡' + f.absorbed + '）' : ''),
                                    tp, COL.red, f.crit ? 34 : 28, this.enemyRigs[f.to].size / 2);
                            } else {
                                this.ft('未命中', tp, COL.dim, 22, this.enemyRigs[f.to].size / 2);
                            }
                            if (f.c) { this.ft('D20 ' + f.c.roll.nat + signed(f.c.bonus) + ' vs ' + f.c.dc, tp, COL.text, 15, -20); }
                            this.refresh(true);
                        });
                        t = hit + 0.3;
                    } else {
                        const rig = this.enemyRigs[f.from];
                        const tp = this.hPos(f.to);
                        this.at(t, () => { if (rig.root.isValid) { enemyAttack(rig, this.node, tp); } });
                        this.at(t + 0.42, () => {
                            if (f.hit) {
                                hurt(this.heroRigs[f.to], 1);
                                shake(this.node, f.crit ? 8 : 4);
                                this.ft(f.dmg > 0 ? (f.crit ? '暴击 ' : '') + '-' + f.dmg : '格挡', tp, f.dmg > 0 ? COL.red : COL.blue,
                                    f.dmg > 0 ? 28 : 22, 70);
                            } else {
                                this.ft('闪避', tp, COL.blue, 22, 70);
                            }
                            this.refresh(true);
                        });
                        t += 0.8;
                    }
                    break;
                }
                case 'dmg': {
                    const p = f.side === 'hero' ? this.hPos(f.to) : this.ePos(f.to);
                    const rig = f.side === 'hero' ? this.heroRigs[f.to] : this.enemyRigs[f.to];
                    this.at(t, () => {
                        if (f.amt > 0) { hurt(rig, 0.7); }
                        this.ft((f.why ? f.why + ' ' : '') + '-' + f.amt, p,
                            f.why === '中毒' ? new Color(120, 220, 110, 255) : COL.red, 22, rig.size / 2);
                        this.refresh(true);
                    });
                    t += 0.28;
                    break;
                }
                case 'heal': {
                    const p = this.hPos(f.to);
                    this.at(t, () => { this.ft('+' + f.amt, p, COL.green, 26, 80); this.sparkle(p, new Color(140, 235, 140, 255)); this.refresh(true); });
                    t += 0.22;
                    break;
                }
                case 'block': {
                    const p = f.side === 'hero' ? this.hPos(f.to) : this.ePos(f.to);
                    this.at(t, () => { this.ft('+' + f.amt + ' 护甲', p, COL.blue, 20, 50); this.refresh(true); });
                    t += 0.15;
                    break;
                }
                case 'status': {
                    const p = f.side === 'hero' ? this.hPos(f.to) : this.ePos(f.to);
                    const c = STATUS[f.key].color;
                    this.at(t, () => { this.ft(STATUS[f.key].name + (f.key === 'stun' ? '' : ' ' + f.amt), p, new Color(c[0], c[1], c[2], 255), 22, 30); this.refresh(true); });
                    t += 0.22;
                    break;
                }
                case 'save': {
                    const p = f.side === 'hero' ? this.hPos(f.to) : this.ePos(f.to);
                    this.at(t, () => this.ft(f.attr + '豁免 ' + (f.c.success ? '成功' : '失败') + '（' + f.c.roll.nat + signed(f.c.bonus) + ' vs ' + f.c.dc + '）',
                        p, f.c.success ? COL.blue : COL.red, 15, f.side === 'hero' ? 96 : -30));
                    t += 0.25;
                    break;
                }
                case 'check': {
                    const p = this.hPos(f.from);
                    this.at(t, () => { castFx(this.heroRigs[f.from], this.node); this.ft(f.label + ' ' + (f.c.success ? '成功' : '失败') + '（' + f.c.roll.nat + signed(f.c.bonus) + ' vs ' + f.c.dc + '）', p, f.c.success ? COL.gold : COL.dim, 16, 96); });
                    t += 0.35;
                    break;
                }
                case 'reveal': {
                    const p = this.ePos(f.to);
                    this.at(t, () => { this.ft('看穿意图', p, COL.gold, 22, -10); this.refresh(true); });
                    t += 0.2;
                    break;
                }
                case 'res': {
                    const h = this.core.heroes[f.to];
                    this.at(t, () => { this.ft('+' + f.amt + ' ' + h.inst.def.res, this.hPos(f.to), COL.gold, 18, 110); this.refresh(true); });
                    t += 0.12;
                    break;
                }
                case 'move': {
                    const rig = this.heroRigs[f.to];
                    this.at(t, () => {
                        const p = rig.root.position;
                        tween(rig.root).to(0.22, { position: new Vec3(p.x, HERO_Y[f.row], 0) }, { easing: 'quadOut' }).start();
                    });
                    t += 0.25;
                    break;
                }
                case 'down': {
                    const rig = f.side === 'hero' ? this.heroRigs[f.to] : this.enemyRigs[f.to];
                    this.at(t, () => { die(rig); this.refresh(true); });
                    t += 0.35;
                    break;
                }
                case 'text': {
                    const p = f.side === 'hero' ? this.hPos(f.to) : this.ePos(f.to);
                    this.at(t, () => {
                        if (f.side === 'hero' && /授计|解毒|药力/.test(f.text)) { castFx(this.heroRigs[f.to], this.node); }
                        this.ft(f.text, p, COL.gold, 18, f.side === 'hero' ? 100 : 20);
                        this.refresh(true);
                    });
                    t += 0.25;
                    break;
                }
            }
        }
        return t;
    }

    private banner(text: string, color: Color) {
        const l = mkLabel(this.node, text, 40, color, 0, 200);
        const n = l.node;
        const op = n.addComponent(UIOpacity);
        op.opacity = 0;
        n.setScale(0.6, 0.6, 1);
        tween(n).to(0.16, { scale: new Vec3(1.08, 1.08, 1) }, { easing: 'backOut' }).to(0.08, { scale: Vec3.ONE }).start();
        tween(op).to(0.14, { opacity: 255 }).delay(0.5).to(0.3, { opacity: 0 }).call(() => n.destroy()).start();
    }

    private sparkle(pos: Vec3, color: Color, n = 6) {
        for (let i = 0; i < n; i++) {
            const p = mkNode(this.node, 'sparkle', 4, 4, pos.x + (Math.random() - 0.5) * 56, pos.y - 30 + Math.random() * 20);
            const g = p.addComponent(Graphics);
            g.fillColor = color;
            g.circle(0, 0, 2.5 + Math.random() * 3);
            g.fill();
            const op = p.addComponent(UIOpacity);
            tween(p).by(0.75, { position: new Vec3((Math.random() - 0.5) * 20, 80, 0) }, { easing: 'sineOut' }).start();
            tween(op).delay(0.35).to(0.35, { opacity: 0 }).call(() => p.destroy()).start();
        }
    }

    /** 当前行动者的骰子入场：点数快速翻动后逐颗落定。 */
    private rollDiceIn() {
        if (!this.panel) { return; }
        const box = this.panel.getChildByName('dice');
        if (!box) { return; }
        const kids = box.children.slice();
        const h = this.core.heroes[this.active];
        let tick = 0;
        const step = () => {
            tick++;
            kids.forEach((n, i) => {
                if (!n.isValid) { return; }
                const g = n.getComponent(Graphics);
                if (tick < 4 + i * 2) {
                    drawDie(g, DIE, { value: 1 + Math.floor(Math.random() * 6) });
                    n.angle = (Math.random() - 0.5) * 30;
                } else if (tick === 4 + i * 2) {
                    n.angle = 0;
                    const d = h.dice[i];
                    if (d) { drawDie(g, DIE, { value: d.value, sel: this.selDice.indexOf(d.id) >= 0 }); }
                    tween(n).to(0.1, { scale: new Vec3(1.2, 1.2, 1) }).to(0.12, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
                }
            });
            if (tick >= 4 + kids.length * 2) { this.unschedule(step); }
        };
        this.schedule(step, 0.07);
    }

    // ---------------- 刷新 ----------------

    /** light=true 时只刷新血条/状态（动画过程中），不重建技能面板。 */
    private refresh(light = false) {
        const core = this.core;
        if (!this.node.isValid) { return; }
        this.roundLabel.string = core.round > 0 ? '第 ' + core.round + ' 回合' : '战斗开始';
        if (core.enemies[this.target].hp <= 0 && core.liveEnemies().length) { this.target = core.liveEnemies()[0].idx; }
        core.enemies.forEach((e, i) => {
            const ui = this.enemyUI[i];
            const dead = e.hp <= 0;
            ui.chip.active = !dead;
            ui.hp.node.active = ui.hpText.node.active = ui.status.node.active = !dead;
            ui.name.node.active = !dead;
            ui.ring.clear();
            if (dead) { return; }
            ui.hp.set(e.hp / e.maxHp);
            ui.hpText.string = e.hp + '/' + e.maxHp + (e.block ? '  盾' + e.block : '');
            const it = core.intentOf(e);
            ui.chipL.string = (e.status.stun ? '[震慑] ' : '') + core.intentText(e) + (e.revealed ? '' : ' ·未识破');
            drawPanel(ui.chipG, 196, 34, INTENT_COL[it.type], 8, e.revealed ? COL.gold : COL.border, 2);
            const st: string[] = ['防' + core.enemyAc(e)];
            for (const k of Object.keys(e.status)) {
                if (e.status[k] > 0) { st.push(STATUS[k].name + (k === 'stun' ? '' : e.status[k])); }
            }
            if (e.ambush) { st.push('伏击'); }
            if (e.charge) { st.push('蓄势+' + e.charge); }
            ui.status.string = st.join(' ');
            if (e.enraged && !this.enraged[i]) { this.enraged[i] = true; enrage(this.enemyRigs[i]); this.ft('狂暴！', this.ePos(i), COL.red, 26, 40); }
            if (i === this.target) {
                const r = this.enemyRigs[i].size * 0.42;
                ui.ring.strokeColor = COL.gold;
                ui.ring.lineWidth = 3;
                ui.ring.ellipse(0, 0, r, r * 0.3);
                ui.ring.stroke();
            }
            // 大额攻击意图徽章脉动预警
            Tween.stopAllByTarget(ui.chip);
            ui.chip.setScale(1, 1, 1);
            if (!light && (it.type === 'aoe' || (it.type === 'atk' && (it.hits || 1) > 1) || e.charge > 0)) {
                tween(ui.chip).repeatForever(tween(ui.chip).to(0.32, { scale: new Vec3(1.08, 1.08, 1) }).to(0.32, { scale: Vec3.ONE })).start();
            }
        });
        core.heroes.forEach((h, i) => {
            const ui = this.heroUI[i];
            const alive = core.alive(h);
            ui.name.string = h.inst.def.name + (alive ? ' · ' + (h.row === 'front' ? '前排' : '后排') : ' · 倒下');
            ui.hp.set(h.inst.hp / h.inst.maxHp);
            ui.hpText.string = h.inst.hp + '/' + h.inst.maxHp + (h.block ? '  甲' + h.block : '');
            const free = h.dice.filter((d) => !d.used).map((d) => d.value);
            ui.info.string = alive ? h.inst.def.res + ' ' + '●'.repeat(h.res) + '○'.repeat(Math.max(0, h.inst.def.resMax - h.res)) +
                '  骰[' + (free.length ? free.join(' ') : '—') + ']' : '';
            const st: string[] = [];
            for (const k of Object.keys(h.status)) { if (h.status[k] > 0) { st.push(STATUS[k].name + (k === 'stun' ? '' : h.status[k])); } }
            if (core.protect && core.protect.to === i) { st.push('受守护'); }
            ui.status.string = st.join(' ');
            drawPanel(ui.ring, 220, 228, i === this.active && alive ? new Color(92, 66, 44, 255) : new Color(50, 36, 26, 255), 10,
                i === this.active && alive ? COL.gold : null, 3);
        });
        if (!light) { this.buildPanel(); }
    }

    /** 当前行动者面板：行动额度、独立骰池、技能与按钮。 */
    private buildPanel() {
        if (this.panel && this.panel.isValid) { this.panel.destroy(); }
        const core = this.core;
        const p = mkNode(this.node, 'panel', 0, 0, 0, 0);
        this.panel = p;
        const h = core.heroes[this.active];
        mkPanel(p, 704, 532, 0, -286, new Color(46, 33, 24, 255), 12, COL.border, 2);
        if (!h || !core.alive(h)) { return; }
        const w = core.weaponOf(h);
        mkLabel(p, h.inst.def.name + '·' + h.inst.def.title + '　' + weaponName(h.inst.weapon) + '（1D' + w.die +
            (w.ranged ? ' 远程' : w.reach ? ' 长兵' : ' 近战') + '）　命中 ' + signed(core.atkBonus(h)) + '　防御 ' + core.heroAc(h),
        15, COL.gold, 0, -44, 680);
        const pip = (txt: string, on: boolean, x: number) => mkLabel(p, txt, 13, on ? COL.green : new Color(110, 96, 80, 255), x, -70);
        pip('移动' + (h.move ? '●' : '○'), h.move, -270);
        pip('主要' + (h.main ? '●' : '○'), h.main, -185);
        pip('附赠' + (h.bonus ? '●' : '○'), h.bonus, -100);
        pip('反应' + (h.react ? '●' : '○'), h.react, -15);
        mkLabel(p, h.inst.def.res + ' ' + h.res + '/' + h.inst.def.resMax + (w.reload ? (h.loaded ? '　已装填' : '　未装填') : ''),
            13, COL.text, 200, -70);

        // 独立骰池（只显示当前行动者的骰子）
        const box = mkNode(p, 'dice', 0, 0, -120, -124);
        mkLabel(p, '行动骰', 13, COL.dim, -300, -124);
        h.dice.forEach((d, i) => {
            const sel = this.selDice.indexOf(d.id) >= 0;
            const dn = mkNode(box, 'd' + i, DIE, DIE, (i - 1) * 74, sel ? 8 : 0);
            drawDie(dn.addComponent(Graphics), DIE, { value: d.value, sel });
            if (d.used) { dn.addComponent(UIOpacity).opacity = 60; } else { dn.on(Node.EventType.TOUCH_END, () => this.onDieTap(d.id)); }
        });
        mkLabel(p, this.selDice.length ? '已选 ' + this.selDice.length + ' 颗：点技能用其支付' : '可先点骰子指定支付，否则自动挑选',
            12, COL.dim, 200, -124, 260);

        // 技能
        const skills = core.skillsOf(this.active);
        skills.forEach((sid, i) => {
            const s = skillById(sid);
            const x = i % 2 === 0 ? -173 : 173, y = -200 - Math.floor(i / 2) * 80;
            const reason = core.canUse(this.active, sid);
            const ok = !reason && !this.busy && !this.auto;
            const fill = !ok ? COL.btnOff : s.action === 'main' ? COL.btn : new Color(50, 82, 124, 255);
            const n = mkPanel(p, 338, 74, x, y, fill, 8, ok ? COL.border : new Color(90, 76, 62, 255), 2).node;
            mkLabel(n, s.name, 16, ok ? new Color(255, 246, 228, 255) : COL.dim, 0, 20, 318, LEFT);
            mkLabel(n, '骰槽 ' + SLOT_TEXT[s.slot] + ' · ' + (s.action === 'main' ? '主要' : '附赠') + (s.cost ? ' · ' + s.cost + h.inst.def.res : ''),
                11.5, ok ? COL.gold : COL.dim, 0, 20, 318, RIGHT);
            mkLabel(n, s.desc, 11, ok ? COL.text : COL.dim, 0, -12, 318, LEFT);
            n.on(Node.EventType.TOUCH_END, () => this.useSkill(sid));
        });

        const locked = this.busy || this.auto;
        const mv: BtnHandle = mkButton(p, h.row === 'front' ? '移动→后排' : '移动→前排', 210, 52, -235, -452, 17, () => this.onMove());
        setBtnEnabled(mv, !locked && h.move, 210, 52);
        if (w.reload) {
            const rl = mkButton(p, '装填（附赠）', 210, 52, 0, -452, 17, () => this.onReload());
            setBtnEnabled(rl, !locked && !h.loaded && h.bonus, 210, 52);
        }
        const au = mkButton(p, this.auto ? '自动:开' : '自动:关', 210, 52, 235, -452, 17, () => {
            this.auto = !this.auto;
            this.refresh();
            if (this.auto && !this.busy) { this.scheduleOnce(() => this.autoStep(), 0.3); }
        });
        setBtnEnabled(au, true, 210, 52);
        const end = mkButton(p, '结束回合', 300, 58, 0, -516, 22, () => this.onEndTurn());
        setBtnEnabled(end, !locked, 300, 58);
        mkLabel(p, '点角色切换行动者 · 点敌人选目标 · 每人每回合：移动1 主要1 附赠1 反应1', 12, COL.dim, 0, -572, 690);
    }

    private log(msg: string) {
        if (this.logLabel && this.logLabel.isValid) { this.logLabel.string = msg; }
    }
}
