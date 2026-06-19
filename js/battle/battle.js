import { state } from '../engine/state.js';
import { loadFbp, loadPic } from '../resources/pal.js';
import { loadEnemies, loadEnemyTeam, loadEnemyPos, loadSpriteFrame } from './battleData.js';
import { loadMkf } from '../resources/loader.js';
import { deyj } from '../utils/deyj.js';
import { playMusic, stopMusic } from '../resources/music.js';
import { playSound } from '../resources/sound.js';
import { checkAndFadeOut, fadeIn, fadeOut } from '../ui/fade.js';
import { update } from '../ui/draw.js';

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
  { attack: 39, weapon: 3, critical: 7, magic: 11, death: 25, dying: 21 }  // 其它
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

let players = [];
let enemies = [];
let damagePopups = [];
let isBattleRunning = false;

// 战斗状态机属性
let turn = 0;
let phase = 'select'; // 'select' | 'action' | 'end'
let activePlayerIndex = 0; // 当前选定指令的角色索引
let selectedAction = 0; // 0: 攻击, 1: 法术, 2: 合击, 3: 更多
let menuState = 'main'; // 'main' | 'target'
let targetEnemyIndex = 0; // 选中的目标敌人索引
let resolvePromise = null;
let battleTimer = null;

// 步骤 1：初始化战斗，载入各种数据和素材
export async function start(id, failId, fleeId) {
  battleId = id;
  failScriptId = failId;
  fleeScriptId = fleeId;

  // 步骤 1.1：判断前序场景是否已被 0x50 淡出。若是，则无需再次淡出；若否，则先播放淡出动画
  await checkAndFadeOut();

  // 步骤 1.2：切换为战斗模式，并初始化战斗状态机
  state.currentMode = 'battle';
  isBattleRunning = true;
  turn = 1;
  phase = 'select';
  activePlayerIndex = 0;
  selectedAction = 0;
  menuState = 'main';
  targetEnemyIndex = 0;
  damagePopups = [];

  // 加载战场背景 (FBP 格式)
  bgImage = loadFbp(state.battlefieldId);
  borderImage = loadPic(19);

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
      name: `敌人 #${enemyConfigId}`,
      maxHp: cfg.wHealth || 100,
      hp: cfg.wHealth || 100,
      defense: cfg.wDefense || 10,
      dexterity: cfg.wDexterity || 10,
      attackStrength: cfg.wAttackStrength || 10,
      x: pos.x,
      y: yPos,
      spriteData: spriteData,
      currentFrame: 0,
      maxIdleFrames: cfg.wIdleFrames || 4,
      animSpeed: cfg.wIdleAnimSpeed || 4,
      animTick: 0,
      attackSound: cfg.wAttackSound || 0,
      deathSound: cfg.wDeathSound || 0
    });
  }

  // 初始化玩家角色
  players = [];
  const partySize = state.party.length;
  const posPreset = PLAYER_POS_PRESETS[Math.min(2, Math.max(0, partySize - 1))];

  for (let i = 0; i < partySize; i++) {
    const role = state.party[i];
    const roleStats = state.roles[role.index] || {};
    const pos = posPreset[i] || [200, 150];

    // 从 f.mkf 加载玩家角色战斗动画数据包并进行 deyj 解压
    let spriteNum = roleStats.spriteNumInBattle;
    
    // 步骤 1.3：提供我方角色战斗精灵图包 ID 兜底映射
    // 当读档或初始精灵包为 0，且角色本身不是李逍遥 (index !== 0) 时，说明需要强行重定位为对应角色的专属包
    if (spriteNum === undefined || (spriteNum === 0 && role.index !== 0)) {
      const defaultSprites = [0, 1, 2, 4, 3, 8];
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
      dyingSound: roleStats.dyingSound || defSounds.dying || 0
    });
  }

  // 确保至少有一个活着的队员可供指令选择
  activePlayerIndex = players.findIndex(p => p.hp > 0);
  if (activePlayerIndex === -1) {
    activePlayerIndex = 0;
  }

  const enemyObjs = teamObjIds?.map(id=>({battleId,enemyId:id,abcId:state.items?.[id]?.roleId}));
  const roles = players.map(p=>({index:p.index,mgoId:p.mgoId,spriteNum:p.spriteNum}));
  console.log(`战斗开启: 敌方队伍 ID ${battleId}, 成员 ${enemies.length} 个 ${JSON.stringify(enemyObjs)}; 我方成员 ${players.length} 个 ${JSON.stringify(roles)}。我方人员物理攻击动作从 f.mkf 的 spriteNum 精灵包读取，敌方人员物理攻击动作从 abc.mkf 的 abcId 精灵包读取。`);

  // 步骤 1.4：绘制战斗画面的第一帧并启动战斗时钟
  draw();
  startBattleClock();

  // 播放战斗背景音乐（由 0x45 setFightMusic 预先写入 state.wNumBattleMusic）
  const battleMusicNum = state.wNumBattleMusic || 0;
  if (battleMusicNum > 0) {
    console.log(`[Battle] 开始播放战斗背景音乐 ID: ${battleMusicNum}`);
    playMusic(battleMusicNum, true, 0);
  }

  // 步骤 1.5：平滑淡入展现战斗画面
  await fadeIn();

  return new Promise((resolve) => {
    resolvePromise = resolve;
  });
}

