import { loadMgo } from '../../../resources/pal.js';
import { state } from '../../../engine/state.js';
import { drawPixelated, getRoleName } from '../helpers.js';
import { renderDetailPanel, renderListItem, renderSidebar } from '../renderers.js';
import { gameDataStore } from '../store.js';

export function renderNpcTab(container) {
  const npcs = [];
  for (let i = 1; i < state.eventObjects.length; i++) {
    const currentObject = state.eventObjects[i];
    if (currentObject && currentObject.type === 'npc') {
      npcs.push(currentObject);
    }
  }

  const filteredNpcs = npcs.filter(npc => {
    const name = getRoleName(npc.mgoId);
    const searchStr = `${npc.id} ${npc.mgoId} ${name}`.toLowerCase();
    return searchStr.indexOf(gameDataStore.npcFilterKeyword.toLowerCase()) !== -1;
  });

  const listItems = [];

  if (filteredNpcs.length === 0) {
    listItems.push(`<div style="text-align: center; color: rgba(255,255,255,0.2); font-size: 8.5px; padding-top: 20px;">未找到匹配的 NPC</div>`);
  } else {
    filteredNpcs.forEach(npc => {
      listItems.push(renderListItem({
        dataAttr: 'data-npc-item',
        dataValue: npc.id,
        onclick: `onGameDataNpcSelect(${npc.id})`,
        selected: gameDataStore.selectedNpcId === npc.id,
        title: `🤖 NPC #${npc.id}`,
        meta: `Dir: ${npc.dir}`,
        subtitle: getRoleName(npc.mgoId),
        tail: `(${npc.x}, ${npc.y})`
      }));
    });
  }

  const npc = state.eventObjects[gameDataStore.selectedNpcId] || filteredNpcs[0];
  const leftHtml = renderSidebar({
    width: 280,
    title: `👾 全局 NPC 列表 (共 ${npcs.length} 个)`,
    toolbarHtml: `<input type="text" id="input-gamedata-npc-filter" oninput="searchGameDataNpc(this.value)" value="${gameDataStore.npcFilterKeyword}" placeholder="输入 ID 或角色名搜索..." style="background: #0c0a08; border: 1px solid rgba(255,215,0,0.2); color: #fff; font-size: 8px; padding: 3px 6px; outline: none; border-radius: 2px;">`,
    bodyHtml: listItems.join('')
  });
  const rightHtml = npc
    ? renderDetailPanel('data-npc-right', buildNpcRightHtml(npc))
    : `
      <div data-npc-right style="flex: 1; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.2); font-size: 10px;">
        请在左侧选择一个 NPC 进行深度分析
      </div>
    `;

  container.innerHTML = leftHtml + rightHtml;

  if (npc && npc.mgoId) {
    setTimeout(() => {
      try {
        const npcCanvas = loadMgo(npc.mgoId, npc.frame);
        if (npcCanvas) {
          drawPixelated(npcCanvas, 'canvas-npc-mgo');
          const sizeLabel = document.getElementById('label-npc-mgo-size');
          if (sizeLabel) {
            sizeLabel.innerText = `${npcCanvas.width}x${npcCanvas.height} px`;
          }
        }
      } catch (error) {
        console.error('绘制 NPC 像素精灵图失败:', error);
      }
    }, 30);
  }
}

export function onGameDataNpcSelect(npcId) {
  gameDataStore.selectedNpcId = npcId;
  updateNpcSelection();
}

