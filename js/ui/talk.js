import { state } from '../engine/state.js';
import { Lang } from '../utils/lang.js';
import { Thread } from '../engine/thread.js';
import { loadMsg, loadWord, loadPic, loadRgm } from '../resources/pal.js';
import { updateTalk } from './draw.js';

export let isTalking = false;

// 模块级对话坐标与状态管理
let tx = 80;
let ty = 8;
let titleX = 80;
let titleY = 8;
let rgmId = 0;
let rgm = null;
let rgmX = 0;
let rgmY = 0;
let dialogPosition = 'upper'; // 当前对话位置 ('upper' 或 'lower')
let who = null;
let tips = false;
let message = false;
let color = null;
let clear = true;
let line = 0; // 当前写入的正文行数 (0-indexed)

// 向下闪烁箭头动画坐标与时间状态管理
let arrowX = 0;
let arrowY = 0;
let lastArrowTickTime = 0;
let currentArrowIcon = 67;

function fillText(word, x, y) {
  const ctx = state.contexts.talk;
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.fillText(word, x, y);
}

let talkPromiseResolve = null;

export function registerTalkResolve(resolve) {
  talkPromiseResolve = resolve;
}

export function onInput(input) {
  if (input === 'blank') {
    if (talkPromiseResolve) {
      const resolve = talkPromiseResolve;
      talkPromiseResolve = null;
      resolve();
    }
  }
}

// 检测文本是否为说话人名，支持全角、半角和 Win95 专用比号的二进制字节检测
function isNameText(text) {
  if (!text || text.length === 0) return false;
  const len = text.length;
  const lastByte = text.getByte(len - 1);

  // 1. 半角英文冒号 ':' (0x3A = 58)
  if (lastByte === 58) {
    return true;
  }

  // 2. 繁体中文 Big5 全角冒号 '：' (0xA1 = 161, 0x47 = 71)
  if (len >= 2) {
    const prevByte = text.getByte(len - 2);
    if (prevByte === 161 && lastByte === 71) {
      return true;
    }
    // 3. 简体中文 GBK 全角冒号 '：' (0xA3 = 163, 0xBA = 186)
    if (prevByte === 163 && lastByte === 186) {
      return true;
    }
  }

  return false;
}

// 封装阻塞式按键/点击等待逻辑
function waitKey() {
  showTalkWait();
  return new Promise((resolve) => {
    registerTalkResolve(() => {
      clearTalkWait();
      resolve();
    });
  });
}

function resetTalk() {
  isTalking = false;
  rgm = null;
  rgmId = 0;
  dialogPosition = 'upper';
  who = null;
  tx = 80;
  ty = 8;
  titleX = 80;
  titleY = 8;
  clear = true;
  color = null;
  tips = false;
  message = false;
  line = 0;
  arrowX = 0;
  arrowY = 0;
}

async function showUp(pRgmId) {
  // 如果当前正在对话且有正文，切换位置前必须先让玩家按键确认
  if (isTalking && line > 0) {
    await waitKey();
    updateTalk();
    line = 0;
    who = null;
  }

  isTalking = true;
  dialogPosition = 'upper';
  rgmId = pRgmId;
  clear = true;
}

async function showDown(pRgmId) {
  // 同理，如果切换位置时有残留对话，需等待玩家按键确认
  if (isTalking && line > 0) {
    await waitKey();
    updateTalk();
    line = 0;
    who = null;
  }

  isTalking = true;
  dialogPosition = 'lower';
  rgmId = pRgmId;
  clear = true;
}

function showTips() {
  tips = true;
  tx = 55;
  ty = 25;
  color = null;
}

function showMessage() {
  message = true;
  tx = 160;
  ty = 50;
  color = null;
}

