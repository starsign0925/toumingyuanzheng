// 骰命远征 —— 纯代码 UI 构建辅助
import {
    Node, UITransform, Graphics, Label, Button, Color, Layers,
    HorizontalTextAlignment, VerticalTextAlignment,
    tween, Tween, Vec3, UIOpacity,
} from 'cc';
import { SLOT_TEXT } from './Data';
import type { CardDef, Intent } from './Data';

// 欧式中世纪配色：深色橡木 / 皮革 / 青铜描边 / 酒红按钮 / 羊皮纸文字
export const COL = {
    bg: new Color(30, 22, 17, 255),
    panel: new Color(62, 44, 32, 255),
    panelLight: new Color(92, 66, 44, 255),
    border: new Color(166, 126, 66, 255),
    gold: new Color(236, 194, 98, 255),
    text: new Color(242, 230, 204, 255),
    dim: new Color(176, 156, 126, 255),
    red: new Color(214, 76, 58, 255),
    green: new Color(126, 186, 96, 255),
    blue: new Color(120, 164, 214, 255),
    btn: new Color(124, 38, 34, 255),
    btnOff: new Color(66, 56, 50, 255),
    dieAttack: new Color(245, 238, 224, 255),
    dieShield: new Color(120, 168, 210, 255),
    dieHeal: new Color(130, 198, 140, 255),
    pip: new Color(35, 35, 45, 255),
};

// 衬线字体（西文 Georgia + 中文宋体），营造古典书卷感
const FONT = "Georgia, 'Times New Roman', 'Songti SC', STSong, SimSun, serif";

export function mkNode(parent: Node, name: string, w = 0, h = 0, x = 0, y = 0): Node {
    const n = new Node(name);
    n.layer = Layers.Enum.UI_2D;
    parent.addChild(n);
    const ut = n.addComponent(UITransform);
    ut.setContentSize(w, h);
    n.setPosition(x, y, 0);
    return n;
}

export function mkLabel(
    parent: Node, text: string, size = 20, color: Color = COL.text,
    x = 0, y = 0, w = 0,
    hAlign: HorizontalTextAlignment = HorizontalTextAlignment.CENTER,
): Label {
    const n = mkNode(parent, 'lbl', w > 0 ? w : 0, size * 1.4, x, y);
    const l = n.addComponent(Label);
    l.useSystemFont = true;
    l.fontFamily = FONT;
    l.isBold = size >= 24;
    l.string = text;
    l.fontSize = size;
    l.lineHeight = size * 1.25;
    l.color = color;
    l.horizontalAlign = hAlign;
    l.verticalAlign = VerticalTextAlignment.CENTER;
    if (w > 0) {
        l.enableWrapText = true;
        l.overflow = Label.Overflow.CLAMP;
        n.getComponent(UITransform).setContentSize(w, size * 1.4);
    }
    return l;
}

export function mkPanel(
    parent: Node, w: number, h: number, x = 0, y = 0,
    fill: Color = COL.panel, r = 10, stroke: Color = COL.border, lineW = 2,
): { node: Node; g: Graphics } {
    const n = mkNode(parent, 'panel', w, h, x, y);
    const g = n.addComponent(Graphics);
    drawPanel(g, w, h, fill, r, stroke, lineW);
    return { node: n, g };
}

export function drawPanel(
    g: Graphics, w: number, h: number,
    fill: Color, r = 10, stroke: Color = null, lineW = 2,
) {
    g.clear();
    g.lineWidth = lineW;
    g.fillColor = fill;
    if (stroke) { g.strokeColor = stroke; }
    g.roundRect(-w / 2, -h / 2, w, h, r);
    g.fill();
    if (stroke) { g.stroke(); }
}

export interface BtnHandle {
    node: Node;
    btn: Button;
    label: Label;
    g: Graphics;
}

export function mkButton(
    parent: Node, text: string, w: number, h: number, x = 0, y = 0,
    fontSize = 20, cb: () => void = null,
): BtnHandle {
    const n = mkNode(parent, 'btn_' + text, w, h, x, y);
    const g = n.addComponent(Graphics);
    drawPanel(g, w, h, COL.btn, 8, COL.border, 2);
    const label = mkLabel(n, text, fontSize, COL.text, 0, 0, w - 8);
    const btn = n.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    btn.zoomScale = 0.93;
    btn.duration = 0.08;
    btn.target = n;
    if (cb) { n.on(Button.EventType.CLICK, cb); }
    return { node: n, btn, label, g };
}

