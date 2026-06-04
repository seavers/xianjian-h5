import { ByteArray } from '../utils/view.js';

// 全局 Web Audio 上下文与已加载的音频包缓存
let audioCtx = null;
let vocMkf = null;
let soundsMkf = null;
let activeSoundSources = [];

// 获取或惰性初始化 Web Audio 上下文，并处理浏览器的安全暂停状态
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// 异步加载音频包文件，若不存在则打印警告而不中断游戏启动
async function loadMkfFile(filename) {
  try {
    const response = await fetch(`pal/${filename}`);
    if (!response.ok) {
      throw new Error(`HTTP 状态异常: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new ByteArray(new Uint8Array(arrayBuffer));
  } catch (e) {
    console.warn(`[Sound] 可选资源包 ${filename} 加载失败:`, e);
    return null;
  }
}

// 初始化音频包，确保 voc.mkf 与 sounds.mkf 加载完成
export async function initSound() {
  if (!vocMkf) vocMkf = await loadMkfFile('voc.mkf');
  if (!soundsMkf) soundsMkf = await loadMkfFile('sounds.mkf');
}

export function getVocMkf() { return vocMkf; }
export function getSoundsMkf() { return soundsMkf; }

// 从已载入的 MKF 数据中提取指定索引的 chunk 视图
export function getMkfChunk(mkf, index) {
  if (!mkf || index < 0) return null;
  
  const total = Math.floor(mkf.getInt(0) / 4) - 1;
  if (index >= total) return null;
  
  const start = mkf.getInt(index * 4);
  const end = mkf.getInt(index * 4 + 4);
  if (end <= start) return null;
  
  return mkf.slice(start, end);
}

// 判定 chunk 数据是否为标准 WAV (RIFF WAVE) 格式
export function isWav(byteArray) {
  if (byteArray.length < 12) return false;
  return byteArray.getByte(0) === 0x52 && // R
         byteArray.getByte(1) === 0x49 && // I
         byteArray.getByte(2) === 0x46 && // F
         byteArray.getByte(3) === 0x46;   // F
}

// 判定 chunk 数据是否为标准 VOC (Creative Voice File) 格式
export function isVoc(byteArray) {
  if (byteArray.length < 20) return false;
  const sig = "Creative Voice File\x1A";
  for (let i = 0; i < 20; i++) {
    if (byteArray.getByte(i) !== sig.charCodeAt(i)) return false;
  }
  return true;
}

// 将 ByteArray 的子切片视图完整复制到一个新的 ArrayBuffer 中供解码器使用
function toArrayBuffer(byteArray) {
  const bytes = new Uint8Array(byteArray.length);
  for (let i = 0; i < byteArray.length; i++) {
    bytes[i] = byteArray.getByte(i);
  }
  return bytes.buffer;
}

// 解析 VOC 格式音频数据，将其转码为 Web Audio 的 AudioBuffer，兼容 Type 1 和 Type 9 数据块
export function parseVoc(byteArray) {
  const dataOffset = byteArray.getShort(20);
  let index = dataOffset;
  const ctx = getAudioContext();
  
  while (index < byteArray.length) {
    const blockType = byteArray.getByte(index);
    if (blockType === 0) break; // 终止符
    
    if (index + 4 > byteArray.length) break;
    const b1 = byteArray.getByte(index + 1);
    const b2 = byteArray.getByte(index + 2);
    const b3 = byteArray.getByte(index + 3);
    const blockSize = b1 | (b2 << 8) | (b3 << 16);
    
    const blockDataIndex = index + 4;
    if (blockDataIndex + blockSize > byteArray.length) break;
    
    // 块类型 1: 经典 8 位无符号单声道音频
    if (blockType === 1) {
      const srByte = byteArray.getByte(blockDataIndex);
      const compression = byteArray.getByte(blockDataIndex + 1);
      if (compression !== 0) {
        console.warn(`[Sound] 不支持的 VOC 压缩格式: ${compression}`);
        return null;
      }
      
      const sampleRate = Math.round(1000000 / (256 - srByte));
      const dataSize = blockSize - 2;
      const samplesStart = blockDataIndex + 2;
      
      const audioBuffer = ctx.createBuffer(1, dataSize, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < dataSize; i++) {
        const u8Val = byteArray.getByte(samplesStart + i);
        channelData[i] = (u8Val - 128) / 128.0; // 归一化至 [-1.0, 1.0]
      }
      return audioBuffer;
    }
    
    // 块类型 9: 扩展新型音频（支持 16 位及立体声）
    if (blockType === 9) {
      if (blockSize < 12) break;
      const sampleRate = byteArray.getByte(blockDataIndex) |
                         (byteArray.getByte(blockDataIndex + 1) << 8) |
                         (byteArray.getByte(blockDataIndex + 2) << 16) |
                         (byteArray.getByte(blockDataIndex + 3) << 24);
      const bitsPerSample = byteArray.getByte(blockDataIndex + 4);
      const channels = byteArray.getByte(blockDataIndex + 5);
      const samplesStart = blockDataIndex + 12;
      const dataSize = blockSize - 12;
      
      if (bitsPerSample === 8 && channels === 1) {
        const audioBuffer = ctx.createBuffer(1, dataSize, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < dataSize; i++) {
          const u8Val = byteArray.getByte(samplesStart + i);
          channelData[i] = (u8Val - 128) / 128.0;
        }
        return audioBuffer;
      } else if (bitsPerSample === 16 && channels === 1) {
        const sampleCount = Math.floor(dataSize / 2);
        const audioBuffer = ctx.createBuffer(1, sampleCount, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < sampleCount; i++) {
          const low = byteArray.getByte(samplesStart + i * 2);
          const high = byteArray.getByte(samplesStart + i * 2 + 1);
          let s16Val = low | (high << 8);
          if (s16Val >= 32768) s16Val -= 65536;
          channelData[i] = s16Val / 32768.0;
        }
        return audioBuffer;
      } else {
        console.warn(`[Sound] 不支持的 VOC Type 9 音频格式: bits=${bitsPerSample}, channels=${channels}`);
        return null;
      }
    }
    
    index = blockDataIndex + blockSize;
  }
  return null;
}

// 播放预先解码好的 AudioBuffer 并注册到当前活动声源列表
export function playSoundBuffer(audioBuffer, loop = false) {
  if (!audioBuffer) return null;
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.loop = loop;
  
  source.connect(ctx.destination);
  source.start(0);
  
  const soundObj = {
    source,
    stop: () => {
      try { source.stop(); } catch (e) {}
    }
  };
  
  activeSoundSources.push(soundObj);
  source.onended = () => {
    const idx = activeSoundSources.indexOf(soundObj);
    if (idx > -1) activeSoundSources.splice(idx, 1);
  };
  return soundObj;
}

// 停止所有当前正在播放的音效
export function stopAllSounds() {
  activeSoundSources.forEach(s => s.stop());
  activeSoundSources = [];
}

// 根据音效 ID 读取音频归档并播放
export async function playSound(soundId, loop = false) {
  if (soundId <= 0) return;
  await initSound();
  
  let chunk = null;
  if (vocMkf) chunk = getMkfChunk(vocMkf, soundId);
  if (!chunk && soundsMkf) chunk = getMkfChunk(soundsMkf, soundId);
  
  if (!chunk) {
    console.warn(`[Sound] 未能在音频包中找到特技音效 ID: ${soundId}`);
    return;
  }
  
  try {
    let audioBuffer = null;
    if (isVoc(chunk)) {
      audioBuffer = parseVoc(chunk);
    } else if (isWav(chunk)) {
      const ctx = getAudioContext();
      audioBuffer = await ctx.decodeAudioData(toArrayBuffer(chunk));
    }
    
    if (audioBuffer) {
      playSoundBuffer(audioBuffer, loop);
    }
  } catch (e) {
    console.error(`[Sound] 播放特技音效 ID: ${soundId} 发生错误:`, e);
  }
}
