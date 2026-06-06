import { loadMkf } from '../resources/loader.js';
import { state } from '../engine/state.js';
import { createRleImage } from '../resources/pal.js';

// 缓存敌人和站位数据，避免重复读取
let cachedEnemies = null;
let cachedEnemyPos = null;

// 步骤 0：将 16 位无符号整数转换为有符号的 16 位 short 整数，以防止数值溢出
function toShort(val) {
  return val > 32767 ? val - 65536 : val;
}

// 步骤 1：解析敌人表（data.mkf #1）
// 每个 ENEMY 记录在 DOS 版本中为 70 字节
export function loadEnemies() {
  if (cachedEnemies) {
    return cachedEnemies;
  }

  const enemyData = loadMkf('data.mkf', 1);
  if (!enemyData) {
    console.error('无法加载 data.mkf #1 敌人数据块');
    return [];
  }

  const list = [];
  const numEnemies = Math.floor(enemyData.length / 70);

  for (let i = 0; i < numEnemies; i++) {
    const offset = i * 70;
    
    const e = {
      wIdleFrames: enemyData.getShort(offset + 0),
      wMagicFrames: enemyData.getShort(offset + 2),
      wAttackFrames: enemyData.getShort(offset + 4),
      wIdleAnimSpeed: enemyData.getShort(offset + 6),
      wActWaitFrames: enemyData.getShort(offset + 8),
      wYPosOffset: toShort(enemyData.getShort(offset + 10)),
      wAttackSound: toShort(enemyData.getShort(offset + 12)),
      wActionSound: toShort(enemyData.getShort(offset + 14)),
      wMagicSound: toShort(enemyData.getShort(offset + 16)),
      wDeathSound: toShort(enemyData.getShort(offset + 18)),
      wCallSound: toShort(enemyData.getShort(offset + 20)),
      wHealth: enemyData.getShort(offset + 22),
      wExp: enemyData.getShort(offset + 24),
      wCash: enemyData.getShort(offset + 26),
      wLevel: enemyData.getShort(offset + 28),
      wMagic: enemyData.getShort(offset + 30),
      wMagicRate: enemyData.getShort(offset + 32),
      wAttackEquivItem: enemyData.getShort(offset + 34),
      wAttackEquivItemRate: enemyData.getShort(offset + 36),
      wStealItem: enemyData.getShort(offset + 38),
      nStealItem: enemyData.getShort(offset + 40),
      wAttackStrength: toShort(enemyData.getShort(offset + 42)),
      wMagicStrength: toShort(enemyData.getShort(offset + 44)),
      wDefense: toShort(enemyData.getShort(offset + 46)),
      wDexterity: toShort(enemyData.getShort(offset + 48)),
      wFleeRate: enemyData.getShort(offset + 50),
      wPoisonResistance: enemyData.getShort(offset + 52),
      wElemResistance: [
        toShort(enemyData.getShort(offset + 54)),
        toShort(enemyData.getShort(offset + 56)),
        toShort(enemyData.getShort(offset + 58)),
        toShort(enemyData.getShort(offset + 60)),
        toShort(enemyData.getShort(offset + 62))
      ],
      wPhysicalResistance: toShort(enemyData.getShort(offset + 64)),
      wDualMove: enemyData.getShort(offset + 66),
      wCollectValue: enemyData.getShort(offset + 68)
    };
    list.push(e);
  }

  cachedEnemies = list;
  console.log(`成功加载并解析 ${list.length} 个敌人配置数据`);

  state.enemies = list;
  return list;
}

// 步骤 2：解析指定敌方队伍（data.mkf #2）
// 每个 ENEMYTEAM 包含 5 个 WORD（每个 2 字节，总共 10 字节）的物体 ID
export function loadEnemyTeam(teamId) {
  const teamData = loadMkf('data.mkf', 2);
  if (!teamData) {
    console.error('无法加载 data.mkf #2 敌方队伍数据块');
    return [];
  }

  const enemyObjIds = [];
  const offset = teamId * 10;

  for (let j = 0; j < 5; j++) {
    const enemyObjId = teamData.getShort(offset + j * 2);
    // 0xFFFF 或 0 表示没有敌人
    if (enemyObjId !== 0 && enemyObjId !== 0xFFFF) {
      enemyObjIds.push(enemyObjId);
    }
  }

  return enemyObjIds;
}

// 步骤 3：解析敌人战场原站位坐标（data.mkf #13）
// 格式为 5*5 = 25 个 PALPOS 结构，每个 PALPOS 占 4 字节（X 占 2 字节，Y 占 2 字节）
export function loadEnemyPos() {
  if (cachedEnemyPos) {
    return cachedEnemyPos;
  }

  const posData = loadMkf('data.mkf', 13);
  if (!posData) {
    console.error('无法加载 data.mkf #13 敌人坐标位置数据块');
    return [];
  }

  const enemyPos = [];
  
  for (let i = 0; i < 5; i++) {
    enemyPos[i] = [];
    for (let j = 0; j < 5; j++) {
      const offset = (i * 5 + j) * 4;
      enemyPos[i][j] = {
        x: toShort(posData.getShort(offset + 0)),
        y: toShort(posData.getShort(offset + 2))
      };
    }
  }

  cachedEnemyPos = enemyPos;
  console.log('成功解析敌人战场坐标位置表');

  state.enemyPos = enemyPos;
  return enemyPos;
}

// 步骤 4：解包并解码多帧 RLE 精灵图像中的指定帧图像
export function loadSpriteFrame(spriteData, frameIndex) {
  if (!spriteData) {
    return null;
  }

  // 首字为帧数限制，如果帧数超出合理界限则直接返回 null
  const imageCount = spriteData.getShort(0);
  if (frameIndex < 0 || frameIndex >= imageCount) {
    return null;
  }

  // 根据帧索引计算 2 字节的偏移地址，再乘 2 换算为绝对物理偏移量
  const offset = spriteData.getShort(frameIndex * 2) * 2;
  const frameData = spriteData.slice(offset, spriteData.length);
  
  return createRleImage(frameData);
}
