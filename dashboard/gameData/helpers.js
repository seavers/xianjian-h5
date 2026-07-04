import { loadWord } from '../../js/resources/pal.js';
import { state } from '../../js/engine/state.js';

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

export function getWordText(wordId) {
  // 从全局 state.words 获取该词条的 ByteArray 字节流
  const itemWord = state?.words?.[wordId];
  if (itemWord) {
    try {
      // 提取有效的 Uint8Array 缓冲区段，用于 Big5 文本解码
      const uint8Array = itemWord.buffer.subarray(itemWord.byteOffset, itemWord.byteOffset + itemWord.length);
      const decodedStr = new TextDecoder('big5').decode(uint8Array).trim();
      const simplifiedFn = window.toSimplifiedFn;
      // 优先转换成简体中文，若无简繁转换器则直接返回解码字串
      return simplifiedFn ? simplifiedFn(decodedStr) : decodedStr;
    } catch (e) {
      console.error('[getWordText] 无法解析词条名称:', e);
    }
  }
  return '';
}

export function getItemNameHtml(itemId) {
  // 直接以纯文字格式获取和返回物品名称，避免大批量 Canvas 转换带来的性能开销
  const name = getWordText(itemId);
  return name || `物品 #${itemId}`;
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