export function setBtnEnabled(h: BtnHandle, enabled: boolean, w: number, hgt: number) {
    h.btn.interactable = enabled;
    drawPanel(h.g, w, hgt, enabled ? COL.btn : COL.btnOff, 8, enabled ? COL.border : COL.btnOff, 2);
    h.label.color = enabled ? COL.text : COL.dim;
}

// ---------------- 骰子 ----------------

const PIP_POS: { [v: number]: number[][] } = {
    1: [[0, 0]],
    2: [[-1, 1], [1, -1]],
    3: [[-1, 1], [0, 0], [1, -1]],
    4: [[-1, 1], [1, 1], [-1, -1], [1, -1]],
    5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]],
    6: [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]],
};

/** 画一颗象牙骰子。 */
export function drawDie(g: Graphics, size: number, die: { value: number; sel?: boolean }) {
    g.clear();
    g.lineWidth = die.sel ? 5 : 3;
    g.strokeColor = die.sel ? COL.gold : new Color(90, 70, 50, 255);
    g.fillColor = COL.dieAttack;
    g.roundRect(-size / 2, -size / 2, size, size, size * 0.18);
    g.fill();
    g.stroke();
    g.fillColor = COL.pip;
    const o = size * 0.27;
    const r = size * 0.075;
    const pos = PIP_POS[die.value] || PIP_POS[1];
    for (let i = 0; i < pos.length; i++) {
        g.circle(pos[i][0] * o, pos[i][1] * o, r);
        g.fill();
    }
}

// ---------------- 血条 ----------------

export interface BarHandle {
    node: Node;
    g: Graphics;
    set: (ratio: number) => void;
}

export function mkBar(parent: Node, w: number, h: number, x = 0, y = 0): BarHandle {
    const n = mkNode(parent, 'bar', w, h, x, y);
    const g = n.addComponent(Graphics);
    const set = (ratio: number) => {
        const r = Math.max(0, Math.min(1, ratio));
        g.clear();
        g.fillColor = new Color(20, 20, 28, 255);
        g.roundRect(-w / 2, -h / 2, w, h, h / 2);
        g.fill();
        if (r > 0) {
            g.fillColor = r > 0.5 ? COL.green : (r > 0.25 ? COL.gold : COL.red);
            const fw = Math.max(h, w * r);
            g.roundRect(-w / 2, -h / 2, fw, h, h / 2);
            g.fill();
        }
    };
    set(1);
    return { node: n, g, set };
}

// ---------------- 人物 ----------------

/** 简化卡通小人：圆头 + 方身体 + 眼睛。size 为整体高度。 */
export function drawHeroFigure(g: Graphics, size: number, body: Color) {
    g.clear();
    const skin = new Color(240, 208, 178, 255);
    const dark = new Color(40, 40, 50, 255);
    // 身体
    g.fillColor = body;
    g.roundRect(-size * 0.32, -size * 0.5, size * 0.64, size * 0.62, size * 0.16);
    g.fill();
    // 头
    g.fillColor = skin;
    g.circle(0, size * 0.26, size * 0.24);
    g.fill();
    // 眼睛
    g.fillColor = dark;
    g.circle(-size * 0.09, size * 0.3, size * 0.035);
    g.fill();
    g.circle(size * 0.09, size * 0.3, size * 0.035);
    g.fill();
    // 腰带
    g.fillColor = new Color(30, 30, 40, 255);
    g.rect(-size * 0.32, -size * 0.18, size * 0.64, size * 0.07);
    g.fill();
}

