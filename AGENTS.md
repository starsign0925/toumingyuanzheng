# 骰命远征（Dice Fate Expedition）

轻度策略掷骰 Roguelike —— Cocos Creator 3.8.8 项目。

## 运行方式

- 编辑器安装路径：`D:\cocos\Creator\3.8.8\CocosCreator.exe`
- 用 Cocos Dashboard / 编辑器打开本目录，双击 `assets/scene/Main.scene`，点「预览」即可运行（设计分辨率 720×1280）。
- 所有 UI 均为代码构建（Graphics + Label），项目不需要任何图片/预制体资源。

## 代码结构（assets/scripts/）

| 文件 | 职责 |
|------|------|
| `Data.ts` | 全部数值表与类型：8 名英雄、敌人/精英/首领、事件池、规则常量 `RULES` |
| `UI.ts` | 纯代码 UI 组件工厂：面板、按钮（SCALE 反馈）、骰子（Graphics 画点数）、血条 |
| `BattleScreen.ts` | 战斗主循环：掷骰 → 选骰 → 技能调整 → 结算 → 敌方掷骰；厄运/命运/战术点系统 |
| `GameMain.ts` | 场景入口组件：营地 / 编队 / 远征地图 / 事件 / 宝箱 / 结算 / 招募 / 存档 |

## 核心规则

- 每回合掷 5 颗骰子；6=暴击×2，1-2=落空且各 +1 厄运/命运。
- 厄运满 3 → 敌人追加一击；命运满 3 → 可免费全骰重掷（坏运气保底）。
- 战术点（TP）每回合 3 点，用于重掷所选骰子或发动英雄技能。
- 技能流派：占星师=全骰重掷、铁壁卫=低点转护盾、赌徒=掷1攒筹码换骰、炼金=同点数融合升点、影行者=奇数骰加伤返TP、圣愈者=低点转治疗、烈焰=指定骰变6、机关师=复制骰子。
- 存档：`sys.localStorage` key `dfx_save_v1`（金币 + 已招募英雄）。

## 当前设计（竖屏单人冒险 · 720×1280）

- 战斗为「骰子×卡牌」：每回合掷 3 骰 + 抽 5 牌，把骰子放进卡牌骰槽触发效果；敌人为杀戮尖塔式意图循环（头顶显示下回合行动）
- `Data.ts`：卡牌表（slot/type/desc）、8 英雄（被动+专属卡）、敌人意图 pattern、`rewardOptions` 奖励池
- `BattleCore.ts`：纯规则（牌堆/手牌/骰子/意图/中毒/狂暴）；`BattleAI.ts`：贪心出牌 + 选牌，游戏自动战斗与模拟器共用
- `Figures.ts`：欧式角色矢量绘制 + 专属攻击动画；地图为三条独立路线（LANES 槽位走廊）
- 四关通关：黑森林(森林巨魔王)→古堡(古堡魔像)→地穴(深渊巫妖王)→龙巢(骰命魔龙)；每关 5 行路线+首领，过关恢复 40% 生命；普通/精英敌人按关 `scaleEnemy`（生命+15%/关、攻击+1/关、格挡+1/关）；非龙首领用 `visual` 字段复用普通怪立绘
- 命运掷骰：进节点先掷骰定档（1-3 平运 / 4-5 好运 / 6 天运），战斗节点扣敌血 / 首回合加骰（`fateBattleEntry`），宝箱·营火·事件各有加成；战后奖励掷骰：1-3 选 1 张普通卡、4-5 选 2 张、6 进稀有池（精英升一档）
- 出牌演出：骰子飞入骰槽 + 卡牌飞向目标（`BattleScreen.playFx`）；`cardPick` 支持多选（picks 参数）
- `GameMain.ts`：营地选人/招募（战绩存 `save.trials`）、分支地图、战斗奖励 3 选 1、宝箱/营火/奇遇、结算

## 平衡模拟

```powershell
powershell -ExecutionPolicy Bypass -File tools/sim.ps1 3000            # 完整报告（每英雄通关率+死因分布）
powershell -ExecutionPolicy Bypass -File tools/sim.ps1 600 calib 0.5   # 生命校准，建议各英雄 HP
```
当前基准：各英雄通关 46.3–54.7%（差距 8.4 点，四关全破）。改数值后务必重跑。

## Web 构建与试玩

```powershell
& "D:\cocos\Creator\3.8.8\CocosCreator.exe" --project . --build "platform=web-mobile;debug=true;outputName=web;buildPath=build;orientation=portrait"
$env:ELECTRON_RUN_AS_NODE='1'; & "D:\cocos\Creator\3.8.8\CocosCreator.exe" serve.js build/web 8787
```

## 类型检查

本机无 Node，可用编辑器内置 TypeScript 检查脚本：

```powershell
$env:ELECTRON_RUN_AS_NODE='1'
& "D:\cocos\Creator\3.8.8\CocosCreator.exe" "D:\cocos\Creator\3.8.8\resources\app.asar.unpacked\node_modules\typescript\bin\tsc" -p tsconfig.check.json
```

## 手写资产注意

- `assets/` 下的 `.meta` / `.scene` 均为手写，uuid 已固定，编辑器首次打开会校验格式，勿改 uuid 以免断场景引用（`GameMain` 脚本 uuid = `87b9a10a-2da1-4ebf-9db9-ef48a60bb1d5`）。

## 未实现（设计文档中的后续项）

- 无尽模式、皮肤/商城、每日任务、赛季、排行榜
- 英雄升星/碎片养成（当前招募=直接解锁）
- 骰面收集成长（当前骰子类型由技能转化产生）
