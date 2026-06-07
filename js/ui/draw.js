import { state } from '../engine/state.js';
import { loadMap, loadGop, loadMgo, loadFon, u9s, u3s, loadFbp } from '../resources/pal.js';

export const updateCount = [0, 0, 0];
let tiles = [];

// 缓存上一次绘制的背景状态
let lastMapId = null;
let lastMapX = null;
let lastMapY = null;
let lastNightPalette = null;

function drawImage(img, x, y, drawContext) {
  if (!img) return;

  const WIDTH = state.WIDTH;
  const HEIGHT = state.HEIGHT;
  const mapX = state.mapX;
  const mapY = state.mapY;

  if (x > mapX - WIDTH && x < mapX + WIDTH && y > mapY - HEIGHT && y < mapY + HEIGHT) {
    const ctx = drawContext || state.contexts.main;
    if (ctx) {
      ctx.drawImage(img, x - mapX + 0xA0, y - mapY + 0x70);
    }
  }
}

// 绘制单字符或文本
export function drawText(word, x, y, drawContext1, color = '#888888', fontSize = 6) {
  const ctx = drawContext1 || state.contexts.main;
  if (!ctx) return;
  ctx.fillStyle = color;
  ctx.font = fontSize + 'px sans-serif';
  ctx.fillText(word, x - state.mapX + 0xA0, y - state.mapY + 0x70);
}

export function drawRect(x, y, drawContext1, color = '#888888') {
  const ctx = drawContext1 || state.contexts.main;
  if (!ctx) return;
  ctx.strokeStyle = color;
  ctx.strokeRect(x - state.mapX + 0xA0, y - state.mapY + 0x70, 16, 16);
}

export function drawCircle(x, y, drawContext1, color = '#888888') {
  const ctx = drawContext1 || state.contexts.main;
  if (!ctx) return;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(x - state.mapX + 0xA0, y - state.mapY + 0x70, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.closePath();
}

export function drawRhombus(x, y, drawContext1, color = '#888888') {
  const ctx = drawContext1 || state.contexts.main;
  if (!ctx) return;
  const cx = x - state.mapX + 0xA0;
  const cy = y - state.mapY + 0x70;

  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx + 16, cy);
  ctx.lineTo(cx, cy + 8);
  ctx.lineTo(cx - 16, cy);
  ctx.lineTo(cx, cy - 8);
  ctx.stroke();
  ctx.closePath();
}

export function drawMapBack() {
  const backCtx = state.contexts.back;
  if (!backCtx) return;

  // 1. 自动脏检查：如果镜头坐标、地图ID、调色板配置都未改变，跳过重绘背景
  if (
    state.mapId === lastMapId &&
    state.mapX === lastMapX &&
    state.mapY === lastMapY &&
    state.fNightPalette === lastNightPalette
  ) {
    return;
  }

  const data = loadMap(state.mapId);
  const mapX = state.mapX;
  const mapY = state.mapY;

  // 2. 视口裁剪：计算当前 320x200 视口对应的 128x128 瓦片范围 (瓦片步长 16px)
  // 向外扩展 1~2 个瓦片进行容错，避免视野边缘露白
  const startX = Math.max(0, Math.floor((mapX - 0xA0) / 16) - 1);
  const endX = Math.min(127, startX + 22);
  
  const startY = Math.max(0, Math.floor((mapY - 0x70) / 16) - 1);
  const endY = Math.min(127, startY + 15);

  // 清除旧的背景
  backCtx.clearRect(0, 0, 320, 200);

  // 3. 局部按需渲染，直接将可视瓦片画入 backCtx 局部视口中
  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const posX = 16 * x;
      const posY = 16 * y + (x % 2 === 0 ? 0 : 8);
      const index = y * 128 + x;

      // 绘制第一层背景瓦片
      const tileId1 = u9s(data, index);
      const img1 = loadGop(state.mapId, tileId1);
      if (img1) {
        backCtx.drawImage(img1, posX - 16 - mapX + 0xA0, posY - 8 - mapY + 0x70);
      }

      // 绘制第二层覆盖瓦片（如有）
      let tileId2 = u9s(data, index, 2);
      tileId2--;
      if (tileId2 !== -1) {
        const img2 = loadGop(state.mapId, tileId2);
        if (img2) {
          backCtx.drawImage(img2, posX - 16 - mapX + 0xA0, posY - 8 - mapY + 0x70);
        }
      }
    }
  }

  // 4. 更新上一次绘制的快照缓存
  lastMapId = state.mapId;
  lastMapX = state.mapX;
  lastMapY = state.mapY;
  lastNightPalette = state.fNightPalette;
}

