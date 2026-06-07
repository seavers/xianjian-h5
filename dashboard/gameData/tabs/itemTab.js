import { loadBall } from '../../../js/resources/pal.js';
import { state } from '../../../js/engine/state.js';
import { getDetailedItemInfo } from '../../../js/data/gameData/items.js';
import { drawPixelated, getItemNameHtml } from '../helpers.js';
import { renderBindingItem, renderBlockCard, renderBlockGrid, renderDetailHeader, renderDetailPanel, renderListItem, renderSectionTitle, renderSidebar, renderStatCard, renderStatGrid } from '../renderers.js';
import { gameDataStore } from '../store.js';

export function renderItemTab(container) {
  const items = state.items;
  const listItems = [];

  items.forEach(item => {
    listItems.push(renderListItem({
      dataAttr: 'data-item-item',
      dataValue: item.id,
      onclick: `onGameDataItemSelect(${item.id})`,
      selected: gameDataStore.selectedItemId === item.id,
      title: getItemNameHtml(item.id),
      meta: `ID #${item.id}`
    }));
  });

  const item = items[gameDataStore.selectedItemId] || items[99];
  const leftHtml = renderSidebar({ width: 260, title: `🎒 游戏物品列表 (共 ${items.length} 个)`, bodyHtml: listItems.join('') });
  const rightHtml = renderDetailPanel('data-item-right', buildItemRightHtml(item));

  container.innerHTML = leftHtml + rightHtml;

  setTimeout(() => {
    drawItemBall(gameDataStore.selectedItemId);
  }, 30);
}

export function onGameDataItemSelect(itemId) {
  gameDataStore.selectedItemId = itemId;
  updateItemSelection();
}

function updateItemSelection() {
  const container = document.getElementById('gamedata-main-container');

  container.querySelectorAll('[data-item-item]').forEach(el => {
    el.classList.remove('is-selected');
  });

  const activeEl = container.querySelector(`[data-item-item="${gameDataStore.selectedItemId}"]`);
  if (activeEl) {
    activeEl.classList.add('is-selected');
  }

  const rightPanel = container.querySelector('[data-item-right]');
  if (rightPanel) {
    const item = state.items[gameDataStore.selectedItemId];
    rightPanel.innerHTML = buildItemRightHtml(item);
    setTimeout(() => {
      drawItemBall(gameDataStore.selectedItemId);
    }, 30);
  }
}

function drawItemBall(itemId) {
  try {
    const ballCanvas = loadBall(itemId);
    if (ballCanvas) {
      drawPixelated(ballCanvas, 'canvas-item-detail-ball');
    }
  } catch (error) {
    console.error('绘制物品小图标 Ball 失败:', error);
  }
}

function buildItemRightHtml(item) {
  const info = getDetailedItemInfo(item.id);
  const usescrHtml = item.useScr > 0 ? `<span onclick="jumpToGameDataScript(${item.useScr})" style="color: var(--glow-yellow); text-decoration: underline; cursor: pointer; font-weight: bold;">Script #${item.useScr} ➔ 穿梭反解</span>` : '<span style="color: rgba(255,255,255,0.25);">无 (0)</span>';
  const equscrHtml = item.equScr > 0 ? `<span onclick="jumpToGameDataScript(${item.equScr})" style="color: var(--glow-yellow); text-decoration: underline; cursor: pointer; font-weight: bold;">Script #${item.equScr} ➔ 穿梭反解</span>` : '<span style="color: rgba(255,255,255,0.25);">无 (0)</span>';
  const dropscrHtml = item.dropScr > 0 ? `<span onclick="jumpToGameDataScript(${item.dropScr})" style="color: var(--glow-yellow); text-decoration: underline; cursor: pointer; font-weight: bold;">Script #${item.dropScr} ➔ 穿梭反解</span>` : '<span style="color: rgba(255,255,255,0.25);">无 (0)</span>';
  const nameHtml = getItemNameHtml(item.id);
  const baseStats = renderStatGrid([
    renderStatCard({ label: '买价价值', value: info.buy, valueColor: 'var(--glow-yellow)' }),
    renderStatCard({ label: '卖价价值', value: info.sell, valueColor: '#ff5777' }),
    renderStatCard({ label: '物品类型', value: info.type, valueColor: '#4db3ff' }),
    renderStatCard({ label: '适用角色', value: info.role, valueColor: '#00ffaa', valueFontSize: '9.5px' }),
    renderStatCard({ label: '装备槽位', value: info.slot, valueColor: '#b366ff', valueFontSize: '9.5px' }),
    renderStatCard({ label: '五灵抗性', value: info.res || '无', valueColor: '#00e5ff', valueFontSize: '9.5px' })
  ], 'repeat(3, 1fr)');

  const equipStats = renderBlockGrid([
    renderBlockCard({ label: '⚔ 武术 ATK', value: info.atk }),
    renderBlockCard({ label: '🛡 防御 DEF', value: info.def }),
    renderBlockCard({ label: '🏃 身法 SPD', value: info.spd }),
    renderBlockCard({ label: '🔮 灵力 MAG', value: info.mag }),
    renderBlockCard({ label: '🪙 吉运 LCK', value: info.lck })
  ], 'repeat(5, 1fr)');

  return `
    ${renderDetailHeader({
      title: nameHtml,
      titleStyle: 'font-size: 12px; display: flex; align-items: center; gap: 6px;',
      badgeHtml: '<span class="gamedata-detail-badge">底层解构档案</span>',
      metaHtml: `物品 ID: <span style="color: var(--glow-yellow);">${item.id}</span>`
    })}
    <div class="gamedata-content-split">
      <div class="gamedata-preview-card">
        <span class="gamedata-preview-label">🎒 物品小图标 (Ball)</span>
        <canvas id="canvas-item-detail-ball" width="40" height="40" class="gamedata-preview-canvas"></canvas>
        <span class="gamedata-preview-label" style="margin-top: 5px;">底牌元数据参数</span>
        <div style="font-size: 7.5px; color: rgba(255,255,255,0.35); text-align: left; line-height: 1.4; width: 100%;">数据偏移: ${info.offset}<br>物品 Flags: ${info.flags}<br>是否消耗: ${info.consumable}<br>是否丢弃: ${info.throwable || '是'}<br>是否可售: ${info.sellable || '是'}</div>
      </div>
      <div class="gamedata-scroll-panel">
        <div>
          ${renderSectionTitle('物品基础属性')}
          ${baseStats}
        </div>
        ${info.slot !== '无' ? `
        <div>
          ${renderSectionTitle('装备增益参数')}
          ${equipStats}
        </div>
        ` : ''}
        <div>
          ${renderSectionTitle('绑定脚本事件指针 (点击立即穿梭反解)')}
          <div class="gamedata-binding-list">
            ${renderBindingItem({ label: '🔮 使用触发脚本 (useScr)', valueHtml: usescrHtml })}
            ${renderBindingItem({ label: '🛡 装备触发脚本 (equScr)', valueHtml: equscrHtml })}
            ${renderBindingItem({ label: '🗑️ 丢弃触发脚本 (dropScr)', valueHtml: dropscrHtml })}
          </div>
        </div>
      </div>
    </div>
  `;
}
