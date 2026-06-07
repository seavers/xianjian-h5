// ==================== 🖼️ 仙剑实时战斗图片资料与特效画廊 React 核心逻辑 ====================

import { loadMkf, load } from '../resources/loader.js';
import { deyj } from '../utils/deyj.js';
import { loadSpriteFrame } from '../battle/battleData.js';
import { loadMkf2 } from '../resources/pal.js';
import { React, ReactDOM, html, drawPixelatedToCanvas } from './gameData/react-helper.js';

const { useState, useEffect, useRef, useMemo } = React;

// 步骤 1：获取常规 MKF 文件的子块总包数
function getMkfBlockCount(filename) {
  try {
    const data = load(filename);
    if (!data) return 0;
    
    // 第一个子块的偏移值除以 4 减去 1 就是包的总数
    return Math.floor(data.getInt(0) / 4) - 1;
  } catch (e) {
    console.error(`[BattleImageUI] 无法解析 ${filename} 的包总数:`, e);
    return 0;
  }
}

// 步骤 2：获取 data.mkf #10 (二级 MKF) 的子包总数
function getBattleEffectBlockCount() {
  try {
    const effectMkf = loadMkf('data.mkf', 10);
    if (!effectMkf) return 0;
    
    // 同样通过首块偏移计算子包数量
    return Math.floor(effectMkf.getInt(0) / 4) - 1;
  } catch (e) {
    console.error('[BattleImageUI] 无法解析 data.mkf #10 的子包数:', e);
    return 0;
  }
}

// 步骤 3：获取指定精灵包的总帧数
function getFrameCount(tabName, packId) {
  try {
    let spriteData = null;
    
    // 区分常规 mkf 文件与嵌套在 data.mkf 中的战斗效果图
    if (tabName === 'data10') {
      const effectMkf = loadMkf('data.mkf', 10);
      const subData = loadMkf2(effectMkf, packId);
      if (!subData) return 0;
      spriteData = deyj(subData);
    } else {
      let filename = 'abc.mkf';
      if (tabName === 'f') filename = 'f.mkf';
      else if (tabName === 'fire') filename = 'fire.mkf';
      
      const mkfData = loadMkf(filename, packId);
      if (!mkfData) return 0;
      spriteData = deyj(mkfData);
    }
    
    if (!spriteData) return 0;
    
    // 首个 short 记录了帧数限制
    return spriteData.getShort(0);
  } catch (e) {
    return 0;
  }
}

// 步骤 4：在指定 Canvas 上精准渲染某帧战斗精灵/特效图片
function drawFrameToCanvas(canvasEl, tabName, packId, frameId) {
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  try {
    let spriteData = null;
    
    if (tabName === 'data10') {
      const effectMkf = loadMkf('data.mkf', 10);
      const subData = loadMkf2(effectMkf, packId);
      if (subData) {
        spriteData = deyj(subData);
      }
    } else {
      let filename = 'abc.mkf';
      if (tabName === 'f') filename = 'f.mkf';
      else if (tabName === 'fire') filename = 'fire.mkf';
      
      const mkfData = loadMkf(filename, packId);
      if (mkfData) {
        spriteData = deyj(mkfData);
      }
    }
    
    if (!spriteData) return;

    const frameCanvas = loadSpriteFrame(spriteData, frameId);
    if (!frameCanvas) return;

    // 居中自适应绘制
    const dx = Math.floor((canvasEl.width - frameCanvas.width) / 2);
    const dy = Math.floor((canvasEl.height - frameCanvas.height) / 2);
    ctx.drawImage(frameCanvas, dx, dy);
  } catch (e) {
    // 渲染错误时不输出日志，避免由于越界帧造成的控制台卡顿
  }
}

