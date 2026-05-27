import { state } from '../engine/state.js';
import { Script } from '../engine/script.js';
import { refreshRoleCount, setRolePos, startEventTrig } from '../engine/command.js';
import { canWalk, update } from './draw.js';

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
document.addEventListener('keydown', (ev) => {
  if (bindCallback) {
    bindCallback(ev);
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

    case 27: { // ESC
      ev.preventDefault();
      import('../esc/esc.js').then(({ ESC }) => {
        ESC.onMenu();
      });
      break;
    }

    case 69: { // E键呼出物品栏
      ev.preventDefault();
      import('../esc/esc.js').then(({ ESC }) => {
        ESC.onItem();
      });
      break;
    }

    case 83: { // S键呼出状态栏
      ev.preventDefault();
      import('../esc/esc.js').then(({ ESC }) => {
        ESC.onStatus();
      });
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
    update();
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

  const x = state.mx;
  const y = state.my;
  const posX = x * 32 + state.mhalf * 16;
  const posY = y * 16 + state.mhalf * 8;

  for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
    const o = state.eventObjects[i];
    if (!o || o.state === 0) continue;

    if (o.trigMode * 6 - 4 < )

    switch (o.trigMode) {
      case 3: // 远距离，按空格
        if (x * 32 + 32 >= o.x && o.x >= x * 32 - 32 &&
            y * 16 + 16 >= o.y && o.y >= y * 16 - 16) {
          startEventTrig(o);
        }
        break;
      case 2: // 中距离，面对面或踩地洞
        if (x * 32 + 32 >= o.x && o.x >= x * 32 - 32 &&
            y * 16 + 16 >= o.y && o.y >= y * 16 - 16) {
          startEventTrig(o);
        }
        break;
      case 1: // 近距离，按空格
        if (x * 32 + 32 >= o.x && o.x >= x * 32 - 32 &&
            y * 16 + 16 >= o.y && o.y >= y * 16 - 16) {
          startEventTrig(o);
        }
        break;
    }
  }
}
