import { state } from '../engine/state.js';
import { loadFbp, loadPic, loadWord, loadPal } from '../resources/pal.js';
import { loadEnemies, loadEnemyTeam, loadEnemyPos, loadSpriteFrame, loadLevelUpMagics, loadBattleFields } from './battleData.js';
import { loadMkf } from '../resources/loader.js';
import { deyj } from '../utils/deyj.js';
import { playMusic, stopMusic } from '../resources/music.js';
import { playSound } from '../resources/sound.js';
import { checkAndFadeOut, fadeIn, fadeOut } from '../ui/fade.js';
import { update } from '../ui/draw.js';
import { Script } from '../engine/script.js';
import { UI } from '../ui/panel.js';
import { ESC } from '../esc/esc.js';
import { UseItemMenu } from '../ui/useItemMenu.js';
import { intToShort } from '../utils/number.js';

// 站位坐标配置 (1人, 2人, 3人)
const PLAYER_POS_PRESETS = [
  [[240, 170]],                         // 1个队员
  [[200, 176], [256, 152]],             // 2个队员
  [[180, 180], [234, 170], [270, 146]]  // 3个队员
];

// 每个主角对应的默认初始战斗音效数据（提取自 data.mkf #3）
const DEFAULT_ROLE_SOUNDS = [
  { attack: 37, weapon: 1, critical: 5, magic: 9, death: 23, dying: 19 }, // 李逍遥
  { attack: 38, weapon: 2, critical: 6, magic: 10, death: 24, dying: 20 }, // 赵灵儿
  { attack: 39, weapon: 3, critical: 7, magic: 11, death: 25, dying: 21 }, // 林月如
  { attack: 38, weapon: 2, critical: 6, magic: 10, death: 24, dying: 20 }, // 巫后
  { attack: 40, weapon: 4, critical: 8, magic: 12, death: 26, dying: 22 }, // 阿奴
  { attack: 39, weapon: 3, critical: 7, magic: 11, death: 25, dying: 21 }  // 盖罗娇
];

// 核心状态变量
let battleId = 0;
let failScriptId = 0;
let fleeScriptId = 0;

let bgImage = null;
let borderImage = null;
let attackIcon = null;
let magicIcon = null;
let coopIcon = null;
let moreIcon = null;

export let players = [];
export let enemies = [];
let damagePopups = [];
let isBattleRunning = false;
let winSpaceResolve = null;
let battleResult = 1000;

// 控制是否渲染操作界面（左下角选择区和右下/中间角色HP/MP区）
let showCommandUI = false;

// 战斗状态机属性
let turn = 0;
let phase = 'select'; // 'select' | 'action' | 'end'
let activePlayerIndex = 0; // 当前选定指令的角色索引
let selectedAction = 0; // 0: 攻击, 1: 法术, 2: 合击, 3: 更多
let selectedMoreIndex = 0; // 更多选项索引
let selectedMoreItemIndex = 0; // 更多物品子菜单索引
let menuState = 'main'; // 'main' | 'target'
let targetEnemyIndex = 0; // 选中的目标敌人索引
let resolvePromise = null;
let battleTimer = null;

// 步骤 1：初始化战斗，载入各种数据和素材
export async function start(id, failId, fleeId) {
  battleId = id;
  failScriptId = failId;
  fleeScriptId = fleeId;
  battleResult = 1000; // 重置脚本控制的战斗结果

  // 步骤 1.1：判断前序场景是否已被 0x50 淡出。若是，则无需再次淡出；若否，则先播放淡出动画
  await checkAndFadeOut();

  // 步骤 1.2：切换为战斗模式，并初始化战斗状态机
  state.currentMode = 'battle';
  state.uiMode = 'block';
  isBattleRunning = true;
  turn = 1;
  phase = 'select';
  showCommandUI = false; // 初始时，隐藏战斗操作界面（待战前脚本结束后方可显示）
  activePlayerIndex = 0;
  selectedAction = 0;
  menuState = 'main';
  targetEnemyIndex = 0;
  damagePopups = [];

  // 加载战场背景 (FBP 格式)
  bgImage = loadFbp(state.battlefieldId);
  borderImage = loadPic(19);
  loadBattleFields();

  // 加载指令图标
  attackIcon = loadPic(41);
  magicIcon = loadPic(42);
  coopIcon = loadPic(43);
  moreIcon = loadPic(44);

  // 初始化敌人
  const enemyPosTable = loadEnemyPos();
  const allEnemyConfigs = loadEnemies();
  const teamObjIds = loadEnemyTeam(battleId);
  const wMaxEnemyIndex = teamObjIds.length - 1;

  enemies = [];
  for (let i = 0; i < teamObjIds.length; i++) {
    const objId = teamObjIds[i];
    const enemyConfigId = state.items[objId]?.roleId || 0;
    const cfg = allEnemyConfigs[enemyConfigId] || {};
    
    // 从 abc.mkf 加载敌人战斗图片数据包并进行 deyj 解压
    const spriteData = deyj(loadMkf('abc.mkf', enemyConfigId));

    const pos = enemyPosTable[i]?.[wMaxEnemyIndex] || { x: 50, y: 100 };
    const yPos = pos.y + (cfg.wYPosOffset || 0);

    enemies.push({
      id: enemyConfigId,
      objId: objId,
      index: enemies.length,
      name: `敌人 #${enemyConfigId}`,
      maxHp: cfg.wHealth ?? 100,
      hp: cfg.wHealth ?? 100,
      // 使用 ?? 运算符代替 || 以免合法的 0 属性配置被错误覆盖为 10
      defense: cfg.wDefense ?? 10,
      dexterity: cfg.wDexterity ?? 10,
      attackStrength: cfg.wAttackStrength ?? 10,
      level: cfg.wLevel ?? 1,
      physicalResistance: cfg.wPhysicalResistance ?? 0,
      x: pos.x,
      y: yPos,
      origX: pos.x,
      origY: yPos,
      spriteData: spriteData,
      currentFrame: 0,
      maxIdleFrames: cfg.wIdleFrames ?? 4,
      wMagicFrames: cfg.wMagicFrames ?? 0,
      wAttackFrames: cfg.wAttackFrames ?? 0,
      wActWaitFrames: cfg.wActWaitFrames ?? 0,
      animSpeed: cfg.wIdleAnimSpeed ?? 4,
      animTick: 0,
      attackSound: cfg.wAttackSound ?? 0,
      deathSound: cfg.wDeathSound ?? 0,
      wMagic: cfg.wMagic ?? 0,
      wMagicRate: cfg.wMagicRate ?? 0,
      wMagicStrength: cfg.wMagicStrength ?? 10,
      wMagicSound: cfg.wMagicSound || 0,
      wScriptOnTurnStart: state.items[objId]?.useScr || 0,
      wScriptOnBattleEnd: state.items[objId]?.equScr || 0,
      wScriptOnReady: state.items[objId]?.dropScr || 0,
      exp: cfg.wExp || 0,
      cash: cfg.wCash || 0,
      // 从配置中拷贝敌人可偷窃物品 ID 和数量，以支持飞龙探云手等窃取指令
      wStealItem: cfg.wStealItem || 0,
      nStealItem: cfg.nStealItem || 0
    });
  }

  // 初始化玩家角色
  players = [];
  const partySize = state.party.length;
  const posPreset = PLAYER_POS_PRESETS[Math.min(2, Math.max(0, partySize - 1))];

  for (let i = 0; i < partySize; i++) {
    const role = state.party[i];
    const roleStats = state.roles[role.index] || {};

    // 步骤 1.2.1：确保队伍成员进入战斗前，装备属性已经过校正
    if (roleStats && roleStats.equipments && !roleStats._equipCorrected) {
      roleStats._equipCorrected = true;
      for (let part = 0; part < 6; part++) {
        const eqId = roleStats.equipments[part];
        if (eqId && eqId !== 0) {
          const eqAttrs = getEquipItemAttributes(eqId);
          for (const key in eqAttrs) {
            if (typeof roleStats[key] !== 'number' || isNaN(roleStats[key])) {
              roleStats[key] = 0;
            }
            roleStats[key] += eqAttrs[key];
          }
        }
      }
    }

    const pos = posPreset[i] || [200, 150];

    // 从 f.mkf 加载玩家角色战斗动画数据包并进行 deyj 解压
    let spriteNum = roleStats.spriteNumInBattle;
    
    // 步骤 1.3：提供我方角色战斗精灵图包 ID 兜底映射
    // 当读档或初始精灵包为 0，且角色本身不是李逍遥 (index !== 0) 时，说明需要强行重定位为对应角色的专属包
    if (spriteNum === undefined || (spriteNum === 0 && role.index !== 0)) {
      const defaultSprites = [0, 1, 2, 3, 4, 8];
      spriteNum = defaultSprites[role.index] !== undefined ? defaultSprites[role.index] : 0;
    }
    const spriteData = deyj(loadMkf('f.mkf', spriteNum));

    const defSounds = DEFAULT_ROLE_SOUNDS[role.index] || {};
    players.push({
      index: role.index,
      name: role.name || `角色 #${role.index}`,
      maxHp: roleStats.maxHp || 100,
      hp: roleStats.hp || 100,
      maxMp: roleStats.maxMp || 100,
      mp: roleStats.mp || 100,
      defense: roleStats.defense || 10,
      dexterity: roleStats.dexterity || 10,
      attackStrength: roleStats.attackStrength || 10,
      magicStrength: roleStats.magicStrength || 10, // 保存灵力属性
      fleeRate: roleStats.fleeRate || 10, // 保存吉运/幸运属性
      poisonResistance: roleStats.poisonResistance || 10, // 保存避毒属性
      equipments: roleStats.equipments || {}, // 保存当前装备 ID 映射表
      magics: roleStats.magics || [], // 保存当前习得法术 ID 列表
      x: pos[0],
      y: pos[1],
      origX: pos[0],
      origY: pos[1],
      spriteData: spriteData,
      currentFrame: 0,
      action: null, // 选择的指令
      mgoId: role.tileId || 0, // 保存大地图 MGO 图元 ID
      spriteNum: spriteNum, // 保存战斗贴图包 ID (f.mkf ID)
      attackSound: roleStats.attackSound || defSounds.attack || 0,
      weaponSound: roleStats.weaponSound || defSounds.weapon || 0,
      criticalSound: roleStats.criticalSound || defSounds.critical || 0,
      magicSound: roleStats.magicSound || defSounds.magic || 0,
      deathSound: roleStats.deathSound || defSounds.death || 0,
      dyingSound: roleStats.dyingSound || defSounds.dying || 0,
      wScriptOnFriendDeath: state.items[role.index + 1]?.useScr || 0,
      wScriptOnDying: state.items[role.index + 1]?.equScr || 0
    });
  }

  // 确保入战时正确应用角色的状态姿态帧（如倒地死亡或虚弱帧）
  players.forEach(p => restorePlayerFrame(p));

  // 回合开始前：为中毒、定身、眠、混乱的角色预设动作指令，跳过手动选择
  players.forEach(p => {
    if (p.hp > 0) {
      const role = state.roles[p.index];
      if (role && role.status) {
        if (role.status[0] > 0) {
          p.action = { type: 'confused' };
        } else if (role.status[1] > 0 || role.status[2] > 0) {
          p.action = { type: 'pass' };
        } else {
          p.action = null;
        }
      } else {
        p.action = null;
      }
    } else {
      p.action = null;
    }
  });

  // 寻找到第一个可由玩家手动控制的队员
  activePlayerIndex = players.findIndex(p => isPlayerControllable(p));
  if (activePlayerIndex === -1) {
    const hasAlive = players.some(p => p.hp > 0);
    if (hasAlive) {
      // 若有活着的主角但全部不可控，直接自动进入行动结算阶段
      runActionPhase();
      return;
    } else {
      activePlayerIndex = 0;
    }
  }

  const enemyObjs = teamObjIds?.map(id=>({battleId,enemyId:id,abcId:state.items?.[id]?.roleId}));
  const roles = players.map(p=>({index:p.index,mgoId:p.mgoId,spriteNum:p.spriteNum}));
  console.log(`战斗开启: 敌方队伍 ID ${battleId}, 成员 ${enemies.length} 个 ${JSON.stringify(enemyObjs)}; 我方成员 ${players.length} 个 ${JSON.stringify(roles)}。我方人员物理攻击动作从 f.mkf 的 spriteNum 精灵包读取，敌方人员物理攻击动作从 abc.mkf 的 abcId 精灵包读取。`);

  // 步骤 1.4：绘制战斗画面的第一帧并启动战斗时钟
  draw();

  // 播放战斗背景音乐（由 0x45 setFightMusic 预先写入 state.wNumBattleMusic）
  const battleMusicNum = state.wNumBattleMusic || 0;
  if (battleMusicNum > 0) {
    console.log(`[Battle] 开始播放战斗背景音乐 ID: ${battleMusicNum}`);
    playMusic(battleMusicNum, true, 0);
  }

  // 步骤 1.5：平滑淡入展现战斗画面
  await fadeIn();

  // 运行战前 pre-battle 的回合开始脚本
  for (let i = 0; i < enemies.length; i++) {
    if (checkBattleEnd()) {
      break;
    }
    const enemy = enemies[i];
    if (enemy.hp > 0 && enemy.wScriptOnTurnStart) {
      const result = await Script.runTriggerScript(enemy.wScriptOnTurnStart, enemy, 'enemy');
      enemy.wScriptOnTurnStart = result;
    }
  }

  // 战前回合开始脚本执行完毕后，如战斗未结束则显示操作界面
  if (phase === 'select' && !checkBattleEnd()) {
    showCommandUI = true;
    state.uiMode = 'operate';
    draw();
  }

  while(true) {
    if (!isBattleRunning) {
      return battleResult;
    }

    await startBattleClock();
    await sleep(100);
  }
}

// 步骤 2：启动战斗渲染时钟与敌人动画嘀嗒
function startBattleClock() {
  // 步进敌人 idle 动画帧
  enemies.forEach(e => {
    if (e.hp <= 0 || e.isActing) {
      return;
    }
    e.animTick++;
    if (e.animTick >= e.animSpeed) {
      e.animTick = 0;
      e.currentFrame = (e.currentFrame + 1) % e.maxIdleFrames;
    }
  });

  // 如果处于对话按键等待挂起状态，同步更新对话框的闪烁箭头动画
  if (window.Talk && window.Talk.isWaiting) {
    window.Talk.tickArrow();
  }

  // 刷新绘制
  draw();
}

// 步骤 2.9：法术特效与名字渲染的辅助状态
export let activeEffects = [];
export let currentMagicEffect = null;
export let selectedMagicIndex = 0;
export let magicScrollRow = 0;
export let targetPlayerIndex = 0;

// 步骤 2.95：辅助点阵描述渲染器与调色板数字渲染器
function drawSpellDesc(ctx, magicId, startX, startY, color) {
  const descBytes = state.desc[magicId];
  if (!descBytes) return;
  let dx = startX;
  let dy = startY;
  let idx = 0;
  while (idx < descBytes.length) {
    const b = descBytes.getByte(idx);
    if (b === 42) {
      dx = startX;
      dy += 16;
      idx++;
    } else if (b === 32) {
      dx += 8;
      idx++;
    } else if (b < 128) {
      const img = loadWord(b, color);
      if (img) {
        ctx.drawImage(img, dx, dy + 1);
      }
      dx += 8;
      idx++;
    } else {
      if (idx + 1 < descBytes.length) {
        const charCode = descBytes.getShort(idx);
        const img = loadWord(charCode, color);
        if (img) {
          ctx.drawImage(img, dx, dy);
        }
        dx += 16;
        idx += 2;
      } else {
        idx++;
      }
    }
  }
}

function drawNumberToBattleCtx(num, x, y, type = 'cyan') {
  const baseId = type === 'hp' || type === 'yellow' ? 20 : 57;
  const numStr = num.toString();
  const digitW = 6;
  const battleCtx = state.contexts.battle;
  if (!battleCtx) return x;
  let currX = x;
  for (let i = 0; i < numStr.length; i++) {
    const digit = parseInt(numStr.charAt(i));
    const digitImg = loadPic(baseId + digit);
    if (digitImg) {
      battleCtx.drawImage(digitImg, currX, y);
    }
    currX += digitW;
  }
  return currX;
}

export function drawWordToCtx(ctx, wordId, x, y, color) {
  const word = state.words[wordId];
  if (!word) return;
  for (let i = 0; i < word.length / 2; i++) {
    const charCode = word.getShort(i * 2);
    if (charCode === 0x2020) continue;
    const img = loadWord(charCode, color);
    if (img) {
      ctx.drawImage(img, x + i * 16, y);
    }
  }
}

