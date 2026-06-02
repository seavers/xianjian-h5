import { state } from '../engine/state.js';
import { Script } from '../engine/script.js';
import { refreshRoleCount, setRolePos, startEventTrig } from '../engine/command.js';
import { canWalk, update } from './draw.js';
import { ESC } from '../esc/esc.js';

export let blankCallback = null;

// 只有用户点击空格后，执行回调
export function registerBlank(callback) {
  blankCallback = callback;
}

export let bindCallback = null;

export function bind(callback, scope) {
  bindCallback = callback.bind(scope || window);
}

export function unbind() {
  bindCallback = null;
}

// 绑定键盘按下事件
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (ev) => {
    // 步骤 1：如果当前存在注册的交互绑定回调（例如菜单弹窗等），优先处理并直接返回，以免被全局暂停拦截
    if (bindCallback) {
      bindCallback(ev);
      return;
    }

    // 步骤 2：允许在硬暂停或菜单显示状态下，使用特定的系统控制键（如 ESC、E、S）来响应菜单的呼出与关闭
    if (ev.keyCode === 27 || ev.keyCode === 69 || ev.keyCode === 83) {
      switch (ev.keyCode) {
        case 27: { // ESC
          ev.preventDefault();
          ESC.onMenu();
          break;
        }
        case 69: { // E键呼出物品栏
          ev.preventDefault();
          ESC.onItem();
          break;
        }
        case 83: { // S键呼出状态栏
          ev.preventDefault();
          ESC.onStatus();
          break;
        }
      }
      return;
    }

    // 步骤 3：如果当前处于硬暂停（如转场渐变过渡中），直接拦截丢弃键盘输入，禁止后台非法移动
    if (state.isPaused) {
      ev.preventDefault();
      return;
    }

    // 同步判断是否处于脚本并行执行阻塞中
    if (Script.isExec()) {
      if (ev.keyCode !== 32 || !blankCallback) {
        return;
      }
    }

    switch (ev.keyCode) {
      case 32: { // 空格
        ev.preventDefault();
        onBlank();
        break;
      }

      case 37: // 左箭头
      case 74: { // J
        ev.preventDefault();
        onLeft();
        break;
      }
      case 39: // 右箭头
      case 76: { // L
        ev.preventDefault();
        onRight();
        break;
      }
      case 38: // 上箭头
      case 73: { // I
        ev.preventDefault();
        onUp();
        break;
      }
      case 40: // 下箭头
      case 75: { // K
        ev.preventDefault();
        onDown();
        break;
      }
    }
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('touchmove', (ev) => {
    ev.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', (ev) => {
    if (!Script.isExec()) {
      if (!blankCallback) return;
    }

    ev.preventDefault();

    if (blankCallback) {
      const bcb = blankCallback;
      blankCallback = null;
      bcb();
      return;
    }

    const endX = ev.changedTouches[0].pageX;
    const endY = ev.changedTouches[0].pageY;

    if (endX < 160 && endY < 100) {
      onLeft();
    } else if (endX < 160 && endY > 100) {
      onDown();
    } else if (endX > 160 && endY > 100) {
      onRight();
    } else if (endX > 160 && endY < 100) {
      onUp();
    }
  });
}

export function onLeft() {
  let x = state.mx;
  let y = state.my;
  let half = state.mhalf;

  if (half) {
    half = 0;
  } else {
    x--;
    y--;
    half = 1;
  }
  state.roles[0].dir = 1;

  onXY(x, y, half, 1);
}

export function onRight() {
  let x = state.mx;
  let y = state.my;
  let half = state.mhalf;

  if (!half) {
    half = 1;
  } else {
    x++;
    y++;
    half = 0;
  }
  state.roles[0].dir = 3;

  onXY(x, y, half, 3);
}

export function onUp() {
  let x = state.mx;
  let y = state.my;
  let half = state.mhalf;

  if (!half) {
    y--;
    half = 1;
  } else {
    x++;
    half = 0;
  }
  state.roles[0].dir = 2;

  onXY(x, y, half, 2);
}

export function onDown() {
  let x = state.mx;
  let y = state.my;
  let half = state.mhalf;

  if (!half) {
    x--;
    half = 1;
  } else {
    y++;
    half = 0;
  }
  state.roles[0].dir = 0;

  onXY(x, y, half, 0);
}

function onXY(x, y, half, dir) {
  refreshRoleCount(state.roles[0]);

  // 0能走, 1不能走
  if (canWalk(x, y, half) !== 0) {
    return;
  }

  setRolePos(x, y, half);

  const posX = x * 32 + half * 16;
  const posY = y * 16 + half * 8;

  for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
    const o = state.eventObjects[i];
    if (!o || o.state === 0) continue;

    const s = Math.abs(o.x - posX) + Math.abs(o.y - posY) * 2;

    switch (o.trigMode) {
      case 4: // 近距离触发，踩机关
      case 5: // 中距离触发，主要是切换场景
      case 6: // 远距离触发
      case 7: // 远距离触发
        if (s < (o.trigMode - 4) * 32 + 16) {    
          startEventTrig(o);
        }
        break;
    }
  }
}

export function onBlank() {
  if (blankCallback) {
    const bcb = blankCallback;
    blankCallback = null;
    bcb();
    return;
  }

  // 计算主角脚底的像素坐标
  const x = state.mx * 32 + state.mhalf * 16;
  const y = state.my * 16 + state.mhalf * 8;

  // 根据主角朝向计算搜索方向的偏移量
  const dir = state.roles[0].dir;
  const xOffset = (dir === 2 || dir === 3) ? 16 : -16;
  const yOffset = (dir === 0 || dir === 3) ? 8 : -8;

  // 生成 13 个搜索检查点：位置 0 为主角脚下，位置 1-12 沿朝向展开为 4 排每排 3 个
  const checkpoints = [{ x, y }];
  let cx = x, cy = y;
  for (let i = 0; i < 4; i++) {
    checkpoints.push({ x: cx + xOffset, y: cy + yOffset });
    checkpoints.push({ x: cx, y: cy + yOffset * 2 });
    checkpoints.push({ x: cx + 2 * xOffset, y: cy });
    cx += xOffset;
    cy += yOffset;
  }

  // 遍历 13 个检查点，由近到远
  for (let i = 0; i < 13; i++) {
    const cp = checkpoints[i];
    // 将检查点像素坐标转换为瓦片坐标
    const dh = (cp.x % 32) ? 1 : 0;
    const dx = Math.floor(cp.x / 32);
    const dy = Math.floor(cp.y / 16);

    for (let j = state.startEventId + 1; j <= state.endEventId; j++) {
      const o = state.eventObjects[j];
      if (!o || o.state === 0) continue;

      // 只处理 Search 模式（trigMode 1-3），且检查点索引不超过该模式允许的范围
      if (o.trigMode < 1 || o.trigMode > 3 || o.trigMode * 6 - 4 < i) continue;

      // 将事件对象的像素坐标转换为瓦片坐标，精确匹配
      const eh = (o.x % 32) ? 1 : 0;
      const ex = Math.floor(o.x / 32);
      const ey = Math.floor(o.y / 16);

      if (dx === ex && dy === ey && dh === eh) {
        startEventTrig(o);
        return;
      }
    }
  }
}
