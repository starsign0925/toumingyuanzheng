// 烽火长歌 —— 入口组件（竖屏）：营地四选三 / 区域冒险地图 / 战斗 / 探索检定 / 战利品 / 结算
import { _decorator, Component, Node, Graphics, sys, Color, tween, Vec3, UIOpacity, UITransform, HorizontalTextAlignment } from 'cc';
import {
    HEROES, STAGES, EVENTS, RULES, PROF, ATTR_NAME, NODE_NAME, COLUMN_X,
    heroById, makeHero, partyNote, encounter, rewardOptions, rewardText, applyReward, weaponName, weaponById,
} from './Data';
import type { HeroInst, EnemyDef, EventDef, EventOpt, EvOutcome, NodeKind, MapNode, RunState, SaveData, Reward } from './Data';
import { mod, check, checkText, dcName, signed, successChance } from './RuleResolver';
import type { CheckResult } from './RuleResolver';
import { COL, mkNode, mkLabel, mkPanel, mkButton, setBtnEnabled, drawD20, bob, drawNodeIcon, popIn, mkBar } from './UI';
import { BattleScreen } from './BattleScreen';
import { buildRig, rigIdle } from './Figures';

const { ccclass } = _decorator;

const SAVE_KEY = 'fhcg_save_v1';
const CIRCLED = ['①', '②', '③'];

// 2.5D 地图（饥荒式）：透视相机固定俯角、跟随领队；节点/角色为正对屏幕的纸片立牌
const ROW_GAP = 300;          // 相邻两行据点的纵深距离（世界单位）
const LANE_K = 0.8;           // 横向槽位缩放
const CAM_PITCH = 50 * Math.PI / 180;
const CAM_SIN = Math.sin(CAM_PITCH), CAM_COS = Math.cos(CAM_PITCH);
const CAM_R = 700;            // 相机到注视点距离：越小透视越强
const CAM_F = CAM_R * 1.5;    // 焦距：注视点处 1 世界单位 = 1.5px（视野远近）
const FOCUS_Y = -170;         // 注视点（领队）在屏幕上的 y
const CAM_LAG = 5;            // 相机跟随速度
const NEAR_DEPTH = 220;       // 近裁剪
const FADE_Z0 = ROW_GAP * 1.7, FADE_Z1 = ROW_GAP * 3.2; // 远处立牌淡出区间（相对相机）
const GROUND_X = 720, GROUND_Z0 = -ROW_GAP * 1.6, GROUND_Z1 = ROW_GAP * 6.8;
const SLAB = 26;              // 地台前沿厚度
const SHADOW_DX = 0.35, SHADOW_DZ = 0.5; // 斜投影方向（每单位高度）
const NODE_K = 1, MARKER_K = 1, ORN_K = 1.6;
const START = { x: 0, z: -ROW_GAP * 0.9 };
const ORN_BASE = [0.9, 0.3, 0.45, 0.4]; // 各区装饰物底部相对 s 的偏移，使其立在地面上
const PAPER_T = 5;            // 纸板厚度（侧面错位）
const PAPER = new Color(236, 226, 202, 255);
const PAPER_DIM = new Color(150, 140, 122, 255);
const PAPER_SHADE = new Color(204, 192, 166, 255);
const PAPER_EDGE = new Color(120, 100, 78, 255);
const PAPER_DARK = new Color(70, 56, 42, 255);

interface Standee {
    root: Node; card: Node; op: UIOpacity;
    x: number; z: number; k: number; w: number; h: number;
    flap: boolean; dim: number; ring: boolean;
}
interface MapPath { ax: number; az: number; bx: number; bz: number; used: boolean; w: number }
interface MapTurf { x: number; z: number; rx: number; rz: number; light: boolean }
interface MapView {
    ground: Graphics; stand: Node; items: Standee[]; paths: MapPath[]; turf: MapTurf[];
    cam: { x: number; z: number }; dirty: boolean; stage: number;
}

@ccclass('GameMain')
export class GameMain extends Component {
    private save: SaveData = { gold: 0, trials: {} };
    private run: RunState = null;
    private picks: string[] = ['pei', 'shen', 'ye'];
    private mapMsg = '';
    private view: MapView = null;
    private marker: Standee = null;
    private markerFace = 1;
    private markerHop = 0;
    private markerW = { x: START.x, z: START.z };
    private mapBusy = false;

    onLoad() {
        this.load();
        this.showHome();
        this.playIntro();
    }

    // ---------------- 开场 ----------------

    private playIntro() {
        const ov = mkNode(this.node, 'intro', 0, 0, 0, 0);
        const bg = mkPanel(ov, 720, 1280, 0, 0, new Color(18, 13, 10, 255), 0, null, 0);
        HEROES.forEach((h, i) => {
            const r = buildRig(ov, h.visual, 120, -255 + i * 170, -250);
            rigIdle(r, i * 0.2);
            popIn(r.root, 0.4, 0.2, 1.15, 0.4 + i * 0.12);
        });
        const dn = mkNode(ov, 'd20', 140, 140, 0, 330);
        const dl = drawD20(dn.addComponent(Graphics), 140, 20);
        tween(dn).repeatForever(tween(dn).by(0.6, { angle: 120 })).start();
        bob(dn, 14, 0.5);
        let k = 0;
        this.schedule(() => { if (dl.isValid) { dl.string = '' + (1 + (k++ * 7) % 20); } }, 0.12, 20);
        const t1 = mkLabel(ov, '烽 火 长 歌', 62, COL.gold, 0, -20);
        const t2 = mkLabel(ov, '乱世聚义，骰定天下。', 20, COL.text, 0, -90);
        const t3 = mkLabel(ov, '乱世之中，以三人之力，书写属于自己的长歌', 15, COL.dim, 0, -125);
        const hint = mkLabel(ov, '点击任意处进入', 15, new Color(160, 140, 115, 255), 0, -480);
        const ops = [t1, t2, t3, hint].map((l) => { const o = l.node.addComponent(UIOpacity); o.opacity = 0; return o; });
        t1.node.setScale(2.4, 0.2, 1);
        tween(t1.node).to(0.5, { scale: Vec3.ONE }).start();
        tween(ops[0]).to(0.4, { opacity: 255 }).start();
        tween(ops[1]).delay(0.5).to(0.4, { opacity: 255 }).start();
        tween(ops[2]).delay(0.8).to(0.4, { opacity: 255 }).start();
        tween(ops[3]).delay(1.2).repeatForever(tween(ops[3]).to(0.5, { opacity: 255 }).to(0.5, { opacity: 90 })).start();
        const ovOp = ov.addComponent(UIOpacity);
        let closed = false;
        const close = () => {
            if (closed) { return; }
            closed = true;
            tween(ovOp).to(0.35, { opacity: 0 }).call(() => ov.destroy()).start();
        };
        bg.node.once(Node.EventType.TOUCH_END, close);
        this.scheduleOnce(close, 3.2);
    }

