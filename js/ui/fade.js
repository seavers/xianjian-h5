import { state } from '../engine/state.js';
import { renderScreen } from './draw.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 全屏渐变过渡动画执行器，仅负责设定渐变透明度 fadeAlpha 并刷新屏幕
export async function startFadeTransition(type, speed = 1, color = '0, 0, 0', updateSceneFn) {
  state.fadeColor = color;
  const duration = 12;
  const sleepTime = 600 * speed / duration;

  // 步骤 1.1：根据渐变类型设定初始帧的黑色遮罩透明度，重绘底层画面并应用遮罩
  if (type === 'fadeOut') {
    state.fadeAlpha = 0;
  } else {
    state.fadeAlpha = 1;
  }
  
  if (updateSceneFn) {
    await updateSceneFn();
  }
  renderScreen(type);

  // 步骤 1.2：在过渡期间步进淡入淡出画面，每帧等待后更新场景并重新渲染
  for (let frame = 1; frame <= duration; frame++) {
    await sleep(sleepTime);

    if (type === 'fadeOut') {
      state.fadeAlpha = frame / duration;
    } else {
      state.fadeAlpha = 1 - frame / duration;
    }
    
    if (updateSceneFn) {
      await updateSceneFn();
    }
    renderScreen(type);
  }

  // 步骤 1.3：强制设置过渡终态的遮罩透明度，做最终的底层画面更新与遮罩绘制
  if (type === 'fadeOut') {
    state.fadeAlpha = 1;
  } else {
    state.fadeAlpha = 0;
  }
  
  if (updateSceneFn) {
    await updateSceneFn();
  }
  renderScreen(type);
}

// 全屏淡出
export async function fadeOut(speed, updateSceneFn) {
  state.isPaused = true;
  state.needToFadeIn = true;
  speed = speed || 1;
  
  await startFadeTransition('fadeOut', speed, '0, 0, 0', updateSceneFn);
}

// 检查全屏淡出
export async function checkAndFadeOut() {
  if (!state.needToFadeIn) {
    await fadeOut();
  }
}

// 全屏淡入
export async function fadeIn(speed, updateSceneFn) {
  speed = speed || 1;
  
  await startFadeTransition('fadeIn', speed, '0, 0, 0', updateSceneFn);
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