import { loadMgo, loadMgoCount, loadRgm } from '../../../resources/pal.js';
import { state } from '../../../engine/state.js';
import { ROLES_DB } from '../../../data/gameData/roles.js';
import { drawPixelated } from '../helpers.js';
import { renderBlockCard, renderBlockGrid, renderDetailHeader, renderDetailPanel, renderListItem, renderSectionTitle, renderSidebar, renderStatCard, renderStatGrid } from '../renderers.js';
import { gameDataStore } from '../store.js';

export function renderRoleTab(container) {
  const listItems = [];

  Object.keys(ROLES_DB).forEach(id => {
    const roleId = parseInt(id);
    const role = ROLES_DB[roleId];
    listItems.push(renderListItem({
      dataAttr: 'data-role-item',
      dataValue: roleId,
      onclick: `onGameDataRoleSelect(${roleId})`,
      selected: gameDataStore.selectedRoleId === roleId,
      title: role.name,
      meta: `LV ${role.level}`
    }));
  });

  const role = ROLES_DB[gameDataStore.selectedRoleId];
  const leftHtml = renderSidebar({ width: 260, title: '👤 剧中角色列表', bodyHtml: listItems.join('') });
  const rightHtml = renderDetailPanel('data-role-right', buildRoleRightHtml(role));

  container.innerHTML = leftHtml + rightHtml;

  setTimeout(() => {
    try {
      const rgmImg = loadRgm(role.rgmId);
      if (rgmImg) {
        drawPixelated(rgmImg, 'canvas-role-rgm');
      }
    } catch (error) {
      console.error('加载头像失败:', error);
    }

    startHeroAnimClock(role.mgoRoleId);
  }, 30);
}

export function onGameDataRoleSelect(roleId) {
  gameDataStore.selectedRoleId = roleId;
  updateRoleSelection();
}

export function toggleHeroAnim() {
  gameDataStore.isHeroAnimPlaying = !gameDataStore.isHeroAnimPlaying;

  const btn = document.getElementById('btn-hero-anim-play');
  if (btn) {
    btn.innerText = gameDataStore.isHeroAnimPlaying ? '⏸ 暂停走动' : '▶ 播放走动';
    btn.style.color = gameDataStore.isHeroAnimPlaying ? 'var(--glow-green)' : 'var(--glow-yellow)';
  }
}

export function stopHeroAnimClock() {
  if (gameDataStore.heroAnimInterval) {
    clearInterval(gameDataStore.heroAnimInterval);
    gameDataStore.heroAnimInterval = null;
  }
}

function updateRoleSelection() {
  const container = document.getElementById('gamedata-main-container');

  container.querySelectorAll('[data-role-item]').forEach(el => {
    el.classList.remove('is-selected');
  });

  const activeEl = container.querySelector(`[data-role-item="${gameDataStore.selectedRoleId}"]`);
  if (activeEl) {
    activeEl.classList.add('is-selected');
  }

  const rightPanel = container.querySelector('[data-role-right]');
  if (rightPanel) {
    const role = ROLES_DB[gameDataStore.selectedRoleId];
    rightPanel.innerHTML = buildRoleRightHtml(role);

    setTimeout(() => {
      try {
        const rgmImg = loadRgm(role.rgmId);
        if (rgmImg) {
          drawPixelated(rgmImg, 'canvas-role-rgm');
        }
      } catch (error) {
        console.error('加载头像失败:', error);
      }

      startHeroAnimClock(role.mgoRoleId);
    }, 30);
  }
}

