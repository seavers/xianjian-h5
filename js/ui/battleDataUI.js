// ==================== ⚔️ 仙剑实时战斗资料与调试画廊核心逻辑 ====================

import { loadMkf, load } from '../resources/loader.js';
import { deyj } from '../utils/deyj.js';
import { state } from '../engine/state.js';
import { loadEnemies, loadEnemyTeam, loadEnemyPos, loadSpriteFrame } from '../battle/battleData.js';

// 当前处于激活态的二级 Tab ('enemy' | 'team' | 'pos' | 'sprite')
let activeBattleTab = 'enemy';

// 当前选中的敌人属性 ID
let selectedEnemyId = 0;

// 当前选中的敌方队伍 ID
let selectedTeamId = 0;

// 当前战场坐标预览选中的人数索引 (0~4 对应 1~5 人队伍)
let selectedPosCountIndex = 2; // 默认 3人队伍

// 战斗贴图 Tab 选中的文件 ('abc.mkf' | 'f.mkf')
let selectedSpriteFile = 'abc.mkf';
// 当前选中的包 ID
let selectedSpritePackId = 0;
// 当前选中的帧索引
let selectedSpriteFrameId = 0;
// 动画循环时钟与当前播放帧
let spritePlayTimer = null;
let currentPlayFrame = 0;
let spritePlaySpeedMs = 150; // 默认每帧播放延时 150ms

// 敌人属性 Tab 下的空闲动作循环播放器
let enemyIdleTimer = null;
let enemyIdleFrame = 0;

// 队伍 Tab 下选中的怪物帧动画循环时钟
let teamEnemyPlayTimer = null;
let teamEnemyPlayFrame = 0;

// 步骤 1：获取任意 MKF 文件的子块总包数
function getMkfBlockCount(filename) {
  try {
    const data = load(filename);
    if (!data) return 0;
    // 第一个子块的偏移值除以 4 减去 1 就是包的总数
    return Math.floor(data.getInt(0) / 4) - 1;
  } catch (e) {
    console.error(`[BattleDataUI] 无法解析 ${filename} 的包总数:`, e);
    return 0;
  }
}

// 步骤 1.5：获取指定精灵包解密解压后的总帧数
function getFrameCount(file, packId) {
  try {
    const spriteData = deyj(loadMkf(file, packId));
    if (!spriteData) return 0;
    return spriteData.getShort(0);
  } catch (e) {
    return 0;
  }
}