    // ---------------- 存档 ----------------

    private load() {
        try {
            const raw = sys.localStorage.getItem(SAVE_KEY);
            if (raw) {
                const d = JSON.parse(raw);
                if (d && typeof d.gold === 'number') {
                    this.save = { gold: d.gold, trials: d.trials && typeof d.trials === 'object' ? d.trials : {} };
                    return;
                }
            }
        } catch (e) { /* 存档损坏则用默认 */ }
        this.save = { gold: 0, trials: {} };
    }

    private store() {
        sys.localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    }

    private clearScreen(): Node {
        this.view = null;
        this.node.removeAllChildren();
        return mkPanel(this.node, 720, 1280, 0, 0, COL.bg, 0, null, 0).node;
    }

    // ---------------- 营地：四选三 ----------------

    private showHome() {
        const root = this.clearScreen();
        this.run = null;
        mkLabel(root, '烽 火 长 歌', 52, COL.gold, 0, 590);
        mkLabel(root, '乱世聚义，骰定天下。', 16, COL.dim, 0, 548);
        mkLabel(root, '青州流民营地　·　累计带回 ' + this.save.gold + ' 钱', 15, COL.text, 0, 516);
        mkLabel(root, '—— 选择三名主角出征（四选三，本次战役不可更换）——', 16, COL.gold, 0, 484);

        const cw = 344, ch = 318;
        HEROES.forEach((def, i) => {
            const x = i % 2 === 0 ? -176 : 176, y = 300 - Math.floor(i / 2) * (ch + 12);
            const order = this.picks.indexOf(def.id);
            const on = order >= 0;
            const p = mkPanel(root, cw, ch, x, y, on ? COL.panelLight : COL.panel, 10, on ? COL.gold : COL.border, on ? 3 : 2);
            const c = def.color;
            mkPanel(p.node, cw - 6, 30, 0, ch / 2 - 18, new Color(c[0], c[1], c[2], 255), 7, null, 0);
            mkLabel(p.node, def.title + ' · ' + def.name, 18, new Color(255, 250, 236, 255), 0, ch / 2 - 18);
            if (on) { mkLabel(p.node, CIRCLED[order], 22, COL.gold, cw / 2 - 22, ch / 2 - 18); }
            mkLabel(p.node, def.role, 12, COL.gold, 0, ch / 2 - 48);
            const r = buildRig(p.node, def.visual, 108, -100, 34);
            rigIdle(r, i * 0.15);
            if (!on) { r.root.addComponent(UIOpacity).opacity = 150; }
            const w = weaponById(def.weapon);
            const lines = [
                '生命 ' + def.maxHp + '　防御 ' + (def.ac + (w.ac || 0)),
                '武器 ' + w.name + '（1D' + w.die + '）',
                '资源 ' + def.res + '（上限 ' + def.resMax + '）',
                '站位 ' + (def.row === 'front' ? '前排' : '后排'),
            ];
            lines.forEach((t, k) => mkLabel(p.node, t, 12.5, COL.text, 70, 72 - k * 22, 190, HorizontalTextAlignment.LEFT));
            const a = def.attrs;
            mkLabel(p.node, '力' + a.str + ' 敏' + a.dex + ' 体' + a.con + ' 智' + a.int + ' 感' + a.wis + ' 魅' + a.cha,
                12, COL.dim, 0, -38);
            mkLabel(p.node, def.passive, 11.5, COL.text, 0, -72, cw - 24);
            mkLabel(p.node, def.story, 10.5, COL.dim, 0, -116, cw - 24);
            const t = (this.save.trials || {})[def.id];
            mkLabel(p.node, t ? '出征 ' + t.runs + ' · 通关 ' + t.clears : '尚未出征', 11, on ? COL.gold : COL.dim, 0, -ch / 2 + 14);
            p.node.on(Node.EventType.TOUCH_END, () => {
                const k = this.picks.indexOf(def.id);
                if (k >= 0) { this.picks.splice(k, 1); } else if (this.picks.length < 3) { this.picks.push(def.id); }
                this.showHome();
            });
        });

        const note = this.picks.length === 3 ? partyNote(this.picks) : null;
        mkLabel(root, note ? '阵容特点：' + note.note + '　短板：' + note.weak
            : '已选 ' + this.picks.length + '/3 —— 点击卡片选择或取消', 14, note ? COL.gold : COL.dim, 0, -372, 680);
        const go = mkButton(root, '出 征', 300, 64, 0, -440, 26, () => this.startRun(this.picks.slice()));
        setBtnEnabled(go, this.picks.length === 3, 300, 64);
        const tips = [
            '每名角色每回合独立掷 3D6，骰子不能互换；把骰子填进技能骰槽来行动',
            'D20 决定成败（命中/检定/豁免），武器骰结算伤害；敌人头顶显示行动意图',
            '四大区域：青州 → 汉北 → 黑水谷 → 洛阳；只有通关才能带回钱',
        ];
        tips.forEach((t, k) => mkLabel(root, t, 12.5, COL.dim, 0, -510 - k * 26, 690));
    }

    // ---------------- 远征 ----------------

    private startRun(ids: string[]) {
        const deco: { x: number; y: number; r: number }[] = [];
        for (let i = 0; i < 40; i++) {
            deco.push({ x: -270 + Math.random() * 540, y: -360 + Math.random() * 780, r: 1 + Math.random() * 2.2 });
        }
        this.run = {
            party: ids.map((id) => makeHero(heroById(id))),
            gold: 0, map: this.genMap(), posRow: -1, posCol: -1, depth: 0, stage: 0, deco,
        };
        this.mapMsg = STAGES[0].goal;
        this.showMap();
    }

    private genMap(): MapNode[][] {
        // 三条路线：各自独立的槽位走廊（互不重叠），行间默认只沿本线前进
        const LANES: number[][] = [[0, 0.5], [1.5, 2], [2.5, 3]];
        // 每条线构成一致：3 战斗 + 1 精英 + 1 特殊（宝箱/奇遇/营火各一条线随机分得）
        const specials: NodeKind[] = ['treasure', 'event', 'rest'];
        for (let i = specials.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = specials[i]; specials[i] = specials[j]; specials[j] = t;
        }
        const laneKinds: NodeKind[][] = LANES.map((_, l) => {
            const kinds: NodeKind[] = ['battle', 'battle', 'battle', 'elite', specials[l]];
            for (let i = kinds.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const t = kinds[i]; kinds[i] = kinds[j]; kinds[j] = t;
            }
            return kinds;
        });
        const map: MapNode[][] = [];
        for (let r = 0; r < 5; r++) {
            map.push(LANES.map((slots, l) => ({
                kind: laneKinds[l][r],
                slot: slots[Math.floor(Math.random() * slots.length)],
                links: [],
                done: false,
            })));
        }
        for (let r = 0; r < map.length - 1; r++) {
            for (let l = 0; l < LANES.length; l++) { map[r][l].links.push(l); }
            // 少数岔口允许换到相邻路线
            if (Math.random() < 0.2) {
                const a = Math.floor(Math.random() * (LANES.length - 1));
                const from = Math.random() < 0.5 ? a : a + 1;
                map[r][from].links.push(from === a ? a + 1 : a);
            }
        }
        map.push([{ kind: 'boss', slot: 1.5, links: [], done: false }]);
        for (let l = 0; l < LANES.length; l++) { map[map.length - 2][l].links.push(0); }
        return map;
    }

