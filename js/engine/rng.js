import { loadMkf } from '../resources/loader.js';
import { loadPal } from '../resources/pal.js';
import { deyj } from '../utils/deyj.js';
import { state } from './state.js';
import { fadeIn } from '../ui/fade.js';

// 步骤 1：解析指定 RNG 动画分包内的指定单帧数据切片
export function getRngFrameData(rngChunk, frameNum) {
  if (!rngChunk) return null;

  // 读取首个子分包偏移地址，根据其大小计算总帧数
  const firstOffset = rngChunk.getInt(0);
  const frameCount = Math.floor((firstOffset - 4) / 4);

  if (frameNum >= frameCount) {
    return null;
  }

  const start = rngChunk.getInt(frameNum * 4);
  const end = rngChunk.getInt((frameNum + 1) * 4);

  if (start >= end) {
    return null;
  }

  return rngChunk.slice(start, end);
}

// 步骤 2：对已经 YJ_1 解压完毕的单帧 RNG 数据进行双像素解构贴图渲染 (翻译自 sdlpal/rngplay.c)
export function blitRngFrame(rng, length, pixels) {
  let ptr = 0;
  let dst_ptr = 0;
  let wdata = 0;
  let i, n;

  // 微型辅助方法：在当前像素游标处依次写入双像素并处理游标推进
  function writePixelPair(p1, p2) {
    let x = dst_ptr % 320;
    let y = Math.floor(dst_ptr / 320);
    if (y < 200) {
      pixels[y * 320 + x] = p1;
    }
    dst_ptr++;

    x = dst_ptr % 320;
    y = Math.floor(dst_ptr / 320);
    if (y < 200) {
      pixels[y * 320 + x] = p2;
    }
    dst_ptr++;
  }

  // 循环解码帧流字节
  while (ptr < length) {
    const data = rng.getByte(ptr++);
    switch (data) {
      case 0x00:
      case 0x13:
        // 帧解码终止符
        return;

      case 0x02:
        dst_ptr += 2;
        break;

      case 0x03:
        dst_ptr += (rng.getByte(ptr++) + 1) * 2;
        break;

      case 0x04:
        wdata = rng.getByte(ptr) | (rng.getByte(ptr + 1) << 8);
        ptr += 2;
        dst_ptr += (wdata + 1) * 2;
        break;

      case 0x0a:
        writePixelPair(rng.getByte(ptr++), rng.getByte(ptr++));
        // fallthrough
      case 0x09:
        writePixelPair(rng.getByte(ptr++), rng.getByte(ptr++));
        // fallthrough
      case 0x08:
        writePixelPair(rng.getByte(ptr++), rng.getByte(ptr++));
        // fallthrough
      case 0x07:
        writePixelPair(rng.getByte(ptr++), rng.getByte(ptr++));
        // fallthrough
      case 0x06:
        writePixelPair(rng.getByte(ptr++), rng.getByte(ptr++));
        break;

      case 0x0b:
        {
          const count = rng.getByte(ptr++);
          for (i = 0; i <= count; i++) {
            writePixelPair(rng.getByte(ptr++), rng.getByte(ptr++));
          }
        }
        break;

      case 0x0c:
        {
          wdata = rng.getByte(ptr) | (rng.getByte(ptr + 1) << 8);
          ptr += 2;
          for (i = 0; i <= wdata; i++) {
            writePixelPair(rng.getByte(ptr++), rng.getByte(ptr++));
          }
        }
        break;

      case 0x0d:
      case 0x0e:
      case 0x0f:
      case 0x10:
        {
          const p1 = rng.getByte(ptr);
          const p2 = rng.getByte(ptr + 1);
          ptr += 2;
          const count = data - 11;
          for (i = 0; i < count; i++) {
            writePixelPair(p1, p2);
          }
        }
        break;

      case 0x11:
        {
          const count = rng.getByte(ptr++);
          const p1 = rng.getByte(ptr);
          const p2 = rng.getByte(ptr + 1);
          ptr += 2;
          for (i = 0; i <= count; i++) {
            writePixelPair(p1, p2);
          }
        }
        break;

      case 0x12:
        {
          n = (rng.getByte(ptr) | (rng.getByte(ptr + 1) << 8)) + 1;
          ptr += 2;
          const p1 = rng.getByte(ptr);
          const p2 = rng.getByte(ptr + 1);
          ptr += 2;
          for (i = 0; i < n; i++) {
            writePixelPair(p1, p2);
          }
        }
        break;
    }
  }
}

// 步骤 2.5：将获取帧切片、YJ_1 解压、像素对齐 blit 整合成一个单帧解码方法，供外部界面/预览系统直接调用
export function decodeRngFrame(rngChunk, frameNum, frameBuffer) {
  const frameData = getRngFrameData(rngChunk, frameNum);
  if (!frameData) return false;

  const decompressed = deyj(frameData);
  blitRngFrame(decompressed, decompressed.length, frameBuffer);
  return true;
}

// 步骤 3：在游戏脚本驱动下阻塞式渲染播放剧情大动画到主 canvas (0x37 对应内核实现)
export async function playRng(rngId, startFrame, endFrame, speed) {
  const rngChunk = loadMkf('rng.mkf', rngId);
  if (!rngChunk) {
    console.error(`无法载入 RNG 动画 ID: ${rngId}`);
    return;
  }

  // 计算帧终点以作安全限流
  const firstOffset = rngChunk.getInt(0);
  const totalFrames = Math.floor((firstOffset - 4) / 4);

  let start = startFrame;
  let end = endFrame;
  if (end > 0) {
    end++;
  } else {
    end = totalFrames;
  }

  // 播放前，清空底层 back 瓦片地图画布，避免残存地图缝隙露白
  const backCtx = state.contexts.back;
  if (backCtx) {
    backCtx.clearRect(0, 0, 320, 200);
  }

  const mainCtx = state.contexts.main;
  if (!mainCtx) return;

  const fps = speed === 0 ? 16 : speed;
  const frameDelay = 1000 / fps;

  // 帧缓冲区（320x200 字节，存放调色板颜色索引）
  const frameBuffer = new Uint8Array(320 * 200);
  let lastTime = performance.now();

  for (let f = start; f < end; f++) {
    const frameData = getRngFrameData(rngChunk, f);
    if (!frameData) {
      break;
    }

    // YJ_1 解压数据
    const decompressed = deyj(frameData);
    blitRngFrame(decompressed, decompressed.length, frameBuffer);

    // 将颜色索引转换为 RGBA 数据并直接渲染到主 canvas
    const palette = loadPal(state.paletteId);
    const imageData = mainCtx.createImageData(320, 200);
    const pixels = imageData.data;

    for (let i = 0; i < 64000; i++) {
      const color = palette[frameBuffer[i]];
      pixels[i * 4 + 0] = (color >> 16) & 0xFF; // R
      pixels[i * 4 + 1] = (color >> 8) & 0xFF;  // G
      pixels[i * 4 + 2] = color & 0xFF;         // B
      pixels[i * 4 + 3] = (color >> 24) & 0xFF; // A
    }

    mainCtx.putImageData(imageData, 0, 0);

    // 处理黑夜/白天渐变请求
    if (state.needToFadeIn) {
      await fadeIn();
      state.needToFadeIn = false;
    }

    // 平滑延时，确保播放流速均匀
    const elapsed = performance.now() - lastTime;
    const waitTime = frameDelay - elapsed;
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastTime = performance.now();
  }
}
