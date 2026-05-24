import { state } from './state.js';
import { Script } from './script.js';
import { Thread } from './thread.js';
import { Timer } from './timer.js';
import { Npc } from './anim.js';
import { loadMgoCount } from '../resources/pal.js';
import { update, drawMapAll } from '../ui/draw.js';

export function setRolePos(sx, sy, shalf) {
  state.mx = sx;
  state.my = sy;
  state.mhalf = shalf;
  calcMap();
}

export function setRoleTile(roleId, tileId, bool) {
  state.roles[roleId].tileId = tileId;
}

export function setRoleIndex(dir, frame, roleId) {
  state.roles[roleId].dir = dir;
  state.roles[roleId].frame = frame;
  state.roles[roleId].count = -1;

  if (dir) {
    refreshRoleCount(state.roles[roleId]);
  }
}

export function calcMap() {
  state.mapX = state.mx * 32 + state.mhalf * 16; // mhalf 则加一半
  state.mapY = state.my * 16 + state.mhalf * 8;

  state.roles[0].x = state.mapX;
  state.roles[0].y = state.mapY;

  update(true); // 同步重绘
  
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function refreshRoleCount(role) {
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

export function setRoleGroup() {}

export function roleWalk(sx, sy, shalf) {
  state.mx = sx;
  state.my = sy;
  state.mhalf = shalf;
  Npc.anim(state.roles[0], sx, sy, shalf, 4);
}

export function clearWithEffect() {}

export function walkHeroByOffset(dx, dy) {
  if (dx <= 65536 / 2) {
    state.mapX += dx;
  } else {
    state.mapX -= 65536 - dx;
  }
  
  if (dy <= 65536 / 2) {
    state.mapY += dy;
  } else {
    state.mapY -= 65536 - dy;
  }

  state.roles[0].x = state.mapX;
  state.roles[0].y = state.mapY;

  state.mx = Math.floor(state.mapX / 32);
  state.my = Math.floor(state.mapY / 16);
  state.mhalf = Math.round((state.mapX - state.mx * 32) / 16);

  refreshRoleCount(state.roles[0]);

  update(true); // 同步重绘
  
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
  if (dir) {
    refreshRoleCount(obj);
  }
}

export function setObjectStatus(objId, stateVal) {
  const obj = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!obj) return;

  obj.state = stateVal;
  if (stateVal === 2) { // 自动触发脚本
    Script.startAutoScript(obj);
  }
}

export function startEventTrig(obj) {
  Script.startTrigScript(obj);
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

export function setEastDir(objId) {
  Script.sleep(2);
}

export function setWestDir(objId) {
  Script.sleep(2);
}

export function setNorthDir(objId) {
  Script.sleep(2);
}

export function setSouthDir(objId) {
  Script.sleep(2);
}

export function setNpcDir(dir) {
  if (loadMgoCount(this.roleId) < 12) {
    this.frame = dir;
  } else {
    this.dir = dir;
    refreshRoleCount(this);
  }
}

export function npcWalk2(x, y, half) {
  Npc.anim(this, x, y, half, 6);
}

export function npcWalk3(x, y, half) {
  Npc.anim(this, x, y, half, 2);
}

export function walkAtPlace() {
  loadFrameCount(this);
  
  // 先无限循环了
  Timer.queue(-1, () => {
    this.frame = (this.frame + 1) % this.frameCount;
  })
}

function loadFrameCount(obj) {
  if (!obj.frameCount) {
    obj.frameCount = loadMgoCount(obj.roleId);
  }
}

export function replaceObject() {
  const thread = Thread.currentThread;
  if (thread) {
    thread.stop();
  }
}

export function setNpcAutoScr(objId, autoScr) {
  const obj = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!obj) return;
  obj.autoScr = autoScr;
  Script.startAutoScript(obj);
}

export function setNpcTrigScr(objId, trigScr) {
  const obj = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!obj) return;
  obj.trigScr = trigScr;
}

export function setNpcFrame(frame) {
  loadFrameCount(this);
  this.frame = frame;

  // 先无限循环了
  Timer.queue(-1, () => {
    this.frame = (this.frame + 1) % this.frameCount;
  })
}

export function setMusic() {}
export function setFightMusic() {}

export function setScene(sceneId) {
  state.nextSceneId = sceneId;
}