    private slotX(slot: number): number {
        const f = Math.floor(slot), c = Math.ceil(slot);
        return f === c ? COLUMN_X[f] : (COLUMN_X[f] + COLUMN_X[c]) / 2;
    }

    private reachable(r: number, i: number): boolean {
        const run = this.run;
        if (r !== run.posRow + 1) { return false; }
        if (run.posRow < 0) { return true; }
        return run.map[run.posRow][run.posCol].links.indexOf(i) >= 0;
    }

    private travelTo(r: number, col: number) {
        if (this.mapBusy || !this.reachable(r, col)) { return; }
        this.mapBusy = true;
        const nd = this.run.map[r][col];
        const from = { x: this.markerW.x, z: this.markerW.z };
        const dst = this.markerSpot(nd.slot, r);
        const mk = this.marker, card = mk.card;
        // 纸片转身：横向压扁再展开
        const face = Math.abs(dst.x - from.x) < 4 ? this.markerFace : dst.x < from.x ? -1 : 1;
        if (face !== this.markerFace) {
            this.markerFace = face;
            tween(card).to(0.12, { scale: new Vec3(0.04, 1, 1) }).to(0.12, { scale: new Vec3(face, 1, 1) }).start();
        }
        const st = { t: 0 };
        tween(st).to(0.6, { t: 1 }, {
            onUpdate: (_o?: unknown, k?: number) => {
                const kk = k === undefined ? st.t : k;
                const hk = (kk * 2) % 1;
                mk.x = from.x + (dst.x - from.x) * kk;
                mk.z = from.z + (dst.z - from.z) * kk;
                this.markerW = { x: mk.x, z: mk.z };
                // 立牌跳起、影子留在地面；行走时纸片轻晃；相机在 update 中跟随
                this.markerHop = Math.sin(Math.PI * hk) * 30 * (1 - kk * 0.35);
                card.setPosition(0, this.markerHop, 0);
                card.angle = Math.sin(kk * Math.PI * 4) * 5;
                this.view.dirty = true;
            },
        }).call(() => {
            card.angle = 0;
            card.setPosition(0, 0, 0);
            this.markerHop = 0;
            this.run.posRow = r;
            this.run.posCol = col;
            this.enterNode(nd.kind);
        }).start();
    }

    private drawOrn(g: Graphics, stage: number, x: number, y: number, s: number, k: number) {
        switch (stage) {
            case 0: // 青州：青山松影
                g.fillColor = new Color(16, 28, 18, 255);
                g.moveTo(x, y + s); g.lineTo(x - s * 0.7, y - s * 0.1); g.lineTo(x + s * 0.7, y - s * 0.1); g.close(); g.fill();
                g.moveTo(x, y + s * 0.4); g.lineTo(x - s * 0.85, y - s * 0.9); g.lineTo(x + s * 0.85, y - s * 0.9); g.close(); g.fill();
                break;
            case 1: // 汉北：关隘残垣
                g.fillColor = new Color(34, 32, 28, 255);
                g.rect(x - s * 0.5, y - s * 0.3, s, s * 0.6); g.fill();
                if (k % 2 === 0) { g.rect(x - s * 0.15, y + s * 0.3, s * 0.3, s * 0.5); g.fill(); }
                else { g.rect(x - s * 0.7, y - s * 0.1, s * 0.35, s * 0.35); g.fill(); }
                break;
            case 2: // 黑水谷：峡谷乱石
                g.fillColor = new Color(70, 96, 108, 200);
                g.moveTo(x, y + s * 0.85); g.lineTo(x - s * 0.4, y); g.lineTo(x, y - s * 0.45); g.lineTo(x + s * 0.4, y); g.close(); g.fill();
                if (k % 2 === 0) {
                    g.moveTo(x + s * 0.5, y + s * 0.5); g.lineTo(x + s * 0.25, y - s * 0.05); g.lineTo(x + s * 0.7, y - s * 0.15); g.close(); g.fill();
                }
                break;
            default: // 洛阳：烽火
                g.fillColor = new Color(128, 54, 32, 220);
                g.moveTo(x - s * 0.6, y - s * 0.4); g.lineTo(x - s * 0.05, y + s * 0.75); g.lineTo(x + s * 0.35, y - s * 0.15); g.close(); g.fill();
                if (k % 2 === 0) {
                    g.fillColor = new Color(226, 120, 50, 180);
                    g.circle(x + s * 0.4, y + s * 0.3, s * 0.16); g.fill();
                }
                break;
        }
    }

    private drawMapNode(g: Graphics, kind: NodeKind, state: string) {
        g.clear();
        const s = kind === 'boss' ? 30 : 26;
        let fill = COL.panel, ring = COL.border, lw = 2;
        if (state === 'next' || state === 'cur') { fill = COL.panelLight; ring = COL.gold; lw = 3; }
        if (state === 'done') { fill = COL.btnOff; }
        if (state === 'far') { fill = new Color(48, 40, 36, 255); }
        g.lineWidth = lw;
        g.strokeColor = ring;
        g.fillColor = fill;
        g.circle(0, 0, s);
        g.fill();
        g.stroke();
        drawNodeIcon(g, kind);
        if (state === 'done') {
            g.strokeColor = COL.green;
            g.lineWidth = 5;
            g.moveTo(-11, 0); g.lineTo(-3, -9); g.lineTo(12, 9);
            g.stroke();
        }
    }

