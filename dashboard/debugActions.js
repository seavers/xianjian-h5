export function initDebugActions() {
  function showTips(message) {
    import('../js/ui/talk.js').then(({ Talk }) => {
      Talk.talkTips(message);
    });
  }

  // 步骤 1：调整游戏运行速度，并同步更新面板上的 FPS 提示与主循环 tick。
  async function changeGameSpeed(value) {
    const fps = parseInt(value, 10);
    document.getElementById('label-speed-val').innerText = `${fps} fps`;

    if (window.state) {
      window.state.frameCount = fps;
    }

    const newTickTime = Math.round(900 / fps);
    const appModule = await import('../js/app.js');
    appModule.setTickTime(newTickTime);
  }

  // 步骤 2：提供常用作弊动作，方便快速构造调试状态。
  async function cheatGold() {
    if (!window.state) {
      return;
    }

    const { setMoney } = await import('../js/engine/command.js');
    setMoney(9999);
    showTips('李逍遥财气冲天，获得 9999 文钱！');
  }

  async function cheatItems() {
    if (!window.state) {
      return;
    }

    const { obtain } = await import('../js/engine/command.js');
    obtain(99);
    obtain(100);
    obtain(101);
    showTips('神丹妙药已塞入李逍遥行囊包裹中！');
  }

  async function cheatCustomItem() {
    const input = document.getElementById('input-cheat-item-id')?.value;
    if (!input) {
      alert('请输入有效的物品 ID！');
      return;
    }

    if (!window.state) {
      return;
    }

    const itemId = parseInt(input, 10);
    const { obtain } = await import('../engine/command.js');
    obtain(itemId);
    showTips(`获得道具：#${itemId}`);
  }

  // 步骤 3：统一封装调试存档控制，便于入口页只保留绑定关系。
  async function debugSaveGame(slotId) {
    const resolvedSlotId = slotId || parseInt(document.getElementById('input-save-slot-id')?.value, 10) || 1;
    const { saveArchive } = await import('../js/esc/archive.js');

    saveArchive(resolvedSlotId, () => {
      showTips(`⚙️ 调试控制：进度保存成功！当前进度 ID: #${resolvedSlotId}`);
    });
  }

  async function debugLoadGame(slotId) {
    const resolvedSlotId = slotId || parseInt(document.getElementById('input-save-slot-id')?.value, 10) || 1;
    const { loadArchive } = await import('../js/esc/archive.js');

    loadArchive(resolvedSlotId, async () => {
      const [{ setRolePos }, { update }] = await Promise.all([
        import('../js/engine/command.js'),
        import('../js/ui/draw.js')
      ]);

      setRolePos(window.state.mx, window.state.my, window.state.mhalf);
      update();
      showTips(`⚙️ 调试控制：进度读取成功！加载场景 #${window.state.sceneId}`);
    });
  }

  async function debugSaveGameInstant() {
    try {
      const { getMaxSaveSlotId } = await import('../js/esc/archive.js');
      const maxId = await getMaxSaveSlotId();
      const nextSlotId = Math.max(5, maxId) + 1;

      await debugSaveGame(nextSlotId);

      const inputEl = document.getElementById('input-save-slot-id');
      if (inputEl) {
        inputEl.value = nextSlotId;
      }
    } catch (error) {
      console.error('获取最大存档槽位失败:', error);
    }
  }

  window.changeGameSpeed = changeGameSpeed;
  window.cheatGold = cheatGold;
  window.cheatItems = cheatItems;
  window.cheatCustomItem = cheatCustomItem;
  window.debugSaveGame = debugSaveGame;
  window.debugLoadGame = debugLoadGame;
  window.debugSaveGameInstant = debugSaveGameInstant;
}
