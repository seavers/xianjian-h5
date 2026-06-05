import { state } from './state.js';
import { Script } from './script.js';
import { Npc } from './anim.js';
import { loadMgoCount } from '../resources/pal.js';
import { update, canWalk } from '../ui/draw.js';
import { fadeIn, fadeOut, fadeScreenToRed } from '../ui/fade.js';
import { intToShort } from '../utils/number.js';
import { loadArchive } from '../esc/archive.js';
import { playRng } from './rng.js';
import { playMusic, stopMusic as stopBgMusic } from '../resources/music.js';
import { playSound } from '../resources/sound.js';

// 获取当前上下文的角色索引，优先匹配 this 或活跃阻塞线程的绑定主体，最后默认为主角 (0)
function getRoleIndex(obj) {
  if (obj && obj.type === 'role') {
    return obj.index;
  }
  const activeObj = Script.activeThread?.obj;
  if (activeObj && activeObj.type === 'role') {
    return activeObj.index;
  }
  return 0;
}

// 统一包装单步动作指令调度，自动识别并分发 auto 漫游和 trigger/scene 阻塞式执行流
// 统一包装单步动作指令调度，在当前指令中 await 循环，直至动作完成，走 stepAutoAndUpdate
export async function stepAction(obj, actionFunc) {
  while (true) {
    const res = actionFunc();
    if (res === 0) {
      break;
    }
    await Script.stepAutoAndUpdate();
    await new Promise(resolve => setTimeout(resolve, 150));
  }
}



export function setRolePos(sx, sy, shalf) {
  state.mx = sx;
  state.my = sy;
  state.mhalf = shalf;
  calcMap();
}

export function setRoleTile(roleId, tileId, bool) {
  if (state.roles[roleId]) {
    state.roles[roleId].tileId = tileId;
  }
}

export function setRoleIndex(dir, frame, roleId) {
  if (state.roles[roleId]) {
    state.roles[roleId].dir = dir;
    state.roles[roleId].frame = frame;
    state.roles[roleId].count = -1;
  }

  // if (dir) {
  //   refreshRoleCount(state.roles[roleId]);
  // }
}