// 步骤 3：战斗系统界面统一渲染绘制核心
export function draw() {
  const backCtx = state.contexts.back;
  const mainCtx = state.contexts.main;
  const battleCtx = state.contexts.battle;

  if (!backCtx || !mainCtx || !battleCtx) {
    return;
  }

  // 1. 清屏并绘制战场背景
  backCtx.clearRect(0, 0, 320, 200);
  if (bgImage) {
    backCtx.drawImage(bgImage, 0, 0);
  }

  mainCtx.clearRect(0, 0, 320, 200);
  battleCtx.clearRect(0, 0, 320, 200);

  // 2. 收集并合并所有活着的战斗成员（包括我方与敌方），按照屏幕纵深 Y 坐标升序排序
  // 随后采用 2.5D 画家算法依次绘制，确保前排大体型角色能正确遮挡后排人物而不会遮盖异常
  const renderQueue = [];

  enemies.forEach(e => {
    if (e.hp > 0) {
      renderQueue.push({ type: 'enemy', actor: e });
    }
  });

  players.forEach(p => {
    // 即使死亡也不要隐藏我方角色，以显示其倒地状态并支持复活法术的目标选择
    renderQueue.push({ type: 'player', actor: p });
  });

  renderQueue.sort((a, b) => a.actor.y - b.actor.y);

  renderQueue.forEach(item => {
    const actor = item.actor;
    const frameImg = loadSpriteFrame(actor.spriteData, actor.currentFrame);
    if (frameImg) {
      const dx = actor.x - frameImg.width / 2;
      const dy = actor.y - frameImg.height;

      // 选中敌人目标时高亮闪烁（对应 sdlpal PAL_RLEBlitWithColorShift(sprite, ..., colorShift=7)）
      if (phase === 'select' && (menuState === 'target' || menuState === 'target_magic' || menuState === 'target_enemy_item') && item.type === 'enemy') {
        const isTarget = enemies.indexOf(actor) === targetEnemyIndex;
        if (isTarget && Math.floor(Date.now() / 250) % 2 === 1) {
          mainCtx.filter = 'brightness(2.5) saturate(0.2)';
        } else {
          mainCtx.filter = 'none';
        }
      } else if (phase === 'select' && (menuState === 'target_player_magic' || menuState === 'target_player_item') && item.type === 'player') {
        const isTarget = players.indexOf(actor) === targetPlayerIndex;
        if (isTarget && Math.floor(Date.now() / 250) % 2 === 1) {
          mainCtx.filter = 'brightness(2.5) saturate(0.2)';
        } else {
          mainCtx.filter = 'none';
        }
      } else if (actor.filter) {
        mainCtx.filter = actor.filter;
      } else {
        mainCtx.filter = 'none';
      }

      mainCtx.drawImage(frameImg, dx, dy);
      mainCtx.filter = 'none';
      actor.width = frameImg.width;
      actor.height = frameImg.height;
    }
  });

  // 3.5. 绘制当前活跃的法术特效 (渲染于背景和人物上方)
  activeEffects.forEach(effect => {
    const frameImg = loadSpriteFrame(effect.spriteData, effect.frameIndex);
    if (frameImg) {
      const dx = effect.x - frameImg.width / 2;
      const dy = effect.y - frameImg.height;
      mainCtx.drawImage(frameImg, dx, dy);
    }
  });

  // 4. 指令选择阶段 UI 绘制
  if (showCommandUI && phase === 'select') {
    // 当正处于主菜单、法术菜单或更多菜单时展示左下角动作指令菱形菜单（选择目标时隐藏）
    let isDrawingMenu = false;
    let highlightIdx = selectedAction;
    if (menuState === 'main') {
      isDrawingMenu = true;
    } else if (menuState === 'magic') {
      isDrawingMenu = true;
      highlightIdx = 1; // 处于法术子操作阶段时，高亮“法术”图标 (1)
    } else if (menuState === 'more' || menuState === 'more_item') {
      isDrawingMenu = true;
      highlightIdx = 3; // 处于更多子操作阶段时，高亮“更多”图标 (3)
    }

    if (isDrawingMenu) {
      const iconCoords = [
        { img: attackIcon, x: 27, y: 140 }, // 攻击 (0)
        { img: magicIcon, x: 0, y: 155 },  // 法术 (1)
        { img: coopIcon, x: 54, y: 155 },   // 合击 (2)
        { img: moreIcon, x: 27, y: 170 }    // 更多 (3)
      ];

      iconCoords.forEach((icon, idx) => {
        if (!icon.img) {
          return;
        }
        if (highlightIdx === idx) {
          // 选中图标：正常彩色显示（对应 sdlpal PAL_RLEBlitToSurface 正常渲染）
          battleCtx.filter = 'none';
          battleCtx.drawImage(icon.img, icon.x, icon.y);
        } else {
          // 未选中图标：灰度暗化（对应 sdlpal PAL_RLEBlitMonoColor bColor=0, iColorShift=-4）
          battleCtx.filter = 'grayscale(1) brightness(0.55)';
          battleCtx.drawImage(icon.img, icon.x, icon.y);
        }
      });
      // 恢复默认滤镜，防止影响后续绘制
      battleCtx.filter = 'none';

      // 绘制指示当前正在选择的队员箭头
      // 参考 sdlpal: x = pos.x - 8, y = pos.y - 74（pos 是角色脚底中心，74 是固定头顶偏移）
      const activePlayer = players[activePlayerIndex];
      if (activePlayer && activePlayer.hp > 0) {
        // 交替显示红色(68号)和普通(69号)箭头，对应 sdlpal s_iFrame & 1 的帧交替
        const arrowPicId = Math.floor(Date.now() / 250) % 2 === 0 ? 69 : 70;
        const arrowImg = loadPic(arrowPicId);
        if (arrowImg) {
          // sdlpal: x = playerPos.x - 8, y = playerPos.y - 74
          const ax = activePlayer.x - 8;
          const ay = activePlayer.y - 74;
          battleCtx.drawImage(arrowImg, ax, ay);
        }
      }
    }

    // 绘制法术选择面板（选择目标时临时隐藏）
    if (menuState === 'magic') {
      const activePlayer = players[activePlayerIndex];
      if (activePlayer && activePlayer.magics && activePlayer.magics.length > 0) {
        // 1. 绘制左上角使用MP/当前主角MP框 (x: 10, y: 8, w: 80, h: 22)
        UI.drawSingleLineBox(0, 0, 6, battleCtx);

        const currentMagicId = activePlayer.magics[selectedMagicIndex];
        const currentItemObj = state.items[currentMagicId];
        let currentCostMP = 0;
        if (currentItemObj) {
          const currentMagicNumber = currentItemObj.roleId; // 仙术编号对应 rgwData[0] (roleId)
          const currentMagic = state.magics[currentMagicNumber];
          if (currentMagic) {
            currentCostMP = currentMagic.wCostMP;
          }
        }

        // 用调色板数字图片绘制 (青色: 57)
        let startX = 18;
        startX = drawNumberToBattleCtx(currentCostMP, startX, 15, 'cyan');
        const slashImg = loadPic(40);
        if (slashImg) {
          battleCtx.drawImage(slashImg, startX + 1, 15);
          startX += slashImg.width + 3;
        } else {
          startX += 6;
        }
        drawNumberToBattleCtx(activePlayer.mp, startX, 15, 'cyan');

        // 2. 绘制选中法术的上方描述文字 (中偏上位置：x: 100, y: 8)
        if (currentItemObj) {
          drawSpellDesc(battleCtx, currentMagicId, 120, 2, 0x00FCDC84); // 0x00FCDC84 仙剑米黄色
        }

        // 3. 绘制锦缎美感大控制盒 (x: 10, y: 40, w: 300, h: 110)，完全使用九宫格贴图拼框
        UI.drawScrollBox(10, 40, 17, 5, battleCtx);

        // 4. 绘制法术三列列表网格
        const colW = 88;
        const rowH = 18;
        const startY = 48;

        const maxRows = 5;
        const totalSpells = activePlayer.magics.length;

        // 根据光标自动滚动页面行
        const currentCursorRow = Math.floor(selectedMagicIndex / 3);
        if (currentCursorRow < magicScrollRow) {
          magicScrollRow = currentCursorRow;
        } else if (currentCursorRow >= magicScrollRow + maxRows) {
          magicScrollRow = currentCursorRow - (maxRows - 1);
        }

        for (let r = 0; r < maxRows; r++) {
          const rowIdx = magicScrollRow + r;
          const yPos = startY + r * rowH;

          for (let c = 0; c < 3; c++) {
            const idx = rowIdx * 3 + c;
            if (idx >= totalSpells) break;

            const magicId = activePlayer.magics[idx];
            const itemObj = state.items[magicId];
            if (!itemObj) continue;

            const wordId = magicId; // 仙术在 word.dat 中的短语 ID 就是其 Object ID 本身 (magicId)
            const magicNumber = itemObj.roleId; // 仙术的真实编号为其 rgwData[0] (roleId)
            const magic = state.magics[magicNumber];
            if (!magic) continue;

            const isSelected = idx === selectedMagicIndex;
            const xPos = 34 + c * colW;

            // 判定字体色调：MP不足深灰，选中是黄色高亮，否则经典灰色
            let wordColor = undefined;
            if (activePlayer.mp < magic.wCostMP) {
              wordColor = 0x00555555;
            } else if (isSelected) {
              wordColor = 0x00FCDC84; // 黄色高亮 (COLOR_YELLOW)
            } else {
              wordColor = 0x00D4D0C0; // 经典灰色 (COLOR_GRAY)
            }

            drawWordToCtx(battleCtx, wordId, xPos, yPos, wordColor);

            // 绘制高亮光标 (PIC #70)
            if (isSelected) {
              const arrowImg = loadPic(70);
              if (arrowImg) {
                const word = state.words[wordId];
                const wordLen = word ? word.length / 2 : 2;
                battleCtx.drawImage(arrowImg, xPos + 24, yPos + 11);
              }
            }
          }
        }
      }
    }

    // 绘制“更多”及“道具使用/投掷”选择面板
    if (menuState === 'more' || menuState === 'more_item') {
      UI.drawModalBox(10, 8, 3, 5, battleCtx);
      for (let i = 0; i < 5; i++) {
        const wordId = 56 + i;
        const isSelected = (menuState === 'more' && i === selectedMoreIndex);
        const color = isSelected ? 0x00FCDC84 : 0x00D4D0C0;
        drawWordToCtx(battleCtx, wordId, 22, 20 + i * 18, color);
      }
      if (menuState === 'more_item') {
        UI.drawModalBox(34, 34, 2, 2, battleCtx);
        for (let i = 0; i < 2; i++) {
          const wordId = 23 + i;
          const isSelected = (i === selectedMoreItemIndex);
          const color = isSelected ? 0x00FCDC84 : 0x00D4D0C0;
          drawWordToCtx(battleCtx, wordId, 46, 46 + i * 18, color);
        }
      }
    }
  }

  // 5. 绘制右侧状态栏面板 (头像与 HP/MP)
  if (showCommandUI) {
    players.forEach((p, i) => {
      const bx = 91 + 77 * i;
      const by = 165;

      // 边框
      if (borderImage) {
        battleCtx.drawImage(borderImage, bx, by);
      }

      // 头像 (49 + 角色 0-based 索引)
      const avatarImg = loadPic(49 + p.index);
      if (avatarImg) {
        if (p.hp <= 0) {
          battleCtx.save();
          battleCtx.filter = 'grayscale(100%)';
          battleCtx.drawImage(avatarImg, bx - 3, by);
          battleCtx.restore();
        } else {
          battleCtx.drawImage(avatarImg, bx - 3, by);
        }
      }

      // 数字渲染：显示「当前HP / 最大HP」和「当前MP / 最大MP」
      // 参考 sdlpal: PAL_DrawNumber(HP, ...) + SPRITENUM_SLASH(#40号图) + PAL_DrawNumber(MaxHP, ...)
      // HP 行（0/最大HP）
      drawHpMpLine(battleCtx, Math.max(0, p.hp), p.maxHp, 'hp', bx + 29, by + 6);
      // MP 行（青色数字 57~66，中间是 #40 号斜杠图片）
      drawHpMpLine(battleCtx, p.mp, p.maxMp, 'mp', bx + 29, by + 20);

      // 步骤 2.5：在头像区域按原版指定位置渲染封、定、眠、乱的异常状态文字贴图
      const role = state.roles[p.index];
      if (role && p.hp > 0 && role.status) {
        const palette = loadPal(state.paletteId || 0);
        const statusColors = {
          0: 0x7070D8, // 乱：#92号颜色 #7070D8
          1: palette ? (palette[0xBF] & 0x00ffffff) : 0x00FF00, // 定
          2: palette ? (palette[0x0E] & 0x00ffffff) : 0x0000FF, // 眠
          3: palette ? (palette[0x3C] & 0x00ffffff) : 0xFF00FF, // 封
        };
        const STATUS_CONFIGS = {
          0: { wordId: 29, ox: 35, oy: 19 }, // 乱
          1: { wordId: 27, ox: 44, oy: 12 }, // 定
          2: { wordId: 28, ox: 54, oy: 1 },  // 眠
          3: { wordId: 26, ox: 55, oy: 20 }, // 封
        };
        [0, 1, 2, 3].forEach(statusId => {
          if (role.status[statusId] !== undefined && role.status[statusId] > 0) {
            const config = STATUS_CONFIGS[statusId];
            if (config) {
              const color = statusColors[statusId];
              drawWordToCtx(battleCtx, config.wordId, bx + config.ox, by + config.oy, color);
            }
          }
        });
      }
    });
  }

  // 6. 绘制弹出的红/白伤害字样
  const time = Date.now();
  damagePopups = damagePopups.filter(p => time - p.startTime < 750);
  damagePopups.forEach(p => {
    const elapsed = time - p.startTime;
    const yOffset = (elapsed / 750) * 10;
    const alpha = 1.0 - (elapsed / 750);

    battleCtx.save();
    battleCtx.globalAlpha = alpha;
    battleCtx.fillStyle = p.isPlayer ? '#ffffff' : '#ff3333';
    battleCtx.strokeStyle = '#000000';
    battleCtx.lineWidth = 2;
    battleCtx.font = 'bold 12px sans-serif';
    battleCtx.textAlign = 'center';
    
    // 依据 sdlpal 规则，我方 HP 飘字 y 轴起始偏移 -75，敌方偏移 -115，并设置最小 y 轴边界值 10 防止溢出屏幕
    let yBase = p.isPlayer ? p.actor.y - 75 : p.actor.y - 115;
    if (yBase < 10) {
      yBase = 10;
    }

    const ty = yBase - yOffset;
    
    battleCtx.strokeText(p.value.toString(), p.actor.x, ty);
    battleCtx.fillText(p.value.toString(), p.actor.x, ty);
    battleCtx.restore();
  });
}

// 绘制「当前值 / 最大值」一行，包含对应色调数字 + 斜杠图片
// 参考 sdlpal: HP 用 20~29 号黄色数字，MP 用 57~66 号青色数字，斜杠用 #40 号图片
function drawHpMpLine(ctx, cur, max, type, startX, startY) {
  const baseId = type === 'hp' ? 20 : 57;
  const slashImg = loadPic(40); // data.mkf #9 第40号图片 = SPRITENUM_SLASH
  const digitW = 6; // 每个数字图片宽度（5x8，留1px间隔）

  // 计算两组数字的像素总宽度
  const curStr = cur.toString();
  const maxStr = max.toString();
  const slashW = slashImg ? slashImg.width + 1 : 5;

  // 先确定斜杠位置，斜杠左边放当前值（右对齐），右边放最大值（左对齐）
  // 当前值：右对齐到斜杠左侧
  let x = startX;
  for (let i = 0; i < curStr.length; i++) {
    const digit = parseInt(curStr.charAt(i));
    const digitImg = loadPic(baseId + digit);
    if (digitImg) {
      ctx.drawImage(digitImg, x, startY);
    }
    x += digitW;
  }

  // 斜杠
  if (slashImg) {
    ctx.drawImage(slashImg, x, startY);
    x += slashW;
  }

  // 最大值：左对齐在斜杠右侧
  for (let i = 0; i < maxStr.length; i++) {
    const digit = parseInt(maxStr.charAt(i));
    const digitImg = loadPic(baseId + digit);
    if (digitImg) {
      ctx.drawImage(digitImg, x, startY);
    }
    x += digitW;
  }
}

// 判断战斗角色当前是否可由玩家手动控制（未死亡、未处于定、眠、乱状态）
function isPlayerControllable(p) {
  if (p.hp <= 0) {
    return false;
  }
  const role = state.roles[p.index];
  if (role && role.status) {
    // 0: 乱, 1: 定, 2: 眠
    if (role.status[0] > 0 || role.status[1] > 0 || role.status[2] > 0) {
      return false;
    }
  }
  return true;
}

// 推进到下一活着的队员指令选择，并自动过滤不可手动控制的角色
function advanceToNextPlayer() {
  let nextIdx = activePlayerIndex + 1;
  while (nextIdx < players.length && !isPlayerControllable(players[nextIdx])) {
    nextIdx++;
  }

  if (nextIdx < players.length) {
    activePlayerIndex = nextIdx;
    menuState = 'main';
    selectedAction = 0;
  } else {
    // 所有活着的队员动作都选择完毕，开始回合结算
    runActionPhase();
  }
}

