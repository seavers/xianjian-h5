import { loadBall } from '../../../resources/pal.js';
import { state } from '../../../engine/state.js';
import { getDetailedItemInfo } from '../../../data/gameData/items.js';
import { drawPixelated, getItemNameHtml } from '../helpers.js';
import { gameDataStore } from '../store.js';

export function renderItemTab(container) {
  const items = state.items;

  let leftHtml = `
    <div style="width: 260px; border-right: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden;">
      <div style="padding: 10px; background: rgba(0,0,0,0.5); border-bottom: 1px solid var(--border-glass); font-size: 9.5px; font-weight: bold; color: var(--glow-yellow);">🎒 游戏物品列表 (共 ${items.length} 个)</div>
      <div style="flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px;">
  `;

  items.forEach(item => {
    const isSelected = gameDataStore.selectedItemId === item.id;
    leftHtml += `
      <div data-item-item="${item.id}" onclick="onGameDataItemSelect(${item.id})" style="padding: 8px 12px; background: ${isSelected ? 'rgba(255, 215, 0, 0.08)' : 'rgba(255,255,255,0.015)'}; border: 1px solid ${isSelected ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.03)'}; border-radius: 2px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.15s;">
        <span style="font-size: 9px; font-weight: bold; color: ${isSelected ? 'var(--glow-yellow)' : '#fff'}; display: flex; align-items: center; gap: 4px;">${getItemNameHtml(item.id)}</span>
        <span style="font-size: 8px; color: rgba(255,255,255,0.3);">ID #${item.id}</span>
      </div>
    `;
  });

  leftHtml += `
      </div>
    </div>
  `;

  const item = items[gameDataStore.selectedItemId] || items[99];
  const rightHtml = `
    <div data-item-right style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 15px;">
      ${buildItemRightHtml(item)}
    </div>
  `;

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
    el.style.background = 'rgba(255,255,255,0.015)';
    el.style.borderColor = 'rgba(255,255,255,0.03)';
    const span = el.querySelector('span');
    if (span) {
      span.style.color = '#fff';
    }
  });

  const activeEl = container.querySelector(`[data-item-item="${gameDataStore.selectedItemId}"]`);
  if (activeEl) {
    activeEl.style.background = 'rgba(255, 215, 0, 0.08)';
    activeEl.style.borderColor = 'var(--glow-yellow)';
    const span = activeEl.querySelector('span');
    if (span) {
      span.style.color = 'var(--glow-yellow)';
    }
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

  return `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.15); padding-bottom: 8px; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <h2 style="margin: 0; font-size: 12px; color: var(--glow-yellow); font-weight: bold; display: flex; align-items: center; gap: 6px;">${nameHtml}</h2>
        <span style="font-size: 8px; background: rgba(0, 255, 157, 0.1); border: 1px solid rgba(0,255,157,0.3); color: var(--glow-green); padding: 1px 4px; border-radius: 1px; font-weight: bold;">底层解构档案</span>
      </div>
      <div style="font-size: 9px; color: rgba(255,255,255,0.4); font-weight: bold;">物品 ID: <span style="color: var(--glow-yellow);">${item.id}</span></div>
    </div>
    <div style="flex: 1; display: flex; gap: 15px; overflow: hidden;">
      <div style="width: 180px; display: flex; flex-direction: column; gap: 10px; align-items: center; background: rgba(0,0,0,0.4); padding: 12px; border: 1px solid rgba(255,255,255,0.02); border-radius: 3px;">
        <span style="font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold;">🎒 物品小图标 (Ball)</span>
        <canvas id="canvas-item-detail-ball" width="40" height="40" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px;"></canvas>
        <span style="font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold; margin-top: 5px;">底牌元数据参数</span>
        <div style="font-size: 7.5px; color: rgba(255,255,255,0.35); text-align: left; line-height: 1.4; width: 100%;">数据偏移: ${info.offset}<br>物品 Flags: ${info.flags}<br>是否消耗: ${info.consumable}<br>是否丢弃: ${info.throwable || '是'}<br>是否可售: ${info.sellable || '是'}</div>
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding-right: 4px;">
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 物品基础属性</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">买价价值</div><div style="font-size: 10px; color: var(--glow-yellow); font-weight: bold;">${info.buy}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">卖价价值</div><div style="font-size: 10px; color: #ff5777; font-weight: bold;">${info.sell}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">物品类型</div><div style="font-size: 10px; color: #4db3ff; font-weight: bold;">${info.type}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">适用角色</div><div style="font-size: 9.5px; color: #00ffaa; font-weight: bold;">${info.role}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">装备槽位</div><div style="font-size: 9.5px; color: #b366ff; font-weight: bold;">${info.slot}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">五灵抗性</div><div style="font-size: 9.5px; color: #00e5ff; font-weight: bold;">${info.res || '无'}</div></div>
          </div>
        </div>
        ${info.slot !== '无' ? `
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 装备增益参数</div>
          <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 5px; border-radius: 2px; text-align: center;"><div style="font-size: 7px; color:rgba(255,255,255,0.25);">⚔ 武术 ATK</div><div style="font-size: 8.5px; color:#fff; font-weight:bold; margin-top:2px;">${info.atk}</div></div>
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 5px; border-radius: 2px; text-align: center;"><div style="font-size: 7px; color:rgba(255,255,255,0.25);">🛡 防御 DEF</div><div style="font-size: 8.5px; color:#fff; font-weight:bold; margin-top:2px;">${info.def}</div></div>
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 5px; border-radius: 2px; text-align: center;"><div style="font-size: 7px; color:rgba(255,255,255,0.25);">🏃 身法 SPD</div><div style="font-size: 8.5px; color:#fff; font-weight:bold; margin-top:2px;">${info.spd}</div></div>
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 5px; border-radius: 2px; text-align: center;"><div style="font-size: 7px; color:rgba(255,255,255,0.25);">🔮 灵力 MAG</div><div style="font-size: 8.5px; color:#fff; font-weight:bold; margin-top:2px;">${info.mag}</div></div>
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 5px; border-radius: 2px; text-align: center;"><div style="font-size: 7px; color:rgba(255,255,255,0.25);">🪙 吉运 LCK</div><div style="font-size: 8.5px; color:#fff; font-weight:bold; margin-top:2px;">${info.lck}</div></div>
          </div>
        </div>
        ` : ''}
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 绑定脚本事件指针 (点击立即穿梭反解)</div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,215,0,0.08); padding: 6px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.35);">🔮 使用触发脚本 (useScr)</span><span style="font-size: 8.5px;">${usescrHtml}</span></div>
            <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,215,0,0.08); padding: 6px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.35);">🛡 装备触发脚本 (equScr)</span><span style="font-size: 8.5px;">${equscrHtml}</span></div>
            <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,215,0,0.08); padding: 6px 10px; border-radius: 2px; display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 8px; color: rgba(255,255,255,0.35);">🗑️ 丢弃触发脚本 (dropScr)</span><span style="font-size: 8.5px;">${dropscrHtml}</span></div>
          </div>
        </div>
      </div>
    </div>
  `;
}