// 步骤 2：在指定 Canvas 上精准渲染某帧战斗精灵图片
function drawSpriteFrameToCanvas(canvasEl, file, packId, frameId) {
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  try {
    const spriteData = deyj(loadMkf(file, packId));
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

export function openBattleDataModal() {
  const modal = document.getElementById('battle-data-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
  switchBattleDataTab(activeBattleTab);
}

export function closeBattleDataModal() {
  const modal = document.getElementById('battle-data-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  stopEnemyIdleAnimation();
  stopSpritePlayTimer();
  stopTeamEnemyPlayLoop();
}

export function switchBattleDataTab(tabName) {
  activeBattleTab = tabName;
  stopEnemyIdleAnimation();
  stopSpritePlayTimer();
  stopTeamEnemyPlayLoop();

  // 选项卡切换状态高亮
  document.querySelectorAll('.battledata-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.style.color = 'rgba(255,255,255,0.6)';
    btn.style.borderColor = 'rgba(255,255,255,0.06)';
  });
  
  const activeTabBtn = document.getElementById(`battledata-tab-${tabName}`);
  if (activeTabBtn) {
    activeTabBtn.classList.add('active');
    activeTabBtn.style.color = '#ff3b6f';
    activeTabBtn.style.borderColor = '#ff3b6f';
  }

  // 渲染主体内容区域
  const mainContainer = document.getElementById('battledata-main-container');
  if (!mainContainer) return;

  if (tabName === 'enemy') {
    renderEnemyTab(mainContainer);
  } else if (tabName === 'team') {
    renderTeamTab(mainContainer);
  } else if (tabName === 'pos') {
    renderPosTab(mainContainer);
  } else if (tabName === 'sprite') {
    renderSpriteTab(mainContainer);
  }
}

// ==================== 👹 TAB 1: 敌人属性数据展现逻辑 ====================

function stopEnemyIdleAnimation() {
  if (enemyIdleTimer) {
    clearInterval(enemyIdleTimer);
    enemyIdleTimer = null;
  }
}

function startEnemyIdleAnimation(enemyId, framesCount) {
  stopEnemyIdleAnimation();
  enemyIdleFrame = 0;

  const canvas = document.getElementById('battle-enemy-preview-canvas');
  if (!canvas || framesCount <= 0) return;

  enemyIdleTimer = setInterval(() => {
    drawSpriteFrameToCanvas(canvas, 'abc.mkf', enemyId, enemyIdleFrame);
    enemyIdleFrame = (enemyIdleFrame + 1) % framesCount;
  }, 180);
}

export function onBattleDataEnemySelect(enemyId) {
  selectedEnemyId = enemyId;
  const mainContainer = document.getElementById('battledata-main-container');
  if (mainContainer && activeBattleTab === 'enemy') {
    renderEnemyTab(mainContainer);
  }
}

function renderEnemyTab(container) {
  const enemies = loadEnemies();
  
  // 1. 左侧敌人索引排版
  let leftHtml = `
    <div style="width: 200px; border-right: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden;">
      <div style="padding: 10px; background: rgba(0,0,0,0.5); border-bottom: 1px solid var(--border-glass); font-size: 9.5px; font-weight: bold; color: #ff3b6f; letter-spacing: 0.5px;">👹 敌人数据包索引</div>
      <div style="flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px;">
  `;

  enemies.forEach((e, idx) => {
    const isSelected = selectedEnemyId === idx;
    leftHtml += `
      <div onclick="onBattleDataEnemySelect(${idx})" style="padding: 6px 10px; background: ${isSelected ? 'rgba(255, 59, 111, 0.08)' : 'rgba(255,255,255,0.015)'}; border: 1px solid ${isSelected ? '#ff3b6f' : 'rgba(255,255,255,0.03)'}; border-radius: 2px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.1s;">
        <span style="font-size: 9px; font-weight: bold; color: ${isSelected ? '#ff3b6f' : '#fff'};">敌人 #${idx}</span>
        <span style="font-size: 8px; color: ${e.wHealth > 300 ? 'var(--glow-red)' : 'rgba(255,255,255,0.3)'};">HP ${e.wHealth}</span>
      </div>
    `;
  });

  leftHtml += `
      </div>
    </div>
  `;

  // 2. 右侧属性及动作画廊
  const cur = enemies[selectedEnemyId] || {};
  let rightHtml = `
    <div style="flex: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 15px;">
      <!-- 头部：Canvas 动效与最核心战力 -->
      <div style="display: flex; gap: 12px; margin-bottom: 12px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 8px; border-radius: 2px;">
        <div style="position: relative; width: 100px; height: 110px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px;">
          <canvas id="battle-enemy-preview-canvas" width="80" height="80" style="image-rendering: pixelated; width: 80px; height: 80px;"></canvas>
          <span style="font-size: 7.5px; color: rgba(255,255,255,0.3); margin-top: 3px;">空闲动作循环中</span>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="font-size: 13px; font-weight: bold; color: #ff3b6f; margin-bottom: 2px;">敌方角色配置 #${selectedEnemyId}</div>
            <div style="font-size: 8px; color: rgba(255,255,255,0.3); text-transform: uppercase;">data.mkf Block 1 • Offset: 0x${(selectedEnemyId * 70).toString(16).toUpperCase()}</div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 3px 5px; border-radius: 1.5px; display:flex; flex-direction:column;">
              <span style="font-size: 7.5px; color: rgba(255,255,255,0.3);">生命 HP</span>
              <span style="font-size: 11px; font-weight: bold; color: var(--glow-red);">${cur.wHealth || 0}</span>
            </div>
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 3px 5px; border-radius: 1.5px; display:flex; flex-direction:column;">
              <span style="font-size: 7.5px; color: rgba(255,255,255,0.3);">武术 ATK</span>
              <span style="font-size: 11px; font-weight: bold; color: var(--glow-green);">${cur.wAttackStrength || 0}</span>
            </div>
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 3px 5px; border-radius: 1.5px; display:flex; flex-direction:column;">
              <span style="font-size: 7.5px; color: rgba(255,255,255,0.3);">防御 DEF</span>
              <span style="font-size: 11px; font-weight: bold; color: var(--glow-blue);">${cur.wDefense || 0}</span>
            </div>
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 3px 5px; border-radius: 1.5px; display:flex; flex-direction:column;">
              <span style="font-size: 7.5px; color: rgba(255,255,255,0.3);">身法 SPD</span>
              <span style="font-size: 11px; font-weight: bold; color: var(--glow-yellow);">${cur.wDexterity || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 中部：五灵防御大卡片 -->
      <div style="margin-bottom: 12px;">
        <div style="font-size: 8px; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">五灵元素抗性防御矩阵 (Elemental Resistance Grid)</div>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4.5px;">
  `;

  const elemNames = ['💨 风 灵', '⚡ 雷 灵', '💧 水 灵', '🔥 火 灵', '🪨 土 灵'];
  const elemColors = ['#00e1ff', '#e100ff', '#00ffaa', '#ff5500', '#ffd000'];
  for (let elem = 0; elem < 5; elem++) {
    const resist = cur.wElemResistance ? cur.wElemResistance[elem] : 0;
    rightHtml += `
      <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.02); padding: 4px; border-radius: 2px; text-align: center; border-top: 1.5px solid ${elemColors[elem]};">
        <div style="font-size: 8px; color: rgba(255,255,255,0.4); margin-bottom: 2px;">${elemNames[elem]}</div>
        <div style="font-size: 10px; font-weight: bold; color: ${elemColors[elem]};">${resist}%</div>
      </div>
    `;
  }

  rightHtml += `
        </div>
      </div>

      <!-- 下部：三十项战斗隐藏属性列表 -->
      <div>
        <div style="font-size: 8px; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">战斗解耦高形容积映射属性表 (Detailed Attribute Registry)</div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px;">
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">空闲动画帧数</span>
            <span style="color:#fff; font-weight:bold;">${cur.wIdleFrames} 帧</span>
          </div>
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">法术动画帧数</span>
            <span style="color:#fff; font-weight:bold;">${cur.wMagicFrames} 帧</span>
          </div>
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">攻击动画帧数</span>
            <span style="color:#fff; font-weight:bold;">${cur.wAttackFrames} 帧</span>
          </div>

          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">动画步进帧延时</span>
            <span style="color:#fff;">${cur.wIdleAnimSpeed} 码 (T)</span>
          </div>
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">出手行动等待帧</span>
            <span style="color:#fff;">${cur.wActWaitFrames} 帧</span>
          </div>
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">战场 Y 轴偏移量</span>
            <span style="color:#00ffaa;">${cur.wYPosOffset} Px</span>
          </div>

          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">击败获得经验</span>
            <span style="color:var(--glow-yellow); font-weight:bold;">${cur.wExp} XP</span>
          </div>
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">击败获得资金</span>
            <span style="color:var(--glow-yellow); font-weight:bold;">${cur.wCash} 文</span>
          </div>
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">等级设定 LV</span>
            <span style="color:#fff;">${cur.wLevel} 级</span>
          </div>

          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">释放法术 ID</span>
            <span style="color:var(--glow-blue);">${cur.wMagic || '无'}</span>
          </div>
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">施法概率 Rate</span>
            <span style="color:#fff;">${cur.wMagicRate}%</span>
          </div>
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">物理抗性阻尼</span>
            <span style="color:#fff;">${cur.wPhysicalResistance}%</span>
          </div>

          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">可偷取道具 ID</span>
            <span style="color:#ff3b6f;">${cur.wStealItem || '无'}</span>
          </div>
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">可偷取件数</span>
            <span style="color:#fff;">${cur.nStealItem} 个</span>
          </div>
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">逃跑率 Flee</span>
            <span style="color:#fff;">${cur.wFleeRate}%</span>
          </div>

          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">普通音效 ID (Act)</span>
            <span style="color:#fff;">${cur.wActionSound}</span>
          </div>
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">施法音效 ID (Mag)</span>
            <span style="color:#fff;">${cur.wMagicSound}</span>
          </div>
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">死亡音效 ID (Die)</span>
            <span style="color:#fff;">${cur.wDeathSound}</span>
          </div>

          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">避毒概率 Poison</span>
            <span style="color:#fff;">${cur.wPoisonResistance}%</span>
          </div>
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">战斗连击 (双击)</span>
            <span style="color:var(--glow-green); font-weight:bold;">${cur.wDualMove === 1 ? '是 (TRUE)' : '否'}</span>
          </div>
          <div style="background:rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 3px 6px; display:flex; justify-content:space-between; font-size: 8.5px;">
            <span style="color: rgba(255,255,255,0.3);">剧情物品收集值</span>
            <span style="color:#fff;">${cur.wCollectValue}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = leftHtml + rightHtml;

  // 延时在主线程空闲时启动预览动画，避免因为 DOM 还未插入导致 canvas 获取不到
  setTimeout(() => {
    startEnemyIdleAnimation(selectedEnemyId, cur.wIdleFrames || 1);
  }, 30);
}

// ==================== 👥 TAB 2: 敌方队伍展现逻辑 ====================

export function onBattleDataTeamSelect(teamId) {
  selectedTeamId = teamId;
  const mainContainer = document.getElementById('battledata-main-container');
  if (mainContainer && activeBattleTab === 'team') {
    renderTeamTab(mainContainer);
  }
}

function renderTeamTab(container) {
  const teamBlock = loadMkf('data.mkf', 2);
  const totalTeams = Math.floor(teamBlock.length / 10);

  // 1. 左侧队伍列表
  let leftHtml = `
    <div style="width: 200px; border-right: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden;">
      <div style="padding: 10px; background: rgba(0,0,0,0.5); border-bottom: 1px solid var(--border-glass); font-size: 9.5px; font-weight: bold; color: #ff3b6f; letter-spacing: 0.5px;">👥 敌方队伍名册</div>
      <div style="flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px;">
  `;

  for (let idx = 0; idx < totalTeams; idx++) {
    const isSelected = selectedTeamId === idx;
    
    // 解析这个队伍里有多少个活人
    const offset = idx * 10;
    let memberCount = 0;
    for (let j = 0; j < 5; j++) {
      const objId = teamBlock.getShort(offset + j * 2);
      if (objId !== 0 && objId !== 0xFFFF) {
        memberCount++;
      }
    }

    leftHtml += `
      <div onclick="onBattleDataTeamSelect(${idx})" style="padding: 6px 10px; background: ${isSelected ? 'rgba(255, 59, 111, 0.08)' : 'rgba(255,255,255,0.015)'}; border: 1px solid ${isSelected ? '#ff3b6f' : 'rgba(255,255,255,0.03)'}; border-radius: 2px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.1s;">
        <span style="font-size: 9px; font-weight: bold; color: ${isSelected ? '#ff3b6f' : '#fff'};">队伍 #${idx}</span>
        <span style="font-size: 8px; color: rgba(255,255,255,0.3);">${memberCount} 个成员</span>
      </div>
    `;
  }

  leftHtml += `
      </div>
    </div>
  `;

  // 2. 右侧展示 5 个站位槽位卡片
  const offset = selectedTeamId * 10;
  const teamMemberObjIds = [];
  for (let j = 0; j < 5; j++) {
    const objId = teamBlock.getShort(offset + j * 2);
    teamMemberObjIds.push(objId);
  }

  const allEnemyConfigs = loadEnemies();

  let rightHtml = `
    <div style="flex: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 15px;">
      <div style="margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: bold; color: #ff3b6f;">敌方战斗队伍 #${selectedTeamId}</div>
        <div style="font-size: 8.5px; color: rgba(255,255,255,0.3); text-transform: uppercase;">data.mkf Block 2 • Offset: 0x${(selectedTeamId * 10).toString(16).toUpperCase()}</div>
      </div>
      
      <!-- 队伍大插槽排布 -->
      <div style="display: flex; flex-direction: column; gap: 8px;">
  `;

  teamMemberObjIds.forEach((objId, posIdx) => {
    const isEmpty = objId === 0 || objId === 0xFFFF;
    const enemyConfigId = !isEmpty ? (state.items[objId]?.roleId || 0) : 0;
    const cfg = !isEmpty ? (allEnemyConfigs[enemyConfigId] || {}) : {};

    if (isEmpty) {
      rightHtml += `
        <div style="border: 1px dashed rgba(255,255,255,0.05); background: rgba(0,0,0,0.1); border-radius: 4px; padding: 10px; display: flex; align-items: center; height: 60px;">
          <div style="font-size: 9px; font-weight:bold; color: rgba(255,255,255,0.2);">站位槽位 #${posIdx + 1} : 空 (No Member)</div>
        </div>
      `;
    } else {
      rightHtml += `
        <div style="border: 1px solid rgba(255,255,255,0.03); background: rgba(255,255,255,0.01); border-radius: 4px; padding: 6px 12px; display: flex; align-items: center; gap: 15px; height: 60px;">
          <!-- 站位头像 Canvas -->
          <div style="width: 44px; height: 44px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px; display: flex; align-items: center; justify-content: center;">
            <canvas id="team-member-canvas-${posIdx}" width="40" height="40" style="image-rendering: pixelated; width: 40px; height: 40px;"></canvas>
          </div>
          <!-- 成员详情 -->
          <div style="flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; align-items: center;">
            <div>
              <div style="font-size: 8px; color: rgba(255,255,255,0.3);">槽位位置</div>
              <div style="font-size: 10px; font-weight: bold; color: #fff;">位置 #${posIdx + 1}</div>
            </div>
            <div>
              <div style="font-size: 8px; color: rgba(255,255,255,0.3);">事件物体 ID</div>
              <div style="font-size: 10px; font-weight: bold; color: var(--glow-yellow);">0x${objId.toString(16).toUpperCase()} (${objId})</div>
            </div>
            <div>
              <div style="font-size: 8px; color: rgba(255,255,255,0.3);">敌人配置 ID</div>
              <div style="font-size: 10px; font-weight: bold; color: #ff3b6f;">敌人 #${enemyConfigId}</div>
            </div>
            <div style="display:flex; justify-content: flex-end; gap: 4px;">
              <button onclick="switchBattleDataTab('enemy'); onBattleDataEnemySelect(${enemyConfigId});" class="btn-dbg" style="padding: 2px 6px; font-size: 8px; color: var(--glow-green); border-color: rgba(0,255,157,0.2);">属性剖析 ➔</button>
              <button onclick="window.viewEnemySpriteFramesInTeamTab(${enemyConfigId});" class="btn-dbg" style="padding: 2px 6px; font-size: 8px; color: #ff3b6f; border-color: rgba(255,59,111,0.25);">战斗图片 ➔</button>
            </div>
          </div>
        </div>
      `;
    }
  });

  rightHtml += `
      </div>
      
      <!-- 展开的怪物战斗全帧动作画廊预览 -->
      <div id="team-enemy-frames-container" style="margin-top: 12px; border-top: 1px dotted rgba(255, 255, 255, 0.08); padding-top: 10px; display: none;"></div>
    </div>
  `;

  container.innerHTML = leftHtml + rightHtml;

  // 渲染每个成员的第一帧
  setTimeout(() => {
    teamMemberObjIds.forEach((objId, posIdx) => {
      const isEmpty = objId === 0 || objId === 0xFFFF;
      if (!isEmpty) {
        const enemyConfigId = state.items[objId]?.roleId || 0;
        const canvas = document.getElementById(`team-member-canvas-${posIdx}`);
        if (canvas) {
          drawSpriteFrameToCanvas(canvas, 'abc.mkf', enemyConfigId, 0);
        }
      }
    });
  }, 30);
}

// ==================== 📍 TAB 3: 战场坐标显示逻辑 ====================

export function onBattleDataPosCountChange(index) {
  selectedPosCountIndex = index;
  const mainContainer = document.getElementById('battledata-main-container');
  if (mainContainer && activeBattleTab === 'pos') {
    renderPosTab(mainContainer);
  }
}

function renderPosTab(container) {
  const posTable = loadEnemyPos(); // 5x5 的 PALPOS

  // 1. 左侧队伍人数选择
  let leftHtml = `
    <div style="width: 200px; border-right: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden;">
      <div style="padding: 10px; background: rgba(0,0,0,0.5); border-bottom: 1px solid var(--border-glass); font-size: 9.5px; font-weight: bold; color: #ff3b6f; letter-spacing: 0.5px;">📍 队伍怪物排布数</div>
      <div style="flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px;">
  `;

  for (let idx = 0; idx < 5; idx++) {
    const isSelected = selectedPosCountIndex === idx;
    leftHtml += `
      <div onclick="onBattleDataPosCountChange(${idx})" style="padding: 8px 12px; background: ${isSelected ? 'rgba(255, 59, 111, 0.08)' : 'rgba(255,255,255,0.015)'}; border: 1px solid ${isSelected ? '#ff3b6f' : 'rgba(255,255,255,0.03)'}; border-radius: 2px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.1s;">
        <span style="font-size: 9px; font-weight: bold; color: ${isSelected ? '#ff3b6f' : '#fff'};">战场上有 ${idx + 1} 个怪</span>
        <span style="font-size: 8px; color: rgba(255,255,255,0.3);">${idx + 1} 人排布</span>
      </div>
    `;
  }

  leftHtml += `
      </div>
    </div>
  `;

  // 2. 右侧战场雷达投影图与坐标表格
  const activePreset = posTable[selectedPosCountIndex] || [];
  
  let rightHtml = `
    <div style="flex: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 15px;">
      <div style="margin-bottom: 10px;">
        <div style="font-size: 13px; font-weight: bold; color: #ff3b6f;">战场站位位置高级投影 (Battlefield Coordinates Projection)</div>
        <div style="font-size: 8px; color: rgba(255,255,255,0.3); text-transform: uppercase;">data.mkf Block 13 • 包含 5x5 个绝对战场空间预设坐标点</div>
      </div>
      
      <!-- 战场投影区 -->
      <div style="position: relative; width: 100%; height: 160px; background: rgba(5,5,8,0.9); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; margin-bottom: 12px;">
        <!-- 网格背景 -->
        <div style="position: absolute; inset: 0; background-image: radial-gradient(rgba(255, 59, 111, 0.08) 1.5px, transparent 1.5px), radial-gradient(rgba(255,255,255,0.01) 1px, transparent 1px); background-size: 20px 20px, 10px 10px; background-position: 0 0, 5px 5px;"></div>
        
        <!-- 我方基本战区参考区 (通常在右下) -->
        <div style="position: absolute; right: 20px; bottom: 20px; border: 1px dashed rgba(0, 255, 170, 0.15); background: rgba(0, 255, 170, 0.02); padding: 4px 8px; font-size: 7.5px; color: rgba(0, 255, 170, 0.4); border-radius: 2px; pointer-events: none;">我方站位参考区 (PLAYERS)</div>

        <!-- 战场定位圆圈 -->
  `;

  activePreset.forEach((pos, ptIdx) => {
    // 换算绝对坐标为百分比。仙剑 DOS 战场大小为 320x200 像素。
    const pctX = (pos.x / 320) * 100;
    const pctY = (pos.y / 200) * 100;

    rightHtml += `
      <div style="position: absolute; left: calc(${pctX}% - 14px); top: calc(${pctY}% - 14px); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10;">
        <div style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid #ff3b6f; background: rgba(255, 59, 111, 0.2); box-shadow: 0 0 10px rgba(255, 59, 111, 0.4); display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: bold; color: #fff;">${ptIdx + 1}</div>
        <span style="font-size: 7.5px; color: #ff3b6f; font-weight: 500; margin-top: 1px; background: rgba(0,0,0,0.6); padding: 0.5px 2px; border-radius: 1px;">(${pos.x}, ${pos.y})</span>
      </div>
    `;
  });

  rightHtml += `
      </div>

      <!-- 坐标映射明细表 -->
      <div>
        <div style="font-size: 8.5px; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-bottom: 4px;">战场预设坐标详细名录</div>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4.5px;">
  `;

  activePreset.forEach((pos, ptIdx) => {
    rightHtml += `
      <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.03); padding: 5px; border-radius: 2px; text-align: center;">
        <div style="font-size: 8px; color: rgba(255,255,255,0.25); margin-bottom: 2px;">位置 #${ptIdx + 1}</div>
        <div style="font-size: 9px; font-weight: bold; color: #fff; font-family:'JetBrains Mono',monospace;">X: <span style="color:#ff3b6f;">${pos.x}</span></div>
        <div style="font-size: 9px; font-weight: bold; color: #fff; font-family:'JetBrains Mono',monospace;">Y: <span style="color:#ff3b6f;">${pos.y}</span></div>
      </div>
    `;
  });

  rightHtml += `
        </div>
      </div>
    </div>
  `;

  container.innerHTML = leftHtml + rightHtml;
}

// ==================== 🖼️ TAB 4: 战斗贴图画廊预览 ====================

function stopSpritePlayTimer() {
  if (spritePlayTimer) {
    clearInterval(spritePlayTimer);
    spritePlayTimer = null;
  }
}

export function switchBattleDataSpriteFile(file) {
  selectedSpriteFile = file;
  selectedSpritePackId = 0;
  selectedSpriteFrameId = 0;
  stopSpritePlayTimer();

  const mainContainer = document.getElementById('battledata-main-container');
  if (mainContainer && activeBattleTab === 'sprite') {
    renderSpriteTab(mainContainer);
  }
}

export function onBattleDataSpritePackSelect(packId) {
  selectedSpritePackId = packId;
  selectedSpriteFrameId = 0;
  stopSpritePlayTimer();

  const mainContainer = document.getElementById('battledata-main-container');
  if (mainContainer && activeBattleTab === 'sprite') {
    renderSpriteTab(mainContainer);
  }
}

export function toggleBattleDataSpritePlay() {
  const btn = document.getElementById('battledata-sprite-play-btn');
  if (spritePlayTimer) {
    stopSpritePlayTimer();
    if (btn) btn.innerText = '▶️ 自动播放';
  } else {
    const spriteData = deyj(loadMkf(selectedSpriteFile, selectedSpritePackId));
    if (!spriteData) return;
    const maxFrames = spriteData.getShort(0);
    if (maxFrames <= 0) return;

    if (btn) btn.innerText = '⏸️ 停止播放';
    currentPlayFrame = selectedSpriteFrameId;

    spritePlayTimer = setInterval(() => {
      currentPlayFrame = (currentPlayFrame + 1) % maxFrames;
      selectedSpriteFrameId = currentPlayFrame;

      // 实时绘制大画布
      const mainCanvas = document.getElementById('battledata-sprite-main-canvas');
      drawSpriteFrameToCanvas(mainCanvas, selectedSpriteFile, selectedSpritePackId, selectedSpriteFrameId);

      // 高亮高亮对应的缩略图项
      document.querySelectorAll('.battledata-thumb-item').forEach(item => {
        item.style.borderColor = 'rgba(255,255,255,0.04)';
      });
      const activeThumb = document.getElementById(`battledata-thumb-${selectedSpriteFrameId}`);
      if (activeThumb) {
        activeThumb.style.borderColor = '#ff3b6f';
      }

      // 更新下方帧描述标签
      const lbl = document.getElementById('battledata-sprite-frame-desc');
      if (lbl) lbl.innerText = `当前帧: ${selectedSpriteFrameId} / ${maxFrames - 1}`;

    }, spritePlaySpeedMs);
  }
}

export function selectSpriteFrameDirectly(frameId) {
  stopSpritePlayTimer();
  const btn = document.getElementById('battledata-sprite-play-btn');
  if (btn) btn.innerText = '▶️ 自动播放';

  selectedSpriteFrameId = frameId;
  const mainCanvas = document.getElementById('battledata-sprite-main-canvas');
  drawSpriteFrameToCanvas(mainCanvas, selectedSpriteFile, selectedSpritePackId, selectedSpriteFrameId);

  document.querySelectorAll('.battledata-thumb-item').forEach(item => {
    item.style.borderColor = 'rgba(255,255,255,0.04)';
  });
  const activeThumb = document.getElementById(`battledata-thumb-${selectedSpriteFrameId}`);
  if (activeThumb) {
    activeThumb.style.borderColor = '#ff3b6f';
  }

  const lbl = document.getElementById('battledata-sprite-frame-desc');
  if (lbl) {
    const spriteData = deyj(loadMkf(selectedSpriteFile, selectedSpritePackId));
    const maxFrames = spriteData ? spriteData.getShort(0) : 0;
    lbl.innerText = `当前帧: ${selectedSpriteFrameId} / ${maxFrames - 1}`;
  }
}

function renderSpriteTab(container) {
  const totalPacks = getMkfBlockCount(selectedSpriteFile);
  const spriteData = deyj(loadMkf(selectedSpriteFile, selectedSpritePackId));
  const maxFrames = spriteData ? spriteData.getShort(0) : 0;

  // 1. 左侧包索引列表
  let leftHtml = `
    <div style="width: 200px; border-right: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden;">
      <div style="padding: 10px; background: rgba(0,0,0,0.5); border-bottom: 1px solid var(--border-glass); font-size: 9.5px; font-weight: bold; color: #ff3b6f; letter-spacing: 0.5px; display:flex; justify-content:space-between; align-items:center;">
        <span>🖼️ RLE 图像数据包</span>
        <span style="font-size: 7.5px; color:rgba(255,255,255,0.25); font-weight:normal;">共 ${totalPacks} 包</span>
      </div>
      <div style="flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px;">
  `;

  for (let idx = 0; idx < totalPacks; idx++) {
    const isSelected = selectedSpritePackId === idx;
    
    leftHtml += `
      <div onclick="onBattleDataSpritePackSelect(${idx})" style="padding: 6px 10px; background: ${isSelected ? 'rgba(255, 59, 111, 0.08)' : 'rgba(255,255,255,0.015)'}; border: 1px solid ${isSelected ? '#ff3b6f' : 'rgba(255,255,255,0.03)'}; border-radius: 2px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.1s;">
        <span style="font-size: 9px; font-weight: bold; color: ${isSelected ? '#ff3b6f' : '#fff'};">贴图包 #${idx}</span>
        <span style="font-size: 8px; color: rgba(255,255,255,0.25);">帧数: ${getFrameCount(selectedSpriteFile, idx)}</span>
      </div>
    `;
  }

  leftHtml += `
      </div>
    </div>
  `;

  // 2. 右侧大帧图控制器与缩略图名册
  let rightHtml = `
    <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 15px;">
      <!-- 二级文件选择器 -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div style="display: flex; gap: 6px; align-items: center;">
          <button class="btn-dbg ${selectedSpriteFile === 'abc.mkf' ? 'active' : ''}" onclick="switchBattleDataSpriteFile('abc.mkf')" style="${selectedSpriteFile === 'abc.mkf' ? 'color:#ff3b6f; border-color:#ff3b6f; background: rgba(255,59,111,0.05);' : ''} padding: 2px 10px; font-size: 8.5px; cursor: pointer;">👹 敌方贴图包 (abc.mkf)</button>
          <button class="btn-dbg ${selectedSpriteFile === 'f.mkf' ? 'active' : ''}" onclick="switchBattleDataSpriteFile('f.mkf')" style="${selectedSpriteFile === 'f.mkf' ? 'color:#ff3b6f; border-color:#ff3b6f; background: rgba(255,59,111,0.05);' : ''} padding: 2px 10px; font-size: 8.5px; cursor: pointer;">⚔️ 玩家贴图包 (f.mkf)</button>
        </div>
        <div style="font-size: 8px; color: rgba(255,255,255,0.25); text-transform: uppercase;">RLE Sprite Gallery Viewer • Pack #${selectedSpritePackId}</div>
      </div>

      <!-- 核心画布与自动播放器 -->
      <div style="display: flex; gap: 15px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 10px; border-radius: 2px; margin-bottom: 12px; align-items: center;">
        <div style="width: 128px; height: 128px; background: rgba(5,5,8,0.7); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px; display: flex; align-items: center; justify-content: center; padding: 4px; box-shadow: inset 0 0 10px rgba(0,0,0,0.8);">
          <canvas id="battledata-sprite-main-canvas" width="120" height="120" style="image-rendering: pixelated; width: 120px; height: 120px;"></canvas>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; height: 128px;">
          <div>
            <div style="font-size: 13px; font-weight: bold; color: #ff3b6f; margin-bottom: 2px;">当前包：${selectedSpriteFile} • 包 #${selectedSpritePackId}</div>
            <div style="font-size: 9px; color: #fff; margin-bottom: 4px;" id="battledata-sprite-frame-desc">当前帧: ${selectedSpriteFrameId} / ${maxFrames - 1}</div>
            <div style="font-size: 8px; color: rgba(255,255,255,0.3); line-height: 1.3;">贴图帧包含攻击、施法、待机等丰富帧切，使用播放控制器可以查看其连贯动作。</div>
          </div>
          
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn-dbg" id="battledata-sprite-play-btn" onclick="toggleBattleDataSpritePlay()" style="color: var(--glow-green); border-color: rgba(0,255,157,0.2); padding: 3px 10px; font-size: 9px; cursor: pointer;">▶️ 自动播放</button>
            <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); display:flex; align-items:center; gap: 4px;">
              <span>速度(延时):</span>
              <input type="range" min="50" max="400" step="20" value="${spritePlaySpeedMs}" oninput="window.changeBattleDataSpritePlaySpeed(this.value)" style="width: 80px; accent-color:#ff3b6f; cursor:pointer;">
              <span id="battledata-speed-lbl" style="color:#ffd000; font-weight:bold;">${spritePlaySpeedMs}ms</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 缩略图集合 -->
      <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
        <div style="font-size: 8.5px; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">全部帧图像缩略图名册 (Thumbnail Registry)</div>
        <div style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; padding-right: 2px;" id="battledata-thumbs-container">
  `;

  for (let fIdx = 0; fIdx < maxFrames; fIdx++) {
    const isSelected = selectedSpriteFrameId === fIdx;
    rightHtml += `
      <div id="battledata-thumb-${fIdx}" onclick="window.selectSpriteFrameDirectly(${fIdx})" class="battledata-thumb-item" style="border: 1px solid ${isSelected ? '#ff3b6f' : 'rgba(255,255,255,0.04)'}; background: rgba(0,0,0,0.3); border-radius: 2px; padding: 4px; display:flex; flex-direction:column; align-items:center; gap:3px; cursor:pointer; transition: all 0.1s;">
        <canvas id="battledata-thumb-canvas-${fIdx}" width="40" height="40" style="image-rendering: pixelated; width: 40px; height: 40px; background: rgba(0,0,0,0.5);"></canvas>
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

  // 渲染大图 Canvas 与所有的缩略图 Canvas
  setTimeout(() => {
    const mainCanvas = document.getElementById('battledata-sprite-main-canvas');
    if (mainCanvas) {
      drawSpriteFrameToCanvas(mainCanvas, selectedSpriteFile, selectedSpritePackId, selectedSpriteFrameId);
    }

    for (let fIdx = 0; fIdx < maxFrames; fIdx++) {
      const thumbCanvas = document.getElementById(`battledata-thumb-canvas-${fIdx}`);
      if (thumbCanvas) {
        drawSpriteFrameToCanvas(thumbCanvas, selectedSpriteFile, selectedSpritePackId, fIdx);
      }
    }
  }, 30);
}

// 动态调整自动播放速度
export function changeBattleDataSpritePlaySpeed(ms) {
  spritePlaySpeedMs = parseInt(ms);
  const lbl = document.getElementById('battledata-speed-lbl');
  if (lbl) lbl.innerText = `${spritePlaySpeedMs}ms`;

  // 如果正在播放，重启时钟
  if (spritePlayTimer) {
    toggleBattleDataSpritePlay(); // 先关掉
    toggleBattleDataSpritePlay(); // 再用新速度重启
  }
}

// 导出全局快捷辅助以便 index.html 直连
window.changeBattleDataSpritePlaySpeed = changeBattleDataSpritePlaySpeed;
window.selectSpriteFrameDirectly = selectSpriteFrameDirectly;

// ==================== 👥 TAB 2.5: 队伍中敌方战斗帧动作画廊控制逻辑 ====================

function stopTeamEnemyPlayLoop() {
  if (teamEnemyPlayTimer) {
    clearInterval(teamEnemyPlayTimer);
    teamEnemyPlayTimer = null;
  }
}

function startTeamEnemyPlayLoop(enemyConfigId, maxFrames) {
  stopTeamEnemyPlayLoop();
  teamEnemyPlayFrame = 0;

  const canvas = document.getElementById('team-enemy-play-canvas');
  const lbl = document.getElementById('team-enemy-play-lbl');
  if (!canvas || maxFrames <= 0) return;

  // 默认绘制首帧
  drawSpriteFrameToCanvas(canvas, 'abc.mkf', enemyConfigId, 0);
  highlightTeamEnemyThumb(0);

  teamEnemyPlayTimer = setInterval(() => {
    teamEnemyPlayFrame = (teamEnemyPlayFrame + 1) % maxFrames;
    drawSpriteFrameToCanvas(canvas, 'abc.mkf', enemyConfigId, teamEnemyPlayFrame);
    highlightTeamEnemyThumb(teamEnemyPlayFrame);
    if (lbl) {
      lbl.innerText = `当前播放: 第 ${teamEnemyPlayFrame} 帧`;
    }
  }, 180);
}

function highlightTeamEnemyThumb(frameId) {
  document.querySelectorAll('.team-enemy-thumb-item').forEach(item => {
    item.style.borderColor = 'rgba(255,255,255,0.04)';
  });
  const activeThumb = document.getElementById(`team-enemy-thumb-item-${frameId}`);
  if (activeThumb) {
    activeThumb.style.borderColor = '#ff3b6f';
  }
}

export function viewEnemySpriteFramesInTeamTab(enemyConfigId) {
  const container = document.getElementById('team-enemy-frames-container');
  if (!container) return;

  container.style.display = 'block';

  const spriteData = deyj(loadMkf('abc.mkf', enemyConfigId));
  const maxFrames = spriteData ? spriteData.getShort(0) : 0;

  let html = `
    <div style="font-size: 10px; font-weight: bold; color: #ff3b6f; margin-bottom: 6px; display:flex; justify-content:space-between; align-items:center;">
      <span>👾 敌人配置 #${enemyConfigId} 战斗精灵动作全帧画廊 (共 ${maxFrames} 帧)</span>
      <button onclick="document.getElementById('team-enemy-frames-container').style.display='none'; window.stopTeamEnemyPlayLoop();" class="btn-dbg" style="padding: 1px 6px; font-size: 8px; color: rgba(255,255,255,0.4);">隐藏画廊 ✕</button>
    </div>
    <div style="display: flex; gap: 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.03); padding: 8px; border-radius: 4px;">
      <!-- 左侧：动态循环播放 Canvas -->
      <div style="width: 100px; height: 100px; background: rgba(5,5,8,0.7); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
        <canvas id="team-enemy-play-canvas" width="80" height="80" style="image-rendering: pixelated; width: 80px; height: 80px;"></canvas>
        <span id="team-enemy-play-lbl" style="font-size: 7.5px; color:rgba(255,255,255,0.3); margin-top:2px;">第 0 帧</span>
      </div>
      <!-- 右侧：全帧平铺缩略图，滚动横轴 -->
      <div style="flex: 1; overflow-x: auto; display: flex; gap: 6px; padding-bottom: 4px;" id="team-enemy-thumbs-scroll">
  `;

  for (let fIdx = 0; fIdx < maxFrames; fIdx++) {
    html += `
      <div onclick="window.selectTeamEnemyPlayFrame(${enemyConfigId}, ${fIdx})" class="team-enemy-thumb-item" id="team-enemy-thumb-item-${fIdx}" style="flex-shrink:0; border: 1px solid rgba(255,255,255,0.04); background: rgba(0,0,0,0.4); border-radius: 2px; padding: 4px; display:flex; flex-direction:column; align-items:center; gap:3px; cursor:pointer; width: 56px; transition: all 0.1s;">
        <canvas id="team-enemy-thumb-canvas-${fIdx}" width="40" height="40" style="image-rendering: pixelated; width: 40px; height: 40px; background: rgba(0,0,0,0.5);"></canvas>
        <span style="font-size: 7.5px; color: rgba(255,255,255,0.35);">第 ${fIdx} 帧</span>
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;

  // 渲染所有缩略图
  for (let fIdx = 0; fIdx < maxFrames; fIdx++) {
    const thumbCanvas = document.getElementById(`team-enemy-thumb-canvas-${fIdx}`);
    if (thumbCanvas) {
      drawSpriteFrameToCanvas(thumbCanvas, 'abc.mkf', enemyConfigId, fIdx);
    }
  }

  // 开启小播放循环
  startTeamEnemyPlayLoop(enemyConfigId, maxFrames);
}

export function selectTeamEnemyPlayFrame(enemyConfigId, frameId) {
  stopTeamEnemyPlayLoop();

  const canvas = document.getElementById('team-enemy-play-canvas');
  const lbl = document.getElementById('team-enemy-play-lbl');
  if (canvas) {
    drawSpriteFrameToCanvas(canvas, 'abc.mkf', enemyConfigId, frameId);
  }
  highlightTeamEnemyThumb(frameId);
  if (lbl) {
    lbl.innerText = `第 ${frameId} 帧 (已暂停)`;
  }
}

window.viewEnemySpriteFramesInTeamTab = viewEnemySpriteFramesInTeamTab;
window.selectTeamEnemyPlayFrame = selectTeamEnemyPlayFrame;
window.stopTeamEnemyPlayLoop = stopTeamEnemyPlayLoop;