export async function drawTalk(msgId) {
  // 如果当前尚未处于对话状态，说明这是一段全新的对话（无论是否执行过 showUp/showDown），必须当场重置上一轮可能残留的状态以作防呆
  if (!isTalking) {
    resetTalk();
    isTalking = true;
  }

  // 步骤 0：同步读取并暂存当前活跃脚本线程引用，杜绝对话打印 await 挂起期间由于 auto NPC 等微任务对 Thread.currentThread 全局变量的并发改写污染
  const t = Thread.currentThread;

  if (message) {
    message = false;
    await drawMessage(msgId, t);
    return;
  } else if (tips) {
    tips = false;
    await drawTips(msgId, t);
    return;
  }
  
  if (!t) return;

  // 步骤 1：如果满 4 行翻页，等待按键并清空画布，重置状态
  if (line >= 4) {
    await waitKey();
    updateTalk();
    line = 0;
    clear = true;
  }

  // 步骤 2：等待异步打印对话文本动作完成
  await drawTalk0(msgId);
}

function drawTalk0(msgId) {
  return new Promise((resolve) => {
    const text = loadMsg(msgId);
    if (isNameText(text)) {
      who = text;
      resolve();
      return;
    }

    const talkCtx = state.contexts.talk;

    if (clear) {
      // 惰性加载 RGM 头像
      rgm = rgmId ? loadRgm(rgmId) : null;

      // 根据对话位置 (dialogPosition) 和是否有头像，动态计算所有的排版坐标
      if (dialogPosition === 'upper') {
        if (rgm) {
          titleX = 80;
          titleY = 8;
          tx = 96;
          ty = 26;
          rgmX = 8;
          rgmY = 8;
        } else {
          titleX = 12;
          titleY = 8;
          tx = 44;
          ty = 26;
        }
      } else {
        if (rgm) {
          titleX = 4;
          titleY = 108;
          tx = 20;
          ty = 126;
          rgmX = 230;
          rgmY = 100;
        } else {
          titleX = 12;
          titleY = 108;
          tx = 44;
          ty = 126;
        }
      }

      if (talkCtx) {
        if (rgm) talkCtx.drawImage(rgm, rgmX, rgmY);
        if (who) showLine(who, titleX, titleY, 0x00FFFF); // 使用青色绘制说话人
      }
      clear = false;
      line = 0;
    }

    // 动态决定 Y 坐标：有说话人时根据 ty 排，无说话人时整体上移到 titleY 排以填补空间
    const x = tx;
    const y = who ? (ty + line * 18) : (titleY + line * 18);

    drawLine(text, x, y, () => {
      line++;
      // 记录最后一个字后面的相对坐标 (X: 最后一个字右侧, Y: 所在行 Y 坐标)
      const texts = calcText(text);
      arrowX = x + texts.length * 16;
      arrowY = y;
      resolve();
    });
  });
}

function drawWord(charCode, x, y, color) {
  const talkCtx = state.contexts.talk;
  if (!talkCtx) return;
  const img = color ? loadWord(charCode, color) : loadWord(charCode);
  if (img) {
    talkCtx.drawImage(img, x, y);
  }
}

function drawLine(text, x, y, callback) {
  const texts = calcText(text);
  let i = 0;
  const timer = setInterval(() => {
    if (i >= texts.length) {
      clearInterval(timer);
      if (callback) callback();
      return;
    }
    const charCode = texts[i].charCode;
    drawWord(charCode, x + i * 16, y, texts[i].color);
    i++;
  }, 15);
}

function calcText(text) {
  const r = [];
  for (let i = 0; i < text.length; i++) {
    const b = text.getByte(i);

    if (b === 34) { // "
      color = color === 0xFCDC84 ? null : 0xFCDC84;
    } else if (b === 45) { // -
      color = color === 0xFFFF00 ? null : 0xFFFF00;
    } else if (b === 39) { // '
      color = color === 0x0000FF ? null : 0x0000FF;
    } else {
      r.push({
        charCode: text.getShort(i++),
        color: color
      });
    }
  }
  return r;
}

