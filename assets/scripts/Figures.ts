// 骰命远征 —— 欧式中世纪角色：矢量绘制 + 骨骼式部件动画
// 角色结构：root(位移/受击) → flip(敌人镜像) → [背景部件] + body(脚底为轴，果冻呼吸) → arm(肩为轴，武器挥动)
import { Node, Graphics, Color, Vec3, UITransform, UIOpacity, tween, Tween } from 'cc';
import { mkNode, jelly, squashHit, squashDeath, fall } from './UI';

const OUT = new Color(38, 26, 20, 255);
const SKIN = new Color(238, 200, 164, 255);
const GOLD = new Color(214, 172, 72, 255);
const STEEL = new Color(170, 174, 186, 255);
const BONE = new Color(226, 218, 198, 255);

function C(r: number, g: number, b: number, a = 255): Color { return new Color(r, g, b, a); }

type Draw = (g: Graphics, u: number) => void;

// ---------------- 绘制小工具（坐标单位 u = 身高/100，脚底 y=0，面朝 +x） ----------------

function paint(g: Graphics, fill: Color, u: number) {
    g.fillColor = fill;
    g.strokeColor = OUT;
    g.lineWidth = Math.max(1.2, 1.7 * u);
}
function fs(g: Graphics) { g.fill(); g.stroke(); }
function poly(g: Graphics, u: number, p: number[], stroke = true) {
    g.moveTo(p[0] * u, p[1] * u);
    for (let i = 2; i < p.length; i += 2) { g.lineTo(p[i] * u, p[i + 1] * u); }
    g.close();
    if (stroke) { fs(g); } else { g.fill(); }
}
function rr(g: Graphics, u: number, x: number, y: number, w: number, h: number, r: number, stroke = true) {
    g.roundRect(x * u, y * u, w * u, h * u, r * u);
    if (stroke) { fs(g); } else { g.fill(); }
}
function circ(g: Graphics, u: number, x: number, y: number, r: number, stroke = true) {
    g.circle(x * u, y * u, r * u);
    if (stroke) { fs(g); } else { g.fill(); }
}
function ell(g: Graphics, u: number, x: number, y: number, rx: number, ry: number, stroke = true) {
    g.ellipse(x * u, y * u, rx * u, ry * u);
    if (stroke) { fs(g); } else { g.fill(); }
}
function dot(g: Graphics, u: number, x: number, y: number, r: number, c: Color) {
    g.fillColor = c;
    circ(g, u, x, y, r, false);
}
function star(g: Graphics, u: number, x: number, y: number, r: number, c: Color) {
    g.fillColor = c;
    const p: number[] = [];
    for (let i = 0; i < 10; i++) {
        const a = Math.PI / 2 + i * Math.PI / 5;
        const rad = i % 2 === 0 ? r : r * 0.45;
        p.push(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    poly(g, u, p, false);
}
function boots(g: Graphics, u: number, c: Color, h = 10) {
    paint(g, c, u);
    rr(g, u, -13, 0, 10, h, 2.5);
    rr(g, u, 3, 0, 10, h, 2.5);
}
function eyes(g: Graphics, u: number, x: number, y: number, c: Color = C(30, 22, 20), r = 1.7) {
    dot(g, u, x, y, r, c);
    dot(g, u, x + 4.6, y, r, c);
}
function sleeve(g: Graphics, u: number, c: Color, len = 16, w = 4) {
    paint(g, c, u);
    poly(g, u, [-w, 2, w, 2, w + 0.6, -len, -w - 0.6, -len]);
}
function hand(g: Graphics, u: number, y: number, c: Color = SKIN, r = 3.5) {
    paint(g, c, u);
    circ(g, u, 0, y, r);
}

// ---------------- 角色规格 ----------------

interface Part { name: string; x: number; y: number; draw: Draw; onArm?: boolean; }
interface Spec {
    body: Draw;
    arm?: { x: number; y: number; draw: Draw };
    extras?: Part[];          // 画在身体之上
    back?: Part[];            // 画在身体之后（披风、翅膀、光环）
    tip: { x: number; y: number; onArm: boolean }; // 投射物发射点
    fx: Color;                // 技能/命中特效主色
}

const SPECS: { [id: string]: Spec } = {
    // ===== 英雄 =====
    astro: { // 占星师：尖顶星袍巫师，白须，星辉法杖
        fx: C(150, 170, 255),
        body: (g, u) => {
            boots(g, u, C(60, 44, 70));
            paint(g, C(86, 64, 150), u); poly(g, u, [-19, 6, 19, 6, 11, 56, -11, 56]);
            paint(g, GOLD, u); poly(g, u, [-19, 6, 19, 6, 18, 10, -18, 10]);
            paint(g, C(90, 60, 36), u); rr(g, u, -11, 34, 22, 4, 1);
            star(g, u, -8, 20, 3, GOLD); star(g, u, 7, 26, 2.4, GOLD); star(g, u, -3, 46, 2.2, GOLD);
            paint(g, SKIN, u); circ(g, u, 2, 66, 12);
            paint(g, C(238, 238, 232), u); poly(g, u, [-5, 64, 14, 64, 11, 50, 3, 37, -3, 52]);
            paint(g, SKIN, u); circ(g, u, 13.5, 66, 2.5);
            eyes(g, u, 5.5, 69.5);
            paint(g, C(70, 48, 128), u); ell(g, u, 2, 77, 21, 4.5);
            g.moveTo(-11 * u, 78 * u); g.lineTo(15 * u, 78 * u);
            g.quadraticCurveTo(10 * u, 94 * u, -8 * u, 112 * u);
            g.quadraticCurveTo(-5 * u, 94 * u, -11 * u, 78 * u); g.close(); fs(g);
            paint(g, GOLD, u); poly(g, u, [-11, 78, 15, 78, 13.6, 83, -10, 83]);
            star(g, u, 2, 92, 3.6, C(250, 220, 120));
        },
        arm: {
            x: 10, y: 48, draw: (g, u) => {
                paint(g, C(110, 74, 40), u); rr(g, u, -1.6, -34, 3.2, 68, 1.5);
                sleeve(g, u, C(86, 64, 150)); hand(g, u, -19);
            },
        },
        extras: [{
            name: 'orb', x: 0, y: 37, onArm: true, draw: (g, u) => {
                dot(g, u, 0, 0, 9, C(140, 190, 255, 80));
                paint(g, C(170, 220, 255), u); circ(g, u, 0, 0, 5);
                dot(g, u, -1.6, 1.6, 1.6, C(255, 255, 255));
            },
        }],
        tip: { x: 0, y: 37, onArm: true },
    },
    bulwark: { // 铁壁卫：大桶盔骑士，红羽红罩袍，鸢盾长剑
        fx: C(170, 200, 240),
        body: (g, u) => {
            boots(g, u, C(120, 124, 136), 14);
            paint(g, C(150, 154, 166), u); ell(g, u, -10, 52, 8, 5);
            paint(g, STEEL, u); rr(g, u, -15, 12, 30, 42, 6);
            paint(g, C(150, 34, 34), u); poly(g, u, [-10, 12, 10, 12, 9, 52, -9, 52]);
            paint(g, GOLD, u); rr(g, u, -1.5, 22, 3, 22, 0.8, false); rr(g, u, -7, 36, 14, 3, 0.8, false);
            paint(g, C(90, 60, 36), u); rr(g, u, -15, 26, 30, 4, 1);
            paint(g, C(180, 30, 30), u); poly(g, u, [-1, 78, -8, 93, -21, 90, -14, 82]);
            paint(g, STEEL, u); rr(g, u, -11, 52, 24, 26, 6); ell(g, u, 1, 77, 12, 4);
            g.fillColor = C(20, 20, 26); rr(g, u, 3, 64, 11, 2.6, 1, false); rr(g, u, 8, 58, 2.4, 10, 1, false);
            paint(g, C(44, 72, 140), u);
            g.moveTo(8 * u, 50 * u); g.lineTo(28 * u, 50 * u); g.lineTo(28 * u, 32 * u);
            g.quadraticCurveTo(28 * u, 16 * u, 18 * u, 8 * u);
            g.quadraticCurveTo(8 * u, 16 * u, 8 * u, 32 * u); g.close(); fs(g);
            g.fillColor = C(232, 220, 190);
            rr(g, u, 16.8, 14, 2.4, 32, 0.8, false); rr(g, u, 10, 36, 16, 2.4, 0.8, false);
        },
        arm: {
            x: -9, y: 48, draw: (g, u) => {
                paint(g, C(214, 218, 228), u); poly(g, u, [-1.8, -14, 1.8, -14, 1.8, 26, 0, 31, -1.8, 26]);
                paint(g, GOLD, u); rr(g, u, -6, -15, 12, 2.6, 1);
                paint(g, C(90, 60, 36), u); rr(g, u, -1.4, -22, 2.8, 7, 1);
                sleeve(g, u, STEEL, 14); hand(g, u, -18, STEEL, 4);
            },
        },
        tip: { x: 0, y: 30, onArm: true },
    },
    gambler: { // 赌徒：三角帽火枪手，八字胡，金色短上衣，红披风
        fx: C(255, 210, 90),
        back: [{
            name: 'cape', x: 0, y: 0, draw: (g, u) => {
                paint(g, C(150, 36, 40), u); poly(g, u, [-6, 54, 6, 54, -4, 14, -21, 9]);
            },
        }],
        body: (g, u) => {
            boots(g, u, C(70, 44, 30), 16);
            paint(g, C(60, 50, 80), u); rr(g, u, -13, 14, 26, 10, 3);
            paint(g, C(204, 150, 58), u); rr(g, u, -13, 22, 26, 32, 6);
            paint(g, C(170, 36, 40), u); poly(g, u, [-13, 40, -13, 34, 13, 48, 13, 54]);
            dot(g, u, 5, 30, 1.2, C(60, 40, 30)); dot(g, u, 5, 25, 1.2, C(60, 40, 30));
            paint(g, C(244, 240, 230), u); ell(g, u, 1, 55, 12, 3.5);
            paint(g, SKIN, u); circ(g, u, 2, 66, 11.5);
            g.fillColor = C(60, 36, 24); ell(g, u, 8, 61.6, 4, 1.5, false); ell(g, u, 14, 61.6, 4, 1.5, false);
            paint(g, SKIN, u); circ(g, u, 13.5, 65, 2.2);
            eyes(g, u, 5.5, 68.5);
            paint(g, C(54, 36, 28), u); poly(g, u, [-15, 74, 18, 74, 12, 86, 1, 90, -10, 86]);
            paint(g, GOLD, u); poly(g, u, [-15, 74, 18, 74, 16, 77, -13, 77]);
            paint(g, C(236, 232, 222), u); poly(g, u, [-8, 84, -23, 98, -16, 86]);
        },
        arm: {
            x: 9, y: 46, draw: (g, u) => {
                sleeve(g, u, C(204, 150, 58), 15, 3.6);
                paint(g, C(244, 240, 230), u); rr(g, u, -4.6, -18, 9.2, 3, 1);
                hand(g, u, -21, SKIN, 3.4);
                paint(g, C(240, 200, 70), u); circ(g, u, 3, -24, 4);
                dot(g, u, 3, -24, 1.8, C(200, 150, 40));
            },
        },
        tip: { x: 3, y: -24, onArm: true },
    },
    alch: { // 炼金术士：皮围裙，铜框护目镜，药剂瓶
        fx: C(110, 230, 140),
        body: (g, u) => {
            boots(g, u, C(70, 50, 34));
            paint(g, C(102, 76, 52), u); poly(g, u, [-17, 6, 17, 6, 12, 54, -12, 54]);
            paint(g, C(168, 128, 82), u); poly(g, u, [-6, 10, 12, 10, 11, 48, -4, 48]);
            paint(g, C(140, 104, 64), u); rr(g, u, 0, 20, 8, 7, 1.5);
            paint(g, C(70, 50, 34), u); rr(g, u, -14, 32, 28, 4, 1);
            paint(g, C(200, 60, 60), u); circ(g, u, -9, 30, 2.6);
            paint(g, C(80, 120, 220), u); circ(g, u, -3, 30, 2.6);
            paint(g, C(172, 172, 166), u); ell(g, u, -5, 68, 9, 9);
            paint(g, SKIN, u); circ(g, u, 2, 64, 11.5);
            paint(g, SKIN, u); circ(g, u, 13.5, 62, 2.2);
            eyes(g, u, 5.5, 64);
            paint(g, C(190, 150, 70), u); rr(g, u, -8, 70, 22, 3, 1);
            paint(g, C(120, 200, 200), u); circ(g, u, 5, 72, 3.4); circ(g, u, 11, 72, 3.4);
            paint(g, C(172, 172, 166), u); poly(g, u, [-9, 74, -3, 79, 6, 78, 13, 75, 4, 76]);
        },
        arm: {
            x: 9, y: 44, draw: (g, u) => {
                sleeve(g, u, C(102, 76, 52), 14);
                hand(g, u, -16);
                paint(g, C(210, 236, 228), u); rr(g, u, 2.6, -16, 2.8, 6, 1);
                paint(g, C(90, 210, 120), u); circ(g, u, 4, -21, 5.5);
                dot(g, u, 2.4, -19.6, 1.3, C(230, 255, 230));
            },
        },
        tip: { x: 4, y: -21, onArm: true },
    },
    shadow: { // 影行者：兜帽斗篷刺客，发光双眼，反握匕首
        fx: C(140, 240, 255),
        back: [{
            name: 'cape', x: 0, y: 0, draw: (g, u) => {
                paint(g, C(40, 40, 52), u); poly(g, u, [-4, 58, 6, 58, -6, 8, -25, 3]);
            },
        }],
        body: (g, u) => {
            boots(g, u, C(36, 34, 40));
            paint(g, C(58, 58, 74), u); poly(g, u, [-14, 8, 14, 8, 10, 56, -10, 56]);
            paint(g, C(90, 60, 36), u); rr(g, u, -14, 30, 28, 3, 1);
            paint(g, C(120, 34, 40), u); rr(g, u, -9, 50, 20, 6, 3);
            paint(g, C(52, 52, 68), u);
            g.moveTo(-12 * u, 57 * u); g.quadraticCurveTo(-14 * u, 84 * u, 4 * u, 87 * u);
            g.quadraticCurveTo(19 * u, 82 * u, 16 * u, 61 * u); g.close(); fs(g);
            g.fillColor = C(16, 16, 22); ell(g, u, 7, 68, 7, 7.5, false);
            eyes(g, u, 5, 69, C(140, 240, 255), 1.6);
        },
        arm: {
            x: 8, y: 46, draw: (g, u) => {
                sleeve(g, u, C(58, 58, 74), 15, 3.6);
                paint(g, C(214, 218, 228), u); poly(g, u, [-1.4, -19, 1.4, -19, 1.0, -32, 0, -35, -1.0, -32]);
                paint(g, C(90, 60, 36), u); rr(g, u, -3.6, -19.4, 7.2, 1.8, 0.8);
                hand(g, u, -17, C(40, 36, 40), 3.4);
            },
        },
        tip: { x: 0, y: -33, onArm: true },
    },
    cleric: { // 圣愈者：白袍修女，金色光环，十字圣杖
        fx: C(255, 230, 130),
        back: [{
            name: 'halo', x: 3, y: 86, draw: (g, u) => {
                g.strokeColor = C(250, 214, 100); g.lineWidth = 2.2 * u;
                g.ellipse(0, 0, 11 * u, 3 * u); g.stroke();
            },
        }],
        body: (g, u) => {
            boots(g, u, C(150, 130, 100));
            paint(g, C(236, 232, 220), u); poly(g, u, [-18, 4, 18, 4, 11, 56, -11, 56]);
            paint(g, GOLD, u); poly(g, u, [-18, 4, 18, 4, 17, 8, -17, 8]);
            paint(g, GOLD, u); rr(g, u, 1, 37, 2.6, 11, 0.8, false); rr(g, u, -1.8, 42.4, 8.2, 2.6, 0.8, false);
            paint(g, C(120, 90, 60), u); rr(g, u, -13, 30, 26, 2.6, 1);
            paint(g, C(244, 242, 236), u); circ(g, u, 2, 67, 14);
            paint(g, SKIN, u); ell(g, u, 6.5, 66, 7.5, 9.5);
            eyes(g, u, 6, 68);
        },
        arm: {
            x: 9, y: 47, draw: (g, u) => {
                paint(g, C(200, 160, 80), u); rr(g, u, -1.4, -30, 2.8, 64, 1.2);
                paint(g, GOLD, u); rr(g, u, -1.6, 33, 3.2, 13, 1); rr(g, u, -5.4, 39, 10.8, 3, 1);
                sleeve(g, u, C(236, 232, 220)); hand(g, u, -18);
            },
        },
        tip: { x: 0, y: 42, onArm: true },
    },
    pyro: { // 烈焰术士：红色尖兜帽法袍，火焰纹下摆，掌心火球
        fx: C(255, 150, 60),
        body: (g, u) => {
            boots(g, u, C(70, 30, 24));
            paint(g, C(168, 48, 36), u); poly(g, u, [-17, 6, 17, 6, 12, 54, -12, 54]);
            g.fillColor = C(240, 140, 40);
            for (let i = 0; i < 4; i++) { const x = -16 + 8 * i; poly(g, u, [x, 6, x + 8, 6, x + 4, 16], false); }
            paint(g, C(30, 24, 22), u); rr(g, u, -13, 30, 26, 3.6, 1);
            paint(g, GOLD, u); rr(g, u, -2, 29.6, 5, 4.4, 1);
            paint(g, C(150, 40, 30), u);
            g.moveTo(-12 * u, 57 * u); g.quadraticCurveTo(-13 * u, 82 * u, -3 * u, 95 * u);
            g.quadraticCurveTo(10 * u, 84 * u, 16 * u, 63 * u); g.close(); fs(g);
            g.fillColor = C(40, 20, 18); ell(g, u, 7, 67, 7, 8, false);
            eyes(g, u, 5, 68, C(255, 170, 60), 1.6);
        },
        arm: {
            x: 9, y: 46, draw: (g, u) => {
                sleeve(g, u, C(168, 48, 36)); hand(g, u, -18);
            },
        },
        extras: [{
            name: 'flame', x: 2, y: -25, onArm: true, draw: (g, u) => {
                g.fillColor = C(255, 130, 40, 230);
                g.moveTo(0, -6 * u); g.quadraticCurveTo(8 * u, 2 * u, 0, 13 * u);
                g.quadraticCurveTo(-8 * u, 2 * u, 0, -6 * u); g.close(); g.fill();
                g.fillColor = C(255, 230, 120);
                g.moveTo(0, -3 * u); g.quadraticCurveTo(4 * u, 1 * u, 0, 7 * u);
                g.quadraticCurveTo(-4 * u, 1 * u, 0, -3 * u); g.close(); g.fill();
            },
        }],
        tip: { x: 2, y: -22, onArm: true },
    },
    tinker: { // 机关师：矮人工匠，大胡子，皮帽护目镜，战锤
        fx: C(230, 190, 100),
        body: (g, u) => {
            paint(g, C(80, 56, 36), u); rr(g, u, -16, 0, 13, 9, 2.5); rr(g, u, 3, 0, 13, 9, 2.5);
            paint(g, C(90, 70, 50), u); rr(g, u, -14, 8, 28, 8, 2);
            paint(g, C(126, 92, 58), u); rr(g, u, -19, 14, 38, 30, 8);
            paint(g, C(60, 44, 30), u); rr(g, u, -19, 22, 38, 5, 1.5);
            paint(g, C(200, 160, 70), u); rr(g, u, -3, 21.4, 7, 6, 1);
            paint(g, SKIN, u); circ(g, u, 3, 56, 11);
            paint(g, C(184, 98, 44), u); poly(g, u, [-6, 53, 16, 53, 15, 40, 6, 25, -3, 37]);
            paint(g, SKIN, u); circ(g, u, 14.5, 56, 3.4);
            eyes(g, u, 6.5, 59.5);
            paint(g, C(110, 76, 48), u);
            g.moveTo(-9 * u, 60 * u); g.quadraticCurveTo(3 * u, 77 * u, 15 * u, 60 * u); g.close(); fs(g);
            paint(g, C(190, 150, 70), u); rr(g, u, -6, 61, 20, 3, 1);
            paint(g, C(120, 190, 220), u); circ(g, u, 6, 63.4, 3); circ(g, u, 12, 63.4, 3);
        },
        arm: {
            x: 13, y: 38, draw: (g, u) => {
                paint(g, C(110, 74, 40), u); rr(g, u, -1.4, -14, 2.8, 32, 1);
                paint(g, STEEL, u); rr(g, u, -8, 15, 16, 9, 2);
                sleeve(g, u, C(126, 92, 58), 10, 4.4); hand(g, u, -12, SKIN, 4);
            },
        },
        tip: { x: 0, y: 19, onArm: true },
    },

    // ===== 敌人（同样面朝 +x 绘制，构建时镜像） =====
    imp: { // 哥布林斥候
        fx: C(160, 220, 90),
        body: (g, u) => {
            const sk = C(112, 160, 72);
            paint(g, sk, u); rr(g, u, -8, 0, 5, 11, 2); rr(g, u, 3, 0, 5, 11, 2);
            paint(g, sk, u); ell(g, u, 0, 26, 13, 14);
            paint(g, C(110, 76, 46), u); poly(g, u, [-12, 18, 12, 18, 8, 8, 2, 12, -4, 7, -10, 12]);
            paint(g, sk, u); poly(g, u, [-9, 56, -27, 64, -11, 46]);
            circ(g, u, 2, 50, 15);
            poly(g, u, [11, 56, 29, 64, 13, 46]);
            poly(g, u, [14, 51, 23, 46, 14, 46]);
            paint(g, C(250, 220, 60), u); circ(g, u, 5, 53, 3); circ(g, u, 11, 53, 3);
            dot(g, u, 6, 53, 1.3, C(20, 20, 20)); dot(g, u, 12, 53, 1.3, C(20, 20, 20));
            g.fillColor = C(250, 248, 236); poly(g, u, [4, 42, 6, 39, 8, 42], false); poly(g, u, [9, 42, 11, 39, 13, 42], false);
        },
        arm: {
            x: 8, y: 30, draw: (g, u) => {
                paint(g, C(170, 130, 100), u); poly(g, u, [-1.6, -12, 1.6, -12, 1.2, 4, 0, 8, -1.2, 4]);
                sleeve(g, u, C(112, 160, 72), 10, 2.6); hand(g, u, -12, C(112, 160, 72), 3);
            },
        },
        tip: { x: 0, y: 6, onArm: true },
    },
    golem: { // 锈甲傀儡
        fx: C(120, 200, 255),
        body: (g, u) => {
            const rust = C(150, 98, 62);
            boots(g, u, C(100, 62, 40), 9);
            paint(g, C(140, 90, 58), u); rr(g, u, -12, 8, 9, 14, 2); rr(g, u, 3, 8, 9, 14, 2);
            paint(g, C(40, 30, 26), u); rr(g, u, -14, 18, 28, 5, 1);
            paint(g, rust, u); rr(g, u, -18, 21, 36, 35, 8);
            for (const p of [[-12, 50], [12, 50], [-12, 27], [12, 27]]) { dot(g, u, p[0], p[1], 1.4, C(70, 44, 30)); }
            dot(g, u, -6, 40, 3, C(100, 120, 70, 200)); dot(g, u, 8, 32, 2.2, C(100, 120, 70, 200));
            paint(g, C(130, 84, 54), u); ell(g, u, -16, 54, 10, 6); ell(g, u, 16, 54, 10, 6);
            paint(g, rust, u); rr(g, u, -10, 56, 22, 22, 6);
            g.fillColor = C(16, 14, 18); rr(g, u, 0, 64, 12, 3.6, 1, false);
            dot(g, u, 4, 65.8, 1.6, C(120, 200, 255)); dot(g, u, 9, 65.8, 1.6, C(120, 200, 255));
        },
        arm: {
            x: 14, y: 48, draw: (g, u) => {
                paint(g, C(176, 150, 130), u); poly(g, u, [-2.4, -16, 2.4, -16, 2.4, 22, 0, 27, -2.4, 22]);
                paint(g, C(90, 60, 36), u); rr(g, u, -7, -17, 14, 3, 1);
                sleeve(g, u, C(150, 98, 62), 14, 5); hand(g, u, -18, C(120, 80, 54), 5);
            },
        },
        tip: { x: 0, y: 26, onArm: true },
    },
    viper: { // 沼泽蜥人
        fx: C(120, 230, 180),
        back: [{
            name: 'tail', x: 0, y: 0, draw: (g, u) => {
                paint(g, C(64, 132, 112), u); poly(g, u, [-8, 14, -34, 4, -42, 10, -10, 24]);
            },
        }],
        body: (g, u) => {
            const sc = C(64, 132, 112);
            paint(g, sc, u); rr(g, u, -10, 0, 7, 14, 3); rr(g, u, 3, 0, 7, 14, 3);
            paint(g, sc, u); ell(g, u, 0, 30, 13, 18);
            paint(g, C(220, 200, 130), u); ell(g, u, 4, 28, 7, 13);
            paint(g, C(220, 100, 50), u); poly(g, u, [-6, 52, -3, 65, 3, 57, 8, 63, 11, 55]);
            paint(g, sc, u); poly(g, u, [-4, 52, 10, 58, 25, 52, 25, 46, 8, 44, -4, 46]);
            paint(g, C(250, 220, 60), u); circ(g, u, 10, 52, 2.6);
            g.fillColor = C(20, 20, 20); rr(g, u, 9.6, 50, 0.9, 4, 0.4, false);
            g.fillColor = C(250, 248, 236);
            for (let i = 0; i < 3; i++) { poly(g, u, [14 + i * 3.6, 46, 15.8 + i * 3.6, 43, 17.6 + i * 3.6, 46], false); }
        },
        arm: {
            x: 8, y: 40, draw: (g, u) => {
                paint(g, C(110, 74, 40), u); rr(g, u, -1.2, -28, 2.4, 68, 1);
                paint(g, STEEL, u); poly(g, u, [-3.4, 39, 3.4, 39, 0, 51]);
                sleeve(g, u, C(64, 132, 112), 12, 3.4); hand(g, u, -14, C(64, 132, 112), 3.2);
            },
        },
        tip: { x: 0, y: 49, onArm: true },
    },
    lich: { // 厄运巫妖
        fx: C(130, 255, 150),
        body: (g, u) => {
            paint(g, C(76, 44, 96), u);
            poly(g, u, [-18, 0, -12, 6, -6, 0, 0, 6, 6, 0, 12, 6, 18, 0, 12, 56, -12, 56]);
            paint(g, BONE, u); rr(g, u, -12, 30, 24, 3, 1);
            paint(g, C(56, 30, 72), u); circ(g, u, 0, 66, 15);
            paint(g, BONE, u); circ(g, u, 3, 66, 11); rr(g, u, -1, 54.6, 10, 5, 2);
            g.fillColor = C(20, 14, 24); circ(g, u, 6, 67, 3, false); circ(g, u, 11.5, 67, 3, false);
            dot(g, u, 6, 67, 1.4, C(130, 255, 150)); dot(g, u, 11.5, 67, 1.4, C(130, 255, 150));
            paint(g, C(196, 160, 70), u);
            poly(g, u, [-7, 74, 13, 74, 13, 82, 9, 78, 6, 84, 3, 78, -1, 84, -4, 78, -7, 82]);
        },
        arm: {
            x: 10, y: 46, draw: (g, u) => {
                paint(g, C(60, 40, 50), u); rr(g, u, -1.5, -30, 3, 70, 1.2);
                paint(g, BONE, u); circ(g, u, 0, 42, 5);
                paint(g, C(76, 44, 96), u); poly(g, u, [-5, 2, 5, 2, 7, -14, -7, -14]);
                hand(g, u, -17, BONE, 3);
            },
        },
        extras: [{
            name: 'orb', x: 0, y: 42, onArm: true, draw: (g, u) => {
                dot(g, u, 0, 0, 9, C(120, 255, 140, 70));
                dot(g, u, 0, 0, 2.2, C(140, 255, 160));
            },
        }],
        tip: { x: 0, y: 42, onArm: true },
    },
    troll: { // 山岭巨魔
        fx: C(200, 170, 110),
        body: (g, u) => {
            const sk = C(118, 140, 106);
            paint(g, sk, u); rr(g, u, -18, 0, 14, 16, 4); rr(g, u, 4, 0, 14, 16, 4);
            paint(g, C(120, 90, 60), u); poly(g, u, [-20, 14, 20, 14, 16, 4, 6, 10, -2, 4, -12, 10]);
            paint(g, sk, u); ell(g, u, 0, 34, 24, 22);
            paint(g, C(150, 168, 130), u); ell(g, u, 4, 30, 14, 13);
            paint(g, sk, u); circ(g, u, 14, 56, 12);
            paint(g, C(90, 110, 80), u); rr(g, u, 8, 59, 14, 3, 1.5);
            eyes(g, u, 15.5, 57, C(240, 200, 60), 1.8);
            paint(g, C(244, 240, 226), u); poly(g, u, [18, 49, 20, 43, 22, 49]); poly(g, u, [12, 49, 14, 44, 16, 49]);
        },
        arm: {
            x: 16, y: 44, draw: (g, u) => {
                paint(g, C(130, 90, 50), u); poly(g, u, [-2.6, -24, 2.6, -24, 7.5, 26, 0, 33, -7.5, 26]);
                dot(g, u, -2, 18, 1.6, C(80, 56, 30)); dot(g, u, 3, 10, 1.4, C(80, 56, 30));
                paint(g, C(118, 140, 106), u); poly(g, u, [-5, 2, 5, 2, 6, -20, -6, -20]);
                circ(g, u, 0, -22, 6);
            },
        },
        tip: { x: 0, y: 28, onArm: true },
    },
    boss: { // 骰命魔龙
        fx: C(255, 120, 40),
        back: [
            {
                name: 'aura', x: 2, y: 46, draw: (g, u) => {
                    dot(g, u, 0, 0, 50, C(255, 60, 30, 70));
                    dot(g, u, 0, 0, 36, C(255, 90, 40, 70));
                },
            },
            {
                name: 'wingB', x: -8, y: 60, draw: (g, u) => {
                    paint(g, C(110, 24, 30), u);
                    poly(g, u, [0, 0, -30, 30, -46, 18, -42, 0, -32, 6, -28, -10, -18, -2, -12, -12, 0, -6]);
                },
            },
            {
                name: 'wingF', x: 2, y: 62, draw: (g, u) => {
                    paint(g, C(150, 34, 36), u);
                    poly(g, u, [0, 0, -24, 34, -40, 24, -36, 6, -26, 10, -22, -6, -12, 2, -6, -8, 0, -4]);
                    g.strokeColor = C(80, 16, 20); g.lineWidth = 1.4 * u;
                    g.moveTo(0, 0); g.lineTo(-36 * u, 6 * u); g.stroke();
                    g.moveTo(0, 0); g.lineTo(-22 * u, -6 * u); g.stroke();
                },
            },
        ],
        body: (g, u) => {
            const red = C(170, 40, 36);
            paint(g, red, u); poly(g, u, [-10, 20, -34, 10, -50, 18, -42, 23, -30, 19, -8, 31]);
            paint(g, C(80, 16, 20), u); poly(g, u, [-50, 18, -58, 14, -52, 24]);
            paint(g, red, u); rr(g, u, -16, 0, 12, 16, 4); rr(g, u, 6, 0, 12, 16, 4);
            g.fillColor = C(240, 232, 210);
            poly(g, u, [-16, 0, -14, -3, -12, 0], false); poly(g, u, [14, 0, 16, -3, 18, 0], false);
            paint(g, red, u); ell(g, u, 0, 32, 22, 22);
            paint(g, C(226, 170, 96), u); ell(g, u, 6, 30, 12, 17);
            g.strokeColor = C(170, 110, 60); g.lineWidth = 1.2 * u;
            for (let i = 0; i < 4; i++) { g.moveTo(-4 * u, (20 + i * 6) * u); g.lineTo(16 * u, (20 + i * 6) * u); g.stroke(); }
            g.fillColor = C(110, 24, 30);
            poly(g, u, [-14, 46, -10, 56, -6, 48], false); poly(g, u, [-20, 38, -18, 48, -12, 42], false);
            paint(g, red, u); poly(g, u, [6, 46, 18, 46, 26, 66, 16, 70]);
            paint(g, red, u); poly(g, u, [12, 66, 30, 73, 43, 71, 45, 64, 30, 60, 16, 60]);
            paint(g, C(230, 220, 190), u); poly(g, u, [14, 70, 5, 84, 18, 72]); poly(g, u, [20, 72, 16, 86, 24, 73]);
            dot(g, u, 42, 68, 1.2, C(40, 10, 10));
            paint(g, C(255, 220, 60), u); circ(g, u, 27, 68.4, 2.8);
            g.fillColor = C(20, 10, 10); rr(g, u, 26.6, 66, 0.9, 4.8, 0.4, false);
            g.fillColor = C(250, 248, 236);
            for (let i = 0; i < 3; i++) { poly(g, u, [32 + i * 4, 60.6, 34 + i * 4, 58, 36 + i * 4, 60.6], false); }
            paint(g, GOLD, u); rr(g, u, -3, 34, 9, 9, 2);
            for (const p of [[-1, 41], [4, 36], [1.5, 38.5]]) { dot(g, u, p[0], p[1], 0.9, C(60, 30, 10)); }
        },
        tip: { x: 45, y: 66, onArm: false },
    },
};

// ---------------- 构建 ----------------

export interface Rig {
    id: string;
    root: Node;
    flip: Node;
    body: Node;
    arm: Node | null;
    parts: { [name: string]: Node };
    u: number;
    size: number;
    enemy: boolean;
    spec: Spec;
}

function makePart(parent: Node, p: { x: number; y: number; draw: Draw }, u: number, name: string): Node {
    const n = mkNode(parent, name, 4, 4, p.x * u, p.y * u);
    p.draw(n.addComponent(Graphics), u);
    return n;
}

/** 构建角色。root 中心位于 (x, y)，size 为大致身高。 */
export function buildRig(parent: Node, id: string, size: number, x: number, y: number, enemy = false): Rig {
    const spec = SPECS[id] || SPECS.astro;
    const u = size / 100;
    const root = mkNode(parent, 'rig_' + id, size * 0.7, size, x, y);
    const flip = mkNode(root, 'flip', 0, 0, 0, -size / 2);
    if (enemy) { flip.setScale(-1, 1, 1); }
    const parts: { [name: string]: Node } = {};
    for (const b of spec.back || []) { parts[b.name] = makePart(flip, b, u, b.name); }
    const body = mkNode(flip, 'body', size * 0.7, size, 0, 0);
    spec.body(body.addComponent(Graphics), u);
    const arm = spec.arm ? makePart(body, spec.arm, u, 'arm') : null;
    for (const e of spec.extras || []) {
        parts[e.name] = makePart(e.onArm && arm ? arm : body, e, u, e.name);
    }
    if (parts.aura) { parts.aura.active = false; }
    return { id, root, flip, body, arm, parts, u, size, enemy, spec };
}

/** 仅绘制静态立绘（无动画），用于名册/卡片头像。 */
export function buildPortrait(parent: Node, id: string, size: number, x: number, y: number, enemy = false): Rig {
    return buildRig(parent, id, size, x, y, enemy);
}

// ---------------- 坐标 ----------------

export function posIn(layer: Node, node: Node, lx = 0, ly = 0): Vec3 {
    const w = node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(lx, ly, 0));
    return layer.getComponent(UITransform).convertToNodeSpaceAR(w);
}

function tipPos(rig: Rig, layer: Node): Vec3 {
    const t = rig.spec.tip;
    const n = t.onArm && rig.arm ? rig.arm : rig.body;
    return posIn(layer, n, t.x * rig.u, t.y * rig.u);
}

export function centerOf(rig: Rig, layer: Node): Vec3 {
    return posIn(layer, rig.root);
}

// ---------------- 待机 ----------------

function armSway(arm: Node | null, amp = 4, delay = 0) {
    if (!arm) { return; }
    Tween.stopAllByTarget(arm);
    arm.angle = 0;
    tween(arm).delay(delay).repeatForever(
        tween(arm).to(0.9, { angle: amp }, { easing: 'sineInOut' })
            .to(0.9, { angle: -amp }, { easing: 'sineInOut' })).start();
}

function pulse(n: Node, s: number, d: number) {
    tween(n).repeatForever(
        tween(n).to(d, { scale: new Vec3(s, s, 1) }, { easing: 'sineInOut' })
            .to(d, { scale: Vec3.ONE }, { easing: 'sineInOut' })).start();
}

function flap(n: Node, amp: number, d: number, delay = 0) {
    Tween.stopAllByTarget(n);
    n.angle = 0;
    tween(n).delay(delay).repeatForever(
        tween(n).to(d, { angle: -amp }, { easing: 'sineInOut' })
            .to(d, { angle: amp * 0.4 }, { easing: 'sineInOut' })).start();
}

export function rigIdle(rig: Rig, delay = 0) {
    jelly(rig.body, rig.enemy ? 0.06 : 0.07, 0.7, delay);
    armSway(rig.arm, 4, delay);
    const p = rig.parts;
    if (p.orb) { pulse(p.orb, 1.25, 0.6); }
    if (p.halo) { pulse(p.halo, 1.15, 0.9); }
    if (p.flame) {
        tween(p.flame).repeatForever(
            tween(p.flame).to(0.14, { scale: new Vec3(0.85, 1.2, 1) })
                .to(0.16, { scale: new Vec3(1.1, 0.9, 1) })).start();
    }
    if (p.wingB) { flap(p.wingB, 16, 0.55); }
    if (p.wingF) { flap(p.wingF, 20, 0.55, 0.08); }
    if (p.cape) {
        tween(p.cape).repeatForever(
            tween(p.cape).to(0.8, { angle: -5 }, { easing: 'sineInOut' })
                .to(0.8, { angle: 2 }, { easing: 'sineInOut' })).start();
    }
    if (p.tail) {
        tween(p.tail).repeatForever(
            tween(p.tail).to(0.7, { angle: 8 }, { easing: 'sineInOut' })
                .to(0.7, { angle: -4 }, { easing: 'sineInOut' })).start();
    }
    if (rig.id === 'lich') {
        const fp = rig.flip.position.clone();
        tween(rig.flip).repeatForever(
            tween(rig.flip).to(1.0, { position: new Vec3(fp.x, fp.y + 7, 0) }, { easing: 'sineInOut' })
                .to(1.0, { position: fp }, { easing: 'sineInOut' })).start();
    }
}

// ---------------- 特效 ----------------

export function burst(layer: Node, pos: Vec3, color: Color, n = 7, radius = 46) {
    const ring = mkNode(layer, 'ring', 4, 4, pos.x, pos.y);
    const rg = ring.addComponent(Graphics);
    rg.strokeColor = color; rg.lineWidth = 4;
    rg.circle(0, 0, 12); rg.stroke();
    const rop = ring.addComponent(UIOpacity);
    tween(ring).to(0.3, { scale: new Vec3(3, 3, 1) }, { easing: 'quadOut' }).start();
    tween(rop).to(0.3, { opacity: 0 }).call(() => ring.destroy()).start();
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
        const d = radius * (0.6 + Math.random() * 0.6);
        const sp = mkNode(layer, 'spark', 4, 4, pos.x, pos.y);
        const g = sp.addComponent(Graphics);
        g.fillColor = color; g.circle(0, 0, 2.5 + Math.random() * 2.5); g.fill();
        const op = sp.addComponent(UIOpacity);
        tween(sp).by(0.36, { position: new Vec3(Math.cos(a) * d, Math.sin(a) * d, 0) }, { easing: 'quadOut' }).start();
        tween(op).delay(0.15).to(0.22, { opacity: 0 }).call(() => sp.destroy()).start();
    }
}

