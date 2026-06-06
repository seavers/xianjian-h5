import { state } from '../../../engine/state.js';
import { scriptCodes } from '../../../engine/command.js';
import { getCommandName, getInstructionChineseDetail } from '../../../data/gameData/scripts.js';
import { makeScriptHyperlinks } from '../helpers.js';
import { renderDetailPanel, renderListItem, renderSidebar } from '../renderers.js';
import { gameDataStore } from '../store.js';

export function renderScriptTab(container) {
  const totalScripts = state.scripts.length;
  const listItems = buildScriptListItems();

  const rangeItems = [];

  for (let i = 0; i < totalScripts; i += 20) {
    rangeItems.push(renderListItem({
      dataAttr: 'data-script-item',
      dataValue: i,
      onclick: `jumpToGameDataScript(${i})`,
      selected: gameDataStore.selectedScriptId >= i && gameDataStore.selectedScriptId < i + 20,
      title: `段落 #${i} ➔ #${Math.min(totalScripts - 1, i + 19)}`,
      meta: gameDataStore.selectedScriptId >= i && gameDataStore.selectedScriptId < i + 20 ? '●' : ''
    }));
  }

  const leftHtml = renderSidebar({
    width: 250,
    title: `📜 脚本指令检索 (共 ${totalScripts} 条)`,
    toolbarHtml: `
      <div style="display:flex; gap:4px;">
        <input type="number" id="input-gamedata-script-id" value="${gameDataStore.selectedScriptId}" min="0" max="${totalScripts - 1}" style="background: #0c0a08; border: 1px solid rgba(255,215,0,0.2); color: #fff; font-size: 8.5px; padding: 2px 4px; outline: none; border-radius: 2px; flex: 1; text-align: center;">
        <button onclick="searchGameDataScript()" class="btn-dbg" style="color: var(--glow-yellow); border-color: rgba(255,215,0,0.2); padding: 2px 6px; font-size: 8.5px; cursor: pointer; font-weight: bold;">一键反解</button>
      </div>
    `,
    bodyHtml: rangeItems.join('')
  });

  let rightHtml = `
    ${renderDetailPanel('data-script-right', `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.15); padding-bottom: 8px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <h2 style="margin: 0; font-size: 12px; color: var(--glow-yellow); font-weight: bold;">📜 连续指令解析流 (从 ID #${gameDataStore.selectedScriptId} 顺序向下解码)</h2>
        </div>
      </div>
      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
  `;

  listItems.forEach(item => {
    const isHighlight = item.id === gameDataStore.selectedScriptId;
    rightHtml += `
      <div style="background: ${isHighlight ? 'rgba(255,215,0,0.05)' : 'rgba(255,255,255,0.01)'}; border: 1px solid ${isHighlight ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.02)'}; padding: 6px 12px; border-radius: 3px; display: flex; align-items: center; justify-content: space-between; font-family:'JetBrains Mono', monospace; font-size: 8px; transition: all 0.15s; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
          <span style="font-weight: bold; color: ${isHighlight ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.35)'};">SCRIPT ID: #${item.id}</span>
          <span style="color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.03); padding: 1px 4px; border-radius: 2px;">${item.codeHex} (${item.cmdName})</span>
          <span style="color: var(--glow-green); font-weight: bold; text-transform: uppercase; background: rgba(0,255,157,0.06); border: 1px solid rgba(0,255,157,0.2); padding: 1px 4px; border-radius: 2px;">${item.officialDesc}</span>
          <span style="color: rgba(255,255,255,0.25);">Params: (${item.params})</span>
        </div>
        <div style="font-size: 9.5px; color: #fff; font-weight: 500; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${item.desc || ''}
        </div>
      </div>
    `;
  });

  rightHtml += `
      </div>
    `)}
  `;

  container.innerHTML = leftHtml + rightHtml;
}

