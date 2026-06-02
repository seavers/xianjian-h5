import { state } from '../engine/state.js';
import { Canvas } from '../utils/canvas.js';
import { deyj } from '../utils/deyj.js';
import { load, loadMkf } from './loader.js';

export const caches = {};

export function fromCache(key, callback) {
  let cache = caches[key];
  if (!cache) {
    cache = callback(key);
    caches[key] = cache;
  }
  return cache;
}

function createImage(image, width, height) {
  return Canvas.create(image, width, height);
}

export function mkf2Count(file, index) {
  const data = loadMkf(file, index);
  return data.getShort(0);
}

// mkf 格式内的子打包
export function loadMkf2(data, index) {
  const start = data.getShort(index * 2) * 2; // 地址要乘以 2 的
  const end = data.getShort(index * 2 + 2) * 2;
  if (start >= end && end !== 0) {
    console.warn('[warning]: loadMkf2 ' + start + ' ' + end);
    return;
  }
  return data.slice(start, end);
}

// 读取 SSS# 数据包
export function loadSss(sssId) {
  return loadMkf('sss.mkf', sssId);
}

export function loadMap(mapId) {
  return fromCache('map_' + mapId, () => {
    const data = loadMkf('map.mkf', mapId);
    const dd = deyj(data);
    return dd;
  });
}

export function loadPal(palId) {
  return fromCache('pal_' + palId, () => {
    const data = loadMkf('pat.mkf', palId);
    const palette = [];
    for (let i = 0; i < 256; i++) {
      palette[i] = 
        (data.getByte(3 * i + 2) << 2  &  0x000000ff) +
        (data.getByte(3 * i + 1) << 10 &  0x0000ff00) +
        (data.getByte(3 * i + 0) << 18 &  0x00ff0000) +
        (0xff000000); // alpha, 不透明		
    }
    return palette;
  });
}

export function loadGop(mapId, gopId) {
  const key = 'gop_' + mapId + '_' + gopId;
  return fromCache(key, () => {
    const gops = loadMkf('gop.mkf', mapId);
    const gop = loadMkf2(gops, gopId);
    const img = createRleImage(gop);
    return img;
  });
}

export function loadMgo(roleId, frame) {
  const key = 'mgo_' + roleId + '_' + frame;
  return fromCache(key, () => {
    const mgos = loadMkf('mgo.mkf', roleId);
    const dmgos = deyj(mgos);
    const mgo = loadMkf2(dmgos, frame);
    return createRleImage(mgo);
  });
}

export function loadMgoCount(roleId) {
  const mgos = loadMkf('mgo.mkf', roleId);
  const dmgos = deyj(mgos);
  return dmgos.getShort(0) - 1; // 从 1 开始
}

export function loadRgm(rgmId) {
  const key = 'rgm_' + rgmId;
  return fromCache(key, () => {
    const rgm = loadMkf('rgm.mkf', rgmId);
    const img = createRleImage(rgm, true);
    return img;
  });
}

export function loadFbp(fbpId) {
  const key = 'fbp_' + fbpId;
  return fromCache(key, () => {
    const fbp = loadMkf('fbp.mkf', fbpId);
    const dfbp = deyj(fbp);
    const img = createPalImage(dfbp, 320, 200); 
    return img;
  });
}

export function createRleImage(data, isPal) {
  if (!data) return;

  const view = data.toDataView();
  const palette = loadPal(state.paletteId);

  var width = view.nextShort();
  var height = view.nextShort();

  // SDLPAL 的 RLE 解码函数明确会跳过 02 00 00 00，然后把后 4 字节当作 width/height
  if (width == 2 && height == 0) {
    width = view.nextShort();
    height = view.nextShort();
  }

  if (isNaN(width) || isNaN(height) || width > 200 || height > 200 || width <= 0 || height <= 0) {
    console.warn('[warning]: rle width/height invalid ' + width + ' ' + height);
    return;
  }

  const result = [];
  while (result.length < width * height) {
    const n = view.nextByte();
    if (n > 0x80) {
      for (let i = 0; i < n - 0x80; i++) {
        result.push(0x00000000); // 透明色
      }
    } else {
      for (let i = 0; i < n; i++) {
        const palId = view.nextByte();
        result.push(palette[palId]);
      }
    }
  }

  return createImage(result, width, height);
}

