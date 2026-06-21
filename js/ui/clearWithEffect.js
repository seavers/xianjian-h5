import { state } from '../engine/state.js';
import { loadPal } from '../resources/pal.js';
import { update } from './draw.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function clearWithEffect(effectType) {
  console.log(`[0x73 clearWithEffect] 重新淡入当前场景, 特效类型: ${effectType}`);

  const mainCanvas = state.contexts.main?.canvas;
  const container = mainCanvas?.parentElement;
  if (!mainCanvas || !container) {
    await update(true);
    return;
  }

  // 步骤 1：创建临时备份画布，并复制当前画面（包含底图、角色图和对话框）
  const backupCanvas = document.createElement('canvas');
  backupCanvas.width = mainCanvas.width;
  backupCanvas.height = mainCanvas.height;
  backupCanvas.style.imageRendering = 'pixelated';
  backupCanvas.style.position = 'absolute';
  backupCanvas.style.top = '0';
  backupCanvas.style.left = '0';
  backupCanvas.style.width = '100%';
  backupCanvas.style.height = '100%';
  backupCanvas.style.zIndex = '999';

  const backupCtx = backupCanvas.getContext('2d');
  backupCtx.clearRect(0, 0, 320, 200);
  
  const backCanvas = state.contexts.back?.canvas;
  const battleCanvas = state.contexts.battle?.canvas;
  const talkCanvas = state.contexts.talk?.canvas;
  
  if (backCanvas) backupCtx.drawImage(backCanvas, 0, 0);
  if (mainCanvas) backupCtx.drawImage(mainCanvas, 0, 0);
  if (state.currentMode === 'battle' && battleCanvas) {
    backupCtx.drawImage(battleCanvas, 0, 0);
  }
  if (talkCanvas) backupCtx.drawImage(talkCanvas, 0, 0);

  // 将备份画布附加到容器最顶层遮挡真实画布的更新
  container.appendChild(backupCanvas);

  // 步骤 2：清除上一阶段残留的对话框信息
  if (state.contexts.talk) {
    state.contexts.talk.clearRect(0, 0, 320, 200);
  }

  // 步骤 3：调用重绘更新底层真实的地图和角色图层至下一场景帧状态
  await update(true);

  // 步骤 4：在内存中创建临时的目标图像画布，捕捉已经完成画面更新的新场景
  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = mainCanvas.width;
  targetCanvas.height = mainCanvas.height;
  
  const targetCtx = targetCanvas.getContext('2d');
  targetCtx.clearRect(0, 0, 320, 200);
  if (backCanvas) targetCtx.drawImage(backCanvas, 0, 0);
  if (mainCanvas) targetCtx.drawImage(mainCanvas, 0, 0);
  if (state.currentMode === 'battle' && battleCanvas) {
    targetCtx.drawImage(battleCanvas, 0, 0);
  }

  // 步骤 5：加载调色板并建立反向查找缓存，避免大规模循环中的计算损耗
  const palette = loadPal(state.paletteId);
  const reverseCache = new Map();

  function getClosestPaletteIndex(r, g, b) {
    const key = (r << 16) | (g << 8) | b;
    if (reverseCache.has(key)) {
      return reverseCache.get(key);
    }
    
    let minDiff = Infinity;
    let closestIndex = 0;
    for (let i = 0; i < 256; i++) {
      const palColor = palette[i];
      const pr = (palColor >> 16) & 0xff;
      const pg = (palColor >> 8) & 0xff;
      const pb = palColor & 0xff;
      
      const dr = pr - r;
      const dg = pg - g;
      const db = pb - b;
      const diff = dr * dr + dg * dg + db * db;
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = i;
        if (diff === 0) break;
      }
    }
    reverseCache.set(key, closestIndex);
    return closestIndex;
  }

  // 步骤 6：预分析并将备份画面与目标画面的所有 RGB 像素值映射为调色板索引
  const totalPixels = 320 * 200;
  const currentIndices = new Uint8Array(totalPixels);
  const targetIndices = new Uint8Array(totalPixels);

  const imageDataBak = backupCtx.getImageData(0, 0, 320, 200);
  const imageDataTgt = targetCtx.getImageData(0, 0, 320, 200);
  const dataBak = imageDataBak.data;
  const dataTgt = imageDataTgt.data;

  for (let k = 0; k < totalPixels; k++) {
    const rBak = dataBak[4 * k];
    const gBak = dataBak[4 * k + 1];
    const bBak = dataBak[4 * k + 2];
    currentIndices[k] = getClosestPaletteIndex(rBak, gBak, bBak);
    
    const rTgt = dataTgt[4 * k];
    const gTgt = dataTgt[4 * k + 1];
    const bTgt = dataTgt[4 * k + 2];
    targetIndices[k] = getClosestPaletteIndex(rTgt, gTgt, bTgt);
  }

  // 步骤 7：移植原版 12 步交错算法，按照调色板亮度拼合规律完成渐变融合
  const rgIndex = [0, 3, 1, 5, 2, 4];
  const speed = (typeof effectType === 'number') ? effectType : 2;
  const delayMs = (speed + 1) * 10;

  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 6; j++) {
      const startIdx = rgIndex[j];
      
      for (let k = startIdx; k < totalPixels; k += 6) {
        const a = targetIndices[k];
        let b = currentIndices[k];
        
        if (i > 0) {
          const a_low = a & 0x0F;
          const b_low = b & 0x0F;
          if (a_low > b_low) {
            b++;
          } else if (a_low < b_low) {
            b--;
          }
        }
        
        const newIndex = (a & 0xF0) | (b & 0x0F);
        currentIndices[k] = newIndex;
        
        const color = palette[newIndex];
        dataBak[4 * k] = (color >> 16) & 0xff;
        dataBak[4 * k + 1] = (color >> 8) & 0xff;
        dataBak[4 * k + 2] = color & 0xff;
        dataBak[4 * k + 3] = 255;
      }
      
      backupCtx.putImageData(imageDataBak, 0, 0);
      await sleep(delayMs);
    }
  }

  // 步骤 8：渐变流程结束后卸载遮罩画布，显示最终的新场景
  container.removeChild(backupCanvas);
}
