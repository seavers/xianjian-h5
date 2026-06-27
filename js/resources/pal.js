import { state } from '../engine/state.js';
import { Canvas } from '../utils/canvas.js';
import { deyj } from '../utils/deyj.js';
import { load, loadMkf } from './loader.js';

const ISO_FONT_DATA = [
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYGBgYGBgYABgYAAAAAABsbDYAAAAAAAAAAAAA',
  'AAAANjZ/NjZ/NjYAAAAAAAgIPmsLCz5oaGs+CAgAAAAAMxMYCAwEBjIzAAAAAAAcNjYcbD4zM3vOAAAAAAAYGAwAAAAAAAAAAAAA',
  'AAAwGBgMDAwMDBgYMAAAAAAMGBgwMDAwMBgYDAAAAAAAAAA2HH8cNgAAAAAAAAAAAAAYGH4YGAAAAAAAAAAAAAAAAAAAABgYDAAA',
  'AAAAAAAAAH4AAAAAAAAAAAAAAAAAAAAAABgYAAAAAABgIDAQGAgMBAYCAwAAAAA+Y2Nja2tjY2M+AAAAAAAYHhgYGBgYGBgYAAAA',
  'AAA+Y2BgMBgMBgN/AAAAAAA+Y2BgPGBgYGM+AAAAAAAwODw2M38wMDAwAAAAAAB/AwM/YGBgYGM+AAAAAAA8BgMDP2NjY2M+AAAA',
  'AAB/YDAwGBgYDAwMAAAAAAA+Y2NjPmNjY2M+AAAAAAA+Y2NjfmBgYDAeAAAAAAAAAAAYGAAAABgYAAAAAAAAAAAYGAAAABgYDAAA',
  'AABgMBgMBgYMGDBgAAAAAAAAAAB+AAB+AAAAAAAAAAAGDBgwYGAwGAwGAAAAAAA+Y2AwMBgYABgYAAAAAAA8ZnN7a2t7MwY8AAAA',
  'AAA+Y2Njf2NjY2NjAAAAAAA/Y2NjP2NjY2M/AAAAAAA8ZgMDAwMDA2Y8AAAAAAAfM2NjY2NjYzMfAAAAAAB/AwMDPwMDAwN/AAAA',
  'AAB/AwMDPwMDAwMDAAAAAAA8ZgMDA3NjY2Z8AAAAAABjY2Njf2NjY2NjAAAAAAA8GBgYGBgYGBg8AAAAAAAwMDAwMDAwMDMeAAAA',
  'AABjMxsPBwcPGzNjAAAAAAADAwMDAwMDAwN/AAAAAABjY3d/f2trY2NjAAAAAABjY2dvb3t7c2NjAAAAAAA+Y2NjY2NjY2M+AAAA',
  'AAA/Y2NjYz8DAwMDAAAAAAA+Y2NjY2Njb3s+MGAAAAA/Y2NjYz8bM2NjAAAAAAA+YwMDDjhgYGM+AAAAAAB+GBgYGBgYGBgYAAAA',
  'AABjY2NjY2NjY2M+AAAAAABjY2NjYzY2HBwIAAAAAABjY2tra2t/NjY2AAAAAABjYzY2HBw2NmNjAAAAAADDw2ZmPDwYGBgYAAAA',
  'AAB/MDAYGAwMBgZ/AAAAAAA8DAwMDAwMDAw8AAAAAAADAgYEDAgYEDAgYAAAAAA8MDAwMDAwMDA8AAAAAAgcNmMAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAP8AAAAMDBgAAAAAAAAAAAAAAAAAAAA+YH5jY3NuAAAAAAADAwM7Z2NjY2c7AAAAAAAAAAA+YwMDA2M+AAAA',
  'AABgYGBuc2NjY3NuAAAAAAAAAAA+Y2N/A2M+AAAAAAA8ZgYfBgYGBgYGAAAAAAAAAABuc2NjY3NuYGM+AAADAwM7Z2NjY2NjAAAA',
  'AAAMDAAMDAwMDAw4AAAAAAAwMAAwMDAwMDAwMDMeAAADAwNjMxsPHzNjAAAAAAAMDAwMDAwMDAw4AAAAAAAAAAA1a2tra2trAAAA',
  'AAAAAAA7Z2NjY2NjAAAAAAAAAAA+Y2NjY2M+AAAAAAAAAAA7Z2NjY2c7AwMDAAAAAABuc2NjY3NuYOBgAAAAAAA7ZwMDAwMDAAAA',
  'AAAAAAA+Yw44YGM+AAAAAAAADAw+DAwMDAw4AAAAAAAAAABjY2NjY3NuAAAAAAAAAABjYzY2HBwIAAAAAAAAAABja2trPjY2AAAA',
  'AAAAAABjNhwcHDZjAAAAAAAAAABjYzY2HBwMDAYDAAAAAAB/YDAYDAZ/AAAAAABwGBgYGA4YGBgYcAAAABgYGBgYGBgYGBgYGAAA',
  'AAAOGBgYGHAYGBgYDgAAAAAAAAAAbjsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAAAAABgYABgYGBgYGBgAAAAACAg+awsLC2s+CAgAAAAcNgYGHwYGB287AAAAAAAAAGY8ZmZmPGYAAAAA',
  'AADDw2ZmPH4YfhgYAAAAAAAYGBgYAAAYGBgYAAAAADxmDB4zY2Y8GDMeAAAAAAA2NgAAAAAAAAAAAAAAAAA8QpmlhaWZQjwAAAAA',
  'AB4wPjM7NgA/AAAAAAAAAAAAAABsNhsbNmwAAAAAAAAAAAAAf2BgYAAAAAAAAAAAAAAAADwAAAAAAAAAAAA8Qp2lnaWlQjwAAAAA',
  'AH4AAAAAAAAAAAAAAAAAAAAcNjYcAAAAAAAAAAAAAAAAABgYfhgYAH4AAAAAAB4zGAwGPwAAAAAAAAAAAB4zGDAzHgAAAAAAAAAA',
  'ADAYDAAAAAAAAAAAAAAAAAAAAABmZmZmZnZuBgYDAAB+Ly8vLigoKCgoAAAAAAAAAAAAABgYAAAAAAAAAAAAAAAAAAAAAAAAGDAe',
  'AAwODAwMHgAAAAAAAAAAAB4zMzMzHgA/AAAAAAAAAAAAAAAbNmxsNhsAAAAAABAcGBgYAH8AGBwaPhgAABAcGBgYAH8AHDYYDD4A',
  'ABw2GDYcAH8AGBwaPhgAAAAAAAwMAAwMBgYDYz4ADBg+Y2Njf2NjY2NjAAAAGAw+Y2Njf2NjY2NjAAAACBQ+Y2Njf2NjY2NjAAAA',
  'bjs+Y2Njf2NjY2NjAAAANgA+Y2Njf2NjY2NjAAAAHDY+Y2Njf2NjY2NjAAAAAAD+MzMz/zMzMzPzAAAAAAA8ZgMDAwMDA2Y8GDAe',
  'DBh/AwMDPwMDAwN/AAAAGAx/AwMDPwMDAwN/AAAACBR/AwMDPwMDAwN/AAAANgB/AwMDPwMDAwN/AAAADBg8GBgYGBgYGBg8AAAA',
  'MBg8GBgYGBgYGBg8AAAAGCQ8GBgYGBgYGBg8AAAAZgA8GBgYGBgYGBg8AAAAAAAeNmZmb2ZmZjYeAAAAbjtjY2dvb3t7c2NjAAAA',
  'Bgw+Y2NjY2NjY2M+AAAAMBg+Y2NjY2NjY2M+AAAACBQ+Y2NjY2NjY2M+AAAAbjs+Y2NjY2NjY2M+AAAANgA+Y2NjY2NjY2M+AAAA',
  'AAAAAABmPBg8ZgAAAAAAACA+c3Nra2trZ2c+AgAADBhjY2NjY2NjY2M+AAAAGAxjY2NjY2NjY2M+AAAACBRjY2NjY2NjY2M+AAAA',
  'NgBjY2NjY2NjY2M+AAAAMBjDw2ZmPDwYGBgYAAAAAAAPBj5mZmZmPgYPAAAAAAAeMzMbM2NjY2M7AAAAAAwYMAA+YH5jY3NuAAAA',
  'ADAYDAA+YH5jY3NuAAAAAAgcNgA+YH5jY3NuAAAAAABuOwA+YH5jY3NuAAAAAAA2NgA+YH5jY3NuAAAAABw2HAA+YH5jY3NuAAAA',
  'AAAAAABu29j+G9t2AAAAAAAAAAA+YwMDA2M+GDAeAAwYMAA+Y2N/A2M+AAAAADAYDAA+Y2N/A2M+AAAAAAgcNgA+Y2N/A2M+AAAA',
  'AAA2NgA+Y2N/A2M+AAAAAAYMGAAMDAwMDAw4AAAAABgMBgAMDAwMDAw4AAAAAAgcNgAMDAwMDAw4AAAAAAA2NgAMDAwMDAw4AAAA',
  'AAAsGDRgfGZmZmY8AAAAAABuOwA7Z2NjY2NjAAAAAAYMGAA+Y2NjY2M+AAAAADAYDAA+Y2NjY2M+AAAAAAgcNgA+Y2NjY2M+AAAA',
  'AABuOwA+Y2NjY2M+AAAAAAA2NgA+Y2NjY2M+AAAAAAAAABgYAH4AGBgAAAAAAAAAACA+c2tra2c+AgAAAAYMGABjY2NjY3NuAAAA',
  'ADAYDABjY2NjY3NuAAAAAAgcNgBjY2NjY3NuAAAAAAA2NgBjY2NjY3NuAAAAADAYDABjYzY2HBwMDAYDAAAPBgY+ZmZmZmY+BgYP',
  'AAA2NgBjYzY2HBwMDAYD'
].join('');