export function createPalImage(data, width, height) {
  if (!data) return;

  const palette = loadPal(globalPalletteId);

  const result = [];
  for (let i = 0; i < width * height; i++) {
    const palId = data.getByte(i);
    result.push(palette[palId]);
  }

  return createImage(result, width, height);
}

// 载入剧情对话文本
export function loadMsg(msgId) {
  const talk = loadMkf('sss.mkf', 3);
  const start = talk.getInt(msgId * 4);
  const end = talk.getInt(msgId * 4 + 4);

  const msg = load('m.msg');
  return msg.slice(start, end);
}

export function loadText(text, index) {
  const charCode = text.getShort(index);
  return loadWord(charCode);
}

export function loadWord(charCode, color) {
  const fonId = _charCode2FonId(charCode);
  return loadFon(fonId, color);
}

function _charCode2FonId(code) {
  const file = load('wor16.asc');
  for (let i = 0; i < file.length / 2; i++) {
    if (file.getShort(i * 2 + 0) === code) {
      return i;
    }
  }
}

const bbb = 1665;

export function loadFon(fonId, color) {
  if (color) {
    return loadFon2(fonId, color);
  }

  const index = fonId;
  const key = 'word_' + index;
  return fromCache(key, () => {
    const fon = load('jianti.fon');
    const base = bbb + index * 30;

    const data = fon.slice(base, base + 30); // 点阵数据, 16*15/8=30字节
    const view = data.toDataView();

    const width = 16;
    const height = 15;

    const pixels = [];
    for (let i = 0; i < width * height; i++) {
      const pos = i % 16 < 8 ? i + 16 : i; // 16x15 -> 16x16, 纠正左右不对称的问题
      if (view.nextBits(1)) {
        pixels[pos] = 0xFFFFFFFF;
      } else {
        pixels[pos] = 0x00000000;
      }
    }

    return createImage(pixels, width, height);
  });
}

export function loadFon2(fonId, color) {
  const index = fonId;
  const fon = load('jianti.fon');
  const base = bbb + index * 30;

  const data = fon.slice(base, base + 30);
  const view = data.toDataView();

  const width = 16;
  const height = 15;

  const pixels = [];
  for (let i = 0; i < width * height; i++) {
    const pos = i % 16 < 8 ? i + 16 : i;
    if (view.nextBits(1)) {
      pixels[pos] = color | 0xFF000000; // 最低字节为0xFF，并带有具体颜色通道
    } else {
      pixels[pos] = 0x00000000;
    }
  }

  return createImage(pixels, width, height);
}

export function loadPic(picId) {
  const pics = loadMkf('data.mkf', 9);
  const pic = loadMkf2(pics, picId - 1);
  return createRleImage(pic);
}

export function loadAbc(abcId) {
  const abc = loadMkf('abc.mkf', abcId);
  const dabc = deyj(abc);
  return createRleImage(dabc);
}

export function loadBall(ballId) {
  const ball = loadMkf('ball.mkf', ballId);
  return createRleImage(ball, true);
}

export function loadDat() {
  return load('word.dat');
}

// 仙剑特定的高位截取方式

// 以int为单位, 返回 9bit 的整数, (用于MapTileId, 特殊点在于, 高位的1, 从0x10, 而非0x01取)
export function u9s(data, index, offset = 0) {
  const lowIndex = data.getByte(4 * index + offset + 0);
  const highIndex = data.getByte(4 * index + offset + 1);
  return lowIndex + ((highIndex & 0x10) << 4);
}

export function u3s(data, index, offset = 0) {
  const highIndex = data.getByte(4 * index + offset + 1);
  return (highIndex & 0xCf);
}