type ProjKind = 'star' | 'fire' | 'coin' | 'flask' | 'holy' | 'gear' | 'knife' | 'skull' | 'wave' | 'bigfire';

function drawProj(g: Graphics, kind: ProjKind) {
    const u = 1;
    switch (kind) {
        case 'star':
            dot(g, u, 0, 0, 11, C(150, 170, 255, 90)); star(g, u, 0, 0, 9, C(220, 230, 255)); break;
        case 'fire':
            dot(g, u, 0, 0, 12, C(255, 110, 30, 120)); dot(g, u, 0, 0, 8, C(255, 150, 50)); dot(g, u, 0, 0, 4, C(255, 240, 150)); break;
        case 'bigfire':
            dot(g, u, 0, 0, 20, C(255, 80, 20, 110)); dot(g, u, 0, 0, 13, C(255, 140, 40)); dot(g, u, 0, 0, 6, C(255, 240, 150)); break;
        case 'coin':
            paint(g, C(240, 200, 70), u); g.lineWidth = 1.6; ell(g, u, 0, 0, 7, 7); dot(g, u, 0, 0, 3, C(200, 150, 40)); break;
        case 'flask':
            paint(g, C(210, 236, 228), u); g.lineWidth = 1.4; rr(g, u, -1.6, 4, 3.2, 6, 1);
            paint(g, C(90, 210, 120), u); g.lineWidth = 1.4; circ(g, u, 0, 0, 6); break;
        case 'holy':
            dot(g, u, 0, 0, 13, C(255, 240, 160, 110)); dot(g, u, 0, 0, 7, C(255, 250, 220)); break;
        case 'gear': {
            g.fillColor = C(190, 160, 90);
            for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 4;
                g.circle(Math.cos(a) * 8, Math.sin(a) * 8, 2.6); g.fill();
            }
            paint(g, C(200, 170, 100), u); g.lineWidth = 1.4; circ(g, u, 0, 0, 7.5); dot(g, u, 0, 0, 2.6, C(80, 60, 40)); break;
        }
        case 'knife':
            paint(g, C(220, 224, 234), u); g.lineWidth = 1.2; poly(g, u, [-8, -1.6, 6, -1.6, 10, 0, 6, 1.6, -8, 1.6]); break;
        case 'skull':
            dot(g, u, 0, 0, 12, C(120, 255, 140, 90)); paint(g, BONE, u); g.lineWidth = 1.4; circ(g, u, 0, 1, 6.5);
            dot(g, u, -2.4, 1.6, 1.6, C(30, 60, 30)); dot(g, u, 2.4, 1.6, 1.6, C(30, 60, 30)); break;
        case 'wave':
            g.strokeColor = C(220, 235, 255); g.lineWidth = 4;
            g.arc(0, 0, 14, -Math.PI / 2.4, Math.PI / 2.4, false); g.stroke();
            g.strokeColor = C(150, 190, 255, 150); g.lineWidth = 8;
            g.arc(-3, 0, 14, -Math.PI / 2.6, Math.PI / 2.6, false); g.stroke(); break;
    }
}

