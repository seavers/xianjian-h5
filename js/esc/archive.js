import { state } from '../engine/state.js';
import { Lang } from '../utils/lang.js';
import { ByteArray } from '../utils/view.js';

// 模块级变量，用于暂存最近一次成功加载或保存的存档 ArrayBuffer 底板
let lastLoadedBuffer = null;

// 高性能 Base64 二进制转换辅助函数
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes.buffer;
}

// 抽取 byteArray 中的物理 ArrayBuffer 视图切片，保证无缝兼容
function extractArrayBuffer(byteArray) {
  return byteArray.buffer.buffer.slice(
    byteArray.byteOffset,
    byteArray.byteOffset + byteArray.length
  );
}

// ==================== 💽 IndexedDB 存档引擎核心实现 ====================
const DB_NAME = 'PAL_DB';
const STORE_NAME = 'PAL_SAVES';
const DB_VERSION = 1;

let db = null;
let dbPromise = null;

// 步骤 1：初始化并打开 IndexedDB 数据库
function initDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      console.error('[IndexedDB] 数据库打开失败:', event.target.error);
      reject(event.target.error);
    };
  });

  return dbPromise;
}

// 步骤 2：检查并从 localStorage 迁移已有存档数据至 IndexedDB
async function checkAndMigrate() {
  if (localStorage.getItem('PAL_SAVEDB_MIGRATED') === 'true') {
    return;
  }

  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // 遍历 localStorage 查找所有符合命名规则的存档槽位并复制迁移
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('PAL_SAVE_SLOT_')) {
        const base64Data = localStorage.getItem(key);
        if (base64Data) {
          try {
            const buffer = base64ToArrayBuffer(base64Data);
            store.put(buffer, key);
            console.log(`[IndexedDB Migration] 成功迁移存档: ${key}`);
          } catch (e) {
            console.error(`[IndexedDB Migration] 迁移存档失败: ${key}`, e);
          }
        }
      }
    }

    // 等待迁移事务顺利全部提交完成
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = (event) => reject(event.target.error);
    });

    localStorage.setItem('PAL_SAVEDB_MIGRATED', 'true');
    console.log('[IndexedDB Migration] 所有 localStorage 存档成功复制到 indexedDB！');
  } catch (e) {
    console.error('[IndexedDB Migration] 迁移过程发生错误:', e);
  }
}

