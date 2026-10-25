"use strict";
// 骰命远征 —— 数据与类型定义（单人冒险 · 骰子 × 卡牌）
// 战斗规则：每回合掷骰并抽牌，把骰子放进卡牌的骰槽来触发效果（X = 骰子点数）。
Object.defineProperty(exports, "__esModule", { value: true });
exports.NODE_NAME = exports.RULES = exports.COLUMN_X = exports.EVENTS = exports.BOSS = exports.ELITES = exports.NORMAL_ENEMIES = exports.HEROES = exports.CARDS = exports.SLOT_TEXT = void 0;
exports.cardById = cardById;
exports.slotOk = slotOk;
exports.makeHero = makeHero;
exports.heroById = heroById;
exports.starterDeck = starterDeck;
exports.rewardOptions = rewardOptions;
exports.fateTier = fateTier;
exports.fateBattleEntry = fateBattleEntry;
exports.fateLines = fateLines;
exports.SLOT_TEXT = {
    any: '任意', min4: '≥4', max3: '≤3', odd: '奇数', even: '偶数', six: '6', none: '—',
};
exports.CARDS = [
    // —— 基础 ——
    { id: 'strike', name: '斩击', slot: 'any', type: 'attack', desc: '造成 X 点伤害' },
    { id: 'defend', name: '格挡', slot: 'any', type: 'skill', desc: '获得 X 点护甲' },
    // —— 通用 ——
    { id: 'heavy', name: '重劈', slot: 'min4', type: 'attack', desc: '造成 2X 点伤害' },
    { id: 'jab', name: '快刺', slot: 'max3', type: 'attack', desc: '造成 X+4 点伤害' },
    { id: 'twin', name: '双击', slot: 'even', type: 'attack', desc: '造成 X 点伤害 2 次' },
    { id: 'guard', name: '铁壁', slot: 'max3', type: 'skill', desc: '获得 X+5 点护甲' },
    { id: 'reroll', name: '重掷', slot: 'any', type: 'dice', desc: '重掷这颗骰子' },
    { id: 'hone', name: '磨砺', slot: 'any', type: 'dice', desc: '骰子点数 +2（最高 6）' },
    { id: 'flip', name: '翻转', slot: 'any', type: 'dice', desc: '骰子变为 7-X' },
    { id: 'split', name: '分裂', slot: 'min4', type: 'dice', desc: '拆成两颗骰子：X÷2 向下与向上取整' },
    { id: 'leech', name: '汲取', slot: 'any', type: 'attack', desc: '造成 X 点伤害，回复一半', rare: true },
    { id: 'lucky', name: '幸运币', slot: 'none', type: 'dice', desc: '获得一颗新骰子', rare: true },
    // —— 职业 ——
    { id: 'starfall', name: '星落', slot: 'none', type: 'dice', desc: '重掷所有骰子', hero: 'astro' },
    { id: 'starlight', name: '星辉', slot: 'odd', type: 'attack', desc: '造成 X+4 点伤害，抽 1 张牌', hero: 'astro' },
    { id: 'shieldbash', name: '盾击', slot: 'any', type: 'attack', desc: '造成 X + 当前护甲÷2 点伤害', hero: 'bulwark' },
    { id: 'bigshield', name: '重盾', slot: 'min4', type: 'skill', desc: '获得 2X 点护甲', hero: 'bulwark' },
    { id: 'allin', name: '孤注一掷', slot: 'any', type: 'attack', desc: '重掷此骰并造成新点数伤害；若为 5-6 则伤害×3', hero: 'gambler' },
    { id: 'coin', name: '幸运币', slot: 'none', type: 'dice', desc: '获得一颗新骰子', hero: 'gambler' },
    { id: 'venom', name: '毒瓶', slot: 'any', type: 'attack', desc: '给予 X÷2+1 层中毒（向上取整）', hero: 'alch' },
    { id: 'transmute', name: '嬗变', slot: 'any', type: 'dice', desc: '骰子变为 7-X，抽 1 张牌', hero: 'alch' },
    { id: 'stab2', name: '连刺', slot: 'odd', type: 'attack', desc: '造成 X 点伤害 2 次', hero: 'shadow' },
    { id: 'shadowstep', name: '暗影步', slot: 'max3', type: 'skill', desc: '获得 X+3 点护甲，抽 1 张牌', hero: 'shadow' },
    { id: 'judgment', name: '审判', slot: 'min4', type: 'attack', desc: '造成 2X 点伤害，回复 2 点生命', hero: 'cleric' },
    { id: 'holylight', name: '圣光', slot: 'even', type: 'attack', desc: '造成 X 点伤害，回复 X÷2', hero: 'cleric' },
    { id: 'fireball', name: '火球', slot: 'six', type: 'attack', desc: '造成 16 点伤害', hero: 'pyro' },
    { id: 'ignite', name: '引燃', slot: 'any', type: 'dice', desc: '骰子点数 +3（最高 6）', hero: 'pyro' },
    { id: 'replicate', name: '复刻', slot: 'any', type: 'dice', desc: '复制这颗骰子', hero: 'tinker' },
    { id: 'gearshot', name: '齿轮炮', slot: 'max3', type: 'attack', desc: '造成 X+2 点伤害 2 次', hero: 'tinker' },
];
function cardById(id) {
    return exports.CARDS.find((c) => c.id === id);
}
function slotOk(slot, v) {
    switch (slot) {
        case 'any': return true;
        case 'min4': return v >= 4;
        case 'max3': return v <= 3;
        case 'odd': return v % 2 === 1;
        case 'even': return v % 2 === 0;
        case 'six': return v === 6;
        case 'none': return false;
    }
    return false;
}
function makeHero(def) {
    return { def, hp: def.maxHp, maxHp: def.maxHp };
}
exports.HEROES = [
    { id: 'astro', name: '占星师', title: '观星者', maxHp: 76, color: [142, 124, 195],
        passive: '回合开始时，自动重掷所有 1-2 点骰子', cards: ['starfall', 'starlight'] },
    { id: 'bulwark', name: '铁壁卫', title: '不动壁垒', maxHp: 78, color: [90, 120, 160],
        passive: '回合结束时保留一半护甲', cards: ['shieldbash', 'bigshield'] },
    { id: 'gambler', name: '赌徒', title: '孤注一掷', maxHp: 66, color: [200, 150, 60],
        passive: '每回合首次掷出的 1 点会翻成 6 点', cards: ['allin', 'coin'] },
    { id: 'alch', name: '炼金术士', title: '点石成金', maxHp: 59, color: [80, 160, 140],
        passive: '中毒每回合额外造成 1 点伤害', cards: ['venom', 'transmute'] },
    { id: 'shadow', name: '影行者', title: '魅影连击', maxHp: 67, color: [110, 110, 130],
        passive: '用奇数骰打出的攻击，每段伤害 +2', cards: ['stab2', 'shadowstep'] },
    { id: 'cleric', name: '圣愈者', title: '晨曦之手', maxHp: 62, color: [230, 200, 120],
        passive: '每场战斗胜利后回复 6 点生命', cards: ['judgment', 'holylight'] },
    { id: 'pyro', name: '烈焰术士', title: '焚运改命', maxHp: 57, color: [200, 90, 60],
        passive: '用 6 点骰打出的攻击，伤害 +4', cards: ['fireball', 'ignite'] },
    { id: 'tinker', name: '机关师', title: '精密复制', maxHp: 66, color: [140, 140, 150],
        passive: '回合开始时额外获得一颗 2 点骰子', cards: ['replicate', 'gearshot'] },
];
function heroById(id) {
    return exports.HEROES.find((h) => h.id === id);
}
function starterDeck(def) {
    return ['strike', 'strike', 'strike', 'defend', 'defend', 'defend', ...def.cards];
}
/** 卡牌奖励：3 张不重复候选。rare=true 时从稀有卡 + 职业卡中抽（精英/宝箱）。 */
function rewardOptions(heroId, rng, rare = false) {
    const pool = exports.CARDS.filter((c) => c.id !== 'strike' && c.id !== 'defend' &&
        (!c.hero || c.hero === heroId) && (rare ? (c.rare || !!c.hero) : !c.rare)).map((c) => c.id);
    const out = [];
    while (out.length < 3 && pool.length > 0) {
        out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    return out;
}
exports.NORMAL_ENEMIES = [
    { id: 'imp', name: '哥布林斥候', maxHp: 30, goldMin: 15, goldMax: 25, desc: '黑森林里成群出没的绿皮小贼',
        pattern: [{ type: 'atk', dmg: 6 }, { type: 'atk', dmg: 3, hits: 2 }, { type: 'atkblock', dmg: 4, block: 5 }] },
    { id: 'golem', name: '锈甲傀儡', maxHp: 42, goldMin: 18, goldMax: 28, desc: '古堡废墟中游荡的空心铠甲',
        pattern: [{ type: 'block', block: 8 }, { type: 'atk', dmg: 9 }, { type: 'atk', dmg: 5, hits: 2 }] },
    { id: 'viper', name: '沼泽蜥人', maxHp: 34, goldMin: 15, goldMax: 25, desc: '出手频繁，越战越凶',
        pattern: [{ type: 'atk', dmg: 2, hits: 3 }, { type: 'atk', dmg: 7 }, { type: 'buff', str: 1 }] },
];
exports.ELITES = [
    { id: 'lich', name: '厄运巫妖', maxHp: 72, goldMin: 40, goldMax: 55, elite: true, desc: '诅咒会让你下回合少一颗骰子',
        pattern: [{ type: 'curse' }, { type: 'atk', dmg: 9 }, { type: 'atk', dmg: 5, hits: 2 }, { type: 'block', block: 10 }] },
    { id: 'troll', name: '山岭巨魔', maxHp: 86, goldMin: 40, goldMax: 60, elite: true, desc: '留意它的意图：蓄力重击高达 16 点',
        pattern: [{ type: 'atk', dmg: 6 }, { type: 'atk', dmg: 16 }, { type: 'block', block: 8 }] },
];
exports.BOSS = {
    id: 'boss', name: '骰命魔龙', maxHp: 130, goldMin: 90, goldMax: 120, boss: true,
    desc: '盘踞龙巢的远古巨龙。血量过半时狂暴（力量+3）',
    pattern: [
        { type: 'atk', dmg: 10 }, { type: 'atkblock', dmg: 6, block: 10 },
        { type: 'atk', dmg: 4, hits: 3 }, { type: 'curse' }, { type: 'buff', str: 2 },
    ],
};
exports.EVENTS = [
    { id: 'meteor', title: '流星坠夜', text: '一颗骰形的陨星砸落营地旁，余温尚在。',
        options: [{ label: '拾取星屑（+45 金币）', apply: 'gold45' }, { label: '对星许愿（恢复 25% 生命）', apply: 'heal25' }] },
    { id: 'altar', title: '废弃祭坛', text: '古老的祭坛上刻着：以血换运。',
        options: [{ label: '献上鲜血（失去 15% 生命，每回合 +1 骰子）', apply: 'blooddie' }, { label: '默默离开', apply: 'none' }] },
    { id: 'well', title: '回声古井', text: '井水清澈，投入硬币会听见骰子落盘的声音。',
        options: [{ label: '饮下井水（恢复 20% 生命）', apply: 'heal20' }, { label: '投入 30 金币（获得一张稀有卡）', apply: 'buyrare' }] },
];
// 地图横坐标槽位（竖屏）
exports.COLUMN_X = [-240, -80, 80, 240];
// ---------------- 规则常量 ----------------
exports.RULES = {
    dicePerTurn: 3,
    handSize: 5,
    maxDice: 6,
    maxHand: 8,
    recruitCost: 100,
    bossEnrageAt: 0.5,
    bossEnrageStr: 3,
    shadowOddBonus: 2,
    pyroSixBonus: 4,
    alchPoisonBonus: 1,
    clericWinHeal: 6,
    restHealPct: 0.3,
};
exports.NODE_NAME = {
    battle: '遭遇战', elite: '精英战', treasure: '宝箱', event: '奇遇', rest: '营火', boss: '首领',
};
/** 掷骰定运：1-3 平运 / 4-5 好运 / 6 天运 */
function fateTier(roll) {
    return roll <= 3 ? 1 : roll <= 5 ? 2 : 3;
}
// [tier1, tier2, tier3] → [敌血削减比例, 首回合额外骰子]
const FATE_BATTLE = {
    battle: [[0, 0], [0.10, 0], [0.20, 1]],
    elite: [[0, 0], [0.08, 0], [0.15, 1]],
    boss: [[0, 0], [0.05, 0], [0.10, 1]],
};
/** 战斗节点的命运增益（游戏与模拟器共用）。 */
function fateBattleEntry(kind, tier) {
    const e = (FATE_BATTLE[kind] || FATE_BATTLE.battle)[tier - 1];
    return { hpCut: e[0], firstDie: e[1] };
}
/** 命运掷骰结果文案：第一行运势名，第二行增益说明。 */
function fateLines(kind, tier) {
    const t = tier === 3 ? '天 运 ！' : tier === 2 ? '好 运' : '平 运';
    const cut = (FATE_BATTLE[kind] || [0])[tier - 1];
    switch (kind) {
        case 'battle':
        case 'elite':
        case 'boss':
            return [t, tier === 1 ? '此行无额外增益'
                    : '敌军开局生命 -' + Math.round(cut[0] * 100) + '%' + (cut[1] ? '，首回合 +1 骰' : '')];
        case 'treasure':
            return [t, tier === 1 ? '箱中无惊喜' : tier === 2 ? '开箱收益提升' : '开箱收益大幅提升'];
        case 'rest':
            return [t, tier === 1 ? '营火恢复 30%' : tier === 2 ? '营火恢复 45%' : '营火恢复 60%，磨砺亦回血'];
        default:
            return [t, tier === 1 ? '事件照常进行' : tier === 2 ? '事件收益 ×1.5' : '事件收益 ×2'];
    }
}
