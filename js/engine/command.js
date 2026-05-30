import { state } from './state.js';
import { Script } from './script.js';
import { Thread } from './thread.js';
import { Npc } from './anim.js';
import { loadMgoCount } from '../resources/pal.js';
import { update, drawMapAll } from '../ui/draw.js';
import { intToShort } from '../utils/number.js';

export function nextRolePos(sx, sy, shalf) {
  state.nextRolePos = [sx, sy, shalf];
}

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
  if (state.roles.length <= roleId) {
    // debugger;
    return ;
  }
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
  // 步骤 1：仅设置活动生命状态，不在此处进行任何同步的指令或异步循环触发，统一交由 mainLoop 调度
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
  if (loadMgoCount(this.mgoId) < 12) {
    this.frame = dir;
  } else {
    this.dir = dir;
    refreshRoleCount(this);
  }
}

export function setNpcPos(objId, dx, dy) {
  const obj = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!obj) return;

  obj.x = state.roles[0].x + intToShort(dx);
  obj.y = state.roles[0].y + intToShort(dy);
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

export function npcWalk2(x, y, half) {
  return Npc.anim(this, x, y, half, 6);
}

export function npcWalk3(x, y, half) {
  return Npc.anim(this, x, y, half, 2);
}

export function teamWalk(x, y, half) {
  return Npc.animTeam(this, x, y, half, 2);
}

export function teamWalk2(x, y, half) {
  return Npc.animTeam(this, x, y, half, 4);
}

export function teamWalk3(x, y, half) {
  return Npc.animTeam(this, x, y, half, 6);
}

export function teamWalk4(x, y, half) {
  return Npc.animTeam(this, x, y, half, 8);
}

export function faceNpcTrig(objId, dist, targetScriptId) {
  const o = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!o) return;

  const player = state.roles[0];
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
    Script.next(targetScriptId);
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
  const thread = Thread.currentThread;
  if (thread) {
    thread.stop();
  }
}