/** 敌方怪物：深色块 + 角 + 怒目。 */
export function drawMonsterFigure(g: Graphics, size: number, body: Color) {
    g.clear();
    const eyeW = new Color(255, 240, 220, 255);
    const pupil = new Color(200, 40, 30, 255);
    // 角
    g.fillColor = new Color(50, 45, 60, 255);
    g.moveTo(-size * 0.3, size * 0.28);
    g.lineTo(-size * 0.42, size * 0.62);
    g.lineTo(-size * 0.12, size * 0.38);
    g.close();
    g.fill();
    g.moveTo(size * 0.3, size * 0.28);
    g.lineTo(size * 0.42, size * 0.62);
    g.lineTo(size * 0.12, size * 0.38);
    g.close();
    g.fill();
    // 身体
    g.fillColor = body;
    g.roundRect(-size * 0.44, -size * 0.5, size * 0.88, size * 0.86, size * 0.3);
    g.fill();
    // 眼睛
    g.fillColor = eyeW;
    g.circle(-size * 0.16, size * 0.1, size * 0.09);
    g.fill();
    g.circle(size * 0.16, size * 0.1, size * 0.09);
    g.fill();
    g.fillColor = pupil;
    g.circle(-size * 0.16, size * 0.1, size * 0.045);
    g.fill();
    g.circle(size * 0.16, size * 0.1, size * 0.045);
    g.fill();
    // 嘴
    g.strokeColor = new Color(30, 25, 35, 255);
    g.lineWidth = size * 0.03;
    g.moveTo(-size * 0.14, -size * 0.18);
    g.lineTo(size * 0.14, -size * 0.18);
    g.stroke();
}

// ---------------- 动画辅助 ----------------

/** 待机浮动（无限循环）。 */
export function bob(node: Node, amp = 5, dur = 0.9, delay = 0) {
    const p = node.position.clone();
    const tw = tween(node).to(dur, { position: new Vec3(p.x, p.y + amp, p.z) })
        .to(dur, { position: new Vec3(p.x, p.y, p.z) });
    tween(node).delay(delay).repeatForever(tw).start();
}

/** 果冻呼吸（咸鱼之王式压扁拉伸待机）。 */
export function jelly(node: Node, amp = 0.09, dur = 0.65, delay = 0) {
    const tw = tween(node)
        .to(dur, { scale: new Vec3(1 + amp, 1 - amp, 1) })
        .to(dur, { scale: new Vec3(1 - amp * 0.6, 1 + amp * 0.6, 1) });
    tween(node).delay(delay).repeatForever(tw).start();
}

/** 受击压扁回弹（作用在父节点，与子节点 jelly 叠加）。 */
export function squashHit(node: Node, power = 1) {
    tween(node)
        .to(0.07, { scale: new Vec3(1 + 0.28 * power, 1 - 0.35 * power, 1) })
        .to(0.2, { scale: Vec3.ONE }, { easing: 'backOut' })
        .start();
}

/** 压扁消散（敌人阵亡）。 */
export function squashDeath(node: Node) {
    Tween.stopAllByTarget(node);
    tween(node)
        .to(0.14, { scale: new Vec3(1.3, 1.3, 1) })
        .to(0.32, { scale: new Vec3(1.35, 0.08, 1), angle: -10 })
        .start();
    const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    tween(op).delay(0.3).to(0.3, { opacity: 0 }).start();
}

/** 左右抖动（受击/震屏）。 */
export function shake(node: Node, dist = 9, times = 3) {
    const p = node.position.clone();
    let t = tween(node);
    for (let i = 0; i < times; i++) {
        t = t.to(0.045, { position: new Vec3(p.x + (i % 2 === 0 ? dist : -dist), p.y, p.z) });
    }
    t.to(0.05, { position: p }).start();
}

/** 蓄力前扑再回位（攻击动作）。 */
export function lunge(node: Node, dir: Vec3, dur = 0.16, back = 0.26, delay = 0) {
    const p = node.position.clone();
    tween(node).delay(delay)
        .to(dur * 0.4, { scale: new Vec3(0.85, 0.85, 1) })
        .to(dur, { position: p.clone().add(dir), scale: new Vec3(1.15, 0.85, 1) })
        .to(back, { position: p, scale: Vec3.ONE }, { easing: 'sineOut' })
        .start();
}

/** 倒地阵亡。 */
export function fall(node: Node) {
    Tween.stopAllByTarget(node);
    tween(node).to(0.35, { angle: -75 }).start();
    const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    tween(op).to(0.35, { opacity: 90 }).start();
}

