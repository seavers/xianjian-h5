import { state } from '../engine/state.js';
import { loadMap, loadGop, loadMgo, loadFon, u9s, u3s } from '../resources/pal.js';

export const updateCount = [0, 0, 0];
let tiles = [];

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

export function drawMapAll() {
  const data = loadMap(state.mapId);
  const mapCtx = state.contexts.map;
  if (!mapCtx) return;

  // 载入离屏大地图层 (128x128 瓦片)
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const posX = 16 * x;
      const posY = 16 * y + (x % 2 === 0 ? 0 : 8);
      const index = y * 128 + x;

      const tileId1 = u9s(data, index);
      const img1 = loadGop(state.mapId, tileId1);
      if (img1) {
        mapCtx.drawImage(img1, posX - 16, posY - 8);
      }

      let tileId2 = u9s(data, index, 2);
      tileId2--;
      if (tileId2 === -1) continue;

      const img2 = loadGop(state.mapId, tileId2);
      if (img2) {
        mapCtx.drawImage(img2, posX - 16, posY - 8);
      }
    }
  }
}

export function drawMapBack() {
  const backCtx = state.contexts.back;
  const mapCtx = state.contexts.map;
  if (!backCtx || !mapCtx) return;

  const offsetX = state.mapX - 0xA0;
  const offsetY = state.mapY - 0x70;

  if (offsetX >= 0 && offsetY >= 0) {
    backCtx.drawImage(mapCtx.canvas, offsetX, offsetY, 320, 200, 0, 0, 320, 200);
  }
}

export function drawEventObject() {
  for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
    const o = state.eventObjects[i];
    if (!o || o.mgoId === 0) continue;

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

export function drawRole() {
  const role = state.roles[0];
  const roleImg = loadMgo(role.tileId, role.frame);
  if (roleImg) {
    role.tile = roleImg;
    tiles.push(role);
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
      drawText(i, o.x, o.y, state.contexts.temp);
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
function renderScreen(refreshBack) {
  const tempCtx = state.contexts.temp;
  const mainCtx = state.contexts.main;
  if (!tempCtx || !mainCtx) return;

  tempCtx.clearRect(0, 0, tempCtx.canvas.width, tempCtx.canvas.height);

  if (refreshBack) {
    updateCount[0]++;
    drawMapBack();
  }

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

  // 步骤 4：绘制全屏渐变半透明黑色遮罩，用于场景淡入淡出过渡
  if (state.fadeAlpha > 0) {
    mainCtx.fillStyle = `rgba(0, 0, 0, ${state.fadeAlpha})`;
    mainCtx.fillRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
  }

  updateCount[1]++;
}

// 执行全屏淡入淡出渐变动画过渡
export function startFadeTransition(type, callback) {
  const duration = 12;
  let frame = 0;

  // 步骤 1：设置起始帧遮罩，根据转场类型决定是否立即同步重绘，确保无白屏延迟
  if (type === 'fadeOut') {
    state.fadeAlpha = 0;
  } else {
    state.fadeAlpha = 1;
    renderScreen(true); // 淡入时同步渲染首帧黑色遮罩，盖住新地图以防穿帮闪烁
  }

  // 步骤 2：开启平滑的本地渲染定时器，每 30ms 步进一次遮罩透明度，消除原本 150ms 帧步进的顿挫感
  const interval = 30;
  const timer = setInterval(() => {
    frame++;
    if (frame <= duration) {
      if (type === 'fadeOut') {
        state.fadeAlpha = frame / duration;
      } else {
        state.fadeAlpha = 1 - frame / duration;
      }
      renderScreen(type === 'fadeIn');
    } else {
      clearInterval(timer);
      if (type === 'fadeOut') {
        state.fadeAlpha = 1;
      } else {
        state.fadeAlpha = 0;
      }
      renderScreen(type === 'fadeIn');

      // 步骤 3：淡入淡出转场结束，执行完成回调以恢复逻辑流程
      if (callback) {
        callback();
      }
    }
  }, interval);
}

export function update(refreshBack, callback) {
  // 步骤 1：检测是否为特殊的淡入淡出过渡指令，是则触发过渡动画，返回 Promise 进行异步挂起
  if (refreshBack === 'fadeOut' || refreshBack === 'fadeIn') {
    return new Promise((resolve) => {
      startFadeTransition(refreshBack, () => {
        if (callback) callback();
        resolve();
      });
    });
  }

  // 步骤 2：普通画面重绘逻辑，直接同步完成
  renderScreen(refreshBack);
  if (callback) callback();
  return Promise.resolve();
}

export function updateTalk() {
  const talkCtx = state.contexts.talk;
  if (talkCtx) {
    talkCtx.clearRect(0, 0, talkCtx.canvas.width, talkCtx.canvas.height);
  }
  updateCount[2]++;
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
  drawRhombus(state.roles[0].x, state.roles[0].y);
  for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
    const o = state.eventObjects[i];
    if (o) {
      drawRhombus(o.x, o.y);
    }
  }
}
