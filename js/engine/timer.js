import { state } from './state.js';
import { update } from '../ui/draw.js';
import { Script } from './script.js';

let anims = []; // 注册的动画回调列表
let animIndex = 0; // 纯自增计数器
let pause = true; // 定时器是否暂停

let intervalId = null;
let currentFrameCount = 6;

// 开启定时器，如果变速齿轮被触发则自动以新速度重启
export function updateSpeed() {
  if (state.frameCount !== currentFrameCount) {
    draw();
  }
}

// 注册定时任务
function setTimer(func) {
  const index = animIndex++;
  anims[index] = func;
  return index;
}

function clearTimer(index) {
  delete anims[index];
}

// 进入队列并执行指定次数
export function queue(total, func, callback, force) {
  const timer = setTimer((c) => {
    if (func) func(c);
    if (c >= total && total !== -1) {
      clearTimer(timer);
      if (force) {
        Timer.stop();
      }
      if (callback) callback();
    }
  });

  if (force) {
    Timer.start();
  }
}

// 主渲染与动画时钟循环
function draw() {
  if (intervalId) {
    clearInterval(intervalId);
  }

  currentFrameCount = state.frameCount || 6;
  
  intervalId = setInterval(() => {
    if (pause) return;
    drawLoop();
  }, 1000 / currentFrameCount);
}

function drawLoop() {
  Script.loop();

  let c = 0;
  for (const key in anims) {
    const func = anims[key];
    if (func) {
      const index = func.index || 0;
      func(index + 1);
      func.index = index + 1;
      c++;
    }
  }
  // 如果有动画在执行，则触发地图及画面绘制重绘
  if (c > 0) {
    update();
  }
}

export function start() {
  update(); // 立即 update 一次以同步画面
  pause = false;
}

export function stop() {
  pause = true;
}

export const Timer = {
  queue,
  start,
  stop,
  updateSpeed,
  get DEBUG() {
    return {
      anims,
      animIndex
    };
  }
};

// 启动底层时钟
draw();