export function searchGameDataNpc(val) {
  gameDataStore.npcFilterKeyword = val;
  renderNpcTab(document.getElementById('gamedata-main-container'));

  const input = document.getElementById('input-gamedata-npc-filter');
  if (input) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

export function jumpToGameDataNpc(npcId) {
  gameDataStore.selectedNpcId = npcId;
  gameDataStore.npcFilterKeyword = '';

  if (gameDataStore.activeTab === 'npc') {
    updateNpcSelection();
    return;
  }

  window.switchGameDataTab?.('npc');
}

function updateNpcSelection() {
  const container = document.getElementById('gamedata-main-container');

  container.querySelectorAll('[data-npc-item]').forEach(el => {
    el.classList.remove('is-selected');
  });

  const activeEl = container.querySelector(`[data-npc-item="${gameDataStore.selectedNpcId}"]`);
  if (activeEl) {
    activeEl.classList.add('is-selected');
  }

  const rightPanel = container.querySelector('[data-npc-right]');
  if (!rightPanel) {
    return;
  }

  const npc = state.eventObjects[gameDataStore.selectedNpcId];
  if (npc && npc.mgoId) {
    rightPanel.innerHTML = buildNpcRightHtml(npc);
    setTimeout(() => {
      try {
        const npcCanvas = loadMgo(npc.mgoId, npc.frame);
        if (npcCanvas) {
          drawPixelated(npcCanvas, 'canvas-npc-mgo');
          const sizeLabel = document.getElementById('label-npc-mgo-size');
          if (sizeLabel) {
            sizeLabel.innerText = `${npcCanvas.width}x${npcCanvas.height} px`;
          }
        }
      } catch (error) {
        console.error('绘制 NPC 像素精灵图失败:', error);
      }
    }, 30);
  }
}

function buildNpcRightHtml(npc) {
  const roleName = getRoleName(npc.mgoId);
  const trigScrHtml = npc.trigScr > 0 ? `<span onclick="jumpToGameDataScript(${npc.trigScr})" style="color: var(--glow-yellow); text-decoration: underline; cursor: pointer; font-weight: bold;">Script #${npc.trigScr} ➔ 点击反解</span>` : '<span style="color: rgba(255,255,255,0.25);">无触发脚本 (0)</span>';
  const autoScrHtml = npc.autoScr > 0 ? `<span onclick="jumpToGameDataScript(${npc.autoScr})" style="color: var(--glow-yellow); text-decoration: underline; cursor: pointer; font-weight: bold;">Script #${npc.autoScr} ➔ 点击反解</span>` : '<span style="color: rgba(255,255,255,0.25);">无自动脚本 (0)</span>';

  return `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.15); padding-bottom: 8px; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <h2 style="margin: 0; font-size: 12px; color: var(--glow-yellow); font-weight: bold;">👾 NPC #${npc.id} [${roleName}] 的运行时状态分析</h2>
      </div>
    </div>
    <div style="flex: 1; display: flex; gap: 15px; overflow: hidden;">
      <div style="width: 180px; display: flex; flex-direction: column; gap: 8px; align-items: center; background: rgba(0,0,0,0.4); padding: 12px; border: 1px solid rgba(255,255,255,0.02); border-radius: 3px;">
        <span style="font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold;">👾 原生 2D 像素精灵图</span>
        <canvas id="canvas-npc-mgo" width="100" height="100" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px;"></canvas>
        <div style="font-size: 7.5px; color: rgba(255,255,255,0.3); text-align: center; line-height: 1.3; margin-top: 4px;">动作包: mgo.mkf #${npc.mgoId}<br>当前帧数: Frame #${npc.frame}<br>像素尺寸: <span id="label-npc-mgo-size" style="color:var(--glow-yellow);">--x--</span></div>
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding-right: 4px;">
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 二进制核心事件物体属性 (EventObject Profile)</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">瓦片横坐标 (mx)</span><span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.x}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">瓦片纵坐标 (my)</span><span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.y}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">图层高度 (layer)</span><span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.layer}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">初始朝向 (dir)</span><span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.dir === 0 ? '下 (0)' : npc.dir === 1 ? '左 (1)' : npc.dir === 2 ? '上 (2)' : '右 (3)'}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">动作包 ID (mgoId)</span><span style="font-size: 9px; color: var(--glow-green); font-weight: bold;">${npc.mgoId} (${roleName})</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">当前图元帧 (frame)</span><span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.frame}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">生命活动状态 (state)</span><span style="font-size: 9px; color: var(--glow-yellow); font-weight: bold;">${npc.state === 0 ? '0 (隐藏)' : npc.state === 1 ? '1 (活跃)' : '2 (自动循环)'}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">触发模式 (trigMode)</span><span style="font-size: 9px; color: #fff; font-weight: bold;">${npc.trigMode}</span></div>
          </div>
        </div>
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 绑定脚本事件指针 (点击立即穿梭反解)</div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,215,0,0.08); padding: 6px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.35);">🔍 交互触发脚本 (trigScr)</span><span style="font-size: 8.5px;">${trigScrHtml}</span></div>
            <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,215,0,0.08); padding: 6px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.35);">🤖 自动心跳脚本 (autoScr)</span><span style="font-size: 8.5px;">${autoScrHtml}</span></div>
          </div>
        </div>
      </div>
    </div>`;
}
