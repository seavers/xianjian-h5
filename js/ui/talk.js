import { state } from '../engine/state.js';
import { Lang } from '../utils/lang.js';
import { Thread } from '../engine/thread.js';
import { loadMsg, loadWord, loadPic, loadRgm } from '../resources/pal.js';

let inputModule = null;
async function getInputModule() {
  if (!inputModule) {
    inputModule = await import('./input.js');
  }
  return inputModule;
}

async function triggerRegisterBlank(callback) {
  const input = await getInputModule();
  input.registerBlank(callback);
}

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

function resetTalk() {
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

export function drawTalk(msgId) {
  if (message) {
    message = false;
    drawMessage(msgId);
    return;
  } else if (tips) {
    tips = false;
    drawTips(msgId);
    return;
  }
  
  const t = Thread.currentThread;
  if (!t) return;

  t.wait();
  drawTalk0(msgId, () => {
    checkTalk(() => {
      t.notify();
    });
  });
}

function drawTalk0(msgId, callback) {
  const text = loadMsg(msgId);
  if (Lang.endWiths(text, ':')) {
    who = text;
    callback();
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
  drawLine(text, x + 16, y + line * 16, callback);
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

function checkTalk(callback) {
  const t = Thread.currentThread;
  if (!t) {
    callback();
    return;
  }

  if (line > 3) {
    triggerRegisterBlank(() => {
      updateTalk();
      callback();
    });
  } else if (t.isNextTalk()) {
    callback();
  } else if (t.isNextTalks()) {
    triggerRegisterBlank(() => {
      callback();
    });
  } else {
    triggerRegisterBlank(() => {
      resetTalk();
      updateTalk();
      callback();
    });
  }
}

function drawMessage(msgId) {
  const text = loadMsg(msgId);
  const texts = calcText(text);
  const length = texts.length;

  const x = tx - length * 16 / 2;
  const y = ty;

  drawBack(length, x, y);
  drawLineSync(texts, x, y);
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

function drawLineSync(texts, x, y) {
  for (let i = 0; i < texts.length; i++) {
    drawWord(texts[i].charCode, x + i * 16, y + 9, texts[i].color);
  }

  const t = Thread.currentThread;
  if (t) {
    t.wait();
    triggerRegisterBlank(() => {
      resetTalk();
      updateTalk();
      t.notify();
    });
  }
}

function drawTips(msgId) {
  const text = loadMsg(msgId);
  const texts = calcText(text);
  const length = texts.length;

  const x = tx - length * 16 / 2;
  const y = ty;

  drawLineSync(texts, x, y);
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
  resetTalk
};
