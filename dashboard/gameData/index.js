import { ReactDOM, html } from './ui-helper.js';
import { GameDataApp } from './components.js';

let reactRoot = null;

// 开启游戏数据监视弹窗，惰性初始化 React 组件树
export function openGameDataModal() {
  const container = document.getElementById('game-data-modal-root');
  if (container && !reactRoot) {
    // 步骤 1：首次打开，创建挂载 React Root 并进行组件挂载
    reactRoot = ReactDOM.createRoot(container);
    reactRoot.render(html`<${GameDataApp} />`);

    // 步骤 2：延迟执行打开，保证组件首次渲染与全局劫持方法成功注册完毕
    setTimeout(() => {
      if (window.openGameDataModal && window.openGameDataModal !== openGameDataModal) {
        window.openGameDataModal();
      }
    }, 50);
  } else if (window.openGameDataModal && window.openGameDataModal !== openGameDataModal) {
    // 步骤 3：若已实例化挂载，直接驱动 React 触发状态展示
    window.openGameDataModal();
  }
}

export function closeGameDataModal() {
  if (window.closeGameDataModal && window.closeGameDataModal !== closeGameDataModal) {
    window.closeGameDataModal();
  }
}

export function switchGameDataTab(tabName) {
  if (window.switchGameDataTab && window.switchGameDataTab !== switchGameDataTab) {
    window.switchGameDataTab(tabName);
  }
}

export function jumpToGameDataNpc(npcId) {
  if (window.jumpToGameDataNpc && window.jumpToGameDataNpc !== jumpToGameDataNpc) {
    window.jumpToGameDataNpc(npcId);
  }
}

export function jumpToGameDataScript(scriptId) {
  if (window.jumpToGameDataScript && window.jumpToGameDataScript !== jumpToGameDataScript) {
    window.jumpToGameDataScript(scriptId);
  }
}

export function onGameDataItemSelect(itemId) {
  if (window.onGameDataItemSelect) {
    window.onGameDataItemSelect(itemId);
  }
}

export function onGameDataNpcSelect(npcId) {
  if (window.onGameDataNpcSelect) {
    window.onGameDataNpcSelect(npcId);
  }
}

export function onGameDataRoleSelect(roleId) {
  if (window.onGameDataRoleSelect) {
    window.onGameDataRoleSelect(roleId);
  }
}

export function onGameDataSceneSelect(sceneId) {
  if (window.onGameDataSceneSelect) {
    window.onGameDataSceneSelect(sceneId);
  }
}

export function searchGameDataNpc(val) {
  if (window.searchGameDataNpc) {
    window.searchGameDataNpc(val);
  }
}

export function searchGameDataScript() {
  if (window.searchGameDataScript) {
    window.searchGameDataScript();
  }
}

export function toggleHeroAnim() {
  // 兼容接口：在组件化模式下改由各子组件独立托管
}