// 步骤 2：启动战斗渲染时钟与敌人动画嘀嗒
function startBattleClock() {
  if (battleTimer) {
    clearInterval(battleTimer);
  }

  battleTimer = setInterval(() => {
    if (!isBattleRunning) {
      return;
    }

    // 步进敌人 idle 动画帧
    enemies.forEach(e => {
      if (e.hp <= 0) {
        return;
      }
      e.animTick++;
      if (e.animTick >= e.animSpeed) {
        e.animTick = 0;
        e.currentFrame = (e.currentFrame + 1) % e.maxIdleFrames;
      }
    });

    // 刷新绘制
    draw();
  }, 100);
}

// 步骤 3：战斗系统界面统一渲染绘制核心
function draw() {
  const backCtx = state.contexts.back;
  const mainCtx = state.contexts.main;
  const talkCtx = state.contexts.talk;

  if (!backCtx || !mainCtx || !talkCtx) {
    return;
  }

  // 1. 清屏并绘制战场背景
  backCtx.clearRect(0, 0, 320, 200);
  if (bgImage) {
    backCtx.drawImage(bgImage, 0, 0);
  }

  mainCtx.clearRect(0, 0, 320, 200);
  talkCtx.clearRect(0, 0, 320, 200);

  // 2. 收集并合并所有活着的战斗成员（包括我方与敌方），按照屏幕纵深 Y 坐标升序排序
  // 随后采用 2.5D 画家算法依次绘制，确保前排大体型角色能正确遮挡后排人物而不会遮盖异常
  const renderQueue = [];

  enemies.forEach(e => {
    if (e.hp > 0) {
      renderQueue.push({ type: 'enemy', actor: e });
    }
  });

  players.forEach(p => {
    if (p.hp > 0) {
      renderQueue.push({ type: 'player', actor: p });
    }
  });

  renderQueue.sort((a, b) => a.actor.y - b.actor.y);

  renderQueue.forEach(item => {
    const actor = item.actor;
    const frameImg = loadSpriteFrame(actor.spriteData, actor.currentFrame);
    if (frameImg) {
      const dx = actor.x - frameImg.width / 2;
      const dy = actor.y - frameImg.height;

      // 选中敌人目标时高亮闪烁（对应 sdlpal PAL_RLEBlitWithColorShift(sprite, ..., colorShift=7)）
      if (phase === 'select' && menuState === 'target' && item.type === 'enemy') {
        const isTarget = enemies.indexOf(actor) === targetEnemyIndex;
        if (isTarget && Math.floor(Date.now() / 250) % 2 === 1) {
          mainCtx.filter = 'brightness(2.5) saturate(0.2)';
        } else {
          mainCtx.filter = 'none';
        }
      } else {
        mainCtx.filter = 'none';
      }

      mainCtx.drawImage(frameImg, dx, dy);
      mainCtx.filter = 'none';
      actor.width = frameImg.width;
      actor.height = frameImg.height;
    }
  });

  // 4. 指令选择阶段 UI 绘制
  if (phase === 'select') {
    // 绘制菱形指令选择菜单
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
      if (selectedAction === idx && menuState === 'main') {
        // 选中图标：正常彩色显示（对应 sdlpal PAL_RLEBlitToSurface 正常渲染）
        talkCtx.filter = 'none';
        talkCtx.drawImage(icon.img, icon.x, icon.y);
      } else {
        // 未选中图标：灰度暗化（对应 sdlpal PAL_RLEBlitMonoColor bColor=0, iColorShift=-4）
        talkCtx.filter = 'grayscale(1) brightness(0.55)';
        talkCtx.drawImage(icon.img, icon.x, icon.y);
      }
    });
    // 恢复默认滤镜，防止影响后续绘制
    talkCtx.filter = 'none';

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
        talkCtx.drawImage(arrowImg, ax, ay);
      }
    }
    // 敌人目标选中使用高亮闪烁（已在角色绘制阶段处理），此处不再重复绘制箭头
  }

  // 5. 绘制右侧状态栏面板 (头像与 HP/MP)
  players.forEach((p, i) => {
    const bx = 91 + 77 * i;
    const by = 165;

    // 边框
    if (borderImage) {
      talkCtx.drawImage(borderImage, bx, by);
    }

    // 头像 (49 + 角色 0-based 索引)
    const avatarImg = loadPic(49 + p.index);
    if (avatarImg) {
      talkCtx.drawImage(avatarImg, bx - 3, by);
    }

    // 数字渲染：显示「当前HP / 最大HP」和「当前MP / 最大MP」
    // 参考 sdlpal: PAL_DrawNumber(HP, ...) + SPRITENUM_SLASH(#40号图) + PAL_DrawNumber(MaxHP, ...)
    if (p.hp > 0) {
      // HP 行（黄色数字 20~29，中间是 #40 号斜杠图片）
      drawHpMpLine(talkCtx, p.hp, p.maxHp, 'hp', bx + 29, by + 6);
      // MP 行（青色数字 57~66，中间是 #40 号斜杠图片）
      drawHpMpLine(talkCtx, p.mp, p.maxMp, 'mp', bx + 29, by + 20);
    } else {
      // 阵亡状态
      talkCtx.fillStyle = '#ff3333';
      talkCtx.font = 'bold 8px sans-serif';
      talkCtx.fillText('阵亡', bx + 44, by + 18);
    }
  });

  // 6. 绘制弹出的红/白伤害字样
  const time = Date.now();
  damagePopups = damagePopups.filter(p => time - p.startTime < 750);
  damagePopups.forEach(p => {
    const elapsed = time - p.startTime;
    const yOffset = (elapsed / 750) * 18;
    const alpha = 1.0 - (elapsed / 750);

    talkCtx.save();
    talkCtx.globalAlpha = alpha;
    talkCtx.fillStyle = p.isPlayer ? '#ffffff' : '#ff3333';
    talkCtx.strokeStyle = '#000000';
    talkCtx.lineWidth = 2;
    talkCtx.font = 'bold 12px sans-serif';
    talkCtx.textAlign = 'center';
    
    const ty = p.actor.y - (p.actor.height || 40) - yOffset;
    talkCtx.strokeText(p.value.toString(), p.actor.x, ty);
    talkCtx.fillText(p.value.toString(), p.actor.x, ty);
    talkCtx.restore();
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

// 步骤 4：处理战斗指令输入事件，对接 input.js
export function onInput(input) {
  if (phase !== 'select') {
    return;
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
          }
        }
        break;
      case 'ESC':
        // 回退选择上一个人的指令
        if (activePlayerIndex > 0) {
          do {
            activePlayerIndex--;
          } while (activePlayerIndex >= 0 && players[activePlayerIndex].hp <= 0);

          if (activePlayerIndex >= 0) {
            players[activePlayerIndex].action = null;
          } else {
            activePlayerIndex = 0;
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
        
        // 推进到下一活着的队员指令选择
        let nextIdx = activePlayerIndex + 1;
        while (nextIdx < players.length && players[nextIdx].hp <= 0) {
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
        break;
      case 'ESC': // 取消选择，返回指令菜单
        menuState = 'main';
        break;
    }
  }

  draw();
}

// 步骤 5：按速度出手顺序依次执行战斗结算
async function runActionPhase() {
  phase = 'action';
  draw();

  // 根据身法属性由高到低对所有出手者进行排序
  const actors = [];
  players.forEach((p, idx) => {
    if (p.hp > 0) {
      actors.push({ type: 'player', index: idx, speed: p.dexterity });
    }
  });
  enemies.forEach((e, idx) => {
    if (e.hp > 0) {
      actors.push({ type: 'enemy', index: idx, speed: e.dexterity });
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
      if (act && act.type === 'attack') {
        let targetIdx = act.target;
        if (enemies[targetIdx].hp <= 0) {
          // 目标已被击杀，顺延切换到下一个活着敌人
          targetIdx = enemies.findIndex(e => e.hp > 0);
        }
        if (targetIdx !== -1) {
          await playPlayerAttack(actor.index, targetIdx);
        }
      }
    } else {
      const enemy = enemies[actor.index];
      if (enemy.hp <= 0) continue;

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
    // 重置进入下一回合指令录入
    phase = 'select';
    selectedAction = 0;
    menuState = 'main';
    
    activePlayerIndex = players.findIndex(p => p.hp > 0);
    if (activePlayerIndex === -1) {
      activePlayerIndex = 0;
    }
    
    players.forEach(p => {
      p.action = null;
    });

    turn++;
    draw();
  }
}

// 步骤 6：播放物理攻击出手动画
async function playPlayerAttack(playerIdx, enemyIdx) {
  const player = players[playerIdx];
  const enemy = enemies[enemyIdx];

  const origX = player.x;
  const origY = player.y;

  // 播放准备普通攻击动作叫喊音效
  if (player.attackSound > 0) {
    playSound(player.attackSound);
  }

  // 1. 瞬移到敌人身前 (frame 8 准备姿势)
  player.x = enemy.x + 35;
  player.y = enemy.y + 10;
  player.currentFrame = 8;
  draw();
  await sleep(150);

  // 2. 挥刀斩击 (frame 9 出手动作)
  player.x = enemy.x + 28;
  player.y = enemy.y + 8;
  player.currentFrame = 9;

  // 播放武器打击/挥舞音效
  if (player.weaponSound > 0) {
    playSound(player.weaponSound);
  }

  // 简易物理伤害算法
  let dmg = Math.floor((player.attackStrength * 2 - enemy.defense * 1.5) * (0.85 + Math.random() * 0.3));
  if (dmg < 1) dmg = 1;
  enemy.hp = Math.max(0, enemy.hp - dmg);

  // 触发伤害数额浮动字样
  damagePopups.push({
    actor: enemy,
    value: dmg,
    isPlayer: false,
    startTime: Date.now()
  });

  // 如果敌人死亡，则播放敌人死亡音效
  if (enemy.hp <= 0 && enemy.deathSound > 0) {
    playSound(enemy.deathSound);
  }

  draw();
  await sleep(250);

  // 3. 返回原位
  player.x = origX;
  player.y = origY;
  player.currentFrame = 0;
  draw();
  await sleep(100);
}

// 步骤 7：播放敌方攻击出手动画
async function playEnemyAttack(enemyIdx, playerIdx) {
  const enemy = enemies[enemyIdx];
  const player = players[playerIdx];

  const origX = enemy.x;
  const origY = enemy.y;

  // 播放敌方普通物理攻击叫喊音效
  if (enemy.attackSound > 0) {
    playSound(enemy.attackSound);
  }

  // 1. 敌人瞬移到队员面前
  enemy.x = player.x - 30;
  enemy.y = player.y - 10;
  draw();
  await sleep(150);

  // 2. 造成物理伤害
  let dmg = Math.floor((enemy.attackStrength * 2 - player.defense * 1.5) * (0.85 + Math.random() * 0.3));
  if (dmg < 1) dmg = 1;
  player.hp = Math.max(0, player.hp - dmg);

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

  draw();
  await sleep(250);

  // 3. 返回原位
  enemy.x = origX;
  enemy.y = origY;
  draw();
  await sleep(100);
}

// 步骤 8：检查并进行战斗胜负胜败判定
function checkBattleEnd() {
  const allEnemiesDead = enemies.every(e => e.hp <= 0);
  const allPlayersDead = players.every(p => p.hp <= 0);

  if (allEnemiesDead) {
    endBattle(true);
    return true;
  } else if (allPlayersDead) {
    endBattle(false);
    return true;
  }

  return false;
}

// 步骤 9：战斗结束，清理状态并结算后续剧情脚本分支
async function endBattle(victory) {
  phase = 'end';
  clearInterval(battleTimer);
  battleTimer = null;

  // 步骤 9.1：绘制胜负消息框提示
  const talkCtx = state.contexts.talk;
  if (talkCtx) {
    talkCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    talkCtx.fillRect(80, 80, 160, 40);
    talkCtx.strokeStyle = '#ffd700';
    talkCtx.strokeRect(80, 80, 160, 40);

    talkCtx.fillStyle = victory ? '#00ffaa' : '#ff3333';
    talkCtx.font = 'bold 12px sans-serif';
    talkCtx.textAlign = 'center';
    talkCtx.fillText(victory ? '战 斗 胜 利' : '全 员 战 败', 160, 104);
  }

  // 步骤 9.2：等待 1.5 秒以展示结果框
  await sleep(1500);

  // 步骤 9.3：渐变淡出当前战斗画面至黑色
  // await fadeOut();

  isBattleRunning = false;
  state.currentMode = 'game';

  // 清空背景层和谈话层以露出大地图
  // state.contexts.back.clearRect(0, 0, 320, 200);
  state.contexts.talk.clearRect(0, 0, 320, 200);

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
      x: e.x,
      y: e.y,
      currentFrame: e.currentFrame,
      maxIdleFrames: e.maxIdleFrames,
      spriteData: e.spriteData
    }))
  };
}