export function jumpToGameDataScript(scriptId) {
  gameDataStore.selectedScriptId = Math.max(0, Math.min(state.scripts.length - 1, parseInt(scriptId)));

  if (gameDataStore.activeTab === 'script') {
    updateScriptSelection();
    return;
  }

  window.switchGameDataTab?.('script');
}

export function searchGameDataScript() {
  const input = document.getElementById('input-gamedata-script-id');
  if (!input) {
    return;
  }

  const val = parseInt(input.value);
  if (!isNaN(val)) {
    gameDataStore.selectedScriptId = Math.max(0, Math.min(state.scripts.length - 1, val));
    updateScriptSelection();
  }
}

function updateScriptSelection() {
  const container = document.getElementById('gamedata-main-container');

  container.querySelectorAll('[data-script-item]').forEach(el => {
    el.classList.remove('is-selected');
    const dot = el.querySelectorAll('span')[1];
    if (dot) {
      dot.innerText = '';
    }
  });

  const activeEl = container.querySelector(`[data-script-item="${Math.floor(gameDataStore.selectedScriptId / 20) * 20}"]`);
  if (activeEl) {
    activeEl.classList.add('is-selected');
    const dot = activeEl.querySelectorAll('span')[1];
    if (dot) {
      dot.innerText = '●';
    }
  }

  const input = document.getElementById('input-gamedata-script-id');
  if (input) {
    input.value = gameDataStore.selectedScriptId;
  }

  const rightPanel = container.querySelector('[data-script-right]');
  if (rightPanel) {
    rightPanel.innerHTML = buildScriptRightHtml();
  }
}

function buildScriptListItems() {
  const totalScripts = state.scripts.length;
  const listItems = [];
  const startId = gameDataStore.selectedScriptId;
  const endId = Math.min(totalScripts, startId + 20);

  for (let i = startId; i < endId; i++) {
    const script = state.scripts[i];
    if (!script) {
      continue;
    }

    const codeObj = scriptCodes[script.code];
    listItems.push({
      id: script.id,
      codeHex: `0x${script.code.toString(16).toUpperCase()}`,
      cmdName: getCommandName(script.code),
      officialDesc: codeObj ? codeObj.desc : '未知系统底层指令',
      params: `${script.param1}, ${script.param2}, ${script.param3}`,
      desc: makeScriptHyperlinks(getInstructionChineseDetail(script.code, script.param1, script.param2, script.param3))
    });
  }

  return listItems;
}

function buildScriptRightHtml() {
  const listItems = buildScriptListItems();
  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.15); padding-bottom: 8px; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <h2 style="margin: 0; font-size: 12px; color: var(--glow-yellow); font-weight: bold;">📜 连续指令解析流 (从 ID #${gameDataStore.selectedScriptId} 顺序向下解码)</h2>
      </div>
    </div>
    <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
  `;

  listItems.forEach(item => {
    const isHighlight = item.id === gameDataStore.selectedScriptId;
    html += `
      <div style="background: ${isHighlight ? 'rgba(255,215,0,0.05)' : 'rgba(255,255,255,0.01)'}; border: 1px solid ${isHighlight ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.02)'}; padding: 6px 12px; border-radius: 3px; display: flex; align-items: center; justify-content: space-between; font-family:'JetBrains Mono', monospace; font-size: 8px; transition: all 0.15s; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
          <span style="font-weight: bold; color: ${isHighlight ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.35)'};">SCRIPT ID: #${item.id}</span>
          <span style="color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.03); padding: 1px 4px; border-radius: 2px;">${item.codeHex} (${item.cmdName})</span>
          <span style="color: var(--glow-green); font-weight: bold; text-transform: uppercase; background: rgba(0,255,157,0.06); border: 1px solid rgba(0,255,157,0.2); padding: 1px 4px; border-radius: 2px;">${item.officialDesc}</span>
          <span style="color: rgba(255,255,255,0.25);">Params: (${item.params})</span>
        </div>
        <div style="font-size: 9.5px; color: #fff; font-weight: 500; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${item.desc || ''}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}