    private showMap() {
        const root = this.clearScreen();
        const run = this.run;
        this.mapBusy = false;
        this.markerHop = 0;
        this.markerW = run.posRow < 0 ? { x: START.x, z: START.z }
            : this.markerSpot(run.map[run.posRow][run.posCol].slot, run.posRow);

        // 地图（饥荒式 2.5D：透视相机固定俯角、跟随领队，纸片立牌正对屏幕）
        const mapRoot = mkNode(root, 'map', 720, 1280, 0, 0);
        const ground = mkNode(mapRoot, 'ground', 0, 0, 0, 0).addComponent(Graphics);
        const stand = mkNode(mapRoot, 'stand', 0, 0, 0, 0);
        this.view = {
            ground, stand, items: [], paths: this.buildPaths(), turf: this.buildTurf(run.stage),
            cam: { x: this.markerW.x, z: this.markerW.z }, dirty: true, stage: run.stage,
        };

        this.buildOrnaments(run.stage).forEach((o) => {
            const it = this.mkStandee('orn', o.x, o.z, o.s * 1.4, o.s * 2, ORN_K, false);
            this.drawOrn(it.card.addComponent(Graphics), run.stage, 0, o.s * ORN_BASE[run.stage], o.s, o.k);
            this.foldUp(it.card, 0.05 + Math.random() * 0.25);
            const a = 1 + Math.random() * 1.5, d = 1.2 + Math.random() * 0.8;
            tween(it.card).delay(0.4).repeatForever(tween(it.card).to(d, { angle: a }, { easing: 'sineInOut' })
                .to(d, { angle: -a }, { easing: 'sineInOut' })).start();
        });

        // 出发路牌
        const sign = this.mkStandee('start', START.x - 70, START.z - 30, 72, 60, 1, false);
        const sg = sign.card.addComponent(Graphics);
        sg.fillColor = new Color(70, 50, 34, 255);
        sg.rect(-4, 0, 8, 34);
        sg.fill();
        this.drawPaperBoard(sg, -34, 26, 68, 30, 6, PAPER);
        mkLabel(sign.card, '出 发', 15, new Color(90, 60, 36, 255), 0, 41);
        this.foldUp(sign.card, 0.1);

        for (let r = 0; r < run.map.length; r++) {
            const row = run.map[r];
            for (let i = 0; i < row.length; i++) {
                const nd = row[i];
                const state = nd.done ? 'done'
                    : (r === run.posRow && i === run.posCol) ? 'cur'
                        : this.reachable(r, i) ? 'next' : 'far';
                const s = nd.kind === 'boss' ? 30 : 26;
                const it = this.mkStandee('n' + r + '_' + i, this.laneX(nd.slot), this.rowZ(r), s * 2 + 18, s * 2 + 32, NODE_K, true);
                it.ring = state === 'next' || state === 'cur';
                it.dim = state === 'far' ? 0.55 : 1;
                this.drawNodeCard(it.card, nd.kind, state, s);
                this.foldUp(it.card, 0.1 + Math.max(0, r - run.posRow) * 0.08);
                if (state === 'next') {
                    tween(it.card).delay(0.5).repeatForever(tween(it.card).to(0.45, { position: new Vec3(0, 8, 0) }, { easing: 'sineOut' })
                        .to(0.45, { position: Vec3.ZERO }, { easing: 'sineIn' })).start();
                    const rr = r, ii = i;
                    it.card.on(Node.EventType.TOUCH_END, () => this.travelTo(rr, ii));
                }
                mkLabel(it.root, NODE_NAME[nd.kind], 13, state === 'far' ? COL.dim : COL.text, 0, -(s * 2 + 18) * 0.36 - 8);
            }
        }

        // 队伍标记（领队）：纸板立牌
        const mk = this.mkStandee('marker', this.markerW.x, this.markerW.z, 58, 86, MARKER_K, true);
        this.marker = mk;
        this.drawPaperBoard(mk.card.addComponent(Graphics), -29, 0, 58, 86, 12, PAPER);
        rigIdle(buildRig(mk.card, run.party[0].def.visual, 68, 0, 34 + 9));
        this.foldUp(mk.card, 0.35, this.markerFace);

        // HUD（叠在场景上方）
        const shade = new Color(20, 14, 10, 225);
        mkPanel(root, 720, 150, 0, 565, shade, 0, null, 0);
        mkPanel(root, 720, 28, 0, 476, new Color(20, 14, 10, 110), 0, null, 0);
        mkPanel(root, 720, 130, 0, -575, shade, 0, null, 0);
        mkPanel(root, 720, 28, 0, -496, new Color(20, 14, 10, 110), 0, null, 0);
        run.party.forEach((h, i) => {
            const x = -230 + i * 230;
            mkLabel(root, h.def.name + '　' + Math.max(0, h.hp) + '/' + h.maxHp, 15, h.hp > 0 ? COL.gold : COL.red, x, 612);
            mkBar(root, 190, 12, x, 590).set(h.hp / h.maxHp);
            mkLabel(root, weaponName(h.weapon), 11.5, COL.dim, x, 572);
        });
        const st = STAGES[run.stage];
        mkLabel(root, '钱 ' + run.gold + '　进度 ' + run.depth + '/24　' + st.name, 14, COL.text, 0, 546);
        if (this.mapMsg) { mkLabel(root, this.mapMsg, 14, COL.gold, 0, 520, 680); }
        mkLabel(root, '第 ' + (run.stage + 1) + ' 章 · ' + st.short, 19, new Color(226, 210, 180, 255), 250, 466);
        mkButton(root, '撤退', 160, 46, -265, -600, 16, () => { this.finishRun(false); this.showHome(); });
        mkLabel(root, '点击发光节点前进，走过无法回头；撤退不带回钱', 12, COL.dim, 90, -600);
        mkLabel(root, '本章目标：' + st.goal, 13, COL.dim, 0, -545, 680);

        this.layoutMap();
    }

    update(dt: number) {
        const v = this.view;
        if (!v || !v.ground.isValid) { return; }
        const t = this.markerW, k = Math.min(1, dt * CAM_LAG);
        const dx = t.x - v.cam.x, dz = t.z - v.cam.z;
        if (!v.dirty && Math.abs(dx) < 0.05 && Math.abs(dz) < 0.05) { return; }
        v.cam.x += dx * k;
        v.cam.z += dz * k;
        v.dirty = false;
        this.layoutMap();
    }

    // ---------------- 2.5D 地图辅助 ----------------

    private laneX(slot: number): number {
        return this.slotX(slot) * LANE_K;
    }

    private rowZ(r: number): number {
        return r * ROW_GAP;
    }

    /** 领队站位：节点右前方，避免遮住节点图案。 */
    private markerSpot(slot: number, r: number): { x: number; z: number } {
        return { x: this.laneX(slot) + 62, z: this.rowZ(r) - 36 };
    }

    /** 透视相机：俯角固定，注视点 = 相机跟随位置。返回屏幕坐标、立牌缩放与视深。 */
    private proj(wx: number, wz: number): { x: number; y: number; s: number; d: number } {
        const c = this.view.cam;
        const X = wx - c.x, Z = wz - c.z;
        const d = CAM_R + Z * CAM_COS;
        const s = CAM_F / d;
        return { x: X * s, y: FOCUS_Y + Z * CAM_SIN * s, s, d };
    }