function showLine(text, x, y, customColor) {
  const texts = calcText(text);
  for (let i = 0; i < texts.length; i++) {
    const wordColor = customColor !== undefined ? customColor : texts[i].color;
    drawWord(texts[i].charCode, x + i * 16, y, wordColor);
  }
}

export async function clearTalk() {
  if (isTalking && line > 0) {
    await waitKey();
  }
  clearDraw();
}

export function clearDraw() {
  const talkCtx = state.contexts.talk;
  if (talkCtx) {
    talkCtx.clearRect(0, 0, talkCtx.canvas.width, talkCtx.canvas.height);
  }
  line = 0;
  clear = true;
}

export function tickArrow() {
  const now = Date.now();
  if (now - lastArrowTickTime >= 300) {
    currentArrowIcon = currentArrowIcon === 67 ? 68 : 67;
    lastArrowTickTime = now;

    const talkCtx = state.contexts.talk;
    if (talkCtx && arrowX && arrowY) {
      // 擦除向下箭头对应的 9x6 区域 (文字底对齐，Y偏移 9，高 6，宽 9)
      talkCtx.clearRect(arrowX, arrowY + 9, 9, 6);
      
      const img = loadPic(currentArrowIcon);
      if (img) {
        talkCtx.drawImage(img, arrowX, arrowY + 9);
      }
    }
  }
}

export function clearTalkWait() {
  const talkCtx = state.contexts.talk;
  if (talkCtx && arrowX && arrowY) {
    talkCtx.clearRect(arrowX, arrowY + 9, 9, 6);
  }
  arrowX = 0;
  arrowY = 0;
}

export function showTalkWait() {
  currentArrowIcon = 67;
  lastArrowTickTime = Date.now();
  
  const talkCtx = state.contexts.talk;
  if (talkCtx && arrowX && arrowY) {
    talkCtx.clearRect(arrowX, arrowY + 9, 9, 6);
    const img = loadPic(currentArrowIcon);
    if (img) {
      talkCtx.drawImage(img, arrowX, arrowY + 9);
    }
  }
}

async function drawMessage(msgId, t) {
  isTalking = true;
  const text = loadMsg(msgId);
  const texts = calcText(text);
  const length = texts.length;

  const x = tx - length * 16 / 2;
  const y = ty;

  drawBack(length, x, y);
  await drawLineSync(texts, x, y, t);
}

function drawBack(length, x, y) {
  const talkCtx = state.contexts.talk;
  if (!talkCtx) return;

  const picLeft = loadPic(45);
  if (picLeft) talkCtx.drawImage(picLeft, x - 8, y);

  const picMiddle = loadPic(46);
  if (picMiddle) {
    for (let i = 0; i < length; i++) {
      talkCtx.drawImage(picMiddle, x + i * 16, y);
    }
  }

  const picRight = loadPic(47);
  if (picRight) talkCtx.drawImage(picRight, x + length * 16, y);
}

async function drawLineSync(texts, x, y, t) {
  for (let i = 0; i < texts.length; i++) {
    drawWord(texts[i].charCode, x + i * 16, y + 9, texts[i].color);
  }

  if (t) {
    // 统一定位向下箭头，因为是在文字底部对齐 (y+9 是文字顶)
    arrowX = x + texts.length * 16;
    arrowY = y + 9;
    
    await waitKey();
    resetTalk();
    clearDraw();
  }
}

async function drawTips(msgId, t) {
  isTalking = true;
  const text = loadMsg(msgId);
  const texts = calcText(text);
  const length = texts.length;

  const x = tx - length * 16 / 2;
  const y = ty;

  await drawLineSync(texts, x, y, t);
}

export const Talk = {
  talkUp: showUp,
  talkDown: showDown,
  talkTips: showTips,
  talkMessage: showMessage,
  drawTalk,
  clearTalk,
  tickArrow,
  onInput,
  get isTalking() {
    return isTalking;
  },
  get isWaiting() {
    return !!talkPromiseResolve;
  }
};
