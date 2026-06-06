import { state } from '../engine/state.js';
import { loadFbp, loadPic } from '../resources/pal.js';
import { loadEnemies, loadEnemyTeam, loadEnemyPos, loadSpriteFrame } from './battleData.js';
import { loadMkf } from '../resources/loader.js';
import { deyj } from '../utils/deyj.js';

// 站位坐标配置 (1人, 2人, 3人)
const PLAYER_POS_PRESETS = [
  [[240, 170]],                         // 1个队员
  [[200, 176], [[256, 152]]],           // 2个队员
  [[180, 180], [234, 170], [270, 146]]  // 3个队员
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
      animTick: 0
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
    if (spriteNum === undefined) {
      // 步骤 1.5：提供我方角色战斗精灵图包 ID 兜底映射
      // 0-李逍遥->0, 1-赵灵儿->1, 2-林月如->2, 3-阿奴->4, 4-巫后->3, 5-盖罗娇->8
      const defaultSprites = [0, 1, 2, 4, 3, 8];
      spriteNum = defaultSprites[role.index] !== undefined ? defaultSprites[role.index] : 0;
    }
    const spriteData = deyj(loadMkf('f.mkf', spriteNum));

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
      x: pos[0],
      y: pos[1],
      spriteData: spriteData,
      currentFrame: 0,
      action: null // 选择的指令
    });
  }

  // 确保至少有一个活着的队员可供指令选择
  activePlayerIndex = players.findIndex(p => p.hp > 0);
  if (activePlayerIndex === -1) {
    activePlayerIndex = 0;
  }

  const enemyObjs = teamObjIds?.map(id=>({battleId,enemyId:id,abcId:state.items?.[id]?.roleId}));
  const roles = state.party.map(p=>({index:p.index,mgoId:p.tileId}));
  console.log(`战斗开启: 敌方队伍 ID ${battleId}, 成员 ${enemies.length} 个 ${JSON.stringify(enemyObjs)}; 我方成员 ${players.length} 个 ${JSON.stringify(roles)}`);

  // 开启画面的定时绘制渲染与逻辑更新时钟
  startBattleClock();

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

  // 2. 绘制活着的敌人精灵
  enemies.forEach(e => {
    if (e.hp <= 0) {
      return;
    }
    const frameImg = loadSpriteFrame(e.spriteData, e.currentFrame);
    if (frameImg) {
      const dx = e.x - frameImg.width / 2;
      const dy = e.y - frameImg.height;
      mainCtx.drawImage(frameImg, dx, dy);
      e.width = frameImg.width;
      e.height = frameImg.height;
    }
  });

  // 3. 绘制我方角色精灵
  players.forEach(p => {
    if (p.hp <= 0) {
      return;
    }
    const frameImg = loadSpriteFrame(p.spriteData, p.currentFrame);
    if (frameImg) {
      const dx = p.x - frameImg.width / 2;
      const dy = p.y - frameImg.height;
      mainCtx.drawImage(frameImg, dx, dy);
      p.width = frameImg.width;
      p.height = frameImg.height;
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
      talkCtx.drawImage(icon.img, icon.x, icon.y);
      if (selectedAction === idx && menuState === 'main') {
        // 绘制高亮选择框 (30x30)
        talkCtx.strokeStyle = '#ffd700';
        talkCtx.lineWidth = 1.5;
        talkCtx.strokeRect(icon.x, icon.y, 30, 30);
      }
    });

    // 绘制指示当前正在选择的队员箭咀
    const activePlayer = players[activePlayerIndex];
    if (activePlayer && activePlayer.hp > 0) {
      const ax = activePlayer.x - 4;
      const ay = activePlayer.y - (activePlayer.height || 40) - 10 - (Math.floor(Date.now() / 250) % 2 * 3);
      drawArrow(talkCtx, ax, ay, '#ff3333');
    }

    // 目标敌人选择提示
    if (menuState === 'target') {
      const targetEnemy = enemies[targetEnemyIndex];
      if (targetEnemy && targetEnemy.hp > 0) {
        const ex = targetEnemy.x - 4;
        const ey = targetEnemy.y - (targetEnemy.height || 40) - 10 - (Math.floor(Date.now() / 250) % 2 * 3);
        drawArrow(talkCtx, ex, ey, '#ffff00');
      }
    }
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
      talkCtx.drawImage(avatarImg, bx + 2, by);
    }

    // 数字渲染
    if (p.hp > 0) {
      drawValueDigits(talkCtx, p.hp, 'hp', bx + 42, by + 6);
      drawValueDigits(talkCtx, p.mp, 'mp', bx + 42, by + 20);
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

// 绘制状态数字
function drawValueDigits(ctx, val, type, startX, startY) {
  const baseId = type === 'hp' ? 20 : 57;
  const str = val.toString();
  for (let i = 0; i < str.length; i++) {
    const digit = parseInt(str.charAt(str.length - 1 - i));
    const digitImg = loadPic(baseId + digit);
    if (digitImg) {
      ctx.drawImage(digitImg, startX - i * 7, startY);
    }
  }
}

// 绘制方向指示箭头
function drawArrow(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 8, y);
  ctx.lineTo(x + 4, y + 6);
  ctx.closePath();
  ctx.fill();
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
function endBattle(victory) {
  phase = 'end';
  clearInterval(battleTimer);
  battleTimer = null;

  // 绘制胜负消息框提示
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

  // 延时 1.5 秒后完全还原切回地图，清理解锁
  setTimeout(() => {
    isBattleRunning = false;
    state.currentMode = 'game';

    // 清空背景层和谈话层以露出大地图
    state.contexts.back.clearRect(0, 0, 320, 200);
    state.contexts.talk.clearRect(0, 0, 320, 200);

    if (resolvePromise) {
      const p = resolvePromise;
      resolvePromise = null;
      p(victory); // 恢复 0x07 startBattle 指令的 async 阻塞挂起
    }
  }, 1500);
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
      x: p.x,
      y: p.y,
      currentFrame: p.currentFrame,
      action: p.action,
      spriteData: p.spriteData
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