/** 缩放淡入（登场）。 */
export function popIn(node: Node, dur = 0.35, from = 0.2, overshoot = 1.15, delay = 0) {
    node.setScale(from, from, 1);
    tween(node).delay(delay)
        .to(dur * 0.6, { scale: new Vec3(overshoot, overshoot, 1) })
        .to(dur * 0.4, { scale: Vec3.ONE }).start();
}

/** 浮动文字：弹跳出现 + 上飘淡出（伤害/治疗数字）。 */
export function floatText(parent: Node, text: string, x: number, y: number,
    color: Color, size = 26) {
    const l = mkLabel(parent, text, size, color, x, y);
    const n = l.node;
    const op = n.addComponent(UIOpacity);
    n.setScale(0.3, 0.3, 1);
    n.angle = (Math.random() - 0.5) * 10;
    tween(n).to(0.1, { scale: new Vec3(1.35, 1.35, 1) })
        .to(0.12, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
    tween(n).by(0.6, { position: new Vec3((Math.random() - 0.5) * 34, 58, 0) }).start();
    tween(op).delay(0.5).to(0.28, { opacity: 0 }).call(() => n.destroy()).start();
}

// ---------------- 卡牌视图（羊皮纸卡 + 骰槽） ----------------

const CARD_FILL = new Color(240, 226, 190, 255);
const CARD_TYPE_COL: { [k: string]: Color } = {
    attack: new Color(170, 60, 46, 255),
    skill: new Color(80, 118, 158, 255),
    dice: new Color(80, 146, 92, 255),
};
const INK = new Color(66, 48, 32, 255);

export interface CardView {
    node: Node;
    g: Graphics;
    badgeG: Graphics;
    badgeLabel: Label;
    def: CardDef;
    w: number;
    h: number;
}

export function mkCard(parent: Node, def: CardDef, x: number, y: number, w = 132, h = 190): CardView {
    const n = mkNode(parent, 'card_' + def.id, w, h, x, y);
    const g = n.addComponent(Graphics);
    const border = def.rare ? COL.gold : CARD_TYPE_COL[def.type];
    g.fillColor = CARD_FILL;
    g.strokeColor = border;
    g.lineWidth = def.rare ? 4 : 2.5;
    g.roundRect(-w / 2, -h / 2, w, h, 10);
    g.fill();
    g.stroke();
    // 名称条
    g.fillColor = new Color(84, 60, 40, 255);
    g.roundRect(-w / 2 + 3, h / 2 - 30, w - 6, 26, 6);
    g.fill();
    mkLabel(n, def.name, 14, new Color(250, 244, 228, 255), 0, h / 2 - 17);
    // 骰槽徽标（右上角）
    const bn = mkNode(n, 'badge', 34, 34, w / 2 - 20, h / 2 - 18);
    const badgeG = bn.addComponent(Graphics);
    drawSlotBadge(badgeG, def.slot, false);
    const badgeLabel = mkLabel(bn, SLOT_TEXT[def.slot], 11, new Color(255, 246, 220, 255), 0, 0);
    // 底部类型条
    g.fillColor = CARD_TYPE_COL[def.type];
    g.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, 16, 4);
    g.fill();
    mkLabel(n, def.type === 'attack' ? '攻击' : def.type === 'skill' ? '技能' : '骰子',
        10.5, new Color(255, 246, 220, 255), 0, -h / 2 + 11);
    // 描述（深褐墨字）
    mkLabel(n, def.desc, 10.5, INK, 0, def.slot === 'none' ? 6 : -4, w - 18);
    // 空骰槽示意
    if (def.slot !== 'none') {
        g.strokeColor = new Color(140, 110, 80, 180);
        g.lineWidth = 2;
        g.roundRect(-17, h / 2 - 66, 34, 34, 6);
        g.stroke();
        mkLabel(n, '骰', 13, new Color(150, 120, 90, 200), 0, h / 2 - 49);
    }
    return { node: n, g, badgeG, badgeLabel, def, w, h };
}

/** 骰槽徽标：圆形，按条件变色。filled=true 表示已放骰子。 */
export function drawSlotBadge(g: Graphics, slot: string, filled: boolean) {
    g.clear();
    const col = slot === 'none' ? new Color(120, 100, 80, 255)
        : filled ? COL.gold : new Color(110, 80, 50, 255);
    g.fillColor = col;
    g.strokeColor = new Color(50, 36, 24, 255);
    g.lineWidth = 2;
    g.circle(0, 0, 16);
    g.fill();
    g.stroke();
}

