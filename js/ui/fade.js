import { state } from '../engine/state.js';
import { renderScreen } from './draw.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 步骤 1：使用纯 async/await 重构高帧率渐变过渡动画执行器，用 for 循环和 sleep 代替 setInterval，代码更加扁平优雅
export async function startFadeTransition(type) {
  const duration = 12;

  // 步骤 1.1：根据渐变类型设定初始帧的半透明遮罩透明度
  if (type === 'fadeOut') {
    state.fadeAlpha = 0;
  } else {
    state.fadeAlpha = 1;
    renderScreen(true); // 淡入时优先绘制一帧全黑，防止穿帮白屏闪烁
  }

  // 步骤 1.2：步进转场定时渲染逻辑（每 30ms 渲染一帧以提供 60fps 般丝滑视觉体验）
  for (let frame = 1; frame <= duration; frame++) {
    await sleep(30);
    
    if (type === 'fadeOut') {
      state.fadeAlpha = frame / duration;
    } else {
      state.fadeAlpha = 1 - frame / duration;
    }
    renderScreen(type === 'fadeIn');
  }

  // 步骤 1.3：转场终点半透明黑色遮罩绝对定位与重绘同步
  if (type === 'fadeOut') {
    state.fadeAlpha = 1;
  } else {
    state.fadeAlpha = 0;
  }
  renderScreen(type === 'fadeIn');
}

// 步骤 2：使用极简的 async/await 定义全屏淡出
export async function fadeOut() {
  await startFadeTransition('fadeOut');
}

// 步骤 3：使用极简的 async/await 定义全屏淡入
export async function fadeIn() {
  await startFadeTransition('fadeIn');
}