// 🖼️ 战斗图片与特效资料监视 App 根组件
export function BattleImageApp() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('abc');
  const [selectedPackId, setSelectedPackId] = useState(0);
  const [selectedFrameId, setSelectedFrameId] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeedMs, setPlaySpeedMs] = useState(150);

  const mainCanvasRef = useRef(null);

  // 绑定全局方法以供原生调用（保持前后兼容）
  useEffect(() => {
    window.openBattleImageModal = () => {
      setIsOpen(true);
    };

    window.closeBattleImageModal = () => {
      setIsOpen(false);
    };

    window.switchBattleImageTab = (tabName) => {
      setActiveTab(tabName);
      setSelectedPackId(0);
      setSelectedFrameId(0);
      setIsPlaying(false);
    };

    window.onBattleImagePackSelect = (packId) => {
      setSelectedPackId(packId);
      setSelectedFrameId(0);
      setIsPlaying(false);
    };

    window.toggleBattleImagePlay = () => {
      setIsPlaying(prev => !prev);
    };

    window.selectBattleImageFrameDirectly = (frameId) => {
      setIsPlaying(false);
      setSelectedFrameId(frameId);
    };

    window.changeBattleImagePlaySpeed = (ms) => {
      setPlaySpeedMs(parseInt(ms, 10));
    };
  }, []);

  // 获取子包总数与资源描述
  const { totalPacks, tabTitleDesc } = useMemo(() => {
    let packs = 0;
    let desc = '';
    
    if (activeTab === 'abc') {
      packs = getMkfBlockCount('abc.mkf');
      desc = '敌人精灵贴图 (abc.mkf)';
    } else if (activeTab === 'f') {
      packs = getMkfBlockCount('f.mkf');
      desc = '玩家战斗精灵贴图 (f.mkf)';
    } else if (activeTab === 'fire') {
      packs = getMkfBlockCount('fire.mkf');
      desc = '魔法特效贴图 (fire.mkf)';
    } else if (activeTab === 'data10') {
      packs = getBattleEffectBlockCount();
      desc = '战斗命中效果贴图 (data.mkf #10)';
    }
    
    return { totalPacks: packs, tabTitleDesc: desc };
  }, [activeTab]);

  const maxFrames = useMemo(() => getFrameCount(activeTab, selectedPackId), [activeTab, selectedPackId]);

  // 重置帧索引
  useEffect(() => {
    setSelectedFrameId(0);
  }, [activeTab, selectedPackId]);

  // 自动播放时钟
  useEffect(() => {
    if (!isPlaying || maxFrames <= 0) return;

    const timer = setInterval(() => {
      setSelectedFrameId(prev => (prev + 1) % maxFrames);
    }, playSpeedMs);

    return () => clearInterval(timer);
  }, [isPlaying, maxFrames, playSpeedMs]);

  // 绘制主图 Canvas
  useEffect(() => {
    if (!mainCanvasRef.current) return;
    drawFrameToCanvas(mainCanvasRef.current, activeTab, selectedPackId, selectedFrameId);
  }, [activeTab, selectedPackId, selectedFrameId]);

  if (!isOpen) {
    return null;
  }

  const tabs = [
    { id: 'abc', label: '👹 敌人精灵图Abc.mkf' },
    { id: 'f', label: '⚔️ 玩家战斗精灵图 f.mkf' },
    { id: 'fire', label: '🔥 魔法特效 fire.mkf' },
    { id: 'data10', label: '💥 战斗效果图 data.mkf #10' }
  ];

  // 渲染帧缩略图 Canvas 子组件
  function ThumbCard({ fIdx }) {
    const thumbRef = useRef(null);

    useEffect(() => {
      if (!thumbRef.current) return;
      drawFrameToCanvas(thumbRef.current, activeTab, selectedPackId, fIdx);
    }, [activeTab, selectedPackId, fIdx]);

    const isSelected = selectedFrameId === fIdx;

    return html`
      <div 
        key=${fIdx}
        onClick=${() => { setIsPlaying(false); setSelectedFrameId(fIdx); }} 
        class="battleimage-thumb-item" 
        style=${{
          border: `1px solid ${isSelected ? '#00fffa' : 'rgba(255,255,255,0.04)'}`,
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '2px',
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3px',
          cursor: 'pointer',
          transition: 'all 0.1s'
        }}
      >
        <canvas ref=${thumbRef} width="40" height="40" style=${{ imageRendering: 'pixelated', width: '40px', height: '40px', background: 'rgba(0,0,0,0.5)' }}></canvas>
        <span style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.35)' }}>第 ${fIdx} 帧</span>
      </div>
    `;
  }

  return html`
    <div id="battle-image-modal" style=${{ display: 'flex', position: 'fixed', zIndex: 99999, left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(5,5,8,0.75)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style=${{ background: 'rgba(10,13,20,0.96)', border: '1px solid #00fffa', borderRadius: '4px', boxShadow: '0 0 25px rgba(0, 255, 250, 0.15)', width: 'calc(100% - 40px)', height: 'calc(100% - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'JetBrains Mono', sans-serif" }}>
        <!-- 弹窗头部 -->
        <div class="tool-modal-header" style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid var(--border-glass)' }}>
          <div class="tool-modal-title-row" style=${{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div class="tool-modal-dot" style=${{ width: '5px', height: '5px', background: '#00fffa', borderRadius: '50%', boxShadow: '0 0 6px #00fffa' }}></div>
            <span class="tool-modal-heading" style=${{ fontSize: '11px', fontWeight: 'bold', color: '#00fffa', letterSpacing: '0.5px', textTransform: 'uppercase' }}>🖼️ PAL BATTLE IMAGES & FX SYSTEM (战斗实时图片与特效预览系统)</span>
          </div>
          <button onClick=${() => setIsOpen(false)} class="tool-modal-close" style=${{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '14px', cursor: 'pointer', outline: 'none' }}>✕</button>
        </div>
        
        <!-- 资料大类 Tabs 切换栏 -->
        <div class="tool-modal-tabbar" style=${{ background: 'rgba(0,0,0,0.4)', padding: '6px 12px', borderBottom: '1px solid var(--border-glass)', display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          ${tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return html`
              <button 
                key=${tab.id}
                class=${`btn-dbg battleimage-tab-btn ${isActive ? 'active' : ''}`}
                onClick=${() => {
                  setActiveTab(tab.id);
                  setSelectedPackId(0);
                  setSelectedFrameId(0);
                  setIsPlaying(false);
                }}
                style=${{
                  color: isActive ? '#00fffa' : 'rgba(255,255,255,0.6)',
                  borderColor: isActive ? '#00fffa' : 'rgba(255,255,255,0.06)',
                  background: isActive ? 'rgba(0, 255, 250, 0.05)' : 'transparent',
                  padding: '2px 10px',
                  fontSize: '8.5px',
                  cursor: 'pointer'
                }}
              >${tab.label}</button>
            `;
          })}
        </div>

        <!-- 主内容展示区 -->
        <div id="battleimage-main-container" style=${{ flex: 1, display: 'flex', overflow: 'hidden', background: '#030305' }}>
          <!-- 左侧包名册列表 -->
          <div style=${{ width: '200px', borderRight: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style=${{ padding: '10px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid var(--border-glass)', fontSize: '9.5px', fontWeight: 'bold', color: '#00fffa', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📦 精灵数据包</span>
              <span style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.25)', fontWeight: 'normal' }}>共 ${totalPacks} 包</span>
            </div>
            <div style=${{ flex: 1, overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              ${Array.from({ length: totalPacks }).map((_, idx) => {
                const isSelected = selectedPackId === idx;
                return html`
                  <div 
                    key=${idx}
                    onClick=${() => { setSelectedPackId(idx); setIsPlaying(false); }} 
                    style=${{
                      padding: '6px 10px',
                      background: isSelected ? 'rgba(0, 255, 250, 0.08)' : 'rgba(255,255,255,0.015)',
                      border: `1px solid ${isSelected ? '#00fffa' : 'rgba(255,255,255,0.03)'}`,
                      borderRadius: '2px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.1s'
                    }}
                  >
                    <span style=${{ fontSize: '9px', fontWeight: 'bold', color: isSelected ? '#00fffa' : '#fff' }}>精灵包 #${idx}</span>
                    <span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.25)' }}>帧数: ${getFrameCount(activeTab, idx)}</span>
                  </div>
                `;
              })}
            </div>
          </div>

          <!-- 右侧预览与帧缩略图 -->
          <div style=${{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '15px' }}>
            <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style=${{ fontSize: '13px', fontWeight: 'bold', color: '#00fffa' }}>${tabTitleDesc} • 包 #${selectedPackId}</div>
              <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>Sprite Frame Player</div>
            </div>

            <!-- 主 Canvas 图与自动播放 -->
            <div style=${{ display: 'flex', gap: '15px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: '2px', marginBottom: '12px', alignItems: 'center' }}>
              <div style=${{ width: '128px', height: '128px', background: 'rgba(5,5,8,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)' }}>
                <canvas ref=${mainCanvasRef} width="120" height="120" style=${{ imageRendering: 'pixelated', width: '120px', height: '120px' }}></canvas>
              </div>
              <div style=${{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '128px' }}>
                <div>
                  <div style=${{ fontSize: '10px', color: '#fff', marginBottom: '4px' }}>当前帧: ${selectedFrameId} / ${maxFrames - 1}</div>
                  <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', lineHeight: '1.3' }}>该包下包含不同帧切切片，您可以通过自动播放来连续预览其动画效果，或直接点击下方缩略图切至单帧。</div>
                </div>
                
                <div style=${{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button class="btn-dbg" onClick=${() => setIsPlaying(!isPlaying)} style=${{ color: '#00fffa', borderColor: 'rgba(0,255,250,0.2)', padding: '3px 10px', fontSize: '9px', cursor: 'pointer' }}>${isPlaying ? '⏸️ 停止播放' : '▶️ 自动播放'}</button>
                  <div style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>速度(延时):</span>
                    <input type="range" min="50" max="400" step="20" value=${playSpeedMs} onInput=${(e) => setPlaySpeedMs(parseInt(e.target.value, 10))} style=${{ width: '80px', accentColor: '#00fffa', cursor: 'pointer' }}></input>
                    <span style=${{ color: '#ffd000', fontWeight: 'bold' }}>${playSpeedMs}ms</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 横向/纵向帧缩略图画廊 -->
            <div style=${{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>全部帧图像缩略图名册</div>
              <div style=${{ overflowY: 'auto', display: 'flex', gap: '4px', paddingRight: '2px' }}>
                ${Array.from({ length: maxFrames }).map((_, fIdx) => html`
                  <${ThumbCard} key=${fIdx} fIdx=${fIdx} />
                `)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 惰性挂载入口
let reactRoot = null;

export function openBattleImageModal() {
  const container = document.getElementById('battle-image-modal-root');
  if (container && !reactRoot) {
    reactRoot = ReactDOM.createRoot(container);
    reactRoot.render(html`<${BattleImageApp} />`);

    setTimeout(() => {
      if (window.openBattleImageModal && window.openBattleImageModal !== openBattleImageModal) {
        window.openBattleImageModal();
      }
    }, 50);
  } else if (window.openBattleImageModal && window.openBattleImageModal !== openBattleImageModal) {
    window.openBattleImageModal();
  }
}

export function closeBattleImageModal() {
  if (window.closeBattleImageModal && window.closeBattleImageModal !== closeBattleImageModal) {
    window.closeBattleImageModal();
  }
}

export function switchBattleImageTab(tabName) {
  if (window.switchBattleImageTab && window.switchBattleImageTab !== switchBattleImageTab) {
    window.switchBattleImageTab(tabName);
  }
}

export function onBattleImagePackSelect(packId) {
  if (window.onBattleImagePackSelect) {
    window.onBattleImagePackSelect(packId);
  }
}

export function toggleBattleImagePlay() {
  if (window.toggleBattleImagePlay) {
    window.toggleBattleImagePlay();
  }
}

export function selectBattleImageFrameDirectly(frameId) {
  if (window.selectBattleImageFrameDirectly) {
    window.selectBattleImageFrameDirectly(frameId);
  }
}

export function changeBattleImagePlaySpeed(ms) {
  if (window.changeBattleImagePlaySpeed) {
    window.changeBattleImagePlaySpeed(ms);
  }
}
