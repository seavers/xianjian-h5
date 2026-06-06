import { loadGop, loadMgo } from '../../../resources/pal.js';
import { state } from '../../../engine/state.js';
import { drawPixelated, getRoleName } from '../helpers.js';
import { renderDetailPanel, renderListItem, renderSidebar } from '../renderers.js';
import { gameDataStore } from '../store.js';

export function renderSceneTab(container) {
  const scenes = [];
  for (let i = 1; i < state.scenes.length; i++) {
    const scene = state.scenes[i];
    if (scene) {
      scenes.push(scene);
    }
  }

  const listItems = [];

  scenes.forEach(scene => {
    listItems.push(renderListItem({
      dataAttr: 'data-scene-item',
      dataValue: scene.sceneId,
      onclick: `onGameDataSceneSelect(${scene.sceneId})`,
      selected: gameDataStore.selectedSceneId === scene.sceneId,
      title: `Scene #${scene.sceneId}`,
      meta: `Map 0x${scene.mapId.toString(16).toUpperCase()}`
    }));
  });

  const scene = state.scenes[gameDataStore.selectedSceneId] || scenes[0];
  const leftHtml = renderSidebar({ width: 250, title: '🗺️ 游戏场景 Scenes 目录', bodyHtml: listItems.join('') });
  const rightHtml = scene
    ? renderDetailPanel('data-scene-right', buildSceneRightHtml(scene))
    : `
      <div data-scene-right style="flex: 1; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.2); font-size: 10px;">
        请在左侧选择一个场景进行全景剖析
      </div>
    `;

  container.innerHTML = leftHtml + rightHtml;

  if (scene) {
    setTimeout(() => {
      try {
        const gopCanvas = loadGop(scene.mapId, 0);
        if (gopCanvas) {
          drawPixelated(gopCanvas, 'canvas-scene-gop');
        }
      } catch (error) {
        console.error('绘制场景专属 GOP 失败:', error);
      }
    }, 30);
  }
}

export function onGameDataSceneSelect(sceneId) {
  gameDataStore.selectedSceneId = sceneId;
  updateSceneSelection();
}

function updateSceneSelection() {
  const container = document.getElementById('gamedata-main-container');

  container.querySelectorAll('[data-scene-item]').forEach(el => {
    el.classList.remove('is-selected');
  });

  const activeEl = container.querySelector(`[data-scene-item="${gameDataStore.selectedSceneId}"]`);
  if (activeEl) {
    activeEl.classList.add('is-selected');
  }

  const rightPanel = container.querySelector('[data-scene-right]');
  const scene = state.scenes[gameDataStore.selectedSceneId];
  if (rightPanel && scene) {
    rightPanel.innerHTML = buildSceneRightHtml(scene);
    setTimeout(() => {
      try {
        const gopCanvas = loadGop(scene.mapId, 0);
        if (gopCanvas) {
          drawPixelated(gopCanvas, 'canvas-scene-gop');
        }
      } catch (error) {
        console.error('绘制场景专属 GOP 失败:', error);
      }
    }, 30);
  }
}