export function toggleScene() {
  const scene = state.scenes[state.nextSceneId];
  state.mapId = scene.mapId;
  state.startEventId = scene.startEventId;
  state.endEventId = scene.endEventId;

  console.log('切换场景: ' + state.nextSceneId + ' 地图: ' + state.mapId);

  // 清空 Timer 中的全部 anims
  const timerDbg = Timer.DEBUG;
  if (timerDbg && timerDbg.anims) {
    timerDbg.anims.length = 0;
  }

  drawMapAll(); // 同步加载与绘制大地图
  update(true);  // 同步清屏并排序重绘所有实体

  // 同步启动场景脚本
  Script.startScene(scene);
  
  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export function finishCode() {
  Script.finish();
}

export function stopCode() {
  Script.stop();
}

let c = 0;
export function changeScript(scriptId, count) {
  if (c++ <= count) {
    Script.next(scriptId);
  }
}

export function gotoScript(scriptId) {
  Script.next(scriptId);
}

export function subScript(scriptId) {
  Script.sub(scriptId);
}

export function randomScript() {}

export function talk(msgId) {
  window.Talk.drawTalk(msgId); // 绝对同步的对话框弹出
}

export function updateScreen() {
  update(); // 同步清屏和中间层重绘
}

export function updateScreenAndWait(time) {
  Script.sleep(time);
}

export function waitSecond(time) {
  Script.sleep(time);
}

export function checkTalk() {
  console.log('global checkTalk');
}

export function setMoney(add) {
  state.money += add;
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

// 脚本指令集注册表
export const scriptCodes = [];
scriptCodes[0x00] = { func: finishCode, desc: '停止指令' };
scriptCodes[0x01] = { func: stopCode, desc: '停止指令并改写调用地址' };
scriptCodes[0x02] = { func: changeScript, desc: '中断并改写指令' };
scriptCodes[0x03] = { func: gotoScript, desc: '无条件跳转指令' };
scriptCodes[0x04] = { func: subScript, desc: '执行子脚本指令' };
scriptCodes[0x05] = { func: updateScreen, desc: '屏幕重绘指令' };
scriptCodes[0x06] = { func: randomScript, desc: '概率随机分支指令' };

scriptCodes[0x0B] = { func: setSouthDir, desc: '主角/NPC面向南边' };
scriptCodes[0x0C] = { func: setWestDir, desc: '主角/NPC面向西边' };
scriptCodes[0x0D] = { func: setNorthDir, desc: '主角/NPC面向北边' };
scriptCodes[0x0E] = { func: setEastDir, desc: '主角/NPC面向东边' };
scriptCodes[0x0F] = { func: setNpcDir, desc: '设置Npc朝向方向' };

scriptCodes[0x43] = { func: setMusic, desc: '播放背景音乐' };
scriptCodes[0x45] = { func: setFightMusic, desc: '设置战斗背景音乐' };
scriptCodes[0x47] = { func: null, desc: '设置特技音效' };
scriptCodes[0x46] = { func: setRolePos, desc: '设置主角/队员瓦片位置' };
scriptCodes[0x65] = { func: setRoleTile, desc: '设置主角/队员形象' };
scriptCodes[0x15] = { func: setRoleIndex, desc: '设置队员动作方向/帧' };
scriptCodes[0x75] = { func: setRoleGroup, desc: '设置组队伙伴' };

scriptCodes[0x3B] = { func: (...args) => window.Talk.talkTips(...args), desc: '显示系统通知 tips' };
scriptCodes[0x3C] = { func: (...args) => window.Talk.talkUp(...args), desc: '在屏幕顶部显示对话' };
scriptCodes[0x3D] = { func: (...args) => window.Talk.talkDown(...args), desc: '在屏幕底部显示对话' };
scriptCodes[0x3E] = { func: (...args) => window.Talk.talkMessage(...args), desc: '显示弹出框信息 alert' };

scriptCodes[0x09] = { func: updateScreenAndWait, desc: '重绘屏幕并等待' };
scriptCodes[0x16] = { func: setNpcTile, desc: '设置NPC特定形象与朝向' };
scriptCodes[0x8E] = { func: (...args) => window.Talk.clearTalk(...args), desc: '清空/关闭对话框' };
scriptCodes[0x49] = { func: setObjectStatus, desc: '改变NPC活动生命状态' };
scriptCodes[0x70] = { func: roleWalk, desc: '插值移动主角位置' };
scriptCodes[0x73] = { func: clearWithEffect, desc: '动画淡出清除' };

scriptCodes[0x6C] = { func: npcWalk, desc: 'NPC平移偏移距离' };
scriptCodes[0x10] = { func: npcWalk2, desc: 'NPC插值移动至坐标(10)' };
scriptCodes[0x11] = { func: npcWalk3, desc: 'NPC插值移动至坐标(11)' };

scriptCodes[0x59] = { func: setScene, desc: '修改切换目的地场景 ID' };
scriptCodes[0x50] = { func: toggleScene, desc: '执行场景切换' };
scriptCodes[0x40] = { func: setTrigMode, desc: '设置NPC触发模式' };
scriptCodes[0x85] = { func: waitSecond, desc: '等待特定秒数' };

scriptCodes[0x24] = { func: setNpcAutoScr, desc: '开启NPC自主运动自动脚本' };
scriptCodes[0x25] = { func: setNpcTrigScr, desc: '配置NPC交互触发脚本' };

scriptCodes[0x1E] = { func: setMoney, desc: '金钱数值改变指令' };
scriptCodes[0x1F] = { func: obtain, desc: '添加物品进主角包裹' };

scriptCodes[0x6E] = { func: walkHeroByOffset, desc: '主角平移偏移距离' };
scriptCodes[0x14] = { func: setNpcFrame, desc: '设置NPC活动动作帧' };
scriptCodes[0x87] = { func: walkAtPlace, desc: '原地徘徊漫步' };
scriptCodes[0x6F] = { func: replaceObject, desc: '替换并终结脚本实体' };

scriptCodes[0xFFFF] = { func: talk, desc: '展示剧情人物对话框' };