/** 发射投射物：from → to，arc 为抛物线高度。到达时爆点。 */
function shoot(layer: Node, from: Vec3, to: Vec3, kind: ProjKind, dur: number, color: Color,
    opt: { arc?: number; spin?: number; delay?: number } = {}) {
    const n = mkNode(layer, 'proj', 4, 4, from.x, from.y);
    drawProj(n.addComponent(Graphics), kind);
    n.active = false;
    const dx = to.x - from.x, dy = to.y - from.y;
    if (kind === 'knife' || kind === 'wave') { n.angle = Math.atan2(dy, dx) * 180 / Math.PI; }
    const arc = opt.arc || 0, spin = opt.spin || 0;
    const st = { t: 0, ghost: 0 };
    tween(st).delay(opt.delay || 0).call(() => { n.active = true; })
        .to(dur, { t: 1 }, {
            onUpdate: (_o?: unknown, r?: number) => {
                const k = r === undefined ? st.t : r;
                n.setPosition(from.x + dx * k, from.y + dy * k + arc * 4 * k * (1 - k), 0);
                if (spin) { n.angle = spin * k; }
                if (st.ghost < 2 && k >= 0.35 + st.ghost * 0.3) {
                    st.ghost++;
                    const gp = mkNode(layer, 'ghost', 4, 4, n.position.x, n.position.y);
                    const gg = gp.addComponent(Graphics);
                    gg.fillColor = color;
                    gg.circle(0, 0, 4.5 - st.ghost * 1.3);
                    gg.fill();
                    const gop = gp.addComponent(UIOpacity);
                    gop.opacity = 130;
                    tween(gop).to(0.24, { opacity: 0 }).call(() => gp.destroy()).start();
                }
            },
        })
        .call(() => { burst(layer, to, color); n.destroy(); })
        .start();
}

