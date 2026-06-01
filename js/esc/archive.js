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

/**
 * 读档逻辑：优先从 localStorage 加载，如无本地进度则降级从服务端网络下载
 */
export function loadArchive(slotId, callback) {
  const key = `PAL_SAVE_SLOT_${slotId}`;
  const base64Data = localStorage.getItem(key);

  if (base64Data) {
    console.log(`[Archive] 优先从本地 localStorage 发现进度: ${key}`);
    try {
      const buffer = base64ToArrayBuffer(base64Data);
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
}

/**
 * 存档逻辑：按照标准的 DOS 存档格式序列化，并以 Base64 编码形式存入 localStorage
 */
export function saveArchive(slotId) {
  // 步骤 1：初始化一块 183,488 字节的缓冲区块。若有元数据底板则拷贝，以防 H5 未用数据丢失
  const bytes = lastLoadedBuffer ? new Uint8Array(lastLoadedBuffer).slice(0) : new Uint8Array(183488);
  const view = new DataView(bytes.buffer);

  // 步骤 2：写入头部 40 字节元数据
  view.setUint16(0, 1, true); // wSavedTimes
  view.setUint16(2, state.roles[0].x, true); // wViewportX
  view.setUint16(4, state.roles[0].y, true); // wViewportY
  view.setUint16(6, state.roles.length || 1, true); // nPartyMember
  view.setUint16(8, state.sceneId, true); // wNumScene
  view.setUint16(10, state.fNightPalette ? 0x180 : 0, true); // wPaletteOffset
  view.setUint16(12, state.roles[0].dir, true); // wPartyDirection
  view.setUint16(14, 0, true); // wNumMusic
  view.setUint16(16, 0, true); // wNumBattleMusic
  view.setUint16(18, 0, true); // wNumBattleField
  view.setUint16(20, 0, true); // wScreenWave
  view.setUint16(22, 2, true); // wBattleSpeed
  view.setUint16(24, 0, true); // wCollectValue
  view.setUint16(26, Math.floor(state.roles[0].layer / 8), true); // wLayer
  view.setUint16(28, 1, true); // wChaseRange
  view.setUint16(30, 0, true); // wChasespeedChangeCycles
  view.setUint16(32, 0, true); // nFollower
  view.setUint16(34, 0, true); // rgwReserved2[0]
  view.setUint16(36, 0, true); // rgwReserved2[1]
  view.setUint16(38, 0, true); // rgwReserved2[2]

  // 步骤 3：写入金钱数据 (offset 40)
  view.setUint32(40, state.money || 0, true);

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
      view.setUint16(offset + i * 32 + 18, npc.frame, true);
      view.setUint16(offset + i * 32 + 20, npc.dir, true);
      view.setUint16(offset + i * 32 + 22, npc.unknown1, true);
      view.setUint16(offset + i * 32 + 24, npc.unknown2, true);
      view.setUint16(offset + i * 32 + 26, npc.modsRef, true);
      view.setUint16(offset + i * 32 + 28, npc.unknown3, true);
      view.setUint16(offset + i * 32 + 30, npc.unknown4, true);
    } else {
      for (let f = 0; f < 16; f++) {
        view.setUint16(offset + i * 32 + f * 2, 0, true);
      }
    }
  }

  // 步骤 8：序列化为 Base64 并安全持久化至 localStorage
  const base64Data = arrayBufferToBase64(bytes.buffer);
  const key = `PAL_SAVE_SLOT_${slotId}`;
  localStorage.setItem(key, base64Data);

  // 同步更新元数据底板，使得下一次写入在最新基础上叠加
  lastLoadedBuffer = bytes.buffer;
  console.log(`[Archive] 进度槽位 #${slotId} 成功序列化保存至本地 localStorage！`);
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

  // 2. 读取资金，并跳过 rgParty, rgTrail, Exp, PlayerRoles, rgPoisonStatus
  const dwCash = view.nextInt();
  view.skipByte(50); // rgParty (5 * 10B)
  view.skipByte(30); // rgTrail (5 * 6B)
  view.skipByte(384); // Exp (ALLEXPERIENCE: 384B)
  view.skipByte(900); // PlayerRoles (900B)
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
      state.eventObjects[i + 1].frame = nSpriteFrames;
      state.eventObjects[i + 1].dir = wDirection;
      state.eventObjects[i + 1].unknown1 = wCurrentFrameNum;
      state.eventObjects[i + 1].unknown2 = nScriptIdleFrame;
      state.eventObjects[i + 1].modsRef = wSpritePtrOffset;
      state.eventObjects[i + 1].unknown3 = nSpriteFramesAuto;
      state.eventObjects[i + 1].unknown4 = wScriptIdleFrameCountAuto;
    }
  }

  // 7. 同步覆盖还原全局 state 的具体核心属性
  state.money = dwCash;
  state.ownItems = ownItems;
  state.roles[0].x = wViewportX;
  state.roles[0].y = wViewportY;
  state.roles[0].dir = wPartyDirection;
  state.mapX = wViewportX;
  state.mapY = wViewportY;
  state.mx = Math.floor(wViewportX / 32);
  state.my = Math.floor(wViewportY / 16);
  state.mhalf = Math.round((wViewportX - state.mx * 32) / 16);
  state.sceneId = wNumScene;

  const scene = state.scenes[wNumScene];
  if (scene) {
    state.mapId = scene.mapId;
    state.startEventId = scene.startEventId;
    state.endEventId = scene.endEventId;
  }
}
