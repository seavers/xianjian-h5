import { React, html, drawPixelatedToCanvas } from './ui-helper.js';
import { state } from '../../js/engine/state.js';
import { ROLES_DB } from '../../js/data/gameData/roles.js';
import { loadRgm, loadMgoCount, loadMgo, loadGop, loadBall } from '../../js/resources/pal.js';
import { getDetailedItemInfo } from '../../js/data/gameData/items.js';
import { getCommandName, getInstructionChineseDetail } from '../../js/data/gameData/scripts.js';
import { getRoleName, getItemNameHtml, makeScriptHyperlinks } from './helpers.js';
import { scriptCodes } from '../../js/engine/command.js';

const { useState, useEffect, useRef, useMemo } = React;

// 👤 角色 Tab 子组件
function RoleTabComponent({ selectedRoleId, setSelectedRoleId, jumpToScript }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [animFrame, setAnimFrame] = useState(0);
  const rgmCanvasRef = useRef(null);
  const mgoCanvasRef = useRef(null);

  const role = useMemo(() => ROLES_DB[selectedRoleId] || ROLES_DB[0], [selectedRoleId]);

  // 获取该角色在全局状态中的运行时配置及战斗贴图包映射
  const runtimeRole = state.roles[selectedRoleId] || {};
  const mgoIdVal = runtimeRole.tileId !== undefined ? runtimeRole.tileId : role.mgoRoleId;
  let battleSpriteVal = runtimeRole.spriteNumInBattle;
  
  if (battleSpriteVal === undefined) {
    const defaultSprites = [0, 1, 2, 4, 3, 8];
    battleSpriteVal = defaultSprites[selectedRoleId] !== undefined ? defaultSprites[selectedRoleId] : 0;
  }

  // 步骤 1：绘制 RGM 头像 Canvas
  useEffect(() => {
    try {
      const rgmImg = loadRgm(role.rgmId);
      drawPixelatedToCanvas(rgmImg, rgmCanvasRef.current);
    } catch (error) {
      console.error('加载角色头像失败:', error);
      drawPixelatedToCanvas(null, rgmCanvasRef.current);
    }
  }, [role.rgmId]);

  // 步骤 2：启动并托管走路 MGO 动画定时器
  useEffect(() => {
    let mgoCount = 4;
    try {
      mgoCount = loadMgoCount(role.mgoRoleId) || 4;
    } catch (e) {
      mgoCount = 4;
    }

    const renderMgoFrame = (frameIdx) => {
      try {
        const frameCanvas = loadMgo(role.mgoRoleId, frameIdx);
        drawPixelatedToCanvas(frameCanvas, mgoCanvasRef.current);
      } catch (error) {
        drawPixelatedToCanvas(null, mgoCanvasRef.current);
      }
    };

    renderMgoFrame(animFrame);

    if (!isPlaying) {
      return;
    }

    const timer = setInterval(() => {
      setAnimFrame(prev => {
        const nextFrame = (prev + 1) % mgoCount;
        renderMgoFrame(nextFrame);
        return nextFrame;
      });
    }, 180);

    return () => clearInterval(timer);
  }, [role.mgoRoleId, isPlaying]);

  return html`
    <div class="gamedata-sidebar" style=${{ flex: '0 0 260px' }}>
      <div class="gamedata-sidebar-header">
        <span class="gamedata-sidebar-title">👤 剧中角色列表</span>
      </div>
      <div class="gamedata-sidebar-list">
        ${Object.keys(ROLES_DB).map(id => {
          const roleId = parseInt(id, 10);
          const r = ROLES_DB[roleId];
          const isSelected = selectedRoleId === roleId;
          return html`
            <div 
              key=${roleId} 
              onClick=${() => { setSelectedRoleId(roleId); setAnimFrame(0); }} 
              class=${`gamedata-list-item ${isSelected ? 'is-selected' : ''}`}
            >
              <div class="gamedata-list-item-row">
                <span class="gamedata-list-item-title">${r.name}</span>
                <span class="gamedata-list-item-meta">LV ${r.level}</span>
              </div>
            </div>
          `;
        })}
      </div>
    </div>
    
    <div class="gamedata-detail">
      <div class="gamedata-detail-header">
        <div class="gamedata-detail-header-main">
          <h2 class="gamedata-detail-title" style=${{ fontSize: '14px', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>${role.name}</h2>
          <span class="gamedata-detail-badge">主力队员</span>
        </div>
        <div class="gamedata-detail-meta">当前携带资金: <span style=${{ color: 'var(--glow-yellow)' }}>${state.money || 0} 文</span></div>
      </div>
      
      <div class="gamedata-content-split">
        <div class="gamedata-preview-card">
          <span class="gamedata-preview-label">🖼️ 经典角色头像 (RGM)</span>
          <canvas ref=${rgmCanvasRef} width="80" height="80" class="gamedata-preview-canvas"></canvas>
          <span class="gamedata-preview-label" style=${{ marginTop: '5px' }}>🏃 2D 走动像素立绘 (MGO)</span>
          <canvas ref=${mgoCanvasRef} width="60" height="138" class="gamedata-preview-canvas"></canvas>
          <button 
            onClick=${() => setIsPlaying(!isPlaying)} 
            class="btn-dbg" 
            style=${{ color: isPlaying ? 'var(--glow-green)' : 'var(--glow-yellow)', borderColor: 'rgba(0,255,157,0.2)', padding: '2px 8px', fontSize: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ${isPlaying ? '⏸ 暂停走动' : '▶ 播放走动'}
          </button>
        </div>
        
        <div class="gamedata-scroll-panel">
          <div>
            <div class="gamedata-section-title">角色基础属性</div>
            <div class="gamedata-stat-grid" style=${{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">等级 (LV)</div><div class="gamedata-stat-value" style=${{ color: 'var(--glow-yellow)' }}>LV ${role.level}</div></div>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">体力 (HP)</div><div class="gamedata-stat-value" style=${{ color: '#ff5777' }}>${role.hp}</div></div>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">真气 (MP)</div><div class="gamedata-stat-value" style=${{ color: '#4db3ff' }}>${role.mp}</div></div>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">武术 (ATK)</div><div class="gamedata-stat-value" style=${{ color: '#ffa64d' }}>${role.atk}</div></div>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">灵力 (MAG)</div><div class="gamedata-stat-value" style=${{ color: '#b366ff' }}>${role.mag}</div></div>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">防御 (DEF)</div><div class="gamedata-stat-value" style=${{ color: '#00ffaa' }}>${role.def}</div></div>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">身法 (SPD)</div><div class="gamedata-stat-value" style=${{ color: '#00e5ff' }}>${role.spd}</div></div>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">吉运 (LCK)</div><div class="gamedata-stat-value" style=${{ color: '#ffff00' }}>${role.lck}</div></div>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">状态 (STATUS)</div><div class="gamedata-stat-value" style=${{ color: 'var(--glow-green)' }}>${role.status}</div></div>
            </div>
          </div>

          <div>
            <div class="gamedata-section-title">运行时精灵图集解剖 (Sprite Profiles)</div>
            <div class="gamedata-block-grid" style=${{ gridTemplateColumns: '1fr 1fr' }}>
              <div class="gamedata-block-card">
                <div class="gamedata-block-label">👾 大地图动作包 (mgo.mkf)</div>
                <div class="gamedata-block-value" style=${{ color: 'var(--glow-yellow)' }}>mgo.mkf #${mgoIdVal}</div>
              </div>
              <div class="gamedata-block-card">
                <div class="gamedata-block-label">⚔ 战斗贴图精灵包 (f.mkf)</div>
                <div class="gamedata-block-value" style=${{ color: 'var(--glow-green)' }}>f.mkf #${battleSpriteVal}</div>
              </div>
            </div>
          </div>
          
          <div>
            <div class="gamedata-section-title">配备神兵防具</div>
            <div class="gamedata-block-grid" style=${{ gridTemplateColumns: '1fr 1fr' }}>
              <div class="gamedata-block-card"><div class="gamedata-block-label">⚔ 武器</div><div class="gamedata-block-value">${role.equip.weapon}</div></div>
              <div class="gamedata-block-card"><div class="gamedata-block-label">🛡 身体防具</div><div class="gamedata-block-value">${role.equip.armor}</div></div>
              <div class="gamedata-block-card"><div class="gamedata-block-label">👒 头部防护</div><div class="gamedata-block-value">${role.equip.helmet}</div></div>
              <div class="gamedata-block-card"><div class="gamedata-block-label">🥾 足踏奇鞋</div><div class="gamedata-block-value">${role.equip.shoes}</div></div>
            </div>
          </div>
          
          <div>
            <div class="gamedata-section-title">精通绝学仙术</div>
            <div class="gamedata-tag-list">
              ${role.spells.map((spell, idx) => html`
                <span key=${idx} class="gamedata-tag" style=${{ color: '#dfb3ff', background: 'rgba(179,102,255,0.1)', border: '1px solid rgba(179,102,255,0.3)' }}>✨ ${spell}</span>
              `)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 👾 NPC Tab 子组件
function NpcTabComponent({ selectedNpcId, setSelectedNpcId, npcFilterKeyword, setNpcFilterKeyword, jumpToScript }) {
  const mgoCanvasRef = useRef(null);
  const [mgoSize, setMgoSize] = useState('--x--');

  const npcs = useMemo(() => {
    const list = [];
    for (let i = 1; i < state.eventObjects.length; i++) {
      const obj = state.eventObjects[i];
      if (obj && obj.type === 'npc') {
        list.push(obj);
      }
    }
    return list;
  }, []);

  const filteredNpcs = useMemo(() => {
    return npcs.filter(npc => {
      const name = getRoleName(npc.mgoId);
      const searchStr = `${npc.id} ${npc.mgoId} ${name}`.toLowerCase();
      return searchStr.indexOf(npcFilterKeyword.toLowerCase()) !== -1;
    });
  }, [npcs, npcFilterKeyword]);

  const activeNpc = useMemo(() => {
    return state.eventObjects[selectedNpcId] || filteredNpcs[0];
  }, [selectedNpcId, filteredNpcs]);

  // 步骤 1：绘制 NPC MGO Canvas
  useEffect(() => {
    if (!activeNpc || !activeNpc.mgoId) {
      drawPixelatedToCanvas(null, mgoCanvasRef.current);
      setMgoSize('--x--');
      return;
    }

    try {
      const npcCanvas = loadMgo(activeNpc.mgoId, activeNpc.frame);
      if (npcCanvas) {
        drawPixelatedToCanvas(npcCanvas, mgoCanvasRef.current);
        setMgoSize(`${npcCanvas.width}x${npcCanvas.height} px`);
      } else {
        drawPixelatedToCanvas(null, mgoCanvasRef.current);
        setMgoSize('--x--');
      }
    } catch (error) {
      console.error('绘制 NPC 精灵图失败:', error);
      drawPixelatedToCanvas(null, mgoCanvasRef.current);
      setMgoSize('--x--');
    }
  }, [activeNpc?.id, activeNpc?.mgoId, activeNpc?.frame]);

  return html`
    <div class="gamedata-sidebar" style=${{ flex: '0 0 280px' }}>
      <div class="gamedata-sidebar-header">
        <span class="gamedata-sidebar-title">👾 全局 NPC 列表 (共 ${npcs.length} 个)</span>
        <input 
          type="text" 
          value=${npcFilterKeyword} 
          onInput=${(e) => setNpcFilterKeyword(e.target.value)} 
          placeholder="输入 ID 或角色名搜索..." 
          style=${{ background: '#0c0a08', border: '1px solid rgba(255,215,0,0.2)', color: '#fff', fontSize: '8px', padding: '3px 6px', outline: 'none', borderRadius: '2px' }}
        />
      </div>
      <div class="gamedata-sidebar-list">
        ${filteredNpcs.length === 0 ? html`
          <div style=${{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '8.5px', paddingTop: '20px' }}>未找到匹配的 NPC</div>
        ` : filteredNpcs.map(npc => {
          const isSelected = activeNpc?.id === npc.id;
          return html`
            <div 
              key=${npc.id} 
              onClick=${() => setSelectedNpcId(npc.id)} 
              class=${`gamedata-list-item ${isSelected ? 'is-selected' : ''}`}
            >
              <div class="gamedata-list-item-row">
                <span class="gamedata-list-item-title">🤖 NPC #${npc.id}</span>
                <span class="gamedata-list-item-meta">Dir: ${npc.dir}</span>
              </div>
              <div class="gamedata-list-item-row gamedata-list-item-row-secondary">
                <span class="gamedata-list-item-subtitle">${getRoleName(npc.mgoId)}</span>
                <span class="gamedata-list-item-tail">(${npc.x}, ${npc.y})</span>
              </div>
            </div>
          `;
        })}
      </div>
    </div>

    ${activeNpc ? html`
      <div class="gamedata-detail">
        <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,215,0,0.15)', paddingBottom: '8px', marginBottom: '12px' }}>
          <h2 style=${{ margin: 0, fontSize: '12px', color: 'var(--glow-yellow)', fontWeight: 'bold' }}>👾 NPC #${activeNpc.id} [${getRoleName(activeNpc.mgoId)}] 的运行时状态分析</h2>
        </div>
        
        <div style=${{ flex: 1, display: 'flex', gap: '15px', overflow: 'hidden' }}>
          <div style=${{ width: '180px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '12px', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '3px' }}>
            <span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontWeight: 'bold' }}>👾 原生 2D 像素精灵图</span>
            <canvas ref=${mgoCanvasRef} width="100" height="100" style=${{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}></canvas>
            <div style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', lineHeight: '1.3', marginTop: '4px' }}>
              动作包: mgo.mkf #${activeNpc.mgoId}<br/>当前帧数: Frame #${activeNpc.frame}<br/>像素尺寸: <span style=${{ color: 'var(--glow-yellow)' }}>${mgoSize}</span>
            </div>
          </div>
          
          <div style=${{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingRight: '4px' }}>
            <div>
              <div style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}><span style=${{ width: '3px', height: '3px', background: 'var(--glow-yellow)', borderRadius: '50%' }}></span> 二进制核心事件物体属性 (EventObject Profile)</div>
              <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px' }}><span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>瓦片横坐标 (mx)</span><span style=${{ fontSize: '9px', color: '#fff', fontWeight: 'bold' }}>${activeNpc.x}</span></div>
                <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px' }}><span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>瓦片纵坐标 (my)</span><span style=${{ fontSize: '9px', color: '#fff', fontWeight: 'bold' }}>${activeNpc.y}</span></div>
                <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px' }}><span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>图层高度 (layer)</span><span style=${{ fontSize: '9px', color: '#fff', fontWeight: 'bold' }}>${activeNpc.layer}</span></div>
                <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px' }}><span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>初始朝向 (dir)</span><span style=${{ fontSize: '9px', color: '#fff', fontWeight: 'bold' }}>${activeNpc.dir === 0 ? '下 (0)' : activeNpc.dir === 1 ? '左 (1)' : activeNpc.dir === 2 ? '上 (2)' : '右 (3)'}</span></div>
                <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px' }}><span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>动作包 ID (mgoId)</span><span style=${{ fontSize: '9px', color: 'var(--glow-green)', fontWeight: 'bold' }}>${activeNpc.mgoId} (${getRoleName(activeNpc.mgoId)})</span></div>
                <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px' }}><span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>当前图元帧 (frame)</span><span style=${{ fontSize: '9px', color: '#fff', fontWeight: 'bold' }}>${activeNpc.frame}</span></div>
                <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px' }}><span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>生命活动状态 (state)</span><span style=${{ fontSize: '9px', color: 'var(--glow-yellow)', fontWeight: 'bold' }}>${activeNpc.state === 0 ? '0 (隐藏)' : activeNpc.state === 1 ? '1 (活跃)' : '2 (自动循环)'}</span></div>
                <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px' }}><span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>触发模式 (trigMode)</span><span style=${{ fontSize: '9px', color: '#fff', fontWeight: 'bold' }}>${activeNpc.trigMode}</span></div>
              </div>
            </div>
            
            <div>
              <div style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}><span style=${{ width: '3px', height: '3px', background: 'var(--glow-yellow)', borderRadius: '50%' }}></span> 绑定脚本事件指针 (点击立即穿梭反解)</div>
              <div style=${{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div class="gamedata-binding-item">
                  <span class="gamedata-binding-label">🔍 交互触发脚本 (trigScr)</span>
                  <span class="gamedata-binding-value">
                    ${activeNpc.trigScr > 0 ? html`<span onClick=${() => jumpToScript(activeNpc.trigScr)} style=${{ color: 'var(--glow-yellow)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}>Script #${activeNpc.trigScr} ➔ 点击反解</span>` : html`<span style=${{ color: 'rgba(255,255,255,0.25)' }}>无触发脚本 (0)</span>`}
                  </span>
                </div>
                <div class="gamedata-binding-item">
                  <span class="gamedata-binding-label">🤖 自动心跳脚本 (autoScr)</span>
                  <span class="gamedata-binding-value">
                    ${activeNpc.autoScr > 0 ? html`<span onClick=${() => jumpToScript(activeNpc.autoScr)} style=${{ color: 'var(--glow-yellow)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}>Script #${activeNpc.autoScr} ➔ 点击反解</span>` : html`<span style=${{ color: 'rgba(255,255,255,0.25)' }}>无自动脚本 (0)</span>`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ` : html`
      <div class="gamedata-detail" style=${{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>
        请在左侧选择一个 NPC 进行深度分析
      </div>
    `}
  `;
}

// 🎒 Item Tab 子组件
function ItemTabComponent({ selectedItemId, setSelectedItemId, jumpToScript }) {
  const ballCanvasRef = useRef(null);

  const items = state.items;

  const item = useMemo(() => {
    return items[selectedItemId] || items[99];
  }, [selectedItemId, items]);

  const info = useMemo(() => {
    return getDetailedItemInfo(item.id);
  }, [item.id]);

  // 步骤 1：绘制物品图标 Ball Canvas
  useEffect(() => {
    try {
      const ballCanvas = loadBall(item.id);
      drawPixelatedToCanvas(ballCanvas, ballCanvasRef.current);
    } catch (error) {
      console.error('绘制物品小图标 Ball 失败:', error);
      drawPixelatedToCanvas(null, ballCanvasRef.current);
    }
  }, [item.id]);

  return html`
    <div class="gamedata-sidebar" style=${{ flex: '0 0 260px' }}>
      <div class="gamedata-sidebar-header">
        <span class="gamedata-sidebar-title">🎒 游戏物品列表 (共 ${items.length} 个)</span>
      </div>
      <div class="gamedata-sidebar-list">
        ${items.map(it => {
          const isSelected = selectedItemId === it.id;
          return html`
            <div 
              key=${it.id} 
              onClick=${() => setSelectedItemId(it.id)} 
              class=${`gamedata-list-item ${isSelected ? 'is-selected' : ''}`}
            >
              <div class="gamedata-list-item-row">
                <span class="gamedata-list-item-title" dangerouslySetInnerHTML=${{ __html: getItemNameHtml(it.id) }}></span>
                <span class="gamedata-list-item-meta">ID #${it.id}</span>
              </div>
            </div>
          `;
        })}
      </div>
    </div>
    
    <div class="gamedata-detail">
      <div class="gamedata-detail-header">
        <div class="gamedata-detail-header-main">
          <h2 class="gamedata-detail-title" style=${{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} dangerouslySetInnerHTML=${{ __html: getItemNameHtml(item.id) }}></h2>
          <span class="gamedata-detail-badge">底层解构档案</span>
        </div>
        <div class="gamedata-detail-meta">物品 ID: <span style=${{ color: 'var(--glow-yellow)' }}>${item.id}</span></div>
      </div>
      
      <div class="gamedata-content-split">
        <div class="gamedata-preview-card">
          <span class="gamedata-preview-label">🎒 物品小图标 (Ball)</span>
          <canvas ref=${ballCanvasRef} width="40" height="40" class="gamedata-preview-canvas"></canvas>
          <span class="gamedata-preview-label" style=${{ marginTop: '5px' }}>底牌元数据参数</span>
          <div style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.35)', textAlign: 'left', lineHeight: '1.4', width: '100%' }}>
            数据偏移: ${info.offset}<br/>物品 Flags: ${info.flags}<br/>是否消耗: ${info.consumable}<br/>是否丢弃: ${info.throwable || '是'}<br/>是否可售: ${info.sellable || '是'}
          </div>
        </div>
        
        <div class="gamedata-scroll-panel">
          <div>
            <div class="gamedata-section-title">物品基础属性</div>
            <div class="gamedata-stat-grid" style=${{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">买价价值</div><div class="gamedata-stat-value" style=${{ color: 'var(--glow-yellow)' }}>${info.buy}</div></div>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">卖价价值</div><div class="gamedata-stat-value" style=${{ color: '#ff5777' }}>${info.sell}</div></div>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">物品类型</div><div class="gamedata-stat-value" style=${{ color: '#4db3ff' }}>${info.type}</div></div>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">适用角色</div><div class="gamedata-stat-value" style=${{ color: '#00ffaa', fontSize: '9.5px' }}>${info.role}</div></div>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">装备槽位</div><div class="gamedata-stat-value" style=${{ color: '#b366ff', fontSize: '9.5px' }}>${info.slot}</div></div>
              <div class="gamedata-stat-card"><div class="gamedata-stat-label">五灵抗性</div><div class="gamedata-stat-value" style=${{ color: '#00e5ff', fontSize: '9.5px' }}>${info.res || '无'}</div></div>
            </div>
          </div>
          
          ${info.slot !== '无' ? html`
            <div>
              <div class="gamedata-section-title">装备增益参数</div>
              <div class="gamedata-block-grid" style=${{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                <div class="gamedata-block-card"><div class="gamedata-block-label">⚔ 武术 ATK</div><div class="gamedata-block-value">${info.atk}</div></div>
                <div class="gamedata-block-card"><div class="gamedata-block-label">🛡 防御 DEF</div><div class="gamedata-block-value">${info.def}</div></div>
                <div class="gamedata-block-card"><div class="gamedata-block-label">🏃 身法 SPD</div><div class="gamedata-block-value">${info.spd}</div></div>
                <div class="gamedata-block-card"><div class="gamedata-block-label">🔮 灵力 MAG</div><div class="gamedata-block-value">${info.mag}</div></div>
                <div class="gamedata-block-card"><div class="gamedata-block-label">🪙 吉运 LCK</div><div class="gamedata-block-value">${info.lck}</div></div>
              </div>
            </div>
          ` : ''}
          
          <div>
            <div class="gamedata-section-title">绑定脚本事件指针 (点击立即穿梭反解)</div>
            <div class="gamedata-binding-list">
              <div class="gamedata-binding-item">
                <span class="gamedata-binding-label">🔮 使用触发脚本 (useScr)</span>
                <span class="gamedata-binding-value">
                  ${item.useScr > 0 ? html`<span onClick=${() => jumpToScript(item.useScr)} style=${{ color: 'var(--glow-yellow)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}>Script #${item.useScr} ➔ 穿梭反解</span>` : html`<span style=${{ color: 'rgba(255,255,255,0.25)' }}>无 (0)</span>`}
                </span>
              </div>
              <div class="gamedata-binding-item">
                <span class="gamedata-binding-label">🛡 装备触发脚本 (equScr)</span>
                <span class="gamedata-binding-value">
                  ${item.equScr > 0 ? html`<span onClick=${() => jumpToScript(item.equScr)} style=${{ color: 'var(--glow-yellow)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}>Script #${item.equScr} ➔ 穿梭反解</span>` : html`<span style=${{ color: 'rgba(255,255,255,0.25)' }}>无 (0)</span>`}
                </span>
              </div>
              <div class="gamedata-binding-item">
                <span class="gamedata-binding-label">🗑️ 丢弃触发脚本 (dropScr)</span>
                <span class="gamedata-binding-value">
                  ${item.dropScr > 0 ? html`<span onClick=${() => jumpToScript(item.dropScr)} style=${{ color: 'var(--glow-yellow)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}>Script #${item.dropScr} ➔ 穿梭反解</span>` : html`<span style=${{ color: 'rgba(255,255,255,0.25)' }}>无 (0)</span>`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// 📜 Script Tab 子组件
function ScriptTabComponent({ selectedScriptId, setSelectedScriptId }) {
  const [searchVal, setSearchVal] = useState(selectedScriptId);

  const totalScripts = state.scripts.length;

  const scriptRanges = useMemo(() => {
    const ranges = [];
    for (let i = 0; i < totalScripts; i += 20) {
      ranges.push({
        start: i,
        end: Math.min(totalScripts - 1, i + 19)
      });
    }
    return ranges;
  }, [totalScripts]);

  const listItems = useMemo(() => {
    const list = [];
    const startId = selectedScriptId;
    const endId = Math.min(totalScripts, startId + 20);

    for (let i = startId; i < endId; i++) {
      const scr = state.scripts[i];
      if (!scr) {
        continue;
      }
      const codeObj = scriptCodes[scr.code];
      list.push({
        id: scr.id,
        codeHex: `0x${scr.code.toString(16).toUpperCase()}`,
        cmdName: getCommandName(scr.code),
        officialDesc: codeObj ? codeObj.desc : '未知系统底层指令',
        params: `${scr.param1}, ${scr.param2}, ${scr.param3}`,
        desc: makeScriptHyperlinks(getInstructionChineseDetail(scr.code, scr.param1, scr.param2, scr.param3))
      });
    }
    return list;
  }, [selectedScriptId, totalScripts]);

  useEffect(() => {
    setSearchVal(selectedScriptId);
  }, [selectedScriptId]);

  const handleSearch = () => {
    const val = parseInt(searchVal, 10);
    if (!isNaN(val)) {
      setSelectedScriptId(Math.max(0, Math.min(totalScripts - 1, val)));
    }
  };

  const handleRangeClick = (startIdx) => {
    setSelectedScriptId(startIdx);
  };

  return html`
    <div class="gamedata-sidebar" style=${{ flex: '0 0 250px' }}>
      <div class="gamedata-sidebar-header">
        <span class="gamedata-sidebar-title">📜 脚本指令检索 (共 ${totalScripts} 条)</span>
        <div style=${{ display: 'flex', gap: '4px' }}>
          <input 
            type="number" 
            value=${searchVal} 
            onInput=${(e) => setSearchVal(e.target.value)} 
            min="0" 
            max=${totalScripts - 1} 
            style=${{ background: '#0c0a08', border: '1px solid rgba(255,215,0,0.2)', color: '#fff', fontSize: '8.5px', padding: '2px 4px', outline: 'none', borderRadius: '2px', flex: 1, textAlign: 'center' }}
          />
          <button 
            onClick=${handleSearch} 
            class="btn-dbg" 
            style=${{ color: 'var(--glow-yellow)', borderColor: 'rgba(255,215,0,0.2)', padding: '2px 6px', fontSize: '8.5px', cursor: 'pointer', fontWeight: 'bold' }}
          >一键反解</button>
        </div>
      </div>
      <div class="gamedata-sidebar-list">
        ${scriptRanges.map(range => {
          const isSelected = selectedScriptId >= range.start && selectedScriptId <= range.end;
          return html`
            <div 
              key=${range.start} 
              onClick=${() => handleRangeClick(range.start)} 
              class=${`gamedata-list-item ${isSelected ? 'is-selected' : ''}`}
            >
              <div class="gamedata-list-item-row">
                <span class="gamedata-list-item-title">段落 #${range.start} ➔ #${range.end}</span>
                <span class="gamedata-list-item-meta">${isSelected ? '●' : ''}</span>
              </div>
            </div>
          `;
        })}
      </div>
    </div>

    <div class="gamedata-detail">
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,215,0,0.15)', paddingBottom: '8px', marginBottom: '12px' }}>
        <h2 style=${{ margin: 0, fontSize: '12px', color: 'var(--glow-yellow)', fontWeight: 'bold' }}>📜 连续指令解析流 (从 ID #${selectedScriptId} 顺序向下解码)</h2>
      </div>
      
      <div style=${{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
        ${listItems.map(item => {
          const isHighlight = item.id === selectedScriptId;
          return html`
            <div 
              key=${item.id} 
              style=${{
                background: isHighlight ? 'rgba(255,215,0,0.05)' : 'rgba(255,255,255,0.01)',
                border: isHighlight ? '1px solid var(--glow-yellow)' : '1px solid rgba(255,255,255,0.02)',
                padding: '6px 12px',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '8px',
                transition: 'all 0.15s',
                gap: '16px'
              }}
            >
              <div style=${{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <span style=${{ fontWeight: 'bold', color: isHighlight ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.35)' }}>SCRIPT ID: #${item.id}</span>
                <span style=${{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)', padding: '1px 4px', borderRadius: '2px' }}>${item.codeHex} (${item.cmdName})</span>
                <span style=${{ color: 'var(--glow-green)', fontWeight: 'bold', textTransform: 'uppercase', background: 'rgba(0,255,157,0.06)', border: '1px solid rgba(0,255,157,0.2)', padding: '1px 4px', borderRadius: '2px' }}>${item.officialDesc}</span>
                <span style=${{ color: 'rgba(255,255,255,0.25)' }}>Params: (${item.params})</span>
              </div>
              <div 
                style=${{ fontSize: '9.5px', color: '#fff', fontWeight: 500, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} 
                dangerouslySetInnerHTML=${{ __html: item.desc || '' }}
              ></div>
            </div>
          `;
        })}
      </div>
    </div>
  `;
}

// 🗺️ Scene Tab 子组件
function SceneTabComponent({ selectedSceneId, setSelectedSceneId, jumpToScript, jumpToNpc }) {
  const gopCanvasRef = useRef(null);

  const scenes = useMemo(() => {
    const list = [];
    for (let i = 1; i < state.scenes.length; i++) {
      const s = state.scenes[i];
      if (s) {
        list.push(s);
      }
    }
    return list;
  }, []);

  const scene = useMemo(() => {
    return state.scenes[selectedSceneId] || scenes[0];
  }, [selectedSceneId, scenes]);

  const sceneNpcs = useMemo(() => {
    if (!scene) {
      return [];
    }
    const list = [];
    for (let i = scene.startEventId + 1; i <= scene.endEventId; i++) {
      const npcObj = state.eventObjects[i];
      if (npcObj && npcObj.type === 'npc') {
        list.push(npcObj);
      }
    }
    return list;
  }, [scene]);

  // GOP 列表项生成像素预览小图 (Base64) 缓存
  const npcImages = useMemo(() => {
    const cache = {};
    sceneNpcs.forEach(npc => {
      const roleName = getRoleName(npc.mgoId);
      if (roleName && npc.mgoId > 0) {
        try {
          const npcCanvas = loadMgo(npc.mgoId, npc.frame || 0);
          if (npcCanvas) {
            cache[npc.id] = npcCanvas.toDataURL();
          }
        } catch (error) {
          // 容错
        }
      }
    });
    return cache;
  }, [sceneNpcs]);

  // 步骤 1：绘制场景 GOP Canvas
  useEffect(() => {
    if (!scene) {
      return;
    }
    try {
      const gopCanvas = loadGop(scene.mapId, 0);
      drawPixelatedToCanvas(gopCanvas, gopCanvasRef.current);
    } catch (error) {
      console.error('绘制场景专属 GOP 失败:', error);
      drawPixelatedToCanvas(null, gopCanvasRef.current);
    }
  }, [scene?.sceneId, scene?.mapId]);

  return html`
    <div class="gamedata-sidebar" style=${{ flex: '0 0 250px' }}>
      <div class="gamedata-sidebar-header">
        <span class="gamedata-sidebar-title">🗺️ 游戏场景 Scenes 目录</span>
      </div>
      <div class="gamedata-sidebar-list">
        ${scenes.map(s => {
          const isSelected = selectedSceneId === s.sceneId;
          return html`
            <div 
              key=${s.sceneId} 
              onClick=${() => setSelectedSceneId(s.sceneId)} 
              class=${`gamedata-list-item ${isSelected ? 'is-selected' : ''}`}
            >
              <div class="gamedata-list-item-row">
                <span class="gamedata-list-item-title">Scene #${s.sceneId}</span>
                <span class="gamedata-list-item-meta">Map 0x${s.mapId.toString(16).toUpperCase()}</span>
              </div>
            </div>
          `;
        })}
      </div>
    </div>

    ${scene ? html`
      <div class="gamedata-detail">
        <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,215,0,0.15)', paddingBottom: '8px', marginBottom: '12px' }}>
          <h2 style=${{ margin: 0, fontSize: '12px', color: 'var(--glow-yellow)', fontWeight: 'bold' }}>🗺️ Scene #${scene.sceneId} (Map #${scene.mapId}) 的多维场景档案</h2>
        </div>
        
        <div style=${{ flex: 1, display: 'flex', gap: '15px', overflow: 'hidden' }}>
          <div style=${{ width: '180px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '12px', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '3px' }}>
            <span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontWeight: 'bold' }}>🗺️ 场景专属 GOP 图元解码</span>
            <canvas ref=${gopCanvasRef} width="120" height="120" style=${{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px' }}></canvas>
            <div style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: '1.3', marginTop: '4px' }}>
              大地图包 ID: gop.mkf #${scene.mapId}<br/>场景图元: GOP #0<br/>自动平铺防滑绘制
            </div>
          </div>
          
          <div style=${{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingRight: '4px' }}>
            <div>
              <div style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}><span style=${{ width: '3px', height: '3px', background: 'var(--glow-yellow)', borderRadius: '50%' }}></span> 场景事件与地图底牌</div>
              <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px' }}><span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>对应大地图 ID (mapId)</span><span style=${{ fontSize: '9px', color: 'var(--glow-green)', fontWeight: 'bold' }}>0x${scene.mapId.toString(16).toUpperCase()} (${scene.mapId})</span></div>
                <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px' }}><span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>场景物体区间</span><span style=${{ fontSize: '9px', color: '#fff', fontWeight: 'bold' }}>${scene.startEventId} ➔ ${scene.endEventId}</span></div>
                <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px' }}>
                  <span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>进入场景触发脚本</span>
                  <span style=${{ fontSize: '8.5px', fontWeight: 'bold' }}>
                    ${scene.enterScriptId > 0 ? html`<span onClick=${() => jumpToScript(scene.enterScriptId)} style=${{ color: 'var(--glow-yellow)', textDecoration: 'underline', cursor: 'pointer' }}>Script #${scene.enterScriptId}</span>` : html`<span style=${{ color: 'rgba(255,255,255,0.25)' }}>无</span>`}
                  </span>
                </div>
                <div class="gamedata-block-card" style=${{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px' }}>
                  <span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>离开场景触发脚本</span>
                  <span style=${{ fontSize: '8.5px', fontWeight: 'bold' }}>
                    ${scene.exitScriptId > 0 ? html`<span onClick=${() => jumpToScript(scene.exitScriptId)} style=${{ color: 'var(--glow-yellow)', textDecoration: 'underline', cursor: 'pointer' }}>Script #${scene.exitScriptId}</span>` : html`<span style=${{ color: 'rgba(255,255,255,0.25)' }}>无</span>`}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <div style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}><span style=${{ width: '3px', height: '3px', background: 'var(--glow-yellow)', borderRadius: '50%' }}></span> 当前场景内放置的 NPC 物体列表 (${sceneNpcs.length} 个)</div>
              <div style=${{ border: '1px solid rgba(255,255,255,0.03)', background: 'rgba(0,0,0,0.2)', borderRadius: '3px' }}>
                <table style=${{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', textAlign: 'left' }}>
                  <thead>
                    <tr style=${{ background: 'rgba(255,215,0,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)' }}>
                      <th style=${{ padding: '4px 8px' }}>NPC ID</th>
                      <th style=${{ padding: '4px 8px' }}>人物名称</th>
                      <th style=${{ padding: '4px 8px' }}>坐标位置</th>
                      <th style=${{ padding: '4px 8px' }}>自动脚本</th>
                      <th style=${{ padding: '4px 8px' }}>触发脚本</th>
                      <th style=${{ padding: '4px 8px' }}>交互跳转</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sceneNpcs.map(npc => {
                      const roleName = getRoleName(npc.mgoId);
                      const imgUrl = npcImages[npc.id];
                      return html`
                        <tr 
                          key=${npc.id} 
                          style=${{ borderBottom: '1px solid rgba(255,255,255,0.015)', transition: 'background 0.1s' }}
                          onMouseEnter=${(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                          onMouseLeave=${(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style=${{ padding: '4px 8px', color: 'var(--glow-yellow)', fontWeight: 'bold' }}>#${npc.id}</td>
                          <td style=${{ padding: '4px 8px', color: '#fff', display: 'flex', alignItems: 'center' }}>
                            ${imgUrl ? html`<img src=${imgUrl} style=${{ height: '18px', imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: '4px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '2px', padding: '1px' }} />` : ''}
                            <span>${roleName}</span>
                          </td>
                          <td style=${{ padding: '4px 8px', color: 'rgba(255,255,255,0.5)' }}>(${npc.x}, ${npc.y})</td>
                          <td style=${{ padding: '4px 8px' }}>
                            ${npc.autoScr > 0 ? html`<span onClick=${() => jumpToScript(npc.autoScr)} style=${{ color: 'var(--glow-yellow)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}>#${npc.autoScr}</span>` : html`<span style=${{ color: 'rgba(255,255,255,0.25)' }}>无</span>`}
                          </td>
                          <td style=${{ padding: '4px 8px' }}>
                            ${npc.trigScr > 0 ? html`<span onClick=${() => jumpToScript(npc.trigScr)} style=${{ color: 'var(--glow-yellow)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}>#${npc.trigScr}</span>` : html`<span style=${{ color: 'rgba(255,255,255,0.25)' }}>无</span>`}
                          </td>
                          <td style=${{ padding: '4px 8px' }}>
                            <button onClick=${() => jumpToNpc(npc.id)} class="btn-dbg" style=${{ color: 'var(--glow-yellow)', borderColor: 'rgba(255,215,0,0.15)', padding: '1px 4px', fontSize: '7px', cursor: 'pointer' }}>定位 NPC</button>
                          </td>
                        </tr>
                      `;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    ` : html`
      <div class="gamedata-detail" style=${{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '10px' }}>
        请在左侧选择一个场景进行全景剖析
      </div>
    `}
  `;
}

// 📚 GameDataApp 根组件
export function GameDataApp() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('role');

  const [selectedRoleId, setSelectedRoleId] = useState(0);
  const [selectedNpcId, setSelectedNpcId] = useState(1);
  const [selectedItemId, setSelectedItemId] = useState(99);
  const [selectedScriptId, setSelectedScriptId] = useState(0);
  const [selectedSceneId, setSelectedSceneId] = useState(1);

  const [npcFilterKeyword, setNpcFilterKeyword] = useState('');

  // 步骤 1：挂载时将跳转和显隐接口注册到 window 上供原生代码调用
  useEffect(() => {
    window.openGameDataModal = () => {
      setIsOpen(true);
    };

    window.closeGameDataModal = () => {
      setIsOpen(false);
    };

    window.switchGameDataTab = (tabName) => {
      setActiveTab(tabName);
    };

    window.onGameDataRoleSelect = (roleId) => {
      setSelectedRoleId(roleId);
    };

    window.onGameDataNpcSelect = (npcId) => {
      setSelectedNpcId(npcId);
    };

    window.onGameDataItemSelect = (itemId) => {
      setSelectedItemId(itemId);
    };

    window.onGameDataSceneSelect = (sceneId) => {
      setSelectedSceneId(sceneId);
    };

    window.jumpToGameDataScript = (scriptId) => {
      const parsedId = Math.max(0, Math.min(state.scripts.length - 1, parseInt(scriptId, 10)));
      setSelectedScriptId(parsedId);
      setActiveTab('script');
      setIsOpen(true);
    };

    window.jumpToGameDataNpc = (npcId) => {
      setSelectedNpcId(npcId);
      setNpcFilterKeyword('');
      setActiveTab('npc');
      setIsOpen(true);
    };

    // 原生对“一键反解”等操作的兼容绑定
    window.searchGameDataScript = () => {
      const input = document.getElementById('input-gamedata-script-id');
      if (input) {
        const val = parseInt(input.value, 10);
        if (!isNaN(val)) {
          setSelectedScriptId(Math.max(0, Math.min(state.scripts.length - 1, val)));
        }
      }
    };

    window.searchGameDataNpc = (val) => {
      setNpcFilterKeyword(val);
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  // 步骤 2：联动跳转方法集合
  const jumpToScript = (scriptId) => {
    window.jumpToGameDataScript(scriptId);
  };

  const jumpToNpc = (npcId) => {
    window.jumpToGameDataNpc(npcId);
  };

  const tabs = [
    { id: 'role', label: '👤 角色信息 (rgm.mkf / mgo.mkf)' },
    { id: 'npc', label: '👾 NPC 信息 (sss.mkf #0)' },
    { id: 'item', label: '🎒 物品资料' },
    { id: 'script', label: '📜 脚本信息 (sss.mkf #4)' },
    { id: 'scene', label: '🗺️ 场景信息 (sss.mkf #1 / gop.mkf)' }
  ];

  return html`
    <div id="game-data-modal" style=${{ display: 'flex', position: 'fixed', zIndex: 99999, left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(5,5,8,0.75)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style=${{ background: 'rgba(15,13,8,0.96)', border: '1px solid var(--glow-yellow)', borderRadius: '4px', boxShadow: '0 0 25px rgba(255, 215, 0, 0.15)', width: 'calc(100% - 40px)', height: 'calc(100% - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'JetBrains Mono', sans-serif" }}>
        <!-- 弹窗头部 -->
        <div style=${{ background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style=${{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style=${{ width: '5px', height: '5px', background: 'var(--glow-yellow)', borderRadius: '50%', boxShadow: '0 0 6px var(--glow-yellow)' }}></div>
            <span style=${{ fontSize: '11px', fontWeight: 'bold', color: 'var(--glow-yellow)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>📚 PAL GAME DATA & PROFILES SYSTEM (游戏实时资料与联动调试系统)</span>
          </div>
          <button 
            onClick=${() => setIsOpen(false)} 
            style=${{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '14px', cursor: 'pointer', outline: 'none' }}
          >✕</button>
        </div>
        
        <!-- 资料大类 Tabs 切换栏 -->
        <div style=${{ background: 'rgba(0,0,0,0.4)', padding: '6px 12px', borderBottom: '1px solid var(--border-glass)', display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          ${tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return html`
              <button 
                key=${tab.id}
                class=${`btn-dbg gamedata-tab-btn ${isActive ? 'active' : ''}`}
                onClick=${() => setActiveTab(tab.id)}
                style=${{
                  color: isActive ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.6)',
                  borderColor: isActive ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.06)',
                  padding: '2px 10px',
                  fontSize: '8.5px',
                  cursor: 'pointer'
                }}
              >${tab.label}</button>
            `;
          })}
        </div>
        
        <!-- 主内容展示区 -->
        <div id="gamedata-main-container" style=${{ flex: 1, display: 'flex', overflow: 'hidden', background: '#040302' }}>
          ${activeTab === 'role' && html`<${RoleTabComponent} selectedRoleId=${selectedRoleId} setSelectedRoleId=${setSelectedRoleId} jumpToScript=${jumpToScript} />`}
          ${activeTab === 'npc' && html`<${NpcTabComponent} selectedNpcId=${selectedNpcId} setSelectedNpcId=${setSelectedNpcId} npcFilterKeyword=${npcFilterKeyword} setNpcFilterKeyword=${setNpcFilterKeyword} jumpToScript=${jumpToScript} />`}
          ${activeTab === 'item' && html`<${ItemTabComponent} selectedItemId=${selectedItemId} setSelectedItemId=${setSelectedItemId} jumpToScript=${jumpToScript} />`}
          ${activeTab === 'script' && html`<${ScriptTabComponent} selectedScriptId=${selectedScriptId} setSelectedScriptId=${setSelectedScriptId} />`}
          ${activeTab === 'scene' && html`<${SceneTabComponent} selectedSceneId=${selectedSceneId} setSelectedSceneId=${setSelectedSceneId} jumpToScript=${jumpToScript} jumpToNpc=${jumpToNpc} />`}
        </div>
      </div>
    </div>
  `;
}