function buildRoleRightHtml(role) {
  const statCards = renderStatGrid([
    renderStatCard({ label: '等级 (LV)', value: `LV ${role.level}`, valueColor: 'var(--glow-yellow)' }),
    renderStatCard({ label: '体力 (HP)', value: role.hp, valueColor: '#ff5777' }),
    renderStatCard({ label: '真气 (MP)', value: role.mp, valueColor: '#4db3ff' }),
    renderStatCard({ label: '武术 (ATK)', value: role.atk, valueColor: '#ffa64d' }),
    renderStatCard({ label: '灵力 (MAG)', value: role.mag, valueColor: '#b366ff' }),
    renderStatCard({ label: '防御 (DEF)', value: role.def, valueColor: '#00ffaa' }),
    renderStatCard({ label: '身法 (SPD)', value: role.spd, valueColor: '#00e5ff' }),
    renderStatCard({ label: '吉运 (LCK)', value: role.lck, valueColor: '#ffff00' }),
    renderStatCard({ label: '状态 (STATUS)', value: role.status, valueColor: 'var(--glow-green)' })
  ], 'repeat(3, 1fr)');

  const equipCards = renderBlockGrid([
    renderBlockCard({ label: '⚔ 武器', value: role.equip.weapon }),
    renderBlockCard({ label: '🛡 身体防具', value: role.equip.armor }),
    renderBlockCard({ label: '👒 头部防护', value: role.equip.helmet }),
    renderBlockCard({ label: '🥾 足踏奇鞋', value: role.equip.shoes })
  ], '1fr 1fr');

  return `
    ${renderDetailHeader({
      title: role.name,
      titleStyle: 'font-size: 14px; text-shadow: 0 0 10px rgba(255,215,0,0.2);',
      badgeHtml: '<span class="gamedata-detail-badge">主力队员</span>',
      metaHtml: `当前携带资金: <span style="color: var(--glow-yellow);">${state.money || 0} 文</span>`
    })}
    <div class="gamedata-content-split">
      <div class="gamedata-preview-card">
        <span class="gamedata-preview-label">🖼️ 经典角色头像 (RGM)</span>
        <canvas id="canvas-role-rgm" width="80" height="80" class="gamedata-preview-canvas"></canvas>
        <span class="gamedata-preview-label" style="margin-top: 5px;">🏃 2D 走动像素立绘 (MGO)</span>
        <canvas id="canvas-role-mgo" width="60" height="138" class="gamedata-preview-canvas"></canvas>
        <button id="btn-hero-anim-play" onclick="toggleHeroAnim()" class="btn-dbg" style="color: var(--glow-green); border-color: rgba(0,255,157,0.2); padding: 2px 8px; font-size: 8px; cursor: pointer; font-weight: bold;">⏸ 暂停走动</button>
      </div>
      <div class="gamedata-scroll-panel">
        <div>
          ${renderSectionTitle('角色基础属性')}
          ${statCards}
        </div>
        <div>
          ${renderSectionTitle('配备神兵防具')}
          ${equipCards}
        </div>
        <div>
          ${renderSectionTitle('精通绝学仙术')}
          <div class="gamedata-tag-list">${role.spells.map(spell => `<span class="gamedata-tag" style="color: #dfb3ff; background: rgba(179,102,255,0.1); border: 1px solid rgba(179,102,255,0.3);">✨ ${spell}</span>`).join('')}</div>
        </div>
      </div>
    </div>`;
}

function startHeroAnimClock(mgoRoleId) {
  stopHeroAnimClock();

  let mgoCount = 4;
  try {
    mgoCount = loadMgoCount(mgoRoleId);
    if (mgoCount <= 0) {
      mgoCount = 4;
    }
  } catch (error) {
    mgoCount = 4;
  }

  const renderFrame = () => {
    try {
      const frameCanvas = loadMgo(mgoRoleId, gameDataStore.currentHeroAnimFrame);
      if (frameCanvas) {
        drawPixelated(frameCanvas, 'canvas-role-mgo');
      }
    } catch (error) {
      // 容错
    }
  };

  renderFrame();

  gameDataStore.heroAnimInterval = setInterval(() => {
    if (!gameDataStore.isHeroAnimPlaying) {
      return;
    }

    gameDataStore.currentHeroAnimFrame = (gameDataStore.currentHeroAnimFrame + 1) % mgoCount;
    renderFrame();
  }, 180);
}