/** 意图徽章（敌人头顶）：返回面板节点。 */
export function mkIntentChip(parent: Node, it: Intent, str: number, x: number, y: number): Label {
    let text = '';
    let col: Color = COL.panel;
    const d = (it.dmg || 0) + str;
    switch (it.type) {
        case 'atk': text = '攻击 ' + d + (it.hits && it.hits > 1 ? '×' + it.hits : ''); col = new Color(140, 46, 38, 255); break;
        case 'atkblock': text = '攻击 ' + d + (it.hits && it.hits > 1 ? '×' + it.hits : '') + ' 格挡 ' + it.block; col = new Color(120, 70, 46, 255); break;
        case 'block': text = '格挡 ' + it.block; col = new Color(70, 100, 140, 255); break;
        case 'buff': text = '强化 +' + it.str; col = new Color(150, 100, 40, 255); break;
        case 'curse': text = '诅咒：下回合 -1 骰'; col = new Color(100, 56, 120, 255); break;
    }
    mkPanel(parent, 170, 34, x, y, col, 8, COL.border, 2);
    return mkLabel(parent, text, 16, new Color(255, 246, 224, 255), x, y);
}

// ---------------- 地图节点图标 ----------------

export type MapKindName = 'battle' | 'elite' | 'treasure' | 'event' | 'rest' | 'boss';

/** 在 ~26px 范围内绘制节点图标（不含底色圆）。 */
export function drawNodeIcon(g: Graphics, kind: MapKindName) {
    switch (kind) {
        case 'battle': { // 交叉双剑
            g.strokeColor = new Color(220, 90, 80, 255);
            g.lineWidth = 5;
            g.moveTo(-9, -9); g.lineTo(9, 9); g.stroke();
            g.moveTo(-9, 9); g.lineTo(9, -9); g.stroke();
            break;
        }
        case 'elite': { // 五角星
            g.fillColor = new Color(230, 150, 70, 255);
            for (let i = 0; i < 10; i++) {
                const a = Math.PI / 2 + i * Math.PI / 5;
                const r = i % 2 === 0 ? 13 : 6;
                const px = Math.cos(a) * r, py = Math.sin(a) * r;
                if (i === 0) { g.moveTo(px, py); } else { g.lineTo(px, py); }
            }
            g.close(); g.fill();
            break;
        }
        case 'treasure': { // 宝箱
            g.fillColor = new Color(230, 190, 80, 255);
            g.roundRect(-12, -8, 24, 15, 3); g.fill();
            g.strokeColor = new Color(90, 60, 20, 255);
            g.lineWidth = 2;
            g.moveTo(-12, -1); g.lineTo(12, -1); g.stroke();
            g.fillColor = new Color(90, 60, 20, 255);
            g.circle(0, -1, 2.6); g.fill();
            break;
        }
        case 'event': { // 感叹号
            g.fillColor = new Color(120, 170, 230, 255);
            g.roundRect(-3, -1, 6, 14, 3); g.fill();
            g.circle(0, -9, 3.4); g.fill();
            break;
        }
        case 'rest': { // 帐篷
            g.fillColor = new Color(120, 200, 120, 255);
            g.moveTo(-13, -10); g.lineTo(0, 11); g.lineTo(13, -10);
            g.close(); g.fill();
            g.fillColor = new Color(20, 40, 24, 255);
            g.moveTo(-4, -10); g.lineTo(0, 0); g.lineTo(4, -10);
            g.close(); g.fill();
            break;
        }
        case 'boss': { // 王冠
            g.fillColor = new Color(215, 70, 70, 255);
            g.moveTo(-13, -10);
            g.lineTo(-13, 5); g.lineTo(-7, -2); g.lineTo(0, 9);
            g.lineTo(7, -2); g.lineTo(13, 5); g.lineTo(13, -10);
            g.close(); g.fill();
            break;
        }
    }
}

// ---------------- 标签 ----------------

export function mkTag(parent: Node, text: string, x = 0, y = 0, color: Color = COL.gold): Label {
    return mkLabel(parent, text, 16, color, x, y, 0);
}