function buildSceneRightHtml(scene) {
  const sceneNpcs = [];
  for (let i = scene.startEventId + 1; i <= scene.endEventId; i++) {
    const npcObj = state.eventObjects[i];
    if (npcObj && npcObj.type === 'npc') {
      sceneNpcs.push(npcObj);
    }
  }

  return `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.15); padding-bottom: 8px; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <h2 style="margin: 0; font-size: 12px; color: var(--glow-yellow); font-weight: bold;">🗺️ Scene #${scene.sceneId} (Map #${scene.mapId}) 的多维场景档案</h2>
      </div>
    </div>
    <div style="flex: 1; display: flex; gap: 15px; overflow: hidden;">
      <div style="width: 180px; display: flex; flex-direction: column; gap: 10px; align-items: center; background: rgba(0,0,0,0.4); padding: 12px; border: 1px solid rgba(255,255,255,0.02); border-radius: 3px;">
        <span style="font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold;">🗺️ 场景专属 GOP 图元解码</span>
        <canvas id="canvas-scene-gop" width="120" height="120" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px;"></canvas>
        <div style="font-size: 7.5px; color: rgba(255,255,255,0.25); text-align: center; line-height: 1.3; margin-top: 4px;">大地图包 ID: gop.mkf #${scene.mapId}<br>场景图元: GOP #0<br>自动平铺防滑绘制</div>
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding-right: 4px;">
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 场景事件与地图底牌</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">对应大地图 ID (mapId)</span><span style="font-size: 9px; color: var(--glow-green); font-weight: bold;">0x${scene.mapId.toString(16).toUpperCase()} (${scene.mapId})</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">场景物体区间</span><span style="font-size: 9px; color: #fff; font-weight: bold;">${scene.startEventId} ➔ ${scene.endEventId}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">进入场景触发脚本</span><span style="font-size: 8.5px; font-weight: bold;">${scene.enterScriptId > 0 ? `<span onclick="jumpToGameDataScript(${scene.enterScriptId})" style="color:var(--glow-yellow); text-decoration:underline; cursor:pointer;">Script #${scene.enterScriptId}</span>` : '<span style="color:rgba(255,255,255,0.25);">无</span>'}</span></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 5px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.3);">离开场景触发脚本</span><span style="font-size: 8.5px; font-weight: bold;">${scene.exitScriptId > 0 ? `<span onclick="jumpToGameDataScript(${scene.exitScriptId})" style="color:var(--glow-yellow); text-decoration:underline; cursor:pointer;">Script #${scene.exitScriptId}</span>` : '<span style="color:rgba(255,255,255,0.25);">无</span>'}</span></div>
          </div>
        </div>
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 当前场景内放置的 NPC 物体列表 (${sceneNpcs.length} 个)</div>
          <div style="border: 1px solid rgba(255,255,255,0.03); background: rgba(0,0,0,0.2); border-radius: 3px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 8px; text-align: left;">
              <thead>
                <tr style="background: rgba(255,215,0,0.04); border-bottom: 1px solid rgba(255,255,255,0.04); color: rgba(255,255,255,0.35);">
                  <th style="padding: 4px 8px;">NPC ID</th>
                  <th style="padding: 4px 8px;">人物名称</th>
                  <th style="padding: 4px 8px;">坐标位置</th>
                  <th style="padding: 4px 8px;">自动脚本</th>
                  <th style="padding: 4px 8px;">触发脚本</th>
                  <th style="padding: 4px 8px;">交互跳转</th>
                </tr>
              </thead>
              <tbody>
                ${sceneNpcs.map(npc => {
                  const roleName = getRoleName(npc.mgoId);
                  let npcImgHtml = '';

                  if (roleName) {
                    try {
                      const npcCanvas = loadMgo(npc.mgoId, npc.frame || 0);
                      if (npcCanvas) {
                        npcImgHtml = `<img src="${npcCanvas.toDataURL()}" style="height: 18px; image-rendering: pixelated; vertical-align: middle; margin-right: 4px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 2px; padding: 1px;" />`;
                      }
                    } catch (error) {
                      // 容错防止加载失败
                    }
                  }

                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.015); transition: background 0.1s;" onmouseenter="this.style.background='rgba(255,255,255,0.02)'" onmouseleave="this.style.background='transparent'">
                      <td style="padding: 4px 8px; color:var(--glow-yellow); font-weight:bold;">#${npc.id}</td>
                      <td style="padding: 4px 8px; color:#fff; display: flex; align-items: center;">${npcImgHtml}<span>${roleName}</span></td>
                      <td style="padding: 4px 8px; color:rgba(255,255,255,0.5);">(${npc.x}, ${npc.y})</td>
                      <td style="padding: 4px 8px;">${npc.autoScr > 0 ? `<span onclick="jumpToGameDataScript(${npc.autoScr})" style="color:var(--glow-yellow); text-decoration:underline; cursor:pointer; font-weight:bold;">#${npc.autoScr}</span>` : '<span style="color:rgba(255,255,255,0.25);">无</span>'}</td>
                      <td style="padding: 4px 8px;">${npc.trigScr > 0 ? `<span onclick="jumpToGameDataScript(${npc.trigScr})" style="color:var(--glow-yellow); text-decoration:underline; cursor:pointer; font-weight:bold;">#${npc.trigScr}</span>` : '<span style="color:rgba(255,255,255,0.25);">无</span>'}</td>
                      <td style="padding: 4px 8px;"><button onclick="jumpToGameDataNpc(${npc.id})" class="btn-dbg" style="color:var(--glow-yellow); border-color:rgba(255,215,0,0.15); padding: 1px 4px; font-size: 7px; cursor:pointer;">定位 NPC</button></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;
}
