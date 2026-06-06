// ==================== 🖼️ 仙剑实时战斗图片资料与特效画廊核心逻辑 ====================

import { loadMkf, load } from '../resources/loader.js';
import { deyj } from '../utils/deyj.js';
import { loadSpriteFrame } from '../battle/battleData.js';
import { loadMkf2 } from '../resources/pal.js';

// 当前处于激活态的二级 Tab ('abc' | 'f' | 'fire' | 'data10')
let activeImageTab = 'abc';

// 当前选中的精灵包 ID
let selectedPackId = 0;

// 当前选中的帧索引
let selectedFrameId = 0;

// 动画播放定时器
let imagePlayTimer = null;

// 自动播放时的当前帧
let currentPlayFrame = 0;

// 默认每帧播放延时 150ms
let imagePlaySpeedMs = 150;

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

// ==================== 🚀 弹窗开启、关闭与大分类 Tab 切换控制 ====================

export function openBattleImageModal() {
  const modal = document.getElementById('battle-image-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
  switchBattleImageTab(activeImageTab);
}

export function closeBattleImageModal() {
  const modal = document.getElementById('battle-image-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  stopImagePlayTimer();
}

export function switchBattleImageTab(tabName) {
  activeImageTab = tabName;
  selectedPackId = 0;
  selectedFrameId = 0;
  stopImagePlayTimer();

  // 选项卡切换状态高亮 (青色配色风格)
  document.querySelectorAll('.battleimage-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.style.color = 'rgba(255,255,255,0.6)';
    btn.style.borderColor = 'rgba(255,255,255,0.06)';
    btn.style.background = 'transparent';
  });
  
  const activeTabBtn = document.getElementById(`battleimage-tab-${tabName}`);
  if (activeTabBtn) {
    activeTabBtn.classList.add('active');
    activeTabBtn.style.color = '#00fffa';
    activeTabBtn.style.borderColor = '#00fffa';
    activeTabBtn.style.background = 'rgba(0, 255, 250, 0.05)';
  }

  // 渲染主体内容区域
  const mainContainer = document.getElementById('battleimage-main-container');
  if (!mainContainer) return;

  renderBattleImageTab(mainContainer);
}

// ==================== 🖼️ 精灵包及帧的详细展现与自动播放逻辑 ====================

function stopImagePlayTimer() {
  if (imagePlayTimer) {
    clearInterval(imagePlayTimer);
    imagePlayTimer = null;
  }
}

export function onBattleImagePackSelect(packId) {
  selectedPackId = packId;
  selectedFrameId = 0;
  stopImagePlayTimer();

  const mainContainer = document.getElementById('battleimage-main-container');
  if (mainContainer) {
    renderBattleImageTab(mainContainer);
  }
}

export function toggleBattleImagePlay() {
  const btn = document.getElementById('battleimage-play-btn');
  if (imagePlayTimer) {
    stopImagePlayTimer();
    if (btn) btn.innerText = '▶️ 自动播放';
  } else {
    const maxFrames = getFrameCount(activeImageTab, selectedPackId);
    if (maxFrames <= 0) return;

    if (btn) btn.innerText = '⏸️ 停止播放';
    currentPlayFrame = selectedFrameId;

    imagePlayTimer = setInterval(() => {
      currentPlayFrame = (currentPlayFrame + 1) % maxFrames;
      selectedFrameId = currentPlayFrame;

      // 实时绘制大画布
      const mainCanvas = document.getElementById('battleimage-main-canvas');
      drawFrameToCanvas(mainCanvas, activeImageTab, selectedPackId, selectedFrameId);

      // 高亮当前选中的缩略图项并重置其他项的边框颜色
      document.querySelectorAll('.battleimage-thumb-item').forEach(item => {
        item.style.borderColor = 'rgba(255,255,255,0.04)';
      });
      const activeThumb = document.getElementById(`battleimage-thumb-${selectedFrameId}`);
      if (activeThumb) {
        activeThumb.style.borderColor = '#00fffa';
      }

      // 更新下方帧描述标签
      const lbl = document.getElementById('battleimage-frame-desc');
      if (lbl) lbl.innerText = `当前帧: ${selectedFrameId} / ${maxFrames - 1}`;

    }, imagePlaySpeedMs);
  }
}

export function selectBattleImageFrameDirectly(frameId) {
  stopImagePlayTimer();
  const btn = document.getElementById('battleimage-play-btn');
  if (btn) btn.innerText = '▶️ 自动播放';

  selectedFrameId = frameId;
  const mainCanvas = document.getElementById('battleimage-main-canvas');
  drawFrameToCanvas(mainCanvas, activeImageTab, selectedPackId, selectedFrameId);

  document.querySelectorAll('.battleimage-thumb-item').forEach(item => {
    item.style.borderColor = 'rgba(255,255,255,0.04)';
  });
  const activeThumb = document.getElementById(`battleimage-thumb-${selectedFrameId}`);
  if (activeThumb) {
    activeThumb.style.borderColor = '#00fffa';
  }

  const lbl = document.getElementById('battleimage-frame-desc');
  if (lbl) {
    const maxFrames = getFrameCount(activeImageTab, selectedPackId);
    lbl.innerText = `当前帧: ${selectedFrameId} / ${maxFrames - 1}`;
  }
}

export function changeBattleImagePlaySpeed(ms) {
  imagePlaySpeedMs = parseInt(ms);
  const lbl = document.getElementById('battleimage-speed-lbl');
  if (lbl) lbl.innerText = `${imagePlaySpeedMs}ms`;

  // 如果正在播放，重启时钟
  if (imagePlayTimer) {
    stopImagePlayTimer();
    toggleBattleImagePlay();
  }
}

function renderBattleImageTab(container) {
  // 根据不同 Tab 获取子包总数与资源描述
  let totalPacks = 0;
  let tabTitleDesc = '';
  
  if (activeImageTab === 'abc') {
    totalPacks = getMkfBlockCount('abc.mkf');
    tabTitleDesc = '敌人精灵贴图 (abc.mkf)';
  } else if (activeImageTab === 'f') {
    totalPacks = getMkfBlockCount('f.mkf');
    tabTitleDesc = '玩家战斗精灵贴图 (f.mkf)';
  } else if (activeImageTab === 'fire') {
    totalPacks = getMkfBlockCount('fire.mkf');
    tabTitleDesc = '魔法特效贴图 (fire.mkf)';
  } else if (activeImageTab === 'data10') {
    totalPacks = getBattleEffectBlockCount();
    tabTitleDesc = '战斗命中效果贴图 (data.mkf #10)';
  }

  const maxFrames = getFrameCount(activeImageTab, selectedPackId);

  // 1. 左侧包索引列表
  let leftHtml = `
    <div style="width: 200px; border-right: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden;">
      <div style="padding: 10px; background: rgba(0,0,0,0.5); border-bottom: 1px solid var(--border-glass); font-size: 9.5px; font-weight: bold; color: #00fffa; letter-spacing: 0.5px; display:flex; justify-content:space-between; align-items:center;">
        <span>📦 精灵数据包</span>
        <span style="font-size: 7.5px; color:rgba(255,255,255,0.25); font-weight:normal;">共 ${totalPacks} 包</span>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px;">
  `;

  for (let idx = 0; idx < totalPacks; idx++) {
    const isSelected = selectedPackId === idx;
    const frameCount = getFrameCount(activeImageTab, idx);
    
    leftHtml += `
      <div onclick="window.onBattleImagePackSelect(${idx})" style="padding: 6px 10px; background: ${isSelected ? 'rgba(0, 255, 250, 0.08)' : 'rgba(255,255,255,0.015)'}; border: 1px solid ${isSelected ? '#00fffa' : 'rgba(255,255,255,0.03)'}; border-radius: 2px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.1s;">
        <span style="font-size: 9px; font-weight: bold; color: ${isSelected ? '#00fffa' : '#fff'};">精灵包 #${idx}</span>
        <span style="font-size: 8px; color: rgba(255,255,255,0.25);">帧数: ${frameCount}</span>
      </div>
    `;
  }

  leftHtml += `
      </div>
    </div>
  `;

  // 2. 右侧大帧图控制器与缩略图名册 (使用青色配色风格)
  let rightHtml = `
    <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 15px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div style="font-size: 13px; font-weight: bold; color: #00fffa;">${tabTitleDesc} • 包 #${selectedPackId}</div>
        <div style="font-size: 8px; color: rgba(255,255,255,0.25); text-transform: uppercase;">Sprite Frame Player</div>
      </div>

      <!-- 核心大 Canvas 画布与自动播放控制 -->
      <div style="display: flex; gap: 15px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 10px; border-radius: 2px; margin-bottom: 12px; align-items: center;">
        <div style="width: 128px; height: 128px; background: rgba(5,5,8,0.7); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px; display: flex; align-items: center; justify-content: center; padding: 4px; box-shadow: inset 0 0 10px rgba(0,0,0,0.8);">
          <canvas id="battleimage-main-canvas" width="120" height="120" style="image-rendering: pixelated; width: 120px; height: 120px;"></canvas>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; height: 128px;">
          <div>
            <div style="font-size: 10px; color: #fff; margin-bottom: 4px;" id="battleimage-frame-desc">当前帧: ${selectedFrameId} / ${maxFrames - 1}</div>
            <div style="font-size: 8px; color: rgba(255,255,255,0.3); line-height: 1.3;">该包下包含不同帧切切片，您可以通过自动播放来连续预览其动画效果，或直接点击下方缩略图切至单帧。</div>
          </div>
          
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn-dbg" id="battleimage-play-btn" onclick="window.toggleBattleImagePlay()" style="color: #00fffa; border-color: rgba(0,255,250,0.2); padding: 3px 10px; font-size: 9px; cursor: pointer;">▶️ 自动播放</button>
            <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); display:flex; align-items:center; gap: 4px;">
              <span>速度(延时):</span>
              <input type="range" min="50" max="400" step="20" value="${imagePlaySpeedMs}" oninput="window.changeBattleImagePlaySpeed(this.value)" style="width: 80px; accent-color:#00fffa; cursor:pointer;">
              <span id="battleimage-speed-lbl" style="color:#ffd000; font-weight:bold;">${imagePlaySpeedMs}ms</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 缩略图集合 -->
      <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
        <div style="font-size: 8.5px; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">全部帧图像缩略图名册</div>
        <div style="overflow-y: auto; display: flex; gap: 4px; padding-right: 2px;" id="battleimage-thumbs-container">
  `;

  for (let fIdx = 0; fIdx < maxFrames; fIdx++) {
    const isSelected = selectedFrameId === fIdx;
    rightHtml += `
      <div id="battleimage-thumb-${fIdx}" onclick="window.selectBattleImageFrameDirectly(${fIdx})" class="battleimage-thumb-item" style="border: 1px solid ${isSelected ? '#00fffa' : 'rgba(255,255,255,0.04)'}; background: rgba(0,0,0,0.3); border-radius: 2px; padding: 4px; display:flex; flex-direction:column; align-items:center; gap:3px; cursor:pointer; transition: all 0.1s;">
        <canvas id="battleimage-thumb-canvas-${fIdx}" width="40" height="40" style="image-rendering: pixelated; width: 40px; height: 40px; background: rgba(0,0,0,0.5);"></canvas>
        <span style="font-size: 7.5px; color: rgba(255,255,255,0.35);">第 ${fIdx} 帧</span>
      </div>
    `;
  }

  rightHtml += `
        </div>
      </div>
    </div>
  `;

  container.innerHTML = leftHtml + rightHtml;

  // 延迟绘制大图 Canvas 与所有的缩略图 Canvas，确保 DOM 已经被完全插入
  setTimeout(() => {
    const mainCanvas = document.getElementById('battleimage-main-canvas');
    if (mainCanvas) {
      drawFrameToCanvas(mainCanvas, activeImageTab, selectedPackId, selectedFrameId);
    }

    for (let fIdx = 0; fIdx < maxFrames; fIdx++) {
      const thumbCanvas = document.getElementById(`battleimage-thumb-canvas-${fIdx}`);
      if (thumbCanvas) {
        drawFrameToCanvas(thumbCanvas, activeImageTab, selectedPackId, fIdx);
      }
    }
  }, 30);
}