const ISO_FONT = Uint8Array.from(atob(ISO_FONT_DATA), c => c.charCodeAt(0));

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
  return fromCache('pal_' + palId + '_' + state.fNightPalette, () => {
    const data = loadMkf('pat.mkf', palId);

    var base = 0;
    if (state.fNightPalette) {
      base = 3 * 256;
    }

    const palette = [];
    for (let i = 0; i < 256; i++) {
      palette[i] = 
        (data.getByte(3 * i + 2 + base) << 2  &  0x000000ff) +
        (data.getByte(3 * i + 1 + base) << 10 &  0x0000ff00) +
        (data.getByte(3 * i + 0 + base) << 18 &  0x00ff0000) +
        (0xff000000); // alpha, 不透明		
    }
    return palette;
  });
}

export function loadGop(mapId, gopId) {
  const key = 'gop_' + mapId + '_' + gopId + '_' + state.paletteId + '_' + state.fNightPalette;
  return fromCache(key, () => {
    const gops = loadMkf('gop.mkf', mapId);
    const gop = loadMkf2(gops, gopId);
    const img = createRleImage(gop);
    return img;
  });
}

export function loadMgo(roleId, frame) {
  const key = 'mgo_' + roleId + '_' + frame + '_' + state.paletteId + '_' + state.fNightPalette;
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
  const key = 'rgm_' + rgmId + '_' + state.paletteId + '_' + state.fNightPalette;
  return fromCache(key, () => {
    const rgm = loadMkf('rgm.mkf', rgmId);
    const img = createRleImage(rgm, true);
    return img;
  });
}

