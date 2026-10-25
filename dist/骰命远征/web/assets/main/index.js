System.register("chunks:///_virtual/BattleAI.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './Data.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, slotOk, RULES;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      slotOk = module.slotOk;
      RULES = module.RULES;
    }],
    execute: function () {
      exports({
        pickReward: pickReward,
        planMove: planMove
      });
      cclegacy._RF.push({}, "f1d4344Aq1CuKkmM/pFd+Yk", "BattleAI", undefined);
      /** 一颗骰子对手牌的「可用价值」：当前手牌里最好的非骰子牌能打出的收益。 */
      function bestUse(core, v, skip) {
        var best = 0;
        for (var _iterator = _createForOfIteratorHelperLoose(core.hand), _step; !(_step = _iterator()).done;) {
          var c = _step.value;
          if (c === skip || c.def.type === 'dice' || !slotOk(c.def.slot, v)) {
            continue;
          }
          best = Math.max(best, payoff(core, c.def, v));
        }
        return best;
      }
      function incomingLeft(core) {
        var it = core.intentDamage();
        return Math.max(0, it.dmg * it.hits - core.block);
      }

      /** 非骰子牌打出的估值。 */
      function payoff(core, def, X) {
        var id = core.heroId;
        var bonus = 0;
        if (def.type === 'attack') {
          if (id === 'shadow' && X % 2 === 1) {
            bonus = RULES.shadowOddBonus;
          }
          if (id === 'pyro' && X === 6) {
            bonus = RULES.pyroSixBonus;
          }
        }
        var dmg = function dmg(n) {
          var v = n + bonus;
          return v >= core.enemyHp + core.enemyBlock ? v + 30 : v; // 斩杀奖励
        };

        var blk = function blk(n) {
          return Math.min(n, incomingLeft(core)) * 1.1 + Math.max(0, n - incomingLeft(core)) * (id === 'bulwark' ? 0.45 : 0.1);
        };
        var missing = core.hero.maxHp - core.hero.hp;
        var heal = function heal(n) {
          return Math.min(n, missing) * 0.9;
        };
        switch (def.id) {
          case 'strike':
            return dmg(X);
          case 'defend':
            return blk(X);
          case 'heavy':
            return dmg(2 * X);
          case 'jab':
            return dmg(X + 4);
          case 'twin':
          case 'stab2':
            return dmg(2 * X + bonus);
          // 两段合计 2X+2×加成（斩杀按总伤判断）
          case 'guard':
            return blk(X + 5);
          case 'leech':
            return dmg(X) + heal(Math.ceil(X / 2));
          case 'starlight':
            return dmg(X + 4) + 2;
          case 'shieldbash':
            return dmg(X + Math.floor(core.block / 2));
          case 'bigshield':
            return blk(2 * X);
          case 'allin':
            return 6.5 + bonus;
          case 'venom':
            {
              var pz = Math.ceil(X / 2) + 1;
              return pz * Math.min(3, core.enemyHp / 10) * 1.2;
            }
          case 'shadowstep':
            return blk(X + 3) + 2;
          case 'judgment':
            return dmg(2 * X) + heal(2);
          case 'holylight':
            return dmg(X) + heal(Math.floor(X / 2));
          case 'fireball':
            return dmg(16);
          case 'gearshot':
            return dmg(2 * X + 4 + bonus);
        }
        return X;
      }

      /** 骰子牌（改变骰子）的估值：改动前后该骰子的可用价值差。 */
      function diceGain(core, c, d) {
        var id = c.def.id;
        var freeCards = core.hand.filter(function (h) {
          return h !== c && h.def.type !== 'dice';
        }).length;
        var extraDieWorth = freeCards > core.dice.length ? 6 : 0.5;
        if (id === 'lucky' || id === 'coin') {
          return extraDieWorth;
        }
        if (id === 'starfall') {
          var avg = core.dice.reduce(function (s, x) {
            return s + x.value;
          }, 0) / Math.max(1, core.dice.length);
          return (3.5 - avg) * core.dice.length * 1.5;
        }
        if (!d) {
          return 0;
        }
        var cur = bestUse(core, d.value, c);
        var after = function after(v) {
          return bestUse(core, v, c);
        };
        switch (id) {
          case 'reroll':
            {
              var e = 0;
              for (var v = 1; v <= 6; v++) {
                e += after(v);
              }
              return e / 6 - cur;
            }
          case 'hone':
            return after(Math.min(6, d.value + 2)) - cur;
          case 'flip':
            return after(7 - d.value) - cur;
          case 'ignite':
            return after(Math.min(6, d.value + 3)) - cur;
          case 'transmute':
            return after(7 - d.value) - cur + 2;
          case 'split':
            return freeCards > core.dice.length ? after(Math.floor(d.value / 2)) + after(Math.ceil(d.value / 2)) - cur : -1;
          case 'replicate':
            return freeCards > core.dice.length ? cur : -1;
        }
        return 0;
      }

      // 选牌估值（模拟器用来模拟玩家拿牌）
      var PICK = {
        heavy: 7,
        twin: 6,
        jab: 6,
        guard: 5,
        reroll: 4,
        hone: 5,
        flip: 5,
        split: 3,
        leech: 8,
        lucky: 7,
        starfall: 5,
        starlight: 7,
        shieldbash: 6,
        bigshield: 6,
        allin: 6,
        coin: 6,
        venom: 7,
        transmute: 5,
        stab2: 7,
        shadowstep: 6,
        judgment: 7,
        holylight: 7,
        fireball: 5,
        ignite: 6,
        replicate: 5,
        gearshot: 7
      };

      /** 从奖励中挑一张；返回 null 表示跳过。 */
      function pickReward(options, deckSize) {
        var best = null,
          bv = 0;
        for (var _iterator2 = _createForOfIteratorHelperLoose(options), _step2; !(_step2 = _iterator2()).done;) {
          var _id = _step2.value;
          var v = PICK[_id] || 3;
          if (v > bv) {
            bv = v;
            best = _id;
          }
        }
        return deckSize >= 16 && bv < 7 ? null : best;
      }

      /** 规划下一步；返回 null 表示结束回合。 */
      function planMove(core) {
        var best = null,
          bestScore = 0.01;
        for (var _iterator3 = _createForOfIteratorHelperLoose(core.hand), _step3; !(_step3 = _iterator3()).done;) {
          var c = _step3.value;
          var opts = c.def.slot === 'none' ? [null] : core.dice;
          for (var _iterator4 = _createForOfIteratorHelperLoose(opts), _step4; !(_step4 = _iterator4()).done;) {
            var d = _step4.value;
            if (!core.canPlay(c, d)) {
              continue;
            }
            var s = void 0;
            if (c.def.type === 'dice') {
              s = diceGain(core, c, d);
            } else {
              // 用掉这颗骰子的机会成本：它对其他牌的最佳价值
              var other = bestUse(core, d.value, c);
              s = payoff(core, c.def, d.value) - other * 0.25;
            }
            if (s > bestScore) {
              bestScore = s;
              best = {
                card: c,
                die: d
              };
            }
          }
        }
        return best;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/BattleCore.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './Data.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, _createClass, cclegacy, RULES, slotOk, cardById;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
      _createClass = module.createClass;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      RULES = module.RULES;
      slotOk = module.slotOk;
      cardById = module.cardById;
    }],
    execute: function () {
      cclegacy._RF.push({}, "ace61Px47FPc6bl0gOj5DfW", "BattleCore", undefined);

      /** 一次出牌的结果（供表现层播放动画）。 */

      var BattleCore = exports('BattleCore', /*#__PURE__*/function () {
        function BattleCore(hero, deck, enemy, buffs, rng) {
          if (rng === void 0) {
            rng = Math.random;
          }
          this.hero = void 0;
          this.enemy = void 0;
          this.buffs = void 0;
          this.rng = void 0;
          this.block = 0;
          this.enemyHp = 0;
          this.enemyBlock = 0;
          this.enemyStr = 0;
          this.poison = 0;
          this.curse = 0;
          this.enraged = false;
          this.round = 1;
          this.intentIdx = 0;
          this.drawPile = [];
          this.hand = [];
          this.discard = [];
          this.exhausted = [];
          this.dice = [];
          this.nextDie = 1;
          this.gamblerFlip = false;
          this.hero = hero;
          this.enemy = enemy;
          this.buffs = buffs;
          this.rng = rng;
          this.enemyHp = enemy.maxHp;
          this.drawPile = deck.map(function (id, i) {
            return {
              uid: i + 1,
              def: cardById(id)
            };
          }).filter(function (c) {
            return !!c.def;
          });
          this.shuffle(this.drawPile);
        }
        var _proto = BattleCore.prototype;
        /** 意图的预计伤害（含力量），供 UI 与 AI 使用。 */
        _proto.intentDamage = function intentDamage() {
          var it = this.intent;
          if (it.type !== 'atk' && it.type !== 'atkblock') {
            return {
              dmg: 0,
              hits: 0
            };
          }
          return {
            dmg: (it.dmg || 0) + this.enemyStr,
            hits: it.hits || 1
          };
        }

        // ---------------- 基础 ----------------
        ;

        _proto.d6 = function d6() {
          return 1 + Math.floor(this.rng() * 6);
        };
        _proto.shuffle = function shuffle(a) {
          for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(this.rng() * (i + 1));
            var t = a[i];
            a[i] = a[j];
            a[j] = t;
          }
        };
        _proto.addDie = function addDie(v) {
          var d = {
            id: this.nextDie++,
            value: v
          };
          this.dice.push(d);
          return d;
        }

        /** 掷一颗新骰（赌徒被动：每回合首个 1 点翻成 6）。 */;
        _proto.rollFace = function rollFace() {
          var v = this.d6();
          if (v === 1 && this.heroId === 'gambler' && !this.gamblerFlip) {
            this.gamblerFlip = true;
            v = 6;
          }
          return v;
        };
        _proto.drawCards = function drawCards(n) {
          var c = 0;
          for (var i = 0; i < n && this.hand.length < RULES.maxHand; i++) {
            if (this.drawPile.length === 0) {
              if (this.discard.length === 0) {
                break;
              }
              this.drawPile = this.discard;
              this.discard = [];
              this.shuffle(this.drawPile);
            }
            this.hand.push(this.drawPile.pop());
            c++;
          }
          return c;
        }

        // ---------------- 回合 ----------------
        ;

        _proto.startTurn = function startTurn() {
          this.block = this.heroId === 'bulwark' ? Math.floor(this.block / 2) : 0;
          this.gamblerFlip = false;
          this.dice = [];
          var n = Math.max(1, Math.min(RULES.maxDice, RULES.dicePerTurn + this.buffs.extraDie - this.curse));
          this.curse = 0;
          for (var i = 0; i < n; i++) {
            this.addDie(this.rollFace());
          }
          if (this.heroId === 'astro') {
            for (var _iterator = _createForOfIteratorHelperLoose(this.dice), _step; !(_step = _iterator()).done;) {
              var d = _step.value;
              if (d.value <= 2) {
                d.value = this.d6();
              }
            }
          }
          if (this.heroId === 'tinker' && this.dice.length < RULES.maxDice) {
            this.addDie(2);
          }
          this.drawCards(RULES.handSize);
        };
        _proto.canPlay = function canPlay(card, die) {
          if (this.hand.indexOf(card) < 0) {
            return false;
          }
          if (card.def.slot === 'none') {
            if (card.def.id === 'lucky' || card.def.id === 'coin') {
              return this.dice.length < RULES.maxDice;
            }
            return true;
          }
          if (!die || this.dice.indexOf(die) < 0 || !slotOk(card.def.slot, die.value)) {
            return false;
          }
          if (card.def.id === 'split' || card.def.id === 'replicate') {
            return this.dice.length < RULES.maxDice;
          }
          return true;
        }

        /** 有没有任何可出的牌。 */;
        _proto.anyPlayable = function anyPlayable() {
          var _this = this;
          return this.hand.some(function (c) {
            return c.def.slot === 'none' ? _this.canPlay(c, null) : _this.dice.some(function (d) {
              return _this.canPlay(c, d);
            });
          });
        };
        _proto.hitEnemy = function hitEnemy(raw, r) {
          var absorbed = Math.min(this.enemyBlock, raw);
          this.enemyBlock -= absorbed;
          var real = raw - absorbed;
          this.enemyHp = Math.max(0, this.enemyHp - real);
          r.hits.push(real);
        };
        _proto.heal = function heal(n, r) {
          var before = this.hero.hp;
          this.hero.hp = Math.min(this.hero.maxHp, this.hero.hp + n);
          r.heal += this.hero.hp - before;
        };
        _proto.play = function play(card, die) {
          var _this2 = this;
          if (!this.canPlay(card, die)) {
            return null;
          }
          var r = {
            hits: [],
            block: 0,
            heal: 0,
            poison: 0,
            drew: 0,
            diceChanged: false,
            killed: false,
            text: ''
          };
          var X = die ? die.value : 0;
          var keepDie = card.def.type === 'dice';
          // 职业被动：攻击加成
          var bonus = 0;
          if (card.def.type === 'attack' && die) {
            if (this.heroId === 'shadow' && X % 2 === 1) {
              bonus += RULES.shadowOddBonus;
            }
            if (this.heroId === 'pyro' && X === 6) {
              bonus += RULES.pyroSixBonus;
            }
          }
          var atk = function atk(n) {
            return _this2.hitEnemy(n + bonus, r);
          };
          switch (card.def.id) {
            case 'strike':
              atk(X);
              break;
            case 'defend':
              r.block = X;
              break;
            case 'heavy':
              atk(2 * X);
              break;
            case 'jab':
              atk(X + 4);
              break;
            case 'twin':
              atk(X);
              atk(X);
              break;
            case 'guard':
              r.block = X + 5;
              break;
            case 'reroll':
              die.value = this.d6();
              r.diceChanged = true;
              break;
            case 'hone':
              die.value = Math.min(6, X + 2);
              r.diceChanged = true;
              break;
            case 'flip':
              die.value = 7 - X;
              r.diceChanged = true;
              break;
            case 'split':
              {
                die.value = Math.floor(X / 2);
                this.addDie(Math.ceil(X / 2));
                r.diceChanged = true;
                break;
              }
            case 'leech':
              atk(X);
              this.heal(Math.ceil(X / 2), r);
              break;
            case 'lucky':
            case 'coin':
              this.addDie(this.d6());
              r.diceChanged = true;
              break;
            case 'starfall':
              for (var _iterator2 = _createForOfIteratorHelperLoose(this.dice), _step2; !(_step2 = _iterator2()).done;) {
                var d = _step2.value;
                d.value = this.d6();
              }
              r.diceChanged = true;
              break;
            case 'starlight':
              atk(X + 4);
              r.drew = this.drawCards(1);
              break;
            case 'shieldbash':
              atk(X + Math.floor(this.block / 2));
              break;
            case 'bigshield':
              r.block = 2 * X;
              break;
            case 'allin':
              {
                var v = this.d6();
                atk(v >= 5 ? v * 3 : v);
                r.text = '新点数 ' + v;
                break;
              }
            case 'venom':
              r.poison = Math.ceil(X / 2) + 1;
              break;
            case 'transmute':
              die.value = 7 - X;
              r.diceChanged = true;
              r.drew = this.drawCards(1);
              break;
            case 'stab2':
              atk(X);
              atk(X);
              break;
            case 'shadowstep':
              r.block = X + 3;
              r.drew = this.drawCards(1);
              break;
            case 'judgment':
              atk(2 * X);
              this.heal(2, r);
              break;
            case 'holylight':
              atk(X);
              this.heal(Math.floor(X / 2), r);
              break;
            case 'fireball':
              atk(16);
              break;
            case 'ignite':
              die.value = Math.min(6, X + 3);
              r.diceChanged = true;
              break;
            case 'replicate':
              this.addDie(X);
              r.diceChanged = true;
              break;
            case 'gearshot':
              atk(X + 2);
              atk(X + 2);
              break;
            default:
              keepDie = true;
          }
          this.block += r.block;
          this.poison += r.poison;
          if (die && !keepDie) {
            this.dice.splice(this.dice.indexOf(die), 1);
          }
          this.hand.splice(this.hand.indexOf(card), 1);
          (card.def.exhaust ? this.exhausted : this.discard).push(card);
          r.killed = this.enemyHp <= 0;
          return r;
        }

        /** 结束回合：弃手牌，敌人中毒结算并执行意图。 */;
        _proto.endTurn = function endTurn() {
          var _this$discard;
          (_this$discard = this.discard).push.apply(_this$discard, this.hand);
          this.hand = [];
          this.dice = [];
          var it = this.intent;
          var res = {
            poisonDmg: 0,
            intent: it,
            hits: [],
            gainBlock: 0,
            gainStr: 0,
            curse: false,
            enragedNow: false,
            heroDead: false,
            enemyDead: false
          };
          this.enemyBlock = 0;
          if (this.poison > 0) {
            res.poisonDmg = this.poison + (this.heroId === 'alch' ? RULES.alchPoisonBonus : 0);
            this.enemyHp = Math.max(0, this.enemyHp - res.poisonDmg);
            this.poison--;
            if (this.enemyHp <= 0) {
              res.enemyDead = true;
              return res;
            }
          }
          if (this.enemy.boss && !this.enraged && this.enemyHp <= this.enemy.maxHp * RULES.bossEnrageAt) {
            this.enraged = true;
            this.enemyStr += RULES.bossEnrageStr;
            res.enragedNow = true;
          }
          if (it.type === 'atk' || it.type === 'atkblock') {
            var n = it.hits || 1;
            for (var i = 0; i < n; i++) {
              var raw = (it.dmg || 0) + this.enemyStr;
              var absorbed = Math.min(this.block, raw);
              this.block -= absorbed;
              var real = raw - absorbed;
              this.hero.hp = Math.max(0, this.hero.hp - real);
              res.hits.push({
                raw: raw,
                real: real
              });
              if (this.hero.hp <= 0) {
                break;
              }
            }
          }
          if (it.block) {
            this.enemyBlock += it.block;
            res.gainBlock = it.block;
          }
          if (it.type === 'buff') {
            this.enemyStr += it.str || 0;
            res.gainStr = it.str || 0;
          }
          if (it.type === 'curse') {
            this.curse = 1;
            res.curse = true;
          }
          res.heroDead = this.hero.hp <= 0;
          this.intentIdx++;
          if (!res.heroDead) {
            this.round++;
          }
          return res;
        };
        _proto.rollGold = function rollGold() {
          var e = this.enemy;
          return e.goldMin + Math.floor(this.rng() * (e.goldMax - e.goldMin + 1));
        };
        _createClass(BattleCore, [{
          key: "intent",
          get: function get() {
            var p = this.enemy.pattern;
            return p[this.intentIdx % p.length];
          }
        }, {
          key: "heroId",
          get: function get() {
            return this.hero.def.id;
          }
        }]);
        return BattleCore;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/BattleScreen.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './Data.ts', './BattleCore.ts', './BattleAI.ts', './UI.ts', './Figures.ts'], function (exports) {
  var _inheritsLoose, _createForOfIteratorHelperLoose, cclegacy, _decorator, tween, Vec3, Color, Graphics, Component, UIOpacity, Node, RULES, slotOk, BattleCore, planMove, floatText, COL, mkLabel, mkBar, mkPanel, mkNode, mkButton, drawPanel, setBtnEnabled, shake, drawDie, mkCard, centerOf, buildRig, rigIdle, heroAttack, castFx, die, enrage, enemyAttack, hurt;
  return {
    setters: [function (module) {
      _inheritsLoose = module.inheritsLoose;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      tween = module.tween;
      Vec3 = module.Vec3;
      Color = module.Color;
      Graphics = module.Graphics;
      Component = module.Component;
      UIOpacity = module.UIOpacity;
      Node = module.Node;
    }, function (module) {
      RULES = module.RULES;
      slotOk = module.slotOk;
    }, function (module) {
      BattleCore = module.BattleCore;
    }, function (module) {
      planMove = module.planMove;
    }, function (module) {
      floatText = module.floatText;
      COL = module.COL;
      mkLabel = module.mkLabel;
      mkBar = module.mkBar;
      mkPanel = module.mkPanel;
      mkNode = module.mkNode;
      mkButton = module.mkButton;
      drawPanel = module.drawPanel;
      setBtnEnabled = module.setBtnEnabled;
      shake = module.shake;
      drawDie = module.drawDie;
      mkCard = module.mkCard;
    }, function (module) {
      centerOf = module.centerOf;
      buildRig = module.buildRig;
      rigIdle = module.rigIdle;
      heroAttack = module.heroAttack;
      castFx = module.castFx;
      die = module.die;
      enrage = module.enrage;
      enemyAttack = module.enemyAttack;
      hurt = module.hurt;
    }],
    execute: function () {
      var _dec, _class, _class2;
      cclegacy._RF.push({}, "2da56RtbQRJzIRBclsnlVag", "BattleScreen", undefined);
      var ccclass = _decorator.ccclass;
      var DIE_SIZE = 64;
      var DIE_GAP = 78;
      var CARD_W = 130,
        CARD_H = 186;
      var ENEMY_SIZE = {
        imp: 110,
        golem: 135,
        viper: 120,
        lich: 140,
        troll: 155,
        boss: 195
      };
      var BattleScreen = exports('BattleScreen', (_dec = ccclass('BattleScreen'), _dec(_class = (_class2 = /*#__PURE__*/function (_Component) {
        _inheritsLoose(BattleScreen, _Component);
        function BattleScreen() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _this.core = null;
          _this.onEnd = null;
          _this.busy = false;
          _this.auto = false;
          _this.selDie = null;
          _this.selCard = null;
          _this.enemyHpBar = null;
          _this.enemyHpText = null;
          _this.intentLabel = null;
          _this.intentPanel = null;
          _this.enemyStatus = null;
          _this.heroStatus = null;
          _this.heroHpBar = null;
          _this.heroHpText = null;
          _this.infoLabel = null;
          _this.diceNode = null;
          _this.handNode = null;
          _this.logLabel = null;
          _this.pileLabel = null;
          _this.btnEnd = null;
          _this.btnAuto = null;
          _this.enemyRig = null;
          _this.heroRig = null;
          return _this;
        }
        var _proto = BattleScreen.prototype;
        _proto.init = function init(hero, deck, enemy, buffs, onEnd, auto) {
          if (auto === void 0) {
            auto = false;
          }
          this.core = new BattleCore(hero, deck, enemy, buffs);
          this.onEnd = onEnd;
          this.auto = auto;
          this.buildUI();
          this.log('遭遇 ' + enemy.name + ' —— ' + enemy.desc);
          var c = centerOf(this.enemyRig, this.node);
          floatText(this.node, enemy.name + ' 出现了！', c.x - 60, c.y + 60, COL.gold, 28);
          this.startTurn();
        }

        // ---------------- UI ----------------
        ;

        _proto.buildUI = function buildUI() {
          var _this2 = this;
          var root = this.node;
          var enemy = this.core.enemy;
          var EX = BattleScreen.EX,
            EY = BattleScreen.EY;
          var HX = BattleScreen.HX,
            HY = BattleScreen.HY;
          mkLabel(root, enemy.name + (enemy.boss ? '【首领】' : enemy.elite ? '【精英】' : ''), 24, enemy.elite || enemy.boss ? COL.red : COL.text, 0, 610);
          this.enemyHpBar = mkBar(root, 400, 20, 0, 578);
          this.enemyHpText = mkLabel(root, '', 15, COL.text, 0, 578);
          this.intentPanel = mkPanel(root, 170, 34, EX, 520, COL.panel, 8, COL.border, 2).node;
          this.intentLabel = mkLabel(root, '', 16, COL.text, EX, 520);
          this.enemyRig = buildRig(root, enemy.id, ENEMY_SIZE[enemy.id] || 130, EX, EY, true);
          rigIdle(this.enemyRig);
          this.enemyStatus = mkLabel(root, '', 14, COL.dim, EX, EY - (ENEMY_SIZE[enemy.id] || 130) / 2 - 14);
          this.heroRig = buildRig(root, this.core.hero.def.id, 130, HX, HY);
          rigIdle(this.heroRig);
          this.heroHpBar = mkBar(root, 210, 20, HX, -118);
          this.heroHpText = mkLabel(root, '', 15, COL.text, HX, -118);
          this.heroStatus = mkLabel(root, '', 14, COL.dim, HX, -148);
          mkLabel(root, this.core.hero.def.name, 15, COL.gold, HX, -170);
          mkLabel(root, this.core.hero.def.passive, 10.5, COL.dim, HX, -192, 220);
          this.infoLabel = mkLabel(root, '', 16, COL.gold, 0, 240);
          this.diceNode = mkNode(root, 'dice', 0, 0, 0, BattleScreen.DICE_Y);
          this.handNode = mkNode(root, 'hand', 0, 0, 0, BattleScreen.HAND_Y);
          this.logLabel = mkLabel(root, '', 15, COL.text, 0, -170, 660);
          this.pileLabel = mkLabel(root, '', 13, COL.dim, 0, -556);
          mkLabel(root, '规则：掷骰后把骰子放进卡牌触发效果。敌人头顶显示下回合意图。', 12, COL.dim, 0, -580);
          this.btnEnd = mkButton(root, '结束回合', 150, 62, 272, -230, 20, function () {
            return _this2.onEndTurn();
          });
          this.btnAuto = mkButton(root, '', 130, 62, -285, -230, 17, function () {
            _this2.auto = !_this2.auto;
            _this2.refresh();
            if (_this2.auto && !_this2.busy) {
              _this2.scheduleOnce(function () {
                return _this2.autoStep();
              }, 0.4);
            }
          });
        }

        // ---------------- 回合 ----------------
        ;

        _proto.startTurn = function startTurn() {
          var _this3 = this;
          this.core.startTurn();
          this.busy = false;
          this.selDie = null;
          this.selCard = null;
          this.refresh();
          // 骰子入场翻滚 + 手牌弹入
          this.diceNode.children.forEach(function (d, i) {
            d.setScale(0.2, 0.2, 1);
            d.angle = (Math.random() - 0.5) * 160;
            tween(d).delay(i * 0.05).to(0.16, {
              scale: new Vec3(1.2, 1.2, 1),
              angle: 0
            }).to(0.1, {
              scale: Vec3.ONE
            }).start();
          });
          this.handNode.children.forEach(function (c, i) {
            c.setScale(0.4, 0.4, 1);
            tween(c).delay(0.15 + i * 0.06).to(0.18, {
              scale: new Vec3(1.1, 1.1, 1)
            }).to(0.1, {
              scale: Vec3.ONE
            }).start();
          });
          if (this.auto) {
            this.scheduleOnce(function () {
              return _this3.autoStep();
            }, 0.6);
          }
        };
        _proto.autoStep = function autoStep() {
          var _this4 = this;
          if (!this.auto || this.busy || !this.node.isValid) {
            return;
          }
          var m = planMove(this.core);
          if (!m) {
            this.onEndTurn();
            return;
          }
          this.playCard(m.card, m.die);
          this.scheduleOnce(function () {
            return _this4.autoStep();
          }, 0.5);
        }

        // ---------------- 交互 ----------------
        ;

        _proto.onDieTap = function onDieTap(die) {
          if (this.busy || this.auto) {
            return;
          }
          if (this.selCard && this.core.canPlay(this.selCard, die)) {
            this.playCard(this.selCard, die);
            return;
          }
          this.selDie = this.selDie === die ? null : die;
          this.refresh();
        };
        _proto.onCardTap = function onCardTap(card) {
          if (this.busy || this.auto) {
            return;
          }
          if (card.def.slot === 'none') {
            if (this.core.canPlay(card, null)) {
              this.playCard(card, null);
            }
            return;
          }
          if (this.selDie && this.core.canPlay(card, this.selDie)) {
            this.playCard(card, this.selDie);
            return;
          }
          // 选中/取消该卡；若已有选中骰但不合法则提示
          if (this.selDie && !this.core.canPlay(card, this.selDie)) {
            this.log(card.def.name + '：' + card.def.desc + '（骰槽不匹配）');
          }
          this.selCard = this.selCard === card ? null : card;
          this.refresh();
        };
        _proto.playCard = function playCard(card, die) {
          var _this5 = this;
          if (this.busy) {
            return;
          }
          var r = this.core.play(card, die);
          if (!r) {
            return;
          }
          this.selDie = null;
          this.selCard = null;
          // 表现：攻击→英雄出手；技能/骰子→施法光环
          var enemyPos = centerOf(this.enemyRig, this.node);
          var heroPos = centerOf(this.heroRig, this.node);
          var enemyTop = enemyPos.y + this.enemyRig.size / 2;
          if (card.def.type === 'attack' && r.hits.length > 0) {
            heroAttack(this.heroRig, this.node, enemyPos);
          } else {
            castFx(this.heroRig, this.node);
          }
          // 命中反馈
          var t = 0.35;
          var _loop = function _loop() {
            var h = _step.value;
            var hh = h;
            _this5.scheduleOnce(function () {
              hurt(_this5.enemyRig, Math.min(1.4, 0.7 + hh / 25));
              shake(_this5.node, hh >= 14 ? 6 : 3);
              floatText(_this5.node, '-' + hh, enemyPos.x, enemyTop, COL.red, hh >= 14 ? 36 : 28);
            }, t);
            t += 0.16;
          };
          for (var _iterator = _createForOfIteratorHelperLoose(r.hits), _step; !(_step = _iterator()).done;) {
            _loop();
          }
          if (r.block > 0) {
            this.scheduleOnce(function () {
              return floatText(_this5.node, '+' + r.block + ' 护甲', heroPos.x, heroPos.y + 60, COL.blue, 24);
            }, 0.3);
          }
          if (r.heal > 0) {
            this.scheduleOnce(function () {
              return floatText(_this5.node, '+' + r.heal, heroPos.x, heroPos.y + 88, COL.green, 24);
            }, 0.4);
          }
          if (r.poison > 0) {
            this.scheduleOnce(function () {
              return floatText(_this5.node, '中毒 +' + r.poison, enemyPos.x, enemyTop + 36, new Color(120, 220, 110, 255), 22);
            }, 0.4);
          }
          if (r.drew > 0) {
            this.log('抽了 ' + r.drew + ' 张牌');
          }
          this.log(this.cardText(card, die ? die.value : 0, r));
          this.scheduleOnce(function () {
            _this5.refresh();
            if (r.killed) {
              _this5.winBattle();
            }
          }, Math.max(t, 0.5));
        };
        _proto.cardText = function cardText(card, X, r) {
          var dmg = r.hits.reduce(function (a, b) {
            return a + b;
          }, 0);
          var parts = [];
          if (dmg > 0) {
            parts.push('造成 ' + dmg + ' 伤害');
          }
          if (r.block > 0) {
            parts.push('获得 ' + r.block + ' 护甲');
          }
          if (r.poison > 0) {
            parts.push('中毒+' + r.poison);
          }
          if (r.heal > 0) {
            parts.push('回复 ' + r.heal);
          }
          if (r.diceChanged) {
            parts.push('骰子已变化');
          }
          if (r.text) {
            parts.push(r.text);
          }
          return card.def.name + '（' + X + '点）' + (parts.length ? '：' + parts.join('，') : '');
        };
        _proto.winBattle = function winBattle() {
          var _this6 = this;
          this.busy = true;
          die(this.enemyRig);
          var c = centerOf(this.enemyRig, this.node);
          floatText(this.node, '击败！', c.x, c.y, COL.gold, 32);
          this.scheduleOnce(function () {
            return _this6.onEnd(true, _this6.core.rollGold());
          }, 1.1);
        };
        _proto.onEndTurn = function onEndTurn() {
          if (this.busy) {
            return;
          }
          this.busy = true;
          this.refresh();
          var res = this.core.endTurn();
          this.enemyPhase(res);
        };
        _proto.enemyPhase = function enemyPhase(res) {
          var _this7 = this;
          var layer = this.node;
          var ePos = centerOf(this.enemyRig, layer);
          var hPos = centerOf(this.heroRig, layer);
          var lines = [];
          var t = 0;
          if (res.poisonDmg > 0) {
            lines.push('中毒 -' + res.poisonDmg);
            this.scheduleOnce(function () {
              floatText(layer, '毒 -' + res.poisonDmg, ePos.x, ePos.y + _this7.enemyRig.size / 2, new Color(120, 220, 110, 255), 24);
            }, t);
            t += 0.35;
          }
          if (res.enemyDead) {
            lines.push('毒发身亡！');
            this.log(lines.join('；'));
            this.scheduleOnce(function () {
              return _this7.winBattle();
            }, t + 0.2);
            return;
          }
          if (res.enragedNow) {
            this.scheduleOnce(function () {
              enrage(_this7.enemyRig);
              floatText(layer, '魔龙狂暴！力量+' + RULES.bossEnrageStr, ePos.x - 30, ePos.y + 70, COL.red, 26);
            }, t);
            t += 0.7;
          }
          var it = res.intent;
          if (res.curse) {
            lines.push('遭到诅咒：下回合 -1 骰');
            this.scheduleOnce(function () {
              return floatText(layer, '诅咒！', hPos.x, hPos.y + 90, new Color(190, 90, 220, 255), 24);
            }, t);
            t += 0.4;
          }
          if (res.gainStr > 0) {
            lines.push('力量+' + res.gainStr);
            this.scheduleOnce(function () {
              castFx(_this7.enemyRig, layer);
              floatText(layer, '力量+' + res.gainStr, ePos.x, ePos.y + _this7.enemyRig.size / 2, COL.gold, 22);
            }, t);
            t += 0.5;
          }
          if (res.gainBlock > 0) {
            lines.push('格挡+' + res.gainBlock);
            this.scheduleOnce(function () {
              return floatText(layer, '护甲+' + res.gainBlock, ePos.x, ePos.y + _this7.enemyRig.size / 2, COL.blue, 22);
            }, t);
            t += 0.4;
          }
          if (res.hits.length > 0) {
            lines.push('攻击 ' + res.hits.map(function (h) {
              return h.real;
            }).join('+') + (res.hits.some(function (h) {
              return h.real < h.raw;
            }) ? '(被护甲抵挡)' : ''));
            var impact = 0.5;
            this.scheduleOnce(function () {
              enemyAttack(_this7.enemyRig, layer, hPos);
            }, t);
            var tt = t + impact;
            var _loop2 = function _loop2() {
              var h = _step2.value;
              var hh = h;
              _this7.scheduleOnce(function () {
                hurt(_this7.heroRig, hh.real > 0 ? 1 : 0.5);
                var heavy = _this7.core.enemy.id === 'troll' || _this7.core.enemy.id === 'golem' || _this7.core.enemy.boss;
                shake(_this7.node, hh.real > 0 ? heavy ? 8 : 4 : 2);
                floatText(layer, hh.real > 0 ? '-' + hh.real : '格挡', hPos.x, hPos.y + 70, hh.real > 0 ? COL.red : COL.blue, hh.real > 0 ? 30 : 22);
                _this7.refresh();
              }, tt);
              tt += 0.28;
            };
            for (var _iterator2 = _createForOfIteratorHelperLoose(res.hits), _step2; !(_step2 = _iterator2()).done;) {
              _loop2();
            }
            t = tt;
          }
          this.log(lines.join('；'));
          this.scheduleOnce(function () {
            _this7.refresh();
            if (res.heroDead) {
              die(_this7.heroRig);
              _this7.scheduleOnce(function () {
                return _this7.onEnd(false, 0);
              }, 0.8);
              return;
            }
            _this7.startTurn();
          }, t + 0.5);
        }

        // ---------------- 刷新 ----------------
        ;

        _proto.refresh = function refresh() {
          var _this8 = this;
          var core = this.core;
          var it = core.intent;
          var idmg = core.intentDamage();
          // 敌人
          this.enemyHpBar.set(core.enemyHp / core.enemy.maxHp);
          this.enemyHpText.string = core.enemyHp + ' / ' + core.enemy.maxHp;
          var chip = '',
            chipCol = COL.panel;
          if (it.type === 'atk' || it.type === 'atkblock') {
            chip = '⚔ ' + idmg.dmg + (idmg.hits > 1 ? '×' + idmg.hits : '');
            chipCol = new Color(140, 46, 38, 255);
            if (it.type === 'atkblock' && it.block) {
              chip += '  盾' + it.block;
            }
          } else if (it.type === 'block') {
            chip = '盾 ' + it.block;
            chipCol = new Color(70, 100, 140, 255);
          } else if (it.type === 'buff') {
            chip = '强化 +' + it.str;
            chipCol = new Color(150, 100, 40, 255);
          } else if (it.type === 'curse') {
            chip = '诅咒 -1骰';
            chipCol = new Color(100, 56, 120, 255);
          }
          this.intentLabel.string = chip;
          drawPanel(this.intentPanel.getComponent(Graphics), 170, 34, chipCol, 8, COL.border, 2);
          var est = [];
          if (core.enemyBlock > 0) {
            est.push('护甲 ' + core.enemyBlock);
          }
          if (core.poison > 0) {
            est.push('毒 ' + core.poison);
          }
          if (core.enemyStr > 0) {
            est.push('力量 ' + core.enemyStr);
          }
          if (core.enraged) {
            est.push('狂暴');
          }
          this.enemyStatus.string = est.join('　') || ' ';
          // 英雄
          var h = core.hero;
          this.heroHpBar.set(h.hp / h.maxHp);
          this.heroHpText.string = Math.ceil(h.hp) + ' / ' + h.maxHp + (core.block > 0 ? '　+' + core.block + '甲' : '');
          this.heroStatus.string = 'HP ' + Math.ceil(h.hp) + '/' + h.maxHp + '  护甲 ' + core.block + (core.curse > 0 ? '  受诅咒' : '');
          this.infoLabel.string = '回合 ' + core.round + '　骰子 ' + core.dice.length;
          this.pileLabel.string = '牌库 ' + core.drawPile.length + '　弃牌 ' + core.discard.length + (core.exhausted.length ? '　消耗 ' + core.exhausted.length : '');

          // 骰子
          this.diceNode.removeAllChildren();
          var n = core.dice.length;
          var _loop3 = function _loop3() {
            var d = core.dice[i];
            var x = -((n - 1) * DIE_GAP) / 2 + i * DIE_GAP;
            var usable = !_this8.selCard || _this8.selCard.def.slot === 'none' || d !== undefined && slotOk(_this8.selCard.def.slot, d.value);
            var dn = mkNode(_this8.diceNode, 'die' + i, DIE_SIZE, DIE_SIZE, x, _this8.selDie === d ? 12 : 0);
            drawDie(dn.addComponent(Graphics), DIE_SIZE, {
              value: d.value,
              sel: _this8.selDie === d
            });
            if (!usable) {
              var op = dn.addComponent(UIOpacity);
              op.opacity = 110;
            } else if (_this8.selCard) {
              tween(dn).repeatForever(tween(dn).to(0.4, {
                scale: new Vec3(1.1, 1.1, 1)
              }).to(0.4, {
                scale: Vec3.ONE
              })).start();
            }
            var dd = d;
            dn.on(Node.EventType.TOUCH_END, function () {
              return _this8.onDieTap(dd);
            });
          };
          for (var i = 0; i < n; i++) {
            _loop3();
          }

          // 手牌
          this.handNode.removeAllChildren();
          var m = core.hand.length;
          var span = Math.min(600, (m - 1) * 150);
          var _loop4 = function _loop4() {
            var c = core.hand[_i];
            var x = m === 1 ? 0 : -span / 2 + _i * (span / (m - 1));
            var lift = _this8.selCard === c ? 26 : 0;
            var cn = mkCard(_this8.handNode, c.def, x, lift, CARD_W, CARD_H);
            var playable = core.anyPlayable() && (c.def.slot === 'none' ? core.canPlay(c, null) : core.dice.some(function (d) {
              return core.canPlay(c, d);
            }));
            var dimmed = _this8.selDie && c.def.slot !== 'none' && !slotOk(c.def.slot, _this8.selDie.value);
            if (!playable || dimmed) {
              var op = cn.node.addComponent(UIOpacity);
              op.opacity = dimmed ? 110 : 150;
            }
            var cc = c;
            cn.node.on(Node.EventType.TOUCH_END, function () {
              return _this8.onCardTap(cc);
            });
          };
          for (var _i = 0; _i < m; _i++) {
            _loop4();
          }
          var locked = this.busy || this.auto;
          setBtnEnabled(this.btnEnd, !locked, 150, 62);
          setBtnEnabled(this.btnAuto, true, 130, 62);
          this.btnAuto.label.string = this.auto ? '自动:开' : '自动:关';
        };
        _proto.log = function log(msg) {
          if (this.logLabel) {
            this.logLabel.string = msg;
          }
        };
        return BattleScreen;
      }(Component), _class2.EX = 210, _class2.EY = 415, _class2.HX = -220, _class2.HY = -30, _class2.DICE_Y = 90, _class2.HAND_Y = -390, _class2)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/Data.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        cardById: cardById,
        heroById: heroById,
        makeHero: makeHero,
        rewardOptions: rewardOptions,
        slotOk: slotOk,
        starterDeck: starterDeck
      });
      cclegacy._RF.push({}, "a606dvLJAVNb6LjpVEvgVLc", "Data", undefined); // 骰命远征 —— 数据与类型定义（单人冒险 · 骰子 × 卡牌）
      // 战斗规则：每回合掷骰并抽牌，把骰子放进卡牌的骰槽来触发效果（X = 骰子点数）。
      // ---------------- 卡牌 ----------------
      /** 骰槽条件：卡牌只接受满足条件的骰子。none = 不需要骰子，直接打出。 */
      var SLOT_TEXT = exports('SLOT_TEXT', {
        any: '任意',
        min4: '≥4',
        max3: '≤3',
        odd: '奇数',
        even: '偶数',
        six: '6',
        none: '—'
      });
      var CARDS = exports('CARDS', [
      // —— 基础 ——
      {
        id: 'strike',
        name: '斩击',
        slot: 'any',
        type: 'attack',
        desc: '造成 X 点伤害'
      }, {
        id: 'defend',
        name: '格挡',
        slot: 'any',
        type: 'skill',
        desc: '获得 X 点护甲'
      },
      // —— 通用 ——
      {
        id: 'heavy',
        name: '重劈',
        slot: 'min4',
        type: 'attack',
        desc: '造成 2X 点伤害'
      }, {
        id: 'jab',
        name: '快刺',
        slot: 'max3',
        type: 'attack',
        desc: '造成 X+4 点伤害'
      }, {
        id: 'twin',
        name: '双击',
        slot: 'even',
        type: 'attack',
        desc: '造成 X 点伤害 2 次'
      }, {
        id: 'guard',
        name: '铁壁',
        slot: 'max3',
        type: 'skill',
        desc: '获得 X+5 点护甲'
      }, {
        id: 'reroll',
        name: '重掷',
        slot: 'any',
        type: 'dice',
        desc: '重掷这颗骰子'
      }, {
        id: 'hone',
        name: '磨砺',
        slot: 'any',
        type: 'dice',
        desc: '骰子点数 +2（最高 6）'
      }, {
        id: 'flip',
        name: '翻转',
        slot: 'any',
        type: 'dice',
        desc: '骰子变为 7-X'
      }, {
        id: 'split',
        name: '分裂',
        slot: 'min4',
        type: 'dice',
        desc: '拆成两颗骰子：X÷2 向下与向上取整'
      }, {
        id: 'leech',
        name: '汲取',
        slot: 'any',
        type: 'attack',
        desc: '造成 X 点伤害，回复一半',
        rare: true
      }, {
        id: 'lucky',
        name: '幸运币',
        slot: 'none',
        type: 'dice',
        desc: '获得一颗新骰子',
        rare: true
      },
      // —— 职业 ——
      {
        id: 'starfall',
        name: '星落',
        slot: 'none',
        type: 'dice',
        desc: '重掷所有骰子',
        hero: 'astro'
      }, {
        id: 'starlight',
        name: '星辉',
        slot: 'odd',
        type: 'attack',
        desc: '造成 X+4 点伤害，抽 1 张牌',
        hero: 'astro'
      }, {
        id: 'shieldbash',
        name: '盾击',
        slot: 'any',
        type: 'attack',
        desc: '造成 X + 当前护甲÷2 点伤害',
        hero: 'bulwark'
      }, {
        id: 'bigshield',
        name: '重盾',
        slot: 'min4',
        type: 'skill',
        desc: '获得 2X 点护甲',
        hero: 'bulwark'
      }, {
        id: 'allin',
        name: '孤注一掷',
        slot: 'any',
        type: 'attack',
        desc: '重掷此骰并造成新点数伤害；若为 5-6 则伤害×3',
        hero: 'gambler'
      }, {
        id: 'coin',
        name: '幸运币',
        slot: 'none',
        type: 'dice',
        desc: '获得一颗新骰子',
        hero: 'gambler'
      }, {
        id: 'venom',
        name: '毒瓶',
        slot: 'any',
        type: 'attack',
        desc: '给予 X÷2+1 层中毒（向上取整）',
        hero: 'alch'
      }, {
        id: 'transmute',
        name: '嬗变',
        slot: 'any',
        type: 'dice',
        desc: '骰子变为 7-X，抽 1 张牌',
        hero: 'alch'
      }, {
        id: 'stab2',
        name: '连刺',
        slot: 'odd',
        type: 'attack',
        desc: '造成 X 点伤害 2 次',
        hero: 'shadow'
      }, {
        id: 'shadowstep',
        name: '暗影步',
        slot: 'max3',
        type: 'skill',
        desc: '获得 X+3 点护甲，抽 1 张牌',
        hero: 'shadow'
      }, {
        id: 'judgment',
        name: '审判',
        slot: 'min4',
        type: 'attack',
        desc: '造成 2X 点伤害，回复 2 点生命',
        hero: 'cleric'
      }, {
        id: 'holylight',
        name: '圣光',
        slot: 'even',
        type: 'attack',
        desc: '造成 X 点伤害，回复 X÷2',
        hero: 'cleric'
      }, {
        id: 'fireball',
        name: '火球',
        slot: 'six',
        type: 'attack',
        desc: '造成 16 点伤害',
        hero: 'pyro'
      }, {
        id: 'ignite',
        name: '引燃',
        slot: 'any',
        type: 'dice',
        desc: '骰子点数 +3（最高 6）',
        hero: 'pyro'
      }, {
        id: 'replicate',
        name: '复刻',
        slot: 'any',
        type: 'dice',
        desc: '复制这颗骰子',
        hero: 'tinker'
      }, {
        id: 'gearshot',
        name: '齿轮炮',
        slot: 'max3',
        type: 'attack',
        desc: '造成 X+2 点伤害 2 次',
        hero: 'tinker'
      }]);
      function cardById(id) {
        return CARDS.find(function (c) {
          return c.id === id;
        });
      }
      function slotOk(slot, v) {
        switch (slot) {
          case 'any':
            return true;
          case 'min4':
            return v >= 4;
          case 'max3':
            return v <= 3;
          case 'odd':
            return v % 2 === 1;
          case 'even':
            return v % 2 === 0;
          case 'six':
            return v === 6;
          case 'none':
            return false;
        }
        return false;
      }

      // ---------------- 英雄 ----------------

      function makeHero(def) {
        return {
          def: def,
          hp: def.maxHp,
          maxHp: def.maxHp
        };
      }
      var HEROES = exports('HEROES', [{
        id: 'astro',
        name: '占星师',
        title: '观星者',
        maxHp: 76,
        color: [142, 124, 195],
        passive: '回合开始时，自动重掷所有 1-2 点骰子',
        cards: ['starfall', 'starlight']
      }, {
        id: 'bulwark',
        name: '铁壁卫',
        title: '不动壁垒',
        maxHp: 78,
        color: [90, 120, 160],
        passive: '回合结束时保留一半护甲',
        cards: ['shieldbash', 'bigshield']
      }, {
        id: 'gambler',
        name: '赌徒',
        title: '孤注一掷',
        maxHp: 66,
        color: [200, 150, 60],
        passive: '每回合首次掷出的 1 点会翻成 6 点',
        cards: ['allin', 'coin']
      }, {
        id: 'alch',
        name: '炼金术士',
        title: '点石成金',
        maxHp: 59,
        color: [80, 160, 140],
        passive: '中毒每回合额外造成 1 点伤害',
        cards: ['venom', 'transmute']
      }, {
        id: 'shadow',
        name: '影行者',
        title: '魅影连击',
        maxHp: 67,
        color: [110, 110, 130],
        passive: '用奇数骰打出的攻击，每段伤害 +2',
        cards: ['stab2', 'shadowstep']
      }, {
        id: 'cleric',
        name: '圣愈者',
        title: '晨曦之手',
        maxHp: 62,
        color: [230, 200, 120],
        passive: '每场战斗胜利后回复 6 点生命',
        cards: ['judgment', 'holylight']
      }, {
        id: 'pyro',
        name: '烈焰术士',
        title: '焚运改命',
        maxHp: 57,
        color: [200, 90, 60],
        passive: '用 6 点骰打出的攻击，伤害 +4',
        cards: ['fireball', 'ignite']
      }, {
        id: 'tinker',
        name: '机关师',
        title: '精密复制',
        maxHp: 66,
        color: [140, 140, 150],
        passive: '回合开始时额外获得一颗 2 点骰子',
        cards: ['replicate', 'gearshot']
      }]);
      function heroById(id) {
        return HEROES.find(function (h) {
          return h.id === id;
        });
      }
      function starterDeck(def) {
        return ['strike', 'strike', 'strike', 'defend', 'defend', 'defend'].concat(def.cards);
      }

      /** 卡牌奖励：3 张不重复候选。rare=true 时从稀有卡 + 职业卡中抽（精英/宝箱）。 */
      function rewardOptions(heroId, rng, rare) {
        if (rare === void 0) {
          rare = false;
        }
        var pool = CARDS.filter(function (c) {
          return c.id !== 'strike' && c.id !== 'defend' && (!c.hero || c.hero === heroId) && (rare ? c.rare || !!c.hero : !c.rare);
        }).map(function (c) {
          return c.id;
        });
        var out = [];
        while (out.length < 3 && pool.length > 0) {
          out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
        }
        return out;
      }

      // ---------------- 敌人（杀戮尖塔式意图） ----------------

      var NORMAL_ENEMIES = exports('NORMAL_ENEMIES', [{
        id: 'imp',
        name: '哥布林斥候',
        maxHp: 30,
        goldMin: 15,
        goldMax: 25,
        desc: '黑森林里成群出没的绿皮小贼',
        pattern: [{
          type: 'atk',
          dmg: 6
        }, {
          type: 'atk',
          dmg: 3,
          hits: 2
        }, {
          type: 'atkblock',
          dmg: 4,
          block: 5
        }]
      }, {
        id: 'golem',
        name: '锈甲傀儡',
        maxHp: 42,
        goldMin: 18,
        goldMax: 28,
        desc: '古堡废墟中游荡的空心铠甲',
        pattern: [{
          type: 'block',
          block: 8
        }, {
          type: 'atk',
          dmg: 9
        }, {
          type: 'atk',
          dmg: 5,
          hits: 2
        }]
      }, {
        id: 'viper',
        name: '沼泽蜥人',
        maxHp: 34,
        goldMin: 15,
        goldMax: 25,
        desc: '出手频繁，越战越凶',
        pattern: [{
          type: 'atk',
          dmg: 2,
          hits: 3
        }, {
          type: 'atk',
          dmg: 7
        }, {
          type: 'buff',
          str: 1
        }]
      }]);
      var ELITES = exports('ELITES', [{
        id: 'lich',
        name: '厄运巫妖',
        maxHp: 72,
        goldMin: 40,
        goldMax: 55,
        elite: true,
        desc: '诅咒会让你下回合少一颗骰子',
        pattern: [{
          type: 'curse'
        }, {
          type: 'atk',
          dmg: 9
        }, {
          type: 'atk',
          dmg: 5,
          hits: 2
        }, {
          type: 'block',
          block: 10
        }]
      }, {
        id: 'troll',
        name: '山岭巨魔',
        maxHp: 86,
        goldMin: 40,
        goldMax: 60,
        elite: true,
        desc: '留意它的意图：蓄力重击高达 16 点',
        pattern: [{
          type: 'atk',
          dmg: 6
        }, {
          type: 'atk',
          dmg: 16
        }, {
          type: 'block',
          block: 8
        }]
      }]);
      var BOSS = exports('BOSS', {
        id: 'boss',
        name: '骰命魔龙',
        maxHp: 130,
        goldMin: 90,
        goldMax: 120,
        boss: true,
        desc: '盘踞龙巢的远古巨龙。血量过半时狂暴（力量+3）',
        pattern: [{
          type: 'atk',
          dmg: 10
        }, {
          type: 'atkblock',
          dmg: 6,
          block: 10
        }, {
          type: 'atk',
          dmg: 4,
          hits: 3
        }, {
          type: 'curse'
        }, {
          type: 'buff',
          str: 2
        }]
      });

      // ---------------- 事件 ----------------

      var EVENTS = exports('EVENTS', [{
        id: 'meteor',
        title: '流星坠夜',
        text: '一颗骰形的陨星砸落营地旁，余温尚在。',
        options: [{
          label: '拾取星屑（+45 金币）',
          apply: 'gold45'
        }, {
          label: '对星许愿（恢复 25% 生命）',
          apply: 'heal25'
        }]
      }, {
        id: 'altar',
        title: '废弃祭坛',
        text: '古老的祭坛上刻着：以血换运。',
        options: [{
          label: '献上鲜血（失去 15% 生命，每回合 +1 骰子）',
          apply: 'blooddie'
        }, {
          label: '默默离开',
          apply: 'none'
        }]
      }, {
        id: 'well',
        title: '回声古井',
        text: '井水清澈，投入硬币会听见骰子落盘的声音。',
        options: [{
          label: '饮下井水（恢复 20% 生命）',
          apply: 'heal20'
        }, {
          label: '投入 30 金币（获得一张稀有卡）',
          apply: 'buyrare'
        }]
      }]);

      // ---------------- 运行状态 ----------------

      // 地图横坐标槽位（竖屏）
      var COLUMN_X = exports('COLUMN_X', [-240, -80, 80, 240]);

      // ---------------- 规则常量 ----------------

      var RULES = exports('RULES', {
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
        restHealPct: 0.3
      });
      var NODE_NAME = exports('NODE_NAME', {
        battle: '遭遇战',
        elite: '精英战',
        treasure: '宝箱',
        event: '奇遇',
        rest: '营火',
        boss: '首领'
      });
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/Figures.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './UI.ts'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, Color, Graphics, UITransform, Vec3, tween, UIOpacity, Tween, mkNode, jelly, squashHit, squashDeath, fall;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      Color = module.Color;
      Graphics = module.Graphics;
      UITransform = module.UITransform;
      Vec3 = module.Vec3;
      tween = module.tween;
      UIOpacity = module.UIOpacity;
      Tween = module.Tween;
    }, function (module) {
      mkNode = module.mkNode;
      jelly = module.jelly;
      squashHit = module.squashHit;
      squashDeath = module.squashDeath;
      fall = module.fall;
    }],
    execute: function () {
      exports({
        buildPortrait: buildPortrait,
        buildRig: buildRig,
        burst: burst,
        castFx: castFx,
        centerOf: centerOf,
        die: die,
        enemyAttack: enemyAttack,
        enrage: enrage,
        heroAttack: heroAttack,
        hurt: hurt,
        posIn: posIn,
        rigIdle: rigIdle
      });
      cclegacy._RF.push({}, "b7d77VFDpVGgI5bumNwJMkd", "Figures", undefined);
      var OUT = new Color(38, 26, 20, 255);
      var SKIN = new Color(238, 200, 164, 255);
      var GOLD = new Color(214, 172, 72, 255);
      var STEEL = new Color(170, 174, 186, 255);
      var BONE = new Color(226, 218, 198, 255);
      function C(r, g, b, a) {
        if (a === void 0) {
          a = 255;
        }
        return new Color(r, g, b, a);
      }
      // ---------------- 绘制小工具（坐标单位 u = 身高/100，脚底 y=0，面朝 +x） ----------------

      function paint(g, fill, u) {
        g.fillColor = fill;
        g.strokeColor = OUT;
        g.lineWidth = Math.max(1.2, 1.7 * u);
      }
      function fs(g) {
        g.fill();
        g.stroke();
      }
      function poly(g, u, p, stroke) {
        if (stroke === void 0) {
          stroke = true;
        }
        g.moveTo(p[0] * u, p[1] * u);
        for (var i = 2; i < p.length; i += 2) {
          g.lineTo(p[i] * u, p[i + 1] * u);
        }
        g.close();
        if (stroke) {
          fs(g);
        } else {
          g.fill();
        }
      }
      function rr(g, u, x, y, w, h, r, stroke) {
        if (stroke === void 0) {
          stroke = true;
        }
        g.roundRect(x * u, y * u, w * u, h * u, r * u);
        if (stroke) {
          fs(g);
        } else {
          g.fill();
        }
      }
      function circ(g, u, x, y, r, stroke) {
        if (stroke === void 0) {
          stroke = true;
        }
        g.circle(x * u, y * u, r * u);
        if (stroke) {
          fs(g);
        } else {
          g.fill();
        }
      }
      function ell(g, u, x, y, rx, ry, stroke) {
        if (stroke === void 0) {
          stroke = true;
        }
        g.ellipse(x * u, y * u, rx * u, ry * u);
        if (stroke) {
          fs(g);
        } else {
          g.fill();
        }
      }
      function dot(g, u, x, y, r, c) {
        g.fillColor = c;
        circ(g, u, x, y, r, false);
      }
      function star(g, u, x, y, r, c) {
        g.fillColor = c;
        var p = [];
        for (var i = 0; i < 10; i++) {
          var a = Math.PI / 2 + i * Math.PI / 5;
          var rad = i % 2 === 0 ? r : r * 0.45;
          p.push(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
        }
        poly(g, u, p, false);
      }
      function boots(g, u, c, h) {
        if (h === void 0) {
          h = 10;
        }
        paint(g, c, u);
        rr(g, u, -13, 0, 10, h, 2.5);
        rr(g, u, 3, 0, 10, h, 2.5);
      }
      function eyes(g, u, x, y, c, r) {
        if (c === void 0) {
          c = C(30, 22, 20);
        }
        if (r === void 0) {
          r = 1.7;
        }
        dot(g, u, x, y, r, c);
        dot(g, u, x + 4.6, y, r, c);
      }
      function sleeve(g, u, c, len, w) {
        if (len === void 0) {
          len = 16;
        }
        if (w === void 0) {
          w = 4;
        }
        paint(g, c, u);
        poly(g, u, [-w, 2, w, 2, w + 0.6, -len, -w - 0.6, -len]);
      }
      function hand(g, u, y, c, r) {
        if (c === void 0) {
          c = SKIN;
        }
        if (r === void 0) {
          r = 3.5;
        }
        paint(g, c, u);
        circ(g, u, 0, y, r);
      }

      // ---------------- 角色规格 ----------------

      var SPECS = {
        // ===== 英雄 =====
        astro: {
          // 占星师：尖顶星袍巫师，白须，星辉法杖
          fx: C(150, 170, 255),
          body: function body(g, u) {
            boots(g, u, C(60, 44, 70));
            paint(g, C(86, 64, 150), u);
            poly(g, u, [-19, 6, 19, 6, 11, 56, -11, 56]);
            paint(g, GOLD, u);
            poly(g, u, [-19, 6, 19, 6, 18, 10, -18, 10]);
            paint(g, C(90, 60, 36), u);
            rr(g, u, -11, 34, 22, 4, 1);
            star(g, u, -8, 20, 3, GOLD);
            star(g, u, 7, 26, 2.4, GOLD);
            star(g, u, -3, 46, 2.2, GOLD);
            paint(g, SKIN, u);
            circ(g, u, 2, 66, 12);
            paint(g, C(238, 238, 232), u);
            poly(g, u, [-5, 64, 14, 64, 11, 50, 3, 37, -3, 52]);
            paint(g, SKIN, u);
            circ(g, u, 13.5, 66, 2.5);
            eyes(g, u, 5.5, 69.5);
            paint(g, C(70, 48, 128), u);
            ell(g, u, 2, 77, 21, 4.5);
            g.moveTo(-11 * u, 78 * u);
            g.lineTo(15 * u, 78 * u);
            g.quadraticCurveTo(10 * u, 94 * u, -8 * u, 112 * u);
            g.quadraticCurveTo(-5 * u, 94 * u, -11 * u, 78 * u);
            g.close();
            fs(g);
            paint(g, GOLD, u);
            poly(g, u, [-11, 78, 15, 78, 13.6, 83, -10, 83]);
            star(g, u, 2, 92, 3.6, C(250, 220, 120));
          },
          arm: {
            x: 10,
            y: 48,
            draw: function draw(g, u) {
              paint(g, C(110, 74, 40), u);
              rr(g, u, -1.6, -34, 3.2, 68, 1.5);
              sleeve(g, u, C(86, 64, 150));
              hand(g, u, -19);
            }
          },
          extras: [{
            name: 'orb',
            x: 0,
            y: 37,
            onArm: true,
            draw: function draw(g, u) {
              dot(g, u, 0, 0, 9, C(140, 190, 255, 80));
              paint(g, C(170, 220, 255), u);
              circ(g, u, 0, 0, 5);
              dot(g, u, -1.6, 1.6, 1.6, C(255, 255, 255));
            }
          }],
          tip: {
            x: 0,
            y: 37,
            onArm: true
          }
        },
        bulwark: {
          // 铁壁卫：大桶盔骑士，红羽红罩袍，鸢盾长剑
          fx: C(170, 200, 240),
          body: function body(g, u) {
            boots(g, u, C(120, 124, 136), 14);
            paint(g, C(150, 154, 166), u);
            ell(g, u, -10, 52, 8, 5);
            paint(g, STEEL, u);
            rr(g, u, -15, 12, 30, 42, 6);
            paint(g, C(150, 34, 34), u);
            poly(g, u, [-10, 12, 10, 12, 9, 52, -9, 52]);
            paint(g, GOLD, u);
            rr(g, u, -1.5, 22, 3, 22, 0.8, false);
            rr(g, u, -7, 36, 14, 3, 0.8, false);
            paint(g, C(90, 60, 36), u);
            rr(g, u, -15, 26, 30, 4, 1);
            paint(g, C(180, 30, 30), u);
            poly(g, u, [-1, 78, -8, 93, -21, 90, -14, 82]);
            paint(g, STEEL, u);
            rr(g, u, -11, 52, 24, 26, 6);
            ell(g, u, 1, 77, 12, 4);
            g.fillColor = C(20, 20, 26);
            rr(g, u, 3, 64, 11, 2.6, 1, false);
            rr(g, u, 8, 58, 2.4, 10, 1, false);
            paint(g, C(44, 72, 140), u);
            g.moveTo(8 * u, 50 * u);
            g.lineTo(28 * u, 50 * u);
            g.lineTo(28 * u, 32 * u);
            g.quadraticCurveTo(28 * u, 16 * u, 18 * u, 8 * u);
            g.quadraticCurveTo(8 * u, 16 * u, 8 * u, 32 * u);
            g.close();
            fs(g);
            g.fillColor = C(232, 220, 190);
            rr(g, u, 16.8, 14, 2.4, 32, 0.8, false);
            rr(g, u, 10, 36, 16, 2.4, 0.8, false);
          },
          arm: {
            x: -9,
            y: 48,
            draw: function draw(g, u) {
              paint(g, C(214, 218, 228), u);
              poly(g, u, [-1.8, -14, 1.8, -14, 1.8, 26, 0, 31, -1.8, 26]);
              paint(g, GOLD, u);
              rr(g, u, -6, -15, 12, 2.6, 1);
              paint(g, C(90, 60, 36), u);
              rr(g, u, -1.4, -22, 2.8, 7, 1);
              sleeve(g, u, STEEL, 14);
              hand(g, u, -18, STEEL, 4);
            }
          },
          tip: {
            x: 0,
            y: 30,
            onArm: true
          }
        },
        gambler: {
          // 赌徒：三角帽火枪手，八字胡，金色短上衣，红披风
          fx: C(255, 210, 90),
          back: [{
            name: 'cape',
            x: 0,
            y: 0,
            draw: function draw(g, u) {
              paint(g, C(150, 36, 40), u);
              poly(g, u, [-6, 54, 6, 54, -4, 14, -21, 9]);
            }
          }],
          body: function body(g, u) {
            boots(g, u, C(70, 44, 30), 16);
            paint(g, C(60, 50, 80), u);
            rr(g, u, -13, 14, 26, 10, 3);
            paint(g, C(204, 150, 58), u);
            rr(g, u, -13, 22, 26, 32, 6);
            paint(g, C(170, 36, 40), u);
            poly(g, u, [-13, 40, -13, 34, 13, 48, 13, 54]);
            dot(g, u, 5, 30, 1.2, C(60, 40, 30));
            dot(g, u, 5, 25, 1.2, C(60, 40, 30));
            paint(g, C(244, 240, 230), u);
            ell(g, u, 1, 55, 12, 3.5);
            paint(g, SKIN, u);
            circ(g, u, 2, 66, 11.5);
            g.fillColor = C(60, 36, 24);
            ell(g, u, 8, 61.6, 4, 1.5, false);
            ell(g, u, 14, 61.6, 4, 1.5, false);
            paint(g, SKIN, u);
            circ(g, u, 13.5, 65, 2.2);
            eyes(g, u, 5.5, 68.5);
            paint(g, C(54, 36, 28), u);
            poly(g, u, [-15, 74, 18, 74, 12, 86, 1, 90, -10, 86]);
            paint(g, GOLD, u);
            poly(g, u, [-15, 74, 18, 74, 16, 77, -13, 77]);
            paint(g, C(236, 232, 222), u);
            poly(g, u, [-8, 84, -23, 98, -16, 86]);
          },
          arm: {
            x: 9,
            y: 46,
            draw: function draw(g, u) {
              sleeve(g, u, C(204, 150, 58), 15, 3.6);
              paint(g, C(244, 240, 230), u);
              rr(g, u, -4.6, -18, 9.2, 3, 1);
              hand(g, u, -21, SKIN, 3.4);
              paint(g, C(240, 200, 70), u);
              circ(g, u, 3, -24, 4);
              dot(g, u, 3, -24, 1.8, C(200, 150, 40));
            }
          },
          tip: {
            x: 3,
            y: -24,
            onArm: true
          }
        },
        alch: {
          // 炼金术士：皮围裙，铜框护目镜，药剂瓶
          fx: C(110, 230, 140),
          body: function body(g, u) {
            boots(g, u, C(70, 50, 34));
            paint(g, C(102, 76, 52), u);
            poly(g, u, [-17, 6, 17, 6, 12, 54, -12, 54]);
            paint(g, C(168, 128, 82), u);
            poly(g, u, [-6, 10, 12, 10, 11, 48, -4, 48]);
            paint(g, C(140, 104, 64), u);
            rr(g, u, 0, 20, 8, 7, 1.5);
            paint(g, C(70, 50, 34), u);
            rr(g, u, -14, 32, 28, 4, 1);
            paint(g, C(200, 60, 60), u);
            circ(g, u, -9, 30, 2.6);
            paint(g, C(80, 120, 220), u);
            circ(g, u, -3, 30, 2.6);
            paint(g, C(172, 172, 166), u);
            ell(g, u, -5, 68, 9, 9);
            paint(g, SKIN, u);
            circ(g, u, 2, 64, 11.5);
            paint(g, SKIN, u);
            circ(g, u, 13.5, 62, 2.2);
            eyes(g, u, 5.5, 64);
            paint(g, C(190, 150, 70), u);
            rr(g, u, -8, 70, 22, 3, 1);
            paint(g, C(120, 200, 200), u);
            circ(g, u, 5, 72, 3.4);
            circ(g, u, 11, 72, 3.4);
            paint(g, C(172, 172, 166), u);
            poly(g, u, [-9, 74, -3, 79, 6, 78, 13, 75, 4, 76]);
          },
          arm: {
            x: 9,
            y: 44,
            draw: function draw(g, u) {
              sleeve(g, u, C(102, 76, 52), 14);
              hand(g, u, -16);
              paint(g, C(210, 236, 228), u);
              rr(g, u, 2.6, -16, 2.8, 6, 1);
              paint(g, C(90, 210, 120), u);
              circ(g, u, 4, -21, 5.5);
              dot(g, u, 2.4, -19.6, 1.3, C(230, 255, 230));
            }
          },
          tip: {
            x: 4,
            y: -21,
            onArm: true
          }
        },
        shadow: {
          // 影行者：兜帽斗篷刺客，发光双眼，反握匕首
          fx: C(140, 240, 255),
          back: [{
            name: 'cape',
            x: 0,
            y: 0,
            draw: function draw(g, u) {
              paint(g, C(40, 40, 52), u);
              poly(g, u, [-4, 58, 6, 58, -6, 8, -25, 3]);
            }
          }],
          body: function body(g, u) {
            boots(g, u, C(36, 34, 40));
            paint(g, C(58, 58, 74), u);
            poly(g, u, [-14, 8, 14, 8, 10, 56, -10, 56]);
            paint(g, C(90, 60, 36), u);
            rr(g, u, -14, 30, 28, 3, 1);
            paint(g, C(120, 34, 40), u);
            rr(g, u, -9, 50, 20, 6, 3);
            paint(g, C(52, 52, 68), u);
            g.moveTo(-12 * u, 57 * u);
            g.quadraticCurveTo(-14 * u, 84 * u, 4 * u, 87 * u);
            g.quadraticCurveTo(19 * u, 82 * u, 16 * u, 61 * u);
            g.close();
            fs(g);
            g.fillColor = C(16, 16, 22);
            ell(g, u, 7, 68, 7, 7.5, false);
            eyes(g, u, 5, 69, C(140, 240, 255), 1.6);
          },
          arm: {
            x: 8,
            y: 46,
            draw: function draw(g, u) {
              sleeve(g, u, C(58, 58, 74), 15, 3.6);
              paint(g, C(214, 218, 228), u);
              poly(g, u, [-1.4, -19, 1.4, -19, 1.0, -32, 0, -35, -1.0, -32]);
              paint(g, C(90, 60, 36), u);
              rr(g, u, -3.6, -19.4, 7.2, 1.8, 0.8);
              hand(g, u, -17, C(40, 36, 40), 3.4);
            }
          },
          tip: {
            x: 0,
            y: -33,
            onArm: true
          }
        },
        cleric: {
          // 圣愈者：白袍修女，金色光环，十字圣杖
          fx: C(255, 230, 130),
          back: [{
            name: 'halo',
            x: 3,
            y: 86,
            draw: function draw(g, u) {
              g.strokeColor = C(250, 214, 100);
              g.lineWidth = 2.2 * u;
              g.ellipse(0, 0, 11 * u, 3 * u);
              g.stroke();
            }
          }],
          body: function body(g, u) {
            boots(g, u, C(150, 130, 100));
            paint(g, C(236, 232, 220), u);
            poly(g, u, [-18, 4, 18, 4, 11, 56, -11, 56]);
            paint(g, GOLD, u);
            poly(g, u, [-18, 4, 18, 4, 17, 8, -17, 8]);
            paint(g, GOLD, u);
            rr(g, u, 1, 37, 2.6, 11, 0.8, false);
            rr(g, u, -1.8, 42.4, 8.2, 2.6, 0.8, false);
            paint(g, C(120, 90, 60), u);
            rr(g, u, -13, 30, 26, 2.6, 1);
            paint(g, C(244, 242, 236), u);
            circ(g, u, 2, 67, 14);
            paint(g, SKIN, u);
            ell(g, u, 6.5, 66, 7.5, 9.5);
            eyes(g, u, 6, 68);
          },
          arm: {
            x: 9,
            y: 47,
            draw: function draw(g, u) {
              paint(g, C(200, 160, 80), u);
              rr(g, u, -1.4, -30, 2.8, 64, 1.2);
              paint(g, GOLD, u);
              rr(g, u, -1.6, 33, 3.2, 13, 1);
              rr(g, u, -5.4, 39, 10.8, 3, 1);
              sleeve(g, u, C(236, 232, 220));
              hand(g, u, -18);
            }
          },
          tip: {
            x: 0,
            y: 42,
            onArm: true
          }
        },
        pyro: {
          // 烈焰术士：红色尖兜帽法袍，火焰纹下摆，掌心火球
          fx: C(255, 150, 60),
          body: function body(g, u) {
            boots(g, u, C(70, 30, 24));
            paint(g, C(168, 48, 36), u);
            poly(g, u, [-17, 6, 17, 6, 12, 54, -12, 54]);
            g.fillColor = C(240, 140, 40);
            for (var i = 0; i < 4; i++) {
              var x = -16 + 8 * i;
              poly(g, u, [x, 6, x + 8, 6, x + 4, 16], false);
            }
            paint(g, C(30, 24, 22), u);
            rr(g, u, -13, 30, 26, 3.6, 1);
            paint(g, GOLD, u);
            rr(g, u, -2, 29.6, 5, 4.4, 1);
            paint(g, C(150, 40, 30), u);
            g.moveTo(-12 * u, 57 * u);
            g.quadraticCurveTo(-13 * u, 82 * u, -3 * u, 95 * u);
            g.quadraticCurveTo(10 * u, 84 * u, 16 * u, 63 * u);
            g.close();
            fs(g);
            g.fillColor = C(40, 20, 18);
            ell(g, u, 7, 67, 7, 8, false);
            eyes(g, u, 5, 68, C(255, 170, 60), 1.6);
          },
          arm: {
            x: 9,
            y: 46,
            draw: function draw(g, u) {
              sleeve(g, u, C(168, 48, 36));
              hand(g, u, -18);
            }
          },
          extras: [{
            name: 'flame',
            x: 2,
            y: -25,
            onArm: true,
            draw: function draw(g, u) {
              g.fillColor = C(255, 130, 40, 230);
              g.moveTo(0, -6 * u);
              g.quadraticCurveTo(8 * u, 2 * u, 0, 13 * u);
              g.quadraticCurveTo(-8 * u, 2 * u, 0, -6 * u);
              g.close();
              g.fill();
              g.fillColor = C(255, 230, 120);
              g.moveTo(0, -3 * u);
              g.quadraticCurveTo(4 * u, 1 * u, 0, 7 * u);
              g.quadraticCurveTo(-4 * u, 1 * u, 0, -3 * u);
              g.close();
              g.fill();
            }
          }],
          tip: {
            x: 2,
            y: -22,
            onArm: true
          }
        },
        tinker: {
          // 机关师：矮人工匠，大胡子，皮帽护目镜，战锤
          fx: C(230, 190, 100),
          body: function body(g, u) {
            paint(g, C(80, 56, 36), u);
            rr(g, u, -16, 0, 13, 9, 2.5);
            rr(g, u, 3, 0, 13, 9, 2.5);
            paint(g, C(90, 70, 50), u);
            rr(g, u, -14, 8, 28, 8, 2);
            paint(g, C(126, 92, 58), u);
            rr(g, u, -19, 14, 38, 30, 8);
            paint(g, C(60, 44, 30), u);
            rr(g, u, -19, 22, 38, 5, 1.5);
            paint(g, C(200, 160, 70), u);
            rr(g, u, -3, 21.4, 7, 6, 1);
            paint(g, SKIN, u);
            circ(g, u, 3, 56, 11);
            paint(g, C(184, 98, 44), u);
            poly(g, u, [-6, 53, 16, 53, 15, 40, 6, 25, -3, 37]);
            paint(g, SKIN, u);
            circ(g, u, 14.5, 56, 3.4);
            eyes(g, u, 6.5, 59.5);
            paint(g, C(110, 76, 48), u);
            g.moveTo(-9 * u, 60 * u);
            g.quadraticCurveTo(3 * u, 77 * u, 15 * u, 60 * u);
            g.close();
            fs(g);
            paint(g, C(190, 150, 70), u);
            rr(g, u, -6, 61, 20, 3, 1);
            paint(g, C(120, 190, 220), u);
            circ(g, u, 6, 63.4, 3);
            circ(g, u, 12, 63.4, 3);
          },
          arm: {
            x: 13,
            y: 38,
            draw: function draw(g, u) {
              paint(g, C(110, 74, 40), u);
              rr(g, u, -1.4, -14, 2.8, 32, 1);
              paint(g, STEEL, u);
              rr(g, u, -8, 15, 16, 9, 2);
              sleeve(g, u, C(126, 92, 58), 10, 4.4);
              hand(g, u, -12, SKIN, 4);
            }
          },
          tip: {
            x: 0,
            y: 19,
            onArm: true
          }
        },
        // ===== 敌人（同样面朝 +x 绘制，构建时镜像） =====
        imp: {
          // 哥布林斥候
          fx: C(160, 220, 90),
          body: function body(g, u) {
            var sk = C(112, 160, 72);
            paint(g, sk, u);
            rr(g, u, -8, 0, 5, 11, 2);
            rr(g, u, 3, 0, 5, 11, 2);
            paint(g, sk, u);
            ell(g, u, 0, 26, 13, 14);
            paint(g, C(110, 76, 46), u);
            poly(g, u, [-12, 18, 12, 18, 8, 8, 2, 12, -4, 7, -10, 12]);
            paint(g, sk, u);
            poly(g, u, [-9, 56, -27, 64, -11, 46]);
            circ(g, u, 2, 50, 15);
            poly(g, u, [11, 56, 29, 64, 13, 46]);
            poly(g, u, [14, 51, 23, 46, 14, 46]);
            paint(g, C(250, 220, 60), u);
            circ(g, u, 5, 53, 3);
            circ(g, u, 11, 53, 3);
            dot(g, u, 6, 53, 1.3, C(20, 20, 20));
            dot(g, u, 12, 53, 1.3, C(20, 20, 20));
            g.fillColor = C(250, 248, 236);
            poly(g, u, [4, 42, 6, 39, 8, 42], false);
            poly(g, u, [9, 42, 11, 39, 13, 42], false);
          },
          arm: {
            x: 8,
            y: 30,
            draw: function draw(g, u) {
              paint(g, C(170, 130, 100), u);
              poly(g, u, [-1.6, -12, 1.6, -12, 1.2, 4, 0, 8, -1.2, 4]);
              sleeve(g, u, C(112, 160, 72), 10, 2.6);
              hand(g, u, -12, C(112, 160, 72), 3);
            }
          },
          tip: {
            x: 0,
            y: 6,
            onArm: true
          }
        },
        golem: {
          // 锈甲傀儡
          fx: C(120, 200, 255),
          body: function body(g, u) {
            var rust = C(150, 98, 62);
            boots(g, u, C(100, 62, 40), 9);
            paint(g, C(140, 90, 58), u);
            rr(g, u, -12, 8, 9, 14, 2);
            rr(g, u, 3, 8, 9, 14, 2);
            paint(g, C(40, 30, 26), u);
            rr(g, u, -14, 18, 28, 5, 1);
            paint(g, rust, u);
            rr(g, u, -18, 21, 36, 35, 8);
            for (var _i = 0, _arr = [[-12, 50], [12, 50], [-12, 27], [12, 27]]; _i < _arr.length; _i++) {
              var p = _arr[_i];
              dot(g, u, p[0], p[1], 1.4, C(70, 44, 30));
            }
            dot(g, u, -6, 40, 3, C(100, 120, 70, 200));
            dot(g, u, 8, 32, 2.2, C(100, 120, 70, 200));
            paint(g, C(130, 84, 54), u);
            ell(g, u, -16, 54, 10, 6);
            ell(g, u, 16, 54, 10, 6);
            paint(g, rust, u);
            rr(g, u, -10, 56, 22, 22, 6);
            g.fillColor = C(16, 14, 18);
            rr(g, u, 0, 64, 12, 3.6, 1, false);
            dot(g, u, 4, 65.8, 1.6, C(120, 200, 255));
            dot(g, u, 9, 65.8, 1.6, C(120, 200, 255));
          },
          arm: {
            x: 14,
            y: 48,
            draw: function draw(g, u) {
              paint(g, C(176, 150, 130), u);
              poly(g, u, [-2.4, -16, 2.4, -16, 2.4, 22, 0, 27, -2.4, 22]);
              paint(g, C(90, 60, 36), u);
              rr(g, u, -7, -17, 14, 3, 1);
              sleeve(g, u, C(150, 98, 62), 14, 5);
              hand(g, u, -18, C(120, 80, 54), 5);
            }
          },
          tip: {
            x: 0,
            y: 26,
            onArm: true
          }
        },
        viper: {
          // 沼泽蜥人
          fx: C(120, 230, 180),
          back: [{
            name: 'tail',
            x: 0,
            y: 0,
            draw: function draw(g, u) {
              paint(g, C(64, 132, 112), u);
              poly(g, u, [-8, 14, -34, 4, -42, 10, -10, 24]);
            }
          }],
          body: function body(g, u) {
            var sc = C(64, 132, 112);
            paint(g, sc, u);
            rr(g, u, -10, 0, 7, 14, 3);
            rr(g, u, 3, 0, 7, 14, 3);
            paint(g, sc, u);
            ell(g, u, 0, 30, 13, 18);
            paint(g, C(220, 200, 130), u);
            ell(g, u, 4, 28, 7, 13);
            paint(g, C(220, 100, 50), u);
            poly(g, u, [-6, 52, -3, 65, 3, 57, 8, 63, 11, 55]);
            paint(g, sc, u);
            poly(g, u, [-4, 52, 10, 58, 25, 52, 25, 46, 8, 44, -4, 46]);
            paint(g, C(250, 220, 60), u);
            circ(g, u, 10, 52, 2.6);
            g.fillColor = C(20, 20, 20);
            rr(g, u, 9.6, 50, 0.9, 4, 0.4, false);
            g.fillColor = C(250, 248, 236);
            for (var i = 0; i < 3; i++) {
              poly(g, u, [14 + i * 3.6, 46, 15.8 + i * 3.6, 43, 17.6 + i * 3.6, 46], false);
            }
          },
          arm: {
            x: 8,
            y: 40,
            draw: function draw(g, u) {
              paint(g, C(110, 74, 40), u);
              rr(g, u, -1.2, -28, 2.4, 68, 1);
              paint(g, STEEL, u);
              poly(g, u, [-3.4, 39, 3.4, 39, 0, 51]);
              sleeve(g, u, C(64, 132, 112), 12, 3.4);
              hand(g, u, -14, C(64, 132, 112), 3.2);
            }
          },
          tip: {
            x: 0,
            y: 49,
            onArm: true
          }
        },
        lich: {
          // 厄运巫妖
          fx: C(130, 255, 150),
          body: function body(g, u) {
            paint(g, C(76, 44, 96), u);
            poly(g, u, [-18, 0, -12, 6, -6, 0, 0, 6, 6, 0, 12, 6, 18, 0, 12, 56, -12, 56]);
            paint(g, BONE, u);
            rr(g, u, -12, 30, 24, 3, 1);
            paint(g, C(56, 30, 72), u);
            circ(g, u, 0, 66, 15);
            paint(g, BONE, u);
            circ(g, u, 3, 66, 11);
            rr(g, u, -1, 54.6, 10, 5, 2);
            g.fillColor = C(20, 14, 24);
            circ(g, u, 6, 67, 3, false);
            circ(g, u, 11.5, 67, 3, false);
            dot(g, u, 6, 67, 1.4, C(130, 255, 150));
            dot(g, u, 11.5, 67, 1.4, C(130, 255, 150));
            paint(g, C(196, 160, 70), u);
            poly(g, u, [-7, 74, 13, 74, 13, 82, 9, 78, 6, 84, 3, 78, -1, 84, -4, 78, -7, 82]);
          },
          arm: {
            x: 10,
            y: 46,
            draw: function draw(g, u) {
              paint(g, C(60, 40, 50), u);
              rr(g, u, -1.5, -30, 3, 70, 1.2);
              paint(g, BONE, u);
              circ(g, u, 0, 42, 5);
              paint(g, C(76, 44, 96), u);
              poly(g, u, [-5, 2, 5, 2, 7, -14, -7, -14]);
              hand(g, u, -17, BONE, 3);
            }
          },
          extras: [{
            name: 'orb',
            x: 0,
            y: 42,
            onArm: true,
            draw: function draw(g, u) {
              dot(g, u, 0, 0, 9, C(120, 255, 140, 70));
              dot(g, u, 0, 0, 2.2, C(140, 255, 160));
            }
          }],
          tip: {
            x: 0,
            y: 42,
            onArm: true
          }
        },
        troll: {
          // 山岭巨魔
          fx: C(200, 170, 110),
          body: function body(g, u) {
            var sk = C(118, 140, 106);
            paint(g, sk, u);
            rr(g, u, -18, 0, 14, 16, 4);
            rr(g, u, 4, 0, 14, 16, 4);
            paint(g, C(120, 90, 60), u);
            poly(g, u, [-20, 14, 20, 14, 16, 4, 6, 10, -2, 4, -12, 10]);
            paint(g, sk, u);
            ell(g, u, 0, 34, 24, 22);
            paint(g, C(150, 168, 130), u);
            ell(g, u, 4, 30, 14, 13);
            paint(g, sk, u);
            circ(g, u, 14, 56, 12);
            paint(g, C(90, 110, 80), u);
            rr(g, u, 8, 59, 14, 3, 1.5);
            eyes(g, u, 15.5, 57, C(240, 200, 60), 1.8);
            paint(g, C(244, 240, 226), u);
            poly(g, u, [18, 49, 20, 43, 22, 49]);
            poly(g, u, [12, 49, 14, 44, 16, 49]);
          },
          arm: {
            x: 16,
            y: 44,
            draw: function draw(g, u) {
              paint(g, C(130, 90, 50), u);
              poly(g, u, [-2.6, -24, 2.6, -24, 7.5, 26, 0, 33, -7.5, 26]);
              dot(g, u, -2, 18, 1.6, C(80, 56, 30));
              dot(g, u, 3, 10, 1.4, C(80, 56, 30));
              paint(g, C(118, 140, 106), u);
              poly(g, u, [-5, 2, 5, 2, 6, -20, -6, -20]);
              circ(g, u, 0, -22, 6);
            }
          },
          tip: {
            x: 0,
            y: 28,
            onArm: true
          }
        },
        boss: {
          // 骰命魔龙
          fx: C(255, 120, 40),
          back: [{
            name: 'aura',
            x: 2,
            y: 46,
            draw: function draw(g, u) {
              dot(g, u, 0, 0, 50, C(255, 60, 30, 70));
              dot(g, u, 0, 0, 36, C(255, 90, 40, 70));
            }
          }, {
            name: 'wingB',
            x: -8,
            y: 60,
            draw: function draw(g, u) {
              paint(g, C(110, 24, 30), u);
              poly(g, u, [0, 0, -30, 30, -46, 18, -42, 0, -32, 6, -28, -10, -18, -2, -12, -12, 0, -6]);
            }
          }, {
            name: 'wingF',
            x: 2,
            y: 62,
            draw: function draw(g, u) {
              paint(g, C(150, 34, 36), u);
              poly(g, u, [0, 0, -24, 34, -40, 24, -36, 6, -26, 10, -22, -6, -12, 2, -6, -8, 0, -4]);
              g.strokeColor = C(80, 16, 20);
              g.lineWidth = 1.4 * u;
              g.moveTo(0, 0);
              g.lineTo(-36 * u, 6 * u);
              g.stroke();
              g.moveTo(0, 0);
              g.lineTo(-22 * u, -6 * u);
              g.stroke();
            }
          }],
          body: function body(g, u) {
            var red = C(170, 40, 36);
            paint(g, red, u);
            poly(g, u, [-10, 20, -34, 10, -50, 18, -42, 23, -30, 19, -8, 31]);
            paint(g, C(80, 16, 20), u);
            poly(g, u, [-50, 18, -58, 14, -52, 24]);
            paint(g, red, u);
            rr(g, u, -16, 0, 12, 16, 4);
            rr(g, u, 6, 0, 12, 16, 4);
            g.fillColor = C(240, 232, 210);
            poly(g, u, [-16, 0, -14, -3, -12, 0], false);
            poly(g, u, [14, 0, 16, -3, 18, 0], false);
            paint(g, red, u);
            ell(g, u, 0, 32, 22, 22);
            paint(g, C(226, 170, 96), u);
            ell(g, u, 6, 30, 12, 17);
            g.strokeColor = C(170, 110, 60);
            g.lineWidth = 1.2 * u;
            for (var i = 0; i < 4; i++) {
              g.moveTo(-4 * u, (20 + i * 6) * u);
              g.lineTo(16 * u, (20 + i * 6) * u);
              g.stroke();
            }
            g.fillColor = C(110, 24, 30);
            poly(g, u, [-14, 46, -10, 56, -6, 48], false);
            poly(g, u, [-20, 38, -18, 48, -12, 42], false);
            paint(g, red, u);
            poly(g, u, [6, 46, 18, 46, 26, 66, 16, 70]);
            paint(g, red, u);
            poly(g, u, [12, 66, 30, 73, 43, 71, 45, 64, 30, 60, 16, 60]);
            paint(g, C(230, 220, 190), u);
            poly(g, u, [14, 70, 5, 84, 18, 72]);
            poly(g, u, [20, 72, 16, 86, 24, 73]);
            dot(g, u, 42, 68, 1.2, C(40, 10, 10));
            paint(g, C(255, 220, 60), u);
            circ(g, u, 27, 68.4, 2.8);
            g.fillColor = C(20, 10, 10);
            rr(g, u, 26.6, 66, 0.9, 4.8, 0.4, false);
            g.fillColor = C(250, 248, 236);
            for (var _i2 = 0; _i2 < 3; _i2++) {
              poly(g, u, [32 + _i2 * 4, 60.6, 34 + _i2 * 4, 58, 36 + _i2 * 4, 60.6], false);
            }
            paint(g, GOLD, u);
            rr(g, u, -3, 34, 9, 9, 2);
            for (var _i3 = 0, _arr2 = [[-1, 41], [4, 36], [1.5, 38.5]]; _i3 < _arr2.length; _i3++) {
              var p = _arr2[_i3];
              dot(g, u, p[0], p[1], 0.9, C(60, 30, 10));
            }
          },
          tip: {
            x: 45,
            y: 66,
            onArm: false
          }
        }
      };

      // ---------------- 构建 ----------------

      function makePart(parent, p, u, name) {
        var n = mkNode(parent, name, 4, 4, p.x * u, p.y * u);
        p.draw(n.addComponent(Graphics), u);
        return n;
      }

      /** 构建角色。root 中心位于 (x, y)，size 为大致身高。 */
      function buildRig(parent, id, size, x, y, enemy) {
        if (enemy === void 0) {
          enemy = false;
        }
        var spec = SPECS[id] || SPECS.astro;
        var u = size / 100;
        var root = mkNode(parent, 'rig_' + id, size * 0.7, size, x, y);
        var flip = mkNode(root, 'flip', 0, 0, 0, -size / 2);
        if (enemy) {
          flip.setScale(-1, 1, 1);
        }
        var parts = {};
        for (var _iterator = _createForOfIteratorHelperLoose(spec.back || []), _step; !(_step = _iterator()).done;) {
          var b = _step.value;
          parts[b.name] = makePart(flip, b, u, b.name);
        }
        var body = mkNode(flip, 'body', size * 0.7, size, 0, 0);
        spec.body(body.addComponent(Graphics), u);
        var arm = spec.arm ? makePart(body, spec.arm, u, 'arm') : null;
        for (var _iterator2 = _createForOfIteratorHelperLoose(spec.extras || []), _step2; !(_step2 = _iterator2()).done;) {
          var e = _step2.value;
          parts[e.name] = makePart(e.onArm && arm ? arm : body, e, u, e.name);
        }
        if (parts.aura) {
          parts.aura.active = false;
        }
        return {
          id: id,
          root: root,
          flip: flip,
          body: body,
          arm: arm,
          parts: parts,
          u: u,
          size: size,
          enemy: enemy,
          spec: spec
        };
      }

      /** 仅绘制静态立绘（无动画），用于名册/卡片头像。 */
      function buildPortrait(parent, id, size, x, y, enemy) {
        if (enemy === void 0) {
          enemy = false;
        }
        return buildRig(parent, id, size, x, y, enemy);
      }

      // ---------------- 坐标 ----------------

      function posIn(layer, node, lx, ly) {
        if (lx === void 0) {
          lx = 0;
        }
        if (ly === void 0) {
          ly = 0;
        }
        var w = node.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(lx, ly, 0));
        return layer.getComponent(UITransform).convertToNodeSpaceAR(w);
      }
      function tipPos(rig, layer) {
        var t = rig.spec.tip;
        var n = t.onArm && rig.arm ? rig.arm : rig.body;
        return posIn(layer, n, t.x * rig.u, t.y * rig.u);
      }
      function centerOf(rig, layer) {
        return posIn(layer, rig.root);
      }

      // ---------------- 待机 ----------------

      function armSway(arm, amp, delay) {
        if (amp === void 0) {
          amp = 4;
        }
        if (delay === void 0) {
          delay = 0;
        }
        if (!arm) {
          return;
        }
        Tween.stopAllByTarget(arm);
        arm.angle = 0;
        tween(arm).delay(delay).repeatForever(tween(arm).to(0.9, {
          angle: amp
        }, {
          easing: 'sineInOut'
        }).to(0.9, {
          angle: -amp
        }, {
          easing: 'sineInOut'
        })).start();
      }
      function pulse(n, s, d) {
        tween(n).repeatForever(tween(n).to(d, {
          scale: new Vec3(s, s, 1)
        }, {
          easing: 'sineInOut'
        }).to(d, {
          scale: Vec3.ONE
        }, {
          easing: 'sineInOut'
        })).start();
      }
      function flap(n, amp, d, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        Tween.stopAllByTarget(n);
        n.angle = 0;
        tween(n).delay(delay).repeatForever(tween(n).to(d, {
          angle: -amp
        }, {
          easing: 'sineInOut'
        }).to(d, {
          angle: amp * 0.4
        }, {
          easing: 'sineInOut'
        })).start();
      }
      function rigIdle(rig, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        jelly(rig.body, rig.enemy ? 0.06 : 0.07, 0.7, delay);
        armSway(rig.arm, 4, delay);
        var p = rig.parts;
        if (p.orb) {
          pulse(p.orb, 1.25, 0.6);
        }
        if (p.halo) {
          pulse(p.halo, 1.15, 0.9);
        }
        if (p.flame) {
          tween(p.flame).repeatForever(tween(p.flame).to(0.14, {
            scale: new Vec3(0.85, 1.2, 1)
          }).to(0.16, {
            scale: new Vec3(1.1, 0.9, 1)
          })).start();
        }
        if (p.wingB) {
          flap(p.wingB, 16, 0.55);
        }
        if (p.wingF) {
          flap(p.wingF, 20, 0.55, 0.08);
        }
        if (p.cape) {
          tween(p.cape).repeatForever(tween(p.cape).to(0.8, {
            angle: -5
          }, {
            easing: 'sineInOut'
          }).to(0.8, {
            angle: 2
          }, {
            easing: 'sineInOut'
          })).start();
        }
        if (p.tail) {
          tween(p.tail).repeatForever(tween(p.tail).to(0.7, {
            angle: 8
          }, {
            easing: 'sineInOut'
          }).to(0.7, {
            angle: -4
          }, {
            easing: 'sineInOut'
          })).start();
        }
        if (rig.id === 'lich') {
          var fp = rig.flip.position.clone();
          tween(rig.flip).repeatForever(tween(rig.flip).to(1.0, {
            position: new Vec3(fp.x, fp.y + 7, 0)
          }, {
            easing: 'sineInOut'
          }).to(1.0, {
            position: fp
          }, {
            easing: 'sineInOut'
          })).start();
        }
      }

      // ---------------- 特效 ----------------

      function burst(layer, pos, color, n, radius) {
        if (n === void 0) {
          n = 7;
        }
        if (radius === void 0) {
          radius = 46;
        }
        var ring = mkNode(layer, 'ring', 4, 4, pos.x, pos.y);
        var rg = ring.addComponent(Graphics);
        rg.strokeColor = color;
        rg.lineWidth = 4;
        rg.circle(0, 0, 12);
        rg.stroke();
        var rop = ring.addComponent(UIOpacity);
        tween(ring).to(0.3, {
          scale: new Vec3(3, 3, 1)
        }, {
          easing: 'quadOut'
        }).start();
        tween(rop).to(0.3, {
          opacity: 0
        }).call(function () {
          return ring.destroy();
        }).start();
        var _loop = function _loop() {
          var a = i / n * Math.PI * 2 + Math.random() * 0.6;
          var d = radius * (0.6 + Math.random() * 0.6);
          var sp = mkNode(layer, 'spark', 4, 4, pos.x, pos.y);
          var g = sp.addComponent(Graphics);
          g.fillColor = color;
          g.circle(0, 0, 2.5 + Math.random() * 2.5);
          g.fill();
          var op = sp.addComponent(UIOpacity);
          tween(sp).by(0.36, {
            position: new Vec3(Math.cos(a) * d, Math.sin(a) * d, 0)
          }, {
            easing: 'quadOut'
          }).start();
          tween(op).delay(0.15).to(0.22, {
            opacity: 0
          }).call(function () {
            return sp.destroy();
          }).start();
        };
        for (var i = 0; i < n; i++) {
          _loop();
        }
      }
      function drawProj(g, kind) {
        var u = 1;
        switch (kind) {
          case 'star':
            dot(g, u, 0, 0, 11, C(150, 170, 255, 90));
            star(g, u, 0, 0, 9, C(220, 230, 255));
            break;
          case 'fire':
            dot(g, u, 0, 0, 12, C(255, 110, 30, 120));
            dot(g, u, 0, 0, 8, C(255, 150, 50));
            dot(g, u, 0, 0, 4, C(255, 240, 150));
            break;
          case 'bigfire':
            dot(g, u, 0, 0, 20, C(255, 80, 20, 110));
            dot(g, u, 0, 0, 13, C(255, 140, 40));
            dot(g, u, 0, 0, 6, C(255, 240, 150));
            break;
          case 'coin':
            paint(g, C(240, 200, 70), u);
            g.lineWidth = 1.6;
            ell(g, u, 0, 0, 7, 7);
            dot(g, u, 0, 0, 3, C(200, 150, 40));
            break;
          case 'flask':
            paint(g, C(210, 236, 228), u);
            g.lineWidth = 1.4;
            rr(g, u, -1.6, 4, 3.2, 6, 1);
            paint(g, C(90, 210, 120), u);
            g.lineWidth = 1.4;
            circ(g, u, 0, 0, 6);
            break;
          case 'holy':
            dot(g, u, 0, 0, 13, C(255, 240, 160, 110));
            dot(g, u, 0, 0, 7, C(255, 250, 220));
            break;
          case 'gear':
            {
              g.fillColor = C(190, 160, 90);
              for (var i = 0; i < 8; i++) {
                var a = i * Math.PI / 4;
                g.circle(Math.cos(a) * 8, Math.sin(a) * 8, 2.6);
                g.fill();
              }
              paint(g, C(200, 170, 100), u);
              g.lineWidth = 1.4;
              circ(g, u, 0, 0, 7.5);
              dot(g, u, 0, 0, 2.6, C(80, 60, 40));
              break;
            }
          case 'knife':
            paint(g, C(220, 224, 234), u);
            g.lineWidth = 1.2;
            poly(g, u, [-8, -1.6, 6, -1.6, 10, 0, 6, 1.6, -8, 1.6]);
            break;
          case 'skull':
            dot(g, u, 0, 0, 12, C(120, 255, 140, 90));
            paint(g, BONE, u);
            g.lineWidth = 1.4;
            circ(g, u, 0, 1, 6.5);
            dot(g, u, -2.4, 1.6, 1.6, C(30, 60, 30));
            dot(g, u, 2.4, 1.6, 1.6, C(30, 60, 30));
            break;
          case 'wave':
            g.strokeColor = C(220, 235, 255);
            g.lineWidth = 4;
            g.arc(0, 0, 14, -Math.PI / 2.4, Math.PI / 2.4, false);
            g.stroke();
            g.strokeColor = C(150, 190, 255, 150);
            g.lineWidth = 8;
            g.arc(-3, 0, 14, -Math.PI / 2.6, Math.PI / 2.6, false);
            g.stroke();
            break;
        }
      }

      /** 发射投射物：from → to，arc 为抛物线高度。到达时爆点。 */
      function shoot(layer, from, to, kind, dur, color, opt) {
        if (opt === void 0) {
          opt = {};
        }
        var n = mkNode(layer, 'proj', 4, 4, from.x, from.y);
        drawProj(n.addComponent(Graphics), kind);
        n.active = false;
        var dx = to.x - from.x,
          dy = to.y - from.y;
        if (kind === 'knife' || kind === 'wave') {
          n.angle = Math.atan2(dy, dx) * 180 / Math.PI;
        }
        var arc = opt.arc || 0,
          spin = opt.spin || 0;
        var st = {
          t: 0
        };
        tween(st).delay(opt.delay || 0).call(function () {
          n.active = true;
        }).to(dur, {
          t: 1
        }, {
          onUpdate: function onUpdate(_o, r) {
            var k = r === undefined ? st.t : r;
            n.setPosition(from.x + dx * k, from.y + dy * k + arc * 4 * k * (1 - k), 0);
            if (spin) {
              n.angle = spin * k;
            }
          }
        }).call(function () {
          burst(layer, to, color);
          n.destroy();
        }).start();
      }
      function armSwing(rig, windup, strike, tw, ts, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        var a = rig.arm;
        if (!a) {
          return delay + tw + ts;
        }
        Tween.stopAllByTarget(a);
        tween(a).delay(delay).to(tw, {
          angle: windup
        }, {
          easing: 'quadOut'
        }).to(ts, {
          angle: strike
        }, {
          easing: 'quadIn'
        }).delay(0.08).to(0.22, {
          angle: 0
        }, {
          easing: 'sineOut'
        }).call(function () {
          return armSway(a);
        }).start();
        return delay + tw + ts;
      }
      function hopRoot(root, d, dur, height, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        var p = root.position.clone();
        var st = {
          t: 0
        };
        tween(st).delay(delay).to(dur, {
          t: 1
        }, {
          onUpdate: function onUpdate(_o, r) {
            var k = r === undefined ? st.t : r;
            root.setPosition(p.x + d.x * k, p.y + d.y * k + height * 4 * k * (1 - k), 0);
          }
        }).start();
      }
      function dashRoot(root, d, go, back, delay, hold) {
        if (delay === void 0) {
          delay = 0;
        }
        if (hold === void 0) {
          hold = 0.06;
        }
        var p = root.position.clone();
        tween(root).delay(delay).to(go, {
          position: p.clone().add(d)
        }, {
          easing: 'quadIn'
        }).delay(hold).to(back, {
          position: p
        }, {
          easing: 'sineOut'
        }).start();
      }

      // ---------------- 攻击动作（返回命中时刻，秒） ----------------

      /** 英雄攻击：各职业专属动作 + 投射物。target 为 layer 坐标。 */
      function heroAttack(rig, layer, target, delay) {
        if (delay === void 0) {
          delay = 0;
        }
        var fx = rig.spec.fx;
        var fire = function fire(kind, at, dur, o) {
          if (o === void 0) {
            o = {};
          }
          tween(rig.root).delay(at).call(function () {
            shoot(layer, tipPos(rig, layer), target, kind, dur, fx, o);
          }).start();
          return at + dur;
        };
        switch (rig.id) {
          case 'astro':
            armSwing(rig, 28, -42, 0.14, 0.1, delay);
            return fire('star', delay + 0.24, 0.3, {
              spin: 540
            });
          case 'pyro':
            armSwing(rig, 20, -60, 0.12, 0.08, delay);
            return fire('fire', delay + 0.2, 0.28);
          case 'gambler':
            armSwing(rig, 30, -70, 0.12, 0.07, delay);
            return fire('coin', delay + 0.19, 0.32, {
              spin: 1080,
              arc: 30
            });
          case 'alch':
            armSwing(rig, 75, -50, 0.16, 0.1, delay);
            return fire('flask', delay + 0.26, 0.42, {
              spin: 720,
              arc: 90
            });
          case 'tinker':
            armSwing(rig, 70, -80, 0.18, 0.08, delay);
            return fire('gear', delay + 0.26, 0.32, {
              spin: -900
            });
          case 'bulwark':
            armSwing(rig, 50, -90, 0.14, 0.09, delay);
            dashRoot(rig.root, new Vec3(14, 8, 0), 0.12, 0.24, delay + 0.1);
            return fire('wave', delay + 0.23, 0.24);
          case 'shadow':
            {
              var op = rig.flip.getComponent(UIOpacity) || rig.flip.addComponent(UIOpacity);
              tween(op).delay(delay).to(0.08, {
                opacity: 40
              }).delay(0.26).to(0.12, {
                opacity: 255
              }).start();
              armSwing(rig, 20, -80, 0.08, 0.06, delay);
              fire('knife', delay + 0.1, 0.2);
              fire('knife', delay + 0.16, 0.2);
              return fire('knife', delay + 0.22, 0.2);
            }
          case 'cleric':
            {
              armSwing(rig, 35, -10, 0.16, 0.12, delay);
              tween(rig.root).delay(delay + 0.22).call(function () {
                var beam = mkNode(layer, 'beam', 4, 4, target.x, target.y + 120);
                var g = beam.addComponent(Graphics);
                g.fillColor = C(255, 240, 160, 150);
                g.roundRect(-14, -150, 28, 300, 12);
                g.fill();
                g.fillColor = C(255, 255, 230, 220);
                g.roundRect(-5, -150, 10, 300, 5);
                g.fill();
                var op = beam.addComponent(UIOpacity);
                beam.setScale(0.2, 1, 1);
                tween(beam).to(0.1, {
                  scale: Vec3.ONE
                }).start();
                tween(op).delay(0.18).to(0.25, {
                  opacity: 0
                }).call(function () {
                  return beam.destroy();
                }).start();
                burst(layer, target, fx, 9);
              }).start();
              return delay + 0.32;
            }
        }
        return fire('star', delay + 0.2, 0.3);
      }

      /** 敌人攻击：各敌人专属动作。target 为 layer 坐标（enemy root 必须是 layer 的直接子节点）。 */
      function enemyAttack(rig, layer, target) {
        var home = rig.root.position.clone();
        var d = new Vec3(target.x - home.x, target.y - home.y, 0);
        var fx = rig.spec.fx;
        switch (rig.id) {
          case 'imp':
            {
              armSwing(rig, 40, -80, 0.1, 0.08, 0.14);
              hopRoot(rig.root, d.clone().multiplyScalar(0.72), 0.26, 70);
              tween(rig.root).delay(0.34).call(function () {
                return hopRoot(rig.root, d.clone().multiplyScalar(-0.72), 0.3, 40);
              }).start();
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
            tween(rig.root).delay(0.28).call(function () {
              return shoot(layer, tipPos(rig, layer), target, 'skull', 0.36, fx, {
                spin: 360
              });
            }).start();
            return 0.64;
          case 'boss':
            {
              var s = rig.root.scale.clone();
              tween(rig.root).to(0.22, {
                scale: new Vec3(s.x * 1.12, s.y * 1.12, 1)
              }, {
                easing: 'quadOut'
              }).delay(0.3).to(0.25, {
                scale: s
              }).start();
              var _loop2 = function _loop2() {
                var w = _arr3[_i4];
                var n = rig.parts[w];
                if (n) {
                  Tween.stopAllByTarget(n);
                  tween(n).repeat(3, tween(n).to(0.1, {
                    angle: -30
                  }).to(0.1, {
                    angle: 10
                  })).call(function () {
                    return flap(n, w === 'wingB' ? 16 : 20, 0.55);
                  }).start();
                }
              };
              for (var _i4 = 0, _arr3 = ['wingB', 'wingF']; _i4 < _arr3.length; _i4++) {
                _loop2();
              }
              for (var i = 0; i < 3; i++) {
                tween(rig.root).delay(0.26 + i * 0.1).call(function () {
                  var off = new Vec3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0);
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
      function castFx(rig, layer) {
        armSwing(rig, 55, 40, 0.12, 0.12);
        var c = centerOf(rig, layer);
        burst(layer, new Vec3(c.x, c.y + rig.size * 0.1, 0), rig.spec.fx, 10, 36);
        var s = rig.root.scale.clone();
        tween(rig.root).to(0.1, {
          scale: new Vec3(s.x * 1.12, s.y * 1.12, 1)
        }).to(0.18, {
          scale: s
        }, {
          easing: 'backOut'
        }).start();
      }

      /** 受击：压扁回弹 + 闪烁。 */
      function hurt(rig, power) {
        if (power === void 0) {
          power = 1;
        }
        squashHit(rig.root, power);
        var op = rig.body.getComponent(UIOpacity) || rig.body.addComponent(UIOpacity);
        tween(op).to(0.05, {
          opacity: 110
        }).to(0.07, {
          opacity: 255
        }).to(0.05, {
          opacity: 110
        }).to(0.07, {
          opacity: 255
        }).start();
      }

      /** 阵亡：英雄倒地，敌人压扁消散。 */
      function die(rig) {
        if (rig.arm) {
          Tween.stopAllByTarget(rig.arm);
        }
        for (var k in rig.parts) {
          Tween.stopAllByTarget(rig.parts[k]);
        }
        if (rig.enemy) {
          squashDeath(rig.body);
          var op = rig.flip.getComponent(UIOpacity) || rig.flip.addComponent(UIOpacity);
          tween(op).delay(0.25).to(0.35, {
            opacity: 0
          }).start();
        } else {
          fall(rig.body);
        }
      }

      /** 首领狂暴：红色光环亮起并持续脉动。 */
      function enrage(rig) {
        var a = rig.parts.aura;
        if (a) {
          a.active = true;
          a.setScale(0.2, 0.2, 1);
          tween(a).to(0.3, {
            scale: new Vec3(1.2, 1.2, 1)
          }, {
            easing: 'backOut'
          }).call(function () {
            return pulse(a, 1.12, 0.4);
          }).start();
        }
        var s = rig.root.scale.clone();
        tween(rig.root).repeat(2, tween(rig.root).to(0.1, {
          scale: new Vec3(s.x * 1.18, s.y * 1.18, 1)
        }).to(0.12, {
          scale: s
        })).start();
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/GameMain.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './Data.ts', './UI.ts', './BattleScreen.ts', './Figures.ts'], function (exports) {
  var _inheritsLoose, _createForOfIteratorHelperLoose, cclegacy, _decorator, Color, Graphics, tween, UIOpacity, Vec3, Node, sys, Component, heroById, HEROES, RULES, makeHero, starterDeck, COLUMN_X, cardById, EVENTS, BOSS, ELITES, NORMAL_ENEMIES, rewardOptions, NODE_NAME, mkNode, mkPanel, popIn, drawDie, bob, mkLabel, COL, drawPanel, mkButton, setBtnEnabled, drawNodeIcon, mkBar, mkCard, BattleScreen, buildRig, rigIdle;
  return {
    setters: [function (module) {
      _inheritsLoose = module.inheritsLoose;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      Color = module.Color;
      Graphics = module.Graphics;
      tween = module.tween;
      UIOpacity = module.UIOpacity;
      Vec3 = module.Vec3;
      Node = module.Node;
      sys = module.sys;
      Component = module.Component;
    }, function (module) {
      heroById = module.heroById;
      HEROES = module.HEROES;
      RULES = module.RULES;
      makeHero = module.makeHero;
      starterDeck = module.starterDeck;
      COLUMN_X = module.COLUMN_X;
      cardById = module.cardById;
      EVENTS = module.EVENTS;
      BOSS = module.BOSS;
      ELITES = module.ELITES;
      NORMAL_ENEMIES = module.NORMAL_ENEMIES;
      rewardOptions = module.rewardOptions;
      NODE_NAME = module.NODE_NAME;
    }, function (module) {
      mkNode = module.mkNode;
      mkPanel = module.mkPanel;
      popIn = module.popIn;
      drawDie = module.drawDie;
      bob = module.bob;
      mkLabel = module.mkLabel;
      COL = module.COL;
      drawPanel = module.drawPanel;
      mkButton = module.mkButton;
      setBtnEnabled = module.setBtnEnabled;
      drawNodeIcon = module.drawNodeIcon;
      mkBar = module.mkBar;
      mkCard = module.mkCard;
    }, function (module) {
      BattleScreen = module.BattleScreen;
    }, function (module) {
      buildRig = module.buildRig;
      rigIdle = module.rigIdle;
    }],
    execute: function () {
      var _dec, _class;
      cclegacy._RF.push({}, "87b9aEKLaFOv52570imC7HV", "GameMain", undefined);
      var ccclass = _decorator.ccclass;
      var SAVE_KEY = 'dfx_save_v1';
      var START_OWNED = ['astro', 'bulwark', 'gambler'];
      var GameMain = exports('GameMain', (_dec = ccclass('GameMain'), _dec(_class = /*#__PURE__*/function (_Component) {
        _inheritsLoose(GameMain, _Component);
        function GameMain() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _this.save = {
            gold: 0,
            owned: START_OWNED.slice(),
            trials: {}
          };
          _this.run = null;
          _this.pick = null;
          _this.mapMsg = '';
          _this.autoBattle = false;
          _this.marker = null;
          _this.mapBusy = false;
          _this.hpBar = null;
          return _this;
        }
        var _proto = GameMain.prototype;
        _proto.onLoad = function onLoad() {
          this.load();
          this.showHome();
          this.playIntro();
        }

        // ---------------- 开场 ----------------
        ;

        _proto.playIntro = function playIntro() {
          var ov = mkNode(this.node, 'intro', 0, 0, 0, 0);
          var bg = mkPanel(ov, 720, 1280, 0, 0, new Color(18, 13, 10, 255), 0, null, 0);
          var dragon = buildRig(ov, 'boss', 230, 130, 150, true);
          rigIdle(dragon);
          popIn(dragon.root, 0.5, 0.2, 1.1, 0.3);
          ['bulwark', 'astro', 'cleric'].forEach(function (id, i) {
            var r = buildRig(ov, id, 110, -230 + i * 80, -240 - i * 10);
            rigIdle(r, i * 0.2);
            popIn(r.root, 0.4, 0.2, 1.15, 0.5 + i * 0.12);
          });
          var dn = mkNode(ov, 'die', 120, 120, 0, 340);
          drawDie(dn.addComponent(Graphics), 120, {
            value: 5
          });
          tween(dn).repeatForever(tween(dn).by(0.5, {
            angle: 180
          })).start();
          bob(dn, 16, 0.45);
          var t1 = mkLabel(ov, '骰 命 远 征', 60, COL.gold, 0, -80);
          var t2 = mkLabel(ov, '骰子决定当下，英雄决定你怎样利用结果', 17, COL.dim, 0, -140);
          var hint = mkLabel(ov, '点击任意处进入', 15, new Color(160, 140, 115, 255), 0, -480);
          var o1 = t1.node.addComponent(UIOpacity);
          o1.opacity = 0;
          var o2 = t2.node.addComponent(UIOpacity);
          o2.opacity = 0;
          var o3 = hint.node.addComponent(UIOpacity);
          o3.opacity = 0;
          t1.node.setScale(2.4, 0.2, 1);
          tween(t1.node).to(0.5, {
            scale: Vec3.ONE
          }).start();
          tween(o1).to(0.4, {
            opacity: 255
          }).start();
          tween(o2).delay(0.5).to(0.4, {
            opacity: 255
          }).start();
          tween(o3).delay(0.9).to(0.3, {
            opacity: 255
          }).start();
          tween(o3).delay(1.4).repeatForever(tween(o3).to(0.5, {
            opacity: 90
          }).to(0.5, {
            opacity: 255
          })).start();
          var ovOp = ov.addComponent(UIOpacity);
          var closed = false;
          var close = function close() {
            if (closed) {
              return;
            }
            closed = true;
            tween(ovOp).to(0.35, {
              opacity: 0
            }).call(function () {
              return ov.destroy();
            }).start();
          };
          bg.node.once(Node.EventType.TOUCH_END, close);
          this.scheduleOnce(close, 3.0);
        }

        // ---------------- 存档 ----------------
        ;

        _proto.load = function load() {
          try {
            var raw = sys.localStorage.getItem(SAVE_KEY);
            if (raw) {
              var d = JSON.parse(raw);
              if (d && typeof d.gold === 'number' && Array.isArray(d.owned)) {
                this.save = {
                  gold: d.gold,
                  owned: d.owned.filter(function (id) {
                    return !!heroById(id);
                  }),
                  trials: d.trials && typeof d.trials === 'object' ? d.trials : {}
                };
                if (this.save.owned.length === 0) {
                  this.save.owned = START_OWNED.slice();
                }
                return;
              }
            }
          } catch (e) {/* 存档损坏则用默认 */}
          this.save = {
            gold: 0,
            owned: START_OWNED.slice(),
            trials: {}
          };
        };
        _proto.store = function store() {
          sys.localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
        };
        _proto.clearScreen = function clearScreen() {
          this.node.removeAllChildren();
          return mkPanel(this.node, 720, 1280, 0, 0, COL.bg, 0, null, 0).node;
        }

        // ---------------- 营地 ----------------
        ;

        _proto.showHome = function showHome() {
          var _this2 = this;
          var root = this.clearScreen();
          this.run = null;
          if (!this.pick || this.save.owned.indexOf(this.pick) < 0) {
            this.pick = this.save.owned[0];
          }
          mkLabel(root, '骰 命 远 征', 54, COL.gold, 0, 570);
          mkLabel(root, '骰子决定当下，英雄决定你怎样利用结果', 16, COL.dim, 0, 526);
          mkLabel(root, '金币：' + this.save.gold + '　英雄：' + this.save.owned.length + '/' + HEROES.length, 17, COL.text, 0, 490);

          // 英雄名册：点选一名英雄出征
          mkLabel(root, '—— 选择一名英雄出征 ——', 18, COL.gold, 0, 450);
          var cardW = 330,
            cardH = 158,
            gapY = 12;
          var btns = {};
          var _loop = function _loop() {
            var def = HEROES[i];
            var col = i % 2,
              rowIdx = Math.floor(i / 2);
            var x = -170 + col * 340;
            var y = 380 - rowIdx * (cardH + gapY);
            var owned = _this2.save.owned.indexOf(def.id) >= 0;
            var p = mkPanel(root, cardW, cardH, x, y, owned ? COL.panel : COL.btnOff, 8, COL.border, 2);
            var c = def.color;
            mkPanel(p.node, cardW, 26, 0, cardH / 2 - 13, owned ? new Color(c[0], c[1], c[2], 255) : new Color(60, 52, 46, 255), 6, null, 0);
            mkLabel(p.node, def.name + '·' + def.title + '　HP ' + def.maxHp, 16, new Color(255, 255, 255, 255), 0, cardH / 2 - 13);
            var r = buildRig(p.node, def.id, 92, -108, -18);
            rigIdle(r, i * 0.1);
            if (!owned) {
              r.root.addComponent(UIOpacity).opacity = 70;
            }
            var t = (_this2.save.trials || {})[def.id];
            mkLabel(p.node, def.passive, 11.5, COL.dim, 36, 8, 170);
            mkLabel(p.node, owned ? t ? '远征战绩 ' + t.clears + '/' + t.runs : '尚未出征' : '未招募', 12, owned ? COL.gold : COL.dim, 36, -44);
            if (owned) {
              p.node.on(Node.EventType.TOUCH_END, function () {
                _this2.pick = def.id;
                _this2.showHome();
              });
            }
            btns[def.id] = p.node;
          };
          for (var i = 0; i < HEROES.length; i++) {
            _loop();
          }
          // 选中描边
          for (var _i = 0, _Object$keys = Object.keys(btns); _i < _Object$keys.length; _i++) {
            var _id = _Object$keys[_i];
            if (_id === this.pick) {
              drawPanel(btns[_id].getComponent(Graphics), cardW, cardH, COL.panelLight, 8, COL.gold, 3);
            }
          }
          var go = mkButton(root, '开始远征', 300, 62, -170, -470, 24, function () {
            return _this2.startRun(_this2.pick);
          });
          setBtnEnabled(go, !!this.pick, 300, 62);
          var canRecruit = this.save.owned.length < HEROES.length && this.save.gold >= RULES.recruitCost;
          var rec = mkButton(root, this.save.owned.length >= HEROES.length ? '已集齐英雄' : '招募(' + RULES.recruitCost + '金)', 300, 62, 170, -470, 20, function () {
            return _this2.onRecruit();
          });
          setBtnEnabled(rec, canRecruit, 300, 62);
          mkLabel(root, '战斗：掷骰后把骰子放进卡牌触发效果，牌组随战利品成长。', 13, COL.dim, 0, -560);
        };
        _proto.onRecruit = function onRecruit() {
          var _this3 = this;
          var pool = HEROES.filter(function (h) {
            return _this3.save.owned.indexOf(h.id) < 0;
          });
          if (pool.length === 0 || this.save.gold < RULES.recruitCost) {
            return;
          }
          this.save.gold -= RULES.recruitCost;
          var got = pool[Math.floor(Math.random() * pool.length)];
          this.save.owned.push(got.id);
          this.store();
          var overlay = mkPanel(this.node, 440, 360, 0, 0, COL.panelLight, 12, COL.gold, 3);
          popIn(overlay.node, 0.35, 0.4, 1.12);
          mkLabel(overlay.node, '招募成功！', 26, COL.gold, 0, 150);
          var r = buildRig(overlay.node, got.id, 120, 0, 60);
          rigIdle(r);
          mkLabel(overlay.node, got.name + '·' + got.title, 20, COL.text, 0, -30);
          mkLabel(overlay.node, got.passive, 13, COL.dim, 0, -70, 400);
          mkButton(overlay.node, '太好了', 160, 48, 0, -140, 18, function () {
            overlay.node.destroy();
            _this3.showHome();
          });
        }

        // ---------------- 远征 ----------------
        ;

        _proto.startRun = function startRun(heroId) {
          var def = heroById(heroId);
          var deco = [];
          for (var i = 0; i < 40; i++) {
            deco.push({
              x: -270 + Math.random() * 540,
              y: -360 + Math.random() * 780,
              r: 1 + Math.random() * 2.2
            });
          }
          this.run = {
            hero: makeHero(def),
            deck: starterDeck(def),
            gold: 0,
            buffs: {
              extraDie: 0
            },
            map: this.genMap(),
            posRow: -1,
            posCol: -1,
            depth: 0,
            deco: deco
          };
          this.mapMsg = '远征开始！点击发光节点沿路线前进';
          this.showMap();
        };
        _proto.genMap = function genMap() {
          var pool = ['battle', 'battle', 'battle', 'battle', 'elite', 'elite', 'treasure', 'event', 'rest'];
          var map = [];
          for (var r = 0; r < 7; r++) {
            var count = r === 0 ? 3 : Math.random() < 0.45 ? 2 : 3;
            var slots = [0, 1, 2, 3];
            for (var i = slots.length - 1; i > 0; i--) {
              var j = Math.floor(Math.random() * (i + 1));
              var t = slots[i];
              slots[i] = slots[j];
              slots[j] = t;
            }
            var row = slots.slice(0, count).sort(function (a, b) {
              return a - b;
            }).map(function (s) {
              return {
                kind: pool[Math.floor(Math.random() * pool.length)],
                slot: s,
                links: [],
                done: false
              };
            });
            map.push(row);
          }
          map.push([{
            kind: 'boss',
            slot: 1.5,
            links: [],
            done: false
          }]);
          var _loop2 = function _loop2() {
            var cur = map[_r],
              nxt = map[_r + 1];
            var _loop3 = function _loop3(_i2) {
              var sorted = nxt.map(function (n, j) {
                return {
                  j: j,
                  d: Math.abs(n.slot - cur[_i2].slot)
                };
              }).sort(function (a, b) {
                return a.d - b.d;
              });
              var take = Math.min(nxt.length, Math.random() < 0.5 ? 1 : 2);
              for (var k = 0; k < take; k++) {
                if (cur[_i2].links.indexOf(sorted[k].j) < 0) {
                  cur[_i2].links.push(sorted[k].j);
                }
              }
              if (cur[_i2].links.length === 0) {
                cur[_i2].links.push(sorted[0].j);
              }
            };
            for (var _i2 = 0; _i2 < cur.length; _i2++) {
              _loop3(_i2);
            }
            var _loop4 = function _loop4(_j) {
              if (!cur.some(function (n) {
                return n.links.indexOf(_j) >= 0;
              })) {
                var best = 0,
                  bd = 1e9;
                for (var _i3 = 0; _i3 < cur.length; _i3++) {
                  var d = Math.abs(cur[_i3].slot - nxt[_j].slot);
                  if (d < bd) {
                    bd = d;
                    best = _i3;
                  }
                }
                cur[best].links.push(_j);
              }
            };
            for (var _j = 0; _j < nxt.length; _j++) {
              _loop4(_j);
            }
          };
          for (var _r = 0; _r < map.length - 1; _r++) {
            _loop2();
          }
          return map;
        };
        _proto.slotX = function slotX(slot) {
          var f = Math.floor(slot),
            c = Math.ceil(slot);
          return f === c ? COLUMN_X[f] : (COLUMN_X[f] + COLUMN_X[c]) / 2;
        };
        _proto.rowY = function rowY(r) {
          return -300 + r * 80;
        };
        _proto.reachable = function reachable(r, i) {
          var run = this.run;
          if (r !== run.posRow + 1) {
            return false;
          }
          if (run.posRow < 0) {
            return true;
          }
          return run.map[run.posRow][run.posCol].links.indexOf(i) >= 0;
        };
        _proto.travelTo = function travelTo(r, col) {
          var _this4 = this;
          if (this.mapBusy || !this.reachable(r, col)) {
            return;
          }
          this.mapBusy = true;
          var nd = this.run.map[r][col];
          var dst = new Vec3(this.slotX(nd.slot), this.rowY(r) + 30, 0);
          tween(this.marker).to(0.45, {
            position: dst
          }).call(function () {
            _this4.run.posRow = r;
            _this4.run.posCol = col;
            _this4.enterNode(nd.kind);
          }).start();
        };
        _proto.drawMapNode = function drawMapNode(g, kind, state) {
          g.clear();
          var s = kind === 'boss' ? 30 : 26;
          var fill = COL.panel,
            ring = COL.border,
            lw = 2;
          if (state === 'next' || state === 'cur') {
            fill = COL.panelLight;
            ring = COL.gold;
            lw = 3;
          }
          if (state === 'done') {
            fill = COL.btnOff;
          }
          if (state === 'far') {
            fill = new Color(48, 40, 36, 255);
          }
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
        };
        _proto.showMap = function showMap() {
          var _this5 = this;
          var root = this.clearScreen();
          var run = this.run;
          this.mapBusy = false;
          var hero = run.hero;

          // 顶部状态栏
          mkLabel(root, hero.def.name + '　HP ' + Math.ceil(hero.hp) + '/' + hero.maxHp, 20, COL.gold, 0, 605);
          this.hpBar = mkBar(root, 300, 16, -160, 575);
          this.hpBar.set(hero.hp / hero.maxHp);
          mkLabel(root, '金币 ' + run.gold + '　牌组 ' + run.deck.length + '　进度 ' + run.depth, 14, COL.text, 160, 575);
          if (this.mapMsg) {
            mkLabel(root, this.mapMsg, 14, COL.gold, 0, 545);
          }
          mkLabel(root, '牌组内容：' + run.deck.map(function (c) {
            return cardById(c).name;
          }).join(' '), 11, COL.dim, 0, -545, 660);
          mkButton(root, '撤退(保留金币)', 190, 46, -250, -600, 16, function () {
            _this5.finishRun(false);
            _this5.showHome();
          });
          mkLabel(root, '点击发光节点前进，走过无法回头', 12, COL.dim, 160, -600);

          // 地图容器
          var mapRoot = mkNode(root, 'map', 0, 0, 0, -40);
          var bands = [{
            y: -260,
            h: 250,
            c: new Color(28, 44, 30, 255),
            name: '黑森林'
          }, {
            y: -10,
            h: 230,
            c: new Color(48, 46, 52, 255),
            name: '古 堡'
          }, {
            y: 225,
            h: 150,
            c: new Color(62, 26, 22, 255),
            name: '龙 巢'
          }];
          var bg = mkNode(mapRoot, 'bands', 620, 640, 0, 0).addComponent(Graphics);
          for (var _i4 = 0, _bands = bands; _i4 < _bands.length; _i4++) {
            var b = _bands[_i4];
            bg.fillColor = b.c;
            bg.roundRect(-310, b.y - b.h / 2, 620, b.h, 18);
            bg.fill();
          }
          bg.fillColor = new Color(255, 255, 255, 70);
          for (var _iterator = _createForOfIteratorHelperLoose(run.deco), _step; !(_step = _iterator()).done;) {
            var d = _step.value;
            bg.circle(d.x * 0.9, d.y - 40, d.r);
            bg.fill();
          }
          for (var _i5 = 0, _bands2 = bands; _i5 < _bands2.length; _i5++) {
            var _b = _bands2[_i5];
            mkLabel(mapRoot, _b.name, 17, new Color(200, 190, 175, 255), 268, _b.y + _b.h / 2 - 22);
          }

          // 连线
          var lg = mkNode(mapRoot, 'links', 0, 0, 0, 0).addComponent(Graphics);
          for (var r = 0; r < run.map.length - 1; r++) {
            var cur = run.map[r],
              nxt = run.map[r + 1];
            for (var i = 0; i < cur.length; i++) {
              for (var _iterator2 = _createForOfIteratorHelperLoose(cur[i].links), _step2; !(_step2 = _iterator2()).done;) {
                var j = _step2.value;
                var used = cur[i].done && nxt[j].done;
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
            for (var _iterator3 = _createForOfIteratorHelperLoose(run.map[0]), _step3; !(_step3 = _iterator3()).done;) {
              var n = _step3.value;
              lg.moveTo(0, -360);
              lg.lineTo(this.slotX(n.slot), this.rowY(0));
              lg.stroke();
            }
          }

          // 节点
          for (var _r2 = 0; _r2 < run.map.length; _r2++) {
            var row = run.map[_r2];
            var _loop5 = function _loop5() {
              var nd = row[_i6];
              var state = nd.done ? 'done' : _r2 === run.posRow && _i6 === run.posCol ? 'cur' : _this5.reachable(_r2, _i6) ? 'next' : 'far';
              var n = mkNode(mapRoot, 'n' + _r2 + '_' + _i6, 60, 60, _this5.slotX(nd.slot), _this5.rowY(_r2));
              _this5.drawMapNode(n.addComponent(Graphics), nd.kind, state);
              if (state === 'far') {
                n.addComponent(UIOpacity).opacity = 95;
              }
              if (state === 'next') {
                tween(n).repeatForever(tween(n).to(0.55, {
                  scale: new Vec3(1.12, 1.12, 1)
                }).to(0.55, {
                  scale: Vec3.ONE
                })).start();
                var rr = _r2,
                  ii = _i6;
                n.on(Node.EventType.TOUCH_END, function () {
                  return _this5.travelTo(rr, ii);
                });
              }
              popIn(n, 0.28, 0.3, 1.1, _r2 * 0.05);
              mkLabel(n, NODE_NAME[nd.kind], 11.5, state === 'far' ? COL.dim : COL.text, 0, -38);
            };
            for (var _i6 = 0; _i6 < row.length; _i6++) {
              _loop5();
            }
          }

          // 英雄标记
          this.marker = mkNode(mapRoot, 'marker', 54, 80, 0, 0);
          var mr = buildRig(this.marker, hero.def.id, 68, 0, 0);
          rigIdle(mr);
          if (run.posRow < 0) {
            this.marker.setPosition(0, -360, 0);
            mkLabel(mapRoot, '▼ 出发', 14, COL.dim, 0, -396);
          } else {
            this.marker.setPosition(this.slotX(run.map[run.posRow][run.posCol].slot), this.rowY(run.posRow) + 30, 0);
          }
        };
        _proto.enterNode = function enterNode(kind) {
          switch (kind) {
            case 'battle':
              this.startBattle(NORMAL_ENEMIES[Math.floor(Math.random() * NORMAL_ENEMIES.length)]);
              break;
            case 'elite':
              this.startBattle(ELITES[Math.floor(Math.random() * ELITES.length)]);
              break;
            case 'boss':
              this.startBattle(BOSS);
              break;
            case 'treasure':
              this.showTreasure();
              break;
            case 'event':
              this.showEvent(EVENTS[Math.floor(Math.random() * EVENTS.length)]);
              break;
            case 'rest':
              this.showRest();
              break;
          }
        };
        _proto.startBattle = function startBattle(enemy) {
          var _this6 = this;
          var root = this.clearScreen();
          var bn = mkNode(root, 'battle', 0, 0, 0, 0);
          var bs = bn.addComponent(BattleScreen);
          bs.init(this.run.hero, this.run.deck, enemy, this.run.buffs, function (won, gold) {
            bn.destroy();
            if (!won) {
              _this6.finishRun(false);
              _this6.showSettle(false);
              return;
            }
            _this6.run.gold += gold;
            if (_this6.run.hero.def.id === 'cleric') {
              _this6.run.hero.hp = Math.min(_this6.run.hero.maxHp, _this6.run.hero.hp + RULES.clericWinHeal);
            }
            var node = _this6.run.map[_this6.run.posRow][_this6.run.posCol];
            if (node.kind === 'boss') {
              _this6.advance('胜利！');
            } else {
              _this6.showReward(enemy.elite ? true : false, gold);
            }
          }, this.autoBattle);
        };
        _proto.advance = function advance(msg) {
          var nd = this.run.map[this.run.posRow][this.run.posCol];
          nd.done = true;
          this.run.depth++;
          this.mapMsg = msg;
          if (nd.kind === 'boss') {
            this.finishRun(true);
            this.showSettle(true);
          } else {
            this.showMap();
          }
        }

        /** 一局结束：存金币 + 记录该英雄战绩。 */;
        _proto.finishRun = function finishRun(cleared) {
          var run = this.run;
          if (!run) {
            return;
          }
          this.save.gold += run.gold;
          if (!this.save.trials) {
            this.save.trials = {};
          }
          var id = run.hero.def.id;
          var t = this.save.trials[id] || {
            runs: 0,
            clears: 0
          };
          t.runs++;
          if (cleared) {
            t.clears++;
          }
          this.save.trials[id] = t;
          this.store();
        }

        // ---------------- 节点内容 ----------------

        /** 胜利奖励：3 选 1 加牌（精英为稀有池），可跳过。 */;
        _proto.showReward = function showReward(rare, gold) {
          var _this7 = this;
          var root = this.clearScreen();
          mkLabel(root, '胜利！获得 ' + gold + ' 金币', 30, COL.gold, 0, 420);
          mkLabel(root, '选择一张卡牌加入牌组（也可跳过）', 17, COL.dim, 0, 380);
          this.cardPick(0, rewardOptions(this.run.hero.def.id, Math.random, rare), function (pick) {
            if (pick) {
              _this7.run.deck.push(pick);
            }
            _this7.advance('胜利！+' + gold + ' 金' + (pick ? '，获得「' + cardById(pick).name + '」' : ''));
          });
        }

        /** 3 选 1 卡牌界面。onPick(null)=跳过。 */;
        _proto.cardPick = function cardPick(y0, options, onPick) {
          var _this8 = this;
          var root = this.node.children[this.node.children.length - 1];
          var gap = 170;
          var _loop6 = function _loop6(i) {
            var def = cardById(options[i]);
            var v = mkCard(root, def, -gap + i * gap, y0 + 30, 150, 210);
            v.node.on(Node.EventType.TOUCH_END, function () {
              popIn(v.node, 0.15, 0.9, 1.05);
              _this8.scheduleOnce(function () {
                return onPick(options[i]);
              }, 0.15);
            });
          };
          for (var i = 0; i < options.length; i++) {
            _loop6(i);
          }
          mkButton(root, '跳过', 180, 52, 0, y0 - 170, 18, function () {
            return onPick(null);
          });
        };
        _proto.showTreasure = function showTreasure() {
          var _this9 = this;
          var root = this.clearScreen();
          mkLabel(root, '神秘宝箱', 30, COL.gold, 0, 380);
          mkLabel(root, '箱盖刻满骰纹，里面传来清脆的碰撞声。', 16, COL.text, 0, 340, 600);
          var opts = [{
            label: '拿走金币（+60）',
            apply: function apply() {
              return _this9.advance('开箱获得 60 金币');
            }
          }, {
            label: '翻找珍奇（获得一张稀有卡）',
            apply: function apply() {
              return _this9.showCardReward();
            }
          }, {
            label: '供奉骰运（恢复 20% 生命）',
            apply: function apply() {
              _this9.healPct(0.2);
              _this9.advance('获得祝福，恢复了生命');
            }
          }];
          for (var i = 0; i < opts.length; i++) {
            mkButton(root, opts[i].label, 380, 56, 0, 200 - i * 76, 18, opts[i].apply);
          }
        };
        _proto.showCardReward = function showCardReward() {
          var _this10 = this;
          var root = this.clearScreen();
          mkLabel(root, '珍奇卡牌', 30, COL.gold, 0, 420);
          mkLabel(root, '选择一张加入牌组', 17, COL.dim, 0, 380);
          this.cardPick(0, rewardOptions(this.run.hero.def.id, Math.random, true), function (pick) {
            if (pick) {
              _this10.run.deck.push(pick);
            }
            _this10.advance(pick ? '获得「' + cardById(pick).name + '」' : '空手而返');
          });
        };
        _proto.healPct = function healPct(pct) {
          var h = this.run.hero;
          if (h.hp > 0) {
            h.hp = Math.min(h.maxHp, h.hp + h.maxHp * pct);
          }
        };
        _proto.showEvent = function showEvent(ev) {
          var _this11 = this;
          var root = this.clearScreen();
          mkLabel(root, ev.title, 28, COL.gold, 0, 400);
          mkLabel(root, ev.text, 16, COL.text, 0, 350, 600);
          var _loop7 = function _loop7() {
            var opt = ev.options[i];
            var canPay = !(opt.apply === 'buyrare' && _this11.run.gold < 30);
            mkButton(root, opt.label, 480, 60, 0, 240 - i * 80, 17, function () {
              if (!canPay) {
                return;
              }
              switch (opt.apply) {
                case 'gold45':
                  _this11.run.gold += 45;
                  _this11.advance('拾得 45 金币');
                  break;
                case 'heal25':
                  _this11.healPct(0.25);
                  _this11.advance('星光抚平了伤口');
                  break;
                case 'heal20':
                  _this11.healPct(0.2);
                  _this11.advance('井水沁人心脾');
                  break;
                case 'blooddie':
                  _this11.run.hero.hp = Math.max(1, _this11.run.hero.hp - _this11.run.hero.maxHp * 0.15);
                  _this11.run.buffs.extraDie++;
                  _this11.advance('以血换运：每回合 +1 骰子');
                  break;
                case 'buyrare':
                  _this11.run.gold -= 30;
                  _this11.showCardReward();
                  break;
                default:
                  _this11.advance('悄然离开');
              }
            });
          };
          for (var i = 0; i < ev.options.length; i++) {
            _loop7();
          }
        };
        _proto.showRest = function showRest() {
          var _this12 = this;
          var root = this.clearScreen();
          mkLabel(root, '营火', 30, COL.gold, 0, 400);
          mkLabel(root, '火光摇曳，骰子在掌心温热。', 16, COL.text, 0, 350);
          mkButton(root, '休息（恢复 ' + Math.round(RULES.restHealPct * 100) + '% 生命）', 380, 60, 0, 240, 18, function () {
            _this12.healPct(RULES.restHealPct);
            _this12.advance('营火旁休整，恢复了生命');
          });
          mkButton(root, '磨砺技艺（移除一张牌）', 380, 60, 0, 160, 18, function () {
            return _this12.showRemoveCard();
          });
        }

        /** 删牌界面：展示整个牌组，点一张删除。 */;
        _proto.showRemoveCard = function showRemoveCard() {
          var _this13 = this;
          var root = this.clearScreen();
          mkLabel(root, '选择一张牌移除', 28, COL.gold, 0, 540);
          var deck = this.run.deck;
          var cols = 4,
            cw = 160,
            ch = 220;
          var _loop8 = function _loop8() {
            var def = cardById(deck[i]);
            var col = i % cols,
              row = Math.floor(i / cols);
            var x = -(cols - 1) * cw / 2 + col * cw;
            var y = 400 - row * ch;
            var v = mkCard(root, def, x, y, 140, 200);
            var idx = i;
            v.node.on(Node.EventType.TOUCH_END, function () {
              deck.splice(idx, 1);
              _this13.advance('移除了「' + def.name + '」，牌组更精练');
            });
          };
          for (var i = 0; i < deck.length; i++) {
            _loop8();
          }
          mkButton(root, '算了', 180, 52, 0, -500, 18, function () {
            return _this13.advance('在营火旁休息片刻');
          });
        }

        // ---------------- 结算 ----------------
        ;

        _proto.showSettle = function showSettle(victory) {
          var _this14 = this;
          var root = this.clearScreen();
          var run = this.run;
          var def = run ? run.hero.def : null;
          var title = mkLabel(root, victory ? '远征凯旋！' : '远征失败……', 40, victory ? COL.gold : COL.red, 0, 300);
          popIn(title.node, 0.45, 0.3, 1.2);
          if (def) {
            var r = buildRig(root, def.id, 150, 0, 120);
            rigIdle(r);
          }
          var t = def ? (this.save.trials || {})[def.id] : null;
          mkLabel(root, run ? victory ? '骰命魔龙的骰子归于沉寂。带回金币 ' + run.gold : def.name + ' 止步于第 ' + (run.depth + 1) + ' 个节点，带回金币 ' + run.gold : '', 18, COL.text, 0, -20);
          if (t) {
            mkLabel(root, '该英雄远征战绩：' + t.clears + '/' + t.runs + ' 通关（' + Math.round(100 * t.clears / Math.max(1, t.runs)) + '%）', 15, COL.dim, 0, -60);
          }
          if (def) {
            mkButton(root, '再来一局', 200, 56, -120, -160, 20, function () {
              _this14.pick = def.id;
              _this14.startRun(def.id);
            });
          }
          mkButton(root, '返回营地', 200, 56, 120, -160, 20, function () {
            return _this14.showHome();
          });
          this.run = null;
        };
        return GameMain;
      }(Component)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/main", ['./BattleAI.ts', './BattleCore.ts', './BattleScreen.ts', './Data.ts', './Figures.ts', './GameMain.ts', './UI.ts'], function () {
  return {
    setters: [null, null, null, null, null, null, null],
    execute: function () {}
  };
});

System.register("chunks:///_virtual/UI.ts", ['cc', './Data.ts'], function (exports) {
  var cclegacy, Color, Node, Layers, UITransform, HorizontalTextAlignment, Label, VerticalTextAlignment, Graphics, Button, tween, Vec3, Tween, UIOpacity, SLOT_TEXT;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
      Color = module.Color;
      Node = module.Node;
      Layers = module.Layers;
      UITransform = module.UITransform;
      HorizontalTextAlignment = module.HorizontalTextAlignment;
      Label = module.Label;
      VerticalTextAlignment = module.VerticalTextAlignment;
      Graphics = module.Graphics;
      Button = module.Button;
      tween = module.tween;
      Vec3 = module.Vec3;
      Tween = module.Tween;
      UIOpacity = module.UIOpacity;
    }, function (module) {
      SLOT_TEXT = module.SLOT_TEXT;
    }],
    execute: function () {
      exports({
        bob: bob,
        drawDie: drawDie,
        drawHeroFigure: drawHeroFigure,
        drawMonsterFigure: drawMonsterFigure,
        drawNodeIcon: drawNodeIcon,
        drawPanel: drawPanel,
        drawSlotBadge: drawSlotBadge,
        fall: fall,
        floatText: floatText,
        jelly: jelly,
        lunge: lunge,
        mkBar: mkBar,
        mkButton: mkButton,
        mkCard: mkCard,
        mkIntentChip: mkIntentChip,
        mkLabel: mkLabel,
        mkNode: mkNode,
        mkPanel: mkPanel,
        mkTag: mkTag,
        popIn: popIn,
        setBtnEnabled: setBtnEnabled,
        shake: shake,
        squashDeath: squashDeath,
        squashHit: squashHit
      });
      cclegacy._RF.push({}, "e218bHZo9BKraqYzvbssRy0", "UI", undefined);
      // 欧式中世纪配色：深色橡木 / 皮革 / 青铜描边 / 酒红按钮 / 羊皮纸文字
      var COL = exports('COL', {
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
        pip: new Color(35, 35, 45, 255)
      });

      // 衬线字体（西文 Georgia + 中文宋体），营造古典书卷感
      var FONT = "Georgia, 'Times New Roman', 'Songti SC', STSong, SimSun, serif";
      function mkNode(parent, name, w, h, x, y) {
        if (w === void 0) {
          w = 0;
        }
        if (h === void 0) {
          h = 0;
        }
        if (x === void 0) {
          x = 0;
        }
        if (y === void 0) {
          y = 0;
        }
        var n = new Node(name);
        n.layer = Layers.Enum.UI_2D;
        parent.addChild(n);
        var ut = n.addComponent(UITransform);
        ut.setContentSize(w, h);
        n.setPosition(x, y, 0);
        return n;
      }
      function mkLabel(parent, text, size, color, x, y, w, hAlign) {
        if (size === void 0) {
          size = 20;
        }
        if (color === void 0) {
          color = COL.text;
        }
        if (x === void 0) {
          x = 0;
        }
        if (y === void 0) {
          y = 0;
        }
        if (w === void 0) {
          w = 0;
        }
        if (hAlign === void 0) {
          hAlign = HorizontalTextAlignment.CENTER;
        }
        var n = mkNode(parent, 'lbl', w > 0 ? w : 0, size * 1.4, x, y);
        var l = n.addComponent(Label);
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
      function mkPanel(parent, w, h, x, y, fill, r, stroke, lineW) {
        if (x === void 0) {
          x = 0;
        }
        if (y === void 0) {
          y = 0;
        }
        if (fill === void 0) {
          fill = COL.panel;
        }
        if (r === void 0) {
          r = 10;
        }
        if (stroke === void 0) {
          stroke = COL.border;
        }
        if (lineW === void 0) {
          lineW = 2;
        }
        var n = mkNode(parent, 'panel', w, h, x, y);
        var g = n.addComponent(Graphics);
        drawPanel(g, w, h, fill, r, stroke, lineW);
        return {
          node: n,
          g: g
        };
      }
      function drawPanel(g, w, h, fill, r, stroke, lineW) {
        if (r === void 0) {
          r = 10;
        }
        if (stroke === void 0) {
          stroke = null;
        }
        if (lineW === void 0) {
          lineW = 2;
        }
        g.clear();
        g.lineWidth = lineW;
        g.fillColor = fill;
        if (stroke) {
          g.strokeColor = stroke;
        }
        g.roundRect(-w / 2, -h / 2, w, h, r);
        g.fill();
        if (stroke) {
          g.stroke();
        }
      }
      function mkButton(parent, text, w, h, x, y, fontSize, cb) {
        if (x === void 0) {
          x = 0;
        }
        if (y === void 0) {
          y = 0;
        }
        if (fontSize === void 0) {
          fontSize = 20;
        }
        if (cb === void 0) {
          cb = null;
        }
        var n = mkNode(parent, 'btn_' + text, w, h, x, y);
        var g = n.addComponent(Graphics);
        drawPanel(g, w, h, COL.btn, 8, COL.border, 2);
        var label = mkLabel(n, text, fontSize, COL.text, 0, 0, w - 8);
        var btn = n.addComponent(Button);
        btn.transition = Button.Transition.SCALE;
        btn.zoomScale = 0.93;
        btn.duration = 0.08;
        btn.target = n;
        if (cb) {
          n.on(Button.EventType.CLICK, cb);
        }
        return {
          node: n,
          btn: btn,
          label: label,
          g: g
        };
      }
      function setBtnEnabled(h, enabled, w, hgt) {
        h.btn.interactable = enabled;
        drawPanel(h.g, w, hgt, enabled ? COL.btn : COL.btnOff, 8, enabled ? COL.border : COL.btnOff, 2);
        h.label.color = enabled ? COL.text : COL.dim;
      }

      // ---------------- 骰子 ----------------

      var PIP_POS = {
        1: [[0, 0]],
        2: [[-1, 1], [1, -1]],
        3: [[-1, 1], [0, 0], [1, -1]],
        4: [[-1, 1], [1, 1], [-1, -1], [1, -1]],
        5: [[-1, 1], [1, 1], [0, 0], [-1, -1], [1, -1]],
        6: [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]]
      };

      /** 画一颗象牙骰子。 */
      function drawDie(g, size, die) {
        g.clear();
        g.lineWidth = die.sel ? 5 : 3;
        g.strokeColor = die.sel ? COL.gold : new Color(90, 70, 50, 255);
        g.fillColor = COL.dieAttack;
        g.roundRect(-size / 2, -size / 2, size, size, size * 0.18);
        g.fill();
        g.stroke();
        g.fillColor = COL.pip;
        var o = size * 0.27;
        var r = size * 0.075;
        var pos = PIP_POS[die.value] || PIP_POS[1];
        for (var i = 0; i < pos.length; i++) {
          g.circle(pos[i][0] * o, pos[i][1] * o, r);
          g.fill();
        }
      }

      // ---------------- 血条 ----------------

      function mkBar(parent, w, h, x, y) {
        if (x === void 0) {
          x = 0;
        }
        if (y === void 0) {
          y = 0;
        }
        var n = mkNode(parent, 'bar', w, h, x, y);
        var g = n.addComponent(Graphics);
        var set = function set(ratio) {
          var r = Math.max(0, Math.min(1, ratio));
          g.clear();
          g.fillColor = new Color(20, 20, 28, 255);
          g.roundRect(-w / 2, -h / 2, w, h, h / 2);
          g.fill();
          if (r > 0) {
            g.fillColor = r > 0.5 ? COL.green : r > 0.25 ? COL.gold : COL.red;
            var fw = Math.max(h, w * r);
            g.roundRect(-w / 2, -h / 2, fw, h, h / 2);
            g.fill();
          }
        };
        set(1);
        return {
          node: n,
          g: g,
          set: set
        };
      }

      // ---------------- 人物 ----------------

      /** 简化卡通小人：圆头 + 方身体 + 眼睛。size 为整体高度。 */
      function drawHeroFigure(g, size, body) {
        g.clear();
        var skin = new Color(240, 208, 178, 255);
        var dark = new Color(40, 40, 50, 255);
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
      function drawMonsterFigure(g, size, body) {
        g.clear();
        var eyeW = new Color(255, 240, 220, 255);
        var pupil = new Color(200, 40, 30, 255);
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
      function bob(node, amp, dur, delay) {
        if (amp === void 0) {
          amp = 5;
        }
        if (dur === void 0) {
          dur = 0.9;
        }
        if (delay === void 0) {
          delay = 0;
        }
        var p = node.position.clone();
        var tw = tween(node).to(dur, {
          position: new Vec3(p.x, p.y + amp, p.z)
        }).to(dur, {
          position: new Vec3(p.x, p.y, p.z)
        });
        tween(node).delay(delay).repeatForever(tw).start();
      }

      /** 果冻呼吸（咸鱼之王式压扁拉伸待机）。 */
      function jelly(node, amp, dur, delay) {
        if (amp === void 0) {
          amp = 0.09;
        }
        if (dur === void 0) {
          dur = 0.65;
        }
        if (delay === void 0) {
          delay = 0;
        }
        var tw = tween(node).to(dur, {
          scale: new Vec3(1 + amp, 1 - amp, 1)
        }).to(dur, {
          scale: new Vec3(1 - amp * 0.6, 1 + amp * 0.6, 1)
        });
        tween(node).delay(delay).repeatForever(tw).start();
      }

      /** 受击压扁回弹（作用在父节点，与子节点 jelly 叠加）。 */
      function squashHit(node, power) {
        if (power === void 0) {
          power = 1;
        }
        tween(node).to(0.07, {
          scale: new Vec3(1 + 0.28 * power, 1 - 0.35 * power, 1)
        }).to(0.2, {
          scale: Vec3.ONE
        }, {
          easing: 'backOut'
        }).start();
      }

      /** 压扁消散（敌人阵亡）。 */
      function squashDeath(node) {
        Tween.stopAllByTarget(node);
        tween(node).to(0.14, {
          scale: new Vec3(1.3, 1.3, 1)
        }).to(0.32, {
          scale: new Vec3(1.35, 0.08, 1),
          angle: -10
        }).start();
        var op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        tween(op).delay(0.3).to(0.3, {
          opacity: 0
        }).start();
      }

      /** 左右抖动（受击/震屏）。 */
      function shake(node, dist, times) {
        if (dist === void 0) {
          dist = 9;
        }
        if (times === void 0) {
          times = 3;
        }
        var p = node.position.clone();
        var t = tween(node);
        for (var i = 0; i < times; i++) {
          t = t.to(0.045, {
            position: new Vec3(p.x + (i % 2 === 0 ? dist : -dist), p.y, p.z)
          });
        }
        t.to(0.05, {
          position: p
        }).start();
      }

      /** 蓄力前扑再回位（攻击动作）。 */
      function lunge(node, dir, dur, back, delay) {
        if (dur === void 0) {
          dur = 0.16;
        }
        if (back === void 0) {
          back = 0.26;
        }
        if (delay === void 0) {
          delay = 0;
        }
        var p = node.position.clone();
        tween(node).delay(delay).to(dur * 0.4, {
          scale: new Vec3(0.85, 0.85, 1)
        }).to(dur, {
          position: p.clone().add(dir),
          scale: new Vec3(1.15, 0.85, 1)
        }).to(back, {
          position: p,
          scale: Vec3.ONE
        }, {
          easing: 'sineOut'
        }).start();
      }

      /** 倒地阵亡。 */
      function fall(node) {
        Tween.stopAllByTarget(node);
        tween(node).to(0.35, {
          angle: -75
        }).start();
        var op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        tween(op).to(0.35, {
          opacity: 90
        }).start();
      }

      /** 缩放淡入（登场）。 */
      function popIn(node, dur, from, overshoot, delay) {
        if (dur === void 0) {
          dur = 0.35;
        }
        if (from === void 0) {
          from = 0.2;
        }
        if (overshoot === void 0) {
          overshoot = 1.15;
        }
        if (delay === void 0) {
          delay = 0;
        }
        node.setScale(from, from, 1);
        tween(node).delay(delay).to(dur * 0.6, {
          scale: new Vec3(overshoot, overshoot, 1)
        }).to(dur * 0.4, {
          scale: Vec3.ONE
        }).start();
      }

      /** 浮动文字：弹跳出现 + 上飘淡出（伤害/治疗数字）。 */
      function floatText(parent, text, x, y, color, size) {
        if (size === void 0) {
          size = 26;
        }
        var l = mkLabel(parent, text, size, color, x, y);
        var n = l.node;
        var op = n.addComponent(UIOpacity);
        n.setScale(0.3, 0.3, 1);
        n.angle = (Math.random() - 0.5) * 10;
        tween(n).to(0.1, {
          scale: new Vec3(1.35, 1.35, 1)
        }).to(0.12, {
          scale: Vec3.ONE
        }, {
          easing: 'backOut'
        }).start();
        tween(n).by(0.6, {
          position: new Vec3((Math.random() - 0.5) * 34, 58, 0)
        }).start();
        tween(op).delay(0.5).to(0.28, {
          opacity: 0
        }).call(function () {
          return n.destroy();
        }).start();
      }

      // ---------------- 卡牌视图（羊皮纸卡 + 骰槽） ----------------

      var CARD_FILL = new Color(240, 226, 190, 255);
      var CARD_TYPE_COL = {
        attack: new Color(170, 60, 46, 255),
        skill: new Color(80, 118, 158, 255),
        dice: new Color(80, 146, 92, 255)
      };
      var INK = new Color(66, 48, 32, 255);
      function mkCard(parent, def, x, y, w, h) {
        if (w === void 0) {
          w = 132;
        }
        if (h === void 0) {
          h = 190;
        }
        var n = mkNode(parent, 'card_' + def.id, w, h, x, y);
        var g = n.addComponent(Graphics);
        var border = def.rare ? COL.gold : CARD_TYPE_COL[def.type];
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
        var bn = mkNode(n, 'badge', 34, 34, w / 2 - 20, h / 2 - 18);
        var badgeG = bn.addComponent(Graphics);
        drawSlotBadge(badgeG, def.slot, false);
        var badgeLabel = mkLabel(bn, SLOT_TEXT[def.slot], 11, new Color(255, 246, 220, 255), 0, 0);
        // 底部类型条
        g.fillColor = CARD_TYPE_COL[def.type];
        g.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, 16, 4);
        g.fill();
        mkLabel(n, def.type === 'attack' ? '攻击' : def.type === 'skill' ? '技能' : '骰子', 10.5, new Color(255, 246, 220, 255), 0, -h / 2 + 11);
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
        return {
          node: n,
          g: g,
          badgeG: badgeG,
          badgeLabel: badgeLabel,
          def: def,
          w: w,
          h: h
        };
      }

      /** 骰槽徽标：圆形，按条件变色。filled=true 表示已放骰子。 */
      function drawSlotBadge(g, slot, filled) {
        g.clear();
        var col = slot === 'none' ? new Color(120, 100, 80, 255) : filled ? COL.gold : new Color(110, 80, 50, 255);
        g.fillColor = col;
        g.strokeColor = new Color(50, 36, 24, 255);
        g.lineWidth = 2;
        g.circle(0, 0, 16);
        g.fill();
        g.stroke();
      }

      /** 意图徽章（敌人头顶）：返回面板节点。 */
      function mkIntentChip(parent, it, str, x, y) {
        var text = '';
        var col = COL.panel;
        var d = (it.dmg || 0) + str;
        switch (it.type) {
          case 'atk':
            text = '攻击 ' + d + (it.hits && it.hits > 1 ? '×' + it.hits : '');
            col = new Color(140, 46, 38, 255);
            break;
          case 'atkblock':
            text = '攻击 ' + d + (it.hits && it.hits > 1 ? '×' + it.hits : '') + ' 格挡 ' + it.block;
            col = new Color(120, 70, 46, 255);
            break;
          case 'block':
            text = '格挡 ' + it.block;
            col = new Color(70, 100, 140, 255);
            break;
          case 'buff':
            text = '强化 +' + it.str;
            col = new Color(150, 100, 40, 255);
            break;
          case 'curse':
            text = '诅咒：下回合 -1 骰';
            col = new Color(100, 56, 120, 255);
            break;
        }
        mkPanel(parent, 170, 34, x, y, col, 8, COL.border, 2);
        return mkLabel(parent, text, 16, new Color(255, 246, 224, 255), x, y);
      }

      // ---------------- 地图节点图标 ----------------

      /** 在 ~26px 范围内绘制节点图标（不含底色圆）。 */
      function drawNodeIcon(g, kind) {
        switch (kind) {
          case 'battle':
            {
              // 交叉双剑
              g.strokeColor = new Color(220, 90, 80, 255);
              g.lineWidth = 5;
              g.moveTo(-9, -9);
              g.lineTo(9, 9);
              g.stroke();
              g.moveTo(-9, 9);
              g.lineTo(9, -9);
              g.stroke();
              break;
            }
          case 'elite':
            {
              // 五角星
              g.fillColor = new Color(230, 150, 70, 255);
              for (var i = 0; i < 10; i++) {
                var a = Math.PI / 2 + i * Math.PI / 5;
                var r = i % 2 === 0 ? 13 : 6;
                var px = Math.cos(a) * r,
                  py = Math.sin(a) * r;
                if (i === 0) {
                  g.moveTo(px, py);
                } else {
                  g.lineTo(px, py);
                }
              }
              g.close();
              g.fill();
              break;
            }
          case 'treasure':
            {
              // 宝箱
              g.fillColor = new Color(230, 190, 80, 255);
              g.roundRect(-12, -8, 24, 15, 3);
              g.fill();
              g.strokeColor = new Color(90, 60, 20, 255);
              g.lineWidth = 2;
              g.moveTo(-12, -1);
              g.lineTo(12, -1);
              g.stroke();
              g.fillColor = new Color(90, 60, 20, 255);
              g.circle(0, -1, 2.6);
              g.fill();
              break;
            }
          case 'event':
            {
              // 感叹号
              g.fillColor = new Color(120, 170, 230, 255);
              g.roundRect(-3, -1, 6, 14, 3);
              g.fill();
              g.circle(0, -9, 3.4);
              g.fill();
              break;
            }
          case 'rest':
            {
              // 帐篷
              g.fillColor = new Color(120, 200, 120, 255);
              g.moveTo(-13, -10);
              g.lineTo(0, 11);
              g.lineTo(13, -10);
              g.close();
              g.fill();
              g.fillColor = new Color(20, 40, 24, 255);
              g.moveTo(-4, -10);
              g.lineTo(0, 0);
              g.lineTo(4, -10);
              g.close();
              g.fill();
              break;
            }
          case 'boss':
            {
              // 王冠
              g.fillColor = new Color(215, 70, 70, 255);
              g.moveTo(-13, -10);
              g.lineTo(-13, 5);
              g.lineTo(-7, -2);
              g.lineTo(0, 9);
              g.lineTo(7, -2);
              g.lineTo(13, 5);
              g.lineTo(13, -10);
              g.close();
              g.fill();
              break;
            }
        }
      }

      // ---------------- 标签 ----------------

      function mkTag(parent, text, x, y, color) {
        if (x === void 0) {
          x = 0;
        }
        if (y === void 0) {
          y = 0;
        }
        if (color === void 0) {
          color = COL.gold;
        }
        return mkLabel(parent, text, 16, color, x, y, 0);
      }
      cclegacy._RF.pop();
    }
  };
});

(function(r) {
  r('virtual:///prerequisite-imports/main', 'chunks:///_virtual/main'); 
})(function(mid, cid) {
    System.register(mid, [cid], function (_export, _context) {
    return {
        setters: [function(_m) {
            var _exportObj = {};

            for (var _key in _m) {
              if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _m[_key];
            }
      
            _export(_exportObj);
        }],
        execute: function () { }
    };
    });
});