import { ByteArray } from '../utils/view.js';

// 全局音频文件归档与状态
let midiMkf = null;
let musMkf = null;
let currentAudio = null;
let currentMusicNum = -1;
let currentLoop = true;

// 异步加载背景音乐资源归档
async function loadMkfFile(filename) {
  try {
    const response = await fetch(`pal/${filename}`);
    if (!response.ok) {
      throw new Error(`HTTP 状态异常: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new ByteArray(new Uint8Array(arrayBuffer));
  } catch (e) {
    console.warn(`[Music] 可选音乐归档 ${filename} 未加载或不可用:`, e);
    return null;
  }
}

// 确保音乐归档就绪
export async function initMusic() {
  if (!midiMkf) midiMkf = await loadMkfFile('midi.mkf');
  if (!musMkf) musMkf = await loadMkfFile('mus.mkf');
}

export function getMidiMkf() { return midiMkf; }
export function getMusMkf() { return musMkf; }

// 播放指定编号的背景音乐，支持从 Musics 目录查找对应音轨并执行音量淡入
export function playMusic(musicNum, loop = true, fadeTime = 0) {
  if (musicNum <= 0) {
    stopMusic();
    return;
  }
  
  if (currentMusicNum === musicNum && currentAudio && !currentAudio.paused) {
    return; // 已经在此背景音乐中播放，跳过以避免重头播放
  }
  
  stopMusic();
  
  currentMusicNum = musicNum;
  currentLoop = loop;
  
  const padNum = String(musicNum).padStart(3, '0');
  const audio = new Audio();
  audio.loop = loop;
  
  // 依次配置多格式降级路径，保障浏览器最大兼容性 (mp3 -> ogg -> wav)
  audio.src = `pal/Musics/${padNum}.mp3`;
  audio.onerror = () => {
    if (audio.src.endsWith('.mp3')) {
      audio.src = `pal/Musics/${padNum}.ogg`;
    } else if (audio.src.endsWith('.ogg')) {
      audio.src = `pal/Musics/${padNum}.wav`;
    } else {
      console.warn(`[Music] 背景音乐 ${musicNum} 在各种支持格式中均无法载入播放`);
    }
  };
  
  // 处理淡入延迟逻辑
  if (fadeTime > 0) {
    audio.volume = 0;
    audio.play().then(() => {
      fadeInAudio(audio, fadeTime);
    }).catch(e => {
      console.log(`[Music] 音乐播放由于浏览器安全交互限制被拦截:`, e);
    });
  } else {
    audio.volume = 1.0;
    audio.play().catch(e => {
      console.log(`[Music] 音乐播放由于浏览器安全交互限制被拦截:`, e);
    });
  }
  
  currentAudio = audio;
}

// 停止背景音乐并应用音量渐变淡出
export function stopMusic(fadeTime = 0) {
  if (!currentAudio) return;
  const audio = currentAudio;
  currentAudio = null;
  currentMusicNum = -1;
  
  if (fadeTime > 0) {
    fadeOutAudio(audio, fadeTime);
  } else {
    audio.pause();
  }
}

// 获取当前正在播放的背景音乐编号
export function getCurrentMusicNum() {
  return currentMusicNum;
}

// 处理音量淡入逻辑
function fadeInAudio(audio, fadeTime) {
  const steps = 20;
  const interval = (fadeTime * 1000) / steps;
  let currentStep = 0;
  
  const timer = setInterval(() => {
    currentStep++;
    audio.volume = currentStep / steps;
    if (currentStep >= steps) {
      clearInterval(timer);
      audio.volume = 1.0;
    }
  }, interval);
}

// 处理音量淡出逻辑，淡出后暂停播放
function fadeOutAudio(audio, fadeTime) {
  const steps = 20;
  const interval = (fadeTime * 1000) / steps;
  let currentStep = steps;
  
  const timer = setInterval(() => {
    currentStep--;
    audio.volume = Math.max(0, currentStep / steps);
    if (currentStep <= 0) {
      clearInterval(timer);
      audio.pause();
    }
  }, interval);
}