export function moveViewport(dx, dy, frameCount) {
  // 步骤 1：若首参数和次参数均为 0，代表需要恢复视口对焦中心为主角位置，使其正常对焦
  if (dx === 0 && dy === 0) {
    state.mapX = state.roles[0].x;
    state.mapY = state.roles[0].y;
    
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

  return Script.stepProgress(this, frameCount, () => {
    state.mapX += speedX;
    state.mapY += speedY;

    if (window.onSceneUpdate) {
      window.onSceneUpdate();
    }
  });
}

export function setSceneEnterScr(sceneId, enterScriptId) {
  const scene = state.scenes[sceneId];
  scene.enterScriptId = enterScriptId;
}

export function setNpcAutoScr(objId, autoScr) {
  const obj = objId === 0xFFFF ? this : state.eventObjects[objId];
  if (!obj) return;
  // obj.autoScr = autoScr;
  // Script.startAutoScript(obj);
  // if (obj.thread) {
  //   obj.thread.scriptId = autoScr;
  //   obj.thread.reset();
  // }

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

export function fadeOutScene(fadeOutSpeed) {
  state.needToFadeIn = true;
  state.fadeOutSpeed = fadeOutSpeed;

  // 步骤 2：如果是在非脚本线程环境（例如控制台直接调用），则立即触发切换
  if (!Thread.currentThread) {
    toggleScene();
  }
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

  if (state.nextRolePos) {
    setRolePos(state.nextRolePos[0], state.nextRolePos[1], state.nextRolePos[2]);
    state.nextRolePos = null;
  }


  drawMapAll(); // 同步加载与绘制大地图
  update(true); // 重绘画面

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
  if (!Thread.currentThread) {
    const targetSceneId = state.nextSceneId;
    if (targetSceneId !== undefined && targetSceneId !== null && targetSceneId !== -1 && targetSceneId !== state.sceneId) {
      state.nextSceneId = -1;
      const needFade = state.needToFadeIn;
      state.needToFadeIn = false;

      if (needFade) {
        state.isPaused = true;
        update('fadeOut', () => {
          performToggleScene(targetSceneId);
          update('fadeIn', () => {
            state.isPaused = false;
          });
        });
      } else {
        performToggleScene(targetSceneId);
      }
    }
  }
}

export function finishCode() {
  Script.finish(this);
}

export function stopCode() {
  Script.stop();
}

export function changeScript(scriptId, count) {
  if (!count || ++this.scriptIdleFrameCountAuto < count) {
    Script.next(scriptId - 1);
  } else {
    this.scriptIdleFrameCountAuto = 0;
  }
}

export function gotoScript(scriptId) {
  Script.next(scriptId - 1);
}

export function subScript(scriptId) {
  Script.sub(scriptId - 1);
}

export function randomScript(base, scriptId) {
  if (Math.random() * 100 > base) {
    Script.next(scriptId - 1);
  }
}

export function talk(msgId) {
  window.Talk.drawTalk(msgId); // 绝对同步的对话框弹出
}

export function updateScreen() {
  update(); // 同步清屏和中间层重绘
}

export function updateScreenAndWait(time) {
  update();
  return Script.stepProgress(this, time);
}

export function waitSecond(time) {
  return Script.stepProgress(this, time * 6);
}

export function sleepFrame(frameCount, speed) {
  return Script.stepProgress(this, frameCount * speed);
}

export function checkTalk() {
  console.log('global checkTalk');
}

export function setMusic() {
  // 背景音乐播放桩，暂未支持音频播放
}

export function setFightMusic() {
  // 战斗音乐播放桩，暂未支持音频播放
}

export function stopMusic(fadeTime) {
  // 步骤 1：若淡出时间参数为 0，默认为 2 秒淡出，否则按参数乘 3 换算为秒数
  const seconds = fadeTime === 0 ? 2 : fadeTime * 3;

  // 步骤 2：输出详细的停止音乐调试日志，以供后续接入音频框架时参考
  console.log(`[0x77 stopMusic] 停止当前播放背景音乐，淡出时间: ${seconds} 秒`);
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

export function inflictDamage(allEnemies, damage) {
  // 步骤 1：若战斗系统暂未实现，输出详细的伤害调试日志以供追踪意图
  const target = allEnemies ? '全体敌人' : `当前敌人 (ID: ${this?.id || '未知'})`;

  console.log(`[0x21 inflictDamage] 造成伤害: ${damage}, 目标: ${target}`);
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
scriptCodes[0x46] = { func: nextRolePos, desc: '设置主角/队员瓦片位置' };
scriptCodes[0x65] = { func: setRoleTile, desc: '设置主角/队员形象' };
scriptCodes[0x15] = { func: setRoleIndex, desc: '设置队员动作方向/帧' };
scriptCodes[0x75] = { func: setRoleGroup, desc: '设置组队伙伴' };
scriptCodes[0x77] = { func: stopMusic, desc: '停止当前背景音乐并淡出' };

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
scriptCodes[0x10] = { func: npcWalk2, desc: 'NPC快速移动至坐标' };
scriptCodes[0x11] = { func: npcWalk3, desc: 'NPC慢速移动至坐标' };
scriptCodes[0x12] = { func: setNpcPos, desc: '设置NPC位置' };
scriptCodes[0x13] = { func: setNpcPosAbsolute, desc: '设置NPC绝对像素位置' };
scriptCodes[0x7D] = { func: setNpcMove, desc: 'NPC偏移位置' };
scriptCodes[0x3F] = { func: teamWalk, desc: '队伍慢速骑乘到坐标' };
scriptCodes[0x44] = { func: teamWalk2, desc: '队伍常速骑乘到坐标' };
scriptCodes[0x97] = { func: teamWalk3, desc: '队伍快速骑乘到坐标' };
scriptCodes[0x7A] = { func: teamWalk2, desc: '队伍快速行走至坐标' };
scriptCodes[0x7B] = { func: teamWalk4, desc: '队伍极速行走至坐标' };

scriptCodes[0x59] = { func: setSceneId, desc: '修改切换目的地场景 ID' };
scriptCodes[0x50] = { func: fadeOutScene, desc: '场景淡出' };
scriptCodes[0x40] = { func: setTrigMode, desc: '设置NPC触发模式' };
scriptCodes[0x85] = { func: waitSecond, desc: '非阻塞等待特定秒数' };
scriptCodes[0x4C] = { func: sleepFrame, desc: '阻塞等待特定帧数' };

scriptCodes[0x6D] = { func: setSceneEnterScr, desc: '设置场景进入脚本' };
scriptCodes[0x24] = { func: setNpcAutoScr, desc: '开启NPC自主运动自动脚本' };
scriptCodes[0x25] = { func: setNpcTrigScr, desc: '配置NPC交互触发脚本' };

scriptCodes[0x1E] = { func: setMoney, desc: '金钱数值改变指令' };
scriptCodes[0x1F] = { func: obtain, desc: '添加物品进主角包裹' };
scriptCodes[0x21] = { func: inflictDamage, desc: '对敌人造成伤害' };

scriptCodes[0x6E] = { func: walkHeroByOffset, desc: '主角平移偏移距离' };
scriptCodes[0x14] = { func: setNpcFrame, desc: '设置NPC活动动作帧' };
scriptCodes[0x87] = { func: walkAtPlace, desc: '原地徘徊漫步' };
scriptCodes[0x6F] = { func: replaceObject, desc: '替换并终结脚本实体' };
scriptCodes[0x7F] = { func: moveViewport, desc: '平移或定位镜头视口' };
scriptCodes[0x81] = { func: faceNpcTrig, desc: '面朝NPC触发脚本' };

scriptCodes[0xFFFF] = { func: talk, desc: '展示剧情人物对话框' };
