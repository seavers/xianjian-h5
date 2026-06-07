import { ByteArray } from '../utils/view.js';
import { DBOPL } from '../utils/dbopl.js';
import { RixPlayer } from '../utils/rixplayer.js';

// 判定全局声音是否开启
const isSoundEnabled = () => localStorage.getItem('sound_enabled') !== 'false';

// 全局背景音乐状态与 Web Audio 节点
let musMkf = null;
let currentMusicNum = -1;
let currentLoop = true;

let audioCtx = null;
let oplInstance = null;
let rixPlayer = null;
let scriptNode = null;
let gainNode = null;

// 获取或惰性初始化 Web Audio 上下文，并处理浏览器的暂停安全限制
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// 异步加载音乐归档包文件
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

// 初始化背景音乐包
export async function initMusic() {
  if (!musMkf) musMkf = await loadMkfFile('mus.mkf');
}

export function getMusMkf() { return musMkf; }

// 从已载入的 MKF 数据中提取指定索引的 RIX 数据切片
function getMkfChunk(mkf, index) {
  if (!mkf || index < 0) return null;
  const total = Math.floor(mkf.getInt(0) / 4) - 1;
  if (index >= total) return null;
  const start = mkf.getInt(index * 4);
  const end = mkf.getInt(index * 4 + 4);
  if (end <= start) return null;
  return mkf.slice(start, end);
}

// 将自定义 ByteArray 视图转换为标准的 JS Uint8Array 数组供播放器使用
function toUint8Array(byteArray) {
  const bytes = new Uint8Array(byteArray.length);
  for (let i = 0; i < byteArray.length; i++) {
    bytes[i] = byteArray.getByte(i);
  }
  return bytes;
}

// 播放指定编号的背景音乐，使用 OPL3 FM 芯片硬件级 PCM 音频合成播放
export async function playMusic(musicNum, loop = true, fadeTime = 0) {
  if (musicNum <= 0) {
    stopMusic(fadeTime);
    return;
  }

  // 若已经在播放同编号背景音乐，跳过以避免打断
  if (currentMusicNum === musicNum && rixPlayer && !rixPlayer.play_end) {
    return;
  }

  // 停止正在播放的背景音乐（无缝淡出）
  stopMusic(0);

  currentMusicNum = musicNum;
  currentLoop = loop;

  console.log(`[Music] playMusic 开始播放音乐 ID: ${musicNum}, 循环: ${loop}, 渐入: ${fadeTime} 秒`);

  await initMusic();
  if (!musMkf) {
    console.warn('[Music] mus.mkf 背景音乐库未载入，无法合成播放音乐 ID:', musicNum);
    return;
  }

  const chunk = getMkfChunk(musMkf, musicNum);
  if (!chunk) {
    console.warn(`[Music] 未在 mus.mkf 中找到编号为 ${musicNum} 的音乐块`);
    return;
  }

  const rixData = toUint8Array(chunk);
  const ctx = getAudioContext();

  // 实例化 OPL3 合成核心（配置采样率及双声道）
  oplInstance = new DBOPL.OPL(ctx.sampleRate, 2);

  // 初始化 RIX 播放器逻辑
  rixPlayer = new RixPlayer(oplInstance);
  rixPlayer.load(rixData);

  // 精准计算 70Hz 背景音乐节拍在当前上下文采样率下的样本步长
  const samplesPerTick = ctx.sampleRate / 70;
  let sampleCounter = 0;

  // 创建 PCM 采样混音 ScriptProcessorNode (缓冲区设为 4096 双通道输出)
  scriptNode = ctx.createScriptProcessor(4096, 2, 2);
  scriptNode.onaudioprocess = (e) => {
    const outputBuffer = e.outputBuffer;
    const left = outputBuffer.getChannelData(0);
    const right = outputBuffer.getChannelData(1);
    const len = outputBuffer.length;

    let offset = 0;
    while (offset < len) {
      // 算出到达下一个播放器 Tick 时钟所需的渲染样本数
      const nextTickSamples = Math.ceil(samplesPerTick - sampleCounter);
      const toRender = Math.min(len - offset, nextTickSamples);

      if (toRender > 0) {
        let rendered = 0;
        while (rendered < toRender) {
          // 由于 DBOPL 合成器每次输出样本数有 2-512 的硬性规范，做分块与凑样处理
          let chunk = Math.min(toRender - rendered, 512);
          if (chunk < 2) {
            chunk = 2;
          }

          const buf = oplInstance.generate(chunk);
          const activeSamples = Math.min(chunk, toRender - rendered);
          for (let i = 0; i < activeSamples; i++) {
            const outIdx = offset + rendered + i;
            left[outIdx] = buf[i * 2] / 32768.0;
            right[outIdx] = buf[i * 2 + 1] / 32768.0;
          }
          rendered += activeSamples;
        }

        offset += toRender;
        sampleCounter += toRender;
      }

      // 累加样本到达节拍步长，触发 RixPlayer 状态步进
      if (sampleCounter >= samplesPerTick) {
        sampleCounter -= samplesPerTick;
        if (rixPlayer) {
          const active = rixPlayer.update();
          if (!active) {
            if (currentLoop) {
              console.log(`[Music] 音乐 ID ${currentMusicNum} 到达乐谱末尾，触发循环重播`);
              // 循环播放模式：重新加载 RIX 缓存重头开始
              rixPlayer.load(rixData);
            } else {
              console.log(`[Music] 音乐 ID ${currentMusicNum} 到达乐谱末尾，单次播放模式，开始静音停止`);
              // 单次播放模式：填充剩余静音并终止
              left.fill(0, offset);
              right.fill(0, offset);
              stopMusic(0);
              break;
            }
          }
        }
      }
    }
  };

  // 创建音量 GainNode 并根据是否淡入设置音量渐变
  gainNode = ctx.createGain();
  const now = ctx.currentTime;
  const targetVol = isSoundEnabled() ? 0.5 : 0;
  if (fadeTime > 0 && isSoundEnabled()) {
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(targetVol, now + fadeTime);
  } else {
    gainNode.gain.setValueAtTime(targetVol, now);
  }

  // 链接 Web Audio 节点图
  scriptNode.connect(gainNode);
  gainNode.connect(ctx.destination);

  console.log(`[Music] OPL3 PCM 合成器成功播放背景音乐 RIX ID: ${musicNum}`);
}

