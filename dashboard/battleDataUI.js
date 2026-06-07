// ==================== ⚔️ 仙剑实时战斗资料与调试画廊 React 核心逻辑 ====================

import { loadMkf, load } from '../js/resources/loader.js';
import { deyj } from '../js/utils/deyj.js';
import { state } from '../js/engine/state.js';
import { loadEnemies, loadEnemyTeam, loadEnemyPos, loadSpriteFrame } from '../js/battle/battleData.js';
import { React, ReactDOM, html, drawPixelatedToCanvas } from './gameData/ui-helper.js';

const { useState, useEffect, useRef, useMemo } = React;

// 统一战斗资料的主色调为温和高雅的紫罗兰色
const BATTLE_COLOR = '#a78bfa';
const BATTLE_COLOR_RGB = '167, 139, 250';

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

// 👹 TAB 1: 敌人属性组件
function EnemyTabComponent({ selectedEnemyId, setSelectedEnemyId }) {
  const [frame, setFrame] = useState(0);
  const canvasRef = useRef(null);

  const enemies = useMemo(() => loadEnemies(), []);
  const cur = useMemo(() => enemies[selectedEnemyId] || {}, [enemies, selectedEnemyId]);

  // 重置帧索引
  useEffect(() => {
    setFrame(0);
  }, [selectedEnemyId]);

  // 动画帧渲染
  useEffect(() => {
    if (!canvasRef.current) return;
    drawSpriteFrameToCanvas(canvasRef.current, 'abc.mkf', selectedEnemyId, frame);
  }, [selectedEnemyId, frame]);

  // 动作循环定时器
  useEffect(() => {
    const maxFrames = cur.wIdleFrames || 1;
    if (maxFrames <= 1) return;

    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % maxFrames);
    }, 180);

    return () => clearInterval(timer);
  }, [selectedEnemyId, cur.wIdleFrames]);

  const elemNames = ['💨 风 灵', '⚡ 雷 灵', '💧 水 灵', '🔥 火 灵', '🪨 土 灵'];
  const elemColors = ['#00e1ff', '#e100ff', '#00ffaa', '#ff5500', '#ffd000'];

  return html`
    <div style=${{ width: '200px', borderRight: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style=${{ padding: '10px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid var(--border-glass)', fontSize: '9.5px', fontWeight: 'bold', color: BATTLE_COLOR, letterSpacing: '0.5px' }}>👹 敌人数据包索引</div>
      <div style=${{ flex: 1, overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        ${enemies.map((e, idx) => {
          const isSelected = selectedEnemyId === idx;
          return html`
            <div 
              key=${idx}
              onClick=${() => setSelectedEnemyId(idx)} 
              style=${{
                padding: '6px 10px',
                background: isSelected ? `rgba(${BATTLE_COLOR_RGB}, 0.08)` : 'rgba(255,255,255,0.015)',
                border: `1px solid ${isSelected ? BATTLE_COLOR : 'rgba(255,255,255,0.03)'}`,
                borderRadius: '2px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.1s'
              }}
            >
              <span style=${{ fontSize: '9px', fontWeight: 'bold', color: isSelected ? BATTLE_COLOR : '#fff' }}>敌人 #${idx}</span>
              <span style=${{ fontSize: '8px', color: e.wHealth > 300 ? 'var(--glow-red)' : 'rgba(255,255,255,0.3)' }}>HP ${e.wHealth}</span>
            </div>
          `;
        })}
      </div>
    </div>

    <div style=${{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '15px' }}>
      <div style=${{ display: 'flex', gap: '12px', marginBottom: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px', borderRadius: '2px' }}>
        <div style=${{ position: 'relative', width: '100px', height: '110px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
          <canvas ref=${canvasRef} width="80" height="80" style=${{ imageRendering: 'pixelated', width: '80px', height: '80px' }}></canvas>
          <span style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>空闲动作循环中</span>
        </div>
        <div style=${{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style=${{ fontSize: '13px', fontWeight: 'bold', color: BATTLE_COLOR, marginBottom: '2px' }}>敌方角色配置 #${selectedEnemyId}</div>
            <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>data.mkf Block 1 • Offset: 0x${(selectedEnemyId * 70).toString(16).toUpperCase()}</div>
          </div>
          <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            <div style=${{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '3px 5px', borderRadius: '1.5px', display: 'flex', flexDirection: 'column' }}>
              <span style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.3)' }}>生命 HP</span>
              <span style=${{ fontSize: '11px', fontWeight: 'bold', color: 'var(--glow-red)' }}>${cur.wHealth || 0}</span>
            </div>
            <div style=${{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '3px 5px', borderRadius: '1.5px', display: 'flex', flexDirection: 'column' }}>
              <span style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.3)' }}>武术 ATK</span>
              <span style=${{ fontSize: '11px', fontWeight: 'bold', color: 'var(--glow-green)' }}>${cur.wAttackStrength || 0}</span>
            </div>
            <div style=${{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '3px 5px', borderRadius: '1.5px', display: 'flex', flexDirection: 'column' }}>
              <span style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.3)' }}>防御 DEF</span>
              <span style=${{ fontSize: '11px', fontWeight: 'bold', color: 'var(--glow-blue)' }}>${cur.wDefense || 0}</span>
            </div>
            <div style=${{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '3px 5px', borderRadius: '1.5px', display: 'flex', flexDirection: 'column' }}>
              <span style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.3)' }}>身法 SPD</span>
              <span style=${{ fontSize: '11px', fontWeight: 'bold', color: 'var(--glow-yellow)' }}>${cur.wDexterity || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div style=${{ marginBottom: '12px' }}>
        <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>五灵元素抗性防御矩阵 (Elemental Resistance Grid)</div>
        <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4.5px' }}>
          ${elemNames.map((name, elemIdx) => {
            const resist = cur.wElemResistance ? cur.wElemResistance[elemIdx] : 0;
            return html`
              <div key=${elemIdx} style=${{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.02)', padding: '4px', borderRadius: '2px', textAlign: 'center', borderTop: `1.5px solid ${elemColors[elemIdx]}` }}>
                <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>${name}</div>
                <div style=${{ fontSize: '10px', fontWeight: 'bold', color: elemColors[elemIdx] }}>${resist}%</div>
              </div>
            `;
          })}
        </div>
      </div>

      <div>
        <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>战斗解耦高形容容属性注册表</div>
        <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>空闲动画帧数</span>
            <span style=${{ color: '#fff', fontWeight: 'bold' }}>${cur.wIdleFrames} 帧</span>
          </div>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>法术动画帧数</span>
            <span style=${{ color: '#fff', fontWeight: 'bold' }}>${cur.wMagicFrames} 帧</span>
          </div>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>攻击动画帧数</span>
            <span style=${{ color: '#fff', fontWeight: 'bold' }}>${cur.wAttackFrames} 帧</span>
          </div>

          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>动画步进帧延时</span>
            <span style=${{ color: '#fff' }}>${cur.wIdleAnimSpeed} 码 (T)</span>
          </div>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>出手行动等待帧</span>
            <span style=${{ color: '#fff' }}>${cur.wActWaitFrames} 帧</span>
          </div>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>战场 Y 轴偏移量</span>
            <span style=${{ color: '#00ffaa' }}>${cur.wYPosOffset} Px</span>
          </div>

          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>击败获得经验</span>
            <span style=${{ color: 'var(--glow-yellow)', fontWeight: 'bold' }}>${cur.wExp} XP</span>
          </div>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>击败获得资金</span>
            <span style=${{ color: 'var(--glow-yellow)', fontWeight: 'bold' }}>${cur.wCash} 文</span>
          </div>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>等级设定 LV</span>
            <span style=${{ color: '#fff' }}>${cur.wLevel} 级</span>
          </div>

          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>释放法术 ID</span>
            <span style=${{ color: 'var(--glow-blue)' }}>${cur.wMagic || '无'}</span>
          </div>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>施法概率 Rate</span>
            <span style=${{ color: '#fff' }}>${cur.wMagicRate}%</span>
          </div>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>物理抗性阻尼</span>
            <span style=${{ color: '#fff' }}>${cur.wPhysicalResistance}%</span>
          </div>

          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>可偷取道具 ID</span>
            <span style=${{ color: BATTLE_COLOR }}>${cur.wStealItem || '无'}</span>
          </div>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>可偷取件数</span>
            <span style=${{ color: '#fff' }}>${cur.nStealItem} 个</span>
          </div>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>逃跑率 Flee</span>
            <span style=${{ color: '#fff' }}>${cur.wFleeRate}%</span>
          </div>

          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>普通音效 ID (Act)</span>
            <span style=${{ color: '#fff' }}>${cur.wActionSound}</span>
          </div>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>施法音效 ID (Mag)</span>
            <span style=${{ color: '#fff' }}>${cur.wMagicSound}</span>
          </div>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>死亡音效 ID (Die)</span>
            <span style=${{ color: '#fff' }}>${cur.wDeathSound}</span>
          </div>

          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>避毒概率 Poison</span>
            <span style=${{ color: '#fff' }}>${cur.wPoisonResistance}%</span>
          </div>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>战斗连击 (双击)</span>
            <span style=${{ color: 'var(--glow-green)', fontWeight: 'bold' }}>${cur.wDualMove === 1 ? '是 (TRUE)' : '否'}</span>
          </div>
          <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '8.5px' }}>
            <span style=${{ color: 'rgba(255,255,255,0.3)' }}>剧情物品收集值</span>
            <span style=${{ color: '#fff' }}>${cur.wCollectValue}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 👥 TAB 2: 敌方队伍及帧画廊组件
function TeamTabComponent({ selectedTeamId, setSelectedTeamId, switchTab, selectEnemy }) {
  const [activeGalleryEnemyId, setActiveGalleryEnemyId] = useState(null);
  const [galleryFrame, setGalleryFrame] = useState(0);
  const [galleryPlaying, setGalleryPlaying] = useState(true);

  const teamBlock = useMemo(() => loadMkf('data.mkf', 2), []);
  const totalTeams = useMemo(() => Math.floor(teamBlock.length / 10), [teamBlock]);
  const allEnemyConfigs = useMemo(() => loadEnemies(), []);

  // 解析当前选中队伍的 5 个成员的 Event Object ID
  const teamMemberObjIds = useMemo(() => {
    const offset = selectedTeamId * 10;
    const list = [];
    for (let j = 0; j < 5; j++) {
      list.push(teamBlock.getShort(offset + j * 2));
    }
    return list;
  }, [selectedTeamId, teamBlock]);

  // 绑定全局触发通道，便于 index.html 或 dashboard 连通外部组件
  useEffect(() => {
    window.viewEnemySpriteFramesInTeamTab = (enemyConfigId) => {
      setActiveGalleryEnemyId(enemyConfigId);
      setGalleryFrame(0);
      setGalleryPlaying(true);
    };
  }, []);

  // 渲染每个插槽成员首帧 Canvas 子组件
  function MemberSlot({ objId, posIdx }) {
    const canvasRef = useRef(null);
    const isEmpty = objId === 0 || objId === 0xFFFF;
    const enemyConfigId = !isEmpty ? (state.items[objId]?.roleId || 0) : 0;

    useEffect(() => {
      if (isEmpty || !canvasRef.current) return;
      drawSpriteFrameToCanvas(canvasRef.current, 'abc.mkf', enemyConfigId, 0);
    }, [enemyConfigId, isEmpty]);

    if (isEmpty) {
      return html`
        <div style=${{ border: '1px dashed rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)', borderRadius: '4px', padding: '10px', display: 'flex', alignItems: 'center', height: '60px' }}>
          <div style=${{ fontSize: '9px', fontWeight: 'bold', color: 'rgba(255,255,255,0.2)' }}>站位槽位 #${posIdx + 1} : 空 (No Member)</div>
        </div>
      `;
    }

    return html`
      <div style=${{ border: '1px solid rgba(255,255,255,0.03)', background: 'rgba(255,255,255,0.01)', borderRadius: '4px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '15px', height: '60px' }}>
        <div style=${{ width: '44px', height: '44px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <canvas ref=${canvasRef} width="40" height="40" style=${{ imageRendering: 'pixelated', width: '40px', height: '40px' }}></canvas>
        </div>
        <div style=${{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', alignItems: 'center' }}>
          <div>
            <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>槽位位置</div>
            <div style=${{ fontSize: '10px', fontWeight: 'bold', color: '#fff' }}>位置 #${posIdx + 1}</div>
          </div>
          <div>
            <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>事件物体 ID</div>
            <div style=${{ fontSize: '10px', fontWeight: 'bold', color: 'var(--glow-yellow)' }}>0x${objId.toString(16).toUpperCase()} (${objId})</div>
          </div>
          <div>
            <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>敌人配置 ID</div>
            <div style=${{ fontSize: '10px', fontWeight: 'bold', color: BATTLE_COLOR }}>敌人 #${enemyConfigId}</div>
          </div>
          <div style=${{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
            <button onClick=${() => { switchTab('enemy'); selectEnemy(enemyConfigId); }} class="btn-dbg" style=${{ padding: '2px 6px', fontSize: '8px', color: 'var(--glow-green)', borderColor: 'rgba(0,255,157,0.2)' }}>属性剖析 ➔</button>
            <button onClick=${() => { setActiveGalleryEnemyId(enemyConfigId); setGalleryFrame(0); setGalleryPlaying(true); }} class="btn-dbg" style=${{ padding: '2px 6px', fontSize: '8px', color: BATTLE_COLOR, borderColor: `rgba(${BATTLE_COLOR_RGB}, 0.25)` }}>战斗图片 ➔</button>
          </div>
        </div>
      </div>
    `;
  }

  // 渲染横向滚动动作全帧画廊
  function TeamEnemyGallery({ enemyConfigId }) {
    const playCanvasRef = useRef(null);
    const spriteData = useMemo(() => deyj(loadMkf('abc.mkf', enemyConfigId)), [enemyConfigId]);
    const maxFrames = useMemo(() => (spriteData ? spriteData.getShort(0) : 0), [spriteData]);

    // 播放循环控制器
    useEffect(() => {
      if (!galleryPlaying || maxFrames <= 0) return;
      const interval = setInterval(() => {
        setGalleryFrame(prev => (prev + 1) % maxFrames);
      }, 180);
      return () => clearInterval(interval);
    }, [enemyConfigId, galleryPlaying, maxFrames]);

    // 主画布绘制
    useEffect(() => {
      if (!playCanvasRef.current) return;
      drawSpriteFrameToCanvas(playCanvasRef.current, 'abc.mkf', enemyConfigId, galleryFrame);
    }, [enemyConfigId, galleryFrame]);

    // 绘制各缩略图子卡片
    function ThumbCard({ fIdx }) {
      const thumbRef = useRef(null);

      useEffect(() => {
        if (!thumbRef.current) return;
        drawSpriteFrameToCanvas(thumbRef.current, 'abc.mkf', enemyConfigId, fIdx);
      }, [enemyConfigId, fIdx]);

      const isSelected = galleryFrame === fIdx;

      return html`
        <div 
          onClick=${() => { setGalleryPlaying(false); setGalleryFrame(fIdx); }} 
          class="team-enemy-thumb-item" 
          style=${{
            flexShrink: 0,
            border: `1px solid ${isSelected ? BATTLE_COLOR : 'rgba(255,255,255,0.04)'}`,
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '2px',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            cursor: 'pointer',
            width: '56px',
            transition: 'all 0.1s'
          }}
        >
          <canvas ref=${thumbRef} width="40" height="40" style=${{ imageRendering: 'pixelated', width: '40px', height: '40px', background: 'rgba(0,0,0,0.5)' }}></canvas>
          <span style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.35)' }}>第 ${fIdx} 帧</span>
        </div>
      `;
    }

    return html`
      <div style=${{ fontXml: '1', fontSize: '10px', fontWeight: 'bold', color: BATTLE_COLOR, marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>👾 敌人配置 #${enemyConfigId} 战斗精灵动作全帧画廊 (共 ${maxFrames} 帧)</span>
        <button onClick=${() => setActiveGalleryEnemyId(null)} class="btn-dbg" style=${{ padding: '1px 6px', fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>隐藏画廊 ✕</button>
      </div>
      <div style=${{ display: 'flex', gap: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px' }}>
        <div style=${{ width: '100px', height: '100px', background: 'rgba(5,5,8,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <canvas ref=${playCanvasRef} width="80" height="80" style=${{ imageRendering: 'pixelated', width: '80px', height: '80px' }}></canvas>
          <span style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>第 ${galleryFrame} 帧${!galleryPlaying ? ' (暂停)' : ''}</span>
        </div>
        <div style=${{ flex: 1, overflowX: 'auto', display: 'flex', gap: '6px', paddingBottom: '4px' }}>
          ${Array.from({ length: maxFrames }).map((_, fIdx) => html`<${ThumbCard} key=${fIdx} fIdx=${fIdx} />`)}
        </div>
      </div>
    `;
  }

  return html`
    <div style=${{ width: '200px', borderRight: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style=${{ padding: '10px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid var(--border-glass)', fontSize: '9.5px', fontWeight: 'bold', color: BATTLE_COLOR, letterSpacing: '0.5px' }}>👥 敌方队伍名册</div>
      <div style=${{ flex: 1, overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        ${Array.from({ length: totalTeams }).map((_, idx) => {
          const isSelected = selectedTeamId === idx;
          const offset = idx * 10;
          let memberCount = 0;
          for (let j = 0; j < 5; j++) {
            const objId = teamBlock.getShort(offset + j * 2);
            if (objId !== 0 && objId !== 0xFFFF) {
              memberCount++;
            }
          }

          return html`
            <div 
              key=${idx}
              onClick=${() => { setSelectedTeamId(idx); setActiveGalleryEnemyId(null); }} 
              style=${{
                padding: '6px 10px',
                background: isSelected ? `rgba(${BATTLE_COLOR_RGB}, 0.08)` : 'rgba(255,255,255,0.015)',
                border: `1px solid ${isSelected ? BATTLE_COLOR : 'rgba(255,255,255,0.03)'}`,
                borderRadius: '2px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.1s'
              }}
            >
              <span style=${{ fontSize: '9px', fontWeight: 'bold', color: isSelected ? BATTLE_COLOR : '#fff' }}>队伍 #${idx}</span>
              <span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>${memberCount} 个成员</span>
            </div>
          `;
        })}
      </div>
    </div>

    <div style=${{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '15px' }}>
      <div style=${{ marginBottom: '12px' }}>
        <div style=${{ fontSize: '13px', fontWeight: 'bold', color: BATTLE_COLOR }}>敌方战斗队伍 #${selectedTeamId}</div>
        <div style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>data.mkf Block 2 • Offset: 0x${(selectedTeamId * 10).toString(16).toUpperCase()}</div>
      </div>
      
      <div style=${{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        ${teamMemberObjIds.map((objId, posIdx) => html`
          <${MemberSlot} key=${posIdx} objId=${objId} posIdx=${posIdx} />
        `)}
      </div>
      
      ${activeGalleryEnemyId !== null && html`
        <div style=${{ marginTop: '12px', borderTop: '1px dotted rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
          <${TeamEnemyGallery} enemyConfigId=${activeGalleryEnemyId} />
        </div>
      `}
    </div>
  `;
}

// 📍 TAB 3: 战场坐标组件
function PosTabComponent({ selectedPosCountIndex, setSelectedPosCountIndex }) {
  const posTable = useMemo(() => loadEnemyPos(), []);
  const activePreset = useMemo(() => posTable[selectedPosCountIndex] || [], [posTable, selectedPosCountIndex]);

  return html`
    <div style=${{ width: '200px', borderRight: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style=${{ padding: '10px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid var(--border-glass)', fontSize: '9.5px', fontWeight: 'bold', color: BATTLE_COLOR, letterSpacing: '0.5px' }}>📍 队伍怪物排布数</div>
      <div style=${{ flex: 1, overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        ${Array.from({ length: 5 }).map((_, idx) => {
          const isSelected = selectedPosCountIndex === idx;
          return html`
            <div 
              key=${idx}
              onClick=${() => setSelectedPosCountIndex(idx)} 
              style=${{
                padding: '8px 12px',
                background: isSelected ? `rgba(${BATTLE_COLOR_RGB}, 0.08)` : 'rgba(255,255,255,0.015)',
                border: `1px solid ${isSelected ? BATTLE_COLOR : 'rgba(255,255,255,0.03)'}`,
                borderRadius: '2px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.1s'
              }}
            >
              <span style=${{ fontSize: '9px', fontWeight: 'bold', color: isSelected ? BATTLE_COLOR : '#fff' }}>战场上有 ${idx + 1} 个怪</span>
              <span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>${idx + 1} 人排布</span>
            </div>
          `;
        })}
      </div>
    </div>

    <div style=${{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '15px' }}>
      <div style=${{ marginBottom: '10px' }}>
        <div style=${{ fontSize: '13px', fontWeight: 'bold', color: BATTLE_COLOR }}>战场站位位置高级投影 (Battlefield Coordinates)</div>
        <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>data.mkf Block 13 • 包含 5x5 个绝对战场空间预设坐标点</div>
      </div>
      
      <div style=${{ position: 'relative', width: '100%', height: '160px', background: 'rgba(5,5,8,0.9)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
        <div style=${{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(${BATTLE_COLOR_RGB}, 0.08) 1.5px, transparent 1.5px), radial-gradient(rgba(255,255,255,0.01) 1px, transparent 1px)', backgroundSize: '20px 20px, 10px 10px', backgroundPosition: '0 0, 5px 5px' }}></div>
        <div style=${{ position: 'absolute', right: '20px', bottom: '20px', border: '1px dashed rgba(0, 255, 170, 0.15)', background: 'rgba(0, 255, 170, 0.02)', padding: '4px 8px', fontSize: '7.5px', color: 'rgba(0, 255, 170, 0.4)', borderRadius: '2px', pointerEvents: 'none' }}>我方站位参考区 (PLAYERS)</div>

        ${activePreset.map((pos, ptIdx) => {
          const pctX = (pos.x / 320) * 100;
          const pctY = (pos.y / 200) * 100;

          return html`
            <div key=${ptIdx} style=${{ position: 'absolute', left: `calc(${pctX}% - 14px)`, top: `calc(${pctY}% - 14px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
              <div style=${{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid ${BATTLE_COLOR}', background: `rgba(${BATTLE_COLOR_RGB}, 0.2)`, boxShadow: '0 0 10px rgba(${BATTLE_COLOR_RGB}, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 'bold', color: '#fff' }}>${ptIdx + 1}</div>
              <span style=${{ fontSize: '7.5px', color: BATTLE_COLOR, fontWeight: 500, marginTop: '1px', background: 'rgba(0,0,0,0.6)', padding: '0.5px 2px', borderRadius: '1px' }}>(${pos.x}, ${pos.y})</span>
            </div>
          `;
        })}
      </div>

      <div>
        <div style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '4px' }}>战场预设坐标详细名录</div>
        <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4.5px' }}>
          ${activePreset.map((pos, ptIdx) => html`
            <div key=${ptIdx} style=${{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', padding: '5px', borderRadius: '2px', textAlign: 'center' }}>
              <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.25)', marginBottom: '2px' }}>位置 #${ptIdx + 1}</div>
              <div style=${{ fontSize: '9px', fontWeight: 'bold', color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>X: <span style=${{ color: BATTLE_COLOR }}>${pos.x}</span></div>
              <div style=${{ fontSize: '9px', fontWeight: 'bold', color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>Y: <span style=${{ color: BATTLE_COLOR }}>${pos.y}</span></div>
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
}

// 🖼️ TAB 4: 战斗贴图组件
function SpriteTabComponent({ selectedSpriteFile, setSelectedSpriteFile, selectedSpritePackId, setSelectedSpritePackId, selectedSpriteFrameId, setSelectedSpriteFrameId, isPlayingSprite, setIsPlayingSprite, spritePlaySpeedMs, setSpritePlaySpeedMs }) {
  const mainCanvasRef = useRef(null);

  const totalPacks = useMemo(() => getMkfBlockCount(selectedSpriteFile), [selectedSpriteFile]);
  const spriteData = useMemo(() => deyj(loadMkf(selectedSpriteFile, selectedSpritePackId)), [selectedSpriteFile, selectedSpritePackId]);
  const maxFrames = useMemo(() => (spriteData ? spriteData.getShort(0) : 0), [spriteData]);

  // 重置帧索引
  useEffect(() => {
    setSelectedSpriteFrameId(0);
  }, [selectedSpriteFile, selectedSpritePackId, setSelectedSpriteFrameId]);

  // 自动播放时钟管理
  useEffect(() => {
    if (!isPlayingSprite || maxFrames <= 0) return;

    const timer = setInterval(() => {
      setSelectedSpriteFrameId(prev => (prev + 1) % maxFrames);
    }, spritePlaySpeedMs);

    return () => clearInterval(timer);
  }, [isPlayingSprite, maxFrames, spritePlaySpeedMs, setSelectedSpriteFrameId]);

  // 主画布重绘
  useEffect(() => {
    if (!mainCanvasRef.current) return;
    drawSpriteFrameToCanvas(mainCanvasRef.current, selectedSpriteFile, selectedSpritePackId, selectedSpriteFrameId);
  }, [selectedSpriteFile, selectedSpritePackId, selectedSpriteFrameId]);

  // 绑定全局快捷辅助以便 index.html 直连切换
  useEffect(() => {
    window.selectSpriteFrameDirectly = (frameId) => {
      setIsPlayingSprite(false);
      setSelectedSpriteFrameId(frameId);
    };
    window.changeBattleDataSpritePlaySpeed = (ms) => {
      setSpritePlaySpeedMs(parseInt(ms, 10));
    };
  }, [setIsPlayingSprite, setSelectedSpriteFrameId, setSpritePlaySpeedMs]);

  // 渲染贴图缩略图卡片
  function ThumbCard({ fIdx }) {
    const thumbRef = useRef(null);

    useEffect(() => {
      if (!thumbRef.current) return;
      drawSpriteFrameToCanvas(thumbRef.current, selectedSpriteFile, selectedSpritePackId, fIdx);
    }, [fIdx]);

    const isSelected = selectedSpriteFrameId === fIdx;

    return html`
      <div 
        key=${fIdx}
        onClick=${() => { setIsPlayingSprite(false); setSelectedSpriteFrameId(fIdx); }} 
        class="battledata-thumb-item" 
        style=${{
          border: `1px solid ${isSelected ? BATTLE_COLOR : 'rgba(255,255,255,0.04)'}`,
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
    <div style=${{ width: '200px', borderRight: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style=${{ padding: '10px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid var(--border-glass)', fontSize: '9.5px', fontWeight: 'bold', color: BATTLE_COLOR, letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>🖼️ RLE 图像数据包</span>
        <span style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.25)', fontWeight: 'normal' }}>共 ${totalPacks} 包</span>
      </div>
      <div style=${{ flex: 1, overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        ${Array.from({ length: totalPacks }).map((_, idx) => {
          const isSelected = selectedSpritePackId === idx;
          return html`
            <div 
              key=${idx}
              onClick=${() => { setSelectedSpritePackId(idx); setIsPlayingSprite(false); }} 
              style=${{
                padding: '6px 10px',
                background: isSelected ? `rgba(${BATTLE_COLOR_RGB}, 0.08)` : 'rgba(255,255,255,0.015)',
                border: `1px solid ${isSelected ? BATTLE_COLOR : 'rgba(255,255,255,0.03)'}`,
                borderRadius: '2px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.1s'
              }}
            >
              <span style=${{ fontSize: '9px', fontWeight: 'bold', color: isSelected ? BATTLE_COLOR : '#fff' }}>贴图包 #${idx}</span>
              <span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.25)' }}>帧数: ${getFrameCount(selectedSpriteFile, idx)}</span>
            </div>
          `;
        })}
      </div>
    </div>

    <div style=${{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '15px' }}>
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style=${{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button class=${`btn-dbg ${selectedSpriteFile === 'abc.mkf' ? 'active' : ''}`} onClick=${() => { setSelectedSpriteFile('abc.mkf'); setSelectedSpritePackId(0); setIsPlayingSprite(false); }} style=${selectedSpriteFile === 'abc.mkf' ? { color: BATTLE_COLOR, borderColor: BATTLE_COLOR, background: `rgba(${BATTLE_COLOR_RGB}, 0.05)` } : {}}>👹 敌方贴图包 (abc.mkf)</button>
          <button class=${`btn-dbg ${selectedSpriteFile === 'f.mkf' ? 'active' : ''}`} onClick=${() => { setSelectedSpriteFile('f.mkf'); setSelectedSpritePackId(0); setIsPlayingSprite(false); }} style=${selectedSpriteFile === 'f.mkf' ? { color: BATTLE_COLOR, borderColor: BATTLE_COLOR, background: `rgba(${BATTLE_COLOR_RGB}, 0.05)` } : {}}>⚔️ 玩家贴图包 (f.mkf)</button>
        </div>
        <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>RLE Sprite Gallery Viewer • Pack #${selectedSpritePackId}</div>
      </div>

      <div style=${{ display: 'flex', gap: '15px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.03)', padding: '10px', borderRadius: '2px', marginBottom: '12px', alignItems: 'center' }}>
        <div style=${{ width: '128px', height: '128px', background: 'rgba(5,5,8,0.7)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)' }}>
          <canvas ref=${mainCanvasRef} width="120" height="120" style=${{ imageRendering: 'pixelated', width: '120px', height: '120px' }}></canvas>
        </div>
        <div style=${{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '128px' }}>
          <div>
            <div style=${{ fontSize: '13px', fontWeight: 'bold', color: BATTLE_COLOR, marginBottom: '2px' }}>当前包：${selectedSpriteFile} • 包 #${selectedSpritePackId}</div>
            <div style=${{ fontSize: '9px', color: '#fff', marginBottom: '4px' }}>当前帧: ${selectedSpriteFrameId} / ${maxFrames - 1}</div>
            <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', lineHeight: '1.3' }}>贴图帧包含攻击、施法、待机等丰富帧切，使用播放控制器可以查看其连贯动作。</div>
          </div>
          
          <div style=${{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button class="btn-dbg" onClick=${() => setIsPlayingSprite(!isPlayingSprite)} style=${{ color: 'var(--glow-green)', borderColor: 'rgba(0,255,157,0.2)', padding: '3px 10px', fontSize: '9px', cursor: 'pointer' }}>${isPlayingSprite ? '⏸️ 停止播放' : '▶️ 自动播放'}</button>
            <div style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>速度(延时):</span>
              <input type="range" min="50" max="400" step="20" value=${spritePlaySpeedMs} onInput=${(e) => setSpritePlaySpeedMs(parseInt(e.target.value, 10))} style=${{ width: '80px', accentColor: BATTLE_COLOR, cursor: 'pointer' }}></input>
              <span style=${{ color: '#ffd000', fontWeight: 'bold' }}>${spritePlaySpeedMs}ms</span>
            </div>
          </div>
        </div>
      </div>

      <div style=${{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>全部帧图像缩略图名册 (Thumbnail Registry)</div>
        <div style=${{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', paddingRight: '2px' }}>
          ${Array.from({ length: maxFrames }).map((_, fIdx) => html`
            <${ThumbCard} key=${fIdx} fIdx=${fIdx} />
          `)}
        </div>
      </div>
    </div>
  `;
}

// ⚔️ 实时战斗资料组件 App 根组件
export function BattleDataApp() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('enemy');

  const [selectedEnemyId, setSelectedEnemyId] = useState(0);
  const [selectedTeamId, setSelectedTeamId] = useState(0);
  const [selectedPosCountIndex, setSelectedPosCountIndex] = useState(2);

  const [selectedSpriteFile, setSelectedSpriteFile] = useState('abc.mkf');
  const [selectedSpritePackId, setSelectedSpritePackId] = useState(0);
  const [selectedSpriteFrameId, setSelectedSpriteFrameId] = useState(0);
  const [isPlayingSprite, setIsPlayingSprite] = useState(false);
  const [spritePlaySpeedMs, setSpritePlaySpeedMs] = useState(150);

  // 将状态接口挂载到 window 上，以实现与外部逻辑的完全兼容
  useEffect(() => {
    window.openBattleDataModal = () => {
      setIsOpen(true);
    };

    window.closeBattleDataModal = () => {
      setIsOpen(false);
    };

    window.switchBattleDataTab = (tabName) => {
      setActiveTab(tabName);
    };

    window.onBattleDataEnemySelect = (enemyId) => {
      setSelectedEnemyId(enemyId);
    };

    window.onBattleDataTeamSelect = (teamId) => {
      setSelectedTeamId(teamId);
    };

    window.onBattleDataPosCountChange = (index) => {
      setSelectedPosCountIndex(index);
    };

    window.switchBattleDataSpriteFile = (file) => {
      setSelectedSpriteFile(file);
    };

    window.onBattleDataSpritePackSelect = (packId) => {
      setSelectedSpritePackId(packId);
      setSelectedSpriteFrameId(0);
      setIsPlayingSprite(false);
    };

    window.toggleBattleDataSpritePlay = () => {
      setIsPlayingSprite(prev => !prev);
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  const tabs = [
    { id: 'enemy', label: '👹 敌人属性 (data.mkf #1)' },
    { id: 'team', label: '👥 敌方队伍 (data.mkf #2)' },
    { id: 'pos', label: '📍 战场坐标 (data.mkf #13)' },
    { id: 'sprite', label: '🖼️ 战斗贴图 (abc.mkf / f.mkf)' }
  ];

  return html`
    <div id="battle-data-modal" style=${{ display: 'flex', position: 'fixed', zIndex: 99999, left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(5,5,8,0.75)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style=${{ background: 'rgba(10,13,20,0.96)', border: `1px solid ${BATTLE_COLOR}`, borderRadius: '4px', boxShadow: `0 0 25px rgba(${BATTLE_COLOR_RGB}, 0.15)`, width: 'calc(100% - 40px)', height: 'calc(100% - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'JetBrains Mono', sans-serif" }}>
        <!-- 弹窗头部 -->
        <div class="tool-modal-header" style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid var(--border-glass)' }}>
          <div class="tool-modal-title-row" style=${{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div class="tool-modal-dot" style=${{ width: '5px', height: '5px', background: BATTLE_COLOR, borderRadius: '50%', boxShadow: `0 0 6px ${BATTLE_COLOR}` }}></div>
            <span class="tool-modal-heading" style=${{ fontSize: '11px', fontWeight: 'bold', color: BATTLE_COLOR, letterSpacing: '0.5px', textTransform: 'uppercase' }}>⚔️ PAL BATTLE DATA & PROFILES SYSTEM (战斗实时资料与画廊预览系统)</span>
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
                class=${`btn-dbg battledata-tab-btn ${isActive ? 'active' : ''}`}
                onClick=${() => { setActiveTab(tab.id); }}
                style=${{
                  color: isActive ? BATTLE_COLOR : 'rgba(255,255,255,0.6)',
                  borderColor: isActive ? BATTLE_COLOR : 'rgba(255,255,255,0.06)',
                  background: isActive ? `rgba(${BATTLE_COLOR_RGB}, 0.05)` : 'transparent',
                  padding: '2px 10px',
                  fontSize: '8.5px',
                  cursor: 'pointer'
                }}
              >${tab.label}</button>
            `;
          })}
        </div>

        <!-- 主内容展示区 -->
        <div id="battledata-main-container" style=${{ flex: 1, display: 'flex', overflow: 'hidden', background: '#030305' }}>
          ${activeTab === 'enemy' && html`<${EnemyTabComponent} selectedEnemyId=${selectedEnemyId} setSelectedEnemyId=${setSelectedEnemyId} />`}
          ${activeTab === 'team' && html`<${TeamTabComponent} selectedTeamId=${selectedTeamId} setSelectedTeamId=${setSelectedTeamId} switchTab=${setActiveTab} selectEnemy=${setSelectedEnemyId} />`}
          ${activeTab === 'pos' && html`<${PosTabComponent} selectedPosCountIndex=${selectedPosCountIndex} setSelectedPosCountIndex=${setSelectedPosCountIndex} />`}
          ${activeTab === 'sprite' && html`
            <${SpriteTabComponent} 
              selectedSpriteFile=${selectedSpriteFile} 
              setSelectedSpriteFile=${setSelectedSpriteFile} 
              selectedSpritePackId=${selectedSpritePackId} 
              setSelectedSpritePackId=${setSelectedSpritePackId} 
              selectedSpriteFrameId=${selectedSpriteFrameId} 
              setSelectedSpriteFrameId=${setSelectedSpriteFrameId} 
              isPlayingSprite=${isPlayingSprite} 
              setIsPlayingSprite=${setIsPlayingSprite} 
              spritePlaySpeedMs=${spritePlaySpeedMs} 
              setSpritePlaySpeedMs=${setSpritePlaySpeedMs} 
            />
          `}
        </div>
      </div>
    </div>
  `;
}

// 惰性挂载入口
let reactRoot = null;

export function openBattleDataModal() {
  const container = document.getElementById('battle-data-modal-root');
  if (container && !reactRoot) {
    reactRoot = ReactDOM.createRoot(container);
    reactRoot.render(html`<${BattleDataApp} />`);

    // 延迟驱动展示，确保组件挂载以及回调函数劫持完毕
    setTimeout(() => {
      if (window.openBattleDataModal && window.openBattleDataModal !== openBattleDataModal) {
        window.openBattleDataModal();
      }
    }, 50);
  } else if (window.openBattleDataModal && window.openBattleDataModal !== openBattleDataModal) {
    window.openBattleDataModal();
  }
}

export function closeBattleDataModal() {
  if (window.closeBattleDataModal && window.closeBattleDataModal !== closeBattleDataModal) {
    window.closeBattleDataModal();
  }
}

export function switchBattleDataTab(tabName) {
  if (window.switchBattleDataTab && window.switchBattleDataTab !== switchBattleDataTab) {
    window.switchBattleDataTab(tabName);
  }
}

export function onBattleDataEnemySelect(enemyId) {
  if (window.onBattleDataEnemySelect) {
    window.onBattleDataEnemySelect(enemyId);
  }
}

export function onBattleDataTeamSelect(teamId) {
  if (window.onBattleDataTeamSelect) {
    window.onBattleDataTeamSelect(teamId);
  }
}

export function onBattleDataPosCountChange(index) {
  if (window.onBattleDataPosCountChange) {
    window.onBattleDataPosCountChange(index);
  }
}

export function switchBattleDataSpriteFile(file) {
  if (window.switchBattleDataSpriteFile) {
    window.switchBattleDataSpriteFile(file);
  }
}

export function onBattleDataSpritePackSelect(packId) {
  if (window.onBattleDataSpritePackSelect) {
    window.onBattleDataSpritePackSelect(packId);
  }
}

export function toggleBattleDataSpritePlay() {
  if (window.toggleBattleDataSpritePlay) {
    window.toggleBattleDataSpritePlay();
  }
}
