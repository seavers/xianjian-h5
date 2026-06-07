export function initSceneTools() {
  const DEFAULT_COORDS = [
    { sceneId: 1, x: 49, y: 94, name: '逍遥卧室' },
    { sceneId: 2, x: 26, y: 36, name: '客栈一楼' },
    { sceneId: 3, x: 42, y: 18, name: '大娘病房' },
    { sceneId: 4, x: 54, y: 87, name: '盛渔村集市' },
    { sceneId: 5, x: 30, y: 30, name: '仙灵岛荷花池' },
    { sceneId: 6, x: 20, y: 20, name: '仙灵岛水月宫' }
  ];

  let coords = [];

  function showTips(message) {
    import('./talk.js').then(({ Talk }) => {
      Talk.talkTips(message);
    });
  }

  // 步骤 1：从本地存储恢复快捷场景坐标配置，并在异常时兜底回默认值。
  function loadCoords() {
    try {
      const saved = localStorage.getItem('PAL_COORDS');
      if (saved) {
        coords = JSON.parse(saved);
      } else {
        coords = [...DEFAULT_COORDS];
        localStorage.setItem('PAL_COORDS', JSON.stringify(coords));
      }
    } catch (error) {
      console.error('加载传送坐标配置失败，使用默认值', error);
      coords = [...DEFAULT_COORDS];
    }

    renderQuickSceneOptions();
  }

  // 步骤 2：同步渲染调试面板中的快捷传送下拉选项。
  function renderQuickSceneOptions() {
    const selectEl = document.getElementById('select-teleport-scene');
    if (!selectEl) {
      return;
    }

    selectEl.innerHTML = '<option value="">-- 快速传送 --</option>';

    coords.forEach((item, index) => {
      const option = document.createElement('option');
      option.value = item.sceneId;
      option.textContent = `${index}: Scene ${item.sceneId} (${item.name})`;
      selectEl.appendChild(option);
    });
  }

  // 步骤 3：按需展开或收起坐标管理面板，并回填当前 JSON 配置。
  function toggleCoordsManager() {
    const managerEl = document.getElementById('coords-manager-panel');
    if (!managerEl) {
      return;
    }

    const isHidden = managerEl.style.display === 'none';
    managerEl.style.display = isHidden ? 'flex' : 'none';

    if (!isHidden) {
      return;
    }

    const textarea = document.getElementById('textarea-coords');
    if (textarea) {
      textarea.value = JSON.stringify(coords, null, 2);
    }
  }

  // 步骤 4：校验并持久化坐标配置，同时刷新快速传送菜单。
  function saveCoords() {
    const textarea = document.getElementById('textarea-coords');
    if (!textarea) {
      return;
    }

    try {
      const nextCoords = JSON.parse(textarea.value);
      if (!Array.isArray(nextCoords)) {
        alert('配置必须是 JSON 数组结构！');
        return;
      }

      for (const item of nextCoords) {
        if (typeof item.sceneId !== 'number' || typeof item.x !== 'number' || typeof item.y !== 'number' || !item.name) {
          alert('每项必须包含 sceneId (数字), x (数字), y (数字) 和 name (字符串)！');
          return;
        }
      }

      coords = nextCoords;
      localStorage.setItem('PAL_COORDS', JSON.stringify(coords));
      renderQuickSceneOptions();
      toggleCoordsManager();
    } catch (error) {
      alert('JSON 格式有误，请检查语法！错误信息: ' + error.message);
    }
  }

  // 步骤 5：恢复默认坐标并同步更新展示内容。
  function resetCoords() {
    if (!confirm('确认恢复为系统默认坐标配置吗？这会覆盖当前的本地修改。')) {
      return;
    }

    coords = [...DEFAULT_COORDS];
    localStorage.setItem('PAL_COORDS', JSON.stringify(coords));
    renderQuickSceneOptions();

    const textarea = document.getElementById('textarea-coords');
    if (textarea) {
      textarea.value = JSON.stringify(coords, null, 2);
    }

    alert('已成功恢复为默认配置！');
  }

  function onQuickSceneSelect(value) {
    if (!value) {
      return;
    }

    const teleportInput = document.getElementById('input-teleport-id');
    if (teleportInput) {
      teleportInput.value = value;
    }
  }

  // 步骤 6：根据快捷配置执行场景传送，同时给出调试提示反馈。
  function teleportCustomScene() {
    const sceneInput = document.getElementById('input-teleport-id')?.value;
    if (!sceneInput) {
      alert('请输入有效的 Scene ID 场景数值！');
      return;
    }

    const sceneId = parseInt(sceneInput, 10);
    if (sceneId <= 0 || sceneId > 200) {
      alert('场景 ID 超出合法区间 (1-200)！');
      return;
    }

    if (!window.state || !window.toggleScene || !window.setRolePos) {
      console.error('游戏引擎尚未完全初始化，无法执行传送');
      return;
    }

    const target = coords.find(item => item.sceneId === sceneId) || { x: 30, y: 30, name: `未知场景 #${sceneId}` };
    window.setRolePos(target.x, target.y, 0);
    window.toggleScene(sceneId);
    showTips(`太乙神行传送！成功降落于 ${target.name} (${target.x}, ${target.y})`);
  }

  // 步骤 7：直接切换场景编号，用于快速跳转调试。
  function changeCustomScene() {
    const sceneInput = document.getElementById('input-scene-switch-id')?.value;
    if (!sceneInput) {
      alert('请输入有效的 Scene ID 场景数值！');
      return;
    }

    const sceneId = parseInt(sceneInput, 10);
    if (sceneId <= 0 || sceneId > 200) {
      alert('场景 ID 超出合法区间 (1-200)！');
      return;
    }

    if (!window.state || !window.toggleScene) {
      console.error('游戏引擎尚未完全初始化，无法进行场景切换');
      return;
    }

    window.toggleScene(sceneId);
    showTips(`场景切换！已成功切换至场景 #${sceneId}`);
  }

  // 步骤 8：精确修改主角瓦片坐标，方便场景内定位。
  function modifyPlayerCoord() {
    const xInput = document.getElementById('input-coord-x')?.value;
    const yInput = document.getElementById('input-coord-y')?.value;
    const halfInput = document.getElementById('select-coord-half')?.value;

    if (xInput === '' || yInput === '') {
      alert('请输入有效的瓦片坐标 X 和 Y！');
      return;
    }

    const x = parseInt(xInput, 10);
    const y = parseInt(yInput, 10);
    const half = parseInt(halfInput, 10);

    if (x < 0 || x > 127 || y < 0 || y > 127) {
      alert('瓦片坐标范围必须在 0 到 127 之间！');
      return;
    }

    if (!window.setRolePos) {
      console.error('游戏引擎尚未初始化完成，无法修改坐标');
      return;
    }

    window.setRolePos(x, y, half);
    showTips(`精确定位！已将主角瓦片坐标修改为 (${x}, ${y})` + (half ? ' (半网格)' : ''));
  }

  function teleportMarket() {
    if (!window.state || !window.toggleScene || !window.setRolePos) {
      return;
    }

    window.setRolePos(36, 58, 0);
    window.toggleScene(4);
    showTips('太乙神行瞬移大法！直接飞抵集市！');
  }

  window.onQuickSceneSelect = onQuickSceneSelect;
  window.toggleCoordsManager = toggleCoordsManager;
  window.saveCoords = saveCoords;
  window.resetCoords = resetCoords;
  window.teleportCustomScene = teleportCustomScene;
  window.changeCustomScene = changeCustomScene;
  window.modifyPlayerCoord = modifyPlayerCoord;
  window.teleportMarket = teleportMarket;

  loadCoords();
}