// 步骤 4：处理战斗指令输入事件，对接 input.js
export function onInput(input) {
  // 步骤 4.0：如果是战斗结算期间等待玩家空格确认，则在此进行优先拦截
  if (winSpaceResolve && input === 'blank') {
    const resolve = winSpaceResolve;
    winSpaceResolve = null;
    resolve();
    return;
  }

  if (phase !== 'select') {
    return;
  }

  // 快捷键处理：处理选择行动阶段的各种快捷按键操作
  const activePlayer = players[activePlayerIndex];
  if (activePlayer && activePlayer.hp > 0) {
    switch (input) {
      case 'q': {
        // 逃跑
        playSound(29);
        activePlayer.action = {
          type: 'flee'
        };
        advanceToNextPlayer();
        draw();
        return;
      }
      case 'd': {
        // 防御
        playSound(29);
        activePlayer.action = {
          type: 'defend'
        };
        advanceToNextPlayer();
        draw();
        return;
      }
      case 's': {
        // 查看状态
        playSound(29);
        ESC.onStatus();
        draw();
        return;
      }
      case 'a': {
        // 自动普通攻击 (围攻)
        playSound(29);
        const targetIdx = enemies.findIndex(e => e.hp > 0);
        if (targetIdx !== -1) {
          for (let i = activePlayerIndex; i < players.length; i++) {
            if (players[i].hp > 0) {
              players[i].action = {
                type: 'attack',
                target: targetIdx
              };
            }
          }
          runActionPhase();
        }
        draw();
        return;
      }
      case 'w': {
        // 投掷物品
        playSound(29);
        openItemMenuForActivePlayer(4);
        draw();
        return;
      }
      case 'e': {
        // 使用物品
        playSound(29);
        openItemMenuForActivePlayer(1);
        draw();
        return;
      }
      case 'r': {
        // 重复上次攻击
        if (activePlayer.lastAction) {
          let valid = true;
          const act = { ...activePlayer.lastAction };
          
          if (act.type === 'attack') {
            if (act.target >= enemies.length || enemies[act.target].hp <= 0) {
              act.target = enemies.findIndex(e => e.hp > 0);
            }
            if (act.target === -1) {
              valid = false;
            }
          } else if (act.type === 'magic') {
            const magicId = act.magicId;
            const itemObj = state.items[magicId];
            if (!itemObj) {
              valid = false;
            } else {
              const magicNumber = itemObj.roleId;
              const magic = state.magics[magicNumber];
              if (!magic || activePlayer.mp < magic.wCostMP) {
                valid = false;
              } else {
                const isToEnemy = [0, 1, 2, 3, 9].includes(magic.wType);
                const isTargetAll = [1, 2, 3, 5, 9].includes(magic.wType);
                if (!isTargetAll) {
                  if (isToEnemy) {
                    if (act.target >= enemies.length || enemies[act.target].hp <= 0) {
                      act.target = enemies.findIndex(e => e.hp > 0);
                    }
                    if (act.target === -1) {
                      valid = false;
                    }
                  } else {
                    const isRevival = isRevivalSpell(magicId);
                    if (act.target >= players.length || (players[act.target].hp <= 0 && !isRevival)) {
                      act.target = activePlayerIndex;
                    }
                  }
                }
              }
            }
          } else if (act.type === 'useItem' || act.type === 'throwItem') {
            const itemId = act.itemId;
            const ownItems = state.ownItems || [];
            const idx = ownItems.indexOf(itemId);
            if (idx === -1) {
              valid = false;
            } else {
              const itemObj = state.items[itemId];
              const isTargetAll = (itemObj.flags & 16) !== 0;
              if (!isTargetAll) {
                if (act.type === 'throwItem') {
                  if (act.target >= enemies.length || enemies[act.target].hp <= 0) {
                    act.target = enemies.findIndex(e => e.hp > 0);
                  }
                  if (act.target === -1) {
                    valid = false;
                  }
                } else {
                  const isRevival = isRevivalItem(itemId);
                  if (act.target >= players.length || (players[act.target].hp <= 0 && !isRevival)) {
                    act.target = activePlayerIndex;
                  }
                }
              }
            }
          } else if (act.type === 'defend' || act.type === 'flee') {
            // 防御和逃跑动作始终有效
          } else {
            valid = false;
          }
          
          if (valid) {
            playSound(29);
            activePlayer.action = act;
            advanceToNextPlayer();
          } else {
            playSound(31);
          }
        } else {
          playSound(31);
        }
        draw();
        return;
      }
      case 'f': {
        // 步骤 0.1：拦截封印状态，禁止使用仙术
      const player = players[activePlayerIndex];
      const role = state.roles[player.index];
      if (role && role.status && role.status[3] > 0) {
        playSound(31);
        return;
      }

      // 使用最强法术（除“酒神”和“乾坤一掷”外）
      let bestMagicId = -1;
        let maxDamage = -1;
        let bestMagic = null;
        
        if (activePlayer.magics && activePlayer.magics.length > 0) {
          activePlayer.magics.forEach(magicId => {
            if (isBacchusOrMoneyThrow(magicId)) return;
            const itemObj = state.items[magicId];
            if (!itemObj) return;
            const magicNumber = itemObj.roleId;
            const magic = state.magics[magicNumber];
            if (!magic) return;
            
            const isToEnemy = [0, 1, 2, 3, 9].includes(magic.wType);
            if (isToEnemy) {
              const damage = magic.wBaseDamage || 0;
              if (damage > maxDamage) {
                maxDamage = damage;
                bestMagicId = magicId;
                bestMagic = magic;
              }
            }
          });
        }
        
        if (bestMagicId !== -1 && bestMagic) {
          if (activePlayer.mp >= bestMagic.wCostMP) {
            playSound(29);
            const isTargetAll = [1, 2, 3, 5, 9].includes(bestMagic.wType);
            if (isTargetAll) {
              activePlayer.action = {
                type: 'magic',
                magicId: bestMagicId,
                target: 0
              };
              advanceToNextPlayer();
            } else {
              activePlayer.pendingMagic = bestMagicId;
              targetEnemyIndex = enemies.findIndex(e => e.hp > 0);
              if (targetEnemyIndex !== -1) {
                menuState = 'target_magic';
              }
            }
            draw();
            return;
          }
        }
        
        // 如果真气不足或没有攻击法术，采用一般攻击
        playSound(29);
        targetEnemyIndex = enemies.findIndex(e => e.hp > 0);
        if (targetEnemyIndex !== -1) {
          menuState = 'target';
        }
        draw();
        return;
      }
    }
  }

  if (menuState === 'main') {
    // 菜单选择模式
    switch (input) {
      case 'up':
        selectedAction = 0; // 攻击
        break;
      case 'left':
        selectedAction = 1; // 法术
        break;
      case 'right':
        selectedAction = 2; // 合击
        break;
      case 'down':
        selectedAction = 3; // 更多
        break;
      case 'blank': // 确认
        if (selectedAction === 0) {
          // 进入选择目标敌人状态，初始化为第一个活着的敌人
          targetEnemyIndex = enemies.findIndex(e => e.hp > 0);
          if (targetEnemyIndex !== -1) {
            menuState = 'target';
            playSound(29);
          }
        } else if (selectedAction === 1) {
          // 确认进入法术选择：拦截封印状态，禁止使用仙术
          const player = players[activePlayerIndex];
          const role = state.roles[player.index];
          if (role && role.status && role.status[3] > 0) {
            playSound(31);
            return;
          }

          if (player.magics && player.magics.length > 0) {
            selectedMagicIndex = 0;
            magicScrollRow = 0;
            menuState = 'magic';
            playSound(29);
          } else {
            playSound(31);
          }
        } else if (selectedAction === 2) {
          // 确认合击：判定释放合击门槛
          const player = players[activePlayerIndex];
          const role = state.roles[player.index];
          // 统计活着的非状态异常队友数量
          const healthyNumber = players.filter(p => p.hp > 0 && !(state.roles[p.index]?.status && (state.roles[p.index].status[0] > 0 || state.roles[p.index].status[1] > 0 || state.roles[p.index].status[2] > 0 || state.roles[p.index].status[3] > 0))).length;
          const isCurrentPlayerHealthy = player.hp > 0 && !(role && role.status && (role.status[0] > 0 || role.status[1] > 0 || role.status[2] > 0 || role.status[3] > 0));

          if (players.length > 1 && isCurrentPlayerHealthy && healthyNumber > 1) {
            targetEnemyIndex = enemies.findIndex(e => e.hp > 0);
            if (targetEnemyIndex !== -1) {
              menuState = 'coop_target';
              playSound(29);
            }
          } else {
            playSound(31);
          }
        } else if (selectedAction === 3) {
          // 确认进入“更多”二级菜单
          selectedMoreIndex = 0;
          menuState = 'more';
          playSound(29);
        }
        break;
      case 'ESC':
        // 回退选择上一个人的指令，并跳过不受控的角色
        if (activePlayerIndex > 0) {
          do {
            activePlayerIndex--;
          } while (activePlayerIndex >= 0 && !isPlayerControllable(players[activePlayerIndex]));

          if (activePlayerIndex >= 0) {
            players[activePlayerIndex].action = null;
          } else {
            activePlayerIndex = players.findIndex(p => isPlayerControllable(p));
            if (activePlayerIndex === -1) {
              activePlayerIndex = 0;
            }
          }
        }
        break;
    }
  } else if (menuState === 'target') {
    // 目标选择模式
    switch (input) {
      case 'left':
      case 'up': {
        // 上一个活着的敌人
        let idx = targetEnemyIndex;
        do {
          idx = (idx - 1 + enemies.length) % enemies.length;
        } while (enemies[idx].hp <= 0 && idx !== targetEnemyIndex);
        targetEnemyIndex = idx;
        break;
      }
      case 'right':
      case 'down': {
        // 下一个活着的敌人
        let idx = targetEnemyIndex;
        do {
          idx = (idx + 1) % enemies.length;
        } while (enemies[idx].hp <= 0 && idx !== targetEnemyIndex);
        targetEnemyIndex = idx;
        break;
      }
      case 'blank': // 确认攻击此目标
        players[activePlayerIndex].action = {
          type: 'attack',
          target: targetEnemyIndex
        };
        advanceToNextPlayer();
        break;
      case 'ESC': // 取消选择，返回指令菜单
        menuState = 'main';
        break;
    }
  } else if (menuState === 'coop_target') {
    // 合击选择目标敌人
    switch (input) {
      case 'left':
      case 'up': {
        let idx = targetEnemyIndex;
        do {
          idx = (idx - 1 + enemies.length) % enemies.length;
        } while (enemies[idx].hp <= 0 && idx !== targetEnemyIndex);
        targetEnemyIndex = idx;
        playSound(29);
        break;
      }
      case 'right':
      case 'down': {
        let idx = targetEnemyIndex;
        do {
          idx = (idx + 1) % enemies.length;
        } while (enemies[idx].hp <= 0 && idx !== targetEnemyIndex);
        targetEnemyIndex = idx;
        playSound(29);
        break;
      }
      case 'blank': { // 确认释放合击
        players[activePlayerIndex].action = {
          type: 'coop',
          target: targetEnemyIndex
        };
        // 扣除本回合其他队员的行动权
        for (let j = activePlayerIndex + 1; j < players.length; j++) {
          if (players[j].hp > 0 && isPlayerControllable(players[j])) {
            players[j].action = { type: 'pass' };
          }
        }
        playSound(29);
        runActionPhase();
        break;
      }
      case 'ESC':
        menuState = 'main';
        playSound(30);
        break;
    }
  } else if (menuState === 'magic') {
    // 队员法术网格 (3列) 翻滚选择
    const player = players[activePlayerIndex];
    switch (input) {
      case 'left':
        if (selectedMagicIndex > 0) {
          selectedMagicIndex--;
          playSound(29);
        }
        break;
      case 'right':
        if (selectedMagicIndex < player.magics.length - 1) {
          selectedMagicIndex++;
          playSound(29);
        }
        break;
      case 'up':
        if (selectedMagicIndex >= 3) {
          selectedMagicIndex -= 3;
          playSound(29);
        }
        break;
      case 'down':
        if (selectedMagicIndex + 3 < player.magics.length) {
          selectedMagicIndex += 3;
          playSound(29);
        }
        break;
      case 'ESC':
        menuState = 'main';
        playSound(30);
        break;
      case 'blank': {
        const magicId = player.magics[selectedMagicIndex];
        const itemObj = state.items[magicId];
        if (!itemObj) break;

        const magicNumber = itemObj.roleId; // 仙术编号对应 rgwData[0] (roleId)
        const magic = state.magics[magicNumber];
        if (!magic) break;

        // MP 判定，不够时播放错误音
        if (player.mp < magic.wCostMP) {
          playSound(31);
          break;
        }

        playSound(29);

        // 判定目标类型：
        // wType: 
        // 0: 攻击单体敌方, 1: 攻击全体敌方, 2: 攻击全体敌方全屏, 3: 攻击全体敌方战场, 4: 治疗单体我方, 5: 治疗全体我方, 8: 治疗单体我方, 9: 攻击全体敌方召唤
        const isToEnemy = [0, 1, 2, 3, 9].includes(magic.wType);
        const isTargetAll = [1, 2, 3, 5, 9].includes(magic.wType);

        player.pendingMagic = magicId;

        if (isTargetAll) {
          // 全体法术 (攻击敌全体或治疗我全体)：无需手动选目标，直接确认施法
          player.action = {
            type: 'magic',
            magicId: magicId,
            target: isToEnemy ? 0 : activePlayerIndex // 用默认索引填充，结算时会自动指向全体
          };
          advanceToNextPlayer();
        } else {
          // 单体法术：分为单体对敌和单体对我
          if (isToEnemy) {
            targetEnemyIndex = enemies.findIndex(e => e.hp > 0);
            if (targetEnemyIndex !== -1) {
              menuState = 'target_magic';
            }
          } else {
            // 对我单体：进入我方单体选择状态，初始化为施法者自己
            targetPlayerIndex = activePlayerIndex;
            menuState = 'target_player_magic';
          }
        }
        break;
      }
    }
  } else if (menuState === 'target_magic') {
    // 攻击性单体法术选择目标敌人
    switch (input) {
      case 'left':
      case 'up': {
        let idx = targetEnemyIndex;
        do {
          idx = (idx - 1 + enemies.length) % enemies.length;
        } while (enemies[idx].hp <= 0 && idx !== targetEnemyIndex);
        targetEnemyIndex = idx;
        break;
      }
      case 'right':
      case 'down': {
        let idx = targetEnemyIndex;
        do {
          idx = (idx + 1) % enemies.length;
        } while (enemies[idx].hp <= 0 && idx !== targetEnemyIndex);
        targetEnemyIndex = idx;
        break;
      }
      case 'blank':
        players[activePlayerIndex].action = {
          type: 'magic',
          magicId: players[activePlayerIndex].pendingMagic,
          target: targetEnemyIndex
        };
        advanceToNextPlayer();
        break;
      case 'ESC':
        menuState = 'magic';
        break;
    }
  } else if (menuState === 'target_player_magic') {
    // 治疗/状态类单体法术选择我方队员
    const isRevival = isRevivalSpell(players[activePlayerIndex].pendingMagic);
    switch (input) {
      case 'left':
      case 'up': {
        let idx = targetPlayerIndex;
        do {
          idx = (idx - 1 + players.length) % players.length;
        } while (players[idx].hp <= 0 && !isRevival && idx !== targetPlayerIndex);
        targetPlayerIndex = idx;
        break;
      }
      case 'right':
      case 'down': {
        let idx = targetPlayerIndex;
        do {
          idx = (idx + 1) % players.length;
        } while (players[idx].hp <= 0 && !isRevival && idx !== targetPlayerIndex);
        targetPlayerIndex = idx;
        break;
      }
      case 'blank':
        players[activePlayerIndex].action = {
          type: 'magic',
          magicId: players[activePlayerIndex].pendingMagic,
          target: targetPlayerIndex
        };
        advanceToNextPlayer();
        break;
      case 'ESC':
        menuState = 'magic';
        break;
    }
  } else if (menuState === 'more') {
    // “更多”菜单操作模式
    switch (input) {
      case 'up':
        selectedMoreIndex = (selectedMoreIndex - 1 + 5) % 5;
        playSound(29);
        break;
      case 'down':
        selectedMoreIndex = (selectedMoreIndex + 1) % 5;
        playSound(29);
        break;
      case 'ESC':
        menuState = 'main';
        selectedAction = 3;
        playSound(30);
        break;
      case 'blank':
        playSound(29);
        if (selectedMoreIndex === 0) {
          // 围攻 (Coop/Auto attack)
          const targetIdx = enemies.findIndex(e => e.hp > 0);
          if (targetIdx !== -1) {
            for (let i = activePlayerIndex; i < players.length; i++) {
              if (players[i].hp > 0) {
                players[i].action = {
                  type: 'attack',
                  target: targetIdx
                };
              }
            }
            runActionPhase();
          }
        } else if (selectedMoreIndex === 1) {
          // 道具 (Item)
          selectedMoreItemIndex = 0;
          menuState = 'more_item';
        } else if (selectedMoreIndex === 2) {
          // 防御 (Defend)
          players[activePlayerIndex].action = {
            type: 'defend'
          };
          advanceToNextPlayer();
        } else if (selectedMoreIndex === 3) {
          // 逃跑 (Flee)
          players[activePlayerIndex].action = {
            type: 'flee'
          };
          advanceToNextPlayer();
        } else if (selectedMoreIndex === 4) {
          // 状态 (Status)
          ESC.onStatus();
        }
        break;
    }
  } else if (menuState === 'more_item') {
    // 道具子操作菜单：使用/投掷
    switch (input) {
      case 'up':
      case 'down':
        selectedMoreItemIndex = (selectedMoreItemIndex + 1) % 2;
        playSound(29);
        break;
      case 'ESC':
        menuState = 'more';
        selectedMoreIndex = 1;
        playSound(30);
        break;
      case 'blank':
        playSound(29);
        if (selectedMoreItemIndex === 0) {
          openItemMenuForActivePlayer(1); // 1: 使用
        } else {
          openItemMenuForActivePlayer(4); // 4: 投掷
        }
        break;
    }
  } else if (menuState === 'target_player_item') {
    // 使用道具选择我方单体目标
    const isRevival = isRevivalItem(players[activePlayerIndex].pendingItem);
    switch (input) {
      case 'left':
      case 'up': {
        let idx = targetPlayerIndex;
        do {
          idx = (idx - 1 + players.length) % players.length;
        } while (players[idx].hp <= 0 && !isRevival && idx !== targetPlayerIndex);
        targetPlayerIndex = idx;
        break;
      }
      case 'right':
      case 'down': {
        let idx = targetPlayerIndex;
        do {
          idx = (idx + 1) % players.length;
        } while (players[idx].hp <= 0 && !isRevival && idx !== targetPlayerIndex);
        targetPlayerIndex = idx;
        break;
      }
      case 'blank':
        players[activePlayerIndex].action = {
          type: 'useItem',
          itemId: players[activePlayerIndex].pendingItem,
          target: targetPlayerIndex
        };
        advanceToNextPlayer();
        break;
      case 'ESC':
        openItemMenuForActivePlayer(1);
        break;
    }
  } else if (menuState === 'target_enemy_item') {
    // 投掷道具选择敌方单体目标
    switch (input) {
      case 'left':
      case 'up': {
        let idx = targetEnemyIndex;
        do {
          idx = (idx - 1 + enemies.length) % enemies.length;
        } while (enemies[idx].hp <= 0 && idx !== targetEnemyIndex);
        targetEnemyIndex = idx;
        break;
      }
      case 'right':
      case 'down': {
        let idx = targetEnemyIndex;
        do {
          idx = (idx + 1) % enemies.length;
        } while (enemies[idx].hp <= 0 && idx !== targetEnemyIndex);
        targetEnemyIndex = idx;
        break;
      }
      case 'blank':
        players[activePlayerIndex].action = {
          type: 'throwItem',
          itemId: players[activePlayerIndex].pendingItem,
          target: targetEnemyIndex
        };
        advanceToNextPlayer();
        break;
      case 'ESC':
        openItemMenuForActivePlayer(4);
        break;
    }
  }

  draw();
}