function armSwing(rig: Rig, windup: number, strike: number, tw: number, ts: number, delay = 0): number {
    const a = rig.arm;
    if (!a) { return delay + tw + ts; }
    Tween.stopAllByTarget(a);
    tween(a).delay(delay)
        .to(tw, { angle: windup }, { easing: 'quadOut' })
        .to(ts, { angle: strike }, { easing: 'quadIn' })
        .delay(0.08)
        .to(0.22, { angle: 0 }, { easing: 'sineOut' })
        .call(() => armSway(a))
        .start();
    return delay + tw + ts;
}

function hopRoot(root: Node, d: Vec3, dur: number, height: number, delay = 0) {
    const p = root.position.clone();
    const st = { t: 0 };
    tween(st).delay(delay).to(dur, { t: 1 }, {
        onUpdate: (_o?: unknown, r?: number) => {
            const k = r === undefined ? st.t : r;
            root.setPosition(p.x + d.x * k, p.y + d.y * k + height * 4 * k * (1 - k), 0);
        },
    }).start();
}

function dashRoot(root: Node, d: Vec3, go: number, back: number, delay = 0, hold = 0.06) {
    const p = root.position.clone();
    tween(root).delay(delay)
        .to(go, { position: p.clone().add(d) }, { easing: 'quadIn' })
        .delay(hold)
        .to(back, { position: p }, { easing: 'sineOut' })
        .start();
}