    /** 贴地多边形（世界坐标点列），先按近裁剪面裁切再投影。 */
    private groundPoly(g: Graphics, pts: number[]) {
        const zn = this.view.cam.z + (NEAR_DEPTH - CAM_R) / CAM_COS;
        const out: number[] = [];
        const n = pts.length / 2;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const ax = pts[i * 2], az = pts[i * 2 + 1], bx = pts[j * 2], bz = pts[j * 2 + 1];
            if (az >= zn) { out.push(ax, az); }
            if ((az >= zn) !== (bz >= zn)) { out.push(ax + (bx - ax) * (zn - az) / (bz - az), zn); }
        }
        if (out.length < 6) { return; }
        for (let i = 0; i < out.length; i += 2) {
            const p = this.proj(out[i], out[i + 1]);
            if (i === 0) { g.moveTo(p.x, p.y); } else { g.lineTo(p.x, p.y); }
        }
        g.close();
        g.fill();
    }

    private groundEllipse(g: Graphics, x: number, z: number, rx: number, rz: number, seg = 12) {
        const pts: number[] = [];
        for (let i = 0; i < seg; i++) {
            const a = i * Math.PI * 2 / seg;
            pts.push(x + Math.cos(a) * rx, z + Math.sin(a) * rz);
        }
        this.groundPoly(g, pts);
    }

    /** 所有路线（世界坐标），供绘制与装饰物避让。 */
    private buildPaths(): MapPath[] {
        const run = this.run, out: MapPath[] = [];
        for (let r = 0; r < run.map.length - 1; r++) {
            const cur = run.map[r], nxt = run.map[r + 1];
            for (let i = 0; i < cur.length; i++) {
                for (const j of cur[i].links) {
                    const used = cur[i].done && nxt[j].done;
                    out.push({ ax: this.laneX(cur[i].slot), az: this.rowZ(r), bx: this.laneX(nxt[j].slot), bz: this.rowZ(r + 1), used, w: used ? 26 : 18 });
                }
            }
        }
        for (const n of run.map[0]) {
            out.push({ ax: START.x, az: START.z, bx: this.laneX(n.slot), bz: 0, used: n.done, w: n.done ? 26 : 16 });
        }
        return out;
    }

    /** 地表斑块（草皮/泥地），同区种子固定。 */
    private buildTurf(stage: number): MapTurf[] {
        let seed = stage * 3571 + 7;
        const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
        const out: MapTurf[] = [];
        for (let i = 0; i < 46; i++) {
            out.push({
                x: -GROUND_X + rnd() * GROUND_X * 2, z: GROUND_Z0 + rnd() * (GROUND_Z1 - GROUND_Z0),
                rx: 60 + rnd() * 120, rz: 40 + rnd() * 80, light: rnd() < 0.45,
            });
        }
        return out;
    }

    /** 区域主题装饰物：种子随机撒布（同区布局固定），避开节点与路线。 */
    private buildOrnaments(stage: number): { x: number; z: number; s: number; k: number }[] {
        let seed = stage * 7919 + 13;
        const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
        const nodePts: { x: number; z: number }[] = [{ x: START.x, z: START.z }, { x: START.x - 70, z: START.z - 30 }];
        this.run.map.forEach((row, r) => row.forEach((n) => nodePts.push({ x: this.laneX(n.slot), z: this.rowZ(r) })));
        const segDist = (x: number, z: number, p: MapPath) => {
            const dx = p.bx - p.ax, dz = p.bz - p.az, l2 = dx * dx + dz * dz || 1;
            const t = Math.max(0, Math.min(1, ((x - p.ax) * dx + (z - p.az) * dz) / l2));
            const ex = p.ax + dx * t - x, ez = p.az + dz * t - z;
            return Math.sqrt(ex * ex + ez * ez);
        };
        const out: { x: number; z: number; s: number; k: number }[] = [];
        for (let i = 0; i < 500 && out.length < 110; i++) {
            const x = -GROUND_X + 40 + rnd() * (GROUND_X * 2 - 80), z = GROUND_Z0 + 40 + rnd() * (GROUND_Z1 - GROUND_Z0 - 80);
            const s = 12 + rnd() * 14, k = Math.floor(rnd() * 4);
            if (nodePts.some((p) => Math.abs(p.x - x) < 120 && Math.abs(p.z - z) < 100)) { continue; }
            if (this.view.paths.some((p) => segDist(x, z, p) < 55)) { continue; }
            out.push({ x, z, s, k });
        }
        return out;
    }

    private drawGround(g: Graphics) {
        const v = this.view, c = STAGES[v.stage].color;
        const L = -GROUND_X, R = GROUND_X, N = GROUND_Z0, F = GROUND_Z1;
        const zn = v.cam.z + (NEAR_DEPTH - CAM_R) / CAM_COS;
        const tint = (m: number, a = 255) => new Color(Math.min(255, Math.round(c[0] * m)), Math.min(255, Math.round(c[1] * m)), Math.min(255, Math.round(c[2] * m)), a);
        // 地台前沿厚度（漂浮的立体地块）
        if (N >= zn) {
            const nl = this.proj(L, N), nr = this.proj(R, N), h = SLAB * nl.s;
            g.fillColor = tint(0.45);
            g.moveTo(nl.x, nl.y); g.lineTo(nr.x, nr.y); g.lineTo(nr.x, nr.y - h); g.lineTo(nl.x, nl.y - h);
            g.close();
            g.fill();
            g.fillColor = tint(0.3);
            g.rect(nl.x, nl.y - h - 6 * nl.s, nr.x - nl.x, 6 * nl.s);
            g.fill();
        }
        g.fillColor = tint(1);
        this.groundPoly(g, [L, N, R, N, R, F, L, F]);
        for (const t of v.turf) {
            g.fillColor = t.light ? tint(1.25, 110) : tint(0.72, 120);
            this.groundEllipse(g, t.x, t.z, t.rx, t.rz);
        }
        if (N >= zn) {
            const nl = this.proj(L, N), nr = this.proj(R, N);
            g.strokeColor = tint(1.5, 160);
            g.lineWidth = 2;
            g.moveTo(nl.x, nl.y); g.lineTo(nr.x, nr.y); g.stroke();
        }
    }

    /** 远景雾：越远越暗，最终融入背景。 */
    private drawFog(g: Graphics) {
        const v = this.view, z0 = v.cam.z + FADE_Z0 * 0.8, z1 = v.cam.z + FADE_Z1 + 500;
        g.fillColor = new Color(COL.bg.r, COL.bg.g, COL.bg.b, 38);
        for (let i = 0; i < 8; i++) {
            const z = z0 + (z1 - z0) * i / 8;
            this.groundPoly(g, [-GROUND_X * 3, z, GROUND_X * 3, z, GROUND_X * 3, z1 + 3000, -GROUND_X * 3, z1 + 3000]);
        }
    }

    /** 相机移动时重算：地面、路线、立牌投影、影子与绘制顺序。 */
    private layoutMap() {
        const v = this.view, g = v.ground;
        g.clear();
        this.drawGround(g);
        g.fillColor = new Color(255, 255, 255, 60);
        for (const d of this.run.deco) {
            const p = this.proj(d.x * 2.2, (d.y - 40 + 280) / 104 * ROW_GAP);
            if (p.d < NEAR_DEPTH) { continue; }
            g.ellipse(p.x, p.y, d.r * 1.6 * p.s, d.r * 1.6 * p.s * CAM_SIN * 0.6);
            g.fill();
        }
        // 路线：先描暗边再铺路面
        for (const p of v.paths) {
            const dx = p.bx - p.ax, dz = p.bz - p.az, len = Math.sqrt(dx * dx + dz * dz) || 1;
            const layers: [number, Color][] = [[p.w + 10, new Color(40, 30, 22, 90)], [p.w, p.used ? COL.gold : new Color(128, 104, 78, 200)]];
            for (const [w, col] of layers) {
                const nx = -dz / len * w / 2, nz = dx / len * w / 2;
                g.fillColor = col;
                this.groundPoly(g, [p.ax + nx, p.az + nz, p.bx + nx, p.bz + nz, p.bx - nx, p.bz - nz, p.ax - nx, p.az - nz]);
                this.groundEllipse(g, p.bx, p.bz, w / 2, w / 2, 8);
            }
        }
        // 立牌：投影 + 远处淡出 + 投在地面的影子与折起的底座
        for (const it of v.items) {
            const p = this.proj(it.x, it.z);
            const Z = it.z - v.cam.z;
            const fade = Z <= FADE_Z0 ? 1 : Math.max(0, 1 - (Z - FADE_Z0) / (FADE_Z1 - FADE_Z0));
            const vis = p.d > NEAR_DEPTH && p.y > -1000 && fade > 0.01;
            it.root.active = vis;
            if (!vis) { continue; }
            it.root.setPosition(p.x, p.y, 0);
            it.root.setScale(p.s * it.k, p.s * it.k, 1);
            it.op.opacity = Math.round(255 * fade * it.dim);
            this.drawFootprint(g, it, p, fade);
        }
        this.drawFog(g);
        v.items.slice().sort((a, b) => b.z - a.z).forEach((it, i) => it.root.setSiblingIndex(i));
    }

    /** 立牌落在地面的部分：斜投影、接触阴影、可达光圈、向前折起的纸底座。 */
    private drawFootprint(g: Graphics, it: Standee, p: { x: number; y: number; s: number }, fade: number) {
        const hw = it.w * it.k / 2, H = it.h * it.k;
        const hop = it === this.marker ? this.markerHop : 0;
        const a = (n: number) => Math.round(n * fade * it.dim);
        g.fillColor = new Color(0, 0, 0, a(52));
        this.groundPoly(g, [
            it.x - hw, it.z, it.x + hw, it.z,
            it.x + hw * 0.7 + H * SHADOW_DX, it.z + H * SHADOW_DZ,
            it.x - hw * 0.7 + H * SHADOW_DX, it.z + H * SHADOW_DZ,
        ]);
        const sh = Math.max(0.45, 1 - hop / 50);
        g.fillColor = new Color(0, 0, 0, a(95 * sh));
        g.ellipse(p.x, p.y, hw * 1.15 * p.s * sh, hw * 1.15 * p.s * sh * CAM_SIN * 0.5);
        g.fill();
        if (it.ring) {
            g.strokeColor = new Color(COL.gold.r, COL.gold.g, COL.gold.b, a(230));
            g.lineWidth = 3;
            g.ellipse(p.x, p.y, hw * 1.5 * p.s, hw * 1.5 * p.s * CAM_SIN * 0.55);
            g.stroke();
        }
        if (it.flap && hop < 1) {
            const fd = hw * 0.55;
            g.fillColor = new Color(PAPER_EDGE.r, PAPER_EDGE.g, PAPER_EDGE.b, a(255));
            this.groundPoly(g, [it.x - hw * 0.98, it.z - fd - 3, it.x + hw * 0.98, it.z - fd - 3, it.x + hw * 0.98, it.z - fd + 2, it.x - hw * 0.98, it.z - fd + 2]);
            g.fillColor = new Color(PAPER_SHADE.r, PAPER_SHADE.g, PAPER_SHADE.b, a(255));
            this.groundPoly(g, [it.x - hw * 0.86, it.z, it.x + hw * 0.86, it.z, it.x + hw * 0.98, it.z - fd, it.x - hw * 0.98, it.z - fd]);
            const l = this.proj(it.x - hw * 0.86, it.z), r = this.proj(it.x + hw * 0.86, it.z);
            g.strokeColor = new Color(PAPER_EDGE.r, PAPER_EDGE.g, PAPER_EDGE.b, a(255));
            g.lineWidth = 1.5;
            g.moveTo(l.x, l.y); g.lineTo(r.x, r.y); g.stroke();
        }
    }

    /** 纸片立牌：root 落在地面投影点，card 为直立面（底部锚点）。影子/底座由地面层绘制。 */
    private mkStandee(name: string, x: number, z: number, w: number, h: number, k: number, flap: boolean): Standee {
        const root = mkNode(this.view.stand, name, 0, 0, 0, 0);
        const op = root.addComponent(UIOpacity);
        const card = mkNode(root, 'card', w, h, 0, 0);
        card.getComponent(UITransform).setAnchorPoint(0.5, 0);
        const it: Standee = { root, card, op, x, z, k, w, h, flap, dim: 1, ring: false };
        this.view.items.push(it);
        return it;
    }

    /** 折纸立起：直立面从贴地压扁状态弹起。 */
    private foldUp(card: Node, delay: number, sx = 1) {
        card.setScale(sx, 0.04, 1);
        tween(card).delay(delay).to(0.34, { scale: new Vec3(sx, 1, 1) }, { easing: 'backOut' }).start();
    }

    /** 纸板：右下错位的侧面厚度 + 正面 + 左上受光边 + 底部压暗。 */
    private drawPaperBoard(g: Graphics, x: number, y: number, w: number, h: number, r: number, face: Color) {
        g.fillColor = PAPER_DARK;
        g.roundRect(x + PAPER_T, y - PAPER_T, w, h, r);
        g.fill();
        g.fillColor = PAPER_EDGE;
        g.roundRect(x + PAPER_T * 0.5, y - PAPER_T * 0.5, w, h, r);
        g.fill();
        g.fillColor = face;
        g.roundRect(x, y, w, h, r);
        g.fill();
        g.fillColor = new Color(0, 0, 0, 34);
        g.roundRect(x, y, w, Math.min(h, 14), Math.min(r, 6));
        g.fill();
        g.strokeColor = new Color(255, 252, 240, 210);
        g.lineWidth = 2;
        g.moveTo(x + 1.5, y + r); g.lineTo(x + 1.5, y + h - r);
        g.arc(x + r, y + h - r, r - 1.5, Math.PI, Math.PI / 2, false);
        g.lineTo(x + w - r, y + h - 1.5);
        g.stroke();
        g.strokeColor = PAPER_SHADE;
        g.lineWidth = 1.5;
        g.roundRect(x + 4, y + 4, w - 8, h - 8, Math.max(2, r - 3));
        g.stroke();
    }

    /** 节点立牌：纸板支脚 + 圆牌（带厚度与受光）+ 原节点图案。 */
    private drawNodeCard(card: Node, kind: NodeKind, state: string, s: number) {
        const lift = 16, R = s + 6, cy = lift + R;
        const g = card.addComponent(Graphics);
        const layers: [number, Color][] = [[PAPER_T, PAPER_DARK], [PAPER_T * 0.5, PAPER_EDGE], [0, state === 'far' ? PAPER_DIM : PAPER]];
        for (const [o, c] of layers) {
            g.fillColor = c;
            g.rect(-7 + o, -o, 14, lift + 8);
            g.fill();
            g.circle(o, cy - o, R);
            g.fill();
        }
        g.fillColor = new Color(0, 0, 0, 40);
        g.rect(-7, 0, 14, 7);
        g.fill();
        g.strokeColor = new Color(255, 252, 240, 210);
        g.lineWidth = 2;
        g.arc(0, cy, R - 1.5, Math.PI * 0.45, Math.PI * 1.1, true);
        g.stroke();
        const face = mkNode(card, 'face', 0, 0, 0, cy);
        this.drawMapNode(face.addComponent(Graphics), kind, state);
    }

    private enterNode(kind: NodeKind) {
        switch (kind) {
            case 'battle': case 'elite': case 'boss':
                this.startBattle(encounter(kind, this.run.stage, Math.random), kind);
                break;
            case 'treasure': this.showTreasure(); break;
            case 'event': this.showEvent(EVENTS[Math.floor(Math.random() * EVENTS.length)]); break;
            case 'rest': this.showRest(); break;
        }
    }

    private startBattle(enemies: EnemyDef[], kind: NodeKind) {
        const root = this.clearScreen();
        const bn = mkNode(root, 'battle', 0, 0, 0, 0);
        bn.addComponent(BattleScreen).init(this.run.party, enemies, (won, gold) => {
            bn.destroy();
            if (!won) {
                this.finishRun(false);
                this.showSettle(false);
                return;
            }
            this.run.gold += gold;
            for (const h of this.run.party) {
                h.hp = h.hp <= 0 ? RULES.reviveHp : Math.min(h.maxHp, h.hp + Math.round(h.maxHp * RULES.battleHeal));
            }
            if (kind === 'boss') {
                this.advance('击败 ' + enemies[0].name + '！');
            } else {
                this.showRewardPick(kind === 'elite' ? 1 : 0, '胜利！获得 ' + gold + ' 钱', null);
            }
        });
    }

    private advance(msg: string) {
        const nd = this.run.map[this.run.posRow][this.run.posCol];
        nd.done = true;
        this.run.depth++;
        this.mapMsg = msg;
        if (nd.kind !== 'boss') { this.showMap(); return; }
        if (this.run.stage >= STAGES.length - 1) {
            this.finishRun(true);
            this.showSettle(true);
            return;
        }
        this.run.stage++;
        this.run.map = this.genMap();
        this.run.posRow = -1;
        this.run.posCol = -1;
        this.healPct(RULES.stageHeal);
        this.mapMsg = msg + ' 进军「' + STAGES[this.run.stage].name + '」（全队恢复 ' + Math.round(RULES.stageHeal * 100) + '%）';
        this.showMap();
    }

    /** 一局结束：通关才带回钱 + 记录每名出征角色的战绩。 */
    private finishRun(cleared: boolean) {
        const run = this.run;
        if (!run) { return; }
        if (cleared) { this.save.gold += run.gold; }
        if (!this.save.trials) { this.save.trials = {}; }
        for (const h of run.party) {
            const t = this.save.trials[h.def.id] || { runs: 0, clears: 0 };
            t.runs++;
            if (cleared) { t.clears++; }
            this.save.trials[h.def.id] = t;
        }
        this.store();
    }

    private healPct(pct: number) {
        for (const h of this.run.party) {
            if (h.hp > 0) { h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * pct)); }
        }
    }

    // ---------------- 战利品 ----------------

    /** 三选一战利品；weaponsOnly 时只给兵器（升品/换装）。 */
    private showRewardPick(bonusQ: number, title: string, weaponsOnly: boolean | null) {
        const root = this.clearScreen();
        const party = this.run.party;
        mkLabel(root, title, 30, COL.gold, 0, 440);
        mkLabel(root, '选择一项战利品（武器能改变战斗流派）', 16, COL.dim, 0, 396);
        let opts: Reward[] = rewardOptions(party, Math.random, bonusQ);
        if (weaponsOnly) {
            opts = opts.filter((o) => o.kind === 'weapon' || o.kind === 'upgrade');
            if (!opts.length) { opts = [{ kind: 'heal', pct: 0.25 }]; }
        }
        party.forEach((h, i) => mkLabel(root, h.def.name + '：' + weaponName(h.weapon) + '　生命 ' + h.hp + '/' + h.maxHp,
            14, COL.text, 0, 330 - i * 26));
        let picked = false;
        opts.forEach((o, i) => {
            const b = mkButton(root, rewardText(party, o), 640, 76, 0, 170 - i * 96, 16, () => {
                if (picked) { return; }
                picked = true;
                applyReward(party, o);
                popIn(b.node, 0.2, 0.9, 1.06);
                this.scheduleOnce(() => this.advance('获得：' + rewardText(party, o).split('（')[0]), 0.25);
            });
        });
        mkButton(root, '跳过', 180, 52, 0, 170 - opts.length * 96 - 10, 18, () => {
            if (picked) { return; }
            picked = true;
            this.advance('空手而返');
        });
    }

    // ---------------- 节点内容 ----------------

    private showTreasure() {
        const root = this.clearScreen();
        mkLabel(root, '前朝窖藏', 30, COL.gold, 0, 380);
        mkLabel(root, '坍塌的地窖里堆着蒙尘的木箱，箱上还贴着前朝官府的封条。', 16, COL.text, 0, 330, 600);
        let done = false;
        const opts: { label: string; apply: () => void }[] = [
            { label: '取走金银（+35 钱）', apply: () => { this.run.gold += 35; this.advance('窖藏中取得 35 钱'); } },
            { label: '翻找兵器（兵器战利品）', apply: () => this.showRewardPick(1, '窖藏兵器', true) },
            { label: '取用伤药（全队恢复 30%）', apply: () => { this.healPct(0.3); this.advance('伤药敷上，伤势好转'); } },
        ];
        opts.forEach((o, i) => mkButton(root, o.label, 420, 60, 0, 200 - i * 80, 18, () => {
            if (done) { return; }
            done = true;
            o.apply();
        }));
    }

    private showRest() {
        const root = this.clearScreen();
        mkLabel(root, '营火', 30, COL.gold, 0, 400);
        mkLabel(root, '篝火噼啪作响，三人轮流守夜。', 16, COL.text, 0, 350);
        let done = false;
        mkButton(root, '休整（全队恢复 ' + Math.round(RULES.restHeal * 100) + '%）', 420, 60, 0, 240, 18, () => {
            if (done) { return; }
            done = true;
            this.healPct(RULES.restHeal);
            this.advance('休整一夜，恢复了元气');
        });
        mkButton(root, '操练（全队生命上限 +3，恢复 15%）', 420, 60, 0, 160, 18, () => {
            if (done) { return; }
            done = true;
            for (const h of this.run.party) { h.maxHp += 3; h.hp += 3; }
            this.healPct(0.15);
            this.advance('彻夜操练，体魄更加强健');
        });
    }

    /** 探索事件：每个选项由队中该属性最强的角色进行 D20 检定。 */
    private showEvent(ev: EventDef) {
        const root = this.clearScreen();
        mkLabel(root, ev.title, 30, COL.gold, 0, 430);
        mkLabel(root, ev.text, 16, COL.text, 0, 380, 620);
        mkLabel(root, '每个选项由队中最擅长者执行 D20 + 属性修正 + 熟练 ≥ DC', 13, COL.dim, 0, 336);
        let done = false;
        ev.options.forEach((opt, i) => {
            const h = this.bestFor(opt);
            const bonus = mod(h.def.attrs[opt.attr]) + PROF;
            const pct = Math.round(successChance(bonus, opt.dc) * 100);
            const b = mkButton(root, opt.label, 600, 84, 0, 230 - i * 104, 18, () => {
                if (done) { return; }
                done = true;
                const c = check(bonus, opt.dc, Math.random);
                const out = c.crit && opt.crit ? opt.crit : c.success ? opt.ok : opt.fail;
                this.d20Overlay(opt.label, h, c, out, () => this.applyOutcome(out));
            });
            mkLabel(b.node, h.def.name + ' ' + ATTR_NAME[opt.attr] + signed(bonus) + ' · DC ' + opt.dc + '（' + dcName(opt.dc) + '）· 成功率约 ' + pct + '%',
                12.5, COL.gold, 0, -24);
            b.label.node.setPosition(0, 12, 0);
        });
        mkButton(root, '悄然离开', 200, 50, 0, 230 - ev.options.length * 104 - 6, 16, () => {
            if (done) { return; }
            done = true;
            this.advance('悄然离开');
        });
    }

    private bestFor(opt: EventOpt): HeroInst {
        const live = this.run.party.filter((h) => h.hp > 0);
        return live.sort((a, b) => b.def.attrs[opt.attr] - a.def.attrs[opt.attr])[0] || this.run.party[0];
    }

    private applyOutcome(o: EvOutcome) {
        const party = this.run.party;
        if (o.gold) { this.run.gold = Math.max(0, this.run.gold + o.gold); }
        if (o.healPct) { this.healPct(o.healPct); }
        if (o.dmgAll) { for (const h of party) { if (h.hp > 0) { h.hp = Math.max(1, h.hp - o.dmgAll); } } }
        if (o.dmgOne) {
            const live = party.filter((h) => h.hp > 0);
            const t = live[Math.floor(Math.random() * live.length)];
            if (t) { t.hp = Math.max(1, t.hp - o.dmgOne); }
        }
        if (o.maxHp) { for (const h of party) { h.maxHp += o.maxHp; h.hp += o.maxHp; } }
        if (o.fight) { this.startBattle(encounter('battle', this.run.stage, Math.random), 'battle'); return; }
        if (o.weapon) { this.showRewardPick(1, o.text, true); return; }
        this.advance(o.text);
    }

    /** D20 检定演出：骰面翻动后落定，显示检定式与结果，点击继续。 */
    private d20Overlay(title: string, h: HeroInst, c: CheckResult, out: EvOutcome, onDone: () => void) {
        const ov = mkPanel(this.node, 720, 1280, 0, 0, new Color(14, 10, 8, 242), 0, null, 0);
        const op = ov.node.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op).to(0.25, { opacity: 255 }).start();
        mkLabel(ov.node, title, 26, COL.gold, 0, 360, 640);
        rigIdle(buildRig(ov.node, h.def.visual, 110, -220, 120));
        mkLabel(ov.node, h.def.name + ' 进行检定', 15, COL.dim, -220, 40);
        const dn = mkNode(ov.node, 'd20', 170, 170, 40, 130);
        const dg = dn.addComponent(Graphics);
        const dl = drawD20(dg, 170, 1);
        let phase = 0;
        const tick = () => {
            if (phase !== 0 || !dn.isValid) { return; }
            drawD20(dg, 170, 1 + Math.floor(Math.random() * 20), false, dl);
            dn.angle = (Math.random() - 0.5) * 40;
        };
        const settle = () => {
            if (phase !== 0 || !dn.isValid) { return; }
            phase = 1;
            dn.angle = 0;
            drawD20(dg, 170, c.roll.nat, true, dl);
            popIn(dn, 0.3, 1.5, 1.12);
            const res = c.crit ? '大 成 功 ！' : c.fumble ? '大 失 败' : c.success ? '成 功' : '失 败';
            const lines = [res, checkText(c), out.text];
            lines.forEach((t, i) => {
                const l = mkLabel(ov.node, t, i === 0 ? 30 : 17, i === 0 ? (c.success ? COL.gold : COL.red) : COL.text, 0, -60 - i * 44, 640);
                const lo = l.node.addComponent(UIOpacity);
                lo.opacity = 0;
                tween(lo).delay(0.15 + i * 0.12).to(0.25, { opacity: 255 }).start();
            });
            mkLabel(ov.node, '点 击 继 续', 14, COL.dim, 0, -300);
        };
        this.schedule(tick, 0.08, 11);
        this.scheduleOnce(settle, 1.0);
        ov.node.on(Node.EventType.TOUCH_END, () => {
            if (phase === 0) { settle(); } else { ov.node.destroy(); onDone(); }
        });
    }

    // ---------------- 结算 ----------------

    private showSettle(victory: boolean) {
        const root = this.clearScreen();
        const run = this.run;
        const title = mkLabel(root, victory ? '天 下 已 定' : '功 败 垂 成', 44, victory ? COL.gold : COL.red, 0, 330);
        popIn(title.node, 0.45, 0.3, 1.2);
        if (run) {
            run.party.forEach((h, i) => {
                const r = buildRig(root, h.def.visual, 120, -220 + i * 220, 150);
                rigIdle(r, i * 0.2);
                mkLabel(root, h.def.name + '·' + h.def.title, 15, COL.text, -220 + i * 220, 70);
            });
            mkLabel(root, victory
                ? '四大区域尽数平定，旧朝终结。带回 ' + run.gold + ' 钱。'
                : '止步于「' + STAGES[run.stage].name + '」第 ' + (run.posRow + 1) + ' 个节点，未能带回钱财。',
            18, COL.text, 0, 10, 640);
            const ids = run.party.map((h) => h.def.id);
            mkButton(root, '再来一局（同阵容）', 260, 56, -140, -110, 18, () => this.startRun(ids));
        }
        mkButton(root, '返回营地', 220, 56, 150, -110, 18, () => this.showHome());
        mkLabel(root, '提示：重新出征时可在营地更换三人组合', 13, COL.dim, 0, -190);
        this.run = null;
    }
}