// 步骤 5：按速度出手顺序依次执行战斗结算
async function runActionPhase() {
  // 保存每个队员当前回合的有效指令，以便下回合能够用 R 键重复该指令
  players.forEach(p => {
    if (p.hp > 0 && p.action) {
      p.lastAction = { ...p.action };
    }
  });

  // 结算期间隐藏操作界面与角色状态栏
  showCommandUI = false;
  state.uiMode = 'block';
  phase = 'action';

  // 清空所有角色的防御状态
  players.forEach(p => {
    p.isDefending = false;
  });

  draw();

  // 步骤 5.0：在出手前结算玩家和敌人的中毒状态（运行对应毒素的中毒脚本）
  // 5.0.1 玩家中毒结算
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.hp > 0) {
      const role = state.roles[p.index];
      if (role && role.poisons && role.poisons.length > 0) {
        const originalHp = p.hp;
        // 遍历结算每一个中毒状态
        for (let j = 0; j < role.poisons.length; j++) {
          const poisonId = role.poisons[j];
          const poisonObj = state.items[poisonId];
          const useScr = poisonObj ? poisonObj.useScr : 0;
          if (useScr > 0) {
            console.log(`[Poison] 角色 ${p.name} 结算毒素 ID ${poisonId}, 脚本 ID ${useScr}`);
            await Script.runTriggerScript(useScr, role, 'role');
          }
        }
        // 同步扣减血量并展示表现效果
        p.hp = role.hp;
        if (p.hp !== originalHp) {
          const dmg = originalHp - p.hp;
          if (dmg > 0) {
            damagePopups.push({
              actor: p,
              value: dmg,
              isPlayer: true,
              startTime: Date.now()
            });
          }
          if (p.hp <= 0 && p.deathSound > 0) {
            playSound(p.deathSound);
          }
          draw();
          await sleep(400);
          await checkPlayerInjury(p, originalHp);
        }
      }
    }
  }

  // 5.0.2 敌人中毒结算
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (enemy.hp > 0 && enemy.poisons && enemy.poisons.length > 0) {
      const originalHp = enemy.hp;
      // 遍历结算每个敌方中毒状态
      for (let j = 0; j < enemy.poisons.length; j++) {
        const poisonId = enemy.poisons[j];
        const poisonObj = state.items[poisonId];
        const equScr = poisonObj ? poisonObj.equScr : 0;
        if (equScr > 0) {
          console.log(`[Poison] 敌人 #${i} 结算毒素 ID ${poisonId}, 脚本 ID ${equScr}`);
          await Script.runTriggerScript(equScr, enemy, 'enemy');
        }
      }
      if (enemy.hp !== originalHp) {
        const dmg = originalHp - enemy.hp;
        if (dmg > 0) {
          damagePopups.push({
            actor: enemy,
            value: dmg,
            isPlayer: false,
            startTime: Date.now()
          });
        }
        if (enemy.hp <= 0 && enemy.deathSound > 0) {
          playSound(enemy.deathSound);
        }
        draw();
        await sleep(400);
      }
    }
  }

  // 根据身法属性由高到低对所有出手者进行排序，对齐 C Pal 引入身法波动与 Boss 双动机制
  const actors = [];
  players.forEach((p, idx) => {
    if (p.hp > 0) {
      const speed = Math.floor(p.dexterity * (0.9 + Math.random() * 0.2));
      actors.push({ type: 'player', index: idx, speed: speed });
    }
  });
  enemies.forEach((e, idx) => {
    if (e.hp > 0) {
      const speed1 = Math.floor(e.dexterity * (0.9 + Math.random() * 0.2));
      actors.push({ type: 'enemy', index: idx, speed: speed1 });

      // 如果敌人有双动/连击标记 (wDualMove)，则在一回合中推入两次出手序列
      if (e.wDualMove) {
        const speed2 = Math.floor(e.dexterity * (0.9 + Math.random() * 0.2));
        actors.push({ type: 'enemy', index: idx, speed: speed2 });
      }
    }
  });

  actors.sort((a, b) => b.speed - a.speed);

  // 轮流出手
  for (let i = 0; i < actors.length; i++) {
    if (checkBattleEnd()) {
      break;
    }

    const actor = actors[i];
    if (actor.type === 'player') {
      const player = players[actor.index];
      if (player.hp <= 0) continue;

      const act = player.action;
      if (act && act.type === 'confused') {
        const aliveTeammateIdxs = [];
        players.forEach((p, idx) => {
          if (idx !== actor.index && p.hp > 0) {
            aliveTeammateIdxs.push(idx);
          }
        });

        if (aliveTeammateIdxs.length > 0) {
          const targetIdx = aliveTeammateIdxs[Math.floor(Math.random() * aliveTeammateIdxs.length)];
          const targetPlayer = players[targetIdx];

          // 播放“乱跳”动画姿态切换
          for (let j = 0; j < 2; j++) {
            player.currentFrame = 8;
            draw();
            await sleep(150);
            player.currentFrame = 0;
            draw();
            await sleep(150);
          }

          const origX = player.x;
          const origY = player.y;

          // 移动到队友面前攻击
          player.x = targetPlayer.x - 30;
          player.y = targetPlayer.y - 10;
          player.currentFrame = 9;
          draw();

          if (player.weaponSound > 0) {
            playSound(player.weaponSound);
          }
          await sleep(150);

          let str = player.attackStrength;
          let def = targetPlayer.defense;
          if (targetPlayer.isDefending) {
            def *= 2;
          }
          let baseDmg = calcBaseDamage(str, def);
          let dmg = baseDmg + Math.floor(Math.random() * 2) + 1;
          if (dmg < 1) dmg = 1;

          const targetOrigX = targetPlayer.x;
          const targetOrigY = targetPlayer.y;

          // 播放受击抖动与击退
          targetPlayer.currentFrame = 3;
          targetPlayer.x += 8;
          targetPlayer.y += 4;
          draw();
          await sleep(80);

          targetPlayer.x += 2;
          targetPlayer.y += 1;
          draw();
          await sleep(150);

          const originalHp = targetPlayer.hp;
          targetPlayer.hp = Math.max(0, targetPlayer.hp - dmg);

          const targetRole = state.roles[targetPlayer.index];
          if (targetRole) {
            targetRole.hp = targetPlayer.hp;
          }

          if (targetPlayer.hp <= 0 && targetPlayer.deathSound > 0) {
            playSound(targetPlayer.deathSound);
          }

          damagePopups.push({
            actor: targetPlayer,
            value: dmg,
            isPlayer: true,
            startTime: Date.now()
          });

          targetPlayer.x = targetOrigX;
          targetPlayer.y = targetOrigY;
          restorePlayerFrame(targetPlayer);

          // 物理攻击受击醒来（解除昏睡）
          const roleTargetObj = state.roles[targetPlayer.index];
          if (roleTargetObj && roleTargetObj.status && roleTargetObj.status[2] > 0) {
            delete roleTargetObj.status[2];
            console.log(`[Status] 队友 ${targetPlayer.name} 受物理攻击，昏睡状态解除`);
          }

          player.x = player.origX !== undefined ? player.origX : origX;
          player.y = player.origY !== undefined ? player.origY : origY;
          restorePlayerFrame(player);
          draw();
          await sleep(400);

          await checkPlayerInjury(targetPlayer, originalHp);
        } else {
          // 若无活着队友，不行动
          player.currentFrame = 0;
          draw();
          await sleep(200);
        }
      } else if (act && act.type === 'attack') {
        let targetIdx = act.target;
        if (enemies[targetIdx].hp <= 0) {
          // 目标已被击杀，顺延切换到下一个活着敌人
          targetIdx = enemies.findIndex(e => e.hp > 0);
        }
        if (targetIdx !== -1) {
          // 累积物攻与生命修行计数
          player.rgAttackExp = (player.rgAttackExp || 0) + 1;
          player.rgHealthExp = (player.rgHealthExp || 0) + Math.floor(Math.random() * 2) + 2;
          await playPlayerAttack(actor.index, targetIdx);
        }
      } else if (act && act.type === 'defend') {
        // 执行玩家防御动作
        player.isDefending = true;
        player.currentFrame = 3; // 防御姿态
        draw();
        // 累积防御修行计数
        player.rgDefenseExp = (player.rgDefenseExp || 0) + 2;
        await sleep(200);
      } else if (act && act.type === 'flee') {
        // 执行玩家逃跑动作
        const isBoss = state.currentBattle?.isBoss || state.isBossBattle || false;
        if (isBoss) {
          playSound(31);
        }
        // 累积逃跑修行计数
        player.rgFleeExp = (player.rgFleeExp || 0) + 2;
        let str = player.fleeRate;
        let def = 0;
        enemies.forEach(e => {
          if (e && e.hp > 0) {
            def += e.dexterity;
            def += ((e.level || 1) + 6) * 4;
          }
        });
        if (def < 0) def = 0;

        const escapeSuccess = (str >= Math.random() * def) && !isBoss;
        if (escapeSuccess) {
          playSound(45);
          const originalPos = players.map(p => ({ p, x: p.x, y: p.y }));
          for (let step = 0; step < 16; step++) {
            players.forEach((p, j) => {
              if (p.hp > 0) {
                p.currentFrame = 0;
                if (j === 0 && players.length > 1) {
                  p.x += 4;
                  p.y += 6;
                } else if (j === 1) {
                  p.x += 4;
                  p.y += 4;
                } else if (j === 2) {
                  p.x += 6;
                  p.y += 3;
                } else {
                  p.x += 4;
                  p.y += 4;
                }
              }
            });
            draw();
            await sleep(80);
          }
          players.forEach(p => {
            p.x = 9999;
            p.y = 9999;
          });
          draw();
          await sleep(500);
          endBattle(0xFFFF);
          return;
        } else {
          const origX = player.x;
          const origY = player.y;
          player.currentFrame = 0;
          for (let step = 0; step < 3; step++) {
            player.x += 4;
            player.y += 2;
            draw();
            await sleep(80);
          }
          player.currentFrame = 1;
          draw();
          const talkCtx = state.contexts.talk;
          if (talkCtx) {
            UI.drawSingleLineBox(110, 80, 5, talkCtx);
            drawWordToCtx(talkCtx, 31, 118, 90);
          }
          await sleep(1000);
          if (talkCtx) {
            talkCtx.clearRect(0, 0, 320, 200);
          }
          player.x = origX;
          player.y = origY;
          restorePlayerFrame(player);
          draw();
        }
      } else if (act && act.type === 'useItem') {
        const itemId = act.itemId;
        const itemObj = state.items[itemId];
        if (itemObj) {
          const ownItems = state.ownItems || [];
          const idx = ownItems.indexOf(itemId);
          if (idx !== -1) {
            ownItems.splice(idx, 1);
          }
          player.currentFrame = 4; // 投掷/使用道具姿势
          draw();
          await sleep(200);
          const targetPlayerIndex = act.target;
          if (itemObj.useScr) {
            await Script.runTriggerScript(itemObj.useScr, state.roles[players[targetPlayerIndex].index], 'item');
          }
          players.forEach(p => {
            const roleStats = state.roles[p.index];
            if (roleStats) {
              p.hp = roleStats.hp;
              p.mp = roleStats.mp;
            }
            restorePlayerFrame(p);
          });
          draw();
          await sleep(400);
        }
      } else if (act && act.type === 'throwItem') {
        const itemId = act.itemId;
        const itemObj = state.items[itemId];
        if (itemObj) {
          const ownItems = state.ownItems || [];
          const idx = ownItems.indexOf(itemId);
          if (idx !== -1) {
            ownItems.splice(idx, 1);
          }
          state.activePlayer = player;
          player.currentFrame = 4;
          draw();
          await sleep(200);
          const targetEnemyIndex = act.target;
          if (itemObj.dropScr) {
            await Script.runTriggerScript(itemObj.dropScr, enemies[targetEnemyIndex], 'item');
          }
          restorePlayerFrame(player);
          draw();
          await sleep(400);
        }
      } else if (act && act.type === 'magic') {
        state.activePlayer = player;
        // 累积仙术与灵力修行计数
        player.rgMagicExp = (player.rgMagicExp || 0) + Math.floor(Math.random() * 2) + 2;
        player.rgMagicPowerExp = (player.rgMagicPowerExp || 0) + 1;
        await handleMagicAction(player, actor, act);
      } else if (act && act.type === 'coop') {
        const roleStats = state.roles[player.index];
        if (roleStats && roleStats.cooperativeMagic) {
          const coopMagicId = roleStats.cooperativeMagic;
          const itemObj = state.items[coopMagicId];
          if (itemObj) {
            const magicNumber = itemObj.roleId;
            const magic = state.magics[magicNumber];
            if (magic) {
              magic.id = coopMagicId;
              state.activePlayer = player;

              // 1. 搜集并筛选本回合活着的健康贡献者
              const coopContributors = [];
              players.forEach(p => {
                const r = state.roles[p.index];
                const isHealthy = p.hp > 0 && !(r && r.status && (r.status[0] > 0 || r.status[1] > 0 || r.status[2] > 0 || r.status[3] > 0));
                if (isHealthy) {
                  coopContributors.push(p);
                }
              });

              if (coopContributors.length > 1) {
                // 2. 消耗所有健康贡献者的 HP（等于 wCostMP，保底剩 1 HP）
                coopContributors.forEach(p => {
                  p.hp = Math.max(1, p.hp - magic.wCostMP);
                  const r = state.roles[p.index];
                  if (r) {
                    r.hp = p.hp;
                  }
                });

                // 3. 播放合击集体前倾准备动作
                const origPositions = coopContributors.map(p => ({
                  player: p,
                  x: p.x,
                  y: p.y
                }));

                coopContributors.forEach(p => {
                  p.x -= 20;
                  p.y -= 10;
                  p.currentFrame = 4; // 施法前斜倾/动作准备帧
                });
                draw();
                await sleep(150);

                // 4. 确认敌方目标并释放法术特效
                let targetIdx = act.target;
                if (enemies[targetIdx].hp <= 0) {
                  targetIdx = enemies.findIndex(e => e.hp > 0);
                }
                state.activeTargetIdx = targetIdx;

                if (targetIdx !== -1) {
                  await playMagicEffect(magic, player, enemies[targetIdx]);

                  // 5. 计算合击的平均属性加成（武力+灵力总和除以4作为基础灵力）
                  let sumStr = 0;
                  coopContributors.forEach(p => {
                    sumStr += p.attackStrength + p.magicStrength;
                  });
                  let str = Math.floor(sumStr / 4);

                  // 判定是否群攻
                  const isAll = magic.wType === 1 || magic.wType === 6 || magic.wType === 2 || magic.wType === 3;
                  let targets = [];
                  if (isAll) {
                    enemies.forEach((e, idx) => { if (e.hp > 0) targets.push(idx); });
                  } else {
                    if (enemies[targetIdx].hp > 0) targets = [targetIdx];
                  }

                  const enemyOrigPositions = targets.map(eIdx => ({
                    enemy: enemies[eIdx],
                    x: enemies[eIdx].x,
                    y: enemies[eIdx].y
                  }));

                  enemyOrigPositions.forEach(item => {
                    item.enemy.x -= 8;
                    item.enemy.y -= 4;
                  });
                  draw();
                  await sleep(80);

                  enemyOrigPositions.forEach(item => {
                    item.enemy.x -= 2;
                    item.enemy.y -= 1;
                  });
                  draw();
                  await sleep(150);

                  // 结算合击输出伤害与抗性修正
                  for (const eIdx of targets) {
                    const enemy = enemies[eIdx];
                    let def = enemy.defense + (enemy.level + 6) * 4;
                    let dmg = calcMagicDamage(str, def, enemy.wElemResistance, enemy.wPoisonResistance || 0, 1, magic);
                    if (dmg < 1) dmg = 1;
                    enemy.hp = Math.max(0, enemy.hp - dmg);

                    damagePopups.push({
                      actor: enemy,
                      value: dmg,
                      isPlayer: false,
                      startTime: Date.now()
                    });

                    if (enemy.hp <= 0 && enemy.wDeathSound > 0) {
                      playSound(enemy.wDeathSound);
                    }
                  }

                  enemyOrigPositions.forEach(item => {
                    item.enemy.x = item.x;
                    item.enemy.y = item.y;
                  });
                }

                // 6. 合击结束还原集体站位和动作姿势
                origPositions.forEach(item => {
                  item.player.x = item.x;
                  item.player.y = item.y;
                  restorePlayerFrame(item.player);
                });
                draw();
                await sleep(400);
              }
            }
          }
        }
      }
    } else {
      const enemy = enemies[actor.index];
      if (enemy.hp <= 0) continue;

      // 准备行动时触发 wScriptOnReady
      if (enemy.wScriptOnReady) {
        const result = await Script.runTriggerScript(enemy.wScriptOnReady, enemy, 'enemy');
        enemy.wScriptOnReady = result;
      }

      // 如果在此期间敌人死亡或战斗结束（比如脚本内杀死了敌人/结束了战斗），则跳过
      if (enemy.hp <= 0 || checkBattleEnd()) continue;

      // 检查定身（ID=1）或昏睡（ID=2）状态
      if (enemy.status && (enemy.status[1] > 0 || enemy.status[2] > 0)) {
        console.log(`[Status] 敌人 #${actor.index} 处于定身/昏睡状态，无法行动`);
        continue;
      }

      // 检查混乱状态（ID=0）
      if (enemy.status && enemy.status[0] > 0) {
        const aliveEnemyIdxs = [];
        enemies.forEach((e, eIdx) => {
          if (eIdx !== actor.index && e.hp > 0) {
            aliveEnemyIdxs.push(eIdx);
          }
        });

        if (aliveEnemyIdxs.length > 0) {
          const targetEnemyIdx = aliveEnemyIdxs[Math.floor(Math.random() * aliveEnemyIdxs.length)];
          console.log(`[Status] 敌人 #${actor.index} 处于混乱状态，物理攻击其队友敌人 #${targetEnemyIdx}`);
          await playEnemyAttackEnemy(actor.index, targetEnemyIdx);
        } else {
          console.log(`[Status] 敌人 #${actor.index} 处于混乱状态，但无活着的队友`);
        }
        continue;
      }

      // 敌方攻击：随机挑一个活着我方成员作为目标
      const alivePlayerIdxs = [];
      players.forEach((p, pIdx) => {
        if (p.hp > 0) alivePlayerIdxs.push(pIdx);
      });

      if (alivePlayerIdxs.length > 0) {
        const targetIdx = alivePlayerIdxs[Math.floor(Math.random() * alivePlayerIdxs.length)];
        await playEnemyAttack(actor.index, targetIdx);
      }
    }
  }

  // 行动阶段后，判定本回合战斗是否结束
  if (!checkBattleEnd()) {
    // 递减主角异常状态剩余回合数
    players.forEach(p => {
      if (p.hp > 0) {
        const role = state.roles[p.index];
        if (role && role.status) {
          Object.keys(role.status).forEach(statusId => {
            if (role.status[statusId] > 0) {
              role.status[statusId]--;
              if (role.status[statusId] <= 0) {
                delete role.status[statusId];
              }
            }
          });
        }
      }
    });

    // 递减敌人异常状态剩余回合数
    enemies.forEach(e => {
      if (e.hp > 0 && e.status) {
        Object.keys(e.status).forEach(statusId => {
          if (e.status[statusId] > 0) {
            e.status[statusId]--;
            if (e.status[statusId] <= 0) {
              delete e.status[statusId];
            }
          }
        });
      }
    });

    // 运行回合开始脚本
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy.hp > 0 && enemy.wScriptOnTurnStart) {
        const result = await Script.runTriggerScript(enemy.wScriptOnTurnStart, enemy, 'enemy');
        enemy.wScriptOnTurnStart = result;
      }
    }

    // 重置进入下一回合指令录入
    phase = 'select';
    selectedAction = 0;
    menuState = 'main';
    
    players.forEach(p => {
      if (p.hp > 0) {
        const role = state.roles[p.index];
        if (role && role.status) {
          if (role.status[0] > 0) {
            p.action = { type: 'confused' };
          } else if (role.status[1] > 0 || role.status[2] > 0) {
            p.action = { type: 'pass' };
          } else {
            p.action = null;
          }
        } else {
          p.action = null;
        }
      } else {
        p.action = null;
      }
    });

    activePlayerIndex = players.findIndex(p => isPlayerControllable(p));
    if (activePlayerIndex === -1) {
      const hasAlive = players.some(p => p.hp > 0);
      if (hasAlive) {
        runActionPhase();
        return;
      } else {
        activePlayerIndex = 0;
      }
    }

    turn++;

    // 新回合指令选择时显示操作界面
    showCommandUI = true;
    state.uiMode = 'operate';
    draw();
  }
}

