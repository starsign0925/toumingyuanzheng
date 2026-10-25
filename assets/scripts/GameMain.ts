// 骰命远征 —— 入口组件（竖屏单人冒险）：营地 / 选人 / 地图 / 事件 / 宝箱 / 奖励 / 结算
import { _decorator, Component, Node, Label, Graphics, sys, Color, tween, Vec3, UIOpacity, BlockInputEvents } from 'cc';
import {
    HEROES, NORMAL_ENEMIES, ELITES, STAGES, EVENTS, RULES,
    NODE_NAME, heroById, COLUMN_X, makeHero, starterDeck, rewardOptions, cardById,
    fateTier, fateBattleEntry, fateLines, scaleEnemy,
} from './Data';
import type {
    HeroInst, EnemyDef, EventDef, NodeKind, MapNode, RunState, SaveData, BattleEntry,
} from './Data';
import {
    COL, mkNode, mkLabel, mkPanel, mkButton, setBtnEnabled, drawPanel,
    drawDie, bob, drawNodeIcon, popIn, mkCard, mkBar,
} from './UI';
import { BattleScreen } from './BattleScreen';
import { buildRig, rigIdle } from './Figures';

const { ccclass } = _decorator;

const SAVE_KEY = 'dfx_save_v1';
const START_OWNED = ['astro', 'bulwark', 'gambler'];