export function loadFbp(fbpId) {
  // 步骤 1：针对无效的大图 ID（65535 或 -1）进行防御，直接返回 320x200 纯黑 Canvas
  if (fbpId === 65535 || fbpId === -1) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 320, 200);
    return canvas;
  }

  // 步骤 2：对合法的剧情大图从缓存或 fbp.mkf 资源包加载并解码
  const key = 'fbp_' + fbpId + '_' + state.paletteId + '_' + state.fNightPalette;
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

  if (isNaN(width) || isNaN(height) || width > 320 || height > 200 || width <= 0 || height <= 0) {
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

  const palette = loadPal(state.paletteId);

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
  // 步骤 1：若属于半角 ASCII 字符，通过硬编码的仙剑原版 iso_font 点阵逐 bit 还原像素，不做 canvas 字符绘制
  if (charCode < 128) {
    const key = 'ascii_' + charCode + '_' + (color || 'default');
    return fromCache(key, () => {
      const offset = charCode * 15;
      const width = 8;
      const height = 15;

      // 步骤 2：遍历 8x15 点阵中的每一位 bit，将开启状态设为对应的 ARGB 颜色，未开启设为透明
      const pixels = [];
      const fontColor = (color !== undefined) ? color : 0xFCDC84;
      for (let y = 0; y < height; y++) {
        const b = ISO_FONT[offset + y];
        for (let x = 0; x < width; x++) {
          const bit = b & (1 << x);
          pixels[y * width + x] = bit ? (fontColor | 0xFF000000) : 0x00000000;
        }
      }

      // 步骤 3：调用 H5 底层 Canvas.create 生成对应的原版点阵字形 Canvas 并返回
      return createImage(pixels, width, height);
    });
  }

  // 步骤 4：对于正常的双字节汉字，继续原有的字形点阵解析加载流程
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
  if (color !== undefined) {
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
  const key = 'word_' + fonId + '_' + color;
  return fromCache(key, () => {
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
  });
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