// 步骤 3：获取指定槽位存档的异步数据封装
async function getArchiveData(slotId) {
  await checkAndMigrate();
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const key = `PAL_SAVE_SLOT_${slotId}`;
    const request = store.get(key);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 步骤 4：保存指定槽位存档的异步数据封装
async function saveArchiveData(slotId, buffer) {
  await checkAndMigrate();
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const key = `PAL_SAVE_SLOT_${slotId}`;
    const request = store.put(buffer, key);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 步骤 5：异步获取所有键中最大的存档槽位 ID
export async function getMaxSaveSlotId() {
  await checkAndMigrate();
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onsuccess = () => {
      let maxId = 0;
      const keys = request.result;
      for (const key of keys) {
        if (typeof key === 'string') {
          const match = key.match(/^PAL_SAVE_SLOT_(\d+)$/);
          if (match) {
            const id = parseInt(match[1]);
            if (id > maxId) {
              maxId = id;
            }
          }
        }
      }
      resolve(maxId);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 触发首次运行的后台数据库检查与自动迁移
checkAndMigrate();

/**
 * 读档逻辑：优先从 indexedDB 加载，如无本地进度则降级从服务端网络下载
 */
export function loadArchive(slotId, callback) {
  state.currentSaveSlot = slotId;

  getArchiveData(slotId).then((buffer) => {
    if (buffer) {
      console.log(`[Archive] 优先从本地 indexedDB 发现进度: PAL_SAVE_SLOT_${slotId}`);
      try {
        const byteArray = new ByteArray(new Uint8Array(buffer));

        // 步骤 1：记录当前读取的 Buffer 作为后续保存的元数据基准底板
        lastLoadedBuffer = buffer;

        // 步骤 2：对本地存档执行高精度二进制解包还原至全局 state
        parseSaveData(byteArray);

        console.log(`[Archive] 本地进度 #${slotId} 读取并还原成功！`);
        if (callback) callback();
        return;
      } catch (e) {
        console.error('[Archive] 本地存档解析失败，降级为服务端加载:', e);
      }
    }

    const filename = `${slotId}.RPG`;
    console.log(`[Archive] 本地进度未找到，正在从服务端下载: pal/${filename}`);

    // 步骤 3：本地无进度，向服务端发起 AJAX 请求读取 .RPG 文件并解析
    Lang.ajaxByteArray(filename, (byteArray) => {
      if (!byteArray || byteArray.length === 0) {
        console.error(`[Archive] 无法从服务端读取文件: ${filename}`);
        return;
      }

      const buffer = extractArrayBuffer(byteArray);
      lastLoadedBuffer = buffer;

      parseSaveData(byteArray);

      console.log(`[Archive] 服务端进度 #${slotId} 下载并还原成功！`);
      if (callback) callback();
    });
  }).catch((err) => {
    console.error('[Archive] 读取 indexedDB 失败，降级为服务端加载:', err);
    const filename = `${slotId}.RPG`;
    Lang.ajaxByteArray(filename, (byteArray) => {
      if (!byteArray || byteArray.length === 0) {
        console.error(`[Archive] 无法从服务端读取文件: ${filename}`);
        return;
      }

      const buffer = extractArrayBuffer(byteArray);
      lastLoadedBuffer = buffer;

      parseSaveData(byteArray);

      console.log(`[Archive] 服务端进度 #${slotId} 下载并还原成功！`);
      if (callback) callback();
    });
  });
}

/**
 * 存档逻辑：按照标准的 DOS 存档格式序列化，并以二进制形式存入 indexedDB
 */
export function saveArchive(slotId, callback) {
  state.currentSaveSlot = slotId;
  // 步骤 1：初始化一块 183,488 字节的缓冲区块。若有元数据底板则拷贝，以防 H5 未用数据丢失
  const bytes = lastLoadedBuffer ? new Uint8Array(lastLoadedBuffer).slice(0) : new Uint8Array(183488);
  const view = new DataView(bytes.buffer);

  // 步骤 2：写入头部 40 字节元数据
  view.setUint16(0, 1, true); // wSavedTimes
  const leader = state.party[0] || state.roles[0];
  view.setUint16(2, leader ? leader.x : 0, true); // wViewportX
  view.setUint16(4, leader ? leader.y : 0, true); // wViewportY
  view.setUint16(6, state.party.length > 0 ? state.party.length - 1 : 0, true); // nPartyMember
  view.setUint16(8, state.sceneId, true); // wNumScene
  view.setUint16(10, state.fNightPalette ? 0x180 : 0, true); // wPaletteOffset
  view.setUint16(12, leader ? leader.dir : 0, true); // wPartyDirection
  view.setUint16(14, 0, true); // wNumMusic
  view.setUint16(16, 0, true); // wNumBattleMusic
  view.setUint16(18, 0, true); // wNumBattleField
  view.setUint16(20, 0, true); // wScreenWave
  view.setUint16(22, 2, true); // wBattleSpeed
  view.setUint16(24, 0, true); // wCollectValue
  view.setUint16(26, leader ? Math.floor(leader.layer / 8) : 0, true); // wLayer
  view.setUint16(28, state.chaseRange || 1, true); // wChaseRange
  view.setUint16(30, state.chasespeedChangeCycles || 0, true); // wChasespeedChangeCycles
  view.setUint16(32, state.nFollower || 0, true); // nFollower
  view.setUint16(34, 0, true); // rgwReserved2[0]
  view.setUint16(36, 0, true); // rgwReserved2[1]
  view.setUint16(38, 0, true); // rgwReserved2[2]

  // 步骤 3：写入金钱数据 (offset 40)
  view.setUint32(40, state.money || 0, true);

  // 步骤 3.5：写入队伍成员信息 rgParty (offset 44)
  for (let i = 0; i < 5; i++) {
    const role = state.party[i];
    const offsetParty = 44 + i * 10;
    if (role) {
      view.setUint16(offsetParty + 0, role.index, true); // wPlayerRole (0-based)
      view.setInt16(offsetParty + 2, role.x, true); // x (signed)
      view.setInt16(offsetParty + 4, role.y, true); // y (signed)
      view.setUint16(offsetParty + 6, role.frame, true); // wFrame
      view.setUint16(offsetParty + 8, role.tileId || 0, true); // wImageOffset
    } else {
      view.setUint16(offsetParty + 0, 0, true);
      view.setInt16(offsetParty + 2, 0, true);
      view.setInt16(offsetParty + 4, 0, true);
      view.setUint16(offsetParty + 6, 0, true);
      view.setUint16(offsetParty + 8, 0, true);
    }
  }

  // 步骤 3.8：写入角色状态与装备等战斗属性 PlayerRoles (offset 508)
  for (let i = 0; i < 6; i++) {
    const role = state.roles[i];
    if (role) {
      view.setUint16(508 + 72 + i * 2, role.level || 0, true);
      view.setUint16(508 + 84 + i * 2, role.maxHp || 0, true);
      view.setUint16(508 + 96 + i * 2, role.maxMp || 0, true);
      view.setUint16(508 + 108 + i * 2, role.hp || 0, true);
      view.setUint16(508 + 120 + i * 2, role.mp || 0, true);

      for (let part = 0; part < 6; part++) {
        const eqId = role.equipments ? role.equipments[part] : 0;
        view.setUint16(508 + 132 + part * 12 + i * 2, eqId || 0, true);
      }

      view.setUint16(508 + 204 + i * 2, role.attackStrength || 0, true);
      view.setUint16(508 + 216 + i * 2, role.magicStrength || 0, true);
      view.setUint16(508 + 228 + i * 2, role.defense || 0, true);
      view.setUint16(508 + 240 + i * 2, role.dexterity || 0, true);
      view.setUint16(508 + 252 + i * 2, role.fleeRate || 0, true);
      view.setUint16(508 + 264 + i * 2, role.poisonResistance || 0, true);

      for (let m = 0; m < 32; m++) {
        const magicId = (role.magics && role.magics[m]) || 0;
        view.setUint16(508 + 384 + m * 12 + i * 2, magicId, true);
      }
    }
  }

  // 步骤 4：重构背包道具 rgInventory (offset 1728)
  const itemCounts = {};
  for (const itemId of state.ownItems) {
    itemCounts[itemId] = (itemCounts[itemId] || 0) + 1;
  }
  const uniqueItems = Object.keys(itemCounts).map(Number);
  let offset = 1728;
  for (let i = 0; i < 256; i++) {
    if (i < uniqueItems.length) {
      const itemId = uniqueItems[i];
      const amount = itemCounts[itemId];
      view.setUint16(offset + i * 6 + 0, itemId, true);
      view.setUint16(offset + i * 6 + 2, amount, true);
      view.setUint16(offset + i * 6 + 4, 0, true);
    } else {
      view.setUint16(offset + i * 6 + 0, 0, true);
      view.setUint16(offset + i * 6 + 2, 0, true);
      view.setUint16(offset + i * 6 + 4, 0, true);
    }
  }

  // 步骤 5：写入场景信息 rgScene (offset 3264)
  offset = 3264;
  for (let i = 0; i < 300; i++) {
    const scene = state.scenes[i + 1];
    if (scene) {
      view.setUint16(offset + i * 8 + 0, scene.mapId, true);
      view.setUint16(offset + i * 8 + 2, scene.enterScriptId, true);
      view.setUint16(offset + i * 8 + 4, scene.exitScriptId, true);
      view.setUint16(offset + i * 8 + 6, scene.startEventId, true);
    } else {
      view.setUint16(offset + i * 8 + 0, 0, true);
      view.setUint16(offset + i * 8 + 2, 0, true);
      view.setUint16(offset + i * 8 + 4, 0, true);
      view.setUint16(offset + i * 8 + 6, 0, true);
    }
  }

  // 步骤 6：写入基础物品配置 rgObject (offset 5664)
  offset = 5664;
  for (let i = 0; i < 600; i++) {
    const item = state.items[i];
    if (item) {
      view.setUint16(offset + i * 12 + 0, item.roleId, true);
      view.setUint16(offset + i * 12 + 2, item.gold, true);
      view.setUint16(offset + i * 12 + 4, item.useScr, true);
      view.setUint16(offset + i * 12 + 6, item.equScr, true);
      view.setUint16(offset + i * 12 + 8, item.dropScr, true);
      view.setUint16(offset + i * 12 + 10, item.flags, true);
    } else {
      view.setUint16(offset + i * 12 + 0, 0, true);
      view.setUint16(offset + i * 12 + 2, 0, true);
      view.setUint16(offset + i * 12 + 4, 0, true);
      view.setUint16(offset + i * 12 + 6, 0, true);
      view.setUint16(offset + i * 12 + 8, 0, true);
      view.setUint16(offset + i * 12 + 10, 0, true);
    }
  }

  // 步骤 7：写入所有 NPC 物体属性 rgEventObject (offset 12864)
  offset = 12864;
  const nEventObject = Math.floor((183488 - 12864) / 32);
  for (let i = 0; i < nEventObject; i++) {
    const npc = state.eventObjects[i + 1];
    if (npc) {
      view.setUint16(offset + i * 32 + 0, npc.nouse, true);
      view.setUint16(offset + i * 32 + 2, npc.x, true);
      view.setUint16(offset + i * 32 + 4, npc.y, true);
      view.setUint16(offset + i * 32 + 6, npc.layer, true);
      view.setUint16(offset + i * 32 + 8, npc.trigScr, true);
      view.setUint16(offset + i * 32 + 10, npc.autoScr, true);
      view.setUint16(offset + i * 32 + 12, npc.state, true);
      view.setUint16(offset + i * 32 + 14, npc.trigMode, true);
      view.setUint16(offset + i * 32 + 16, npc.mgoId, true);
      view.setUint16(offset + i * 32 + 18, npc.frameWalkCount, true);
      view.setUint16(offset + i * 32 + 20, npc.dir, true);
      view.setUint16(offset + i * 32 + 22, npc.frame, true);
      view.setUint16(offset + i * 32 + 24, npc.idleFrame, true);
      view.setUint16(offset + i * 32 + 26, npc.ptrOffset, true);
      view.setUint16(offset + i * 32 + 28, npc.frameAutoCount, true);
      view.setUint16(offset + i * 32 + 30, npc.idleFrameCountAuto, true);
    } else {
      for (let f = 0; f < 16; f++) {
        view.setUint16(offset + i * 32 + f * 2, 0, true);
      }
    }
  }

  // 步骤 8：安全持久化至 indexedDB
  saveArchiveData(slotId, bytes.buffer).then(() => {
    // 同步更新元数据底板，使得下一次写入在最新基础上叠加
    lastLoadedBuffer = bytes.buffer;
    console.log(`[Archive] 进度槽位 #${slotId} 成功保存至本地 indexedDB！`);
    if (callback) callback();
  }).catch((err) => {
    console.error(`[Archive] 保存进度至 indexedDB 失败:`, err);
  });
}

/**
 * 存档流式二进制反序列化解包函数
 */
function parseSaveData(byteArray) {
  const view = byteArray.toDataView();

  // 1. 读取头部 40 字节元数据
  const wSavedTimes = view.nextShort();
  const wViewportX = view.nextShort();
  const wViewportY = view.nextShort();
  const nPartyMember = view.nextShort();
  const wNumScene = view.nextShort();
  const wPaletteOffset = view.nextShort();
  const wPartyDirection = view.nextShort();
  const wNumMusic = view.nextShort();
  const wNumBattleMusic = view.nextShort();
  const wNumBattleField = view.nextShort();
  const wScreenWave = view.nextShort();
  const wBattleSpeed = view.nextShort();
  const wCollectValue = view.nextShort();
  const wLayer = view.nextShort();
  const wChaseRange = view.nextShort();
  const wChasespeedChangeCycles = view.nextShort();
  const nFollower = view.nextShort();
  view.skipByte(6); // 跳过 rgwReserved2[3]

  // 2. 读取资金，并读取 rgParty，跳过 rgTrail, Exp, PlayerRoles, rgPoisonStatus
  const dwCash = view.nextInt();
  
  const savedParty = [];
  const partySize = nPartyMember + 1; // nPartyMember 实际为 wMaxPartyMemberIndex，所以全队人数为 +1
  for (let i = 0; i < 5; i++) {
    const wPlayerRole = view.nextShort();
    let rx = view.nextShort();
    rx = rx >= 32768 ? rx - 65536 : rx;
    let ry = view.nextShort();
    ry = ry >= 32768 ? ry - 65536 : ry;
    const wFrame = view.nextShort();
    const wImageOffset = view.nextShort(); // 对应 tileId
    
    if (i < partySize) {
      const isFollower = i >= (partySize - nFollower);
      if (isFollower) {
        savedParty.push({
          type: 'role',
          x: rx,
          y: ry,
          layer: wLayer * 8,
          tileId: wImageOffset,
          frame: wFrame,
          dir: wPartyDirection,
          index: wPlayerRole,
          count: 0,
          isFollower: true
        });
      } else {
        let role = state.roles[wPlayerRole];
        if (!role) {
          role = {
            type: 'role',
            index: wPlayerRole,
            count: 0
          };
          state.roles[wPlayerRole] = role;
        }
        role.x = rx;
        role.y = ry;
        role.layer = wLayer * 8;
        role.tileId = wImageOffset;
        role.frame = wFrame;
        role.dir = wPartyDirection;
        savedParty.push(role);
      }
    }
  }
  
  view.skipByte(30); // rgTrail (5 * 6B)
  view.skipByte(384); // Exp (ALLEXPERIENCE: 384B)

  // 读取并填充主角/队员战斗属性 (PlayerRoles: 900B)
  const prView = view.nextView();
  view.skipByte(900);

  const rgwAvatar = prView.nextShortArray(6);
  const rgwSpriteNumInBattle = prView.nextShortArray(6);
  const rgwSpriteNum = prView.nextShortArray(6);
  const rgwName = prView.nextShortArray(6);
  const rgwAttackAll = prView.nextShortArray(6);
  prView.skipByte(12); // rgwUnknown1 (6 * 2B = 12B)
  const rgwLevel = prView.nextShortArray(6);
  const rgwMaxHP = prView.nextShortArray(6);
  const rgwMaxMP = prView.nextShortArray(6);
  const rgwHP = prView.nextShortArray(6);
  const rgwMP = prView.nextShortArray(6);

  const rgwEquipment = [];
  for (let part = 0; part < 6; part++) {
    rgwEquipment[part] = prView.nextShortArray(6);
  }

  const rgwAttackStrength = prView.nextShortArray(6);
  const rgwMagicStrength = prView.nextShortArray(6);
  const rgwDefense = prView.nextShortArray(6);
  const rgwDexterity = prView.nextShortArray(6);
  const rgwFleeRate = prView.nextShortArray(6);
  const rgwPoisonResistance = prView.nextShortArray(6);

  const rgwElementalResistance = [];
  for (let elem = 0; elem < 5; elem++) {
    rgwElementalResistance[elem] = prView.nextShortArray(6);
  }

  prView.skipByte(36); // rgwUnknown2, 3, 4 (3 * 12B = 36B)
  const rgwCoveredBy = prView.nextShortArray(6);

  const rgwMagic = [];
  for (let m = 0; m < 32; m++) {
    rgwMagic[m] = prView.nextShortArray(6);
  }

  const rgwWalkFrames = prView.nextShortArray(6);
  const rgwCooperativeMagic = prView.nextShortArray(6);
  prView.skipByte(24); // rgwUnknown5, 6 (2 * 12B = 24B)
  const rgwDeathSound = prView.nextShortArray(6);
  const rgwAttackSound = prView.nextShortArray(6);
  const rgwWeaponSound = prView.nextShortArray(6);
  const rgwCriticalSound = prView.nextShortArray(6);
  const rgwMagicSound = prView.nextShortArray(6);
  const rgwCoverSound = prView.nextShortArray(6);
  const rgwDyingSound = prView.nextShortArray(6);

  for (let i = 0; i < 6; i++) {
    let role = state.roles[i];
    if (!role) {
      role = { type: 'role', index: i, count: 0 };
      state.roles[i] = role;
    }
    role.avatar = rgwAvatar[i];
    role.spriteNumInBattle = rgwSpriteNumInBattle[i];
    role.spriteNum = rgwSpriteNum[i];
    role.nameId = rgwName[i];
    role.attackAll = rgwAttackAll[i];
    role.level = rgwLevel[i];
    role.maxHp = rgwMaxHP[i];
    role.maxMp = rgwMaxMP[i];
    role.hp = rgwHP[i];
    role.mp = rgwMP[i];

    role.equipments = {};
    for (let part = 0; part < 6; part++) {
      role.equipments[part] = rgwEquipment[part][i];
    }

    role.attackStrength = rgwAttackStrength[i];
    role.magicStrength = rgwMagicStrength[i];
    role.defense = rgwDefense[i];
    role.dexterity = rgwDexterity[i];
    role.fleeRate = rgwFleeRate[i];
    role.poisonResistance = rgwPoisonResistance[i];

    role.elementalResistance = [];
    for (let elem = 0; elem < 5; elem++) {
      role.elementalResistance[elem] = rgwElementalResistance[elem][i];
    }

    role.coveredBy = rgwCoveredBy[i];

    role.magics = [];
    for (let m = 0; m < 32; m++) {
      const magicId = rgwMagic[m][i];
      if (magicId !== 0) {
        role.magics.push(magicId);
      }
    }

    role.cooperativeMagic = rgwCooperativeMagic[i];
    role.deathSound = rgwDeathSound[i];
    role.attackSound = rgwAttackSound[i];
    role.weaponSound = rgwWeaponSound[i];
    role.criticalSound = rgwCriticalSound[i];
    role.magicSound = rgwMagicSound[i];
    role.coverSound = rgwCoverSound[i];
    role.dyingSound = rgwDyingSound[i];
  }

  view.skipByte(320); // rgPoisonStatus (320B)

  // 3. 读取背包道具 rgInventory (256 * 6B)
  const ownItems = [];
  for (let i = 0; i < 256; i++) {
    const wItem = view.nextShort();
    const nAmount = view.nextShort();
    const nAmountInUse = view.nextShort();
    if (wItem !== 0) {
      for (let a = 0; a < nAmount; a++) {
        ownItems.push(wItem);
      }
    }
  }

  // 4. 读取场景配置 rgScene (300 * 8B)
  for (let i = 0; i < 300; i++) {
    const mapId = view.nextShort();
    const enterScriptId = view.nextShort();
    const exitScriptId = view.nextShort();
    const startEventId = view.nextShort();
    if (state.scenes[i + 1]) {
      state.scenes[i + 1].mapId = mapId;
      state.scenes[i + 1].enterScriptId = enterScriptId;
      state.scenes[i + 1].exitScriptId = exitScriptId;
      state.scenes[i + 1].startEventId = startEventId;
    }
  }
  for (let i = 1; i < 300; i++) {
    if (state.scenes[i] && state.scenes[i + 1]) {
      state.scenes[i].endEventId = state.scenes[i + 1].startEventId;
    }
  }

  // 5. 读取基础物品配置 rgObject (600 * 12B)
  for (let i = 0; i < 600; i++) {
    const roleId = view.nextShort();
    const gold = view.nextShort();
    const useScr = view.nextShort();
    const equScr = view.nextShort();
    const dropScr = view.nextShort();
    const flags = view.nextShort();
    if (state.items[i]) {
      state.items[i].roleId = roleId;
      state.items[i].gold = gold;
      state.items[i].useScr = useScr;
      state.items[i].equScr = equScr;
      state.items[i].dropScr = dropScr;
      state.items[i].flags = flags;
    }
  }

  // 6. 读取所有的事件 NPC 物件 rgEventObject (剩余部分)
  const remainingBytes = byteArray.length - view.index;
  const nEventObject = Math.floor(remainingBytes / 32);
  for (let i = 0; i < nEventObject; i++) {
    const sVanishTime = view.nextShort();
    const x = view.nextShort();
    const y = view.nextShort();
    const sLayer = view.nextShort();
    const wTriggerScript = view.nextShort();
    const wAutoScript = view.nextShort();
    const sState = view.nextShort();
    const wTriggerMode = view.nextShort();
    const wSpriteNum = view.nextShort();
    const nSpriteFrames = view.nextShort();
    const wDirection = view.nextShort();
    const wCurrentFrameNum = view.nextShort();
    const nScriptIdleFrame = view.nextShort();
    const wSpritePtrOffset = view.nextShort();
    const nSpriteFramesAuto = view.nextShort();
    const wScriptIdleFrameCountAuto = view.nextShort();

    if (state.eventObjects[i + 1]) {
      state.eventObjects[i + 1].nouse = sVanishTime;
      state.eventObjects[i + 1].x = x;
      state.eventObjects[i + 1].y = y;
      state.eventObjects[i + 1].layer = sLayer;
      state.eventObjects[i + 1].trigScr = wTriggerScript;
      state.eventObjects[i + 1].autoScr = wAutoScript;
      state.eventObjects[i + 1].state = sState;
      state.eventObjects[i + 1].trigMode = wTriggerMode;
      state.eventObjects[i + 1].mgoId = wSpriteNum;
      state.eventObjects[i + 1].frameWalkCount = nSpriteFrames;
      state.eventObjects[i + 1].dir = wDirection;
      state.eventObjects[i + 1].frame = wCurrentFrameNum;
      state.eventObjects[i + 1].idleFrame = nScriptIdleFrame;
      state.eventObjects[i + 1].ptrOffset = wSpritePtrOffset;
      state.eventObjects[i + 1].frameAutoCount = nSpriteFramesAuto;
      state.eventObjects[i + 1].idleFrameCountAuto = wScriptIdleFrameCountAuto;
    }
  }

  // 7. 同步覆盖还原全局 state 的具体核心属性
  state.money = dwCash;
  state.ownItems = ownItems;
  state.party = savedParty;
  state.mapX = wViewportX;
  state.mapY = wViewportY;
  state.mx = Math.floor(wViewportX / 32);
  state.my = Math.floor(wViewportY / 16);
  state.mhalf = Math.round((wViewportX - state.mx * 32) / 16);
  state.sceneId = wNumScene;
  state.chaseRange = wChaseRange;
  state.chasespeedChangeCycles = wChasespeedChangeCycles;
  state.nFollower = nFollower;
  state.roleHistory = []; // 清空移动历史以便起步重新计算

  const scene = state.scenes[wNumScene];
  if (scene) {
    state.mapId = scene.mapId;
    state.startEventId = scene.startEventId;
    state.endEventId = scene.endEventId;
  }
}