export function drawEventObject() {
  for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
    const o = state.eventObjects[i];
    if (!o || o.mgoId === 0 || o.nouse !== 0) continue;

    const mgo = loadMgo(o.mgoId, o.frame);
    if (!mgo) continue;
    o.tile = mgo;
    tiles.push(o);
  }
}

export function drawMapFront() {
  const data = loadMap(state.mapId);

  const startY = Math.max(0, state.my - 7);
  const endY = Math.min(127, state.my + 7);
  const startX = Math.max(0, state.mx * 2 - 10);
  const endX = Math.min(127, state.mx * 2 + 10);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const index = y * 128 + x;
      const tileId1 = u9s(data, index);
      let tileId2 = u9s(data, index, 2);
      const zindex = u3s(data, index);
      const zindex2 = u3s(data, index, 2);

      const posX = 16 * x;
      const posY = 16 * y + (x % 2 === 0 ? 0 : 8);

      if (zindex > 0) {
        const img = loadGop(state.mapId, tileId1);
        tiles.push({
          type: 'tile',
          x: posX,
          y: posY,
          layer: zindex,
          tile: img,
          z: 0
        });
      }

      tileId2--;
      if (tileId2 === -1) continue;

      if (zindex2 > 0) {
        const img = loadGop(state.mapId, tileId2);
        tiles.push({
          type: 'tile',
          x: posX,
          y: posY,
          layer: zindex2,
          tile: img,
          z: 1 // 同层级时比较小 z
        });
      }
    }
  }
}

// 根据主角当前的朝向初始化跟随者默认相对位置的轨迹点
function initRoleHistory(leader) {
  state.roleHistory = [];

  let dx = 1;
  let dy = 1;
  switch (leader.dir) {
    case 0: // 下 (South)
      dx = 1;
      dy = -1;
      break;
    case 1: // 左 (West)
      dx = 1;
      dy = 1;
      break;
    case 2: // 上 (North)
      dx = -1;
      dy = 1;
      break;
    case 3: // 右 (East)
      dx = -1;
      dy = -1;
      break;
  }

  // 填充从后往前的历史路径点，使每个跟随者默认位于身后相隔一格瓦片距离的位置
  for (let i = 0; i <= state.party.length; i++) {
    state.roleHistory.push({
      x: leader.x + dx * i * 32,
      y: leader.y + dy * i * 16,
      dir: leader.dir,
      frame: leader.frame,
      layer: leader.layer
    });
  }
}

// 在轨迹历史中获取累计 Y 像素距离为 targetDist 的历史坐标和状态
function getPositionAtDistance(history, targetDist) {
  if (history.length === 0) return null;
  if (history.length === 1) return history[0];

  let accumulatedDist = 0;
  for (let j = 0; j < history.length - 1; j++) {
    const p1 = history[j];
    const p2 = history[j + 1];
    const segmentDist = Math.abs(p1.y - p2.y);

    if (accumulatedDist + segmentDist >= targetDist) {
      const needed = targetDist - accumulatedDist;
      const ratio = segmentDist === 0 ? 0 : needed / segmentDist;
      return {
        x: p1.x + (p2.x - p1.x) * ratio,
        y: p1.y + (p2.y - p1.y) * ratio,
        dir: p2.dir,
        frame: p2.frame,
        layer: p2.layer
      };
    }
    accumulatedDist += segmentDist;
  }
  return history[history.length - 1];
}