// ---------------- 攻击动作（返回命中时刻，秒） ----------------

/** 英雄攻击：各职业专属动作 + 投射物。target 为 layer 坐标。 */
export function heroAttack(rig: Rig, layer: Node, target: Vec3, delay = 0): number {
    const fx = rig.spec.fx;
    const fire = (kind: ProjKind, at: number, dur: number, o: { arc?: number; spin?: number } = {}) => {
        tween(rig.root).delay(at).call(() => {
            shoot(layer, tipPos(rig, layer), target, kind, dur, fx, o);
        }).start();
        return at + dur;
    };
    switch (rig.id) {
        case 'astro': armSwing(rig, 28, -42, 0.14, 0.1, delay); return fire('star', delay + 0.24, 0.3, { spin: 540 });
        case 'pyro': armSwing(rig, 20, -60, 0.12, 0.08, delay); return fire('fire', delay + 0.2, 0.28);
        case 'gambler': armSwing(rig, 30, -70, 0.12, 0.07, delay); return fire('coin', delay + 0.19, 0.32, { spin: 1080, arc: 30 });
        case 'alch': armSwing(rig, 75, -50, 0.16, 0.1, delay); return fire('flask', delay + 0.26, 0.42, { spin: 720, arc: 90 });
        case 'tinker': armSwing(rig, 70, -80, 0.18, 0.08, delay); return fire('gear', delay + 0.26, 0.32, { spin: -900 });
        case 'bulwark':
            armSwing(rig, 50, -90, 0.14, 0.09, delay);
            dashRoot(rig.root, new Vec3(14, 8, 0), 0.12, 0.24, delay + 0.1);
            return fire('wave', delay + 0.23, 0.24);
        case 'shadow': {
            const op = rig.flip.getComponent(UIOpacity) || rig.flip.addComponent(UIOpacity);
            tween(op).delay(delay).to(0.08, { opacity: 40 }).delay(0.26).to(0.12, { opacity: 255 }).start();
            armSwing(rig, 20, -80, 0.08, 0.06, delay);
            fire('knife', delay + 0.1, 0.2);
            fire('knife', delay + 0.16, 0.2);
            return fire('knife', delay + 0.22, 0.2);
        }
        case 'cleric': {
            armSwing(rig, 35, -10, 0.16, 0.12, delay);
            tween(rig.root).delay(delay + 0.22).call(() => {
                const beam = mkNode(layer, 'beam', 4, 4, target.x, target.y + 120);
                const g = beam.addComponent(Graphics);
                g.fillColor = C(255, 240, 160, 150); g.roundRect(-14, -150, 28, 300, 12); g.fill();
                g.fillColor = C(255, 255, 230, 220); g.roundRect(-5, -150, 10, 300, 5); g.fill();
                const op = beam.addComponent(UIOpacity);
                beam.setScale(0.2, 1, 1);
                tween(beam).to(0.1, { scale: Vec3.ONE }).start();
                tween(op).delay(0.18).to(0.25, { opacity: 0 }).call(() => beam.destroy()).start();
                burst(layer, target, fx, 9);
            }).start();
            return delay + 0.32;
        }
    }
    return fire('star', delay + 0.2, 0.3);
}

