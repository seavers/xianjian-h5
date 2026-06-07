// ==================== 🖼️ 通用图片精灵资源浏览器 React 核心逻辑 ====================

import { React, ReactDOM, html } from './gameData/ui-helper.js';

const { useState, useEffect, useRef, useMemo } = React;

// 1. 2D 像素原画卡片懒加载子组件：支持在进入视口时按需解包并绘制，离开视口时自动释放内存，避免上千 Canvas 同屏导致卡顿
function LazySingleItemCard({ itemId, itemLabelText, loadFn, scale }) {
  const containerRef = useRef(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const canvasRef = useRef(null);

  // 初始化视口观察器
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, {
      rootMargin: '120px',
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // 当卡片进入视口时执行精灵解包与 Canvas 离网组装
  useEffect(() => {
    if (!isIntersecting || !canvasRef.current) return;

    try {
      const img = loadFn(itemId);
      const canvasContainer = canvasRef.current;
      canvasContainer.innerHTML = '';

      if (img) {
        img.style.setProperty('--raw-width', `${img.width}px`);
        img.style.setProperty('--raw-height', `${img.height}px`);
        img.style.background = 'rgba(0,0,0,0.3)';
        img.style.borderRadius = '1px';
        img.style.display = 'block';
        canvasContainer.appendChild(img);
      } else {
        canvasContainer.innerHTML = `<span style="font-size:7.5px; color:rgba(255,255,255,0.15);">${itemLabelText}\n[无数据]</span>`;
      }
    } catch (e) {
      console.error(`渲染项 #${itemId} 失败:`, e);
      canvasRef.current.innerHTML = `<span style="font-size:7.5px; color:var(--glow-red);">${itemLabelText}\n[解包失败]</span>`;
    }
  }, [isIntersecting, itemId, loadFn]);

  return html`
    <div 
      ref=${containerRef}
      onMouseEnter=${(e) => {
        e.currentTarget.style.borderColor = 'var(--glow-green)';
        e.currentTarget.style.background = 'rgba(0, 255, 157, 0.02)';
      }}
      onMouseLeave=${(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.02)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
      }}
      style=${{
        background: 'rgba(255,255,255,0.015)',
        border: '1px solid rgba(255,255,255,0.02)',
        borderRadius: '2px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px',
        transition: 'all 0.1s',
        minWidth: '70px',
        minHeight: '70px',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      <div ref=${canvasRef} style=${{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', minHeight: '40px' }}>
        ${!isIntersecting && html`<div style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.1)' }}>加载中...</div>`}
      </div>
      ${isIntersecting && html`
        <span style=${{
          fontSize: '7.5px',
          color: 'rgba(255,255,255,0.3)',
          fontWeight: 'bold',
          marginTop: '4px',
          textAlign: 'center',
          whiteSpace: 'pre-line',
          lineHeight: 1.2
        }}>${itemLabelText}</span>
      `}
    </div>
  `;
}

// 2. 原生点阵短语卡片懒加载子组件
function LazyWordItemCard({ wordId, labelText, loaderModule, palResources }) {
  const containerRef = useRef(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const canvasRef = useRef(null);
  const [emptyText, setEmptyText] = useState('');

  // 初始化视口观察器
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, {
      rootMargin: '120px',
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // 渲染短语字符点阵拼接
  useEffect(() => {
    if (!isIntersecting || !canvasRef.current || !loaderModule || !palResources) return;

    try {
      const data = loaderModule.load('word.dat');
      const offset = wordId * 10;
      const r = [];

      for (let i = 0; i < 5; i++) {
        const code = data.getShort(offset + i * 2);
        if (code !== 0 && code !== 32) {
          r.push(code);
        }
      }

      if (r.length > 0) {
        const canvas = canvasRef.current;
        canvas.width = r.length * 16;
        canvas.height = 16;
        canvas.style.setProperty('--raw-width', `${canvas.width}px`);
        canvas.style.setProperty('--raw-height', '16px');
        canvas.style.background = 'rgba(0,0,0,0.4)';
        canvas.style.borderRadius = '1px';
        canvas.style.display = 'block';

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        for (let j = 0; j < r.length; j++) {
          const wordImg = palResources.loadWord(r[j]);
          if (wordImg) {
            ctx.drawImage(wordImg, j * 16, 0);
          }
        }
        setEmptyText('');
      } else {
        setEmptyText('[空短语]');
      }
    } catch (e) {
      console.error(`绘制短语 WORD #${wordId} 失败:`, e);
      setEmptyText('[绘制失败]');
    }
  }, [isIntersecting, wordId, loaderModule, palResources]);

  return html`
    <div 
      ref=${containerRef}
      onMouseEnter=${(e) => {
        e.currentTarget.style.borderColor = 'var(--glow-green)';
        e.currentTarget.style.background = 'rgba(0, 255, 157, 0.02)';
      }}
      onMouseLeave=${(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.02)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
      }}
      style=${{
        background: 'rgba(255,255,255,0.015)',
        border: '1px solid rgba(255,255,255,0.02)',
        borderRadius: '2px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        transition: 'all 0.1s',
        minWidth: '60px',
        minHeight: '40px'
      }}
    >
      ${!isIntersecting ? html`<span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.1)' }}>加载中...</span>` : 
        (emptyText ? html`<span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.15)' }}>${labelText}\n${emptyText}</span>` : html`
          <canvas ref=${canvasRef} />
          <span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontWeight: 'bold', marginTop: '4px' }}>${labelText}</span>
        `)
      }
    </div>
  `;
}

// 3. 原生剧情文本行渲染组件 (msg.mkf)
function MsgItemCard({ msgId, labelText, palResources }) {
  const canvasRef = useRef(null);
  const [emptyText, setEmptyText] = useState('');

  // 渲染剧情富文本点阵拼接与字色控制解析
  useEffect(() => {
    if (!canvasRef.current || !palResources) return;

    try {
      const text = palResources.loadMsg(msgId);
      if (text && text.length > 0) {
        const r = [];
        let color = null;

        for (let i = 0; i < text.length; i++) {
          const b = text.getByte(i);
          if (b === 34) {
            color = color === 0xFCDC84 ? null : 0xFCDC84;
          } else if (b === 45) {
            color = color === 0xFFFF00 ? null : 0xFFFF00;
          } else if (b === 39) {
            color = color === 0x0000FF ? null : 0x0000FF;
          } else {
            r.push({
              charCode: text.getShort(i++),
              color: color
            });
          }
        }

        if (r.length > 0) {
          const canvas = canvasRef.current;
          canvas.width = r.length * 16;
          canvas.height = 16;
          canvas.style.setProperty('--raw-width', `${canvas.width}px`);
          canvas.style.setProperty('--raw-height', '16px');
          canvas.style.background = 'rgba(0,0,0,0.4)';
          canvas.style.borderRadius = '1px';
          canvas.style.display = 'block';

          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = false;

          for (let j = 0; j < r.length; j++) {
            const wordImg = r[j].color ? palResources.loadWord(r[j].charCode, r[j].color) : palResources.loadWord(r[j].charCode);
            if (wordImg) {
              ctx.drawImage(wordImg, j * 16, 0);
            }
          }
          setEmptyText('');
        } else {
          setEmptyText('[控制字符或空指令]');
        }
      } else {
        setEmptyText('[空文本]');
      }
    } catch (e) {
      console.error(`绘制剧本文本 MSG #${msgId} 失败:`, e);
      setEmptyText('[解析/绘制失败]');
    }
  }, [msgId, palResources]);

  return html`
    <div 
      onMouseEnter=${(e) => {
        e.currentTarget.style.borderColor = 'var(--glow-green)';
        e.currentTarget.style.background = 'rgba(0, 255, 157, 0.02)';
      }}
      onMouseLeave=${(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.02)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
      }}
      style=${{
        background: 'rgba(255,255,255,0.015)',
        border: '1px solid rgba(255,255,255,0.02)',
        borderRadius: '2px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '8px',
        transition: 'all 0.1s',
        maxWidth: 'calc(330px * var(--image-explorer-scale))',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      ${emptyText ? html`<span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.15)' }}>${labelText}\n${emptyText}</span>` : html`
        <canvas ref=${canvasRef} />
        <span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontWeight: 'bold', marginTop: '4px' }}>${labelText}</span>
      `}
    </div>
  `;
}