export function drawRole() {
  const leader = state.party[0];
  
  // 步骤 1：记录并更新主角移动轨迹，用于跟随者平滑追踪运动
  if (leader) {
    const dist = state.roleHistory.length > 0
      ? Math.abs(leader.x - state.roleHistory[0].x) + Math.abs(leader.y - state.roleHistory[0].y) * 2
      : 0;

    if (state.roleHistory.length === 0 || dist > 64) {
      // 轨迹为空或发生大范围瞬移，重置初始化跟随者轨迹
      initRoleHistory(leader);
    } else if (dist > 0) {
      // 主角移动时，记录新坐标至历史队列头部，并限制最大轨迹缓存长度
      state.roleHistory.unshift({
        x: leader.x,
        y: leader.y,
        dir: leader.dir,
        frame: leader.frame,
        layer: leader.layer
      });
      if (state.roleHistory.length > 200) {
        state.roleHistory.pop();
      }
    } else {
      // 原地未动时，实时同步当前的动画帧、方向与层级
      state.roleHistory[0].dir = leader.dir;
      state.roleHistory[0].frame = leader.frame;
      state.roleHistory[0].layer = leader.layer;
    }
  }

  // 步骤 2：如果有跟随者，根据累计移动的 Y 像素距离从历史轨迹中获取其位置和状态
  if (leader) {
    for (let i = 1; i < state.party.length; i++) {
      const follower = state.party[i];
      if (follower) {
        const targetDist = 16 * i; // 每个跟随者相隔 16 像素 Y 距离（即一格瓦片距离）
        const pos = getPositionAtDistance(state.roleHistory, targetDist);
        if (pos) {
          follower.x = pos.x;
          follower.y = pos.y;
          follower.dir = pos.dir;
          follower.frame = pos.frame;
          follower.layer = pos.layer;
        }
      }
    }
  }

  // 步骤 3：遍历队伍中的所有成员，加载其对应的 MGO 图像并加入渲染队列
  for (let i = 0; i < state.party.length; i++) {
    const role = state.party[i];
    if (role) {
      const roleImg = loadMgo(role.tileId, role.frame);
      if (roleImg) {
        role.tile = roleImg;
        role.type = 'role';
        tiles.push(role);
      }
    }
  }
}

export function drawEventObjectPos() {
  for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
    const o = state.eventObjects[i];
    if (o && o.state > 0) {
      drawText(o.id + '.' + o.state + '.' + o.trigMode + '.' + o.x + '.' + o.y, o.x, o.y);
    }
  }
}

export function drawNpcIdsOnScreen() {
  const onlyHuman = window.ONLY_HUMAN_NPC !== false;
  const onlyVisible = window.ONLY_VISIBLE_NPC === true;
  const onlyHasTrig = window.ONLY_HAS_TRIG_NPC === true;
  for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
    const o = state.eventObjects[i];
    if (o && o.state > 0) {
      if (onlyHuman && o.mgoId === 0) continue;
      if (onlyVisible && o.state === 0) continue;
      if (onlyHasTrig && o.trigScr === 0) continue;
      // 绘制于 NPC 坐标稍微上方，使其清晰易读
      drawText('#' + o.id, o.x, o.y - 12, state.contexts.main, '#ffd700', 7);
    }
  }
}

export function drawMiddle() {
  // 层级核心排序算法
  tiles.sort((a, b) => {
    const al = a.layer > 256 ? a.layer - 65536 : a.layer;
    const bl = b.layer > 256 ? b.layer - 65536 : b.layer;
    return (a.y - b.y) / 8 + (al - bl) || a.y - b.y || ((a.z || 0) - (b.z || 0));
  });

  for (let i = 0; i < tiles.length; i++) {
    const o = tiles[i];
    if (!o.tile) continue; // 防御性判断：若图片资源加载失败，则跳过绘制

    if (o.type === 'tile') {
      drawImage(o.tile, o.x - o.tile.width / 2, o.y - o.tile.height + 7);
    } else if (o.type === 'npc') {
      if (o.state === 1 || o.state === 2) {
        drawImage(o.tile, o.x - o.tile.width / 2, o.y - o.tile.height + 7);
      }
    } else if (o.type === 'role') {
      drawImage(o.tile, o.x - o.tile.width / 2, o.y - o.tile.height + 4);
    }

    // 调试辅助线 TRACE 模式
    if (window.TRACE) {
      drawText(i, o.x, o.y, state.contexts.main);
    }

    // 新增：雷达追踪高亮闪烁效果
    if (state.highlightNpcId && o.id === state.highlightNpcId) {
      const mainCtx = state.contexts.main;
      if (mainCtx) {
        const cx = o.x - state.mapX + 0xA0;
        const cy = o.y - state.mapY + 0x70;
        const time = Date.now();
        const radius = 10 + (time % 800) / 800 * 15;
        const alpha = 1 - (time % 800) / 800;
        
        mainCtx.strokeStyle = `rgba(0, 255, 128, ${alpha})`;
        mainCtx.lineWidth = 2;
        mainCtx.beginPath();
        mainCtx.arc(cx, cy - 8, radius, 0, Math.PI * 2);
        mainCtx.stroke();
        mainCtx.closePath();
      }
    }
  }
}

