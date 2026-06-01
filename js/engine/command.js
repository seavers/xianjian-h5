import { state } from './state.js';
import { Script } from './script.js';
import { Thread } from './thread.js';
import { Npc } from './anim.js';
import { loadMgoCount } from '../resources/pal.js';
import { update, drawMapAll } from '../ui/draw.js';
import { fadeIn, fadeOut } from '../ui/fade.js';
import { intToShort } from '../utils/number.js';

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
  return Npc.animTeam(state.roles[0], sx, sy, shalf, 4);
}

export function clearWithEffect() {}

export function walkHeroByOffset(dx, dy, layer) {
  // 步骤 1：将传入的无符号短整型平移量 dx, dy 转换为 16 位有符号像素偏移量
  const offsetX = intToShort(dx);
  const offsetY = intToShort(dy);

  // 步骤 2：在当前相机视口像素中心的基础上累加坐标偏移
  state.mapX += offsetX;
  state.mapY += offsetY;

  // 步骤 3：同步更新主角实体的绝对像素位置坐标
  state.roles[0].x = state.mapX;
  state.roles[0].y = state.mapY;

  // 步骤 4：估算计算主角当前对应的瓦片地图网格坐标
  state.mx = Math.floor(state.mapX / 32);
  state.my = Math.floor(state.mapY / 16);
  state.mhalf = Math.round((state.mapX - state.mx * 32) / 16);

  // 步骤 5：如果提供了第三个参数 layer，则将主角的渲染优先级层级同步设定为 layer * 8
  if (layer !== undefined && layer !== null && layer !== 0xFFFF) {
    state.roles[0].layer = layer * 8;
  }

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
  return Npc.anim(this, x, y, half, 3);
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
    // 这里的scriptId - 1 是因为主循环的下一步，是scriptId + 1 然后继续
    Script.next(targetScriptId - 1);
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

export function toggleDayNight(param1) {
  // 步骤 1：反转全局的黑夜调色板标志状态
  state.fNightPalette = !state.fNightPalette;

  // 步骤 2：输出详细的黑夜/白天切换调试日志，说明渐变模式（param1 为 0 代表渐变，非 0 代表立即切换）
  const mode = param1 === 0 ? '渐变平滑过渡' : '立即瞬间切换';
  const status = state.fNightPalette ? '黑夜模式' : '白天常态';

  console.log(`[0x80 toggleDayNight] 切换昼夜调色板, 当前状态: ${status}, 切换模式: ${mode}`);

  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export async function useNightPalette() {
  // 步骤 1：强制将全局昼夜状态变更为黑夜模式 (true)
  state.fNightPalette = true;

  // 步骤 2：输出详细的黑夜调色板生效调试日志，供以后转场特效滤镜渲染使用
  console.log('[0x54 useNightPalette] 强制开启黑夜调色板模式');

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

export function fadeOutScene(fadeOutSpeed) {
  state.needToFadeIn = true;
  state.fadeOutSpeed = fadeOutSpeed;

  // 步骤 2：如果是在非脚本线程环境（例如控制台直接调用），则立即触发切换
  if (!Thread.currentThread) {
    toggleScene();
  }
}

export async function fadeScreen(speed) {
  // 步骤 1：利用 intToShort 将传入 the 无符号短整型 speed 转换为有符号短整型速度 s
  const s = intToShort(speed);
  state.fadeOutSpeed = Math.abs(s);
  state.needToFadeIn = s < 0;

  // 步骤 2：如果是在非脚本线程环境，只更新渐变标记不进行硬挂起
  if (!Thread.currentThread) {
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

  drawMapAll(); // 同步加载与绘制大地图

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
  if (!Thread.currentThread) {
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

export function finishCode() {
  Script.finish(this);
  return 1;
}

export function stopCode() {
  Script.stop();
}

export function changeScript(scriptId, count) {
  if (!count || ++this.scriptIdleFrameCountAuto < count) {
    // 这里确实得使用 -1 ，不然小孩跳绳转不起来
    Script.next(scriptId - 1);
  } else {
    this.scriptIdleFrameCountAuto = 0;
  }
}

export function gotoScript(scriptId) {
  Script.next(scriptId);
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
    Script.next(scriptId);
  }
}

export async function talk(msgId) {
  await window.Talk.drawTalk(msgId); // 异步等待对话框弹出并确认推进完成
}

export async function updateScreen() {
  // 步骤 1：同步清屏和中间层重绘，重绘大地图以更新队伍坐标
  update(true);

  // 步骤 2：增加 80ms 的非阻塞式延迟，以满足剧情或转场时图像更新的视觉停留感要求
  await new Promise(resolve => setTimeout(resolve, 80));
}

export function delayPeriod(time) {
  // 步骤 1：原版延迟为 time * 80 毫秒，我们在 150 毫秒为主循环周期的 H5 引擎中同步换算为对应的帧数 ticks
  // 并且使用 Math.max(1, ...) 保证至少等待一帧以避免同步挂起失效
  const ticks = Math.max(1, Math.round((time * 80) / 150));

  // 步骤 2：输出详细的非阻塞延迟调试日志，辅助追踪时序同步
  console.log(`[0x85 delayPeriod] 剧情等待, 原版毫秒: ${time * 80}ms, H5换算帧数: ${ticks} 帧`);

  return Script.stepProgress(this, ticks);
}

export function updateScreenAndWait(time) {
  if (time == 0) {
    return -1;
  }

  // 返回>0，跳出场景脚本循环，来重绘
  return Script.stepProgress(this, time);
}

export function waitSecond(time) {
  // 原游戏是 80ms * time ，这里一帧150ms
  return Script.stepProgress(this, time / 2);
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

export function showFbp(fbpId, effect) {
  // 步骤 1：在全局状态机中记录当前的 FBP 全屏背景图 ID
  state.currentFbpId = fbpId;

  // 步骤 2：输出详细的展示 FBP 图片调试日志，以供后续结局大图渲染时对接
  console.log(`[0x76 showFbp] 展示全屏剧情背景图 (FBP ID: ${fbpId}, 渐变效果: ${effect})`);

  if (window.onSceneUpdate) {
    window.onSceneUpdate();
  }
}

export async function setRngAnimation(rngId) {
  // 步骤 1：在全局状态机中记录当前准备播放的剧情全屏动画 (RNG) ID
  state.curPlayingRngId = rngId;

  // 步骤 2：输出详细的设定 RNG 动画编号调试日志，为剧情播放预留框架切入
  console.log(`[0x36 setRngAnimation] 设置当前播放剧情动画 (RNG ID: ${rngId})`);
}

export async function playRngAnimation(startFrame, endFrame, speed) {
  // 步骤 1：获取在全局状态机中预先选定的 RNG 动画编号，以及速度和终止帧缺省设定
  const rngId = state.curPlayingRngId || 0;
  const end = endFrame > 0 ? endFrame : startFrame + 60; // 默认模拟播放 60 帧
  const delay = speed > 0 ? speed : 16;

  // 步骤 2：精准估算原版在该动画播放时所消耗的真实物理时间，并输出转场大图调试日志
  const totalFrames = end - startFrame + 1;
  const duration = totalFrames * delay;

  console.log(`[0x37 playRngAnimation] 开始播放剧情大动画 (RNG ID: ${rngId}), 帧范围: [${startFrame}, ${end}], 速度档位: ${delay}, 预估时长: ${duration}ms`);

  // 步骤 3：借助 async/await 协同挂起当前阻塞脚本线程，并在物理等待完毕后回归推进，达成完美的非忙等时序控制
  await new Promise(resolve => setTimeout(resolve, duration));
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
    
    Script.next(failScriptId - 1);
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
scriptCodes[0x09] = { func: updateScreenAndWait, desc: '重绘屏幕并等待' };

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
scriptCodes[0x76] = { func: showFbp, desc: '展示全屏剧情背景图' };
scriptCodes[0x77] = { func: stopMusic, desc: '停止当前背景音乐并淡出' };

scriptCodes[0x36] = { func: setRngAnimation, desc: '设置当前播放剧情动画' };
scriptCodes[0x37] = { func: playRngAnimation, desc: '播放剧情RNG动画' };
scriptCodes[0x3B] = { func: (...args) => window.Talk.talkTips(...args), desc: '显示系统通知 tips' };
scriptCodes[0x3C] = { func: (...args) => window.Talk.talkUp(...args), desc: '在屏幕顶部显示对话' };
scriptCodes[0x3D] = { func: (...args) => window.Talk.talkDown(...args), desc: '在屏幕底部显示对话' };
scriptCodes[0x3E] = { func: (...args) => window.Talk.talkMessage(...args), desc: '显示弹出框信息 alert' };

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
scriptCodes[0x54] = { func: useNightPalette, desc: '切换使用黑夜调色板' };
scriptCodes[0x93] = { func: fadeScreen, desc: '屏幕渐变过渡效果' };
scriptCodes[0x9A] = { func: setMultipleObjectStatus, desc: '批量改变NPC活动生命状态' };
scriptCodes[0x40] = { func: setTrigMode, desc: '设置NPC触发模式' };
scriptCodes[0x85] = { func: delayPeriod, desc: '非阻塞时序延迟' };
scriptCodes[0x4C] = { func: sleepFrame, desc: '阻塞等待特定帧数' };

scriptCodes[0x6D] = { func: setSceneEnterScr, desc: '设置场景进入脚本' };
scriptCodes[0x24] = { func: setNpcAutoScr, desc: '开启NPC自主运动自动脚本' };
scriptCodes[0x25] = { func: setNpcTrigScr, desc: '配置NPC交互触发脚本' };

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
