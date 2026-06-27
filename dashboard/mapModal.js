// ==================== 🗺️ 场景大地图瞬移定位器 React 核心逻辑 ====================

import { React, ReactDOM, html } from './gameData/ui-helper.js';

const { useState, useEffect, useRef } = React;

function MapModalApp() {
  const [isVisible, setIsVisible] = useState(false);
  const [zoom, setZoom] = useState(0.5);
  const [infoText, setInfoText] = useState('地图: - | 主角坐标: (-, -)');

  const canvasRef = useRef(null);

  // 缓存底图瓦片解析数据，防重复绘制
  const cacheRef = useRef({
    canvas: null,
    mapId: null
  });

  // 用于区分单击与双击的定时器句柄
  const clickTimerRef = useRef(null);

  // 挂载全局方法到 window，实现对外部 Vanilla 调用接口的解耦与完美适配
  useEffect(() => {
    window.openMapModal = () => {
      setIsVisible(true);
    };

    window.closeMapModal = () => {
      setIsVisible(false);
    };

    window.setMapZoom = (z) => {
      setZoom(z);
    };

    window.refreshMapModal = () => {
      drawMap();
    };
  }, [isVisible]);

  // 当定位器弹窗打开、缩放改变时，自动触发重绘
  useEffect(() => {
    if (isVisible) {
      drawMap();
    }
  }, [isVisible, zoom]);

  // 执行具体的瓦片拼接与画布绘制
  const drawMap = () => {
    const state = window.state;
    if (!state) return;

    const mapId = state.mapId;
    setInfoText(`地图: 0x${mapId.toString(16).toUpperCase()} (${mapId}) | 主角坐标: (${state.mx}, ${state.my})${state.mhalf ? ' +0.5' : ''}`);

    import('../js/resources/pal.js').then(({ loadMap, loadGop, u9s }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');

      // 步骤 1：若大地图ID变更，则重新解析大地图瓦片并渲染到底图缓存 canvas 中
      if (!cacheRef.current.canvas || cacheRef.current.mapId !== mapId) {
        const data = loadMap(mapId);
        if (!data) return;

        const cacheCanvas = document.createElement('canvas');
        cacheCanvas.width = 2112;
        cacheCanvas.height = 2112;
        const cacheCtx = cacheCanvas.getContext('2d');

        const offsetX = 32;
        const offsetY = 32;

        // 双重循环遍历绘制 128x128 的瓦片拼图
        for (let y = 0; y < 128; y++) {
          for (let x = 0; x < 128; x++) {
            const posX = 16 * x;
            const posY = 16 * y + (x % 2 === 0 ? 0 : 8);
            const index = y * 128 + x;

            const tileId1 = u9s(data, index);
            const img1 = loadGop(mapId, tileId1);
            if (img1) {
              cacheCtx.drawImage(img1, posX - 16 + offsetX, posY - 8 + offsetY);
            }

            let tileId2 = u9s(data, index, 2);
            tileId2--;
            if (tileId2 !== -1) {
              const img2 = loadGop(mapId, tileId2);
              if (img2) {
                cacheCtx.drawImage(img2, posX - 16 + offsetX, posY - 8 + offsetY);
              }
            }
          }
        }
        cacheRef.current.canvas = cacheCanvas;
        cacheRef.current.mapId = mapId;
      }

      // 重置实际绘制 canvas 尺寸
      canvas.width = 2112;
      canvas.height = 2112;

      // 步骤 2：绘制缓存好的大地图底图
      ctx.drawImage(cacheRef.current.canvas, 0, 0);

      // 步骤 3：遍历并绘制当前场景的所有 NPC 与事件实体坐标
      const offsetX = 32;
      const offsetY = 32;
      for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
        const o = state.eventObjects[i];
        if (o && o.state > 0) {
          const cx = o.x + offsetX;
          const cy = o.y + offsetY;

          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fillStyle = o.mgoId === 0 ? '#ff3b6f' : '#ffd000'; // 机关为红，角色人物为黄
          ctx.fill();
          ctx.closePath();

          ctx.font = '9px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`#${o.id}`, cx + 6, cy + 3);
        }
      }

      // 步骤 4：在地图上绘制主角当前的绝对像素坐标标识点
      const px = state.mapX + offsetX;
      const py = state.mapY + offsetY;

      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff9d';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.closePath();
    });
  };

  // 点击或双击地图瞬间移动主角的公共计算逻辑
  const handleTeleport = (event, autoClose = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = (event.clientX - rect.left) / zoom;
    const clickY = (event.clientY - rect.top) / zoom;

    const mapX = clickX - 32;
    const mapY = clickY - 32;

    let mx = Math.floor(mapX / 32);
    let my = Math.floor(mapY / 16);
    let mhalf = Math.round((mapX - mx * 32) / 16);

    if (mhalf < 0) mhalf = 0;
    if (mhalf > 1) mhalf = 1;
    if (mx < 0) mx = 0;
    if (mx > 127) mx = 127;
    if (my < 0) my = 0;
    if (my > 127) my = 127;

    if (window.setRolePos) {
      window.setRolePos(mx, my, mhalf);
      Promise.all([
        import('../js/ui/draw.js')
      ]).then(([{ update }]) => {
        update();
      });

      if (autoClose) {
        setIsVisible(false);
      } else {
        drawMap();
      }
    }
  };

  // 鼠标移动显示光标所对应的地图与瓦片格子坐标
  const handleMouseMove = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = (event.clientX - rect.left) / zoom;
    const clickY = (event.clientY - rect.top) / zoom;

    const mapX = clickX - 32;
    const mapY = clickY - 32;

    let mx = Math.floor(mapX / 32);
    let my = Math.floor(mapY / 16);
    let mhalf = Math.round((mapX - mx * 32) / 16);

    if (mhalf < 0) mhalf = 0;
    if (mhalf > 1) mhalf = 1;
    if (mx < 0) mx = 0;
    if (mx > 127) mx = 127;
    if (my < 0) my = 0;
    if (my > 127) my = 127;

    const state = window.state;
    const mapId = state ? state.mapId : 0;
    setInfoText(`地图: 0x${mapId.toString(16).toUpperCase()} (${mapId}) | 主角: (${state?.mx}, ${state?.my}) | 光标: (${mx}, ${my})${mhalf ? ' +0.5' : ''}`);
  };

  // 鼠标离开还原显示主角位置
  const handleMouseLeave = () => {
    const state = window.state;
    if (!state) return;
    const mapId = state.mapId;
    setInfoText(`地图: 0x${mapId.toString(16).toUpperCase()} (${mapId}) | 主角: (${state.mx}, ${state.my})${state.mhalf ? ' +0.5' : ''}`);
  };

  if (!isVisible) return null;

  return html`
    <div id="map-modal" style=${{ display: 'flex', position: 'fixed', zIndex: 99999, left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(5,5,8,0.75)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style=${{ '--modal-accent': 'var(--glow-blue)', background: 'rgba(10,13,20,0.96)', border: '1px solid var(--glow-blue)', borderRadius: '4px', boxShadow: '0 0 25px rgba(0, 225, 255, 0.15)', width: 'calc(100% - 40px)', height: 'calc(100% - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'JetBrains Mono', sans-serif" }}>
        
        <!-- 弹窗头部 -->
        <div class="tool-modal-header">
          <div class="tool-modal-title-row">
            <div class="tool-modal-dot"></div>
            <span class="tool-modal-heading" style=${{ textTransform: 'uppercase' }}>🗺️ PAL REALTIME MAP VIEWER (场景大地图瞬移定位器)</span>
          </div>
          <div style=${{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style=${{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>${infoText}</span>
            <button onClick=${window.closeMapModal} class="tool-modal-close">✕</button>
          </div>
        </div>

        <!-- 主体视图区 -->
        <div style=${{ flex: 1, overflow: 'auto', background: '#030305', position: 'relative', padding: '10px' }} id="map-canvas-container">
          <div style=${{ position: 'relative', display: 'block', margin: '0 auto', cursor: 'crosshair', width: 'fit-content' }}>
            <canvas 
              ref=${canvasRef}
              onClick=${(e) => {
                // 单击延迟执行，留出双击判定窗口（200ms），双击时取消单击瞬移
                if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
                clickTimerRef.current = setTimeout(() => { clickTimerRef.current = null; handleTeleport(e, false); }, 200);
              }}
              onDoubleClick=${(e) => {
                if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
                handleTeleport(e, true);
              }}
              onMouseMove=${handleMouseMove}
              onMouseLeave=${handleMouseLeave}
              style=${{
                display: 'block',
                imageRendering: 'pixelated',
                width: `${2112 * zoom}px`,
                height: `${2112 * zoom}px`
              }}
            />
          </div>
        </div>

        <!-- 底部工具栏 -->
        <div style=${{ background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)' }}>💡 提示：在地图上点击任意位置即可瞬间移动主角，双击地图直接关闭窗口。当前地图大小为 128x128 瓦片网格。</span>
          <div style=${{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style=${{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '15px' }}>
              <span style=${{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>🔍 缩放:</span>
              <button class=${`btn-dbg map-zoom-btn ${zoom === 0.25 ? 'active' : ''}`} onClick=${() => window.setMapZoom(0.25)} style=${{ padding: '1px 6px', fontSize: '8.5px' }}>25%</button>
              <button class=${`btn-dbg map-zoom-btn ${zoom === 0.5 ? 'active' : ''}`} onClick=${() => window.setMapZoom(0.5)} style=${{ padding: '1px 6px', fontSize: '8.5px' }}>50%</button>
              <button class=${`btn-dbg map-zoom-btn ${zoom === 1.0 ? 'active' : ''}`} onClick=${() => window.setMapZoom(1.0)} style=${{ padding: '1px 6px', fontSize: '8.5px' }}>100%</button>
            </div>
            <button class="btn-dbg" onClick=${window.refreshMapModal} style=${{ color: 'var(--glow-green)', borderColor: 'rgba(0, 255, 157, 0.2)', padding: '2px 8px', fontSize: '9px', cursor: 'pointer' }}>🔄 刷新地图</button>
            <button class="btn-dbg" onClick=${window.closeMapModal} style=${{ color: '#fff', borderColor: 'rgba(255,255,255,0.1)', padding: '2px 8px', fontSize: '9px', cursor: 'pointer' }}>关闭</button>
          </div>
        </div>

      </div>
    </div>
  `;
}

export function initMapModal() {
  const container = document.getElementById('map-modal-root');
  if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(html`<${MapModalApp} />`);
  }
}
