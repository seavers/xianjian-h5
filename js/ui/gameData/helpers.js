import { loadWord } from '../../resources/pal.js';
import { state } from '../../engine/state.js';

const roleNameMap = {};

export function getWordImg(wordId, color = 0xFFFFFF) {
  const word = state.words[wordId];
  if (!word) return null;

  const canvas = document.createElement('canvas');
  const len = word.length / 2;
  canvas.width = len * 16;
  canvas.height = 16;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < len; i++) {
    const charCode = word.getShort(i * 2);
    if (charCode === 0x2020) {
      continue;
    }

    const img = loadWord(charCode, color);
    if (img) {
      ctx.drawImage(img, i * 16, 0);
    }
  }

  return canvas;
}

export function getItemNameHtml(itemId) {
  const canvas = getWordImg(itemId);
  if (canvas) {
    return `<img src="${canvas.toDataURL()}" style="height: 20px; image-rendering: pixelated; vertical-align: middle;" />`;
  }
  return `物品 #${itemId}`;
}

export function drawPixelated(srcCanvas, destCanvasId) {
  const destCanvas = document.getElementById(destCanvasId);
  if (!destCanvas) return;

  const ctx = destCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, destCanvas.width, destCanvas.height);

  if (!srcCanvas) {
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.strokeRect(4, 4, destCanvas.width - 8, destCanvas.height - 8);
    return;
  }

  const scale = Math.min(destCanvas.width / srcCanvas.width, destCanvas.height / srcCanvas.height);
  const cleanScale = Math.max(0.5, Math.floor(scale));
  const dx = (destCanvas.width - srcCanvas.width * cleanScale) / 2;
  const dy = (destCanvas.height - srcCanvas.height * cleanScale) / 2;
  ctx.drawImage(srcCanvas, dx, dy, srcCanvas.width * cleanScale, srcCanvas.height * cleanScale);
}

export function getRoleName(roleId) {
  if (roleId <= 0) {
    return '-';
  }
  return roleNameMap[roleId] || `人物 #${roleId}`;
}

export function makeScriptHyperlinks(text) {
  if (!text) return '';
  return text.replace(/Script\s*#(\d+)/g, (match, id) => {
    return `<span class="script-data-link" style="color: var(--glow-yellow); text-decoration: underline; cursor: pointer; font-weight: bold;" onclick="jumpToGameDataScript(${id})">${match}</span>`;
  });
}