// 4. 全屏 RNG 动画画廊微型播放交互卡片（支持仅在进入视口且播放激活时启用定时循环绘制，自动销毁）
function LazyRngItemCard({ rngId, labelText, loaderModule, palResources, rngModule, onZoom, activePlayingId, setActivePlayingId }) {
  const containerRef = useRef(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const canvasRef = useRef(null);
  const [totalFrames, setTotalFrames] = useState(0);
  const [errorText, setErrorText] = useState('');
  const [rngData, setRngData] = useState(null);

  const isPlaying = activePlayingId === rngId;

  // 初始化视口观察器
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, {
      rootMargin: '120px',
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // 进入视口后加载数据并完成首帧解码预览
  useEffect(() => {
    if (!isIntersecting || !canvasRef.current || !loaderModule || !palResources || !rngModule) return;

    try {
      const rngChunk = loaderModule.loadMkf('rng.mkf', rngId);
      if (!rngChunk) {
        setErrorText('[无数据]');
        return;
      }
      setRngData(rngChunk);
      const firstOffset = rngChunk.getInt(0);
      const frames = Math.floor((firstOffset - 4) / 4);
      setTotalFrames(frames);

      const palette = palResources.loadPal(window.state ? window.state.paletteId : 0);
      const frameBuffer = new Uint8Array(320 * 200);

      const success = rngModule.decodeRngFrame(rngChunk, 0, frameBuffer);
      if (success) {
        const ctx = canvasRef.current.getContext('2d');
        const imageData = ctx.createImageData(320, 200);
        const data = imageData.data;
        for (let k = 0; k < 64000; k++) {
          const color = palette[frameBuffer[k]];
          data[k * 4 + 0] = (color >> 16) & 0xFF;
          data[k * 4 + 1] = (color >> 8) & 0xFF;
          data[k * 4 + 2] = color & 0xFF;
          data[k * 4 + 3] = (color >> 24) & 0xFF;
        }
        ctx.putImageData(imageData, 0, 0);
      }
    } catch (e) {
      console.error(`初始化 RNG #${rngId} 失败:`, e);
      setErrorText('[解析失败]');
    }
  }, [isIntersecting, rngId, loaderModule, palResources, rngModule]);

  // 离开视口时自动切断播放以释放计算性能
  useEffect(() => {
    if (!isIntersecting && isPlaying) {
      setActivePlayingId(null);
    }
  }, [isIntersecting, isPlaying, setActivePlayingId]);

  // 局域播放状态定时循环管理器
  useEffect(() => {
    if (!isPlaying || !rngData || totalFrames <= 0 || !palResources || !rngModule || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const palette = palResources.loadPal(window.state ? window.state.paletteId : 0);
    const frameBuffer = new Uint8Array(320 * 200);
    let currentFrame = 0;
    let timerId = null;

    const playNext = () => {
      if (currentFrame >= totalFrames) {
        currentFrame = 0;
        frameBuffer.fill(0);
      }

      const ok = rngModule.decodeRngFrame(rngData, currentFrame, frameBuffer);
      if (ok) {
        const imageData = ctx.createImageData(320, 200);
        const data = imageData.data;
        for (let k = 0; k < 64000; k++) {
          const color = palette[frameBuffer[k]];
          data[k * 4 + 0] = (color >> 16) & 0xFF;
          data[k * 4 + 1] = (color >> 8) & 0xFF;
          data[k * 4 + 2] = color & 0xFF;
          data[k * 4 + 3] = (color >> 24) & 0xFF;
        }
        ctx.putImageData(imageData, 0, 0);

        currentFrame++;
        timerId = setTimeout(playNext, 62.5);
      } else {
        setActivePlayingId(null);
      }
    };

    playNext();

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [isPlaying, rngData, totalFrames, palResources, rngModule, setActivePlayingId]);

  const handlePlayToggle = () => {
    if (isPlaying) {
      setActivePlayingId(null);
    } else {
      setActivePlayingId(rngId);
    }
  };

  return html`
    <div 
      ref=${containerRef}
      onMouseEnter=${(e) => {
        e.currentTarget.style.borderColor = 'var(--glow-green)';
        e.currentTarget.style.background = 'rgba(0, 255, 157, 0.02)';
      }}
      onMouseLeave=${(e) => {
        if (!isPlaying) {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.02)';
          e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
        }
      }}
      style=${{
        background: isPlaying ? 'rgba(0, 255, 157, 0.02)' : 'rgba(255,255,255,0.015)',
        border: isPlaying ? '1px solid var(--glow-green)' : '1px solid rgba(255,255,255,0.02)',
        borderRadius: '2px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        transition: 'all 0.1s',
        width: '156px',
        boxSizing: 'border-box'
      }}
    >
      <canvas 
        ref=${canvasRef} 
        width="320" 
        height="200" 
        style=${{
          width: '140px',
          height: '88px',
          background: '#000',
          borderRadius: '1px',
          imageRendering: 'pixelated',
          display: 'block'
        }} 
      />
      <span style=${{
        fontSize: '8px',
        color: 'rgba(255,255,255,0.3)',
        fontWeight: 'bold',
        marginTop: '4px',
        textAlign: 'center'
      }}>
        ${errorText ? `${labelText}\n${errorText}` : `${labelText} (${totalFrames} 帧)`}
      </span>
      <div style=${{ display: 'flex', gap: '4px', marginTop: '4px', width: '100%', justifyContent: 'center' }}>
        <button 
          onClick=${handlePlayToggle} 
          style=${{
            background: isPlaying ? 'rgba(255, 59, 111, 0.15)' : 'rgba(0, 255, 157, 0.1)',
            border: isPlaying ? '1px solid rgba(255, 59, 111, 0.25)' : '1px solid rgba(0, 255, 157, 0.2)',
            color: isPlaying ? 'var(--glow-red)' : 'var(--glow-green)',
            fontSize: '8.5px',
            padding: '2px 6px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontWeight: 'bold',
            outline: 'none',
            transition: 'all 0.1s'
          }}
        >
          ${isPlaying ? '⏸ 暂停' : '▶ 播放'}
        </button>
        <button 
          onClick=${() => onZoom(rngId, `${labelText} (${totalFrames} 帧)`)} 
          style=${{
            background: 'rgba(0, 225, 255, 0.1)',
            border: '1px solid rgba(0, 225, 255, 0.2)',
            color: 'var(--glow-blue)',
            fontSize: '8.5px',
            padding: '2px 6px',
            borderRadius: '2px',
            cursor: 'pointer',
            fontWeight: 'bold',
            outline: 'none',
            transition: 'all 0.1s'
          }}
        >
          🔍 放大
        </button>
      </div>
    </div>
  `;
}

// 5. 游戏背景 MIDI 音乐播放控制组件
function MusicItemCard({ musicId, labelText, musicModule, activePlayingId, setActivePlayingId }) {
  const isPlaying = activePlayingId === `music_${musicId}`;

  const handlePlayToggle = () => {
    if (!musicModule) return;

    if (isPlaying) {
      musicModule.stopMusic();
      setActivePlayingId(null);
    } else {
      musicModule.playMusic(musicId, true, 0);
      setActivePlayingId(`music_${musicId}`);
    }
  };

  const handleDownload = () => {
    if (!musicModule) return;
    const musMkf = musicModule.getMusMkf();

    if (!musMkf) {
      alert("当前环境未检测到 mus.mkf 归档文件。");
      return;
    }

    const total = Math.floor(musMkf.getInt(0) / 4) - 1;
    if (musicId >= total) {
      alert(`背景音乐索引 #${musicId} 越界 (归档文件内最大索引为: ${total - 1})`);
      return;
    }

    const start = musMkf.getInt(musicId * 4);
    const end = musMkf.getInt(musicId * 4 + 4);
    if (end <= start) {
      alert("该索引对应的音频块数据为空。");
      return;
    }

    const chunk = musMkf.slice(start, end);
    const bytes = new Uint8Array(chunk.length);

    for (let k = 0; k < chunk.length; k++) {
      bytes[k] = chunk.getByte(k);
    }

    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `music_${musicId}.rix`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return html`
    <div 
      onMouseEnter=${(e) => {
        e.currentTarget.style.borderColor = 'var(--glow-yellow)';
        e.currentTarget.style.background = 'rgba(253, 220, 132, 0.02)';
      }}
      onMouseLeave=${(e) => {
        if (!isPlaying) {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.02)';
          e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
        }
      }}
      style=${{
        background: isPlaying ? 'rgba(253, 220, 132, 0.02)' : 'rgba(255,255,255,0.015)',
        border: isPlaying ? '1px solid var(--glow-yellow)' : '1px solid rgba(255,255,255,0.02)',
        borderRadius: '2px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px',
        transition: 'all 0.1s',
        width: '140px',
        boxSizing: 'border-box',
        gap: '6px'
      }}
    >
      <span style=${{ fontSize: '20px' }}>🎵</span>
      <span style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', textAlign: 'center' }}>${labelText}</span>
      <button 
        onClick=${handlePlayToggle} 
        style=${{
          background: isPlaying ? 'rgba(255, 59, 111, 0.15)' : 'rgba(253, 220, 132, 0.1)',
          border: isPlaying ? '1px solid rgba(255, 59, 111, 0.3)' : '1px solid rgba(253, 220, 132, 0.2)',
          color: isPlaying ? '#ff3b6f' : 'var(--glow-yellow)',
          fontSize: '8px',
          padding: '2px 8px',
          borderRadius: '2px',
          cursor: 'pointer',
          fontWeight: 'bold',
          outline: 'none',
          transition: 'all 0.1s',
          width: '100%',
          textAlign: 'center'
        }}
      >
        ${isPlaying ? '■ 停止' : '▶ 播放'}
      </button>
      <button 
        onClick=${handleDownload} 
        style=${{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '8px',
          padding: '2px 4px',
          borderRadius: '2px',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.1s',
          width: '100%',
          textAlign: 'center'
        }}
      >
        📥 下载 RIX
      </button>
    </div>
  `;
}

// 6. 游戏技能与状态音效播放控制组件
function SoundItemCard({ soundId, labelText, soundModule }) {
  const isMuteBtn = soundId === 0;

  const handlePlay = async () => {
    if (!soundModule) return;
    if (isMuteBtn) {
      soundModule.stopAllSounds();
    } else {
      await soundModule.playSound(soundId);
    }
  };

  const handleDownload = () => {
    if (!soundModule) return;
    const vocMkf = soundModule.getVocMkf();
    const soundsMkf = soundModule.getSoundsMkf();
    const mkf = vocMkf || soundsMkf;

    if (!mkf) {
      alert("当前环境未检测到 voc.mkf / sounds.mkf 归档文件。");
      return;
    }

    const chunk = soundModule.getMkfChunk(mkf, soundId);
    if (!chunk) {
      alert(`无法获取特技音效索引 #${soundId} 的数据块`);
      return;
    }

    const bytes = new Uint8Array(chunk.length);
    for (let k = 0; k < chunk.length; k++) {
      bytes[k] = chunk.getByte(k);
    }

    const ext = soundModule.isVoc(chunk) ? 'voc' : 'wav';
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sound_${soundId}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return html`
    <div 
      onMouseEnter=${(e) => {
        e.currentTarget.style.borderColor = 'var(--glow-green)';
        e.currentTarget.style.background = 'rgba(0, 255, 157, 0.02)';
      }}
      onMouseLeave=${(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.02)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
      }}
      style=${{
        background: 'rgba(255,255,255,0.015)',
        border: '1px solid rgba(255,255,255,0.02)',
        borderRadius: '2px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px',
        transition: 'all 0.1s',
        width: '140px',
        boxSizing: 'border-box',
        gap: '6px'
      }}
    >
      <span style=${{ fontSize: '20px' }}>${isMuteBtn ? '🔇' : '🔊'}</span>
      <span style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', textAlign: 'center' }}>
        ${isMuteBtn ? '全部静音' : labelText}
      </span>
      <button 
        onClick=${handlePlay} 
        style=${{
          background: isMuteBtn ? 'rgba(255, 59, 111, 0.1)' : 'rgba(0, 255, 157, 0.1)',
          border: isMuteBtn ? '1px solid rgba(255, 59, 111, 0.2)' : '1px solid rgba(0, 255, 157, 0.2)',
          color: isMuteBtn ? '#ff3b6f' : 'var(--glow-green)',
          fontSize: '8px',
          padding: '2px 8px',
          borderRadius: '2px',
          cursor: 'pointer',
          fontWeight: 'bold',
          outline: 'none',
          transition: 'all 0.1s',
          width: '100%',
          textAlign: 'center'
        }}
      >
        ${isMuteBtn ? '■ 静音' : '▶ 播放'}
      </button>
      ${!isMuteBtn && html`
        <button 
          onClick=${handleDownload} 
          style=${{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '8px',
            padding: '2px 4px',
            borderRadius: '2px',
            cursor: 'pointer',
            outline: 'none',
            transition: 'all 0.1s',
            width: '100%',
            textAlign: 'center'
          }}
        >
          📥 下载 VOC
        </button>
      `}
    </div>
  `;
}

// 7. RNG 动画高清全屏独立播放器浮层子组件（支持滑动拖拽与实时渲染）
function RngPlayerModal({ rngPlayerState, setRngPlayerState, handleRngSliderChange, isVisible, isPlaying }) {
  if (!isVisible) return null;

  return html`
    <div id="rng-player-modal" style=${{ display: 'flex', position: 'fixed', zIndex: 100000, left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style=${{ '--modal-accent': 'var(--glow-green)', background: 'rgba(10,10,15,0.98)', border: '1px solid var(--glow-green)', borderRadius: '4px', boxShadow: '0 0 30px rgba(0, 255, 157, 0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'JetBrains Mono', sans-serif" }}>
        <!-- 播放器头部 -->
        <div class="tool-modal-header">
          <div class="tool-modal-title-row">
            <div class="tool-modal-dot"></div>
            <span class="tool-modal-heading">🎬 RNG 剧情全屏动画高清播放器</span>
          </div>
          <button onClick=${window.closeRngPlayer} class="tool-modal-close">✕</button>
        </div>

        <!-- 播放画面区 -->
        <div style=${{ flex: 1, display: 'flex', alignItems: 'center', justifyScontent: 'center', background: '#000', padding: '20px', overflow: 'auto', minWidth: '360px', minHeight: '240px' }}>
          <canvas id="rng-modal-canvas" width="320" height="200" style=${{ display: 'block', imageRendering: 'pixelated', background: '#000', boxShadow: '0 0 20px rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.05)', width: `${320 * rngPlayerState.scale}px`, height: `${200 * rngPlayerState.scale}px` }}></canvas>
        </div>

        <!-- 控制条控制区 -->
        <div style=${{ background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderTop: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <!-- 进度条 -->
          <div style=${{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="range" min="0" max=${Math.max(0, rngPlayerState.totalFrames - 1)} value=${rngPlayerState.currentFrame} onInput=${(e) => handleRngSliderChange(e.target.value)} style=${{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', outline: 'none', appearance: 'none', cursor: 'pointer', accentColor: 'var(--glow-green)' }} />
            <span style=${{ fontSize: '9px', color: 'var(--glow-yellow)', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace", minWidth: '60px', textAlign: 'right' }}>${rngPlayerState.currentFrame + 1} / ${rngPlayerState.totalFrames} 帧</span>
          </div>

          <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)' }}>${rngPlayerState.title}</span>
            
            <div style=${{ display: 'flex', gap: '8px', alignIitems: 'center' }}>
              <!-- 尺寸选择器 -->
              <div style=${{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px' }}>
                <span style=${{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>📺 分辨率:</span>
                <select value=${rngPlayerState.scale} onChange=${(e) => window.changeRngModalScale(e.target.value)} style=${{ background: '#08080c', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '8.5px', padding: '2px 4px', outline: 'none', cursor: 'pointer', borderRadius: '2px' }}>
                  <option value="1">320x200 (1X)</option>
                  <option value="2">640x400 (2X)</option>
                  <option value="3">960x600 (3X)</option>
                  <option value="4">1280x800 (4X)</option>
                </select>
              </div>

              <button class="btn-dbg" onClick=${window.toggleRngModalPlay} style=${{
                color: isPlaying ? 'var(--glow-red)' : 'var(--glow-green)',
                borderColor: isPlaying ? 'rgba(255, 59, 111, 0.25)' : 'rgba(0, 255, 157, 0.25)',
                background: isPlaying ? 'rgba(255, 59, 111, 0.05)' : 'rgba(0, 255, 157, 0.05)',
                padding: '2px 10px',
                fontSize: '8.5px',
                fontWeight: 'bold',
                borderRadius: '2px',
                cursor: 'pointer'
              }}>${isPlaying ? '⏸ 暂停' : '▶ 播放'}</button>
              <button class="btn-dbg" onClick=${window.closeRngPlayer} style=${{ color: '#fff', borderColor: 'rgba(255,255,255,0.1)', padding: '2px 10px', fontSize: '8.5px', borderRadius: '2px', cursor: 'pointer' }}>✕ 关闭</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 8. 资源浏览器主应用组件
function ImageExplorerApp() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentType, setCurrentType] = useState('rgm');
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(48);
  const [currentScale, setCurrentScale] = useState(2);
  const [totalItems, setTotalItems] = useState(0);
  const [subId, setSubId] = useState(0);

  // 双向绑定输入框状态
  const [mgoRoleId, setMgoRoleId] = useState('0');
  const [gopMapId, setGopMapId] = useState('12');

  // 底层 API 动态模块状态
  const [modules, setModules] = useState(null);

  // 全局微型卡片 RNG 活动播放 id 托管
  const [activePlayingId, setActivePlayingId] = useState(null);

  // 独立大尺寸 RNG 播放器状态
  const [rngPlayerState, setRngPlayerState] = useState({
    isVisible: false,
    rngId: 0,
    totalFrames: 0,
    currentFrame: 0,
    isPlaying: false,
    scale: 2,
    title: ''
  });

  const rngPlayerRef = useRef({
    rngChunk: null,
    palette: null,
    frameBuffer: new Uint8Array(320 * 200),
    loadedRngId: null
  });

  // 并发异步载入底层解析 API
  useEffect(() => {
    Promise.all([
      import('../resources/pal.js'),
      import('../resources/loader.js'),
      import('../engine/rng.js'),
      import('../resources/music.js'),
      import('../resources/sound.js')
    ]).then(([pal, loader, rng, music, sound]) => {
      setModules({ pal, loader, rng, music, sound });
      window.musicModule = music; // 保持全局引用兼容
    }).catch(e => console.error("加载底层 API 模块失败:", e));
  }, []);

  // 监听大弹窗关闭状态，并自动销毁/停止内部活动的所有声音与播放事件
  useEffect(() => {
    if (!isVisible) {
      setActivePlayingId(null);
      setRngPlayerState(prev => ({ ...prev, isPlaying: false, isVisible: false }));
      if (modules?.music) {
        modules.music.stopMusic();
      }
    }
  }, [isVisible, modules]);

  // 根据当前大类分类、二级分类、加载状态，精准实时重新计算资源子项总件数
  useEffect(() => {
    // 只有在弹窗可见且底层依赖模块已加载时，才重新计算资源总数，避免在刚进游戏尚未下载完成时触发报错
    if (!isVisible || !modules) return;

    const { pal, loader, music, sound } = modules;
    try {
      let total = 0;
      if (currentType === 'rgm') {
        const data = loader.load('rgm.mkf');
        total = data ? (data.getInt(0) / 4 - 1) : 0;
      } else if (currentType === 'fbp') {
        const data = loader.load('fbp.mkf');
        total = data ? (data.getInt(0) / 4 - 1) : 0;
      } else if (currentType === 'ball') {
        const data = loader.load('ball.mkf');
        total = data ? (data.getInt(0) / 4 - 1) : 0;
      } else if (currentType === 'mgo') {
        total = pal.loadMgoCount(subId) || 0;
      } else if (currentType === 'gop') {
        total = pal.mkf2Count('gop.mkf', subId) || 0;
      } else if (currentType === 'pic') {
        const pics = loader.loadMkf('data.mkf', 9);
        total = pics ? pics.getShort(0) : 0;
      } else if (currentType === 'msg') {
        const talk = loader.loadMkf('sss.mkf', 3);
        total = talk ? (talk.length / 4 - 1) : 0;
      } else if (currentType === 'wor16') {
        const data = loader.load('wor16.asc');
        total = data ? (data.length / 2) : 0;
      } else if (currentType === 'word') {
        const data = loader.load('word.dat');
        total = data ? (data.length / 10) : 0;
      } else if (currentType === 'rng') {
        const data = loader.load('rng.mkf');
        total = data ? (data.getInt(0) / 4 - 1) : 0;
      } else if (currentType === 'music') {
        const musMkf = music.getMusMkf();
        total = musMkf ? (Math.floor(musMkf.getInt(0) / 4) - 1) : 100;
      } else if (currentType === 'sound') {
        const vocMkf = sound.getVocMkf();
        const soundsMkf = sound.getSoundsMkf();
        const mkf = vocMkf || soundsMkf;
        total = mkf ? (Math.floor(mkf.getInt(0) / 4) - 1) : 250;
      }
      setTotalItems(total);
    } catch (e) {
      console.error("计算资源总数异常:", e);
      setTotalItems(0);
    }
  }, [currentType, subId, modules, isVisible]);

  // 大类选项卡切换逻辑，自动适配分辨率初始值与缩放
  const handleTypeChange = (type) => {
    setCurrentType(type);
    setCurrentPage(0);
    setActivePlayingId(null);

    if (type === 'msg') {
      setItemsPerPage(15);
      setCurrentScale(1.5);
    } else {
      setItemsPerPage(100000);
      if (type === 'rgm') setCurrentScale(1);
      else if (type === 'mgo') setCurrentScale(2);
      else if (type === 'fbp') setCurrentScale(1);
      else if (type === 'gop') setCurrentScale(1.5);
      else if (type === 'pic') setCurrentScale(2);
      else if (type === 'ball') setCurrentScale(2);
      else if (type === 'wor16') setCurrentScale(2);
      else if (type === 'word') setCurrentScale(2);
      else if (type === 'rng') setCurrentScale(1);
      else if (type === 'music') setCurrentScale(1);
      else if (type === 'sound') setCurrentScale(1);
    }
  };

  // 挂载 RNG 大屏幕独立循环渲染控制器
  useEffect(() => {
    if (!rngPlayerState.isVisible || !rngPlayerState.isPlaying || !modules) return;

    const { rng } = modules;
    const { rngId, totalFrames, currentFrame } = rngPlayerState;
    const { rngChunk, palette, frameBuffer } = rngPlayerRef.current;

    let chunk = rngChunk;
    if (!chunk || rngPlayerRef.current.loadedRngId !== rngId) {
      chunk = modules.loader.loadMkf('rng.mkf', rngId);
      rngPlayerRef.current.rngChunk = chunk;
      rngPlayerRef.current.palette = modules.pal.loadPal(window.state ? window.state.paletteId : 0);
      rngPlayerRef.current.loadedRngId = rngId;
    }

    const canvas = document.getElementById('rng-modal-canvas');
    if (!canvas || !chunk) return;

    let nextFrame = currentFrame;
    let timerId = null;

    const loop = () => {
      if (nextFrame >= totalFrames) {
        nextFrame = 0;
        frameBuffer.fill(0);
      }

      const ok = rng.decodeRngFrame(chunk, nextFrame, frameBuffer);
      if (ok) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(320, 200);
        const data = imageData.data;
        const pal = rngPlayerRef.current.palette;
        for (let k = 0; k < 64000; k++) {
          const color = pal[frameBuffer[k]];
          data[k * 4 + 0] = (color >> 16) & 0xFF;
          data[k * 4 + 1] = (color >> 8) & 0xFF;
          data[k * 4 + 2] = color & 0xFF;
          data[k * 4 + 3] = (color >> 24) & 0xFF;
        }
        ctx.putImageData(imageData, 0, 0);

        setRngPlayerState(prev => ({
          ...prev,
          currentFrame: nextFrame
        }));

        nextFrame++;
        timerId = setTimeout(loop, 62.5);
      } else {
        setRngPlayerState(prev => ({ ...prev, isPlaying: false }));
      }
    };

    timerId = setTimeout(loop, 62.5);

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [rngPlayerState.isVisible, rngPlayerState.isPlaying, rngPlayerState.rngId, rngPlayerState.totalFrames, modules]);

  // 处理大屏幕 RNG 播放器滑块手动拖拽及渲染
  const handleRngSliderChange = (val) => {
    const targetFrame = parseInt(val);
    if (!modules) return;

    const { rng } = modules;
    const { rngId } = rngPlayerState;
    const { rngChunk, palette, frameBuffer } = rngPlayerRef.current;

    let chunk = rngChunk;
    if (!chunk || rngPlayerRef.current.loadedRngId !== rngId) {
      chunk = modules.loader.loadMkf('rng.mkf', rngId);
      rngPlayerRef.current.rngChunk = chunk;
      rngPlayerRef.current.palette = modules.pal.loadPal(window.state ? window.state.paletteId : 0);
      rngPlayerRef.current.loadedRngId = rngId;
    }

    if (!chunk) return;

    frameBuffer.fill(0);
    for (let f = 0; f <= targetFrame; f++) {
      rng.decodeRngFrame(chunk, f, frameBuffer);
    }

    const canvas = document.getElementById('rng-modal-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.createImageData(320, 200);
      const data = imageData.data;
      const pal = rngPlayerRef.current.palette;
      for (let k = 0; k < 64000; k++) {
        const color = pal[frameBuffer[k]];
        data[k * 4 + 0] = (color >> 16) & 0xFF;
        data[k * 4 + 1] = (color >> 8) & 0xFF;
        data[k * 4 + 2] = color & 0xFF;
        data[k * 4 + 3] = (color >> 24) & 0xFF;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    setRngPlayerState(prev => ({
      ...prev,
      currentFrame: targetFrame,
      isPlaying: false
    }));
  };

  // 将所有与 HTML 原生交互绑定的全局方法映射注入组件生命周期，完成无感桥接
  useEffect(() => {
    window.openImageExplorer = () => {
      setIsVisible(true);
    };

    window.closeImageExplorer = () => {
      setIsVisible(false);
    };

    window.switchImageType = (type) => {
      handleTypeChange(type);
    };

    window.changeImageScale = (val) => {
      setCurrentScale(parseFloat(val));
    };

    window.onImageRoleSelect = (roleId) => {
      setSubId(parseInt(roleId));
      setMgoRoleId(roleId);
      setCurrentPage(0);
    };

    window.searchImageRole = () => {
      const roleIdInput = document.getElementById('input-image-role-id')?.value;
      if (roleIdInput !== undefined && roleIdInput !== '') {
        setSubId(parseInt(roleIdInput));
        setMgoRoleId(roleIdInput);
        setCurrentPage(0);
      }
    };

    window.onImageMapSelect = (mapId) => {
      setSubId(parseInt(mapId));
      setGopMapId(mapId);
      setCurrentPage(0);
    };

    window.searchImageMap = () => {
      const mapIdInput = document.getElementById('input-image-map-id')?.value;
      if (mapIdInput !== undefined && mapIdInput !== '') {
        setSubId(parseInt(mapIdInput));
        setGopMapId(mapIdInput);
        setCurrentPage(0);
      }
    };

    window.prevImagePage = () => {
      setCurrentPage(prev => Math.max(0, prev - 1));
    };

    window.nextImagePage = () => {
      const pageCount = Math.ceil(totalItems / itemsPerPage);
      setCurrentPage(prev => Math.min(pageCount - 1, prev + 1));
    };

    window.firstImagePage = () => {
      setCurrentPage(0);
    };

    window.lastImagePage = () => {
      const pageCount = Math.ceil(totalItems / itemsPerPage);
      setCurrentPage(Math.max(0, pageCount - 1));
    };

    window.changeImagePageLimit = (val) => {
      setItemsPerPage(parseInt(val));
      setCurrentPage(0);
    };

    window.openFrameGalleryToImageExplorer = () => {
      let roleId = 0;
      const heroDesc = document.getElementById('val-hero-desc');
      if (heroDesc) {
        const match = heroDesc.innerText.match(/Tile:\s*(\d+)/);
        if (match) roleId = parseInt(match[1]);
      }

      setIsVisible(true);
      handleTypeChange('mgo');
      setSubId(roleId);
      setMgoRoleId(String(roleId));
      setCurrentPage(0);
    };

    window.openRngPlayer = (rngId, labelText) => {
      setActivePlayingId(null);
      
      const rngChunk = modules?.loader?.loadMkf('rng.mkf', rngId);
      const firstOffset = rngChunk ? rngChunk.getInt(0) : 4;
      const frames = Math.floor((firstOffset - 4) / 4);

      rngPlayerRef.current.rngChunk = rngChunk;
      rngPlayerRef.current.palette = modules?.pal?.loadPal(window.state ? window.state.paletteId : 0);
      rngPlayerRef.current.loadedRngId = rngId;

      setRngPlayerState({
        isVisible: true,
        rngId,
        totalFrames: frames,
        currentFrame: 0,
        isPlaying: true,
        scale: 2,
        title: `正在播放: ${labelText}`
      });
    };

    window.closeRngPlayer = () => {
      setRngPlayerState(prev => ({ ...prev, isPlaying: false, isVisible: false }));
    };

    window.toggleRngModalPlay = () => {
      setRngPlayerState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    };

    window.changeRngModalScale = (scale) => {
      setRngPlayerState(prev => ({ ...prev, scale: parseInt(scale) || 2 }));
    };

    window.onRngSliderChange = (val) => {
      handleRngSliderChange(val);
    };
  }, [modules, totalItems, itemsPerPage]);

  // 计算当前分页的区间
  const startIdx = currentPage * itemsPerPage;
  const endIdx = Math.min(totalItems, startIdx + itemsPerPage);
  const pageCount = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // 用 useMemo 懒加载卡片，以优化高负载时的状态驱动反应效率
  const renderedItems = useMemo(() => {
    if (!modules || totalItems <= 0) return [];
    
    const items = [];
    const { pal, loader, rng, music, sound } = modules;

    for (let i = startIdx; i < endIdx; i++) {
      if (currentType === 'rgm') {
        items.push(html`<${LazySingleItemCard} key=${i} itemId=${i} itemLabelText=${`RGM #${i}`} scale=${currentScale} loadFn=${(id) => pal.loadRgm(id)} />`);
      } else if (currentType === 'fbp') {
        items.push(html`<${LazySingleItemCard} key=${i} itemId=${i} itemLabelText=${`FBP #${i}`} scale=${currentScale} loadFn=${(id) => pal.loadFbp(id)} />`);
      } else if (currentType === 'ball') {
        items.push(html`<${LazySingleItemCard} key=${i} itemId=${i} itemLabelText=${`BALL #${i}`} scale=${currentScale} loadFn=${(id) => pal.loadBall(id)} />`);
      } else if (currentType === 'mgo') {
        items.push(html`<${LazySingleItemCard} key=${i} itemId=${i} itemLabelText=${`MGO F:#${i}`} scale=${currentScale} loadFn=${(id) => pal.loadMgo(subId, id)} />`);
      } else if (currentType === 'gop') {
        items.push(html`<${LazySingleItemCard} key=${i} itemId=${i} itemLabelText=${`GOP #${i}`} scale=${currentScale} loadFn=${(id) => pal.loadGop(subId, id)} />`);
      } else if (currentType === 'pic') {
        items.push(html`<${LazySingleItemCard} key=${i} itemId=${i} itemLabelText=${`PIC #${i + 1}`} scale=${currentScale} loadFn=${(id) => pal.loadPic(id + 1)} />`);
      } else if (currentType === 'wor16') {
        const data = loader.load('wor16.asc');
        const code = data ? data.getShort(i * 2) : 0;
        items.push(html`<${LazySingleItemCard} key=${i} itemId=${i} itemLabelText=${`FON #${i}\n0x${code.toString(16).toUpperCase()}`} scale=${currentScale} loadFn=${(id) => pal.loadFon(id)} />`);
      } else if (currentType === 'msg') {
        items.push(html`<${MsgItemCard} key=${i} msgId=${i} labelText=${`MSG #${i}`} palResources=${pal} />`);
      } else if (currentType === 'word') {
        items.push(html`<${LazyWordItemCard} key=${i} wordId=${i} labelText=${`WORD #${i}`} loaderModule=${loader} palResources=${pal} />`);
      } else if (currentType === 'rng') {
        items.push(html`<${LazyRngItemCard} key=${i} rngId=${i} labelText=${`RNG #${i}`} loaderModule=${loader} palResources=${pal} rngModule=${rng} onZoom=${(id, lbl) => window.openRngPlayer(id, lbl)} activePlayingId=${activePlayingId} setActivePlayingId=${setActivePlayingId} />`);
      } else if (currentType === 'music') {
        items.push(html`<${MusicItemCard} key=${i} musicId=${i} labelText=${`BGM #${i}`} musicModule=${music} activePlayingId=${activePlayingId} setActivePlayingId=${setActivePlayingId} />`);
      } else if (currentType === 'sound') {
        items.push(html`<${SoundItemCard} key=${i} soundId=${i} labelText=${`SFX #${i}`} soundModule=${sound} />`);
      }
    }
    return items;
  }, [modules, currentType, currentPage, itemsPerPage, totalItems, subId, currentScale, activePlayingId]);

  if (!isVisible) return null;

  let totalText = `资源总数: ${totalItems} 个`;
  if (currentType === 'mgo') {
    totalText += ` (动作形象 ID: ${subId})`;
  } else if (currentType === 'gop') {
    totalText += ` (大地图 ID: ${subId})`;
  }

  return html`
    <!-- 资源浏览器面板容器 -->
    <div id="image-explorer-modal" style=${{ display: 'flex', position: 'fixed', zIndex: 99999, left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(5,5,8,0.75)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style=${{ '--modal-accent': 'var(--glow-green)', background: 'rgba(13,13,20,0.96)', border: '1px solid var(--glow-green)', borderRadius: '4px', boxShadow: '0 0 25px rgba(0, 255, 157, 0.15)', width: 'calc(100% - 40px)', height: 'calc(100% - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'JetBrains Mono', sans-serif" }}>
        
        <!-- 弹窗头部 -->
        <div class="tool-modal-header">
          <div class="tool-modal-title-row">
            <div class="tool-modal-dot"></div>
            <span class="tool-modal-heading" style=${{ textTransform: 'uppercase' }}>🖼️ PAL IMAGE RESOURCE EXPLORER (图片精灵资源浏览器)</span>
          </div>
          <button onClick=${window.closeImageExplorer} class="tool-modal-close">✕</button>
        </div>
        
        <!-- 图片大类 Tabs 切换栏 -->
        <div class="tool-modal-tabbar">
          <button class=${`btn-dbg image-tab-btn tool-modal-tab-btn tool-modal-tab-btn--compact ${currentType === 'rgm' ? 'active' : ''}`} onClick=${() => handleTypeChange('rgm')} style=${{ '--tab-accent': 'var(--glow-green)' }}>头像界面 (rgm.mkf)</button>
          <button class=${`btn-dbg image-tab-btn tool-modal-tab-btn tool-modal-tab-btn--compact ${currentType === 'mgo' ? 'active' : ''}`} onClick=${() => handleTypeChange('mgo')}>角色动作 (mgo.mkf)</button>
          <button class=${`btn-dbg image-tab-btn tool-modal-tab-btn tool-modal-tab-btn--compact ${currentType === 'fbp' ? 'active' : ''}`} onClick=${() => handleTypeChange('fbp')}>背景原画 (fbp.mkf)</button>
          <button class=${`btn-dbg image-tab-btn tool-modal-tab-btn tool-modal-tab-btn--compact ${currentType === 'gop' ? 'active' : ''}`} onClick=${() => handleTypeChange('gop')}>场景图元 (gop.mkf)</button>
          <button class=${`btn-dbg image-tab-btn tool-modal-tab-btn tool-modal-tab-btn--compact ${currentType === 'pic' ? 'active' : ''}`} onClick=${() => handleTypeChange('pic')}>物品效果 (data.mkf #9)</button>
          <button class=${`btn-dbg image-tab-btn tool-modal-tab-btn tool-modal-tab-btn--compact ${currentType === 'ball' ? 'active' : ''}`} onClick=${() => handleTypeChange('ball')}>物品小图标 (ball.mkf)</button>
          <button class=${`btn-dbg image-tab-btn tool-modal-tab-btn tool-modal-tab-btn--compact ${currentType === 'msg' ? 'active' : ''}`} onClick=${() => handleTypeChange('msg')}>剧情文本 (msg)</button>
          <button class=${`btn-dbg image-tab-btn tool-modal-tab-btn tool-modal-tab-btn--compact ${currentType === 'wor16' ? 'active' : ''}`} onClick=${() => handleTypeChange('wor16')}>点阵字库 (wor16.asc)</button>
          <button class=${`btn-dbg image-tab-btn tool-modal-tab-btn tool-modal-tab-btn--compact ${currentType === 'word' ? 'active' : ''}`} onClick=${() => handleTypeChange('word')}>短语资源 (word.dat)</button>
          <button class=${`btn-dbg image-tab-btn tool-modal-tab-btn tool-modal-tab-btn--compact ${currentType === 'rng' ? 'active' : ''}`} onClick=${() => handleTypeChange('rng')}>全屏动画 (rng.mkf)</button>
          <button class=${`btn-dbg image-tab-btn tool-modal-tab-btn tool-modal-tab-btn--compact ${currentType === 'music' ? 'active' : ''}`} onClick=${() => handleTypeChange('music')}>背景音乐 (mus.mkf)</button>
          <button class=${`btn-dbg image-tab-btn tool-modal-tab-btn tool-modal-tab-btn--compact ${currentType === 'sound' ? 'active' : ''}`} onClick=${() => handleTypeChange('sound')}>游戏音效 (voc.mkf)</button>
        </div>

        <!-- 二级筛选项控制栏 (根据选中的类型动态显示) -->
        <div style=${{ background: 'rgba(0,0,0,0.25)', padding: '6px 12px', borderBottom: '1px solid var(--border-glass)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <!-- MGO (角色) 筛选项 -->
          ${currentType === 'mgo' && html`
            <div id="filter-mgo-container" style=${{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style=${{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>👤 形象:</span>
              <select value=${mgoRoleId} onChange=${(e) => window.onImageRoleSelect(e.target.value)} style=${{ background: '#08080c', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: '8.5px', padding: '2px 4px', outline: 'none', width: '140px', cursor: 'pointer' }}>
                <option value="0">Role 0 (李逍遥)</option>
                <option value="1">Role 1 (赵灵儿 - 披发)</option>
                <option value="2">Role 2 (林月如)</option>
                <option value="3">Role 3 (阿奴)</option>
                <option value="4">Role 4 (赵灵儿 - 蛇身)</option>
                <option value="10">Role 10 (李大娘)</option>
                <option value="11">Role 11 (苗人首领)</option>
                <option value="12">Role 12 (苗人手下)</option>
                <option value="21">Role 21 (村口黄狗)</option>
                <option value="53">Role 53 (集市商贩)</option>
              </select>
              <span style=${{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>或输入动作包 ID:</span>
              <input type="number" id="input-image-role-id" value=${mgoRoleId} min="0" max="636" onInput=${(e) => setMgoRoleId(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && window.searchImageRole()} style=${{ background: '#08080c', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: '8.5px', padding: '2px 4px', width: '50px', outline: 'none', textAlign: 'center' }} />
              <button class="btn-dbg" onClick=${window.searchImageRole} style=${{ color: 'var(--glow-green)', borderColor: 'rgba(0,255,157,0.2)', padding: '2px 6px', fontSize: '8.5px', cursor: 'pointer' }}>载入动作</button>
            </div>
          `}

          <!-- GOP (图元) 筛选项 -->
          ${currentType === 'gop' && html`
            <div id="filter-gop-container" style=${{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style=${{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>🗺️ 场景图元包 (对应大地图 ID):</span>
              <select value=${gopMapId} onChange=${(e) => window.onImageMapSelect(e.target.value)} style=${{ background: '#08080c', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: '8.5px', padding: '2px 4px', outline: 'none', width: '150px', cursor: 'pointer' }}>
                <option value="12">Map 12 (盛渔村/客栈)</option>
                <option value="1">Map 1 (李逍遥家/卧室)</option>
                <option value="10">Map 10 (盛渔村客栈房)</option>
                <option value="16">Map 16 (仙灵岛荷花池)</option>
                <option value="20">Map 20 (仙灵岛水月宫)</option>
                <option value="24">Map 24 (十里坡)</option>
              </select>
              <span style=${{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>或输入大地图 ID (0-225):</span>
              <input type="number" id="input-image-map-id" value=${gopMapId} min="0" max="225" onInput=${(e) => setGopMapId(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && window.searchImageMap()} style=${{ background: '#08080c', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: '8.5px', padding: '2px 4px', width: '50px', outline: 'none', textAlign: 'center' }} />
              <button class="btn-dbg" onClick=${window.searchImageMap} style=${{ color: 'var(--glow-green)', borderColor: 'rgba(0,255,157,0.2)', padding: '2px 6px', fontSize: '8.5px', cursor: 'pointer' }}>载入图元</button>
            </div>
          `}

          <!-- 全局缩放比例滑块 -->
          <div style=${{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            <span style=${{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>🔍 像素放大:</span>
            <input type="range" min="1" max="4" step="0.5" value=${currentScale} onInput=${(e) => window.changeImageScale(e.target.value)} style=${{ width: '80px', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', outline: 'none', appearance: 'none', cursor: 'pointer' }} />
            <span style=${{ fontSize: '8.5px', color: 'var(--glow-yellow)', fontWeight: 'bold', minWidth: '18px' }}>${currentScale}X</span>
          </div>
        </div>

        <!-- 资源平铺展示画廊区 -->
        <div id="image-gallery-container" style=${{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', background: '#040406', alignContent: 'start', '--image-explorer-scale': currentScale }}>
          ${!modules ? html`<span style=${{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', gridColumn: 'span 8', textAlign: 'center', width: '100%' }}>正在初始化底层解包引擎并载入依赖归档文件...</span>` : 
            (totalItems <= 0 ? html`<span style=${{ color: 'rgba(255,255,255,0.25)', fontSize: '9.5px', gridColumn: 'span 8', textAlign: 'center', width: '100%' }}>未找到有效精灵资源，或该资源包内数据为空</span>` : renderedItems)
          }
        </div>

        <!-- 底部导航与分页面板 -->
        <div style=${{ background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style=${{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style=${{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>${totalText}</span>
          </div>
          
          <!-- 分页控制器（仅剧情文本 MSG 激活，其它类型平铺懒加载） -->
          ${currentType === 'msg' && html`
            <div id="image-page-controller" style=${{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select value=${itemsPerPage} onChange=${(e) => window.changeImagePageLimit(e.target.value)} style=${{ background: '#08080c', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '8.5px', padding: '2px 4px', outline: 'none', cursor: 'pointer', borderRadius: '2px', marginRight: '6px' }}>
                <option value="15">15 句/页</option>
                <option value="30">30 句/页</option>
                <option value="50">50 句/页</option>
                <option value="100">100 句/页</option>
              </select>
              <button class="btn-dbg" onClick=${window.firstImagePage} disabled=${currentPage === 0} style=${{ color: '#fff', padding: '2px 8px', fontSize: '9px', borderColor: 'rgba(255,255,255,0.1)', cursor: 'pointer', opacity: currentPage === 0 ? 0.4 : 1 }}>⏮ 首页</button>
              <button class="btn-dbg" onClick=${window.prevImagePage} disabled=${currentPage === 0} style=${{ color: '#fff', padding: '2px 8px', fontSize: '9px', borderColor: 'rgba(255,255,255,0.1)', cursor: 'pointer', opacity: currentPage === 0 ? 0.4 : 1 }}>◀ 上一页</button>
              <span style=${{ fontSize: '9.5px', color: 'var(--glow-yellow)', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace" }}>${currentPage + 1} / ${pageCount}</span>
              <button class="btn-dbg" onClick=${window.nextImagePage} disabled=${currentPage === pageCount - 1} style=${{ color: '#fff', padding: '2px 8px', fontSize: '9px', borderColor: 'rgba(255,255,255,0.1)', cursor: 'pointer', opacity: currentPage === pageCount - 1 ? 0.4 : 1 }}>下一页 ▶</button>
              <button class="btn-dbg" onClick=${window.lastImagePage} disabled=${currentPage === pageCount - 1} style=${{ color: '#fff', padding: '2px 8px', fontSize: '9px', borderColor: 'rgba(255,255,255,0.1)', cursor: 'pointer', opacity: currentPage === pageCount - 1 ? 0.4 : 1 }}>尾页 ⏭</button>
            </div>
          `}
        </div>
      </div>

      <!-- 独立大尺寸全屏动画播放浮层（在激活时渲染） -->
      <${RngPlayerModal} 
        rngPlayerState=${rngPlayerState} 
        setRngPlayerState=${setRngPlayerState} 
        handleRngSliderChange=${handleRngSliderChange} 
        isVisible=${rngPlayerState.isVisible} 
        isPlaying=${rngPlayerState.isPlaying} 
      />
    </div>
  `;
}

// 资源浏览器 React 初始化挂载入口
export function initImageExplorer() {
  const container = document.getElementById('image-explorer-root');
  if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(html`<${ImageExplorerApp} />`);
  }
}