@ccclass('GameMain')
export class GameMain extends Component {
    private save: SaveData = { gold: 0, owned: START_OWNED.slice(), trials: {} };
    private run: RunState = null;
    private pick: string = null;
    private mapMsg = '';
    private autoBattle = false;
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
        const dragon = buildRig(ov, 'boss', 230, 130, 150, true);
        rigIdle(dragon);
        popIn(dragon.root, 0.5, 0.2, 1.1, 0.3);
        ['bulwark', 'astro', 'cleric'].forEach((id, i) => {
            const r = buildRig(ov, id, 110, -230 + i * 80, -240 - i * 10);
            rigIdle(r, i * 0.2);
            popIn(r.root, 0.4, 0.2, 1.15, 0.5 + i * 0.12);
        });
        const dn = mkNode(ov, 'die', 120, 120, 0, 340);
        drawDie(dn.addComponent(Graphics), 120, { value: 5 });
        tween(dn).repeatForever(tween(dn).by(0.5, { angle: 180 })).start();
        bob(dn, 16, 0.45);
        const t1 = mkLabel(ov, '骰 命 远 征', 60, COL.gold, 0, -80);
        const t2 = mkLabel(ov, '骰子决定当下，英雄决定你怎样利用结果', 17, COL.dim, 0, -140);
        const hint = mkLabel(ov, '点击任意处进入', 15, new Color(160, 140, 115, 255), 0, -480);
        const o1 = t1.node.addComponent(UIOpacity); o1.opacity = 0;
        const o2 = t2.node.addComponent(UIOpacity); o2.opacity = 0;
        const o3 = hint.node.addComponent(UIOpacity); o3.opacity = 0;
        t1.node.setScale(2.4, 0.2, 1);
        tween(t1.node).to(0.5, { scale: Vec3.ONE }).start();
        tween(o1).to(0.4, { opacity: 255 }).start();
        tween(o2).delay(0.5).to(0.4, { opacity: 255 }).start();
        tween(o3).delay(0.9).to(0.3, { opacity: 255 }).start();
        tween(o3).delay(1.4).repeatForever(
            tween(o3).to(0.5, { opacity: 90 }).to(0.5, { opacity: 255 })).start();
        const ovOp = ov.addComponent(UIOpacity);
        let closed = false;
        const close = () => {
            if (closed) { return; }
            closed = true;
            tween(ovOp).to(0.35, { opacity: 0 }).call(() => ov.destroy()).start();
        };
        bg.node.once(Node.EventType.TOUCH_END, close);
        this.scheduleOnce(close, 3.0);
    }

    // ---------------- 存档 ----------------

    private load() {
        try {
            const raw = sys.localStorage.getItem(SAVE_KEY);
            if (raw) {
                const d = JSON.parse(raw);
                if (d && typeof d.gold === 'number' && Array.isArray(d.owned)) {
                    this.save = {
                        gold: d.gold, owned: d.owned.filter((id) => !!heroById(id)),
                        trials: d.trials && typeof d.trials === 'object' ? d.trials : {},
                    };
                    if (this.save.owned.length === 0) { this.save.owned = START_OWNED.slice(); }
                    return;
                }
            }
        } catch (e) { /* 存档损坏则用默认 */ }
        this.save = { gold: 0, owned: START_OWNED.slice(), trials: {} };
    }

    private store() {
        sys.localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    }

    private clearScreen(): Node {
        this.node.removeAllChildren();
        return mkPanel(this.node, 720, 1280, 0, 0, COL.bg, 0, null, 0).node;
    }

    // ---------------- 营地 ----------------

    private showHome() {
        const root = this.clearScreen();
        this.run = null;
        if (!this.pick || this.save.owned.indexOf(this.pick) < 0) {
            this.pick = this.save.owned[0];
        }

        mkLabel(root, '骰 命 远 征', 54, COL.gold, 0, 570);
        mkLabel(root, '骰子决定当下，英雄决定你怎样利用结果', 16, COL.dim, 0, 526);
        mkLabel(root, '金币：' + this.save.gold + '　英雄：' + this.save.owned.length + '/' + HEROES.length,
            17, COL.text, 0, 490);

        // 英雄名册：点选一名英雄出征
        mkLabel(root, '—— 选择一名英雄出征 ——', 18, COL.gold, 0, 450);
        const cardW = 330, cardH = 158, gapY = 12;
        const btns: { [id: string]: Node } = {};
        for (let i = 0; i < HEROES.length; i++) {
            const def = HEROES[i];
            const col = i % 2, rowIdx = Math.floor(i / 2);
            const x = -170 + col * 340;
            const y = 380 - rowIdx * (cardH + gapY);
            const owned = this.save.owned.indexOf(def.id) >= 0;
            const p = mkPanel(root, cardW, cardH, x, y,
                owned ? COL.panel : COL.btnOff, 8, COL.border, 2);
            const c = def.color;
            mkPanel(p.node, cardW, 26, 0, cardH / 2 - 13,
                owned ? new Color(c[0], c[1], c[2], 255) : new Color(60, 52, 46, 255), 6, null, 0);
            mkLabel(p.node, def.name + '·' + def.title + '　HP ' + def.maxHp, 16,
                new Color(255, 255, 255, 255), 0, cardH / 2 - 13);
            const r = buildRig(p.node, def.id, 92, -108, -18);
            rigIdle(r, i * 0.1);
            if (!owned) { r.root.addComponent(UIOpacity).opacity = 70; }
            const t = (this.save.trials || {})[def.id];
            mkLabel(p.node, def.passive, 11.5, COL.dim, 36, 8, 170);
            mkLabel(p.node, owned ? (t ? '远征战绩 ' + t.clears + '/' + t.runs : '尚未出征')
                : '未招募', 12, owned ? COL.gold : COL.dim, 36, -44);
            if (owned) {
                p.node.on(Node.EventType.TOUCH_END, () => {
                    this.pick = def.id;
                    this.showHome();
                });
            }
            btns[def.id] = p.node;
        }
        // 选中描边
        for (const id of Object.keys(btns)) {
            if (id === this.pick) {
                drawPanel(btns[id].getComponent(Graphics), cardW, cardH, COL.panelLight, 8, COL.gold, 3);
            }
        }

        const go = mkButton(root, '开始远征', 300, 62, -170, -470, 24, () => this.startRun(this.pick));
        setBtnEnabled(go, !!this.pick, 300, 62);
        const canRecruit = this.save.owned.length < HEROES.length && this.save.gold >= RULES.recruitCost;
        const rec = mkButton(root,
            this.save.owned.length >= HEROES.length ? '已集齐英雄' : '招募(' + RULES.recruitCost + '金)',
            300, 62, 170, -470, 20, () => this.onRecruit());
        setBtnEnabled(rec, canRecruit, 300, 62);
        mkLabel(root, '战斗：掷骰后把骰子放进卡牌触发效果，牌组随战利品成长。', 13, COL.dim, 0, -560);
    }

    private onRecruit() {
        const pool = HEROES.filter((h) => this.save.owned.indexOf(h.id) < 0);
        if (pool.length === 0 || this.save.gold < RULES.recruitCost) { return; }
        this.save.gold -= RULES.recruitCost;
        const got = pool[Math.floor(Math.random() * pool.length)];
        this.save.owned.push(got.id);
        this.store();
        const overlay = mkPanel(this.node, 440, 360, 0, 0, COL.panelLight, 12, COL.gold, 3);
        popIn(overlay.node, 0.35, 0.4, 1.12);
        mkLabel(overlay.node, '招募成功！', 26, COL.gold, 0, 150);
        const r = buildRig(overlay.node, got.id, 120, 0, 60);
        rigIdle(r);
        mkLabel(overlay.node, got.name + '·' + got.title, 20, COL.text, 0, -30);
        mkLabel(overlay.node, got.passive, 13, COL.dim, 0, -70, 400);
        mkButton(overlay.node, '太好了', 160, 48, 0, -140, 18, () => {
            overlay.node.destroy();
            this.showHome();
        });
    }

    // ---------------- 远征 ----------------

    private startRun(heroId: string) {
        const def = heroById(heroId);
        const deco: { x: number; y: number; r: number }[] = [];
        for (let i = 0; i < 40; i++) {
            deco.push({ x: -270 + Math.random() * 540, y: -360 + Math.random() * 780, r: 1 + Math.random() * 2.2 });
        }
        this.run = {
            hero: makeHero(def),
            deck: starterDeck(def),
            gold: 0,
            buffs: { extraDie: 0 },
            map: this.genMap(),
            posRow: -1,
            posCol: -1,
            depth: 0,
            stage: 0,
            deco,
        };
        this.mapMsg = '远征开始！点击发光节点沿路线前进';
        this.showMap();
    }

    private genMap(): MapNode[][] {
        const pool: NodeKind[] = ['battle', 'battle', 'battle', 'battle',
            'elite', 'elite', 'treasure', 'event', 'rest'];
        const pick = () => pool[Math.floor(Math.random() * pool.length)];
        // 三条路线：各自独立的槽位走廊（互不重叠），行间默认只沿本线前进
        const LANES: number[][] = [[0, 0.5], [1.5, 2], [2.5, 3]];
        const map: MapNode[][] = [];
        for (let r = 0; r < 5; r++) {
            map.push(LANES.map((slots) => ({
                kind: pick(),
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
                this.marker.setPosition(from.x + (dst.x - from.x) * kk,
                    from.y + (dst.y - from.y) * kk + y, 0);
            },
        }).call(() => {
            this.run.posRow = r;
            this.run.posCol = col;
            this.enterNode(nd.kind);
        }).start();
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
            g.moveTo(-11, 0);
            g.lineTo(-3, -9);
            g.lineTo(12, 9);
            g.stroke();
        }
    }

    private showMap() {
        const root = this.clearScreen();
        const run = this.run;
        this.mapBusy = false;
        const hero = run.hero;

        // 顶部状态栏
        mkLabel(root, hero.def.name + '　HP ' + Math.ceil(hero.hp) + '/' + hero.maxHp,
            20, COL.gold, 0, 605);
        this.hpBar = mkBar(root, 300, 16, -160, 575);
        this.hpBar.set(hero.hp / hero.maxHp);
        mkLabel(root, '金币 ' + run.gold + '　牌组 ' + run.deck.length + '　进度 ' + run.depth, 14, COL.text, 160, 575);
        if (this.mapMsg) { mkLabel(root, this.mapMsg, 14, COL.gold, 0, 545); }
        mkLabel(root, '牌组内容：' + run.deck.map((c) => cardById(c).name).join(' '), 11, COL.dim, 0, -545, 660);
        mkButton(root, '撤退(保留金币)', 190, 46, -250, -600, 16, () => {
            this.finishRun(false);
            this.showHome();
        });
        mkLabel(root, '点击发光节点前进，走过无法回头', 12, COL.dim, 160, -600);

        // 地图容器（每关一种底色 + 关卡名）
        const mapRoot = mkNode(root, 'map', 0, 0, 0, -40);
        const st = STAGES[run.stage];
        const bg = mkNode(mapRoot, 'bands', 620, 640, 0, 0).addComponent(Graphics);
        bg.fillColor = new Color(st.color[0], st.color[1], st.color[2], 255);
        bg.roundRect(-310, -306, 620, 560, 18);
        bg.fill();
        bg.fillColor = new Color(255, 255, 255, 70);
        for (const d of run.deco) { bg.circle(d.x * 0.9, d.y - 40, d.r); bg.fill(); }
        mkLabel(mapRoot, '第 ' + (run.stage + 1) + ' 关 · ' + st.name,
            19, new Color(226, 210, 180, 255), 218, 232);

        // 连线
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
            for (const n of run.map[0]) {
                lg.moveTo(0, -360);
                lg.lineTo(this.slotX(n.slot), this.rowY(0));
                lg.stroke();
            }
        }

        // 节点
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
                    tween(n).repeatForever(
                        tween(n).to(0.55, { scale: new Vec3(1.12, 1.12, 1) }).to(0.55, { scale: Vec3.ONE })).start();
                    const rr = r, ii = i;
                    n.on(Node.EventType.TOUCH_END, () => this.travelTo(rr, ii));
                }
                popIn(n, 0.28, 0.3, 1.1, r * 0.05);
                mkLabel(n, NODE_NAME[nd.kind], 11.5, state === 'far' ? COL.dim : COL.text, 0, -38);
            }
        }

        // 英雄标记
        this.marker = mkNode(mapRoot, 'marker', 54, 80, 0, 0);
        const mr = buildRig(this.marker, hero.def.id, 68, 0, 0);
        rigIdle(mr);
        if (run.posRow < 0) {
            this.marker.setPosition(0, -360, 0);
            mkLabel(mapRoot, '▼ 出发', 14, COL.dim, 0, -396);
        } else {
            this.marker.setPosition(this.slotX(run.map[run.posRow][run.posCol].slot), this.rowY(run.posRow) + 30, 0);
        }
    }

    private hpBar = null;

    private enterNode(kind: NodeKind) {
        const roll = 1 + Math.floor(Math.random() * 6);
        const tier = fateTier(roll);
        this.rollOverlay('命运掷骰 · ' + NODE_NAME[kind], roll, fateLines(kind, tier), () => {
            this.enterNodeContent(kind, tier);
        });
    }

    private enterNodeContent(kind: NodeKind, tier: number) {
        switch (kind) {
            case 'battle':
                this.startBattle(scaleEnemy(
                    NORMAL_ENEMIES[Math.floor(Math.random() * NORMAL_ENEMIES.length)], this.run.stage),
                    fateBattleEntry(kind, tier));
                break;
            case 'elite':
                this.startBattle(scaleEnemy(
                    ELITES[Math.floor(Math.random() * ELITES.length)], this.run.stage),
                    fateBattleEntry(kind, tier));
                break;
            case 'boss': this.startBattle(STAGES[this.run.stage].boss, fateBattleEntry(kind, tier)); break;
            case 'treasure': this.showTreasure(tier); break;
            case 'event': this.showEvent(EVENTS[Math.floor(Math.random() * EVENTS.length)], tier); break;
            case 'rest': this.showRest(tier); break;
        }
    }

    /** 掷骰演出浮层：骰子翻滚后停在目标点数，显示结果文案，点击继续。 */
    private rollOverlay(title: string, roll: number, lines: string[], onDone: () => void) {
        const ov = mkPanel(this.node, 720, 1280, 0, 0, new Color(14, 10, 8, 242), 0, null, 0);
        ov.node.addComponent(BlockInputEvents);
        const op = ov.node.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op).to(0.25, { opacity: 255 }).start();
        mkLabel(ov.node, title, 30, COL.gold, 0, 340);
        const dn = mkNode(ov.node, 'fdie', 150, 150, 0, 80);
        const dg = dn.addComponent(Graphics);
        drawDie(dg, 150, { value: 1 });
        let phase = 0;
        const tick = () => {
            if (phase !== 0) { return; }
            drawDie(dg, 150, { value: 1 + Math.floor(Math.random() * 6) });
            dn.angle = (Math.random() - 0.5) * 30;
        };
        const settle = () => {
            if (phase !== 0) { return; }
            phase = 1;
            dn.angle = 0;
            drawDie(dg, 150, { value: roll, sel: true });
            popIn(dn, 0.3, 1.5, 1.12);
            for (let i = 0; i < lines.length; i++) {
                const l = mkLabel(ov.node, lines[i], i === 0 ? 24 : 16,
                    i === 0 ? COL.gold : COL.text, 0, -50 - i * 36);
                const lo = l.node.addComponent(UIOpacity);
                lo.opacity = 0;
                tween(lo).delay(0.15 + i * 0.1).to(0.25, { opacity: 255 }).start();
            }
            const hint = mkLabel(ov.node, '点 击 继 续', 14, COL.dim, 0, -280);
            const ho = hint.node.addComponent(UIOpacity);
            ho.opacity = 0;
            tween(ho).delay(0.5).to(0.3, { opacity: 200 }).start();
        };
        this.schedule(tick, 0.09, 9);
        this.scheduleOnce(settle, 0.95);
        ov.node.on(Node.EventType.TOUCH_END, () => {
            if (phase === 0) { settle(); } else { ov.node.destroy(); onDone(); }
        });
    }

    private startBattle(enemy: EnemyDef, entry?: BattleEntry) {
        const root = this.clearScreen();
        const bn = mkNode(root, 'battle', 0, 0, 0, 0);
        const bs = bn.addComponent(BattleScreen);
        bs.init(this.run.hero, this.run.deck, enemy, this.run.buffs, (won, gold) => {
            bn.destroy();
            if (!won) {
                this.finishRun(false);
                this.showSettle(false);
                return;
            }
            this.run.gold += gold;
            if (this.run.hero.def.id === 'cleric') {
                this.run.hero.hp = Math.min(this.run.hero.maxHp, this.run.hero.hp + RULES.clericWinHeal);
            }
            const node = this.run.map[this.run.posRow][this.run.posCol];
            if (node.kind === 'boss') {
                this.advance('胜利！');
            } else {
                this.rewardRoll(enemy, gold);
            }
        }, this.autoBattle, entry);
    }

    private advance(msg: string) {
        const nd = this.run.map[this.run.posRow][this.run.posCol];
        nd.done = true;
        this.run.depth++;
        this.mapMsg = msg;
        if (nd.kind === 'boss') {
            if (this.run.stage >= STAGES.length - 1) {
                this.finishRun(true);
                this.showSettle(true);
            } else {
                this.run.stage++;
                this.run.map = this.genMap();
                this.run.posRow = -1;
                this.run.posCol = -1;
                this.healPct(0.4);
                this.mapMsg = '凯旋！进入第 ' + (this.run.stage + 1) + ' 关（恢复 40% 生命）';
                this.showMap();
            }
        } else {
            this.showMap();
        }
    }

    /** 一局结束：存金币 + 记录该英雄战绩。 */
    private finishRun(cleared: boolean) {
        const run = this.run;
        if (!run) { return; }
        this.save.gold += run.gold;
        if (!this.save.trials) { this.save.trials = {}; }
        const id = run.hero.def.id;
        const t = this.save.trials[id] || { runs: 0, clears: 0 };
        t.runs++;
        if (cleared) { t.clears++; }
        this.save.trials[id] = t;
        this.store();
    }

    // ---------------- 节点内容 ----------------

    /** 战后奖励掷骰：1-3 普通卡选 1 张 / 4-5 普通卡选 2 张 / 6 稀有卡池选 1 张（精英升一档）。 */
    private rewardRoll(enemy: EnemyDef, gold: number) {
        const roll = 1 + Math.floor(Math.random() * 6);
        let tier = fateTier(roll);
        if (enemy.elite && tier < 3) { tier += 1; }
        const lines = [
            tier === 3 ? '大吉！稀有卡池开启' : tier === 2 ? '好运！可挑选两张' : '普通战利品',
            '+' + gold + ' 金币已入袋',
        ];
        this.rollOverlay('战利品掷骰', roll, lines, () => this.showRewardPick(tier, gold));
    }

    private showRewardPick(tier: number, gold: number) {
        const root = this.clearScreen();
        const pickN = tier === 2 ? 2 : 1;
        mkLabel(root, '胜利！获得 ' + gold + ' 金币', 30, COL.gold, 0, 420);
        mkLabel(root, '选择 ' + pickN + ' 张卡牌加入牌组（也可跳过）', 17, COL.dim, 0, 380);
        this.cardPick(0, rewardOptions(this.run.hero.def.id, Math.random, tier === 3), pickN, (ids) => {
            for (const id of ids) { this.run.deck.push(id); }
            this.advance('胜利！+' + gold + ' 金' + (ids.length
                ? '，获得 ' + ids.map((i) => '「' + cardById(i).name + '」').join('') : ''));
        });
    }

    /** 选卡界面：从 options 中选 picks 张（已选的会变暗）。onPick(ids) 可能为空（跳过）。 */
    private cardPick(y0: number, options: string[], picks: number, onPick: (ids: string[]) => void) {
        const root = this.node.children[this.node.children.length - 1];
        const gap = 170;
        const chosen: string[] = [];
        let done = false;
        for (let i = 0; i < options.length; i++) {
            const def = cardById(options[i]);
            const v = mkCard(root, def, -gap + i * gap, y0 + 30, 150, 210);
            v.node.on(Node.EventType.TOUCH_END, () => {
                if (done || chosen.indexOf(options[i]) >= 0) { return; }
                chosen.push(options[i]);
                v.node.addComponent(UIOpacity).opacity = 110;
                popIn(v.node, 0.15, 0.9, 1.05);
                if (chosen.length >= picks) {
                    done = true;
                    this.scheduleOnce(() => onPick(chosen.slice()), 0.3);
                }
            });
        }
        mkButton(root, '跳过', 180, 52, 0, y0 - 170, 18, () => {
            if (done) { return; }
            done = true;
            onPick(chosen.slice());
        });
    }

    private showTreasure(tier: number) {
        const root = this.clearScreen();
        mkLabel(root, '神秘宝箱', 30, COL.gold, 0, 380);
        mkLabel(root, '箱盖刻满骰纹，里面传来清脆的碰撞声。', 16, COL.text, 0, 340, 600);
        const goldAmt = tier === 3 ? 150 : tier === 2 ? 100 : 60;
        const healPct = tier === 3 ? 0.5 : tier === 2 ? 0.35 : 0.2;
        const opts: { label: string; apply: () => void }[] = [
            { label: '拿走金币（+' + goldAmt + '）', apply: () => { this.run.gold += goldAmt; this.advance('开箱获得 ' + goldAmt + ' 金币'); } },
            { label: '翻找珍奇（获得一张稀有卡）', apply: () => this.showCardReward() },
            { label: '供奉骰运（恢复 ' + Math.round(healPct * 100) + '% 生命）', apply: () => { this.healPct(healPct); this.advance('获得祝福，恢复了生命'); } },
        ];
        for (let i = 0; i < opts.length; i++) {
            mkButton(root, opts[i].label, 380, 56, 0, 200 - i * 76, 18, opts[i].apply);
        }
    }

    private showCardReward() {
        const root = this.clearScreen();
        mkLabel(root, '珍奇卡牌', 30, COL.gold, 0, 420);
        mkLabel(root, '选择一张加入牌组', 17, COL.dim, 0, 380);
        this.cardPick(0, rewardOptions(this.run.hero.def.id, Math.random, true), 1, (ids) => {
            const id = ids[0];
            if (id) { this.run.deck.push(id); }
            this.advance(id ? '获得「' + cardById(id).name + '」' : '空手而返');
        });
    }

    private healPct(pct: number) {
        const h = this.run.hero;
        if (h.hp > 0) { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * pct); }
    }

    private showEvent(ev: EventDef, tier: number) {
        const root = this.clearScreen();
        mkLabel(root, ev.title, 28, COL.gold, 0, 400);
        mkLabel(root, ev.text, 16, COL.text, 0, 350, 600);
        const mult = tier === 3 ? 2 : tier === 2 ? 1.5 : 1;
        const rareCost = Math.round(30 / mult);
        for (let i = 0; i < ev.options.length; i++) {
            const opt = ev.options[i];
            const canPay = !(opt.apply === 'buyrare' && this.run.gold < rareCost);
            const label = tier > 1
                ? opt.apply === 'buyrare' ? '投入 ' + rareCost + ' 金币（获得一张稀有卡）'
                    : opt.apply === 'gold45' ? '拾取星屑（+' + Math.round(45 * mult) + ' 金币）'
                        : opt.label
                : opt.label;
            const ob = mkButton(root, label, 480, 60, 0, 240 - i * 80, 17, () => {
                if (!canPay) { return; }
                switch (opt.apply) {
                    case 'gold45': this.run.gold += Math.round(45 * mult); this.advance('拾得 ' + Math.round(45 * mult) + ' 金币'); break;
                    case 'heal25': this.healPct(0.25 * mult); this.advance('星光抚平了伤口'); break;
                    case 'heal20': this.healPct(0.2 * mult); this.advance('井水沁人心脾'); break;
                    case 'blooddie':
                        this.run.hero.hp = Math.max(1, this.run.hero.hp - this.run.hero.maxHp * 0.15 / mult);
                        this.run.buffs.extraDie++;
                        this.advance('以血换运：每回合 +1 骰子');
                        break;
                    case 'buyrare':
                        this.run.gold -= rareCost;
                        this.showCardReward();
                        break;
                    default: this.advance('悄然离开');
                }
            });
            setBtnEnabled(ob, canPay, 480, 60);
        }
    }

    private showRest(tier: number) {
        const root = this.clearScreen();
        mkLabel(root, '营火', 30, COL.gold, 0, 400);
        mkLabel(root, '火光摇曳，骰子在掌心温热。', 16, COL.text, 0, 350);
        const heal = tier === 3 ? 0.6 : tier === 2 ? 0.45 : RULES.restHealPct;
        mkButton(root, '休息（恢复 ' + Math.round(heal * 100) + '% 生命）', 380, 60, 0, 240, 18, () => {
            this.healPct(heal);
            this.advance('营火旁休整，恢复了生命');
        });
        mkButton(root, '磨砺技艺（移除一张牌' + (tier === 3 ? '，恢复 15%' : '') + '）',
            380, 60, 0, 160, 18, () => {
                if (tier === 3) { this.healPct(0.15); }
                this.showRemoveCard();
            });
    }

    /** 删牌界面：展示整个牌组，点一张删除。 */
    private showRemoveCard() {
        const root = this.clearScreen();
        mkLabel(root, '选择一张牌移除', 28, COL.gold, 0, 540);
        const deck = this.run.deck;
        const cols = 4, cw = 160, ch = 220;
        for (let i = 0; i < deck.length; i++) {
            const def = cardById(deck[i]);
            const col = i % cols, row = Math.floor(i / cols);
            const x = -(cols - 1) * cw / 2 + col * cw;
            const y = 400 - row * ch;
            const v = mkCard(root, def, x, y, 140, 200);
            const idx = i;
            v.node.on(Node.EventType.TOUCH_END, () => {
                deck.splice(idx, 1);
                this.advance('移除了「' + def.name + '」，牌组更精练');
            });
        }
        mkButton(root, '算了', 180, 52, 0, -500, 18, () => this.advance('在营火旁休息片刻'));
    }

    // ---------------- 结算 ----------------

    private showSettle(victory: boolean) {
        const root = this.clearScreen();
        const run = this.run;
        const def = run ? run.hero.def : null;
        const title = mkLabel(root, victory ? '远征凯旋！' : '远征失败……', 40,
            victory ? COL.gold : COL.red, 0, 300);
        popIn(title.node, 0.45, 0.3, 1.2);
        if (def) {
            const r = buildRig(root, def.id, 150, 0, 120);
            rigIdle(r);
        }
        const t = def ? (this.save.trials || {})[def.id] : null;
        mkLabel(root, run ? (victory
            ? '四关全破，骰命魔龙的骰子归于沉寂。带回金币 ' + run.gold
            : def.name + ' 止步于第 ' + (run.stage + 1) + ' 关第 ' + (run.posRow + 1)
                + ' 个节点，带回金币 ' + run.gold) : '',
            18, COL.text, 0, -20);
        if (t) {
            mkLabel(root, '该英雄远征战绩：' + t.clears + '/' + t.runs + ' 通关（' +
                Math.round(100 * t.clears / Math.max(1, t.runs)) + '%）', 15, COL.dim, 0, -60);
        }
        if (def) {
            mkButton(root, '再来一局', 200, 56, -120, -160, 20, () => {
                this.pick = def.id;
                this.startRun(def.id);
            });
        }
        mkButton(root, '返回营地', 200, 56, 120, -160, 20, () => this.showHome());
        this.run = null;
    }
}