export function calcMap() {
  state.mapX = state.mx * 32 + state.mhalf * 16; // mhalf 则加一半
  state.mapY = state.my * 16 + state.mhalf * 8;

  const leader = state.party[0] || state.roles[0];
  if (leader) {
    leader.x = state.mapX;
    leader.y = state.mapY;
  }

  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function refreshRoleCount(role) {
  role.mgoCount = loadMgoCount(role.mgoId);
  if (role.mgoCount <= 3) {
    return ;
  }

  role.count = role.count === undefined ? -1 : role.count; // 默认为 -1
  const count = role.count++;
  let frame = count === -1 ? 0 : (count % 2 + 1);
  
  switch (role.dir) {
    case 0: // down
      frame += 0;
      break;
    case 1: // left
      frame += 3;
      break;
    case 2: // up
      frame += 6;
      break;
    case 3: // right
      frame += 9;
      break;
  }

  role.frame = frame;
}

export async function roleWalk(sx, sy, shalf) {
  state.mx = sx;
  state.my = sy;
  state.mhalf = shalf;
  return await stepAction(this, () => Npc.animTeam(state.party[0] || state.roles[0], sx, sy, shalf, 4));
}

export async function clearWithEffect(effectType) {
  console.log(`[0x73 clearWithEffect] 重新淡入当前场景, 特效类型: ${effectType}`);
  await fadeIn();
  await update(true);
}

export function setRoleGroup(r1, r2, r3) {
  const ids = [r1, r2, r3].filter(r => r !== 0);
  const newParty = [];
  const leader = state.party[0] || state.roles[0];
  
  if (ids.length === 0) {
    if (state.roles[0]) {
      newParty.push(state.roles[0]);
    }
  } else {
    for (let i = 0; i < ids.length; i++) {
      const roleIndex = ids[i] - 1;
      const exist = state.roles[roleIndex];
      if (exist) {
        newParty.push(exist);
      } else {
        const newRole = {
          type: 'role',
          x: leader ? leader.x : 0,
          y: leader ? leader.y : 0,
          layer: leader ? leader.layer : 0,
          tileId: [2, 3, 7, 5][roleIndex] || 0,
          frame: 0,
          index: roleIndex,
          count: 0
        };
        state.roles[roleIndex] = newRole;
        newParty.push(newRole);
      }
    }
  }
  
  state.party = newParty;
  console.log(`[0x75 setRoleGroup] 更新队伍成员列表，当前队伍角色 Index:`, state.party.map(r => r.index));
  
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function setObjectLayer(param1, layer) {
  const obj = this;
  if (obj) {
    obj.layer = intToShort(layer);
  }
  console.log(`[0x7E setObjectLayer] 设置事件物体图层, 实体: ${obj?.id || '自身'}, 图层值: ${obj?.layer}`);
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function jumpIfNotInZone(targetObjectId, zone, failScriptId) {
  const pCurrent = this;
  if (!pCurrent) return;

  if (targetObjectId <= state.startEventId || targetObjectId > state.endEventId) {
    console.log(`[0x83 jumpIfNotInZone] 目标事件物体 ID ${targetObjectId} 不在当前场景内，跳转至脚本: ${failScriptId}`);
    return failScriptId;
  }

  const pEvtObj = state.eventObjects[targetObjectId];
  if (!pEvtObj) return;

  const dx = pEvtObj.x - pCurrent.x;
  const dy = pEvtObj.y - pCurrent.y;

  const distance = Math.abs(dx) + Math.abs(dy * 2);
  const limit = zone * 32 + 16;

  if (distance >= limit) {
    console.log(`[0x83 jumpIfNotInZone] 目标事件物体 ID ${targetObjectId} 曼哈顿距离为 ${distance}，超出限制 ${limit} (Zone: ${zone})，跳转至脚本: ${failScriptId}`);
    return failScriptId;
  }

  console.log(`[0x83 jumpIfNotInZone] 目标事件物体 ID ${targetObjectId} 曼哈顿距离为 ${distance}，在限制 ${limit} 内，不跳转`);
}

export function placeItemUsedAsObject(targetObjectId, stateVal, failScriptId) {
  const pCurrent = this;
  if (!pCurrent) return;

  if (targetObjectId <= state.startEventId || targetObjectId > state.endEventId) {
    console.log(`[0x84 placeItemUsedAsObject] 目标事件物体 ID ${targetObjectId} 不在当前场景内，跳转至脚本: ${failScriptId}`);
    return failScriptId;
  }

  // 1. 计算主角前方的坐标
  const leader = state.party[0] || state.roles[0];
  let tx = leader ? leader.x : 0;
  let ty = leader ? leader.y : 0;
  const dir = leader ? leader.dir : 0;
  tx += (dir === 1 || dir === 0) ? -16 : 16;
  ty += (dir === 1 || dir === 2) ? -8 : 8;

  // 2. 转换为瓦片坐标，进行障碍检测
  const thalf = (tx % 32) ? 1 : 0;
  const txTile = Math.floor(tx / 32);
  const tyTile = Math.floor(ty / 16);

  if (canWalk(txTile, tyTile, thalf) !== 0) {
    console.log(`[0x84 placeItemUsedAsObject] 主角前方 (瓦片: ${txTile}, ${tyTile}, half: ${thalf}) 存在障碍物，不能放置，跳转至脚本: ${failScriptId}`);
    return failScriptId;
  }

  // 3. 放置当前物体
  pCurrent.x = tx;
  pCurrent.y = ty;
  pCurrent.state = stateVal;

  console.log(`[0x84 placeItemUsedAsObject] 成功放置事件物体，实体 ID: ${pCurrent.id}, 新位置像素: (${tx}, ${ty}), 状态: ${stateVal}`);
  
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function jumpIfCurrentSceneEquals(sceneId, failScriptId) {
  if (state.sceneId === sceneId) {
    console.log(`[0x95 jumpIfCurrentSceneEquals] 当前场景为 ${state.sceneId}，等于 ${sceneId}，跳转至脚本: ${failScriptId}`);
    return failScriptId;
  }
  console.log(`[0x95 jumpIfCurrentSceneEquals] 当前场景为 ${state.sceneId}，不等于 ${sceneId}，不跳转`);
}

export function setFollower(r1, r2) {
  state.party = state.party.filter(r => !r.isFollower);

  const ids = [r1, r2].filter(r => r > 0);
  state.nFollower = ids.length;

  const leader = state.party[0] || state.roles[0];
  for (let i = 0; i < ids.length; i++) {
    const roleId = ids[i] - 1;
    state.party.push({
      type: 'role',
      x: leader ? leader.x : 0,
      y: leader ? leader.y : 0,
      layer: leader ? leader.layer : 0,
      tileId: 0,
      frame: 0,
      index: roleId,
      count: 0,
      isFollower: true
    });
  }

  console.log(`[0x98 setFollower] 更新队伍跟随者，当前队伍全员 Index:`, state.party.map(r => r.index));

  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function changeSceneMap(sceneId, targetMapId) {
  if (sceneId === 0xFFFF) {
    if (state.scenes[state.sceneId]) {
      state.scenes[state.sceneId].mapId = targetMapId;
    }
    state.mapId = targetMapId;
    console.log(`[0x99 changeSceneMap] 修改当前场景（ID: ${state.sceneId}）的地图为: ${targetMapId}`);
  } else {
    if (state.scenes[sceneId]) {
      state.scenes[sceneId].mapId = targetMapId;
    }
    console.log(`[0x99 changeSceneMap] 修改指定场景（ID: ${sceneId}）的地图为: ${targetMapId}`);
  }
  
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export async function fadeToCurrentScene() {
  console.log(`[0x9B fadeToCurrentScene] 执行渐变淡入当前场景`);
  await fadeIn();
  await update(true);
}

export function setPartySamePosition() {
  if (state.party.length <= 1) {
    console.log(`[0xA1 setPartySamePosition] 队伍中只有主角一人，无需重置位置`);
    return;
  }

  const leader = state.party[0] || state.roles[0];
  for (let i = 1; i < state.party.length; i++) {
    const role = state.party[i];
    if (role) {
      role.x = leader.x;
      role.y = leader.y - 1;
      role.layer = leader.layer;
      role.dir = leader.dir;
      role.frame = leader.frame;
    }
  }

  // 步骤 1：重置移动历史轨迹，使其所有点都重合在主角当前坐标上，以实现跟随者重合且随移动逐渐走出
  state.roleHistory = [];
  for (let i = 0; i <= state.party.length; i++) {
    state.roleHistory.push({
      x: leader.x,
      y: leader.y,
      dir: leader.dir,
      frame: leader.frame,
      layer: leader.layer
    });
  }

  console.log(`[0xA1 setPartySamePosition] 队伍所有成员坐标已重置到跟主角重合 (像素: ${leader.x}, ${leader.y - 1})，轨迹已重合`);

  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function skipAutoScript() {
  console.log(`[0xA7 skipAutoScript] 空指令，直接跳过`);
}

export function walkHeroByOffset(dx, dy, layer) {
  // 步骤 1：将传入的无符号短整型平移量 dx, dy 转换为 16 位有符号像素偏移量
  const offsetX = intToShort(dx);
  const offsetY = intToShort(dy);

  // 步骤 2：在当前相机视口像素中心的基础上累加坐标偏移
  state.mapX += offsetX;
  state.mapY += offsetY;

  // 步骤 3：同步更新主角实体的绝对像素位置坐标
  const leader = state.party[0] || state.roles[0];
  if (leader) {
    leader.x = state.mapX;
    leader.y = state.mapY;
  }

  // 步骤 4：估算计算主角当前对应的瓦片地图网格坐标
  state.mx = Math.floor(state.mapX / 32);
  state.my = Math.floor(state.mapY / 16);
  state.mhalf = Math.round((state.mapX - state.mx * 32) / 16);

  // 步骤 5：如果提供了第三个参数 layer，则将主角的渲染优先级层级同步设定为 layer * 8
  if (layer !== undefined && layer !== null && layer !== 0xFFFF) {
    if (leader) {
      leader.layer = layer * 8;
    }
  }

  if (leader) {
    refreshRoleCount(leader);
  }

  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function setNpcTile(objId, dir, frame) {
  const obj = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!obj) return;

  obj.dir = dir;
  obj.frame = frame;
  obj.count = -1; // 重置 count

  // 这里得刷新，不然场景1的8067脚本有问题
  if (dir) {
    refreshRoleCount(obj);
  }
}

export function setObjectStatus(objId, stateVal) {
  const obj = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!obj) return;

  obj.state = stateVal;
  // 步骤 1：仅设置活动生命状态，不在此处进行任何同步的指令或异步循环触发，统一交由 mainLoop 调度
}

export function setMultipleObjectStatus(startObjId, endObjId, stateVal) {
  // 步骤 1：遍历闭区间 [startObjId, endObjId] 的所有事件对象，批量设定它们的活动生命状态值
  for (let i = startObjId; i <= endObjId; i++) {
    const obj = state.eventObjects[i];
    if (obj) {
      obj.state = stateVal;
    }
  }

  // 步骤 2：输出详细的批量设置状态调试日志，以供全局追踪 NPC 生死显示变化
  console.log(`[0x9A setMultipleObjectStatus] 批量设定 NPC 活动生命状态: 区间 [${startObjId}, ${endObjId}], 状态值: ${stateVal}`);
}

export function startEventTrig(obj) {
  // 步骤 1：仅设置下一次需要触发的 trigger 脚本信息，在下一 tick 的中央主循环中安全执行
  state.nextTriggerScriptId = obj.trigScr;
  state.nextTriggerScriptObject = obj;
}

export function setTrigMode(objId, trigMode) {
  const obj = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!obj) return;
  obj.trigMode = trigMode;
}

export function npcWalk(objId, dx, dy) {
  const obj = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!obj) return;

  let x = obj.x;
  let y = obj.y;

  if (dx <= 65536 / 2) {
    x += dx;
  } else {
    x -= 65536 - dx;
  }
  
  if (dy <= 65536 / 2) {
    y += dy;
  } else {
    y -= 65536 - dy;
  }

  obj.x = x;
  obj.y = y;

  Script.sleep(1);
}

function walkOneStep(dir) {
  const obj = this;
  if (!obj) return;

  obj.dir = dir;

  const xOffset = (dir === 1 || dir === 0) ? -4 : 4;
  const yOffset = (dir === 1 || dir === 2) ? -2 : 2;

  obj.x += xOffset;
  obj.y += yOffset;

  if (obj === (state.party[0] || state.roles[0])) {
    state.mapX += xOffset;
    state.mapY += yOffset;
    state.mx = Math.floor(state.mapX / 32);
    state.my = Math.floor(state.mapY / 16);
    state.mhalf = Math.round((state.mapX - state.mx * 32) / 16);
  }

  refreshRoleCount(obj);

  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function setEastDir(objId) {
  walkOneStep.call(this, 3);
}

export function setWestDir(objId) {
  walkOneStep.call(this, 1);
}

export function setNorthDir(objId) {
  walkOneStep.call(this, 2);
}

export function setSouthDir(objId) {
  walkOneStep.call(this, 0);
}

export function setNpcDir(dir) {
  if (loadMgoCount(this.mgoId) < 12) {
    this.frame = dir;
  } else {
    this.dir = dir;
    //refreshRoleCount(this);
  }
}

export function setNpcPos(objId, dx, dy) {
  const obj = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!obj) return;

  const leader = state.party[0] || state.roles[0];
  obj.x = (leader ? leader.x : 0) + intToShort(dx);
  obj.y = (leader ? leader.y : 0) + intToShort(dy);
}

export function setNpcPosAbsolute(objId, x, y) {
  // 步骤 1：若指定实体 ID 为 0 或者是 0xFFFF，代表当前触发此脚本的实体自身，否则指向指定事件对象
  const obj = (objId === 0 || objId === 0xFFFF) ? this : state.eventObjects[objId];
  if (!obj) return;

  // 步骤 2：直接将该实体的坐标设定为指定的 x 和 y 绝对像素坐标
  obj.x = x;
  obj.y = y;
}

export function setNpcMove(objId, dx, dy) {
  const obj = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!obj) return;

  obj.x = obj.x + intToShort(dx);
  obj.y = obj.y + intToShort(dy);
  Script.sleep(1)
}

export async function npcWalk2(x, y, half) {
  return await stepAction(this, () => Npc.anim(this, x, y, half, 3));
}

export async function npcWalk3(x, y, half) {
  return await stepAction(this, () => Npc.anim(this, x, y, half, 2));
}

export async function npcWalk4(x, y, half) {
  // 步骤 1：调用 Npc.anim 使得当前 NPC 移动到指定的目标瓦片坐标，折算实际移动步长为中速 (2)
  return await stepAction(this, () => Npc.anim(this, x, y, half, 2));
}

export async function teamWalk(x, y, half) {
  // 步骤 1：让队长开始行走运动，跟随者会在重绘时自动计算其相对坐标，实现跟随移动
  return await stepAction(this, () => Npc.animTeam(state.party[0] || state.roles[0], x, y, half, 2));
}

export async function teamWalk2(x, y, half) {
  // 步骤 1：让队长开始快速行走运动，跟随者会在重绘时自动计算其相对坐标，实现跟随移动
  return await stepAction(this, () => Npc.animTeam(state.party[0] || state.roles[0], x, y, half, 4));
}

export async function teamWalk3(x, y, half) {
  // 步骤 1：让队长开始中速行走运动，跟随者会在重绘时自动计算其相对坐标，实现跟随移动
  return await stepAction(this, () => Npc.animTeam(state.party[0] || state.roles[0], x, y, half, 6));
}

export async function teamWalk4(x, y, half) {
  // 步骤 1：让队长开始极速行走运动，跟随者会在重绘时自动计算其相对坐标，实现跟随移动
  return await stepAction(this, () => Npc.animTeam(state.party[0] || state.roles[0], x, y, half, 8));
}

export async function teamRide(x, y, half) {
  return await stepAction(this, () => {
    const res1 = Npc.anim(this, x, y, half, 2);
    const res2 = Npc.animTeam(state.party[0] || state.roles[0], x, y, half, 2);
    return res1 || res2;
  });
}

export async function teamRide2(x, y, half) {
  return await stepAction(this, () => {
    const res1 = Npc.anim(this, x, y, half, 4);
    const res2 = Npc.animTeam(state.party[0] || state.roles[0], x, y, half, 4);
    return res1 || res2;
  });
}

export async function teamRide3(x, y, half) {
  return await stepAction(this, () => {
    const res1 = Npc.anim(this, x, y, half, 6);
    const res2 = Npc.animTeam(state.party[0] || state.roles[0], x, y, half, 6);
    return res1 || res2;
  });
}

export async function teamRide4(x, y, half) {
  return await stepAction(this, () => {
    const res1 = Npc.anim(this, x, y, half, 8);
    const res2 = Npc.animTeam(state.party[0] || state.roles[0], x, y, half, 8);
    return res1 || res2;
  });
}

export function faceNpcTrig(objId, dist, targetScriptId) {
  const o = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!o) return;

  const player = state.party[0] || state.roles[0];
  let dx = o.x - player.x;
  let dy = o.y - player.y;

  // 1. 根据主角当前的朝向计算投影偏移量（0下、1左、2上、3右）
  const dir = player.dir;
  dx += (dir === 1 || dir === 0) ? 16 : -16;
  dy += (dir === 1 || dir === 2) ? 8 : -8;

  // 2. 根据 45 度等轴侧投影距离公式判定主角是否面朝并接近该 NPC
  const success = Math.abs(dx) + Math.abs(dy * 2) < dist * 32 + 16;

  // 3. 若面朝条件成立则重置 NPC 的交互触发脚本并启动它；若不满足则跳转至分支脚本地址
  if (success) {
    if(o.trigScr) {
      startEventTrig(o);
    }
  } else {
    // 这里的scriptId - 1 是因为主循环的下一步，是scriptId + 1 然后继续
    return targetScriptId;
  }
}

export function walkAtPlace() {
  loadFrameCount(this);
  
  this.frame = (this.frame + 1) % this.frameCount;
}

function loadFrameCount(obj) {
  if (!obj.frameCount) {
    obj.frameCount = loadMgoCount(obj.mgoId);
  }
}

export function replaceObject() {
  return 0;
}

export async function moveViewport(dx, dy, frameCount) {
  // 步骤 1：若首参数和次参数均为 0，代表需要恢复视口对焦中心为主角位置，使其正常对焦
  if (dx === 0 && dy === 0) {
    const leader = state.party[0] || state.roles[0];
    state.mapX = leader ? leader.x : 0;
    state.mapY = leader ? leader.y : 0;
    
    if (window.onSceneUpdate) {
      window.onSceneUpdate();
    }
    return 0;
  }

  // 步骤 2：若 frameCount 为 0xFFFF，代表立即定位视口到指定的绝对瓦片坐标处
  if (frameCount === 0xFFFF) {
    state.mapX = dx * 32;
    state.mapY = dy * 16;
    
    if (window.onSceneUpdate) {
      window.onSceneUpdate();
    }
    return 0;
  }

  // 步骤 3：否则进入平移动画模式，每逻辑帧以 speedX 和 speedY 偏移量移动视口，总共持续 frameCount 帧
  const speedX = intToShort(dx);
  const speedY = intToShort(dy);

  return await stepAction(this, () => Script.stepProgress(this, frameCount, () => {
    state.mapX += speedX;
    state.mapY += speedY;

    if (window.onSceneUpdate) {
      window.onSceneUpdate();
    }
  }));
}

export function toggleDayNight(param1) {
  // 步骤 1：反转全局的黑夜调色板标志状态
  state.fNightPalette = !state.fNightPalette;

  // 步骤 2：输出详细的黑夜/白天切换调试日志，说明渐变模式（param1 为 0 代表渐变，非 0 代表立即切换）
  const mode = param1 === 0 ? '渐变平滑过渡' : '立即瞬间切换';
  const status = state.fNightPalette ? '黑夜模式' : '白天常态';

  console.log(`[0x80 toggleDayNight] 切换昼夜调色板, 当前状态: ${status}, 切换模式: ${mode}`);
  update(true);

  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export async function useDayPalette() {
  // 步骤 1：强制将全局昼夜状态变更为白天模式 (false)
  state.fNightPalette = false;

  // 步骤 2：输出详细的白天调色板生效调试日志，供滤镜渲染使用
  console.log('[0x53 useDayPalette] 强制开启白天调色板模式');
  update(true);

  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export async function useNightPalette() {
  // 步骤 1：强制将全局昼夜状态变更为黑夜模式 (true)
  state.fNightPalette = true;

  // 步骤 2：输出详细的黑夜调色板生效调试日志，供以后转场特效滤镜渲染使用
  console.log('[0x54 useNightPalette] 强制开启黑夜调色板模式');
  update(true);

  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export async function addMagic(magicId, roleId) {
  // 步骤 1：分析主角索引位置，若 roleId 为 0 代表当前触发脚本的主角 (下标 0)，否则对应 roleId - 1
  const roleIndex = roleId === 0 ? 0 : roleId - 1;
  const role = state.roles[roleIndex];

  // 步骤 2：在目标角色的状态数据中惰性初始化仙术列表，并将新增的仙术 ID 追加习得
  if (role) {
    if (!role.magics) {
      role.magics = [];
    }
    if (!role.magics.includes(magicId)) {
      role.magics.push(magicId);
    }
  }

  // 步骤 3：输出详细的习得仙术调试日志，以利于后续战斗或法术菜单对接
  console.log(`[0x55 addMagic] 角色 (Index: ${roleIndex}) 成功习得新仙术 (仙术 ID: ${magicId})`);

  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export async function removeMagic(magicId, roleId) {
  const roleIndex = roleId === 0 ? 0 : roleId - 1;
  const role = state.roles[roleIndex];

  if (role && role.magics) {
    const idx = role.magics.indexOf(magicId);
    if (idx > -1) {
      role.magics.splice(idx, 1);
    }
  }

  console.log(`[0x56 removeMagic] 角色 (Index: ${roleIndex}) 成功遗忘/移除仙术 (仙术 ID: ${magicId})`);

  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function setMagicBaseDamageByMp(magicId, multiplier) {
  const roleIndex = getRoleIndex(this);
  const role = state.roles[roleIndex];
  
  if (role) {
    if (role.mp === undefined) role.mp = 100;
    const factor = multiplier === 0 ? 8 : multiplier;
    const baseDamage = role.mp * factor;
    
    if (!role.magicBaseDamages) {
      role.magicBaseDamages = {};
    }
    role.magicBaseDamages[magicId] = baseDamage;
    role.mp = 0;
    
    console.log(`[0x57 setMagicBaseDamageByMp] 仙术 ID: ${magicId}, 当前 MP: ${baseDamage / factor}, 乘数: ${factor}, 计算基础伤害: ${baseDamage}, 随后扣除角色 MP 至 0`);
  }
  
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function jumpIfItemAmountLessThan(itemId, amount, failScriptId) {
  const ownedCount = state.ownItems.filter(id => id === itemId).length;
  if (ownedCount < amount) {
    console.log(`[0x58 jumpIfItemAmountLessThan] 背包中物品 ID ${itemId} 的数量为 ${ownedCount}，小于 ${amount}，跳转到脚本: ${failScriptId}`);
    return failScriptId;
  }
  console.log(`[0x58 jumpIfItemAmountLessThan] 背包中物品 ID ${itemId} 的数量为 ${ownedCount}，不少于 ${amount}，不跳转`);
}

export function halvePlayerHp() {
  const roleIndex = getRoleIndex(this);
  const role = state.roles[roleIndex];
  if (role) {
    if (role.hp === undefined) {
      role.hp = 100;
    }
    role.hp = Math.floor(role.hp / 2);
    console.log(`[0x5A halvePlayerHp] 角色 (Index: ${roleIndex}) HP 减半, 减半后 HP: ${role.hp}`);
  }
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function killPlayerImmediately() {
  const roleIndex = getRoleIndex(this);
  const role = state.roles[roleIndex];
  if (role) {
    role.hp = 0;
    console.log(`[0x5F killPlayerImmediately] 角色 (Index: ${roleIndex}) 立即死亡 (HP 设为 0)`);
  }
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function pauseEnemyChase(cycles) {
  state.chasespeedChangeCycles = cycles;
  state.chaseRange = 0;
  console.log(`[0x62 pauseEnemyChase] 敌方停止追击主角, 持续周期: ${cycles}`);
}

export function speedUpEnemyChase(cycles) {
  state.chasespeedChangeCycles = cycles;
  state.chaseRange = 3;
  console.log(`[0x63 speedUpEnemyChase] 敌方加速追击主角, 持续周期: ${cycles}`);
}

export async function changeHpMp(toAll, value) {
  // 步骤 1：利用 intToShort 将传入的无符号短整型 value 转换为 16 位有符号属性改变值
  const changeValue = intToShort(value);

  // 步骤 2：分析影响范围，若 toAll 为真则批量修改全队，否则仅修改当前绑定的角色（默认为 roles[0]）
  const targetRoles = toAll ? state.party : [state.party[0] || state.roles[0]];

  // 步骤 3：遍历目标角色列表，惰性初始化其 HP 与 MP 属性，并进行数值增减
  for (let i = 0; i < targetRoles.length; i++) {
    const role = targetRoles[i];
    if (role) {
      if (role.hp === undefined) {
        role.hp = 100; // 默认满生命值设定为 100
      }
      if (role.mp === undefined) {
        role.mp = 100; // 默认满法力值设定为 100
      }

      role.hp += changeValue;
      role.mp += changeValue;
    }
  }

  // 步骤 4：输出详细的 HP 与 MP 属性改变调试日志
  const scope = toAll ? '全队伙伴' : '主角个人';
  console.log(`[0x1D changeHpMp] 剧情改变角色属性 (${scope}), HP/MP 变动量: ${changeValue}`);

  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function setSceneEnterScr(sceneId, enterScriptId) {
  const scene = state.scenes[sceneId];
  scene.enterScriptId = enterScriptId;
}

export function setNpcAutoScr(objId, autoScr) {
  const obj = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!obj) return;
  obj.autoScr = autoScr;
  Script.setAutoThread(autoScr, obj, 'auto');
}

export function setNpcTrigScr(objId, trigScr) {
  const obj = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!obj) return;
  obj.trigScr = trigScr;
}

export function setNpcFrame(frame) {
  loadFrameCount(this);
  if (this.type == 'npc') {
    this.frame = (this.frame + 1) % this.frameCount;
  } else {
    this.frame = frame;
  }
  this.dir = 0;        // 强制指向南方(0)
}

export function setSceneId(sceneId) {
  // 步骤 1：有些切换场景是先切换再填写ID，或者 0x59 指令本身有参数。只有当参数有效时才更新 nextSceneId
  if (sceneId !== undefined && sceneId !== null && sceneId !== -1) {
    state.nextSceneId = sceneId;
  }
}

export async function fadeOutScene(fadeOutSpeed) {
  state.needToFadeIn = true;
  state.fadeOutSpeed = fadeOutSpeed;

  // 步骤 2：如果是在非脚本线程环境（例如控制台直接调用），则立即触发切换
  if (!Script.isExec()) {
    toggleScene();
  }

  await fadeOut();
}

export async function fadeInScene(speed) {
  // 步骤 1：利用 intToShort 将传入的无符号短整型 speed 转换为有符号短整型，并设定渐变速度
  const s = intToShort(speed);
  state.fadeOutSpeed = s > 0 ? s : 1;
  state.needToFadeIn = false;

  console.log(`[0x51 fadeInScene] 开始淡入当前屏幕，速度: ${state.fadeOutSpeed}`);

  // 步骤 2：使用 await 异步等待淡入效果播放完毕，随后同步进行屏幕绘制更新
  await fadeIn();
  await update(true);
}

export async function fadeScreen(speed) {
  // 步骤 1：利用 intToShort 将传入 the 无符号短整型 speed 转换为有符号短整型速度 s
  const s = intToShort(speed);
  state.fadeOutSpeed = Math.abs(s);
  state.needToFadeIn = s < 0;

  // 步骤 2：如果是在非脚本线程环境，只更新渐变标记不进行硬挂起
  if (!Script.isExec()) {
    return;
  }

  // 步骤 3：将游戏状态置为暂停挂起，并依次 await 播放淡出、淡入的流畅渐变过渡
  state.isPaused = true;

  if (s < 0) {
    // 负数：淡出完后，触发淡入，最后解除挂起以恢复游戏推进
    await fadeOut();
    await fadeIn();
  } else {
    // 正数：直接单向执行淡入，并在结束后解除挂起
    await fadeIn();
  }

  state.isPaused = false;
}

export function performToggleScene(targetSceneId) {
  const scene = state.scenes[targetSceneId];
  if (!scene) {
    console.warn('[performToggleScene] 未能匹配到目标场景配置: ' + targetSceneId);
    return;
  }

  state.sceneId = targetSceneId;
  state.mapId = scene.mapId;
  state.startEventId = scene.startEventId;
  state.endEventId = scene.endEventId;

  console.log('切换场景: ' + targetSceneId + ' 地图: ' + state.mapId);

  // 等脚本都设置好场景中主角位置与形象后，再update
  if(!scene.enterScriptId) {
    update(true); // 重绘画面
  }

  // 同步启动场景脚本
  Script.startScene(scene);
  
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }

  state.nextSceneId = -1;
}

export function toggleScene(sceneId) {
  // 步骤 1：仅设置目标场景 ID，不直接执行切换
  if (sceneId !== undefined && sceneId !== null && sceneId !== -1) {
    state.nextSceneId = sceneId;
  }

  // 步骤 2：如果是在非脚本线程环境（例如控制台或调试面板直接调用），则立即在此执行过渡切换
  if (!Script.isExec()) {
    const targetSceneId = state.nextSceneId;
    if (targetSceneId !== undefined && targetSceneId !== null && targetSceneId !== -1 && targetSceneId !== state.sceneId) {
      state.nextSceneId = -1;
      const needFade = state.needToFadeIn;
      state.needToFadeIn = false;

      if (needFade) {
        state.isPaused = true;
        fadeOut().then(() => {
          performToggleScene(targetSceneId);
          fadeIn().then(() => {
            state.isPaused = false;
          });
        });
      } else {
        performToggleScene(targetSceneId);
      }
    }
  }
}

export function finishCode(param1, param2, param3, thread) {
  Script.finish(this, thread);
}

export function stopCode(param1, param2, param3, thread) {
  Script.stop(undefined, thread);
}

export function changeScript(param1, param2, param3, thread) {
  if (!thread) return;
  const countKey = thread.type === 'auto' ? 'wScriptIdleFrameCountAuto' : 'nScriptIdleFrame';
  if (!thread.obj[countKey]) {
    thread.obj[countKey] = 0;
  }
  if (!param2 || ++thread.obj[countKey] < param2) {
    thread.finish = true;
    thread.scriptId = param1;
  } else {
    thread.obj[countKey] = 0;
    thread.scriptId++;
  }
}

export function gotoScript(scriptId) {
  return scriptId;
}

export async function subScript(scriptId, objId) {
  // 步骤 1：分析第二个参数 objId，若为 0 或者是 0xFFFF 则说明子脚本沿用父线程当前主体 this
  // 否则从全局状态机 state.eventObjects 中获取对应的目标事件实体对象
  let targetObj = undefined;
  if (objId !== undefined && objId !== null && objId !== 0 && objId !== 0xFFFF) {
    targetObj = state.eventObjects[objId];
  }

  // 步骤 2：启动子程序，并传入确定的目标实体对象以满足对象重定向的需求，使用 await 进行阻塞等待
  await Script.sub(scriptId, targetObj);
}

export function randomScript(base, scriptId) {
  if (Math.random() * 100 > base) {
    return scriptId;
  }
}

export function jumpIfObjectState(objId, stateVal, targetScriptId) {
  // 步骤 1：分析第一个参数 objId，若为 0 或者是 0xFFFF 则说明当前操作主体为 this，否则从全局状态机中获取对应的 NPC 事件实体
  const obj = (objId === 0 || objId === 0xFFFF) ? this : state.eventObjects[objId];
  if (!obj) {
    return;
  }

  // 步骤 2：输出详细的跳转条件判定调试日志，辅助时序与脚本流程分析
  console.log(`[0x94 jumpIfObjectState] 判定物体 ID: ${obj.id || '当前'}, 状态: ${obj.state} (期望: ${stateVal}), 目标脚本: ${targetScriptId}`);

  // 步骤 3：若物体的状态满足期望的值，精准跳转至对应脚本分支
  if (obj.state === stateVal) {
    return targetScriptId;
  }
}

export async function talk(msgId) {
  await window.Talk.drawTalk(msgId); // 异步等待对话框弹出并确认推进完成
}

export async function talkTips(msgId) {
  await window.Talk.talkTips(msgId);
}

export async function talkUp(rgmId) {
  await window.Talk.talkUp(rgmId);
}

export async function talkDown(rgmId) {
  await window.Talk.talkDown(rgmId);
}

export async function talkMessage(msgId) {
  await window.Talk.talkMessage(msgId);
}

export async function clearTalk() {
  await window.Talk.clearTalk();
}

export async function updateScreen() {
  state.fadeAlpha = 0;

  // 步骤 1：同步清屏和中间层重绘，重绘大地图以更新队伍坐标
  update(true);

  // 步骤 2：增加 80ms 的非阻塞式延迟，以满足剧情或转场时图像更新的视觉停留感要求
  await new Promise(resolve => setTimeout(resolve, 80));
}

export async function delayPeriod(time) {
  // 步骤 1：原版延迟为 time * 80 毫秒，我们在 150 毫秒为主循环周期的 H5 引擎中同步换算为对应的帧数 ticks
  // 并且使用 Math.max(1, ...) 保证至少等待一帧以避免同步挂起失效
  const ticks = Math.max(1, Math.round((time * 80) / 150));

  // 步骤 2：输出详细的非阻塞延迟调试日志，辅助追踪时序同步
  console.log(`[0x85 delayPeriod] 剧情等待, 原版毫秒: ${time * 80}ms, H5换算帧数: ${ticks} 帧`);

  return await stepAction(this, () => Script.stepProgress(this, ticks));
}

export async function updateScreenAndWait(time) {
  await updateScreen();
  
  if (time == 0) {
    await Script.stepAutoAndUpdate();
    await new Promise(resolve => setTimeout(resolve, 150));
    return;
  }

  // 返回>0，跳出场景脚本循环，来重绘
  return await stepAction(this, () => Script.stepProgress(this, time));
}

export async function waitSecond(time) {
  // 原游戏是 80ms * time ，这里一帧150ms
  return await stepAction(this, () => Script.stepProgress(this, Math.max(1, Math.round(time / 2))));
}

export async function sleepFrame(frameCount, speed) {
  return await stepAction(this, () => Script.stepProgress(this, frameCount * speed));
}

export function checkTalk() {
  console.log('global checkTalk');
}

export function setMusic(musicNum, playFlag) {
  // 步骤 1：在状态机中记录当前背景音乐编号
  state.wNumMusic = musicNum;

  // 步骤 2：解析循环与淡入标志参数 (若 playFlag 不为 1 则循环播放)
  const loop = playFlag !== 1;
  const fadeTime = (playFlag === 3 && musicNum !== 9) ? 3.0 : 0.0;

  // 步骤 3：调用音乐管理模块开始播放音乐
  console.log(`[0x43 setMusic] 播放背景音乐 ID: ${musicNum}, 循环: ${loop}, 渐入时间: ${fadeTime} 秒`);
  playMusic(musicNum, loop, fadeTime);
}

export function setFightMusic(musicNum) {
  // 步骤 1：记录当前设定的战斗背景音乐
  state.wNumBattleMusic = musicNum;
  console.log(`[0x45 setFightMusic] 设置战斗背景音乐 ID: ${musicNum}`);
}

export function playSoundEffect(soundId) {
  // 步骤 1：触发播放特技音效，调用音效模块解析并播放
  console.log(`[0x47 playSoundEffect] 播放特技音效 ID: ${soundId}`);
  playSound(soundId);
}

export function stopMusic(fadeTime) {
  // 步骤 1：若淡出时间参数为 0，默认为 2 秒淡出，否则按参数乘 3 换算为秒数
  const seconds = fadeTime === 0 ? 2 : fadeTime * 3;

  // 步骤 2：停止当前背景音乐并触发渐变淡出
  console.log(`[0x77 stopMusic] 停止当前播放背景音乐，淡出时间: ${seconds} 秒`);
  stopBgMusic(seconds);
}

export function showFbp(fbpId, effect) {
  // 步骤 1：在全局状态机中记录当前的 FBP 全屏背景图 ID
  state.currentFbpId = fbpId;

  // 步骤 2：输出详细的展示 FBP 图片调试日志，以供后续结局大图渲染时对接
  console.log(`[0x76 showFbp] 展示全屏剧情背景图 (FBP ID: ${fbpId}, 渐变效果: ${effect})`);

  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function setBattlefield(battlefieldId) {
  // 步骤 1：在全局状态机中记录当前的战场背景 ID (Battlefield ID)
  state.battlefieldId = battlefieldId;

  // 步骤 2：输出详细的设定战场背景调试日志，为战斗系统初始化预留框架
  console.log(`[0x4A setBattlefield] 设置当前战斗背景 ID: ${battlefieldId}`);
}

export function playEndingSceneAnimation() {
  // 步骤 1：输出调试日志，由于原版 script.c 中此处为 FIXME 空指令占位，我们在 H5 引擎中以空桩形式兼容处理
  console.log('[0x78 playEndingSceneAnimation] 播放结局或过场场景动画桩，此指令在原版中为空操作。');
}

export async function setRngAnimation(rngId) {
  // 步骤 1：在全局状态机中记录当前准备播放的剧情全屏动画 (RNG) ID
  state.curPlayingRngId = rngId;

  // 步骤 2：输出详细的设定 RNG 动画编号调试日志
  console.log(`[0x36 setRngAnimation] 设置当前播放剧情动画 (RNG ID: ${rngId})`);
}

export async function playRngAnimation(startFrame, endFrame, speed) {
  // 步骤 1：获取在全局状态机中预先选定的 RNG 动画编号
  const rngId = state.curPlayingRngId || 0;

  console.log(`[0x37 playRngAnimation] 开始播放剧情大动画 (RNG ID: ${rngId}), 帧范围: [${startFrame}, ${endFrame}], 速度档位: ${speed}`);

  // 步骤 2：调用 playRng 执行真实渲染播放，阻塞主脚本线程，直到播放完毕
  await playRng(rngId, startFrame, endFrame, speed);
}

export function setMoney(add, failScriptId) {
  const change = intToShort(add);
  if (change < 0 && state.money < -change) {
    if (failScriptId) {
      return failScriptId;
    }
  } else {
    state.money += change;
    if (state.money < 0) state.money = 0;
  }
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function obtain(ballId) {
  state.ownItems.push(ballId);
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export async function removeItem(itemId, count, failScriptId) {
  // 步骤 1：若扣除数量为 0，则默认扣除 1 个
  const amount = count === 0 ? 1 : count;

  // 步骤 2：获取背包中当前拥有该物品的总数
  const ownedCount = state.ownItems.filter(id => id === itemId).length;

  // 步骤 3：如果背包数量充足，或者没有指定失败跳转脚本（即 failScriptId 为 0），则直接从背包执行扣除
  if (ownedCount >= amount || !failScriptId) {
    let removed = 0;
    
    // 逆向遍历删除背包中的指定道具
    for (let i = state.ownItems.length - 1; i >= 0; i--) {
      if (state.ownItems[i] === itemId) {
        state.ownItems.splice(i, 1);
        removed++;
        if (removed === amount) {
          break;
        }
      }
    }

    // 步骤 4：由于目前 H5 暂不支持复杂的穿戴装备属性和装备扣除，暂不执行装备栏扣除，直接输出扣除成功的调试日志
    console.log(`[0x20 removeItem] 成功扣除物品 (ID: ${itemId}), 扣除数量: ${removed}/${amount}`);
    
    if (window.onSceneUpdate) {
      window.onSceneUpdate();
    }
  } else {
    // 步骤 5：背包数量不足且提供了失败跳转脚本，则扣除失败，跳转到指定的分支脚本
    console.log(`[0x20 removeItem] 物品数量不足 (拥有: ${ownedCount}, 需扣除: ${amount}), 跳转至分支脚本: ${failScriptId}`);
    
    return failScriptId;
  }
}

export function inflictDamage(allEnemies, damage) {
  // 步骤 1：若战斗系统暂未实现，输出详细的伤害调试日志以供追踪意图
  const target = allEnemies ? '全体敌人' : `当前敌人 (ID: ${this?.id || '未知'})`;

  console.log(`[0x21 inflictDamage] 造成伤害: ${damage}, 目标: ${target}`);
}

export async function startBattle(battleId, failScriptId, fleeScriptId) {
  // 步骤 1：输出战斗启动的详细调试日志，表明当前的战斗 ID 以及对应的跳转分支
  console.log(`[0x07 startBattle] 开始战斗 (Battle ID: ${battleId}, 战败跳转: ${failScriptId}, 逃跑跳转: ${fleeScriptId})`);

  // 步骤 2：使用弹窗提示让用户选择战斗结果，以便支持游戏内的必败剧情或逃跑剧情分支
  let victory = true;
  if (typeof window !== 'undefined' && window.confirm) {
    victory = window.confirm(`[触发战斗 ID: ${battleId}]\n点击【确定】模拟战斗胜利，点击【取消】模拟战斗逃跑/战败。`);
  }

  // 步骤 3：根据选择的结果，若模拟失败/逃跑且对应分支存在，则精准跳转到对应的剧情脚本分支
  if (!victory) {
    if (fleeScriptId) {
      console.log(`[0x07 startBattle] 模拟战斗逃跑，跳转至逃跑分支: ${fleeScriptId}`);
      return fleeScriptId;
    } else if (failScriptId) {
      console.log(`[0x07 startBattle] 模拟战斗战败，跳转至战败分支: ${failScriptId}`);
      return failScriptId;
    }
  } else {
    console.log(`[0x07 startBattle] 模拟战斗胜利，继续后续主线剧情。`);
  }
}

export function replaceEntry(scriptId) {
  //TODO: 待验证
  return scriptId;
}

export async function confirmMenu(failScriptId) {
  let result = true;
  if (typeof window !== 'undefined' && window.confirm) {
    result = window.confirm("是否确定？\n点击【确定】选择是，点击【取消】选择否。");
  }
  if (!result) {
    return failScriptId;
  }
}

export function setPlayerExtraAttribute(partId, statId, value) {
  const roleIndex = getRoleIndex(this);
  const role = state.roles[roleIndex];
  if (role) {
    if (!role.extraAttributes) {
      role.extraAttributes = {};
    }
    const part = partId - 0x0B;
    if (!role.extraAttributes[part]) {
      role.extraAttributes[part] = {};
    }
    role.extraAttributes[part][statId] = value;
  }
  console.log(`[0x17 setPlayerExtraAttribute] 角色 Index: ${roleIndex}, 装备部件: ${partId - 0x0B}, 属性ID: ${statId}, 属性值: ${value}`);
}

export function equipItem(partId, itemId) {
  const roleIndex = getRoleIndex(this);
  const role = state.roles[roleIndex];
  if (role) {
    if (!role.equipments) {
      role.equipments = {};
    }
    const part = partId - 0x0B;
    const oldItem = role.equipments[part];
    if (oldItem && oldItem !== 0) {
      state.ownItems.push(oldItem);
    }
    role.equipments[part] = itemId;
    if (itemId !== 0) {
      const idx = state.ownItems.indexOf(itemId);
      if (idx > -1) {
        state.ownItems.splice(idx, 1);
      }
    }
  }
  console.log(`[0x18 equipItem] 角色 Index: ${roleIndex}, 装备位置: ${partId - 0x0B}, 装备物品 ID: ${itemId}`);
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

const STAT_MAP = {
  6: 'level',
  7: 'maxHp',
  8: 'maxMp',
  9: 'hp',
  10: 'mp',
  17: 'attackStrength',
  18: 'magicStrength',
  19: 'defense',
  20: 'dexterity',
  21: 'fleeRate',
  22: 'poisonResistance'
};

export function increasePlayerAttribute(statId, value, roleId) {
  const roleIndex = roleId === 0 ? getRoleIndex(this) : roleId - 1;
  const role = state.roles[roleIndex];
  if (role) {
    const key = STAT_MAP[statId];
    if (key) {
      if (role[key] === undefined) {
        role[key] = (key === 'hp' || key === 'mp') ? 100 : 10;
      }
      role[key] += intToShort(value);
      if (key === 'hp' && role.hp > (role.maxHp || 100)) role.hp = role.maxHp || 100;
      if (key === 'mp' && role.mp > (role.maxMp || 100)) role.mp = role.maxMp || 100;
      if (role[key] < 0) role[key] = 0;
      console.log(`[0x19 increasePlayerAttribute] 角色 Index: ${roleIndex}, 属性: ${key}, 变动量: ${intToShort(value)}, 新值: ${role[key]}`);
    }
  }
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function setPlayerStat(statId, value, roleId) {
  const roleIndex = roleId === 0 ? getRoleIndex(this) : roleId - 1;
  const role = state.roles[roleIndex];
  if (role) {
    const key = STAT_MAP[statId];
    if (key) {
      role[key] = intToShort(value);
      if (role[key] < 0) role[key] = 0;
      console.log(`[0x1A setPlayerStat] 角色 Index: ${roleIndex}, 属性: ${key}, 设定值: ${role[key]}`);
    }
  }
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function changeHp(toAll, value) {
  const changeValue = intToShort(value);
  const targetRoles = toAll ? state.party : [state.party[0] || state.roles[0]];
  for (let i = 0; i < targetRoles.length; i++) {
    const role = targetRoles[i];
    if (role) {
      if (role.hp === undefined) role.hp = 100;
      if (role.maxHp === undefined) role.maxHp = 100;
      role.hp += changeValue;
      if (role.hp > role.maxHp) role.hp = role.maxHp;
      if (role.hp < 0) role.hp = 0;
    }
  }
  console.log(`[0x1B changeHp] 范围: ${toAll ? '全队' : '主角'}, HP 变动量: ${changeValue}`);
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function changeMp(toAll, value) {
  const changeValue = intToShort(value);
  const targetRoles = toAll ? state.party : [state.party[0] || state.roles[0]];
  for (let i = 0; i < targetRoles.length; i++) {
    const role = targetRoles[i];
    if (role) {
      if (role.mp === undefined) role.mp = 100;
      if (role.maxMp === undefined) role.maxMp = 100;
      role.mp += changeValue;
      if (role.mp > role.maxMp) role.mp = role.maxMp;
      if (role.mp < 0) role.mp = 0;
    }
  }
  console.log(`[0x1C changeMp] 范围: ${toAll ? '全队' : '主角'}, MP 变动量: ${changeValue}`);
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function revivePlayer(toAll, hpPercent) {
  const ratio = hpPercent / 10;
  const targetRoles = toAll ? state.party : [state.party[0] || state.roles[0]];
  let success = false;
  for (let i = 0; i < targetRoles.length; i++) {
    const role = targetRoles[i];
    if (role && role.hp === 0) {
      if (role.maxHp === undefined) role.maxHp = 100;
      role.hp = Math.round(role.maxHp * ratio);
      role.poisons = [];
      role.status = {};
      success = true;
    }
  }
  console.log(`[0x22 revivePlayer] 范围: ${toAll ? '全队' : '主角'}, 恢复HP百分比: ${hpPercent * 10}%, 复活成功: ${success}`);
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function removeEquipment(roleId, partId) {
  const roleIndex = roleId === 0 ? 0 : roleId - 1;
  const role = state.roles[roleIndex];
  if (role && role.equipments) {
    if (partId === 0) {
      for (const part in role.equipments) {
        const itemId = role.equipments[part];
        if (itemId && itemId !== 0) {
          state.ownItems.push(itemId);
          role.equipments[part] = 0;
        }
      }
    } else {
      const part = partId - 1;
      const itemId = role.equipments[part];
      if (itemId && itemId !== 0) {
        state.ownItems.push(itemId);
        role.equipments[part] = 0;
      }
    }
  }
  console.log(`[0x23 removeEquipment] 角色 Index: ${roleIndex}, 卸除装备部位: ${partId === 0 ? '全部' : partId}`);
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function buyMenu(storeId) {
  console.log(`[0x26 buyMenu] 呼出商店买入菜单, 商店ID: ${storeId}`);
}

export function sellMenu() {
  console.log('[0x27 sellMenu] 呼出商店卖出菜单');
}

export function curePoisonByKind(toAll, poisonId) {
  const targetRoles = toAll ? state.party : [state.party[0] || state.roles[0]];
  for (let i = 0; i < targetRoles.length; i++) {
    const role = targetRoles[i];
    if (role && role.poisons) {
      role.poisons = role.poisons.filter(id => id !== poisonId);
    }
  }
  console.log(`[0x2B curePoisonByKind] 解毒范围: ${toAll ? '全队' : '主角'}, 毒素ID: ${poisonId}`);
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function curePoisonByLevel(toAll, maxLevel) {
  const targetRoles = toAll ? state.party : [state.party[0] || state.roles[0]];
  for (let i = 0; i < targetRoles.length; i++) {
    const role = targetRoles[i];
    if (role) {
      role.poisons = [];
    }
  }
  console.log(`[0x2C curePoisonByLevel] 解毒范围: ${toAll ? '全队' : '主角'}, 最大毒素级别: ${maxLevel}`);
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function teleportOut(failScriptId) {
  const scene = state.scenes[state.sceneId];
  if (scene && scene.exitScriptId) {
    Script.start(scene.exitScriptId, state.party[0] || state.roles[0], 'trig');
  } else {
    if (failScriptId) {
      return failScriptId;
    }
  }
  console.log(`[0x38 teleportOut] 执行传送出当前迷宫场景指令, 传送脚本: ${scene?.exitScriptId || '无'}`);
}

export function nullifyObject() {
  const obj = this;
  if (obj) {
    obj.nouse = 15;
  }
  console.log(`[0x4B nullifyObject] 暂时隐蔽事件物体 15 帧, 实体: ${obj?.id || '自身'}`);
}

export function hideEventObject(frames) {
  const obj = this;
  if (obj) {
    obj.state *= -1;
    obj.nouse = frames ? frames : 800;
  }
  console.log(`[0x52 hideEventObject] 隐藏事件物体, 实体: ${obj?.id || '自身'}, 帧数: ${obj?.nouse || 800}`);
}

export async function waitForKey() {
  console.log(`[0x4D waitForKey] 开始等待按键`);
  // await new Promise((resolve) => {
  //   window.Talk.registerTalkResolve(resolve);
  // });
  console.log(`[0x4D waitForKey] 结束等待按键`);
}

export async function loadLastSavedGame(param1, param2, param3, thread) {
  const slotId = state.currentSaveSlot || 1;
  console.log(`[0x4E loadLastSavedGame] 开始重载上一个存档, 槽位: ${slotId}`);
  
  // 1. 淡出屏幕
  await fadeOut();
  
  // 2. 加载存档
  await new Promise((resolve) => {
    loadArchive(slotId, () => {
      setRolePos(state.mx, state.my, state.mhalf);
      resolve();
    });
  });

  // 3. 清空剧情脚本主线程
  Script.activeThread = null;
  if (thread) {
    thread.finish = true;
  }
  
  // 4. 淡入屏幕并刷新渲染
  await fadeIn();
  await update(true);
  
  console.log(`[0x4E loadLastSavedGame] 存档重载完成`);
}

export async function fadeToRed() {
  console.log(`[0x4F fadeToRed] 执行渐变屏幕至红色 (Game Over)`);
  await fadeScreenToRed();
}

export function setPlayerStatus(statusId, rounds) {
  const roleIndex = getRoleIndex(this);
  const role = state.roles[roleIndex];
  if (role) {
    if (!role.status) role.status = {};
    role.status[statusId] = rounds;
  }
  console.log(`[0x2D setPlayerStatus] 角色 Index: ${roleIndex}, 状态ID: ${statusId}, 持续回合: ${rounds}`);
}

export function removePlayerStatus(statusId) {
  const roleIndex = getRoleIndex(this);
  const role = state.roles[roleIndex];
  if (role && role.status) {
    delete role.status[statusId];
  }
  console.log(`[0x2F removePlayerStatus] 角色 Index: ${roleIndex}, 移除状态ID: ${statusId}`);
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

// 脚本指令集注册表
export const scriptCodes = [];
scriptCodes[0x00] = { func: finishCode, desc: '停止指令' };
scriptCodes[0x01] = { func: stopCode, desc: '停止指令并改写调用地址' };
scriptCodes[0x02] = { func: changeScript, desc: '中断并改写指令' };
scriptCodes[0x03] = { func: gotoScript, desc: '无条件跳转指令' };
scriptCodes[0x04] = { func: subScript, desc: '执行子脚本指令' };
scriptCodes[0x05] = { func: updateScreen, desc: '屏幕重绘指令' };
scriptCodes[0x06] = { func: randomScript, desc: '概率随机分支指令' };
scriptCodes[0x07] = { func: startBattle, desc: '触发战斗并处理胜利逃跑分支' };
scriptCodes[0x08] = { func: replaceEntry, desc: '替换交互脚本入口' };
scriptCodes[0x09] = { func: updateScreenAndWait, desc: '重绘屏幕并等待' };
scriptCodes[0x0A] = { func: confirmMenu, desc: '确认菜单选项' };

scriptCodes[0x17] = { func: setPlayerExtraAttribute, desc: '设置主角装备附加属性' };
scriptCodes[0x18] = { func: equipItem, desc: '穿戴装备物品' };
scriptCodes[0x19] = { func: increasePlayerAttribute, desc: '永久增减玩家角色基础属性值' };
scriptCodes[0x1A] = { func: setPlayerStat, desc: '设定玩家角色基础属性值' };
scriptCodes[0x1B] = { func: changeHp, desc: '增减玩家角色HP属性值' };
scriptCodes[0x1C] = { func: changeMp, desc: '增减玩家角色MP属性值' };
scriptCodes[0x22] = { func: revivePlayer, desc: '复活濒死玩家角色' };
scriptCodes[0x23] = { func: removeEquipment, desc: '卸除主角/队员装备' };
scriptCodes[0x26] = { func: buyMenu, desc: '商店买入菜单' };
scriptCodes[0x27] = { func: sellMenu, desc: '商店卖出菜单' };
scriptCodes[0x2B] = { func: curePoisonByKind, desc: '根据毒物ID解玩家毒' };
scriptCodes[0x2C] = { func: curePoisonByLevel, desc: '根据级别解玩家毒' };
scriptCodes[0x2D] = { func: setPlayerStatus, desc: '附加异常状态给角色' };
scriptCodes[0x2F] = { func: removePlayerStatus, desc: '消除角色异常状态' };
scriptCodes[0x38] = { func: teleportOut, desc: '传送出当前迷宫场景' };
scriptCodes[0x4B] = { func: nullifyObject, desc: '暂时隐蔽事件物体15帧' };
scriptCodes[0x4D] = { func: waitForKey, desc: '等待按键' };
scriptCodes[0x4E] = { func: loadLastSavedGame, desc: '重载上一个存档游戏' };
scriptCodes[0x4F] = { func: fadeToRed, desc: '渐变屏幕至红色' };
scriptCodes[0x52] = { func: hideEventObject, desc: '暂时隐藏事件物体' };

scriptCodes[0x0B] = { func: setSouthDir, desc: '主角/NPC面向南边' };
scriptCodes[0x0C] = { func: setWestDir, desc: '主角/NPC面向西边' };
scriptCodes[0x0D] = { func: setNorthDir, desc: '主角/NPC面向北边' };
scriptCodes[0x0E] = { func: setEastDir, desc: '主角/NPC面向东边' };
scriptCodes[0x0F] = { func: setNpcDir, desc: '设置Npc朝向方向' };

scriptCodes[0x43] = { func: setMusic, desc: '播放背景音乐' };
scriptCodes[0x45] = { func: setFightMusic, desc: '设置战斗背景音乐' };
scriptCodes[0x47] = { func: playSoundEffect, desc: '设置特技音效' };
scriptCodes[0x46] = { func: setRolePos, desc: '设置主角/队员瓦片位置' };
scriptCodes[0x65] = { func: setRoleTile, desc: '设置主角/队员形象' };
scriptCodes[0x15] = { func: setRoleIndex, desc: '设置队员动作方向/帧' };
scriptCodes[0x75] = { func: setRoleGroup, desc: '设置组队伙伴' };
scriptCodes[0x76] = { func: showFbp, desc: '展示全屏剧情背景图' };
scriptCodes[0x77] = { func: stopMusic, desc: '停止当前背景音乐并淡出' };
scriptCodes[0x78] = { func: playEndingSceneAnimation, desc: '结局/过场场景动画占位桩' };

scriptCodes[0x36] = { func: setRngAnimation, desc: '设置当前播放剧情动画' };
scriptCodes[0x37] = { func: playRngAnimation, desc: '播放剧情RNG动画' };
scriptCodes[0x3B] = { func: talkTips, desc: '显示系统通知 tips' };
scriptCodes[0x3C] = { func: talkUp, desc: '在屏幕顶部显示对话' };
scriptCodes[0x3D] = { func: talkDown, desc: '在屏幕底部显示对话' };
scriptCodes[0x3E] = { func: talkMessage, desc: '显示弹出框信息 alert' };

scriptCodes[0x16] = { func: setNpcTile, desc: '设置NPC特定形象与朝向' };
scriptCodes[0x8E] = { func: clearTalk, desc: '清空/关闭对话框' };
scriptCodes[0x49] = { func: setObjectStatus, desc: '改变NPC活动生命状态' };
scriptCodes[0x4A] = { func: setBattlefield, desc: '设置当前战斗背景 ID' };
scriptCodes[0x70] = { func: roleWalk, desc: '插值移动主角位置' };
scriptCodes[0x73] = { func: clearWithEffect, desc: '动画淡出清除' };

scriptCodes[0x6C] = { func: npcWalk, desc: 'NPC平移偏移距离' };
scriptCodes[0x10] = { func: npcWalk2, desc: 'NPC快速移动至坐标' };
scriptCodes[0x11] = { func: npcWalk3, desc: 'NPC慢速移动至坐标' };
scriptCodes[0x12] = { func: setNpcPos, desc: '设置NPC位置' };
scriptCodes[0x13] = { func: setNpcPosAbsolute, desc: '设置NPC绝对像素位置' };
scriptCodes[0x7D] = { func: setNpcMove, desc: 'NPC偏移位置' };
scriptCodes[0x7E] = { func: setObjectLayer, desc: '设置事件物体高度层级' };
scriptCodes[0x3F] = { func: teamRide, desc: '队伍慢速骑乘到坐标' };
scriptCodes[0x44] = { func: teamRide2, desc: '队伍常速骑乘到坐标' };
scriptCodes[0x97] = { func: teamRide3, desc: '队伍快速骑乘到坐标' };
scriptCodes[0x98] = { func: setFollower, desc: '设置队伍随行临时跟随者' };
scriptCodes[0x99] = { func: changeSceneMap, desc: '切换指定场景所用地图' };
scriptCodes[0x9B] = { func: fadeToCurrentScene, desc: '屏幕渐变淡入当前场景' };
scriptCodes[0xA1] = { func: setPartySamePosition, desc: '使队伍全员位置和主角李逍遥重合' };
scriptCodes[0xA7] = { func: skipAutoScript, desc: '空指令直接跳过' };
scriptCodes[0x7A] = { func: teamWalk2, desc: '队伍快速行走至坐标' };
scriptCodes[0x7B] = { func: teamWalk4, desc: '队伍极速行走至坐标' };
scriptCodes[0x7C] = { func: npcWalk4, desc: 'NPC以中速行走移动至坐标' };

scriptCodes[0x59] = { func: setSceneId, desc: '修改切换目的地场景 ID' };
scriptCodes[0x50] = { func: fadeOutScene, desc: '场景淡出' };
scriptCodes[0x51] = { func: fadeInScene, desc: '场景淡入' };
scriptCodes[0x53] = { func: useDayPalette, desc: '切换使用白天调色板' };
scriptCodes[0x54] = { func: useNightPalette, desc: '切换使用黑夜调色板' };
scriptCodes[0x55] = { func: addMagic, desc: '使主角/伙伴习得新仙术' };
scriptCodes[0x56] = { func: removeMagic, desc: '移除主角/伙伴的仙术' };
scriptCodes[0x57] = { func: setMagicBaseDamageByMp, desc: '根据当前MP设定仙术基础伤害' };
scriptCodes[0x58] = { func: jumpIfItemAmountLessThan, desc: '若道具持有数量少于特定值则跳转' };
scriptCodes[0x5A] = { func: halvePlayerHp, desc: '角色HP减半' };
scriptCodes[0x5F] = { func: killPlayerImmediately, desc: '使角色立即垂死' };
scriptCodes[0x62] = { func: pauseEnemyChase, desc: '暂停敌人的追击' };
scriptCodes[0x63] = { func: speedUpEnemyChase, desc: '加速敌人的追击' };
scriptCodes[0x93] = { func: fadeScreen, desc: '屏幕渐变过渡效果' };
scriptCodes[0x94] = { func: jumpIfObjectState, desc: '若NPC状态满足条件则跳转' };
scriptCodes[0x95] = { func: jumpIfCurrentSceneEquals, desc: '若当前场景ID等于特定值则跳转' };
scriptCodes[0x9A] = { func: setMultipleObjectStatus, desc: '批量改变NPC活动生命状态' };
scriptCodes[0x40] = { func: setTrigMode, desc: '设置NPC触发模式' };
scriptCodes[0x83] = { func: jumpIfNotInZone, desc: '若事件物体不在当前事件物体特定区域则跳转' };
scriptCodes[0x84] = { func: placeItemUsedAsObject, desc: '放置当前使用道具为事件物体于场景' };
scriptCodes[0x85] = { func: delayPeriod, desc: '非阻塞时序延迟' };
scriptCodes[0x4C] = { func: sleepFrame, desc: '阻塞等待特定帧数' };

scriptCodes[0x6D] = { func: setSceneEnterScr, desc: '设置场景进入脚本' };
scriptCodes[0x24] = { func: setNpcAutoScr, desc: '开启NPC自主运动自动脚本' };
scriptCodes[0x25] = { func: setNpcTrigScr, desc: '配置NPC交互触发脚本' };

scriptCodes[0x1D] = { func: changeHpMp, desc: '增减主角或全队HP与MP' };
scriptCodes[0x1E] = { func: setMoney, desc: '金钱数值改变指令' };
scriptCodes[0x1F] = { func: obtain, desc: '添加物品进主角包裹' };
scriptCodes[0x20] = { func: removeItem, desc: '扣除主角背包里的物品' };
scriptCodes[0x21] = { func: inflictDamage, desc: '对敌人造成伤害' };

scriptCodes[0x6E] = { func: walkHeroByOffset, desc: '主角平移偏移距离' };
scriptCodes[0x14] = { func: setNpcFrame, desc: '设置NPC活动动作帧' };
scriptCodes[0x87] = { func: walkAtPlace, desc: '原地徘徊漫步' };
scriptCodes[0x6F] = { func: replaceObject, desc: '替换并终结脚本实体' };
scriptCodes[0x7F] = { func: moveViewport, desc: '平移或定位镜头视口' };
scriptCodes[0x80] = { func: toggleDayNight, desc: '切换昼夜调色板' };
scriptCodes[0x81] = { func: faceNpcTrig, desc: '面朝NPC触发脚本' };

scriptCodes[0xFFFF] = { func: talk, desc: '展示剧情人物对话框' };