// 停止背景音乐，支持 GainNode 级别的平滑淡出以消除爆音
export function stopMusic(fadeTime = 0) {
  const ctx = audioCtx;
  const currentGainNode = gainNode;
  const currentScriptNode = scriptNode;

  console.log(`[Music] stopMusic 被调用，淡出时间: ${fadeTime} 秒，当前音乐 ID: ${currentMusicNum}`);

  // 提前断开引用的全局控制，允许下一首音乐无冲突快速播放
  gainNode = null;
  scriptNode = null;
  rixPlayer = null;
  oplInstance = null;
  currentMusicNum = -1;

  if (ctx && currentGainNode) {
    const now = ctx.currentTime;
    if (fadeTime > 0) {
      currentGainNode.gain.setValueAtTime(currentGainNode.gain.value, now);
      currentGainNode.gain.linearRampToValueAtTime(0, now + fadeTime);
      
      // 在淡出时间到了之后，真正释放节点链路
      setTimeout(() => {
        try {
          if (currentScriptNode) currentScriptNode.disconnect();
          if (currentGainNode) currentGainNode.disconnect();
        } catch (e) {
          // 防止节点已经被垃圾回收导致异常
        }
      }, fadeTime * 1000);
    } else {
      try {
        if (currentScriptNode) currentScriptNode.disconnect();
        if (currentGainNode) currentGainNode.disconnect();
      } catch (e) {
        // 静默处理断开异常
      }
    }
  }
}

// 获取当前正在播放的背景音乐编号
export function getCurrentMusicNum() {
  return currentMusicNum;
}

// 联动更新当前的 GainNode 音量，在页面点击声音开关时被触发
export function updateVolume() {
  if (gainNode && audioCtx) {
    const targetVol = isSoundEnabled() ? 0.5 : 0;
    gainNode.gain.setValueAtTime(targetVol, audioCtx.currentTime);
  }
}