/** 敌人攻击：各敌人专属动作。target 为 layer 坐标（enemy root 必须是 layer 的直接子节点）。 */
export function enemyAttack(rig: Rig, layer: Node, target: Vec3): number {
    const home = rig.root.position.clone();
    const d = new Vec3(target.x - home.x, target.y - home.y, 0);
    const fx = rig.spec.fx;
    switch (rig.id) {
        case 'imp': {
            armSwing(rig, 40, -80, 0.1, 0.08, 0.14);
            hopRoot(rig.root, d.clone().multiplyScalar(0.72), 0.26, 70);
            tween(rig.root).delay(0.34).call(() => hopRoot(rig.root, d.clone().multiplyScalar(-0.72), 0.3, 40)).start();
            return 0.26;
        }
        case 'golem':
            armSwing(rig, 60, -90, 0.26, 0.1, 0.05);
            dashRoot(rig.root, d.clone().multiplyScalar(0.55), 0.18, 0.36, 0.2, 0.1);
            return 0.4;
        case 'viper':
            armSwing(rig, 10, -85, 0.1, 0.07);
            dashRoot(rig.root, d.clone().multiplyScalar(0.5), 0.13, 0.3, 0.06, 0.08);
            return 0.2;
        case 'troll':
            armSwing(rig, 110, -40, 0.3, 0.09);
            dashRoot(rig.root, d.clone().multiplyScalar(0.45), 0.14, 0.38, 0.25, 0.12);
            return 0.39;
        case 'lich':
            armSwing(rig, 35, -25, 0.22, 0.1);
            tween(rig.root).delay(0.28).call(() => shoot(layer, tipPos(rig, layer), target, 'skull', 0.36, fx, { spin: 360 })).start();
            return 0.64;
        case 'boss': {
            const s = rig.root.scale.clone();
            tween(rig.root).to(0.22, { scale: new Vec3(s.x * 1.12, s.y * 1.12, 1) }, { easing: 'quadOut' })
                .delay(0.3).to(0.25, { scale: s }).start();
            for (const w of ['wingB', 'wingF']) {
                const n = rig.parts[w];
                if (n) {
                    Tween.stopAllByTarget(n);
                    tween(n).repeat(3, tween(n).to(0.1, { angle: -30 }).to(0.1, { angle: 10 }))
                        .call(() => flap(n, w === 'wingB' ? 16 : 20, 0.55)).start();
                }
            }
            for (let i = 0; i < 3; i++) {
                tween(rig.root).delay(0.26 + i * 0.1).call(() => {
                    const off = new Vec3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0);
                    shoot(layer, tipPos(rig, layer), target.clone().add(off), 'bigfire', 0.3, fx);
                }).start();
            }
            return 0.56;
        }
    }
    dashRoot(rig.root, d.clone().multiplyScalar(0.5), 0.15, 0.3);
    return 0.15;
}