// 步骤 6：播放物理攻击出手动画
// 步骤 15：播放法术动画特效
export async function playMagicEffect(magic, actor, target) {
  if (!isBattleRunning) return;

  let spriteData = null;
  try {
    const mkfData = loadMkf('fire.mkf', magic.wEffect);
    if (mkfData) {
      spriteData = deyj(mkfData);
    }
  } catch (e) {
    console.error(`[playMagicEffect] 加载 fire.mkf 特效包 #${magic.wEffect} 失败:`, e);
  }

  if (!spriteData) {
    return;
  }

  const totalFrames = spriteData.getShort(0);
  if (totalFrames <= 0) return;

  let targets = [];
  const isPlayerActor = actor.equipments !== undefined;
  
  if (magic.wType === 1 || magic.wType === 6) {
    if (isPlayerActor) {
      enemies.forEach(e => { if (e.hp > 0) targets.push(e); });
    } else {
      players.forEach(p => { if (p.hp > 0) targets.push(p); });
    }
  } else if (magic.wType !== 2) {
    targets = [target];
  }

  const effectTimes = magic.wEffectTimes || 1;
  const loopCount = totalFrames * effectTimes;
  const speed = (magic.wSpeed + 5) * 10 || 100;

  const isEnemyActor = enemies.includes(actor);

  for (let step = 0; step < loopCount; step++) {
    if (!isBattleRunning) break;

    const frameIndex = step % totalFrames;

    // 若施法者为敌方怪物，且仙术 wFireDelay 延迟蓄力大于 0，且当前特效帧正处于蓄力物理攻击期，则动态更新怪物姿态为对应的攻击帧
    if (isEnemyActor && magic.wFireDelay > 0 && step >= magic.wFireDelay && step < magic.wFireDelay + actor.wAttackFrames) {
      actor.currentFrame = step - magic.wFireDelay + actor.maxIdleFrames + actor.wMagicFrames;
    }

    if (frameIndex === magic.wFireDelay && magic.wSound > 0) {
      playSound(magic.wSound);
    }

    activeEffects = [];
    if (magic.wType === 2) {
      // 整队法术 (kMagicTypeAttackWhole): 特效在 120, 100 加上偏移
      activeEffects.push({
        spriteData,
        frameIndex,
        x: 120 + (magic.wXOffset || 0),
        y: 100 + (magic.wYOffset || 0)
      });
    } else if (magic.wType === 3) {
      // 战场法术 (kMagicTypeAttackField): 特效在 160, 200 加上偏移
      activeEffects.push({
        spriteData,
        frameIndex,
        x: 160 + (magic.wXOffset || 0),
        y: 200 + (magic.wYOffset || 0)
      });
    } else if (magic.wType === 1) {
      // 全体法术 (kMagicTypeAttackAll): 特效分别绘制在三个固定位置上加上偏移
      const effectpos = [[70, 140], [100, 110], [160, 100]];
      effectpos.forEach(pos => {
        activeEffects.push({
          spriteData,
          frameIndex,
          x: pos[0] + (magic.wXOffset || 0),
          y: pos[1] + (magic.wYOffset || 0)
        });
      });
    } else {
      // 单体/回复/召唤法术等: 特效底边中点与目标底边中点重合加上偏移
      targets.forEach(t => {
        activeEffects.push({
          spriteData,
          frameIndex,
          x: t.x + (magic.wXOffset || 0),
          y: t.y + (magic.wYOffset || 0)
        });
      });
    }

    currentMagicEffect = {
      actorName: actor.name,
      wordId: magic.id || 0, // 仙术名字短语 ID 即为其 Object ID (magic.id)
      frameIndex,
      totalFrames
    };

    if (magic.wShake > 0) {
      const shakeX = (Math.random() - 0.5) * magic.wShake * 2;
      const shakeY = (Math.random() - 0.5) * magic.wShake * 2;
      state.contexts.main.canvas.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
    }

    draw();
    await sleep(speed);
  }

  if (magic.wShake > 0) {
    state.contexts.main.canvas.style.transform = 'none';
  }
  activeEffects = [];
  currentMagicEffect = null;
  draw();
}

async function playPlayerAttack(playerIdx, enemyIdx) {
  const player = players[playerIdx];
  const enemy = enemies[enemyIdx];

  const origX = player.x;
  const origY = player.y;

  // 1. 检测是否双击状态、天罡战气以及群体物理武器
  const roleStats = state.roles[player.index];
  const hasDualAttack = roleStats && roleStats.status && roleStats.status[8] > 0;
  const hasBravery = roleStats && roleStats.status && roleStats.status[5] > 0;
  const canAttackAll = roleStats && !!roleStats.attackAll;

  // 播放准备普通攻击动作叫喊音效
  if (player.attackSound > 0) {
    playSound(player.attackSound);
  }

  // 2. 物攻出手动作序列
  if (canAttackAll) {
    // 鞭子类全体物攻武器：在原地播放击打帧，无需进行突进瞬移
    player.currentFrame = 7; // 出击前置帧
    draw();
    await sleep(150);

    player.currentFrame = 9; // 出手打击帧
    if (player.weaponSound > 0) {
      playSound(player.weaponSound);
    }
    draw();

    // 敌方受击顺序还原：2, 1, 0, 4, 3
    const indexOrder = [2, 1, 0, 4, 3];
    const targetEnemyIdxs = [];
    indexOrder.forEach(idx => {
      if (enemies[idx] && enemies[idx].hp > 0) {
        targetEnemyIdxs.push(idx);
      }
    });

    if (targetEnemyIdxs.length > 0) {
      const enemyOrigPositions = targetEnemyIdxs.map(eIdx => ({
        enemy: enemies[eIdx],
        x: enemies[eIdx].x,
        y: enemies[eIdx].y
      }));

      // 全体受击怪物第一阶段后退
      enemyOrigPositions.forEach(item => {
        item.enemy.x -= 8;
        item.enemy.y -= 4;
      });
      draw();
      await sleep(80);

      // 全体受击怪物第二阶段后退
      enemyOrigPositions.forEach(item => {
        item.enemy.x -= 2;
        item.enemy.y -= 1;
      });
      draw();
      await sleep(150);

      // 依次计算物攻伤害并进行指数级衰减
      let division = 1;
      for (const eIdx of targetEnemyIdxs) {
        const currentEnemy = enemies[eIdx];
        
        let str = player.attackStrength;
        let def = currentEnemy.defense + (currentEnemy.level + 6) * 4;
        let baseDmg = calcBaseDamage(str, def);
        const res = currentEnemy.physicalResistance || 0;
        if (res !== 0) {
          baseDmg = Math.floor(baseDmg / res);
        }

        let dmg = baseDmg + Math.floor(Math.random() * 2) + 1;

        // 暴击判定：天罡战气必定暴击 (x3)，普通攻击 1/6 暴击
        let isCritical = hasBravery;
        if (!isCritical && Math.floor(Math.random() * 6) === 0) {
          isCritical = true;
        }
        if (isCritical) {
          dmg *= 3;
        }

        // 李逍遥物理攻击 1/12 爆发 2 倍伤害
        if (player.index === 0 && Math.floor(Math.random() * 12) === 0) {
          dmg *= 2;
          isCritical = true;
        }

        dmg = Math.floor(dmg * (1.0 + Math.random() * 0.125));
        
        // 全体武器攻击力除数衰减
        dmg = Math.floor(dmg / division);

        if (isCritical && player.criticalSound > 0) {
          playSound(player.criticalSound);
        }

        if (dmg < 1) dmg = 1;
        currentEnemy.hp = Math.max(0, currentEnemy.hp - dmg);

        // 普通物理攻击击醒昏睡中状态
        if (currentEnemy.status && currentEnemy.status[2] > 0) {
          delete currentEnemy.status[2];
        }

        damagePopups.push({
          actor: currentEnemy,
          value: dmg,
          isPlayer: false,
          startTime: Date.now()
        });

        if (currentEnemy.hp <= 0 && currentEnemy.deathSound > 0) {
          playSound(currentEnemy.deathSound);
        }

        division *= 2;
      }

      // 所有怪物弹回原站位
      enemyOrigPositions.forEach(item => {
        item.enemy.x = item.x;
        item.enemy.y = item.y;
      });
      draw();
      await sleep(250);
    }
  } else {
    // 针对敌单体打击（支持双击状态）
    // 1. 瞬移到敌方身前 (frame 8 准备姿势)
    player.x = enemy.x + 35;
    player.y = enemy.y + 10;
    player.currentFrame = 8;
    draw();
    await sleep(150);

    const runSingleHit = async () => {
      // 2. 挥刀斩击 (frame 9 出手动作)
      player.x = enemy.x + 28;
      player.y = enemy.y + 8;
      player.currentFrame = 9;

      if (player.weaponSound > 0) {
        playSound(player.weaponSound);
      }

      let str = player.attackStrength;
      let def = enemy.defense + (enemy.level + 6) * 4;
      let baseDmg = calcBaseDamage(str, def);
      const res = enemy.physicalResistance || 0;
      if (res !== 0) {
        baseDmg = Math.floor(baseDmg / res);
      }

      let dmg = baseDmg + Math.floor(Math.random() * 2) + 1;

      // 暴击判定：天罡战气必定暴击 (x3)，普通攻击 1/6 暴击
      let isCritical = hasBravery;
      if (!isCritical && Math.floor(Math.random() * 6) === 0) {
        isCritical = true;
      }
      if (isCritical) {
        dmg *= 3;
      }

      // 李逍遥 1/12 额外爆发 2 倍伤害
      if (player.index === 0 && Math.floor(Math.random() * 12) === 0) {
        dmg *= 2;
        isCritical = true;
      }

      dmg = Math.floor(dmg * (1.0 + Math.random() * 0.125));

      if (isCritical && player.criticalSound > 0) {
        playSound(player.criticalSound);
      }

      if (dmg < 1) dmg = 1;

      const enemyOrigX = enemy.x;
      const enemyOrigY = enemy.y;

      // 怪物被打击后移退后
      enemy.x -= 8;
      enemy.y -= 4;
      draw();
      await sleep(80);

      enemy.x -= 2;
      enemy.y -= 1;
      draw();
      await sleep(150);

      enemy.hp = Math.max(0, enemy.hp - dmg);

      if (enemy.status && enemy.status[2] > 0) {
        delete enemy.status[2];
      }

      damagePopups.push({
        actor: enemy,
        value: dmg,
        isPlayer: false,
        startTime: Date.now()
      });

      if (enemy.hp <= 0 && enemy.deathSound > 0) {
        playSound(enemy.deathSound);
      }

      enemy.x = enemyOrigX;
      enemy.y = enemyOrigY;
      draw();
      await sleep(250);
    };

    // 释放第一击
    await runSingleHit();

    // 如果处于双击增益且敌人仍然活着，则释放第二击物攻
    if (hasDualAttack && enemy.hp > 0) {
      await runSingleHit();
    }
  }

  // 3. 返回原位置并重置玩家姿势
  player.x = player.origX !== undefined ? player.origX : origX;
  player.y = player.origY !== undefined ? player.origY : origY;
  restorePlayerFrame(player);
  draw();
  await sleep(100);
}

// 检测并运行玩家濒死/死亡触发脚本
async function checkPlayerInjury(player, originalHp) {
  if (player.hp <= 0 && originalHp > 0) {
    // 队友死亡触发：遍历除死者外其它存活的队友，运行其 wScriptOnFriendDeath
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (p.index !== player.index && p.hp > 0 && p.wScriptOnFriendDeath) {
        const result = await Script.runTriggerScript(p.wScriptOnFriendDeath, p, 'player');
        p.wScriptOnFriendDeath = result;
      }
    }
  } else if (player.hp > 0 && player.hp < player.maxHp / 5 && originalHp >= player.maxHp / 5) {
    // 濒死触发：运行受伤者自身的 wScriptOnDying
    if (player.wScriptOnDying) {
      const result = await Script.runTriggerScript(player.wScriptOnDying, player, 'player');
      player.wScriptOnDying = result;
    }
  }
}

// 步骤 7：播放敌方攻击出手动画
async function playEnemyAttack(enemyIdx, playerIdx) {
  const enemy = enemies[enemyIdx];
  const player = players[playerIdx];

  // 步骤 0.5：判定是否触发法术攻击 (wMagic 不为 0 且随机数小于 wMagicRate)
  const useMagic = enemy.wMagic !== undefined && enemy.wMagic !== 0 && (Math.floor(Math.random() * 10) < (enemy.wMagicRate || 10));
  if (useMagic) {
    const itemObj = state.items[enemy.wMagic];
    if (itemObj) {
      const magicNumber = itemObj.roleId; // 仙术编号对应 rgwData[0] (roleId)
      const magic = state.magics[magicNumber];
      if (magic) {
        // 绑定法术 ID 供特效系统解析其描述
        magic.id = enemy.wMagic;

        const origX = enemy.x;
        const origY = enemy.y;
        enemy.isActing = true;

        // 施法动作前斜倾 (对应 C 语言 ex += 12; ey += 6; ex += 4; ey += 2;)
        enemy.x += 12;
        enemy.y += 6;
        draw();
        await sleep(80);

        enemy.x += 4;
        enemy.y += 2;
        draw();
        await sleep(80);

        if (enemy.wMagicSound > 0) {
          playSound(enemy.wMagicSound);
        }

        // 播放施法准备动作帧
        if (enemy.wMagicFrames > 0) {
          for (let i = 0; i < enemy.wMagicFrames; i++) {
            enemy.currentFrame = enemy.maxIdleFrames + i;
            draw();
            await sleep(Math.max(1, enemy.wActWaitFrames) * 80);
          }
        } else {
          await sleep(80);
        }

        // 若 wFireDelay == 0，播放怪物攻击物理动画帧
        if (magic.wFireDelay === 0) {
          for (let i = 0; i <= enemy.wAttackFrames; i++) {
            enemy.currentFrame = enemy.maxIdleFrames + enemy.wMagicFrames + i - 1;
            draw();
            await sleep(Math.max(1, enemy.wActWaitFrames) * 80);
          }
        }

        // 1. 播放怪物的法术特效
        await playMagicEffect(magic, enemy, player);

        // 获取敌方等级并对其法术攻击力进行战场等级修正
        const enemyLevel = enemy.level || 1;
        let str = enemy.wMagicStrength || 10;
        str += (enemyLevel + 6) * 6;
        if (str < 0) {
          str = 0;
        }

        // 2. 获取目标伤害结算 (单体或全体)
        let targets = [];
        if (magic.wType === 1 || magic.wType === 6 || magic.wType === 2) {
          players.forEach((p, pIdx) => { if (p.hp > 0) targets.push(pIdx); });
        } else {
          if (player.hp > 0) targets = [playerIdx];
        }

        // 记录每一个受击主角的原位置
        const origPositions = targets.map(pIdx => ({
          player: players[pIdx],
          x: players[pIdx].x,
          y: players[pIdx].y
        }));

        // 全体受击者第一阶段向右下移动并设置防御动作帧(3)
        origPositions.forEach(item => {
          item.player.currentFrame = 3;
          item.player.x += 8;
          item.player.y += 4;
        });
        draw();
        await sleep(80);

        // 全体受击者第二阶段向右下移动
        origPositions.forEach(item => {
          item.player.x += 2;
          item.player.y += 1;
        });
        draw();
        await sleep(150);

        for (const pIdx of targets) {
          const targetPlayer = players[pIdx];
          let def = targetPlayer.defense;

          // 使用对齐 C Pal 的五灵/毒抗性算法
          const roleStats = state.roles[targetPlayer.index];
          const playerElemResist = [];
          for (let x = 0; x < 5; x++) {
            playerElemResist.push(100 + (roleStats && roleStats.elementalResistance ? roleStats.elementalResistance[x] : 0));
          }
          const playerPoisonResist = 100 + ((roleStats && roleStats.poisonResistance) || 0);

          let dmg = calcMagicDamage(str, def, playerElemResist, playerPoisonResist, 20, magic);

          // 判定防御状态和真元护体状态（kStatusProtect = 6）
          const isProtected = roleStats && roleStats.status && roleStats.status[6] > 0;
          let divisor = 1;
          if (targetPlayer.isDefending) divisor *= 2;
          if (isProtected) divisor *= 2;
          dmg = Math.floor(dmg / divisor);

          if (dmg < 1) dmg = 1;
          targetPlayer.hp = Math.max(0, targetPlayer.hp - dmg);

          // 同步削减全局角色状态中的 HP
          const roleStats = state.roles[targetPlayer.index];
          if (roleStats) {
            roleStats.hp = targetPlayer.hp;
          }

          // 弹出玩家受伤飘字
          damagePopups.push({
            actor: targetPlayer,
            value: dmg,
            isPlayer: true,
            startTime: Date.now()
          });

          // 如果主角/队友死亡，则播放死亡音效
          if (targetPlayer.hp <= 0 && targetPlayer.deathSound > 0) {
            playSound(targetPlayer.deathSound);
          }
        }

        // 全体受击者弹回原位置并还原动作帧姿势
        origPositions.forEach(item => {
          item.player.x = item.x;
          item.player.y = item.y;
          restorePlayerFrame(item.player);
        });

        enemy.isActing = false;
        enemy.currentFrame = 0;
        enemy.x = origX;
        enemy.y = origY;

        draw();
        await sleep(400); // 伤害飘字停留
        return;
      }
    }
  }

  const origX = enemy.x;
  const origY = enemy.y;
  enemy.isActing = true;

  // 播放敌方普通物理攻击叫喊音效
  if (enemy.attackSound > 0) {
    playSound(enemy.attackSound);
  }

  // 1. 播放攻击前摇施法预备帧 (对应 C 语言 wMagicFrames 动作帧)
  if (enemy.wMagicFrames > 0) {
    for (let i = 0; i < enemy.wMagicFrames; i++) {
      enemy.currentFrame = enemy.maxIdleFrames + i;
      draw();
      await sleep(Math.max(1, enemy.wActWaitFrames) * 80);
    }
  }

  // 3步前斜移表示攻击扑击动作
  for (let i = 0; i < 3 - enemy.wMagicFrames; i++) {
    enemy.x -= 2;
    enemy.y -= 1;
    draw();
    await sleep(80);
  }

  if (enemy.wActionSound > 0) {
    playSound(enemy.wActionSound);
  }
  await sleep(80);

  // 2. 敌人瞬移到队员面前，并播放物理攻击姿态动作帧
  enemy.x = player.x - 30;
  enemy.y = player.y - 10;

  if (enemy.wAttackFrames === 0) {
    enemy.currentFrame = enemy.maxIdleFrames - 1;
    draw();
    await sleep(160);
  } else {
    for (let i = 0; i <= enemy.wAttackFrames; i++) {
      enemy.currentFrame = enemy.maxIdleFrames + enemy.wMagicFrames + i - 1;
      draw();
      await sleep(Math.max(1, enemy.wActWaitFrames) * 80);
    }
  }

  // 步骤 7.1：获取敌方等级并对其物理攻击力进行战场等级修正
  const enemyLevel = enemy.level || 1;
  let str = enemy.attackStrength;
  str += (enemyLevel + 6) * 6;
  if (str < 0) {
    str = 0;
  }

  // 步骤 7.2：获取玩家的防御力
  let def = player.defense;

  // 步骤 7.3：敌人的物理攻击力加上 0~2 的随机打击波动
  const finalStr = str + Math.floor(Math.random() * 3);

  // 步骤 7.4：计算物理基础伤害
  let baseDmg = calcBaseDamage(finalStr, def);

  // 步骤 7.5：折减一半（敌人攻击主角时，防御折减系数固定为 2）
  let dmg = Math.floor(baseDmg / 2);

  // 步骤 7.5.5：若主角处于防御状态，伤害再次折减一半
  if (player.isDefending) {
    dmg = Math.floor(dmg / 2);
  }

  // 步骤 7.6：加上 0~1 点的随机打击微小伤害浮动
  dmg += Math.floor(Math.random() * 2);

  // 步骤 7.7：兜底伤害至最小 1 点，并对玩家角色扣减对应 HP
  if (dmg < 1) dmg = 1;
  const originalHp = player.hp;

  // 记录玩家受击前原位置
  const playerOrigX = player.x;
  const playerOrigY = player.y;

  // 播放防御姿势(3)并执行击退退后一格(分两阶段右下移动，共 x+=10, y+=5)
  player.currentFrame = 3;
  player.x += 8;
  player.y += 4;
  draw();
  await sleep(80);

  player.x += 2;
  player.y += 1;
  draw();
  await sleep(150);

  player.hp = Math.max(0, player.hp - dmg);

  // 物理受击醒来（清除昏睡状态 ID 2）
  const roleObj = state.roles[player.index];
  if (roleObj && roleObj.status && roleObj.status[2] > 0) {
    delete roleObj.status[2];
    console.log(`[Status] 角色 ${player.name} 受物理普通攻击，昏睡状态解除`);
  }

  // 同步削减全局角色状态中的 HP，以便大地图和存档顺利响应
  const roleStats = state.roles[player.index];
  if (roleStats) {
    roleStats.hp = player.hp;
  }

  // 如果主角/队友死亡，则播放死亡音效
  if (player.hp <= 0 && player.deathSound > 0) {
    playSound(player.deathSound);
  }

  damagePopups.push({
    actor: player,
    value: dmg,
    isPlayer: true,
    startTime: Date.now()
  });

  // 主角弹回原位置并还原正常/虚弱/死亡状态帧
  player.x = playerOrigX;
  player.y = playerOrigY;
  restorePlayerFrame(player);

  draw();
  await sleep(250);

  // 检测并运行濒死/死亡触发脚本
  await checkPlayerInjury(player, originalHp);

  // 3. 返回原位并重置怪物动作与姿态
  enemy.isActing = false;
  enemy.currentFrame = 0;
  enemy.x = origX;
  enemy.y = origY;
  draw();
  await sleep(100);
}

