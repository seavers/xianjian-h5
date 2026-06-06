import { gameDataStore } from './store.js';
import { renderRoleTab, stopHeroAnimClock, toggleHeroAnim, onGameDataRoleSelect } from './tabs/roleTab.js';
import { renderNpcTab, onGameDataNpcSelect, searchGameDataNpc, jumpToGameDataNpc } from './tabs/npcTab.js';
import { renderScriptTab, jumpToGameDataScript, searchGameDataScript } from './tabs/scriptTab.js';
import { renderSceneTab, onGameDataSceneSelect } from './tabs/sceneTab.js';
import { renderItemTab, onGameDataItemSelect } from './tabs/itemTab.js';

const tabRenderers = {
  role: renderRoleTab,
  npc: renderNpcTab,
  item: renderItemTab,
  script: renderScriptTab,
  scene: renderSceneTab
};

export function openGameDataModal() {
  document.getElementById('game-data-modal').style.display = 'flex';
  switchGameDataTab(gameDataStore.activeTab);
}

export function closeGameDataModal() {
  document.getElementById('game-data-modal').style.display = 'none';
  stopHeroAnimClock();
}

export function switchGameDataTab(tabName) {
  gameDataStore.activeTab = tabName;
  stopHeroAnimClock();

  document.querySelectorAll('.gamedata-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.style.color = 'rgba(255,255,255,0.6)';
    btn.style.borderColor = 'rgba(255,255,255,0.06)';
  });

  const activeTabBtn = document.getElementById(`gamedata-tab-${tabName}`);
  if (activeTabBtn) {
    activeTabBtn.classList.add('active');
    activeTabBtn.style.color = 'var(--glow-yellow)';
    activeTabBtn.style.borderColor = 'var(--glow-yellow)';
  }

  const mainContainer = document.getElementById('gamedata-main-container');
  const renderTab = tabRenderers[tabName];
  if (mainContainer && renderTab) {
    renderTab(mainContainer);
  }
}

export {
  jumpToGameDataNpc,
  jumpToGameDataScript,
  onGameDataItemSelect,
  onGameDataNpcSelect,
  onGameDataRoleSelect,
  onGameDataSceneSelect,
  searchGameDataNpc,
  searchGameDataScript,
  toggleHeroAnim
};
