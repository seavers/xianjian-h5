import { state } from './state.js';
import { update } from '../ui/draw.js';
import { Script } from './script.js';

let anims = []; // 注册的动画回调列表
let animIndex = 0; // 纯自增计数器

// 开启定时器。由于速度计算已完全整合至主循环的 accumulator 中进行动态帧率平滑匹配，此处保留空函数以向后兼容
export function updateSpeed() {
  // 变速齿轮调整时，主循环会自动依据 state.frameCount 调整 tick 时间间隔，此处无需操作
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

export function start() {
  update(true); // 立即 update 一次以同步画面
  state.isPaused = false;
}

export function stop() {
  state.isPaused = true;
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