// 步骤 8：检查并进行战斗胜负胜败判定
function checkBattleEnd() {
  // 如果战斗已经不处于运行状态，或结算阶段已开启，说明已判定结束，直接返回 true
  if (!isBattleRunning || phase === 'end') {
    return true;
  }

  // 步骤 8.1：若通过 0x89 脚本指令强制设定了战斗结果
  if (battleResult !== 1000) {
    endBattle(battleResult);
    return true;
  }

  const allEnemiesDead = enemies.every(e => e.hp <= 0);
  const allPlayersDead = players.every(p => p.hp <= 0);

  if (allEnemiesDead) {
    battleResult = 3;
    endBattle(3);
    return true;
  } else if (allPlayersDead) {
    battleResult = 1;
    endBattle(1);
    return true;
  }

  return false;
}

// 步骤 9：战斗结束，清理状态并结算后续剧情脚本分支
async function endBattle(result) {
  // 战斗结束，隐藏操作界面与角色状态栏
  showCommandUI = false;
  phase = 'end';
  clearInterval(battleTimer);
  battleTimer = null;

  // 擦除已隐藏的操作界面
  draw();

  // 运行战斗结束脚本
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (enemy.wScriptOnBattleEnd) {
      await Script.runTriggerScript(enemy.wScriptOnBattleEnd, enemy, 'enemy');
    }
  }

  // 步骤 9.1：绘制胜负消息框提示
  const talkCtx = state.contexts.talk;
  if (talkCtx) {
    if (result === 3 || result === true) {
      // 步骤 1：统计所有已被击败敌人的经验与金钱
      let totalExp = 0;
      let totalCash = 0;

      for (let i = 0; i < enemies.length; i++) {
        totalExp += enemies[i].exp || 0;
        totalCash += enemies[i].cash || 0;
      }

      // 步骤 2：更新全局金钱数据
      state.money = (state.money || 0) + totalCash;

      // 步骤 3：为活着的队员分配经验，并执行升级属性提升
      const upgradedPlayers = [];

      for (let i = 0; i < players.length; i++) {
        const p = players[i];

        if (p.hp > 0) {
          const roleStats = state.roles[p.index];

          if (roleStats) {
            // 备份升级前的原始属性
            const origStats = {
              level: roleStats.level || 1,
              hp: p.hp,
              maxHp: roleStats.maxHp || 100,
              mp: p.mp,
              maxMp: roleStats.maxMp || 100,
              attackStrength: roleStats.attackStrength || 10,
              magicStrength: roleStats.magicStrength || 10,
              defense: roleStats.defense || 10,
              dexterity: roleStats.dexterity || 10,
              fleeRate: roleStats.fleeRate || 10
            };

            // 初始化经验值结构（如不存在）
            if (!state.exp) {
              state.exp = { rgPrimaryExp: [] };
            }
            if (!state.exp.rgPrimaryExp[p.index]) {
              state.exp.rgPrimaryExp[p.index] = {
                wExp: 0,
                wReserved: 0,
                wLevel: roleStats.level || 1,
                wCount: 0
              };
            }

            let dwExp = state.exp.rgPrimaryExp[p.index].wExp || 0;
            dwExp += totalExp;

            let fLevelUp = false;
            const MAX_LEVELS = 99;

            // 循环处理多次升级的可能
            while (state.levelUpExp && dwExp >= (state.levelUpExp[roleStats.level] || 0) && roleStats.level < MAX_LEVELS) {
              dwExp -= state.levelUpExp[roleStats.level] || 0;
              roleStats.level += 1;
              fLevelUp = true;

              // 属性随机增加（原版数值算法）
              roleStats.maxHp += 10 + Math.floor(Math.random() * 8);
              roleStats.maxMp += 8 + Math.floor(Math.random() * 6);
              roleStats.attackStrength += 4 + Math.floor(Math.random() * 2);
              roleStats.magicStrength += 4 + Math.floor(Math.random() * 2);
              roleStats.defense += 2 + Math.floor(Math.random() * 2);
              roleStats.dexterity += 2 + Math.floor(Math.random() * 2);
              roleStats.fleeRate += 2;

              // 升级时自动恢复全部生命值与魔法值
              roleStats.hp = roleStats.maxHp;
              roleStats.mp = roleStats.maxMp;
            }

            // 属性最高上限控制在 999 限制
            const limit = (val) => (val > 999 ? 999 : val);
            roleStats.maxHp = limit(roleStats.maxHp);
            roleStats.maxMp = limit(roleStats.maxMp);
            roleStats.attackStrength = limit(roleStats.attackStrength);
            roleStats.magicStrength = limit(roleStats.magicStrength);
            roleStats.defense = limit(roleStats.defense);
            roleStats.dexterity = limit(roleStats.dexterity);
            roleStats.fleeRate = limit(roleStats.fleeRate);

            if (fLevelUp) {
              roleStats.hp = limit(roleStats.hp);
              roleStats.mp = limit(roleStats.mp);
            }

            // 保持数据一致性
            state.exp.rgPrimaryExp[p.index].wExp = dwExp;
            state.exp.rgPrimaryExp[p.index].wLevel = roleStats.level;

            // 如果升级了，记录信息供后面大面板逐个展示
            if (fLevelUp) {
              upgradedPlayers.push({
                index: p.index,
                nameId: roleStats.nameId,
                orig: origStats,
                curr: {
                  level: roleStats.level,
                  hp: roleStats.hp,
                  maxHp: roleStats.maxHp,
                  mp: roleStats.mp,
                  maxMp: roleStats.maxMp,
                  attackStrength: roleStats.attackStrength,
                  magicStrength: roleStats.magicStrength,
                  defense: roleStats.defense,
                  dexterity: roleStats.dexterity,
                  fleeRate: roleStats.fleeRate
                }
              });
            }
          }
        }
      }

      // 临时允许键盘输入，用于结算框与升级框的空格确认交互
      const prevUiMode = state.uiMode;
      state.uiMode = 'operate';

      // 步骤 4：在 talk 渲染层上绘制胜利奖励画卷框
      if (totalExp > 0) {
        // 绘制获得的经验值面板框（宽为 8 个中文字，x=83, y=60）
        UI.drawSingleLineBox(83, 60, 8, talkCtx);

        // 绘制打败怪物获得文钱面板框（宽为 10 个中文字，x=65, y=105）
        UI.drawSingleLineBox(65, 105, 10, talkCtx);

        // 绘制文案：获得经验值(#30), 打败敌人得(#9), 文钱(#10)
        drawWordToCtx(talkCtx, 30, 95, 70);
        drawWordToCtx(talkCtx, 9, 77, 115);
        drawWordToCtx(talkCtx, 10, 197, 115);

        // 绘制具体数值：数字取 data.mkf #9 中的 20~29 号黄色小数字
        drawWinNumber(talkCtx, totalExp, 182, 74, 5, 'right');
        drawWinNumber(talkCtx, totalCash, 162, 119, 5, 'mid');

        // 等待玩家按下空格键确认
        await waitWinSpace();
        talkCtx.clearRect(0, 0, talkCtx.canvas.width, talkCtx.canvas.height);
      }

      // 步骤 5：如果有角色升级，逐人展示修行提升对比大面板
      for (let i = 0; i < upgradedPlayers.length; i++) {
        const up = upgradedPlayers[i];

        // 1. 绘制修行提升单行标题画卷框：x=72, y=0, 长度=11
        UI.drawSingleLineBox(72, 1, 11, talkCtx);

        // 2. 绘制标题文案：“角色名” + “修行”(#48) + “提升”(#32)
        let nameLen = 0;
        const nameWord = state.words[up.nameId];
        if (nameWord) {
          for (let k = 0; k < nameWord.length / 2; k++) {
            if (nameWord.getShort(k * 2) !== 0x2020) {
              nameLen++;
            }
          }
        }
        nameLen = nameLen || 2;

        drawWordToCtx(talkCtx, up.nameId, 110, 10);
        drawWordToCtx(talkCtx, 48, 110 + nameLen * 16, 10);
        drawWordToCtx(talkCtx, 32, 110 + nameLen * 16 + 32, 10);

        // 3. 绘制具体数值大面板背景框：x=66, y=34, 宽=11, 高=9
        UI.drawScrollBox(66, 34, 11, 8, talkCtx);

        // 4. 绘制 8 项属性的文字标签 (修行、体力、真气、武术、灵力、防御、身法、吉运)
        for (let j = 0; j < 8; j++) {
          drawWordToCtx(talkCtx, 48 + j, 84, 44 + 18 * j);

          // 绘制指向箭头 (48号 pic 对应 loadPic(48))，x=188
          const arrowImg = loadPic(48);
          if (arrowImg) {
            talkCtx.drawImage(arrowImg, 192, 48 + 18 * j);
          }
        }

        // 5. 绘制升级前后的数值属性变化
        // 行 0：修行
        drawWinNumber(talkCtx, up.orig.level, 133, 47, 4, 'right', 'yellow');
        drawWinNumber(talkCtx, up.curr.level, 215, 47, 4, 'right', 'yellow');

        // 行 1：体力（当前/最大，最大值为蓝色小数字，带斜杠）
        drawWinNumber(talkCtx, up.orig.hp, 133, 64, 4, 'right', 'yellow');
        drawWinNumber(talkCtx, up.orig.maxHp, 154, 68, 4, 'right', 'blue');
        const slashImg1 = loadPic(40);
        if (slashImg1) {
          talkCtx.drawImage(slashImg1, 156, 66);
        }
        drawWinNumber(talkCtx, up.curr.hp, 215, 64, 4, 'right', 'yellow');
        drawWinNumber(talkCtx, up.curr.maxHp, 236, 68, 4, 'right', 'blue');
        if (slashImg1) {
          talkCtx.drawImage(slashImg1, 238, 66);
        }

        // 行 2：真气
        drawWinNumber(talkCtx, up.orig.mp, 133, 82, 4, 'right', 'yellow');
        drawWinNumber(talkCtx, up.orig.maxMp, 154, 86, 4, 'right', 'blue');
        if (slashImg1) {
          talkCtx.drawImage(slashImg1, 156, 84);
        }
        drawWinNumber(talkCtx, up.curr.mp, 215, 82, 4, 'right', 'yellow');
        drawWinNumber(talkCtx, up.curr.maxMp, 236, 86, 4, 'right', 'blue');
        if (slashImg1) {
          talkCtx.drawImage(slashImg1, 238, 84);
        }

        // 行 3：武术
        drawWinNumber(talkCtx, up.orig.attackStrength, 133, 101, 4, 'right', 'yellow');
        drawWinNumber(talkCtx, up.curr.attackStrength, 215, 101, 4, 'right', 'yellow');

        // 行 4：灵力
        drawWinNumber(talkCtx, up.orig.magicStrength, 133, 119, 4, 'right', 'yellow');
        drawWinNumber(talkCtx, up.curr.magicStrength, 215, 119, 4, 'right', 'yellow');

        // 行 5：防御
        drawWinNumber(talkCtx, up.orig.defense, 133, 137, 4, 'right', 'yellow');
        drawWinNumber(talkCtx, up.curr.defense, 215, 137, 4, 'right', 'yellow');

        // 行 6：身法
        drawWinNumber(talkCtx, up.orig.dexterity, 133, 155, 4, 'right', 'yellow');
        drawWinNumber(talkCtx, up.curr.dexterity, 215, 155, 4, 'right', 'yellow');

        // 行 7：吉运
        drawWinNumber(talkCtx, up.orig.fleeRate, 133, 173, 4, 'right', 'yellow');
        drawWinNumber(talkCtx, up.curr.fleeRate, 215, 173, 4, 'right', 'yellow');

        // 等待玩家按下空格键切换
        await waitWinSpace();
        talkCtx.clearRect(0, 0, talkCtx.canvas.width, talkCtx.canvas.height);
      }

      // 步骤 5.2：在主等级修行提升后，结算各主角在战斗中累积的动作修行隐性成长经验
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (p.hp > 0) {
          const w = p.index;
          const roleStats = state.roles[w];
          if (!roleStats) continue;

          // 同步并初始化隐藏经验存储结构
          if (!state.exp) {
            state.exp = {
              rgPrimaryExp: [], rgHealthExp: [], rgMagicExp: [], rgAttackExp: [],
              rgMagicPowerExp: [], rgDefenseExp: [], rgDexterityExp: [], rgFleeExp: []
            };
          }
          const initExpObj = (arr, idx) => {
            if (!arr[idx]) arr[idx] = { wExp: 0, wReserved: 0, wLevel: roleStats.level || 1, wCount: 0 };
          };
          initExpObj(state.exp.rgHealthExp, w);
          initExpObj(state.exp.rgMagicExp, w);
          initExpObj(state.exp.rgAttackExp, w);
          initExpObj(state.exp.rgMagicPowerExp, w);
          initExpObj(state.exp.rgDefenseExp, w);
          initExpObj(state.exp.rgDexterityExp, w);
          initExpObj(state.exp.rgFleeExp, w);

          state.exp.rgHealthExp[w].wCount = p.rgHealthExp || 0;
          state.exp.rgMagicExp[w].wCount = p.rgMagicExp || 0;
          state.exp.rgAttackExp[w].wCount = p.rgAttackExp || 0;
          state.exp.rgMagicPowerExp[w].wCount = p.rgMagicPowerExp || 0;
          state.exp.rgDefenseExp[w].wCount = p.rgDefenseExp || 0;
          state.exp.rgDexterityExp[w].wCount = p.rgDexterityExp || 0;
          state.exp.rgFleeExp[w].wCount = p.rgFleeExp || 0;

          let iTotalCount = 0;
          iTotalCount += state.exp.rgHealthExp[w].wCount;
          iTotalCount += state.exp.rgMagicExp[w].wCount;
          iTotalCount += state.exp.rgAttackExp[w].wCount;
          iTotalCount += state.exp.rgMagicPowerExp[w].wCount;
          iTotalCount += state.exp.rgDefenseExp[w].wCount;
          iTotalCount += state.exp.rgDexterityExp[w].wCount;
          iTotalCount += state.exp.rgFleeExp[w].wCount;

          if (iTotalCount > 0) {
            const MAX_LEVELS = 99;
            const getWordLenLocal = (wordId) => {
              const word = state.words[wordId];
              let len = 0;
              if (word) {
                for (let k = 0; k < word.length / 2; k++) {
                  if (word.getShort(k * 2) !== 0x2020) len++;
                }
              }
              return len || 2;
            };

            const checkHiddenExp = async (expName, statName, labelWordId) => {
              let count = state.exp[expName][w].wCount;
              let dwExp = Math.floor((totalExp * count / iTotalCount) * 2);
              dwExp += state.exp[expName][w].wExp || 0;

              if (state.exp[expName][w].wLevel > MAX_LEVELS) {
                state.exp[expName][w].wLevel = MAX_LEVELS;
              }

              const origVal = roleStats[statName];

              while (state.levelUpExp && dwExp >= (state.levelUpExp[state.exp[expName][w].wLevel] || 0) && state.exp[expName][w].wLevel < MAX_LEVELS) {
                dwExp -= state.levelUpExp[state.exp[expName][w].wLevel] || 0;
                roleStats[statName] = (roleStats[statName] || 0) + (Math.floor(Math.random() * 2) + 1);
                if (state.exp[expName][w].wLevel < MAX_LEVELS) {
                  state.exp[expName][w].wLevel++;
                }
              }

              state.exp[expName][w].wExp = dwExp;

              if (roleStats[statName] !== origVal) {
                roleStats[statName] = Math.min(999, roleStats[statName]);

                const nameLen = getWordLenLocal(roleStats.nameId);
                const propLen = getWordLenLocal(labelWordId);
                const upLen = getWordLenLocal(32); // “提升”
                const totalLen = nameLen + propLen + upLen;
                const boxX = 65 - (totalLen - 10) * 8;
                const textX = 75 - (totalLen - 10) * 8;

                UI.drawSingleLineBox(boxX, 105, totalLen, talkCtx);
                drawWordToCtx(talkCtx, roleStats.nameId, textX, 115);
                drawWordToCtx(talkCtx, labelWordId, textX + nameLen * 16, 115);
                drawWordToCtx(talkCtx, 32, textX + (nameLen + propLen) * 16, 115);

                const diff = roleStats[statName] - origVal;
                drawWinNumber(talkCtx, diff, textX + (nameLen + propLen + upLen) * 16 + 8, 119, 3, 'left', 'yellow');

                await waitWinSpace();
                talkCtx.clearRect(0, 0, talkCtx.canvas.width, talkCtx.canvas.height);
              }
            };

            await checkHiddenExp('rgHealthExp', 'maxHp', 49);
            await checkHiddenExp('rgMagicExp', 'maxMp', 50);
            await checkHiddenExp('rgAttackExp', 'attackStrength', 51);
            await checkHiddenExp('rgMagicPowerExp', 'magicStrength', 52);
            await checkHiddenExp('rgDefenseExp', 'defense', 53);
            await checkHiddenExp('rgDexterityExp', 'dexterity', 54);
            await checkHiddenExp('rgFleeExp', 'fleeRate', 55);
          }
        }
      }

      // 步骤 5.5：遍历队伍中的每位角色，检查并学习达到等级门槛的新法术
      if (!state.levelUpMagic) {
        loadLevelUpMagics();
      }

      const getWordLen = (wordId) => {
        const word = state.words[wordId];
        let len = 0;
        if (word) {
          for (let k = 0; k < word.length / 2; k++) {
            if (word.getShort(k * 2) !== 0x2020) {
              len++;
            }
          }
        }
        return len || 2;
      };

      for (let i = 0; i < state.party.length; i++) {
        const role = state.party[i];
        const roleStats = state.roles[role.index];
        if (roleStats) {
          const learned = [];
          for (let j = 0; j < state.levelUpMagic.length; j++) {
            const magicItem = state.levelUpMagic[j][role.index];
            if (magicItem && magicItem.wMagic !== 0 && magicItem.wLevel <= (roleStats.level || 1)) {
              if (!roleStats.magics.includes(magicItem.wMagic)) {
                roleStats.magics.push(magicItem.wMagic);
                learned.push(magicItem.wMagic);
              }
            }
          }

          // 逐个展示该角色学到的新法术提示框
          for (let m = 0; m < learned.length; m++) {
            const magicId = learned[m];
            const w1 = getWordLen(roleStats.nameId);
            const w2 = getWordLen(33); // 33 为“练成”
            const w3 = getWordLen(magicId);
            const totalLen = w1 + w2 + w3;

            const boxX = 65 - (totalLen - 10) * 8;
            const textX = 75 - (totalLen - 10) * 8;

            // 绘制新法术单行画卷提示框
            UI.drawSingleLineBox(boxX, 105, totalLen, talkCtx);

            // 绘制文字：“角色名” + “练成” + “红字法术名”
            drawWordToCtx(talkCtx, roleStats.nameId, textX, 115);
            drawWordToCtx(talkCtx, 33, textX + w1 * 16, 115);
            drawWordToCtx(talkCtx, magicId, textX + (w1 + w2) * 16, 115, 'red');

            // 等待玩家按下空格确认
            await waitWinSpace();
            talkCtx.clearRect(0, 0, talkCtx.canvas.width, talkCtx.canvas.height);
          }
        }
      }

      // 步骤 6：战斗结束后自动恢复部分 HP 与 MP（恢复损失值的一半，死者复活），并清空所有负面状态与中毒
      for (let i = 0; i < state.party.length; i++) {
        const role = state.party[i];
        const roleStats = state.roles[role.index];

        if (roleStats) {
          roleStats.hp += Math.floor((roleStats.maxHp - roleStats.hp) / 2);
          roleStats.mp += Math.floor((roleStats.maxMp - roleStats.mp) / 2);

          // 战后自动清除中毒与全部异常/增益负面状态
          roleStats.status = {};
          roleStats.poisons = [];
        }
      }

      state.uiMode = prevUiMode; // 还原 UI Mode
    }
  }

  // 步骤 9.3：渐变淡出当前战斗画面至黑色
  // await fadeOut();

  isBattleRunning = false;
  state.currentMode = 'game';
  state.uiMode = 'operate';

  // 清空背景层、谈话层与战斗层以露出大地图
  // state.contexts.back.clearRect(0, 0, 320, 200);
  state.contexts.talk.clearRect(0, 0, 320, 200);
  if (state.contexts.battle) {
    state.contexts.battle.clearRect(0, 0, 320, 200);
  }

  // 步骤 9.4：重新同步绘制一帧大地图画面，作为淡入前的图像准备
  // await update(true);

  // 恢复场景背景音乐（由 0x43 setMusic 写入 state.wNumMusic）
  const sceneMusicNum = state.wNumMusic || 0;
  if (sceneMusicNum > 0) {
    console.log(`[Battle] 战斗结束，恢复场景背景音乐 ID: ${sceneMusicNum}`);
    playMusic(sceneMusicNum, true, 0);
  } else {
    stopMusic(1);
  }

  // 步骤 9.5：平滑淡入展现大地图画面
  // 这里不应该fadeIn，因为有很多战斗脚本里会fadeIn，比如腐尸战斗脚本40653
  // await fadeIn();

  if (resolvePromise) {
    const p = resolvePromise;
    resolvePromise = null;
    p(victory); // 恢复 0x07 startBattle 指令的 async 阻塞挂起
  }
}

