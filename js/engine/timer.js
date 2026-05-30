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

  return timer;
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
  // 统一委托至 Script 主循环进行集中时钟推进、脚本调度与渲染
  Script.mainLoop();
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
  clearTimer,
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
