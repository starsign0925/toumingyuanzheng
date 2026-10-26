// 烽火长歌 —— 入口组件（竖屏）：营地四选三 / 区域冒险地图 / 战斗 / 探索检定 / 战利品 / 结算
import { _decorator, Component, Node, Graphics, sys, Color, tween, Vec3, UIOpacity, HorizontalTextAlignment } from 'cc';
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

@ccclass('GameMain')
export class GameMain extends Component {
    private save: SaveData = { gold: 0, trials: {} };
    private run: RunState = null;
    private picks: string[] = ['pei', 'shen', 'ye'];
    private mapMsg = '';
    private marker: Node = null;
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

    private rowY(r: number): number {
        return -280 + r * 104;
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
        const dst = new Vec3(this.slotX(nd.slot), this.rowY(r) + 30, 0);
        const from = this.marker.position.clone();
        const st = { t: 0 };
        tween(st).to(0.55, { t: 1 }, {
            onUpdate: (_o?: unknown, k?: number) => {
                const kk = k === undefined ? st.t : k;
                const hk = (kk * 2) % 1;
                const y = Math.sin(Math.PI * hk) * 34 * (1 - kk * 0.35);
                this.marker.setPosition(from.x + (dst.x - from.x) * kk, from.y + (dst.y - from.y) * kk + y, 0);
            },
        }).call(() => {
            this.run.posRow = r;
            this.run.posCol = col;
            this.enterNode(nd.kind);
        }).start();
    }

    /** 区域主题装饰物：种子随机撒布（同区布局固定），避开节点位置。 */
    private stageOrn(stage: number): { x: number; y: number; s: number; k: number }[] {
        let seed = stage * 7919 + 13;
        const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
        const nodePts: { x: number; y: number }[] = [];
        for (let r = 0; r < 6; r++) {
            for (const s of [0, 0.5, 1.5, 2, 2.5, 3]) { nodePts.push({ x: this.slotX(s), y: this.rowY(r) }); }
        }
        const out: { x: number; y: number; s: number; k: number }[] = [];
        for (let i = 0; i < 60 && out.length < 30; i++) {
            const x = -290 + rnd() * 580, y = -290 + rnd() * 530;
            if (nodePts.some((p) => Math.abs(p.x - x) < 62 && Math.abs(p.y - y) < 62)) { continue; }
            out.push({ x, y, s: 9 + rnd() * 13, k: Math.floor(rnd() * 4) });
        }
        return out;
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

        // 顶部：三名角色状态
        run.party.forEach((h, i) => {
            const x = -230 + i * 230;
            mkLabel(root, h.def.name + '　' + Math.max(0, h.hp) + '/' + h.maxHp, 15, h.hp > 0 ? COL.gold : COL.red, x, 612);
            mkBar(root, 190, 12, x, 590).set(h.hp / h.maxHp);
            mkLabel(root, weaponName(h.weapon), 11.5, COL.dim, x, 572);
        });
        mkLabel(root, '钱 ' + run.gold + '　进度 ' + run.depth + '/24　' + STAGES[run.stage].name, 14, COL.text, 0, 546);
        if (this.mapMsg) { mkLabel(root, this.mapMsg, 14, COL.gold, 0, 520, 680); }
        mkButton(root, '撤退', 160, 46, -265, -600, 16, () => { this.finishRun(false); this.showHome(); });
        mkLabel(root, '点击发光节点前进，走过无法回头；撤退不带回钱', 12, COL.dim, 90, -600);
        mkLabel(root, '本章目标：' + STAGES[run.stage].goal, 13, COL.dim, 0, -545, 680);

        // 地图
        const mapRoot = mkNode(root, 'map', 0, 0, 0, -40);
        const st = STAGES[run.stage];
        const bg = mkNode(mapRoot, 'bands', 620, 640, 0, 0).addComponent(Graphics);
        bg.fillColor = new Color(st.color[0], st.color[1], st.color[2], 255);
        bg.roundRect(-310, -306, 620, 560, 18);
        bg.fill();
        bg.fillColor = new Color(255, 255, 255, 70);
        for (const d of run.deco) { bg.circle(d.x * 0.9, d.y - 40, d.r); bg.fill(); }
        for (const o of this.stageOrn(run.stage)) { this.drawOrn(bg, run.stage, o.x, o.y, o.s, o.k); }
        mkLabel(mapRoot, '第 ' + (run.stage + 1) + ' 章 · ' + st.short, 19, new Color(226, 210, 180, 255), 218, 232);

        const lg = mkNode(mapRoot, 'links', 0, 0, 0, 0).addComponent(Graphics);
        for (let r = 0; r < run.map.length - 1; r++) {
            const cur = run.map[r], nxt = run.map[r + 1];
            for (let i = 0; i < cur.length; i++) {
                for (const j of cur[i].links) {
                    const used = cur[i].done && nxt[j].done;
                    lg.lineWidth = used ? 5 : 3.5;
                    lg.strokeColor = used ? COL.gold : new Color(110, 90, 70, 150);
                    lg.moveTo(this.slotX(cur[i].slot), this.rowY(r));
                    lg.lineTo(this.slotX(nxt[j].slot), this.rowY(r + 1));
                    lg.stroke();
                }
            }
        }
        if (run.posRow < 0) {
            lg.lineWidth = 3;
            lg.strokeColor = new Color(110, 90, 70, 130);
            for (const n of run.map[0]) { lg.moveTo(0, -360); lg.lineTo(this.slotX(n.slot), this.rowY(0)); lg.stroke(); }
        }

        for (let r = 0; r < run.map.length; r++) {
            const row = run.map[r];
            for (let i = 0; i < row.length; i++) {
                const nd = row[i];
                const state = nd.done ? 'done'
                    : (r === run.posRow && i === run.posCol) ? 'cur'
                        : this.reachable(r, i) ? 'next' : 'far';
                const n = mkNode(mapRoot, 'n' + r + '_' + i, 60, 60, this.slotX(nd.slot), this.rowY(r));
                this.drawMapNode(n.addComponent(Graphics), nd.kind, state);
                if (state === 'far') { n.addComponent(UIOpacity).opacity = 95; }
                if (state === 'next') {
                    tween(n).repeatForever(tween(n).to(0.55, { scale: new Vec3(1.12, 1.12, 1) }).to(0.55, { scale: Vec3.ONE })).start();
                    const rr = r, ii = i;
                    n.on(Node.EventType.TOUCH_END, () => this.travelTo(rr, ii));
                }
                popIn(n, 0.28, 0.3, 1.1, r * 0.05);
                mkLabel(n, NODE_NAME[nd.kind], 11.5, state === 'far' ? COL.dim : COL.text, 0, -38);
            }
        }

        // 队伍标记（领队）
        this.marker = mkNode(mapRoot, 'marker', 54, 80, 0, 0);
        rigIdle(buildRig(this.marker, run.party[0].def.visual, 68, 0, 0));
        if (run.posRow < 0) {
            this.marker.setPosition(0, -360, 0);
            mkLabel(mapRoot, '▼ 出发', 14, COL.dim, 0, -396);
        } else {
            this.marker.setPosition(this.slotX(run.map[run.posRow][run.posCol].slot), this.rowY(run.posRow) + 30, 0);
        }
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