// 辅助等待函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 步骤 10：对外暴露当前实时战斗的全部运行状态与数值
export function getBattleState() {
  if (!isBattleRunning) {
    return { isBattleRunning: false };
  }

  return {
    isBattleRunning: true,
    battleId: battleId,
    battlefieldId: state.battlefieldId,
    currentMagicEffect: currentMagicEffect,
    turn: turn,
    phase: phase,
    activePlayerIndex: activePlayerIndex,
    players: players.map(p => ({
      index: p.index,
      name: p.name,
      hp: p.hp,
      maxHp: p.maxHp,
      mp: p.mp,
      maxMp: p.maxMp,
      defense: p.defense,
      dexterity: p.dexterity,
      attackStrength: p.attackStrength,
      magicStrength: p.magicStrength,
      fleeRate: p.fleeRate,
      poisonResistance: p.poisonResistance,
      equipments: p.equipments,
      magics: p.magics,
      x: p.x,
      y: p.y,
      currentFrame: p.currentFrame,
      action: p.action,
      spriteData: p.spriteData,
      mgoId: p.mgoId,
      spriteNum: p.spriteNum
    })),
    enemies: enemies.map(e => ({
      id: e.id,
      objId: e.objId,
      name: e.name,
      hp: e.hp,
      maxHp: e.maxHp,
      defense: e.defense,
      dexterity: e.dexterity,
      attackStrength: e.attackStrength,
      level: e.level,
      physicalResistance: e.physicalResistance,
      x: e.x,
      y: e.y,
      currentFrame: e.currentFrame,
      maxIdleFrames: e.maxIdleFrames,
      spriteData: e.spriteData,
      // 对外暴露敌人实时可偷窃物品 ID 和剩余数量
      wStealItem: e.wStealItem,
      nStealItem: e.nStealItem
    }))
  };
}

// 步骤 11：解析装备的永久属性增益
function getEquipItemAttributes(itemId) {
  const item = state.items[itemId];
  const attrs = {
    attackStrength: 0,
    magicStrength: 0,
    defense: 0,
    dexterity: 0,
    fleeRate: 0
  };
  if (!item || !item.equScr) return attrs;

  const STAT_MAP = {
    17: 'attackStrength',
    18: 'magicStrength',
    19: 'defense',
    20: 'dexterity',
    21: 'fleeRate'
  };

  let scriptId = item.equScr;
  for (let i = 0; i < 10; i++) {
    const scr = state.scripts[scriptId + i];
    if (!scr) break;

    // 当遇到脚本终止指令，或遇到非当前道具的装备指令时跳出，防止越界读取下一个道具的脚本属性
    if (scr.code === 0) break;
    if (scr.code === 0x18 && scr.param2 !== itemId) break;

    if (scr.code === 0x17) {
      const key = STAT_MAP[scr.param2];
      if (key) {
        let val = scr.param3;
        if (val > 32767) val -= 65536;
        attrs[key] += val;
      }
    }
  }
  return attrs;
}

// 步骤 12：基础伤害计算 (完全还原自 sdlpal 中的 PAL_CalcBaseDamage)
function calcBaseDamage(attackStrength, defense) {
  let damage = 0;

  if (attackStrength > defense) {
    damage = Math.floor(attackStrength * 2 - defense * 1.6 + 0.5);
  } else if (attackStrength > defense * 0.6) {
    damage = Math.floor(attackStrength - defense * 0.6 + 0.5);
  } else {
    damage = 0;
  }

  return damage;
}

// 步骤 12.5：仙术伤害计算 (完全还原自 sdlpal 中的 PAL_CalcMagicDamage)
export function calcMagicDamage(magicStrength, defense, elementalResistance, poisonResistance, resistanceMultiplier, magic) {
  // 灵力小幅度波动
  let str = Math.floor(magicStrength * (1.0 + Math.random() * 0.1));
  let sDamage = Math.floor(calcBaseDamage(str, defense) / 4) + magic.wBaseDamage;

  if (magic.wElemental !== 0) {
    const wElem = magic.wElemental;
    if (wElem > 5) {
      // 毒抗性
      sDamage = Math.floor(sDamage * (10 - poisonResistance / resistanceMultiplier) / 5);
    } else {
      // 五灵抗性 (风雷水火土)
      const resistVal = (elementalResistance && elementalResistance[wElem - 1] !== undefined) ? elementalResistance[wElem - 1] : 5;
      sDamage = Math.floor(sDamage * (10 - resistVal / resistanceMultiplier) / 5);

      // 战场五灵属性加成
      const bfId = state.battlefieldId || 0;
      const bf = state.battleFields ? state.battleFields[bfId] : null;
      if (bf && bf.rgsMagicEffect && bf.rgsMagicEffect[wElem - 1] !== undefined) {
        sDamage = Math.floor(sDamage * (10 + bf.rgsMagicEffect[wElem - 1]) / 10);
      }
    }
  }

  return sDamage;
}

export async function setBattleResult(result) {
  // 步骤 13：设置当前由脚本强行指定的战斗结果，以在主循环中自动退出战斗
  battleResult = result;
  if (isBattleRunning && phase !== 'end') {
    await endBattle(result);
  }
}

export async function enemyEscapeAnim() {
  if (!isBattleRunning) {
    return;
  }

  // 步骤 1：播放逃跑音效
  playSound(45);

  // 步骤 2：对所有仍然存活的敌方成员执行向左滑出屏幕的动画
  let escapeInProgress = true;
  while (escapeInProgress) {
    escapeInProgress = false;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy || enemy.hp <= 0 || enemy.escaped) {
        continue;
      }

      // X 坐标左移 5 像素
      enemy.x -= 5;

      const halfWidth = (enemy.width || 80) / 2;
      if (enemy.x + halfWidth > 0) {
        escapeInProgress = true;
      }
    }

    // 步骤 3：每一帧重绘战场并等待 10 毫秒
    draw();
    await sleep(10);
  }

  // 步骤 4：所有敌人均已跑出屏幕后，重置其 HP 并标记为逃跑离场
  enemies.forEach(enemy => {
    if (enemy && enemy.hp > 0) {
      enemy.hp = 0;
      enemy.escaped = true;
    }
  });

  // 步骤 5：延迟 500 毫秒，随后结束战斗
  await sleep(500);
  await setBattleResult(0xFFFF);
}

// 步骤 14：播放主角施法前摇与发光效果 (完全还原自 sdlpal 中的 0x92 指令)
export async function showPlayerPreMagicAnim(playerIndex) {
  if (!isBattleRunning) return;
  const player = players[playerIndex];
  if (!player) return;

  const origX = player.x;
  const origY = player.y;

  // 1. 角色向左上方移动 4 步以体现施法前倾动作
  const offsets = [
    { dx: -4, dy: -2 },
    { dx: -3, dy: -1 },
    { dx: -2, dy: -1 },
    { dx: -1, dy: 0 }
  ];

  for (let i = 0; i < 4; i++) {
    player.x += offsets[i].dx;
    player.y += offsets[i].dy;
    draw();
    await sleep(80);
  }

  await sleep(160);

  // 2. 播放施法前摇音效，并将帧姿势设定为施法预备(5)
  player.currentFrame = 5;
  if (player.magicSound > 0) {
    playSound(player.magicSound);
  }
  draw();

  // 3. 循环 5 次闪烁（亮度/饱和度滤镜渐变），模拟原版 iColorShift 发光
  for (let i = 0; i < 5; i++) {
    players.forEach(p => {
      if (p.hp > 0) {
        // 使用 CSS canvas 滤镜亮度与饱和度模拟原版队员彩色变幻
        p.filter = `brightness(${1.0 + i * 0.25}) saturate(${1.0 + i * 0.15})`;
      }
    });
    draw();
    await sleep(80);
  }

  // 4. 清理滤镜，并将施法主角状态设置为施法出手姿势(6)
  players.forEach(p => {
    delete p.filter;
  });
  player.currentFrame = 6;
  draw();
  await sleep(80);
}

// 辅助函数：通过扫描指令序列判定某仙术是否为复活法术 (包含 0x22 revivePlayer 指令)
function isRevivalSpell(magicId) {
  const itemObj = state.items[magicId];
  if (!itemObj || !itemObj.useScr) {
    return false;
  }

  const ip = itemObj.useScr;
  for (let i = 0; i < 50; i++) {
    const script = state.scripts[ip + i];
    if (!script) {
      break;
    }
    if (script.code === 0x22) {
      return true;
    }
    if (script.code === 0x00) {
      break;
    }
  }
  return false;
}

// 判定某仙术是否为“酒神”或“乾坤一掷”
function isBacchusOrMoneyThrow(magicId) {
  const word = state.words[magicId];
  if (!word) return false;

  const len = word.length / 2;
  const arr = [];
  for (let i = 0; i < len; i++) {
    arr.push(word.getShort(i * 2));
  }

  // 校验简体及繁体“酒神”的字库字符编码
  if (len === 2) {
    if ((arr[0] === 0xBEC0 && arr[1] === 0xC9F1) || (arr[0] === 0xB1DB && arr[1] === 0xAFEB)) {
      return true;
    }
  }

  // 校验简体“乾坤一掷”与繁体“乾坤一擲”的字库字符编码
  if (len === 4) {
    if ((arr[0] === 0xC7AC && arr[1] === 0xC0A7 && arr[2] === 0xD2BB && arr[3] === 0xD6C1) ||
        (arr[0] === 0xB7E2 && arr[1] === 0xB5CA && arr[2] === 0xA440 && arr[3] === 0xC6B0)) {
      return true;
    }
  }

  return false;
}

// 步骤 16：还原玩家在战斗中的正常姿势帧与位置坐标 (死者为 2，虚弱为 1，正常为 0)
export function restorePlayerFrame(player) {
  // 步骤 16.1：只要主角当前不处于防御状态，就将其坐标还原为入战时的原始位置
  if (player.origX !== undefined && player.origY !== undefined && !player.isDefending) {
    player.x = player.origX;
    player.y = player.origY;
  }

  // 步骤 16.2：根据血量还原玩家的状态动作帧
  if (player.hp <= 0) {
    player.currentFrame = 2;
  } else if (player.hp < player.maxHp * 0.2) {
    player.currentFrame = 1;
  } else if (player.isDefending) {
    player.currentFrame = 3;
  } else {
    player.currentFrame = 0;
  }
}

