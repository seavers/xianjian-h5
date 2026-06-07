import { state } from '../engine/state.js';
import { renderScreen } from './draw.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 步骤 1：使用纯 async/await 重构高帧率渐变过渡动画执行器，用 for 循环和 sleep 代替 setInterval，代码更加扁平优雅
export async function startFadeTransition(type, color = '0, 0, 0') {
  state.fadeColor = color;
  const duration = 12;

  // 步骤 1.1：根据渐变类型初始化过渡状态下的画面及遮罩层
  if (type === 'fadeOut') {
    state.fadeAlpha = 0;
  } else {
    // 步骤 1.2：淡入时，先将遮罩透明度临时置 0 并重绘一帧纯净场景图到主 mainCtx 上
    state.fadeAlpha = 0;
    renderScreen(true);

    // 步骤 1.3：紧接着将 fadeAlpha 设为 1，在 talkCtx 上画全黑盖住，准备进行淡入渐变
    state.fadeAlpha = 1;
    renderScreen('fadeIn');
  }

  // 步骤 1.4：步进转场定时渲染逻辑（每 30ms 渲染一帧以提供 60fps 般丝滑视觉体验）
  for (let frame = 1; frame <= duration; frame++) {
    await sleep(30);
    
    if (type === 'fadeOut') {
      state.fadeAlpha = frame / duration;
    } else {
      state.fadeAlpha = 1 - frame / duration;
    }
    renderScreen('fadeIn');
  }

  // 步骤 1.5：转场终点半透明黑色遮罩绝对定位与重绘同步
  if (type === 'fadeOut') {
    state.fadeAlpha = 1;
    // 步骤 1.6：淡出完成时，在 mainCtx 上重绘一次全黑，以便 talkCtx 清理时不闪白
    renderScreen(true);
  } else {
    state.fadeAlpha = 0;
  }
  renderScreen('fadeIn');
}

// 步骤 2：使用极简的 async/await 定义全屏淡出
export async function fadeOut() {
  await startFadeTransition('fadeOut');
}

// 步骤 3：使用极简的 async/await 定义全屏淡入
export async function fadeIn() {
  await startFadeTransition('fadeIn');
}

// 步骤 4：定义全屏淡出至红色 (Game Over 效果)
export async function fadeScreenToRed() {
  await startFadeTransition('fadeOut', '255, 0, 0');
}
