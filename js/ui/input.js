import { state } from '../engine/state.js';
import { Script } from '../engine/script.js';
import { refreshWalkFrame, setRolePos, startEventTrig, adjustDirectionsForSearchTrigger, adjustDirectionsForTouchTrigger } from '../engine/command.js';
import { canWalk, update } from './draw.js';
import { ESC } from '../esc/esc.js';

import { Talk } from './talk.js';

// 保留空函数以维持兼容性，防止其它模块导入失败
export function registerBlank(callback) {}
export function bind(callback, scope) {}
export function unbind() {}

function convertKeyToInput(keyCode) {
  switch (keyCode) {
    case 38: // 上箭头
    case 73: // I
      return 'up';
    case 40: // 下箭头
    case 75: // K
      return 'down';
    case 37: // 左箭头
    case 74: // J
      return 'left';
    case 39: // 右箭头
    case 76: // L
      return 'right';
    case 32: // 空格
    case 13: // 回车
      return 'blank';
    case 27: // ESC
      return 'ESC';
    default:
      // 字母键 A-Z
      if (keyCode >= 65 && keyCode <= 90) {
        return String.fromCharCode(keyCode).toLowerCase();
      }
      return null;
  }
}

// 绑定键盘按下事件
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (ev) => {
    const input = convertKeyToInput(ev.keyCode);
    if (!input) return;

    const mode = state.currentMode;

    // 步骤 0：对话模式下，优先拦截并交由 Talk 模块处理
    if (mode === 'talk') {
      ev.preventDefault();
      Talk.onInput(input);
      return;
    }

    if (mode === 'battle') {
      ev.preventDefault();
      if (window.Battle && window.Battle.onInput) {
        window.Battle.onInput(input);
      }
      return;
    }

    if (mode === 'shop') {
      ev.preventDefault();
      if (window.Shop && window.Shop.onInput) {
        window.Shop.onInput(input);
      }
      return;
    }

    if (mode === 'confirm') {
      ev.preventDefault();
      if (window.Confirm && window.Confirm.onInput) {
        window.Confirm.onInput(input);
      }
      return;
    }

    // 步骤 1：启动或菜单模式，交由 ESC 模块处理
    if (mode === 'startup' || mode === 'esc') {
      ev.preventDefault();
      ESC.onInput(input);
      return;
    }

    // 步骤 3：探索游戏模式，常规按键处理
    if (mode === 'game') {
      handleGameInput(input, ev);
    }
  });
}

function handleGameInput(input, ev) {
  // 步骤 2：如果当前处于硬暂停，丢弃输入
  if (state.isPaused) {
    ev.preventDefault();
    return;
  }

  // 步骤 3：脚本正在运行阻塞中，只允许空格或回车（blank）操作
  if (Script.isExec()) {
    return;
  }

  
  // 步骤 4：常规移动和按键交互分发
  switch (input) {
    // 步骤 1：特殊快捷键激活 ESC 系统模块
    case 'ESC': {
      ev.preventDefault();
      ESC.onMenu();
      break;
    }
    case 'e': {
      ev.preventDefault();
      ESC.onItem();
      break;
    }
    case 's': {
      ev.preventDefault();
      ESC.onStatus();
      break;
    }
    case 'blank': {
      ev.preventDefault();
      onBlank();
      break;
    }
    case 'left': {
      ev.preventDefault();
      onLeft();
      break;
    }
    case 'right': {
      ev.preventDefault();
      onRight();
      break;
    }
    case 'up': {
      ev.preventDefault();
      onUp();
      break;
    }
    case 'down': {
      ev.preventDefault();
      onDown();
      break;
    }
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('touchmove', (ev) => {
    ev.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', (ev) => {
    ev.preventDefault();

    const mode = state.currentMode;

    // 步骤 1：在剧情对话模式期间，点击屏幕任意区域交由 Talk 模块处理
    if (mode === 'talk') {
      Talk.onInput('blank');
      return;
    }

    // 步骤 2：触屏坐标方向转换
    const endX = ev.changedTouches[0].pageX;
    const endY = ev.changedTouches[0].pageY;
    let input = null;

    if (endX < 160 && endY < 100) {
      input = 'left';
    } else if (endX < 160 && endY > 100) {
      input = 'down';
    } else if (endX > 160 && endY > 100) {
      input = 'right';
    } else if (endX > 160 && endY < 100) {
      input = 'up';
    }

    if (!input) return;

    // 步骤 3：分发触屏输入
    if (mode === 'battle') {
      if (window.Battle && window.Battle.onInput) {
        window.Battle.onInput(input);
      }
    } else if (mode === 'startup' || mode === 'esc') {
      ESC.onInput(input);
    } else if (mode === 'game') {
      handleGameInput(input, ev);
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
  if (state.party[0]) {
    state.party[0].dir = 1;
  }

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
  if (state.party[0]) {
    state.party[0].dir = 3;
  }

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
  if (state.party[0]) {
    state.party[0].dir = 2;
  }

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
  if (state.party[0]) {
    state.party[0].dir = 0;
  }

  onXY(x, y, half, 0);
}

function onXY(x, y, half, dir) {
  if (state.party[0]) {
    refreshWalkFrame(state.party[0]);
  }

  // 0能走, 1不能走
  if (canWalk(x, y, half) !== 0) {
    return;
  }

  setRolePos(x, y, half);

  const posX = x * 32 + half * 16;
  const posY = y * 16 + half * 8;

  for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
    const o = state.eventObjects[i];
    if (!o || o.state === 0 || o.nouse !== 0) continue;

    const s = Math.abs(o.x - posX) + Math.abs(o.y - posY) * 2;

    switch (o.trigMode) {
      case 4: // 近距离触发，踩机关
      case 5: // 中距离触发，主要是切换场景
      case 6: // 远距离触发
      case 7: // 远距离触发
      case 8: // 最远距离触发
        if (s < (o.trigMode - 4) * 32 + 16) {    
          const leader = state.party[0] || state.roles[0];
          if (leader) {
            adjustDirectionsForTouchTrigger(leader, o);
          }
          startEventTrig(o);
        }
        break;
    }
  }
}

export function onBlank() {
  // 计算主角脚底的像素坐标
  const x = state.mx * 32 + state.mhalf * 16;
  const y = state.my * 16 + state.mhalf * 8;

  // 根据主角朝向计算搜索方向的偏移量
  const leader = state.party[0] || state.roles[0];
  const dir = leader ? leader.dir : 0;
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
      if (!o || o.state === 0 || o.nouse !== 0) continue;

      // 只处理 Search 模式（trigMode 1-3），且检查点索引不超过该模式允许的范围
      if (o.trigMode < 1 || o.trigMode > 3 || o.trigMode * 6 - 4 < i) continue;

      // 将事件对象的像素坐标转换为瓦片坐标，精确匹配
      const eh = (o.x % 32) ? 1 : 0;
      const ex = Math.floor(o.x / 32);
      const ey = Math.floor(o.y / 16);

      if (dx === ex && dy === ey && dh === eh) {
        const leader = state.party[0] || state.roles[0];
        if (leader) {
          adjustDirectionsForSearchTrigger(leader, o);
        }
        startEventTrig(o);
        return;
      }
    }
  }
}