// ---------------- 状态反馈 ----------------

/** 施放技能：举起武器 + 光圈。 */
export function castFx(rig: Rig, layer: Node) {
    armSwing(rig, 55, 40, 0.12, 0.12);
    const c = centerOf(rig, layer);
    burst(layer, new Vec3(c.x, c.y + rig.size * 0.1, 0), rig.spec.fx, 10, 36);
    const s = rig.root.scale.clone();
    tween(rig.root).to(0.1, { scale: new Vec3(s.x * 1.12, s.y * 1.12, 1) })
        .to(0.18, { scale: s }, { easing: 'backOut' }).start();
}

/** 受击：压扁回弹 + 闪烁。 */
export function hurt(rig: Rig, power = 1) {
    squashHit(rig.root, power);
    const op = rig.body.getComponent(UIOpacity) || rig.body.addComponent(UIOpacity);
    tween(op).to(0.05, { opacity: 110 }).to(0.07, { opacity: 255 })
        .to(0.05, { opacity: 110 }).to(0.07, { opacity: 255 }).start();
}

/** 阵亡：英雄倒地，敌人压扁消散。 */
export function die(rig: Rig) {
    if (rig.arm) { Tween.stopAllByTarget(rig.arm); }
    for (const k in rig.parts) { Tween.stopAllByTarget(rig.parts[k]); }
    Tween.stopAllByTarget(rig.flip);
    if (rig.enemy) {
        squashDeath(rig.body);
        const op = rig.flip.getComponent(UIOpacity) || rig.flip.addComponent(UIOpacity);
        tween(op).delay(0.25).to(0.35, { opacity: 0 }).start();
    } else {
        fall(rig.body);
    }
}

/** 首领狂暴：红色光环亮起并持续脉动。 */
export function enrage(rig: Rig) {
    const a = rig.parts.aura;
    if (a) {
        a.active = true;
        a.setScale(0.2, 0.2, 1);
        tween(a).to(0.3, { scale: new Vec3(1.2, 1.2, 1) }, { easing: 'backOut' })
            .call(() => pulse(a, 1.12, 0.4)).start();
    }
    const s = rig.root.scale.clone();
    tween(rig.root).repeat(2, tween(rig.root).to(0.1, { scale: new Vec3(s.x * 1.18, s.y * 1.18, 1) })
        .to(0.12, { scale: s })).start();
}
