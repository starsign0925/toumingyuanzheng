# 烽火长歌（乱世聚义，骰定天下）

中式战术 RPG + Roguelike —— Cocos Creator 3.8.8 项目（原《骰命远征》原地改造，旧版见 git 历史 `fdcc522` 及之前）。
设计基线：《烽火长歌》设计定稿 V1.5。当前进度：**第一阶段 战斗原型**。

## 运行方式

- 编辑器安装路径：`D:\cocos\Creator\3.8.8\CocosCreator.exe`
- 用编辑器打开本目录，双击 `assets/scene/Main.scene`，点「预览」即可运行（竖屏 720×1280）。
- 所有 UI 均为代码构建（Graphics + Label），不需要图片/预制体；立绘暂时复用 `Figures.ts` 的矢量角色（水墨美术为后续阶段）。

## 代码结构（assets/scripts/）

| 文件 | 职责 |
|------|------|
| `DiceSystem.ts` | D20（优势/劣势）、每人独立 3D6 骰池、骰槽与组合识别（对子/三条/顺子）、自动支付 |
| `RuleResolver.ts` | 属性修正 ⌊(属性−10)/2⌋、DC 检定 / 命中 / 豁免、天然 20/1 |
| `Data.ts` | 四名主角、武器、技能、状态、敌人意图、四大区域、探索事件、战利品、`RULES` |
| `BattleCore.ts` | 纯战斗规则：回合、行动额度（移动/主要/附赠/反应）、前后排、意图执行、状态结算 |
| `BattleAI.ts` | 贪心 AI：自动战斗与模拟器共用 |
| `BattleScreen.ts` | 战斗界面：敌人+意图徽章、三名角色、当前行动者的骰池与技能 |
| `GameMain.ts` | 入口：营地四选三 / 三路线地图 / D20 事件检定 / 战利品 / 结算 / 存档 |
| `UI.ts` / `Figures.ts` | UI 组件工厂（含 `drawD20`）/ 矢量角色与攻击动画 |

规则层（Dice/Rule/Data/BattleCore/BattleAI）不得依赖 `cc`，模拟器直接复用。

## 核心规则

- 开局四选三（裴烈/沈知远/叶青/许怀仁），本次战役不可更换。
- 每名角色每回合独立掷 3D6，骰子不能互换，未用骰子回合结束作废；技能按骰槽支付，X = 骰面（组合取最大）。
- D20 决定成败；武器骰（D4–D10）结算伤害；每人每回合：移动 1、主要 1、附赠 1、反应每轮 1。
- 近战武器需在前排（长枪可后排）；敌人单体近战优先打前排，远程/冲锋可打后排。
- 敌人意图需「识破/侦察」检定成功才显示数值。
- 存档：`sys.localStorage` key `fhcg_save_v1`（钱 + 各角色战绩）；只有通关才带回钱。

## 平衡模拟 / 验收自测

```powershell
powershell -ExecutionPolicy Bypass -File tools/sim.ps1 600             # 验收自测 + 四种阵容通关报告
powershell -ExecutionPolicy Bypass -File tools/sim.ps1 1 selftest      # 只跑第一阶段验收自测
```
当前基准：自测 24/24；四阵容通关 58–81%（平均 68%，无前排阵容最难）。难度旋钮：`Data.ts` 中 `ENEMY_DMG`。

## Web 构建与试玩

构建前必须清掉 `ELECTRON_RUN_AS_NODE`，否则编辑器会被当成 node 运行（报 `bad option: --project`）：

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue; & "D:\cocos\Creator\3.8.8\CocosCreator.exe" --project . --build "platform=web-mobile;debug=true;outputName=web;buildPath=build;orientation=portrait"
$env:ELECTRON_RUN_AS_NODE='1'; & "D:\cocos\Creator\3.8.8\CocosCreator.exe" serve.js build/web 8787
```

## 类型检查

```powershell
$env:ELECTRON_RUN_AS_NODE='1'
& "D:\cocos\Creator\3.8.8\CocosCreator.exe" "D:\cocos\Creator\3.8.8\resources\app.asar.unpacked\node_modules\typescript\bin\tsc" -p tsconfig.check.json
```

## 手写资产注意

- `assets/` 下的 `.meta` / `.scene` 均为手写，uuid 已固定，勿改（`GameMain` 脚本 uuid = `87b9a10a-2da1-4ebf-9db9-ef48a60bb1d5`）。新脚本需同步新建 `.meta`。
- GitHub 推送需走本机代理：`git -c http.proxy=http://127.0.0.1:7897 push origin master`

## 后续阶段（设计 13.2）

- 第二阶段：营地、探索原型（渡河/砍树/潜入/交涉的完整事件链）
- 第三阶段：青州第一章主线、装备成长、营地设施
- 第四/五阶段：势力与领地、民心与结局；联机准备
