import { ByteArray } from '../utils/view.js';

// 全局音频文件归档与状态
let midiMkf = null;
let musMkf = null;
let currentAudio = null;
let currentMusicNum = -1;
let currentLoop = true;
let synth = null;

// 异步加载背景音乐资源归档
async function loadMkfFile(filename) {
  try {
    const response = await fetch(`pal/${filename}`);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[Music] 可选音乐归档 pal/${filename} 未加载，将跳过（正常现象）`);
        return null;
      }
      throw new Error(`HTTP 状态异常: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new ByteArray(new Uint8Array(arrayBuffer));
  } catch (e) {
    console.warn(`[Music] 可选音乐归档 ${filename} 未加载或不可用:`, e.message);
    return null;
  }
}

// 获取或惰性初始化 Web Audio MIDI 合成器
function getMidiSynth() {
  if (!synth) {
    if (typeof WebAudioTinySynth !== 'undefined') {
      synth = new WebAudioTinySynth();
      synth.setQuality(1); // 开启 FM 合成音质
    } else {
      console.warn('[Music] 全局未检测到 WebAudioTinySynth 构造器，无法进行 MIDI 软合成');
    }
  }
  return synth;
}

// 确保音乐归档就绪
export async function initMusic() {
  if (!midiMkf) midiMkf = await loadMkfFile('midi.mkf');
  if (!musMkf) musMkf = await loadMkfFile('mus.mkf');
}

export function getMidiMkf() { return midiMkf; }
export function getMusMkf() { return musMkf; }

// 从已载入的 MKF 数据中提取指定索引的 chunk 视图
function getMkfChunk(mkf, index) {
  if (!mkf || index < 0) return null;
  const total = Math.floor(mkf.getInt(0) / 4) - 1;
  if (index >= total) return null;
  const start = mkf.getInt(index * 4);
  const end = mkf.getInt(index * 4 + 4);
  if (end <= start) return null;
  return mkf.slice(start, end);
}

// 将 ByteArray 的子切片视图完整复制到一个新的 ArrayBuffer 中供 TinySynth 解码
function toArrayBuffer(byteArray) {
  const bytes = new Uint8Array(byteArray.length);
  for (let i = 0; i < byteArray.length; i++) {
    bytes[i] = byteArray.getByte(i);
  }
  return bytes.buffer;
}

// 播放指定编号的背景音乐，支持从 midi.mkf 解包软合成播放，若无则降级从 Musics 目录查找音频流
export async function playMusic(musicNum, loop = true, fadeTime = 0) {
  if (musicNum <= 0) {
    stopMusic();
    return;
  }
  
  const mSynth = getMidiSynth();
  const isSynthPlaying = mSynth && mSynth.playing;
  if (currentMusicNum === musicNum && (currentAudio && !currentAudio.paused || isSynthPlaying)) {
    return; // 已经在此背景音乐中播放，跳过以避免重头播放
  }
  
  stopMusic();
  
  currentMusicNum = musicNum;
  currentLoop = loop;
  
  await initMusic();
  
  // 优先判定：若支持 TinySynth 且存在 midi.mkf，从 midi.mkf 读取并合成播放
  if (mSynth && midiMkf) {
    const chunk = getMkfChunk(midiMkf, musicNum);
    if (chunk) {
      try {
        const arrayBuf = toArrayBuffer(chunk);
        mSynth.loadMIDI(arrayBuf);
        mSynth.setLoop(loop);
        
        if (fadeTime > 0) {
          mSynth.setMasterVol(0);
          mSynth.playMIDI();
          fadeInSynth(mSynth, fadeTime);
        } else {
          mSynth.setMasterVol(0.5);
          mSynth.playMIDI();
        }
        console.log(`[Music] 成功从 midi.mkf 读取并利用 TinySynth 软合成播放背景音乐 ID: ${musicNum}`);
        return;
      } catch (e) {
        console.error(`[Music] 利用 TinySynth 播放 midi.mkf 音轨发生错误:`, e);
      }
    }
  }
  
  // 降级判定：使用外部音频文件播放 (如 mp3/ogg)
  const padNum = String(musicNum).padStart(3, '0');
  const audio = new Audio();
  audio.loop = loop;
  
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
  const mSynth = getMidiSynth();
  if (mSynth) {
    if (fadeTime > 0) {
      fadeOutSynth(mSynth, fadeTime);
    } else {
      mSynth.stopMIDI();
    }
  }

  if (currentAudio) {
    const audio = currentAudio;
    currentAudio = null;
    if (fadeTime > 0) {
      fadeOutAudio(audio, fadeTime);
    } else {
      audio.pause();
    }
  }
  
  currentMusicNum = -1;
}

// 获取当前正在播放的背景音乐编号
export function getCurrentMusicNum() {
  return currentMusicNum;
}

// 合成器淡入逻辑
function fadeInSynth(mSynth, fadeTime) {
  const steps = 20;
  const interval = (fadeTime * 1000) / steps;
  let currentStep = 0;
  
  const timer = setInterval(() => {
    currentStep++;
    mSynth.setMasterVol(0.5 * (currentStep / steps));
    if (currentStep >= steps) {
      clearInterval(timer);
      mSynth.setMasterVol(0.5);
    }
  }, interval);
}

// 合成器淡出逻辑
function fadeOutSynth(mSynth, fadeTime) {
  const steps = 20;
  const interval = (fadeTime * 1000) / steps;
  let currentStep = steps;
  
  const timer = setInterval(() => {
    currentStep--;
    mSynth.setMasterVol(Math.max(0, 0.5 * (currentStep / steps)));
    if (currentStep <= 0) {
      clearInterval(timer);
      mSynth.stopMIDI();
    }
  }, interval);
}

// 处理 HTML5 Audio 音量淡入逻辑
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

// 处理 HTML5 Audio 音量淡出逻辑，淡出后暂停播放
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
