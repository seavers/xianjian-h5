import { state } from '../engine/state.js';
import { Lang } from '../utils/lang.js';
import { Thread } from '../engine/thread.js';
import { loadMsg, loadWord, loadPic, loadRgm } from '../resources/pal.js';

export let isTalking = false;

let tx = 0;
let ty = 0;
let rgmId = 0;
let rgm = null;
let rgmX = 0;
let rgmY = 0;
let who = null;
let tips = false;
let message = false;
let color = null;
let clear = true;
let line = 0; // 第几行

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

function resetTalk() {
  isTalking = false;
  state.currentMode = 'game'; // 恢复为常规游戏探索模式
  rgm = null;
  who = null;
  tx = 80;
  ty = 8;
  clear = true;
  color = null;
  tips = false;
  message = false;
}

function showUp(pRgmId) {
  tx = 80;
  ty = 8;
  rgmId = pRgmId;
  rgmX = 8;
  rgmY = 8;

  rgm = rgmId && loadRgm(rgmId);
  clear = true;
}

function showDown(pRgmId) {
  tx = 5;
  ty = 110;
  rgmId = pRgmId;
  rgmX = 230;
  rgmY = 100;

  rgm = rgmId && loadRgm(pRgmId);
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
  isTalking = true;
  state.currentMode = 'talk'; // 切换为对话模式，拦截常规输入

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

  // 步骤 1：等待异步打印对话文本动作完成
  await drawTalk0(msgId);

  // 步骤 2：使用暂存的线程上下文等待玩家空格/回车或触屏按键确认对话推进
  await checkTalk(t);
}

function drawTalk0(msgId) {
  return new Promise((resolve) => {
    const text = loadMsg(msgId);
    if (Lang.endWiths(text, ':')) {
      who = text;
      resolve();
      return;
    }

    const x = tx;
    const y = ty;
    const talkCtx = state.contexts.talk;

    if (clear) {
      if (talkCtx) {
        if (rgm) talkCtx.drawImage(rgm, rgmX, rgmY);
        if (who) showLine(who, x, y);
      }
      clear = false;
      line = 0;
    }

    line++;
    drawLine(text, x + 16, y + line * 16, resolve);
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

function showLine(text, x, y) {
  const texts = calcText(text);
  for (let i = 0; i < texts.length; i++) {
    drawWord(texts[i].charCode, x + i * 16, y, texts[i].color);
  }
}

export function clearTalk() {
  updateTalk();
}

export function updateTalk() {
  const talkCtx = state.contexts.talk;
  if (talkCtx) {
    talkCtx.clearRect(0, 0, talkCtx.canvas.width, talkCtx.canvas.height);
  }
  clear = true;
}

export function showTalkWait() {
  const msg = '>';
  fillText(msg, 70, 100);
}

function checkTalk(t) {
  return new Promise((resolve) => {
    if (!t) {
      resolve();
      return;
    }

    if (line > 3) {
      registerTalkResolve(() => {
        updateTalk();
        resolve();
      });
    } else if (t.isNextTalk()) {
      resolve();
    } else if (t.isNextTalks()) {
      registerTalkResolve(() => {
        resolve();
      });
    } else {
      registerTalkResolve(() => {
        resetTalk();
        updateTalk();
        resolve();
      });
    }
  });
}

async function drawMessage(msgId, t) {
  isTalking = true;
  state.currentMode = 'talk'; // 切换为对话模式
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
    // 步骤 1：不再手动挂起线程，直接 await 用户按键回调以非阻塞地完成等待
    await new Promise((resolve) => {
      registerTalkResolve(() => {
        resetTalk();
        updateTalk();
        resolve();
      });
    });
  }
}

async function drawTips(msgId, t) {
  isTalking = true;
  state.currentMode = 'talk'; // 切换为对话模式
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
  showTalkWait,
  updateTalk,
  resetTalk,
  registerTalkResolve,
  onInput,
  get isTalking() {
    return isTalking;
  }
};
