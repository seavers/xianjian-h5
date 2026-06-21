import { state } from '../engine/state.js';
import { renderScreen } from './draw.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 全屏渐变过渡动画执行器，仅负责设定渐变透明度 fadeAlpha 并刷新屏幕
export async function startFadeTransition(type, speed = 1, color = '0, 0, 0') {
  state.fadeColor = color;
  const duration = 12;
  const sleepTime = 600 * speed / duration;

  // 步骤 1.1：根据渐变类型设定初始帧的黑色遮罩透明度并渲染
  if (type === 'fadeOut') {
    state.fadeAlpha = 0;
  } else {
    state.fadeAlpha = 1;
  }
  renderScreen(type);

  // 步骤 1.2：在过渡期间步进淡入淡出画面
  for (let frame = 1; frame <= duration; frame++) {
    await sleep(sleepTime);

    if (type === 'fadeOut') {
      state.fadeAlpha = frame / duration;
    } else {
      state.fadeAlpha = 1 - frame / duration;
    }
    renderScreen(type);
  }

  // 步骤 1.3：强制设置过渡终态的遮罩透明度并刷新最后一帧
  if (type === 'fadeOut') {
    state.fadeAlpha = 1;
  } else {
    state.fadeAlpha = 0;
  }
  renderScreen(type);
}

// 全屏淡出
export async function fadeOut(speed) {
  state.isPaused = true;
  state.needToFadeIn = true;
  speed = speed || 1;
  await startFadeTransition('fadeOut', speed);
}

// 检查全屏淡出
export async function checkAndFadeOut() {
  if (!state.needToFadeIn) {
    await fadeOut();
  }
}

// 全屏淡入
export async function fadeIn() {
  await startFadeTransition('fadeIn');
  state.needToFadeIn = false;
  state.isPaused = false;
}

// 检查全屏淡入
export async function checkAndFadeIn() {
  if (state.needToFadeIn) {
    await fadeIn();
  }
}

// 定义全屏淡出至红色 (Game Over 效果)
export async function fadeScreenToRed() {
  await startFadeTransition('fadeOut', '255, 0, 0');
  state.needToFadeIn = true;
}

export async function clearFade() {
  state.fadeAlpha = 0;
  state.needToFadeIn = false;
  state.isPaused = false;
}

export async function fadeEffect() {

}