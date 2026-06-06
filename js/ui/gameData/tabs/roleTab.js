import { loadMgo, loadMgoCount, loadRgm } from '../../../resources/pal.js';
import { state } from '../../../engine/state.js';
import { ROLES_DB } from '../catalog.js';
import { drawPixelated } from '../helpers.js';
import { gameDataStore } from '../store.js';

export function renderRoleTab(container) {
  let leftHtml = `
    <div style="width: 260px; border-right: 1px solid var(--border-glass); background: rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden;">
      <div style="padding: 10px; background: rgba(0,0,0,0.5); border-bottom: 1px solid var(--border-glass); font-size: 9.5px; font-weight: bold; color: var(--glow-yellow);">👤 剧中角色列表</div>
      <div style="flex: 1; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px;">
  `;

  Object.keys(ROLES_DB).forEach(id => {
    const roleId = parseInt(id);
    const role = ROLES_DB[roleId];
    const isSelected = gameDataStore.selectedRoleId === roleId;
    leftHtml += `
      <div data-role-item="${roleId}" onclick="onGameDataRoleSelect(${roleId})" style="padding: 8px 12px; background: ${isSelected ? 'rgba(255, 215, 0, 0.08)' : 'rgba(255,255,255,0.015)'}; border: 1px solid ${isSelected ? 'var(--glow-yellow)' : 'rgba(255,255,255,0.03)'}; border-radius: 2px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: all 0.15s;">
        <span style="font-size: 9px; font-weight: bold; color: ${isSelected ? 'var(--glow-yellow)' : '#fff'};">${role.name}</span>
        <span style="font-size: 8px; color: rgba(255,255,255,0.3);">LV ${role.level}</span>
      </div>
    `;
  });

  leftHtml += `
      </div>
    </div>
  `;

  const role = ROLES_DB[gameDataStore.selectedRoleId];
  const rightHtml = `
    <div data-role-right style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 15px;">
      ${buildRoleRightHtml(role)}
    </div>
  `;

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
    el.style.background = 'rgba(255,255,255,0.015)';
    el.style.borderColor = 'rgba(255,255,255,0.03)';
    const span = el.querySelector('span');
    if (span) span.style.color = '#fff';
  });

  const activeEl = container.querySelector(`[data-role-item="${gameDataStore.selectedRoleId}"]`);
  if (activeEl) {
    activeEl.style.background = 'rgba(255, 215, 0, 0.08)';
    activeEl.style.borderColor = 'var(--glow-yellow)';
    const span = activeEl.querySelector('span');
    if (span) span.style.color = 'var(--glow-yellow)';
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
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,215,0,0.15); padding-bottom: 8px; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <h2 style="margin: 0; font-size: 14px; color: var(--glow-yellow); font-weight: bold; text-shadow: 0 0 10px rgba(255,215,0,0.2);">${role.name}</h2>
        <span style="font-size: 8px; background: rgba(0, 255, 157, 0.1); border: 1px solid rgba(0,255,157,0.3); color: var(--glow-green); padding: 1px 4px; border-radius: 1px; font-weight: bold;">主力队员</span>
      </div>
      <div style="font-size: 9px; color: rgba(255,255,255,0.4); font-weight: bold;">当前携带资金: <span style="color: var(--glow-yellow);">${state.money || 0} 文</span></div>
    </div>
    <div style="flex: 1; display: flex; gap: 15px; overflow: hidden;">
      <div style="width: 180px; display: flex; flex-direction: column; gap: 10px; align-items: center; background: rgba(0,0,0,0.4); padding: 12px; border: 1px solid rgba(255,255,255,0.02); border-radius: 3px;">
        <span style="font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold;">🖼️ 经典角色头像 (RGM)</span>
        <canvas id="canvas-role-rgm" width="80" height="80" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px;"></canvas>
        <span style="font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold; margin-top: 5px;">🏃 2D 走动像素立绘 (MGO)</span>
        <canvas id="canvas-role-mgo" width="60" height="138" style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 2px;"></canvas>
        <button id="btn-hero-anim-play" onclick="toggleHeroAnim()" class="btn-dbg" style="color: var(--glow-green); border-color: rgba(0,255,157,0.2); padding: 2px 8px; font-size: 8px; cursor: pointer; font-weight: bold;">⏸ 暂停走动</button>
      </div>
      <div style="flex: 1; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; padding-right: 4px;">
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 角色基础属性</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">等级 (LV)</div><div style="font-size: 10px; color: var(--glow-yellow); font-weight: bold;">LV ${role.level}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">体力 (HP)</div><div style="font-size: 10px; color: #ff5777; font-weight: bold;">${role.hp}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">真气 (MP)</div><div style="font-size: 10px; color: #4db3ff; font-weight: bold;">${role.mp}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">武术 (ATK)</div><div style="font-size: 10px; color: #ffa64d; font-weight: bold;">${role.atk}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">灵力 (MAG)</div><div style="font-size: 10px; color: #b366ff; font-weight: bold;">${role.mag}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">防御 (DEF)</div><div style="font-size: 10px; color: #00ffaa; font-weight: bold;">${role.def}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">身法 (SPD)</div><div style="font-size: 10px; color: #00e5ff; font-weight: bold;">${role.spd}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">吉运 (LCK)</div><div style="font-size: 10px; color: #ffff00; font-weight: bold;">${role.lck}</div></div>
            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 2px;"><div style="font-size: 7.5px; color: rgba(255,255,255,0.3);">状态 (STATUS)</div><div style="font-size: 10px; color: var(--glow-green); font-weight: bold;">${role.status}</div></div>
          </div>
        </div>
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 配备神兵防具</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 5px 8px; border-radius: 2px; display:flex; flex-direction:column;"><span style="font-size: 7px; color:rgba(255,255,255,0.25);">⚔ 武器</span><span style="font-size: 8px; color:#fff; font-weight:bold; margin-top:2px;">${role.equip.weapon}</span></div>
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 5px 8px; border-radius: 2px; display:flex; flex-direction:column;"><span style="font-size: 7px; color:rgba(255,255,255,0.25);">🛡 身体防具</span><span style="font-size: 8px; color:#fff; font-weight:bold; margin-top:2px;">${role.equip.armor}</span></div>
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 5px 8px; border-radius: 2px; display:flex; flex-direction:column;"><span style="font-size: 7px; color:rgba(255,255,255,0.25);">👒 头部防护</span><span style="font-size: 8px; color:#fff; font-weight:bold; margin-top:2px;">${role.equip.helmet}</span></div>
            <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); padding: 5px 8px; border-radius: 2px; display:flex; flex-direction:column;"><span style="font-size: 7px; color:rgba(255,255,255,0.25);">🥾 足踏奇鞋</span><span style="font-size: 8px; color:#fff; font-weight:bold; margin-top:2px;">${role.equip.shoes}</span></div>
          </div>
        </div>
        <div>
          <div style="font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;"><span style="width: 3px; height: 3px; background: var(--glow-yellow); border-radius: 50%;"></span> 精通绝学仙术</div>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">${role.spells.map(spell => `<span style="font-size: 8px; color: #dfb3ff; background: rgba(179,102,255,0.1); border: 1px solid rgba(179,102,255,0.3); padding: 2px 6px; border-radius: 2px; font-weight:bold;">✨ ${spell}</span>`).join('')}</div>
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
