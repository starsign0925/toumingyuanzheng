"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NODE_NAME = exports.RULES = exports.COLUMN_X = exports.EVENTS = exports.STAGES = exports.BOSSES = exports.ELITES = exports.NORMAL_ENEMIES = exports.PARTY_NOTES = exports.HEROES = exports.PROF = exports.QUALITY_NAME = exports.WEAPONS = exports.SKILLS = exports.STATUS = exports.ATTR_NAME = exports.ATTRS = void 0;
exports.skillById = skillById;
exports.weaponById = weaponById;
exports.weaponName = weaponName;
exports.heroById = heroById;
exports.partyNote = partyNote;
exports.makeHero = makeHero;
exports.scaleEnemy = scaleEnemy;
exports.encounter = encounter;
exports.rewardOptions = rewardOptions;
exports.rewardText = rewardText;
exports.applyReward = applyReward;
exports.ATTRS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
exports.ATTR_NAME = {
    str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力',
};
/** 每种状态都有上限与衰减规则，避免无限控制或永久异常。 */
exports.STATUS = {
    bleed: { name: '流血', max: 10, color: [220, 70, 60], desc: '回合结束损失等同层数的生命，然后层数 -1' },
    poison: { name: '中毒', max: 10, color: [120, 210, 100], desc: '回合结束损失等同层数的生命，然后层数 -1' },
    burn: { name: '燃烧', max: 3, color: [240, 140, 50], desc: '回合结束损失 3 点生命，持续回合 -1' },
    sunder: { name: '破甲', max: 3, color: [200, 170, 120], desc: '防御 -2，持续回合 -1' },
    stun: { name: '震慑', max: 1, color: [230, 210, 90], desc: '跳过下一次行动；结束后 1 回合内免疫震慑' },
    disarm: { name: '缴械', max: 2, color: [170, 170, 190], desc: '无法使用武器攻击与武器技能' },
    fear: { name: '恐惧', max: 2, color: [170, 110, 210], desc: '攻击检定劣势' },
    weak: { name: '虚弱', max: 6, color: [150, 150, 150], desc: '下一次攻击伤害降低等同层数，回合结束清除' },
};
exports.SKILLS = [
    { id: 'attack', name: '普通攻击', slot: 'none', action: 'main', target: 'enemy', weapon: true,
        desc: '武器攻击：D20+命中 ≥ 防御，伤害 = 武器骰 + 属性修正' },
    // —— 武器主动技能 ——
    { id: 'cleave', name: '力劈华山', slot: 'min4', action: 'main', target: 'enemy', weapon: true,
        desc: '武器攻击，伤害 +X；命中附加破甲 2 回合' },
    { id: 'parry', name: '拆招', slot: 'odd', action: 'bonus', target: 'self', weapon: true,
        desc: '获得 X+3 点护甲' },
    { id: 'thrust', name: '突刺', slot: 'even', action: 'main', target: 'enemy', weapon: true,
        desc: '对目标及另一名敌人各进行一次武器攻击，伤害 +X÷2' },
    { id: 'pierce', name: '穿云箭', slot: 'six', action: 'main', target: 'enemy', weapon: true,
        desc: '必中，伤害 = 2×武器骰 + 修正 + X' },
    { id: 'punch', name: '透甲', slot: 'min4', action: 'main', target: 'enemy', weapon: true,
        desc: '必中的武器攻击，伤害 +X（射击后需装填）' },
    { id: 'ambush', name: '设伏', slot: 'min4', action: 'main', target: 'enemy', weapon: true,
        desc: '在目标处设伏：其下次行动前受到 3D8+智力 伤害（击杀则其无法行动）' },
    { id: 'bulwark', name: '盾守', slot: 'min4', action: 'bonus', target: 'self', weapon: true,
        desc: '获得 X+4 点护甲' },
    { id: 'brew', name: '药力', slot: 'any', action: 'bonus', target: 'self', weapon: true,
        desc: '本回合下一次治疗 +X÷2' },
    // —— 裴烈 ——
    { id: 'guard', name: '格挡', slot: 'max3', action: 'bonus', target: 'self',
        desc: '获得 2X+1 点护甲' },
    { id: 'protect', name: '守护', slot: 'min4', action: 'bonus', target: 'ally',
        desc: '本轮生命最低队友受到的下一次单体攻击改由裴烈承受（消耗反应），裴烈获得 X 护甲' },
    { id: 'breach', name: '破阵', slot: 'pair', action: 'main', target: 'enemy', weapon: true,
        desc: '武器攻击（优势），伤害 +X+军势×3，耗尽军势' },
    // —— 沈知远 ——
    { id: 'insight', name: '识破', slot: 'any', action: 'bonus', target: 'enemy',
        desc: '智力检定 vs 识破 DC：成功则看穿目标意图、使其破甲 2 回合，并获得 1 筹谋' },
    { id: 'ploy', name: '扰敌', slot: 'odd', action: 'main', target: 'enemy',
        desc: '造成 X+智力 点伤害，并使目标下次攻击伤害 -X' },
    { id: 'chain', name: '连环计', slot: 'pair', action: 'main', target: 'enemy',
        desc: '目标感知豁免（DC 8+熟练+智力），失败则震慑 1 回合' },
    { id: 'plan', name: '授计', slot: 'none', action: 'bonus', target: 'party', cost: 1,
        desc: '消耗 1 筹谋：全队各获得 4 护甲，本回合下一次攻击获得优势' },
    // —— 叶青 ——
    { id: 'scout', name: '侦察', slot: 'any', action: 'bonus', target: 'enemy',
        desc: '感知检定 vs 识破 DC：成功看穿目标意图，并获得 1 先机' },
    { id: 'aimed', name: '精准射击', slot: 'min4', action: 'main', target: 'enemy', weapon: true,
        desc: '武器攻击（优势），伤害 +X' },
    { id: 'snare', name: '陷阱', slot: 'even', action: 'bonus', target: 'enemy',
        desc: '对目标施加流血 X÷2+1' },
    { id: 'volley', name: '疾风连射', slot: 'pair', action: 'main', target: 'enemy', weapon: true,
        desc: '耗尽先机：进行 先机 次武器攻击（至少 1 次）' },
    // —— 许怀仁 ——
    { id: 'aid', name: '急救', slot: 'any', action: 'main', target: 'ally',
        desc: '治疗生命比例最低的队友 1D4+X÷2' },
    { id: 'cleanse', name: '解毒', slot: 'even', action: 'bonus', target: 'party',
        desc: '移除全队流血/中毒/燃烧/恐惧；X=6 时全队各恢复 3 点' },
    { id: 'needle', name: '银针', slot: 'odd', action: 'main', target: 'enemy',
        desc: '感知远程攻击：命中造成 1D4+感知 伤害并施加中毒 X÷2+1' },
    { id: 'revive', name: '妙手回春', slot: 'none', action: 'main', target: 'party', cost: 3,
        desc: '消耗 3 医术点：全队恢复 1D4+感知' },
];
function skillById(id) {
    return exports.SKILLS.find((s) => s.id === id);
}
exports.WEAPONS = [
    { id: 'blade', name: '刀', die: 8, attr: 'str', ranged: false, skill: 'cleave', desc: '高爆发、破甲' },
    { id: 'sword', name: '剑', die: 6, attr: 'finesse', ranged: false, skill: 'parry', desc: '灵活、防守反击（力量/敏捷取高）' },
    { id: 'spear', name: '长枪', die: 8, attr: 'str', ranged: false, reach: true, skill: 'thrust', desc: '后排也可攻击、突刺两敌' },
    { id: 'bow', name: '弓', die: 8, attr: 'dex', ranged: true, skill: 'pierce', desc: '远程攻击、穿云箭' },
    { id: 'xbow', name: '弩', die: 10, attr: 'dex', ranged: true, reload: true, skill: 'punch', desc: '高单发伤害，射击后需装填' },
    { id: 'mechxbow', name: '机关弩', die: 8, attr: 'int', ranged: true, skill: 'ambush', desc: '设伏、触发式攻击（智力）' },
    { id: 'shield', name: '盾牌', die: 4, attr: 'str', ranged: false, ac: 2, skill: 'bulwark', desc: '防御 +2，格挡守护' },
    { id: 'staff', name: '药杖', die: 4, attr: 'wis', ranged: false, skill: 'brew', desc: '辅助治疗、药剂强化（感知）' },
];
function weaponById(id) {
    return exports.WEAPONS.find((w) => w.id === id);
}
exports.QUALITY_NAME = ['普通', '精良', '传奇'];
function weaponName(w) {
    return (w.q > 0 ? exports.QUALITY_NAME[w.q] + '·' : '') + weaponById(w.id).name;
}
// ---------------- 角色 ----------------
exports.PROF = 2; // 熟练加值（一级）
exports.HEROES = [
    {
        id: 'pei', name: '裴烈', title: '武卫', role: '守护·近战·防御·破阵', visual: 'bulwark', color: [150, 72, 58],
        attrs: { str: 16, dex: 12, con: 15, int: 9, wis: 12, cha: 10 }, maxHp: 32, ac: 15,
        weapon: 'blade', weapons: ['blade', 'spear', 'shield', 'sword'],
        res: '军势', resMax: 3, resStart: 0, row: 'front',
        passive: '铁壁军魂：成功格挡或守护队友时获得 1 点军势（每回合一次）',
        skills: ['guard', 'protect', 'breach'],
        story: '曾经的军伍士卒，亲眼见到军队残害平民。手中的兵器，究竟为保护百姓，还是建立铁血秩序？',
    },
    {
        id: 'shen', name: '沈知远', title: '谋士', role: '控场·机关·交涉·辅助', visual: 'astro', color: [70, 100, 150],
        attrs: { str: 9, dex: 13, con: 12, int: 16, wis: 14, cha: 13 }, maxHp: 30, ac: 13,
        weapon: 'mechxbow', weapons: ['mechxbow', 'sword', 'xbow', 'staff'],
        res: '筹谋', resMax: 3, resStart: 1, row: 'back',
        passive: '运筹帷幄：每场战斗首次识破敌人意图时额外获得 1 点筹谋',
        skills: ['insight', 'ploy', 'chain', 'plan'],
        story: '仕途尽毁的地方士子，熟悉兵法律令。修补旧制度，还是彻底推翻它？',
    },
    {
        id: 'ye', name: '叶青', title: '游侠', role: '远程·侦察·潜行·陷阱', visual: 'shadow', color: [70, 130, 80],
        attrs: { str: 11, dex: 17, con: 13, int: 11, wis: 14, cha: 10 }, maxHp: 29, ac: 14,
        weapon: 'bow', weapons: ['bow', 'xbow', 'sword', 'spear'],
        res: '先机', resMax: 3, resStart: 0, row: 'back',
        passive: '山林猎手：每回合首次命中额外 +1D4 伤害并获得 1 先机',
        skills: ['scout', 'aimed', 'snare', 'volley'],
        story: '山林里长大的猎户，被豪强驱逐。不在乎谁坐上皇位，只在乎百姓能否保住土地。',
    },
    {
        id: 'xu', name: '许怀仁', title: '医师', role: '治疗·解毒·急救·药剂', visual: 'cleric', color: [200, 170, 100],
        attrs: { str: 10, dex: 12, con: 13, int: 14, wis: 16, cha: 12 }, maxHp: 28, ac: 12,
        weapon: 'staff', weapons: ['staff', 'sword', 'xbow', 'mechxbow'],
        res: '医术点', resMax: 3, resStart: 1, row: 'back',
        passive: '仁心济世：每场战斗首次治疗生命低于一半的队友时额外恢复 4 点；每回合 +1 医术点',
        skills: ['aid', 'cleanse', 'needle', 'revive'],
        story: '行走乡野的医师。乱世里药材与生命都成了筹码，每一次救治都是艰难的选择。',
    },
];
function heroById(id) {
    return exports.HEROES.find((h) => h.id === id);
}
/** 五种核心阵容（设计 3.2）。 */
exports.PARTY_NOTES = [
    { ids: ['pei', 'shen', 'ye'], note: '攻防、控制、远程较均衡', weak: '缺少稳定治疗' },
    { ids: ['pei', 'ye', 'xu'], note: '承伤、输出、续航', weak: '控场和机关能力较弱' },
    { ids: ['pei', 'shen', 'xu'], note: '防御、治疗、控场稳健', weak: '远程爆发不足' },
    { ids: ['shen', 'ye', 'xu'], note: '控制、远程、治疗完整', weak: '前排承伤偏弱，需利用控场避免硬拼' },
];
function partyNote(ids) {
    return exports.PARTY_NOTES.find((p) => p.ids.every((i) => ids.indexOf(i) >= 0)) || null;
}
function makeHero(def) {
    return { def, hp: def.maxHp, maxHp: def.maxHp, weapon: { id: def.weapon, q: 0 } };
}
/** 全局敌人伤害加值（难度旋钮，用模拟器校准）。 */
const ENEMY_DMG = 1;
const D = (n, d, b = 0) => ({ n, d, b: b + ENEMY_DMG });
exports.NORMAL_ENEMIES = [
    { id: 'bandit', name: '流寇', visual: 'gambler', maxHp: 36, ac: 12, atk: 4, save: 0, insight: 11, gold: [6, 10],
        desc: '饥荒逼出来的亡命之徒',
        pattern: [{ type: 'atk', dmg: D(1, 8, 3) }, { type: 'charge', amount: 3 }, { type: 'atk', dmg: D(1, 8, 3) }] },
    { id: 'soldier', name: '官兵', visual: 'golem', maxHp: 45, ac: 14, atk: 5, save: 1, insight: 11, gold: [8, 12],
        desc: '奉命镇压的州府兵丁',
        pattern: [{ type: 'block', block: 6 }, { type: 'atk', dmg: D(1, 10, 3) }, { type: 'atk', dmg: D(1, 10, 3) }] },
    { id: 'archer', name: '弓手', visual: 'tinker', maxHp: 31, ac: 12, atk: 5, save: 1, insight: 11, gold: [7, 11],
        desc: '远程放箭，无视站位',
        pattern: [{ type: 'atk', dmg: D(1, 8, 3), ranged: true },
            { type: 'hex', status: 'bleed', amount: 3, save: 'dex', dc: 12 },
            { type: 'atk', dmg: D(1, 8, 3), ranged: true }] },
    { id: 'poisoner', name: '毒师', visual: 'alch', maxHp: 31, ac: 11, atk: 4, save: 2, insight: 12, gold: [7, 11],
        desc: '豪强豢养的用毒高手',
        pattern: [{ type: 'hex', status: 'poison', amount: 4, save: 'con', dc: 12 },
            { type: 'atk', dmg: D(1, 6, 3), ranged: true },
            { type: 'hex', status: 'poison', amount: 4, save: 'con', dc: 12 }] },
];
exports.ELITES = [
    { id: 'chief', name: '悍匪头目', visual: 'troll', maxHp: 100, ac: 14, atk: 6, save: 2, insight: 13, gold: [20, 30], elite: true,
        desc: '留意危险区域：横扫全队',
        pattern: [{ type: 'atk', dmg: D(2, 6, 4) }, { type: 'charge', amount: 4 },
            { type: 'aoe', dmg: D(2, 6, 2), save: 'dex', dc: 13 }] },
    { id: 'sorcerer', name: '妖道', visual: 'pyro', maxHp: 86, ac: 12, atk: 6, save: 3, insight: 13, gold: [20, 30], elite: true,
        desc: '符咒惑人，会震慑与焚烧',
        pattern: [{ type: 'hex', status: 'stun', amount: 1, save: 'wis', dc: 13 },
            { type: 'aoe', dmg: D(2, 6, 2), save: 'dex', dc: 13 },
            { type: 'hex', status: 'burn', amount: 2, save: 'dex', dc: 13 },
            { type: 'atk', dmg: D(2, 6, 3), ranged: true }] },
];
exports.BOSSES = [
    { id: 'zhenfu', name: '青州镇抚使', visual: 'golem', maxHp: 180, ac: 15, atk: 6, save: 3, insight: 14, gold: [45, 60], boss: true,
        desc: '横征暴敛的州府重臣。血量过半时狂暴（伤害+2）',
        pattern: [{ type: 'atk', dmg: D(1, 10, 5) }, { type: 'block', block: 8 },
            { type: 'aoe', dmg: D(2, 6, 4), save: 'dex', dc: 13 }, { type: 'charge', amount: 5 },
            { type: 'hex', status: 'sunder', amount: 2, save: 'con', dc: 13 }] },
    { id: 'zhenbei', name: '镇北将军', visual: 'troll', maxHp: 220, ac: 16, atk: 7, save: 4, insight: 15, gold: [55, 70], boss: true,
        desc: '铁甲重骑的统帅。血量过半时狂暴（伤害+2）',
        pattern: [{ type: 'block', block: 10 }, { type: 'atk', dmg: D(2, 6, 5), hits: 2 },
            { type: 'charge', amount: 6 }, { type: 'aoe', dmg: D(2, 8, 2), save: 'dex', dc: 14 }] },
    { id: 'heishui', name: '黑水寨主', visual: 'viper', maxHp: 245, ac: 15, atk: 7, save: 4, insight: 15, gold: [60, 80], boss: true,
        desc: '盘踞峡谷的枭雄，翻脸比翻书快。血量过半时狂暴（伤害+2）',
        pattern: [{ type: 'hex', status: 'poison', amount: 4, save: 'con', dc: 14 }, { type: 'atk', dmg: D(1, 12, 6) },
            { type: 'aoe', dmg: D(2, 8, 2), save: 'dex', dc: 14 },
            { type: 'hex', status: 'fear', amount: 2, save: 'wis', dc: 14 }] },
    { id: 'quanxiang', name: '大晟权相', visual: 'lich', maxHp: 285, ac: 16, atk: 8, save: 5, insight: 16, gold: [80, 100], boss: true,
        desc: '把持朝政的权相，禁军听其号令。血量过半时狂暴（伤害+2）',
        pattern: [{ type: 'hex', status: 'stun', amount: 1, save: 'wis', dc: 15 },
            { type: 'aoe', dmg: D(3, 6, 2), save: 'dex', dc: 15 }, { type: 'atk', dmg: D(2, 8, 6) },
            { type: 'block', block: 12 }, { type: 'charge', amount: 6 }] },
];
exports.STAGES = [
    { name: '青州·烽烟初起', short: '青 州', boss: exports.BOSSES[0], color: [32, 46, 34], goal: '击败青州镇抚使，建立第一个稳定据点' },
    { name: '汉北·破阵渡江', short: '汉 北', boss: exports.BOSSES[1], color: [52, 48, 40], goal: '击败镇北将军，夺取关键府城' },
    { name: '黑水谷·群雄逐鹿', short: '黑水谷', boss: exports.BOSSES[2], color: [30, 42, 50], goal: '击败黑水寨主，控制战略要地' },
    { name: '洛阳·覆灭旧朝', short: '洛 阳', boss: exports.BOSSES[3], color: [60, 28, 24], goal: '攻入洛阳，终结旧朝' },
];
/** 区域难度缩放（游戏与模拟器共用）：生命 +20%/区，命中/伤害/格挡/DC +1/区，防御 +1/两区。 */
function scaleEnemy(def, stage) {
    if (stage <= 0) {
        return def;
    }
    return {
        ...def,
        maxHp: Math.round(def.maxHp * (1 + 0.25 * stage)),
        ac: def.ac + Math.floor(stage / 2),
        atk: def.atk + stage,
        save: def.save + stage,
        insight: def.insight + stage,
        gold: [def.gold[0] + stage * 3, def.gold[1] + stage * 3],
        pattern: def.pattern.map((it) => ({
            ...it,
            dmg: it.dmg ? { ...it.dmg, b: (it.dmg.b || 0) + stage } : it.dmg,
            block: it.block !== undefined ? it.block + stage : it.block,
            dc: it.dc !== undefined ? it.dc + stage : it.dc,
        })),
    };
}
/** 生成遭遇：普通 2 敌（后两区 3 敌），精英 = 精英 + 1 杂兵，首领 = 首领（第二区起 + 1 杂兵）。 */
function encounter(kind, stage, rng) {
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const out = [];
    if (kind === 'boss') {
        out.push(exports.STAGES[stage].boss);
        if (stage >= 1) {
            out.push(scaleEnemy(pick(exports.NORMAL_ENEMIES), stage));
        }
    }
    else if (kind === 'elite') {
        out.push(scaleEnemy(pick(exports.ELITES), stage), scaleEnemy(pick(exports.NORMAL_ENEMIES), stage));
    }
    else {
        const n = stage >= 2 ? 3 : 2;
        for (let i = 0; i < n; i++) {
            out.push(scaleEnemy(pick(exports.NORMAL_ENEMIES), stage));
        }
    }
    return out;
}
/** 战后三选一：武器升品 / 换新武器（改变战斗流派）/ 伤药或强身。 */
function rewardOptions(party, rng, bonusQ = 0) {
    const pickHero = (ok) => {
        const idx = party.map((h, i) => i).filter((i) => ok(party[i]));
        return idx.length ? idx[Math.floor(rng() * idx.length)] : -1;
    };
    const out = [];
    const up = pickHero((h) => h.weapon.q < 2);
    if (up >= 0) {
        out.push({ kind: 'upgrade', hero: up });
    }
    const wh = pickHero((h) => h.def.weapons.length > 1);
    if (wh >= 0) {
        const kinds = party[wh].def.weapons.filter((k) => k !== party[wh].weapon.id);
        const q = Math.min(2, bonusQ + (rng() < 0.3 ? 1 : 0));
        out.push({ kind: 'weapon', hero: wh, w: { id: kinds[Math.floor(rng() * kinds.length)], q } });
    }
    out.push(rng() < 0.5 ? { kind: 'heal', pct: 0.3 } : { kind: 'vigor', hero: pickHero(() => true), amt: 4 });
    while (out.length < 3) {
        out.push({ kind: 'vigor', hero: pickHero(() => true), amt: 4 });
    }
    return out;
}
function rewardText(party, r) {
    switch (r.kind) {
        case 'upgrade': {
            const h = party[r.hero];
            return h.def.name + '：' + weaponName(h.weapon) + ' → ' + weaponName({ id: h.weapon.id, q: h.weapon.q + 1 });
        }
        case 'weapon': {
            const wd = weaponById(r.w.id);
            return party[r.hero].def.name + ' 换装 ' + weaponName(r.w) + '（1D' + wd.die + '，' + wd.desc + '）';
        }
        case 'heal': return '伤药：全队恢复 ' + Math.round(r.pct * 100) + '% 生命';
        case 'vigor': return party[r.hero].def.name + ' 强身：生命上限 +' + r.amt;
    }
    return '';
}
function applyReward(party, r) {
    switch (r.kind) {
        case 'upgrade':
            party[r.hero].weapon.q = Math.min(2, party[r.hero].weapon.q + 1);
            break;
        case 'weapon':
            party[r.hero].weapon = { id: r.w.id, q: r.w.q };
            break;
        case 'heal':
            for (const h of party) {
                h.hp = Math.min(h.maxHp, Math.max(1, h.hp) + Math.round(h.maxHp * r.pct));
            }
            break;
        case 'vigor':
            party[r.hero].maxHp += r.amt;
            party[r.hero].hp += r.amt;
            break;
    }
}
exports.EVENTS = [
    { id: 'river', title: '渡河', text: '洪水退后的大河拦住去路，对岸隐约有官兵巡逻的火光。',
        options: [
            { label: '观察水流，寻找渡点', attr: 'wis', dc: 12,
                ok: { text: '找到浅滩，悄然渡河', gold: 10 }, fail: { text: '踩空落水，全队受寒', dmgAll: 4 },
                crit: { text: '发现上游的走私船，顺手牵来物资', gold: 30, healPct: 0.1 } },
            { label: '砍伐木材，搭建木筏', attr: 'str', dc: 13,
                ok: { text: '木筏结实，平安渡河', healPct: 0.1 }, fail: { text: '木筏散架，物资冲走', gold: -10, dmgAll: 2 } },
            { label: '规划渡河顺序与警戒路线', attr: 'int', dc: 12,
                ok: { text: '避开巡逻，全队养精蓄锐', healPct: 0.15 }, fail: { text: '被巡逻发现，被迫迎战', fight: true } },
        ] },
    { id: 'granary', title: '粮仓潜入', text: '豪强的粮仓囤满了灾民的口粮，守卫正在换岗。',
        options: [
            { label: '趁换岗潜入', attr: 'dex', dc: 15,
                ok: { text: '扛出粮食分给流民', gold: 25, healPct: 0.2 }, fail: { text: '惊动守卫，被迫迎战', fight: true },
                crit: { text: '顺走了库房里的兵器', weapon: true, gold: 20 } },
            { label: '伪装成运粮民夫', attr: 'cha', dc: 14,
                ok: { text: '大摇大摆运走一车粮', gold: 35 }, fail: { text: '露馅挨了一顿棍棒', dmgAll: 5 } },
            { label: '寻找排水暗道', attr: 'int', dc: 13,
                ok: { text: '从暗道搬空了半个粮仓', gold: 20, healPct: 0.15 }, fail: { text: '暗道塌方，一人受伤', dmgOne: 8 } },
        ] },
    { id: 'ruins', title: '机关遗迹', text: '山腹中的前朝工坊，石门上布满机括与铜锁。',
        options: [
            { label: '以智力破解机关', attr: 'int', dc: 13,
                ok: { text: '石门洞开，里面藏着兵器', weapon: true }, fail: { text: '触发暗弩，全队负伤', dmgAll: 5 },
                crit: { text: '破解秘藏，得到上乘兵器与图谱', weapon: true, maxHp: 2 } },
            { label: '以感知寻找隐藏机关', attr: 'wis', dc: 12,
                ok: { text: '避开陷阱，拾得遗金', gold: 25 }, fail: { text: '踩中翻板，一人受伤', dmgOne: 7 } },
            { label: '不碰为妙，绕道离开', attr: 'wis', dc: 5,
                ok: { text: '安全离开' }, fail: { text: '安全离开' } },
        ] },
    { id: 'refugees', title: '流民营', text: '路边的流民营里，老人和孩子在病痛中呻吟。',
        options: [
            { label: '安抚人心，请他们指路', attr: 'cha', dc: 10,
                ok: { text: '流民送来向导与干粮', healPct: 0.2 }, fail: { text: '流民疑心重重，空手而归' } },
            { label: '施医救治病患', attr: 'wis', dc: 12,
                ok: { text: '病患好转，乡亲以全部积蓄相谢', gold: 20, maxHp: 2 }, fail: { text: '耗尽药材，自己也染了病', dmgAll: 3 } },
            { label: '以力服众，清理营地恶霸', attr: 'str', dc: 13,
                ok: { text: '恶霸被逐，流民感激涕零', gold: 15, healPct: 0.1 }, fail: { text: '恶霸纠集同伙动手', fight: true } },
        ] },
];
// 地图横坐标槽位（竖屏）
exports.COLUMN_X = [-240, -80, 80, 240];
// ---------------- 规则常量 ----------------
exports.RULES = {
    dicePerTurn: 3,
    initDc: 12, // 先手：全队最高敏捷修正 + D20 ≥ 12 则我方先手
    enrageAt: 0.5,
    enrageDmg: 2,
    stageHeal: 0.4, // 通过区域恢复
    battleHeal: 0.3, // 每场胜利后包扎恢复
    restHeal: 0.4,
    reviveHp: 1, // 战斗胜利后倒下的角色以 1 点生命归队
};
exports.NODE_NAME = {
    battle: '遭遇战', elite: '精英战', treasure: '宝箱', event: '奇遇', rest: '营火', boss: '首领',
};