// 绘制结算小数字，利用 data.mkf #9 中的 20~29 (黄色) 或 30~39 (蓝色) 号数字元素
export function drawWinNumber(ctx, num, x, y, length, align = 'right', type = 'yellow') {
  const baseId = type === 'blue' ? 30 : 20;
  let numStr = Math.floor(num).toString();
  let nActualLength = numStr.length;

  if (nActualLength > length) {
    nActualLength = length;
    numStr = numStr.slice(-length);
  }

  let startX = x - 6;

  if (align === 'left') {
    startX += 6 * nActualLength;
  } else if (align === 'right') {
    startX += 6 * length;
  } else if (align === 'mid') {
    startX += 3 * (length + nActualLength);
  }

  let currX = startX;
  let remainingNum = num;

  for (let i = 0; i < nActualLength; i++) {
    const digit = remainingNum % 10;
    const digitImg = loadPic(baseId + digit);

    if (digitImg) {
      ctx.drawImage(digitImg, currX, y);
    }

    currX -= 6;
    remainingNum = Math.floor(remainingNum / 10);
  }
}

// 封装阻塞式按键/空格等待逻辑
export function waitWinSpace() {
  return new Promise((resolve) => {
    winSpaceResolve = resolve;
  });
}

export function addDamagePopup(actor, value, isPlayer) {
  damagePopups.push({
    actor,
    value,
    isPlayer,
    startTime: Date.now()
  });
}

export async function escape() {
  playSound(45);
  const originalPos = players.map(p => ({ p, x: p.x, y: p.y }));
  for (let step = 0; step < 16; step++) {
    players.forEach((p, j) => {
      if (p.hp > 0) {
        p.currentFrame = 0;
        if (j === 0 && players.length > 1) {
          p.x += 4;
          p.y += 6;
        } else if (j === 1) {
          p.x += 4;
          p.y += 4;
        } else if (j === 2) {
          p.x += 6;
          p.y += 3;
        } else {
          p.x += 4;
          p.y += 4;
        }
      }
    });
    draw();
    await sleep(80);
  }
  players.forEach(p => {
    p.x = 9999;
    p.y = 9999;
  });
  draw();
  await sleep(500);
  endBattle(0xFFFF);
}

function openItemMenuForActivePlayer(filterBit) {
  UseItemMenu.open(filterBit).then(itemId => {
    if (itemId === -1) {
      menuState = 'more_item';
      draw();
    } else {
      players[activePlayerIndex].pendingItem = itemId;
      const item = state.items[itemId];
      const isTargetAll = (item.flags & 16) !== 0;
      if (filterBit === 1) {
        if (isTargetAll) {
          players[activePlayerIndex].action = {
            type: 'useItem',
            itemId: itemId,
            target: activePlayerIndex
          };
          advanceToNextPlayer();
        } else {
          targetPlayerIndex = activePlayerIndex;
          menuState = 'target_player_item';
          draw();
        }
      } else {
        if (isTargetAll) {
          players[activePlayerIndex].action = {
            type: 'throwItem',
            itemId: itemId,
            target: 0
          };
          advanceToNextPlayer();
        } else {
          targetEnemyIndex = enemies.findIndex(e => e.hp > 0);
          menuState = 'target_enemy_item';
          draw();
        }
      }
    }
  });
}

function isRevivalItem(itemId) {
  const itemObj = state.items[itemId];
  if (!itemObj || !itemObj.useScr) {
    return false;
  }
  const ip = itemObj.useScr;
  for (let i = 0; i < 50; i++) {
    const script = state.scripts[ip + i];
    if (!script) {
      break;
    }
    if (script.code === 0x22) {
      return true;
    }
    if (script.code === 0x00) {
      break;
    }
  }
  return false;
}


async function handleMagicAction(player, actor, act) {
  const magicId = act.magicId;
  const itemObj = state.items[magicId];
  if (!itemObj) return;

  const magicNumber = itemObj.roleId; // 仙术编号对应 rgwData[0] (roleId)
  const magic = state.magics[magicNumber];
  if (!magic) return;

  // 记录施法主角的原始位置，以便在施法结束时复位，防止其发生漂移或坐标与特效脱节
  const origX = player.x;
  const origY = player.y;

  // 1. 扣除 MP
  player.mp = Math.max(0, player.mp - magic.wCostMP);
  const globalRole = state.roles[player.index];
  if (globalRole) {
    globalRole.mp = player.mp;
  }

  // 2. 播放施法前摇发光特效
  await showPlayerPreMagicAnim(actor.index);

  // 3. 播放法术特效与伤害/回复结算
  const isToEnemy = [0, 1, 2, 3, 9].includes(magic.wType);
  let targetIdx = act.target;

  // 绑定当前的法术 ID 供特效的名字寻找
  magic.id = magicId;

  if (isToEnemy) {
    if (enemies[targetIdx].hp <= 0) {
      targetIdx = enemies.findIndex(e => e.hp > 0);
    }
    state.activeTargetIdx = targetIdx;
    if (targetIdx !== -1) {
      await playMagicEffect(magic, player, enemies[targetIdx]);

      // 步骤 1：运行施法脚本
      if (itemObj.useScr > 0) {
        await Script.runTriggerScript(itemObj.useScr, state.roles[player.index], 'magic');
      }
      
      // 步骤 2：运行施法成功后脚本
      if (itemObj.equScr > 0) {
        await Script.runTriggerScript(itemObj.equScr, enemies[targetIdx], 'magic');
      }

      // 步骤 3：结算伤害 (单体伤害或群体伤害，仅在 wBaseDamage > 0 时结算，防止飞龙探云手等辅助仙术误伤)
      if (intToShort(magic.wBaseDamage) > 0) {
        let targets = [];
        if (magic.wType === 1 || magic.wType === 6 || magic.wType === 2) {
          enemies.forEach((e, eIdx) => { if (e.hp > 0) targets.push(eIdx); });
        } else {
          if (enemies[targetIdx].hp > 0) targets = [targetIdx];
        }

        // 记录每一个受击怪物的原位置
        const enemyOrigPositions = targets.map(eIdx => ({
          enemy: enemies[eIdx],
          x: enemies[eIdx].x,
          y: enemies[eIdx].y
        }));

        // 全体受击怪物第一阶段向左上移动
        enemyOrigPositions.forEach(item => {
          item.enemy.x -= 8;
          item.enemy.y -= 4;
        });
        draw();
        await sleep(80);

        // 全体受击怪物第二阶段向左上移动
        enemyOrigPositions.forEach(item => {
          item.enemy.x -= 2;
          item.enemy.y -= 1;
        });
        draw();
        await sleep(150);

        for (const eIdx of targets) {
          const enemy = enemies[eIdx];
           // 灵力换算
          let str = player.magicStrength;
          // 基础伤害计算 (完全还原自 sdlpal 中的 PAL_CalcMagicDamage)
          let dmg = calcMagicDamage(str, enemy.defense, enemy.wElemResistance, enemy.wPoisonResistance || 0, 1, magic);

          if (dmg < 1) dmg = 1;
          enemy.hp = Math.max(0, enemy.hp - dmg);

          // 弹出伤害飘字
          damagePopups.push({
            actor: enemy,
            value: dmg,
            isPlayer: false,
            startTime: Date.now()
          });

          if (enemy.hp <= 0 && enemy.wDeathSound > 0) {
            playSound(enemy.wDeathSound);
          }
        }

        // 全体受击怪物还原位置
        enemyOrigPositions.forEach(item => {
          item.enemy.x = item.x;
          item.enemy.y = item.y;
        });

        draw();
        await sleep(400); // 飘字稍作停留
      } else {
        draw();
        await sleep(400);
      }
    }
  } else {
    // 针对我方 (治疗回复等法术)
    const isRevival = isRevivalSpell(magicId);
    if (players[targetIdx].hp <= 0 && !isRevival && magic.wType !== 5) {
      // 单体治疗且目标阵亡，且不是复活法术，顺延至第一个活着的主角
      targetIdx = players.findIndex(p => p.hp > 0);
    }
    if (targetIdx !== -1) {
      await playMagicEffect(magic, player, players[targetIdx]);

      // 步骤 1：运行施法脚本
      if (itemObj.useScr > 0) {
        await Script.runTriggerScript(itemObj.useScr, state.roles[player.index], 'magic');
      }

      // 步骤 2：运行施法成功后脚本
      if (itemObj.equScr > 0) {
        await Script.runTriggerScript(itemObj.equScr, state.roles[players[targetIdx].index], 'magic');
      }

      // 结算恢复 (单体或群体)
      let targets = [];
      if (magic.wType === 5) {
        players.forEach((p, pIdx) => { if (p.hp > 0) targets.push(pIdx); });
      } else {
        // 单体治疗/复活：如果目标是活着的，或者目标虽阵亡但所施放的是复活仙术，则作为合法对象进行结算
        if (players[targetIdx].hp > 0 || isRevival) {
          targets = [targetIdx];
        }
      }

      let recover = Math.floor(player.magicStrength * 1.5 + magic.wBaseDamage);
      if (recover < 1) recover = 1;

      for (const pIdx of targets) {
        const targetPlayer = players[pIdx];
        
        // 恢复 HP (不超过最大 HP)
        targetPlayer.hp = Math.min(targetPlayer.maxHp, targetPlayer.hp + recover);
        const roleStats = state.roles[targetPlayer.index];
        if (roleStats) {
          roleStats.hp = targetPlayer.hp;
        }

        // 恢复 HP 后立即重新应用角色的状态姿态帧（确保复活时由倒地动作立即恢复为正常/虚弱动作帧）
        restorePlayerFrame(targetPlayer);

        // 飘白色加血字 (isPlayer 为 true)
        damagePopups.push({
          actor: targetPlayer,
          value: recover,
          isPlayer: true,
          startTime: Date.now()
        });
      }
      draw();
      await sleep(400); // 飘字稍作停留
    }
  }

  // 还原施法者的坐标位置与动作帧姿势
  player.x = origX;
  player.y = origY;
  restorePlayerFrame(player);
  draw();
}

// 混乱状态下敌方物理攻击己方目标（其它活着的敌人）
async function playEnemyAttackEnemy(enemyIdx, targetEnemyIdx) {
  const enemy = enemies[enemyIdx];
  const targetEnemy = enemies[targetEnemyIdx];

  const origX = enemy.x;
  const origY = enemy.y;
  enemy.isActing = true;

  // 播放敌方普通物理攻击叫喊音效
  if (enemy.attackSound > 0) {
    playSound(enemy.attackSound);
  }

  // 1. 播放物理攻击扑击前斜移动作
  for (let i = 0; i < 3; i++) {
    enemy.x -= 2;
    enemy.y -= 1;
    draw();
    await sleep(80);
  }

  if (enemy.wActionSound > 0) {
    playSound(enemy.wActionSound);
  }
  await sleep(80);

  // 2. 敌人瞬移到目标敌人面前，并播放物理攻击姿态动作帧
  enemy.x = targetEnemy.x + 30;
  enemy.y = targetEnemy.y + 10;

  if (enemy.wAttackFrames === 0) {
    enemy.currentFrame = enemy.maxIdleFrames - 1;
    draw();
    await sleep(160);
  } else {
    for (let i = 0; i <= enemy.wAttackFrames; i++) {
      enemy.currentFrame = enemy.maxIdleFrames + i - 1;
      draw();
      await sleep(Math.max(1, enemy.wActWaitFrames) * 80);
    }
  }

  // 计算物理基础伤害
  const enemyLevel = enemy.level || 1;
  let str = enemy.attackStrength;
  str += (enemyLevel + 6) * 6;
  if (str < 0) {
    str = 0;
  }

  let def = targetEnemy.defense;
  const finalStr = str + Math.floor(Math.random() * 3);
  let baseDmg = calcBaseDamage(finalStr, def);
  let dmg = Math.floor(baseDmg / 2);
  dmg += Math.floor(Math.random() * 2);

  if (dmg < 1) dmg = 1;

  // 记录被击中怪物原位置，用于受击击退抖动
  const targetOrigX = targetEnemy.x;
  const targetOrigY = targetEnemy.y;

  // 怪物被攻击，执行击退退后一格动画
  targetEnemy.x -= 8;
  targetEnemy.y -= 4;
  draw();
  await sleep(80);

  targetEnemy.x -= 2;
  targetEnemy.y -= 1;
  draw();
  await sleep(150);

  targetEnemy.hp = Math.max(0, targetEnemy.hp - dmg);

  if (targetEnemy.hp <= 0 && targetEnemy.deathSound > 0) {
    playSound(targetEnemy.deathSound);
  }

  // 物理受击醒来（清除昏睡状态 ID 2）
  if (targetEnemy.status && targetEnemy.status[2] > 0) {
    delete targetEnemy.status[2];
    console.log(`[Status] 敌人 ${targetEnemy.name || targetEnemyIdx} 受队友物理攻击，昏睡状态解除`);
  }

  damagePopups.push({
    actor: targetEnemy,
    value: dmg,
    isPlayer: false,
    startTime: Date.now()
  });

  // 目标怪物弹回原位置
  targetEnemy.x = targetOrigX;
  targetEnemy.y = targetOrigY;

  // 还原攻击者
  enemy.x = origX;
  enemy.y = origY;
  enemy.isActing = false;
  enemy.currentFrame = 0;

  draw();
  await sleep(400);
}

// 步骤 16：模拟仙术播放与结算 (还原自 sdlpal 中的 PAL_BattleSimulateMagic)
export async function simulateMagic(roleIndex, magicId, value) {
  if (!isBattleRunning) {
    return;
  }

  // 1. 获取对应的仙术对象
  const itemObj = state.items[magicId];
  if (!itemObj) {
    return;
  }

  const magicNumber = itemObj.roleId;
  const magic = state.magics[magicNumber];
  if (!magic) {
    return;
  }

  // 绑定当前法术 ID，方便特效模块寻找名称短语等
  magic.id = magicId;

  // 2. 确定法术作用目标方向（敌方还是我方）
  const isToEnemy = [0, 1, 2, 3, 9].includes(magic.wType);
  const actor = players[roleIndex] || players[0];

  let targetIdx = -1;
  let targets = [];

  if (isToEnemy) {
    // 敌方群体法术判定
    const isAll = magic.wType === 1 || magic.wType === 6 || magic.wType === 2;
    if (isAll) {
      enemies.forEach((e, idx) => {
        if (e && e.hp > 0) {
          targets.push(idx);
        }
      });
      if (targets.length === 0) {
        return;
      }
      targetIdx = targets[0];
    } else {
      // 敌方单体法术判定，优先选取指定索引，若死亡或无效则顺延
      if (enemies[roleIndex] && enemies[roleIndex].hp > 0) {
        targetIdx = roleIndex;
      } else {
        targetIdx = enemies.findIndex(e => e && e.hp > 0);
      }
      if (targetIdx === -1) {
        return;
      }
      targets = [targetIdx];
    }
  } else {
    // 我方群体或单体法术判定
    const isAll = magic.wType === 5;
    const isRevival = isRevivalSpell(magicId);
    if (isAll) {
      players.forEach((p, idx) => {
        if (p && (p.hp > 0 || isRevival)) {
          targets.push(idx);
        }
      });
      if (targets.length === 0) {
        return;
      }
      targetIdx = targets[0];
    } else {
      // 我方单体法术判定
      if (players[roleIndex] && (players[roleIndex].hp > 0 || isRevival)) {
        targetIdx = roleIndex;
      } else {
        if (isRevival) {
          targetIdx = players.findIndex(p => p && p.hp <= 0);
          if (targetIdx === -1) {
            targetIdx = players.findIndex(p => p && p.hp > 0);
          }
        } else {
          targetIdx = players.findIndex(p => p && p.hp > 0);
        }
      }
      if (targetIdx === -1) {
        return;
      }
      targets = [targetIdx];
    }
  }

  // 3. 播放仙术动画与音效
  const animTarget = isToEnemy ? enemies[targetIdx] : players[targetIdx];
  await playMagicEffect(magic, actor, animTarget);

  // 4. 结算伤害或恢复效果 (若配置了伤害值或传入了自定义数值)
  const baseDmgValue = (value !== undefined && value > 0) ? value : magic.wBaseDamage;

  if (intToShort(magic.wBaseDamage) > 0 || (value !== undefined && value > 0)) {
    if (isToEnemy) {
      // 执行敌方受击伤害计算与抖动退后动画
      const enemyOrigPositions = targets.map(eIdx => ({
        enemy: enemies[eIdx],
        x: enemies[eIdx].x,
        y: enemies[eIdx].y
      }));

      // 受击怪物第一阶段退后
      enemyOrigPositions.forEach(item => {
        item.enemy.x -= 8;
        item.enemy.y -= 4;
      });
      draw();
      await sleep(80);

      // 受击怪物第二阶段退后
      enemyOrigPositions.forEach(item => {
        item.enemy.x -= 2;
        item.enemy.y -= 1;
      });
      draw();
      await sleep(150);

      // 循环结算每一个受击怪物的伤害
      for (const eIdx of targets) {
        const enemy = enemies[eIdx];
        const str = baseDmgValue;
        let dmg = calcMagicDamage(str, enemy.defense, enemy.wElemResistance, enemy.wPoisonResistance || 0, 1, magic);

        if (dmg < 1) {
          dmg = 1;
        }
        enemy.hp = Math.max(0, enemy.hp - dmg);

        // 推送伤害飘字数据
        damagePopups.push({
          actor: enemy,
          value: dmg,
          isPlayer: false,
          startTime: Date.now()
        });

        // 播放死亡声效
        if (enemy.hp <= 0 && (enemy.deathSound > 0 || enemy.wDeathSound > 0)) {
          playSound(enemy.deathSound || enemy.wDeathSound);
        }
      }

      // 还原受击怪物位置
      enemyOrigPositions.forEach(item => {
        item.enemy.x = item.x;
        item.enemy.y = item.y;
      });

      draw();
      await sleep(400);
    } else {
      // 执行我方恢复/治疗计算
      let recover = Math.floor((actor.magicStrength || 10) * 1.5 + baseDmgValue);
      if (recover < 1) {
        recover = 1;
      }

      for (const pIdx of targets) {
        const targetPlayer = players[pIdx];
        targetPlayer.hp = Math.min(targetPlayer.maxHp, targetPlayer.hp + recover);
        
        const roleStats = state.roles[targetPlayer.index];
        if (roleStats) {
          roleStats.hp = targetPlayer.hp;
        }

        restorePlayerFrame(targetPlayer);

        // 推送绿色生命恢复飘字数据
        damagePopups.push({
          actor: targetPlayer,
          value: recover,
          isPlayer: true,
          startTime: Date.now()
        });
      }

      draw();
      await sleep(400);
    }
  } else {
    // 若法术无伤害/恢复值配置，只重绘一次，停留少许时间以防特效突兀消失
    draw();
    await sleep(400);
  }
}