// 核心屏幕同步重绘逻辑
export function renderScreen(refreshType) {
  const mainCtx = state.contexts.main;
  if (!mainCtx) return;

  // 步骤 2：如果是淡入淡出帧更新，直接在此返回，避免触动底下常规画面
  if (refreshType === 'fadeIn' || refreshType === 'fadeOut') {
    updateFadeInOut();
    updateCount[1]++;
    return ;
  }

  // 步骤 3：如果是战斗模式，常规重绘交由战斗系统的 draw() 完成
  if (state.currentMode === 'battle' && window.Battle && typeof window.Battle.draw === 'function') {
    window.Battle.draw();
    updateCount[1]++;
    return;
  }

  // 步骤 4：根据大地图刷新标记，载入并局部更新大地图背景瓦片
  if (refreshType) {
    updateCount[0]++;
    drawMapBack();
  }

  // 步骤 5：如果当前有 FBP 背景图需要展示，直接在主屏幕绘制 FBP 图像，并跳过后续地图与实体绘制
  if (state.currentFbpId !== undefined && state.currentFbpId !== -1) {
    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
    const fbpImg = loadFbp(state.currentFbpId);
    if (fbpImg) {
      mainCtx.drawImage(fbpImg, 0, 0);
    }
    updateCount[1]++;
    return;
  }

  // 步骤 6：收集并绘制大地图的前景瓦片与所有事件实体、主角及跟随者
  tiles = [];
  drawEventObject();
  drawRole();
  drawMapFront();
  
  mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
  drawMiddle();

  if (window.DEBUG) {
    drawEventArea();
  }
  if (window.TRACE) {
    drawEventObjectPos();
  }
  if (window.SHOW_NPC_ID_ON_SCREEN) {
    drawNpcIdsOnScreen();
  }

  updateCount[1]++;
}

function updateFadeInOut() {
  const startupCtx = state.contexts.startup;
  if (!startupCtx) return;

  // 必须先清空 startup 层，防止半透明遮罩帧叠加
  startupCtx.clearRect(0, 0, startupCtx.canvas.width, startupCtx.canvas.height);

  // 若处于渐变期间，根据当前透明度绘制半透明遮罩
  if (state.fadeAlpha > 0) {
    const color = state.fadeColor || '0, 0, 0';
    startupCtx.fillStyle = `rgba(${color}, ${state.fadeAlpha})`;
    startupCtx.fillRect(0, 0, startupCtx.canvas.width, startupCtx.canvas.height);
    startupCtx.canvas.style.display = 'block';
  }
}

export function update(refreshType, callback) {
  // 普通画面重绘逻辑，直接同步完成
  renderScreen(refreshType);
  if (callback) callback();
}

// 0能走, 1不能走
export function canWalk(x, y, half) {
  const data = loadMap(state.mapId);
  const bool = data.getByte((x * 2 + (half ? 1 : 0) + y * 128) * 4 + 1) & 0x20;
  
  if (!bool) {
    const mx = 32 * x + 16 * half;
    const my = 16 * y + 8 * half;
    for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
      const o = state.eventObjects[i];
      if (o && mx === o.x && my === o.y) {
        if (o.state === 2) {
          return 1;
        }
      }
    }
  }
  return bool;
}

export function drawMenu(drawContext, text, x, y, color) {
  for (let i = 0; i < text.length; i++) {
    const fonId = text.charCodeAt(i);
    const img = loadFon(fonId);
    if (img && drawContext) {
      drawContext.drawImage(img, x + i * 16, y);
    }
  }
}

export function drawCanWalk() {
  const data = loadMap(state.mapId);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const posX = 16 * x;
      const posY = 16 * y + (x % 2 === 0 ? 0 : 8);
      drawText(canWalk(x, y, x % 2), posX, posY);
    }
  }
}

export function drawEventArea() {
  const leader = state.party[0] || state.roles[0];
  if (leader) {
    drawRhombus(leader.x, leader.y);
  }
  for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
    const o = state.eventObjects[i];
    if (o) {
      drawRhombus(o.x, o.y);
    }
  }
}
