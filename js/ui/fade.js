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
    // 步骤 1.2：优先在 talk 层绘制一帧全黑遮盖，确保屏幕此时已被完全涂黑，杜绝亮屏闪烁穿帮
    state.fadeAlpha = 1;
    renderScreen('fadeIn');

    // 步骤 1.3：仅在非战斗探索模式下，才需要在底图上临时去除遮罩并重绘新场景清晰第一帧
    // 对于战斗模式，战斗系统 start() 阶段已经重绘了清晰首帧并已重新蒙黑，在此必须彻底跳过，防止战斗系统 draw() 内部擦除 talkCtx 遮罩产生瞬间亮屏闪烁
    if (state.currentMode !== 'battle') {
      const savedAlpha = state.fadeAlpha;
      state.fadeAlpha = 0;
      renderScreen(true);
      state.fadeAlpha = savedAlpha;
    }
  }

  // 步骤 1.4：步进转场定时渲染逻辑（每 30ms 渲染一帧以提供 60fps 般丝滑视觉体验）
  for (let frame = 1; frame <= duration; frame++) {
    await sleep(30);
    
    if (type === 'fadeOut') {
      state.fadeAlpha = frame / duration;
      renderScreen('fadeOut');
    } else {
      state.fadeAlpha = 1 - frame / duration;
      renderScreen('fadeIn');
    }
  }

  // 步骤 1.5：转场终点半透明黑色遮罩绝对定位与重绘同步
  if (type === 'fadeOut') {
    state.fadeAlpha = 1;
    renderScreen('fadeOut');

    // 步骤 1.6：淡出完成时，在 mainCtx 上同步填充一次物理全黑，确保底层也被完全遮住，杜绝亮屏闪烁
    // 这里绝不调用 renderScreen(true) 以避免无谓且可能产生穿帮的 back 和 middle 重绘渲染
    const mainCtx = state.contexts.main;
    if (mainCtx) {
      const color = state.fadeColor || '0, 0, 0';
      mainCtx.fillStyle = `rgba(${color}, 1)`;
      mainCtx.fillRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
    }
  } else {
    state.fadeAlpha = 0;
    renderScreen('fadeIn'); // 步骤 1.7：清空 talk 层的黑色遮罩，露出底下的 main 层
  }
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
