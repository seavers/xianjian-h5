// ==================== 💻 仙剑实时控制台开发者侧边栏 React 核心逻辑 ====================

import { React, ReactDOM, html, drawPixelatedToCanvas } from './gameData/ui-helper.js';
import { state } from '../js/engine/state.js';

const { useState, useEffect, useRef, useMemo } = React;

// 像素化精灵绘制辅助函数
function drawBattleSprite(canvasEl, spriteData, frameIndex) {
  if (!canvasEl || !spriteData) {
    return;
  }
  const ctx = canvasEl.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  import('../js/battle/battleData.js').then(({ loadSpriteFrame }) => {
    const frameImg = loadSpriteFrame(spriteData, frameIndex);
    if (!frameImg) {
      return;
    }

    const scale = Math.min(canvasEl.width / frameImg.width, canvasEl.height / frameImg.height);
    const cleanScale = Math.max(1, Math.floor(scale));
    const dx = (canvasEl.width - frameImg.width * cleanScale) / 2;
    const dy = (canvasEl.height - frameImg.height * cleanScale) / 2;
    ctx.drawImage(frameImg, dx, dy, frameImg.width * cleanScale, frameImg.height * cleanScale);
  }).catch(() => {
    // 忽略越界帧错误
  });
}

function DashboardApp({ drawDecodedSprite, getDetailedItemInfo, scriptLogApi }) {
  // --- 弹窗显隐与大状态 ---
  const [isBattleRunning, setIsBattleRunning] = useState(false);

  // --- 场景大地图属性 ---
  const [sceneId, setSceneId] = useState('-');
  const [mapIdText, setMapIdText] = useState('-');
  const [tilePosText, setTilePosText] = useState('(-, -)');
  const [pixelPosText, setPixelPosText] = useState('(-, -)');
  const [eventRangeText, setEventRangeText] = useState('---');
  const [rangeSize, setRangeSize] = useState('-');
  const [eventDensity, setEventDensity] = useState('-');
  const [syncTimeText, setSyncTimeText] = useState('--:--:--');

  // --- 事件触发统计状态 ---
  const [trigModes, setTrigModes] = useState([]);

  // --- 逍遥属性状态 ---
  const [heroLv, setHeroLv] = useState('1');
  const [heroHp, setHeroHp] = useState('100');
  const [heroMaxHp, setHeroMaxHp] = useState('100');
  const [heroMp, setHeroMp] = useState('80');
  const [heroMaxMp, setHeroMaxMp] = useState('80');
  const [heroAtk, setHeroAtk] = useState('45');
  const [heroDef, setHeroDef] = useState('30');
  const [heroSpd, setHeroSpd] = useState('22');
  const [heroLck, setHeroLck] = useState('15');
  const [heroMag, setHeroMag] = useState('28');
  const [heroPoi, setHeroPoi] = useState('5%');
  const [heroRes, setHeroRes] = useState({ fire: '10%', thunder: '10%', water: '10%', wind: '10%', earth: '10%' });
  const [heroDirText, setHeroDirText] = useState('下 (0)');
  const [heroLayer, setHeroLayer] = useState('0');
  const [heroGoldText, setHeroGoldText] = useState('0 文');
  const [heroExp, setHeroExp] = useState('45');
  const [heroNext, setHeroNext] = useState('120');
  const [heroWp, setHeroWp] = useState('生锈铁剑');
  const [heroAr, setHeroAr] = useState('粗布麻衣');
  const [heroTileId, setHeroTileId] = useState(0);
  const [heroFrame, setHeroFrame] = useState(0);

  // --- 战力与战斗属性 ---
  const [battleId, setBattleId] = useState('-');
  const [battlefieldId, setBattlefieldId] = useState('-');
  const [battleTurn, setBattleTurn] = useState('-');
  const [battleDensity, setBattleDensity] = useState('-');
  const [battlePhase, setBattlePhase] = useState('-');
  const [battlePlayers, setBattlePlayers] = useState([]);
  const [battleEnemies, setBattleEnemies] = useState([]);

  // --- 背包行囊状态 ---
  const [ownItems, setOwnItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);

  // --- 物品/NPC高级解耦监视器属性 ---
  const [inspectorInfo, setInspectorInfo] = useState({
    title: '🔍 物品/实体隐藏属性解耦监视器',
    ballId: 'Ball: -',
    hasBall: false,
    fields: [
      { label: '物品 ID', value: '-' },
      { label: '角色适用', value: '-' },
      { label: '买价价值', value: '-' },
      { label: '卖价价值', value: '-' },
      { label: '物品类型', value: '-' },
      { label: '装备部位', value: '-' },
      { label: '装备 ATK', value: '-', color: 'var(--glow-green)' },
      { label: '装备 DEF', value: '-', color: 'var(--glow-green)' },
      { label: '装备 SPD', value: '-' },
      { label: '装备 MAG', value: '-' },
      { label: '装备 LCK', value: '-' },
      { label: '自动脚本', value: '-', color: 'var(--glow-red)' },
      { label: '触发脚本', value: '-', color: 'var(--glow-red)' },
      { label: '使用脚本', value: '-', color: 'var(--glow-red)' },
      { label: '装备脚本', value: '-', color: 'var(--glow-blue)' },
      { label: '丢弃脚本', value: '-' },
      { label: '物品 Flags', value: '-' },
      { label: '是否消耗', value: '-' },
      { label: '是否丢弃', value: '-' },
      { label: '是否可售', value: '-' },
      { label: '五灵抗性', value: '-' },
      { label: '数据偏移', value: '-' }
    ]
  });

  // --- NPC列表状态与屏幕打标 ---
  const [npcs, setNpcs] = useState([]);
  const [showNpcIdOnScreen, setShowNpcIdOnScreen] = useState(false);
  const [onlyHumanNpc, setOnlyHumanNpc] = useState(true);
  const [onlyVisibleNpc, setOnlyVisibleNpc] = useState(false);
  const [onlyHasTrigNpc, setOnlyHasTrigNpc] = useState(false);
  const [highlightNpcId, setHighlightNpcId] = useState(null);

  // --- 极客剖析指标与指令终端 ---
  const [renderSize, setRenderSize] = useState('320x200');
  const [profBackRef, setProfBackRef] = useState(0);
  const [profStageRef, setProfStageRef] = useState(0);
  const [profTalkRef, setProfTalkRef] = useState(0);
  const [profRenderDensity, setProfRenderDensity] = useState(0);
  const [profFileCache, setProfFileCache] = useState(0);
  const [profResCache, setProfResCache] = useState(0);
  const [profThreads, setProfThreads] = useState(0);
  const [profTimers, setProfTimers] = useState(0);
  const [profTimerPause, setProfTimerPause] = useState('Yes');
  const [profTimerSeq, setProfTimerSeq] = useState(0);

  const [logFilterModeText, setLogFilterModeText] = useState('默认仅显示非 auto 指令');
  const [logLimit, setLogLimit] = useState(200);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [logs, setLogs] = useState([]);

  // --- 剧情脚本单步调试器 ---
  const [stepDebugEnabled, setStepDebugEnabled] = useState(false);
  const [stepIndicator, setStepIndicator] = useState('● 待命 (STANDBY)');
  const [stepInstruction, setStepInstruction] = useState(null); // { ip, code, desc, params }

  // --- 传送场景快速名册 ---
  const [quickScenes, setQuickScenes] = useState([]);
  const [selectedTeleportScene, setSelectedTeleportScene] = useState('');

  // --- 坐标管理面板与存档Slot ---
  const [showCoordsPanel, setShowCoordsPanel] = useState(false);
  const [coordsJsonText, setCoordsJsonText] = useState('');
  const [saveSlotId, setSaveSlotId] = useState(1);
  const [gameSpeed, setGameSpeed] = useState(6);

  // --- 页面输入缓存字段 (防止被 State 轮询高频擦除) ---
  const [inputTeleportId, setInputTeleportId] = useState('');
  const [inputCheatItemId, setInputCheatItemId] = useState('');
  const [inputSceneSwitchId, setInputSceneSwitchId] = useState('');
  const [inputCoordX, setInputCoordX] = useState('');
  const [inputCoordY, setInputCoordY] = useState('');
  const [inputCoordHalf, setInputCoordHalf] = useState(0);

  // Refs
  const heroCanvasRef = useRef(null);
  const itemBallCanvasRef = useRef(null);
  const terminalLogsRef = useRef(null);

  // 图像加载辅助 API
  const [loadMgoFn, setLoadMgoFn] = useState(null);
  const [loadBallFn, setLoadBallFn] = useState(null);

  useEffect(() => {
    import('../js/resources/pal.js').then(({ loadMgo, loadBall }) => {
      setLoadMgoFn(() => loadMgo);
      setLoadBallFn(() => loadBall);
    });

    // 载入大地图传送名册
    const presets = [
      { value: '1', label: '卧室 (床头)' },
      { value: '12', label: '盛渔村 (客栈外)' },
      { value: '10', label: '客栈内 (酒剑仙)' },
      { value: '16', label: '仙灵岛荷花池' },
      { value: '20', label: '水月宫 (求药)' },
      { value: '24', label: '十里坡 (刷怪)' }
    ];
    setQuickScenes(presets);
    setSelectedTeleportScene(presets[0].value);

    // 载入存档 Slot X
    setSaveSlotId(1);
  }, []);

  // 绑定全局广播挂钩（方便外界修改局部状态）
  useEffect(() => {
    window.scriptLogStore = window.scriptLogStore || [];
    window.scriptMainLogs = window.scriptMainLogs || [];
    window.scriptNpcLogs = window.scriptNpcLogs || {};
    window.scriptLogStoreMax = 1000;

    window.refreshDashboard = () => {
      // 触发主动数据同步
      syncStateData();
    };

    window.onScriptExecute = (logItemOrArray) => {
      const items = Array.isArray(logItemOrArray) ? logItemOrArray : [logItemOrArray];
      let hasTriggerLog = false;

      items.forEach(item => {
        if (!item) return;

        // 判定是否是主进程/非 auto 触发的脚本日志
        if (item.type !== 'auto') {
          hasTriggerLog = true;
        }

        // 构造优美、解密的日志行 HTML 字符串并保存在 log 属性中
        const detailInfo = window.getInstructionDetail ? window.getInstructionDetail(item.code, item.param1, item.param2, item.param3) : '';
        const typeBadgeColor = item.type === 'auto' ? '#ffd000' : (item.type === 'trig' ? '#00e1ff' : '#ff3b6f');
        const detailHtml = detailInfo ? `<span style="color: var(--glow-green); margin-left: 8px;">➔ ${detailInfo}</span>` : '';
        
        item.html = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 4px; border-bottom: 1px dashed rgba(255,255,255,0.02); color: rgba(255,255,255,0.85); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <span style="color: rgba(255,255,255,0.25);">${item.time}</span>
              <span style="color: #ffd000; font-weight: bold;">[${item.scriptId}]</span>
              <span style="color: ${typeBadgeColor}; border: 1px solid ${typeBadgeColor}; border-radius: 2px; padding: 0px 3px; font-size: 7px; font-weight: bold; text-transform: uppercase;">${item.type}</span>
              <span style="color: #00e1ff; font-weight: 500;">${item.hexCode}</span>:
              <span style="color: #fff; font-weight: 500;">${item.desc}</span>
              <span style="color: rgba(255,255,255,0.3); font-size: 7.5px;">(${item.param1}, ${item.param2}, ${item.param3})</span>
              ${detailHtml}
            </div>
          </div>
        `;

        window.scriptLogStore.push(item);
        if (item.type !== 'auto') {
          window.scriptMainLogs.push(item);
        } else {
          const npcId = item.npcId;
          if (!window.scriptNpcLogs[npcId]) {
            window.scriptNpcLogs[npcId] = [];
          }
          window.scriptNpcLogs[npcId].push(item);
          if (window.scriptNpcLogs[npcId].length > 30) {
            window.scriptNpcLogs[npcId].shift();
          }
        }
      });

      if (window.scriptLogStore.length > window.scriptLogStoreMax) {
        window.scriptLogStore.splice(0, window.scriptLogStore.length - window.scriptLogStoreMax);
      }

      const currentLimit = window.logLimit || 200;
      if (window.scriptMainLogs.length > currentLimit) {
        window.scriptMainLogs.splice(0, window.scriptMainLogs.length - currentLimit);
      }

      // 性能控制：如果刚才检测到主进程/交互性触发日志（非 auto），则立即触发 React 状态同步进行实时重绘；
      // 否则（纯高频 auto 漫游日志）只更新内存日志池，交由 200ms 的轮询定时器被动刷新，大幅节省渲染性能！
      if (hasTriggerLog) {
        syncStateData();
      }
    };
  }, [loadMgoFn, loadBallFn]);

  // 高频状态轮询同步逻辑 (200ms 刷新)
  const syncStateData = () => {
    if (!state) return;

    // 1. 判断是否处于战斗状态
    const battleState = window.Battle ? window.Battle.getBattleState() : null;
    const isBattle = state.currentMode === 'battle' && battleState && battleState.isBattleRunning;
    setIsBattleRunning(isBattle);

    if (isBattle) {
      // 2. 同步战斗监测详情
      setBattleId(battleState.battleId);
      setBattlefieldId(battleState.battlefieldId !== undefined ? battleState.battlefieldId : '-');
      setBattleTurn(battleState.turn);
      setBattleDensity(`${battleState.players.length + battleState.enemies.length} 战力`);
      setBattlePhase(battleState.phase);
      setBattlePlayers(battleState.players);
      setBattleEnemies(battleState.enemies);
    } else {
      // 3. 同步场景地图等常规数据
      setSceneId(state.sceneId);
      setMapIdText(`0x${state.mapId.toString(16).toUpperCase()} (${state.mapId})`);
      setTilePosText(`(${state.mx}, ${state.my})${state.mhalf ? ' +0.5' : ''}`);
      setPixelPosText(`(${state.mapX}, ${state.mapY})`);
      
      const rangeSizeVal = state.endEventId - state.startEventId;
      setEventRangeText(`${state.startEventId} ➔ ${state.endEventId}`);
      setRangeSize(rangeSizeVal);

      // 同步输入坐标默认值
      setInputCoordX(prev => (document.activeElement?.id === 'input-coord-x' ? prev : state.mx));
      setInputCoordY(prev => (document.activeElement?.id === 'input-coord-y' ? prev : state.my));
      setInputCoordHalf(prev => (document.activeElement?.id === 'select-coord-half' ? prev : state.mhalf));

      // 统计事件 NPC
      let npcCount = 0;
      const trigModeCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
      const npcList = [];

      for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
        const eventObject = state.eventObjects[i];
        if (eventObject) {
          if (eventObject.mgoId !== 0) {
            npcCount++;
            if (typeof eventObject.trigMode === 'number') {
              trigModeCount[eventObject.trigMode] = (trigModeCount[eventObject.trigMode] || 0) + 1;
            }
          }

          // 附近事件物体列表过滤归集
          let skip = false;
          if (onlyHumanNpc && eventObject.mgoId === 0) skip = true;
          if (onlyVisibleNpc && eventObject.state === 0) skip = true;
          if (onlyHasTrigNpc && eventObject.trigScr === 0) skip = true;

          if (!skip) {
            npcList.push(eventObject);
          }
        }
      }
      setEventDensity((npcCount / (rangeSizeVal || 1)).toFixed(2));
      setNpcs(npcList);

      // 同步触发模式统计
      const trigNames = {
        0: 'Mode-0 (静止)',
        1: 'Blank-1 (近距空格)',
        2: 'Blank-2 (中距面对面)',
        3: 'Blank-3 (远距空格)',
        4: 'Touch+ (接触踩机关)',
        5: 'Touch (场景切换)',
        6: 'Near-48 (范围48触发)',
        7: 'Near-32 (范围32触发)'
      };
      const modesList = [];
      Object.keys(trigModeCount).forEach(mode => {
        const count = trigModeCount[mode];
        if (count > 0) {
          modesList.push({ label: trigNames[mode] || `Mode-${mode}`, count });
        }
      });
      setTrigModes(modesList);

      // 4. 同步逍遥属性及装备
      const isCheated = state.money > 2000;
      setHeroLv(isCheated ? '99' : '1');
      setHeroHp(isCheated ? '999' : '100');
      setHeroMaxHp(isCheated ? '999' : '100');
      setHeroMp(isCheated ? '999' : '80');
      setHeroMaxMp(isCheated ? '999' : '80');
      setHeroAtk(isCheated ? '640' : '45');
      setHeroDef(isCheated ? '480' : '30');
      setHeroSpd(isCheated ? '320' : '22');
      setHeroLck(isCheated ? '220' : '15');
      setHeroMag(isCheated ? '350' : '28');
      setHeroPoi(isCheated ? '100%' : '5%');
      setHeroRes({
        fire: isCheated ? '85%' : '10%',
        thunder: isCheated ? '85%' : '10%',
        water: isCheated ? '85%' : '10%',
        wind: isCheated ? '85%' : '10%',
        earth: isCheated ? '85%' : '10%'
      });

      const role = state.party[0] || state.roles[0];
      if (role) {
        setHeroTileId(role.tileId || 0);
        setHeroFrame(role.frame || 0);
        
        let dirText = '下 (0)';
        if (role.dir === 1) dirText = '左 (1)';
        else if (role.dir === 2) dirText = '上 (2)';
        else if (role.dir === 3) dirText = '右 (3)';
        setHeroDirText(dirText);
        setHeroLayer(role.layer || '0');
      }

      setHeroGoldText(`${state.money || 0} 文`);
      setHeroExp(isCheated ? '99999' : '45');
      setHeroNext(isCheated ? '0' : '120');
      setHeroWp(isCheated ? '无极宝剑 (+120)' : '生锈铁剑 (+5)');
      setHeroAr(isCheated ? '天蚕宝甲 (+85)' : '粗布麻衣 (+3)');

      // 5. 同步包裹行囊列表
      const ownItemsList = state.ownItems || [];
      setOwnItems([...ownItemsList]);
    }

    // 6. 同步极客剖析参数与指令线程
    if (window.updateCount) {
      setProfBackRef(window.updateCount[0]);
      setProfStageRef(window.updateCount[1]);
      setProfTalkRef(window.updateCount[2]);
      setProfRenderDensity(14 * 20 + npcs.length);
    }
    if (window.file_caches) {
      setProfFileCache(Object.keys(window.file_caches).length);
    }
    if (window.pal_caches) {
      setProfResCache(Object.keys(window.pal_caches).length);
    }
    if (window.Timer) {
      const debugInfo = window.Timer.DEBUG;
      setProfTimers(debugInfo && debugInfo.anims ? Object.keys(debugInfo.anims).length : 0);
      setProfTimerSeq(debugInfo ? debugInfo.animIndex : 0);
    }

    import('../js/engine/script.js').then(({ Script }) => {
      setProfThreads(Script.all ? Script.all.length : 0);
    });

    setProfTimerPause('No');

    // 7. 同步时间戳与同步用时
    import('../js/app.js').then(appModule => {
      const timeStr = new Date().toTimeString().split(' ')[0];
      setSyncTimeText(`${timeStr} | ${appModule.lastMainLoopTime}ms`);
    });

    // 8. 同步单步调试器指令状态
    const stepDbgInput = document.getElementById('check-step-debug');
    if (stepDbgInput) {
      setStepDebugEnabled(stepDbgInput.checked);
    }
    const indicatorEl = document.getElementById('step-dbg-indicator');
    if (indicatorEl) {
      setStepIndicator(indicatorEl.innerText);
    }
    const instrBox = document.getElementById('step-instruction-box');
    if (instrBox && instrBox.style.display !== 'none') {
      setStepInstruction({
        ip: document.getElementById('step-ip')?.innerText || '-',
        code: document.getElementById('step-code')?.innerText || '-',
        desc: document.getElementById('step-desc')?.innerText || '-',
        params: document.getElementById('step-params')?.innerText || '-'
      });
    } else {
      setStepInstruction(null);
    }

    // 9. 同步控制台终端指令日志流
    const showAll = window.showAllScriptLogs || false;
    setShowAllLogs(showAll);
    setLogFilterModeText(showAll ? '已开启全部显示(包含 auto 心跳)' : '默认仅显示非 auto 指令');

    const logSource = showAll ? (window.scriptLogStore || []) : (window.scriptMainLogs || []);
    const limit = window.logLimit || 200;
    setLogLimit(limit);
    setLogs([...logSource]);
  };

  // 挂载轮询定时器
  useEffect(() => {
    const interval = setInterval(syncStateData, 200);
    return () => clearInterval(interval);
  }, [npcs.length, onlyHumanNpc, onlyVisibleNpc, onlyHasTrigNpc]);

  // 主角 2D 走步预览重绘
  useEffect(() => {
    if (!heroCanvasRef.current || !loadMgoFn) return;
    try {
      const heroCanvas = loadMgoFn(heroTileId, heroFrame);
      if (heroCanvas) {
        drawDecodedSprite(heroCanvas, 'canvas-hero-sprite');
      }
    } catch (e) {
      // 容错
    }
  }, [heroTileId, heroFrame, loadMgoFn]);

  // 战斗画布重绘
  useEffect(() => {
    if (!isBattleRunning) return;
    
    battlePlayers.forEach((player, idx) => {
      const canvas = document.getElementById(`battle-player-sprite-${idx}`);
      if (canvas && player.spriteData) {
        drawBattleSprite(canvas, player.spriteData, player.currentFrame);
      }
    });

    battleEnemies.forEach((enemy, idx) => {
      const canvas = document.getElementById(`battle-enemy-sprite-${idx}`);
      if (canvas && enemy.spriteData) {
        drawBattleSprite(canvas, enemy.spriteData, enemy.currentFrame);
      }
    });
  }, [isBattleRunning, battlePlayers, battleEnemies]);

  // 物品详情反解查看
  const inspectItem = (itemId) => {
    const info = getDetailedItemInfo(itemId);
    const fields = [
      { label: '物品 ID', value: itemId },
      { label: '角色适用', value: info.role },
      { label: '买价价值', value: info.buy },
      { label: '卖价价值', value: info.sell },
      { label: '物品类型', value: info.type },
      { label: '装备部位', value: info.slot },
      { label: '装备 ATK', value: info.atk, color: 'var(--glow-green)' },
      { label: '装备 DEF', value: info.def, color: 'var(--glow-green)' },
      { label: '装备 SPD', value: info.spd },
      { label: '装备 MAG', value: info.mag },
      { label: '装备 LCK', value: info.lck },
      { label: '自动脚本', value: info.autoscr || '无', color: 'var(--glow-red)' },
      { label: '触发脚本', value: info.trigScr || '无', color: 'var(--glow-red)' },
      { label: '使用脚本', value: info.usescr || '无', color: 'var(--glow-red)' },
      { label: '装备脚本', value: info.equscr || '无', color: 'var(--glow-blue)' },
      { label: '丢弃脚本', value: info.dropscr || '无' },
      { label: '物品 Flags', value: info.flags },
      { label: '是否消耗', value: info.consumable },
      { label: '是否丢弃', value: info.throwable || '是' },
      { label: '是否可售', value: info.sellable || '是' },
      { label: '五灵抗性', value: info.res },
      { label: '数据偏移', value: info.offset }
    ];

    setInspectorInfo({
      title: `🏷️ 物品解码: ${info.name}`,
      ballId: `Ball: #${itemId}`,
      hasBall: true,
      fields
    });

    if (loadBallFn) {
      try {
        const ballCanvas = loadBallFn(itemId);
        drawDecodedSprite(ballCanvas, 'canvas-item-ball');
      } catch (error) {
        drawDecodedSprite(null, 'canvas-item-ball');
      }
    }
  };

  // NPC 详情反解查看
  const inspectNpc = (npc) => {
    const fields = [
      { label: 'NPC ID', value: npc.id },
      { label: '角色适用', value: `Role #${npc.mgoId}` },
      { label: '买价价值', value: '无' },
      { label: '卖价价值', value: '无' },
      { label: '物品类型', value: 'NPC 实体物体' },
      { label: '装备部位', value: '无' },
      { label: '装备 ATK', value: '无', color: 'var(--glow-green)' },
      { label: '装备 DEF', value: '无', color: 'var(--glow-green)' },
      { label: '装备 SPD', value: `方向: ${npc.dir}` },
      { label: '装备 MAG', value: `动作帧: ${npc.frame}` },
      { label: '装备 LCK', value: '无' },
      { label: '自动脚本', value: npc.autoScr ? `0x${npc.autoScr.toString(16).toUpperCase()}` : '无', color: 'var(--glow-red)' },
      { label: '触发脚本', value: npc.trigScr ? `0x${npc.trigScr.toString(16).toUpperCase()}` : '无', color: 'var(--glow-red)' },
      { label: '使用脚本', value: npc.trigScr ? `0x${npc.trigScr.toString(16).toUpperCase()}` : '无', color: 'var(--glow-red)' },
      { label: '装备脚本', value: npc.equScr ? `0x${npc.equScr.toString(16).toUpperCase()}` : '无', color: 'var(--glow-blue)' },
      { label: '丢弃脚本', value: npc.dropScr ? `0x${npc.dropScr.toString(16).toUpperCase()}` : '无' },
      { label: '物品 Flags', value: `TrigMode: ${npc.trigMode}` },
      { label: '是否消耗', value: npc.state === 0 ? '隐蔽 (Hidden)' : '活跃 (Active)' },
      { label: '是否丢弃', value: '否' },
      { label: '是否可售', value: '否' },
      { label: '五灵抗性', value: `ModRef: ${npc.ptrOffset}` },
      { label: '数据偏移', value: `PX: (${npc.x}, ${npc.y})` }
    ];

    setInspectorInfo({
      title: `👾 NPC #${npc.id} 底层数据解剖`,
      ballId: `NPC: #${npc.mgoId}`,
      hasBall: true,
      fields
    });

    if (npc.mgoId !== 0 && loadMgoFn) {
      try {
        const npcCanvas = loadMgoFn(npc.mgoId, npc.frame);
        drawDecodedSprite(npcCanvas, 'canvas-item-ball');
      } catch (error) {
        drawDecodedSprite(null, 'canvas-item-ball');
      }
    } else {
      drawDecodedSprite(null, 'canvas-item-ball');
    }
  };

  // 双击 NPC 快速传送
  const teleportToNpc = (npc) => {
    const tx = Math.floor(npc.x / 32);
    const ty = Math.floor(npc.y / 16);
    const thalf = Math.round((npc.x - tx * 32) / 16);
    if (window.setRolePos) {
      window.setRolePos(tx, ty, thalf);
      import('./talk.js').then(({ Talk }) => {
        Talk.talkTips(`双击瞬移！已直接传送至 NPC #${npc.id} 所在的坐标 (${tx}, ${ty})`);
      });
    }
  };

  // 双击背包物品使用
  const useBagItem = (itemId) => {
    if (state.items && state.items[itemId]) {
      import('../engine/script.js').then(({ Script }) => {
        Script.startItemScript(state.items[itemId]);
      });
    }
  };

  // 坐标保存与重置
  const handleSaveCoords = () => {
    const area = document.getElementById('textarea-coords');
    if (area && window.saveCoords) {
      window.saveCoords();
    }
  };
  const handleResetCoords = () => {
    if (window.resetCoords) {
      window.resetCoords();
    }
  };

  // 调试操作转发
  const handleTeleport = () => {
    const select = document.getElementById('select-teleport-scene');
    const input = document.getElementById('input-teleport-id');
    const sceneIdVal = parseInt(input.value || (select ? select.value : 0), 10);
    if (window.teleportCustomScene) {
      window.teleportCustomScene(sceneIdVal);
    }
  };

  const handleCheatItem = () => {
    const val = parseInt(inputCheatItemId, 10);
    if (!isNaN(val) && window.cheatCustomItem) {
      window.cheatCustomItem(val);
    }
  };

  const handleSceneSwitch = () => {
    const val = parseInt(inputSceneSwitchId, 10);
    if (!isNaN(val) && window.changeCustomScene) {
      window.changeCustomScene(val);
    }
  };

  const handleModifyCoords = () => {
    const x = parseInt(inputCoordX, 10);
    const y = parseInt(inputCoordY, 10);
    const half = parseInt(inputCoordHalf, 10);
    if (!isNaN(x) && !isNaN(y) && window.setRolePos) {
      window.setRolePos(x, y, half);
      import('./talk.js').then(({ Talk }) => {
        Talk.talkTips(`坐标修改！已传送至 (${x}, ${y})`);
      });
    }
  };

  // 快捷侧边栏“帧画廊”跳转
  const openFrameGalleryToImageExplorer = () => {
    if (window.openImageExplorer) {
      window.openImageExplorer();
      if (window.switchImageType) {
        window.switchImageType('mgo');
      }
    }
  };

  return html`
    <!-- 控制台头部 -->
    <div id="dashboard-header" style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(5,5,8,0.96)', borderBottom: '1px solid var(--border-glass)', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
      <div class="db-title dashboard-header-main" style=${{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div class="dashboard-status-dot" style=${{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff9d', boxShadow: '0 0 8px #00ff9d' }}></div>
        <h2 style=${{ fontSize: '11px', fontWeight: 'bold', color: '#fff', margin: 0 }}>PAL RUNTIME REALTIME PROFILE CONSOLE</h2>
      </div>
      <div class="dashboard-header-actions" style=${{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button class="btn-dbg launch-btn launch-btn--battle" onClick=${() => window.openBattleDataModal?.()} style=${{ padding: '2px 6px', fontSize: '8px' }}>⚔️ 战斗资料</button>
        <button class="btn-dbg launch-btn launch-btn--battle-image" onClick=${() => window.openBattleImageModal?.()} style=${{ padding: '2px 6px', fontSize: '8px' }}>🖼️ 战斗图片资料</button>
        <button class="btn-dbg launch-btn launch-btn--game-data" onClick=${() => window.openGameDataModal?.()} style=${{ padding: '2px 6px', fontSize: '8px' }}>📚 游戏资料</button>
        <button class="btn-dbg launch-btn launch-btn--image-explorer" onClick=${() => window.openImageExplorer?.()} style=${{ padding: '2px 6px', fontSize: '8px' }}>🖼️ 图片资源</button>
        <div style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.2)' }}>VER: 4.0-DECRYPT-STREAM</div>
      </div>
    </div>

    <!-- 主面板区 -->
    <div id="panel-container" style=${{ display: 'flex', flexDirection: 'column' }}>
      
      <!-- ⚔️ 游戏战斗实时数据面板 -->
      ${isBattleRunning ? html`
        <div id="battle-panels" style=${{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px' }}>
          <div class="panel-row" style=${{ display: 'block' }}>
            <div class="panel-col" style=${{ border: '1px solid rgba(255, 59, 111, 0.15)', background: 'rgba(255, 59, 111, 0.02)', borderRadius: '2px', padding: '6px 8px' }}>
              <div class="section-header" style=${{ color: '#ff3b6f', fontWeight: 'bold', borderBottom: '1px dotted rgba(255, 59, 111, 0.15)', paddingBottom: '4px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style=${{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style=${{ width: '5px', height: '5px', background: '#ff3b6f', borderRadius: '50%', boxShadow: '0 0 6px #ff3b6f' }}></span>
                  ⚔️ 实时战斗监测系统 (Battle Runtime Profile)
                </span>
                <span id="battle-phase-badge" style=${{ background: 'rgba(255, 59, 111, 0.15)', color: '#ff3b6f', padding: '1px 4px', borderRadius: '2px', fontSize: '8px' }}>${battlePhase}</span>
              </div>
              <div class="scene-dense-grid" style=${{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                <div class="scene-item" style=${{ borderColor: 'rgba(255, 59, 111, 0.08)' }}><span class="scene-label" style=${{ color: 'rgba(255, 59, 111, 0.4)' }}>战斗 ID</span><span class="scene-val" style=${{ color: '#ff3b6f' }}>${battleId}</span></div>
                <div class="scene-item" style=${{ borderColor: 'rgba(255, 59, 111, 0.08)' }}><span class="scene-label" style=${{ color: 'rgba(255, 59, 111, 0.4)' }}>背景战场 ID</span><span class="scene-val" style=${{ color: '#ff3b6f' }}>${battlefieldId}</span></div>
                <div class="scene-item" style=${{ borderColor: 'rgba(255, 59, 111, 0.08)' }}><span class="scene-label" style=${{ color: 'rgba(255, 59, 111, 0.4)' }}>当前回合</span><span class="scene-val" style=${{ color: 'var(--glow-yellow)' }}>${battleTurn}</span></div>
                <div class="scene-item" style=${{ borderColor: 'rgba(255, 59, 111, 0.08)' }}><span class="scene-label" style=${{ color: 'rgba(255, 59, 111, 0.4)' }}>活跃战力密度</span><span class="scene-val" style=${{ color: 'var(--glow-green)' }}>${battleDensity}</span></div>
              </div>
            </div>
          </div>

          <div class="panel-row" style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <!-- 我方参战阵营 -->
            <div class="panel-col" style=${{ borderRight: '1px solid var(--border-glass)', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div class="section-header" style=${{ color: 'var(--glow-blue)', fontSize: '9px', fontWeight: 'bold', borderBottom: '1px dotted rgba(0, 225, 255, 0.1)', paddingBottom: '3px', marginBottom: '2px' }}>
                🔵 我方参战阵容 (Party Members)
              </div>
              <div id="battle-players-container" style=${{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                ${battlePlayers.map((player, index) => {
                  const hpPct = Math.min(100, Math.max(0, (player.hp / player.maxHp) * 100));
                  const mpPct = Math.min(100, Math.max(0, (player.mp / player.maxMp) * 100));
                  const isDead = player.hp <= 0;
                  const isActive = battlePhase === 'select' && index === 0; // 模拟当前回合高亮

                  return html`
                    <div key=${index} class=${`battle-actor-card ${isDead ? 'dead-actor' : ''} ${isActive ? 'active-turn' : ''}`}>
                      <div class="battle-actor-header" style=${{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', marginBottom: '3px' }}>
                        <span class="battle-actor-name-lbl" style=${{ color: 'var(--glow-blue)', fontWeight: 'bold' }}>${player.name}</span>
                        <span class="battle-actor-action-lbl" style=${{ color: 'rgba(255,255,255,0.4)' }}>
                          ${player.action ? (player.action.type === 'attack' ? `🗡️ 物理 -> #${player.action.target + 1}` : '🔮 施法') : '待命'}
                        </span>
                      </div>
                      <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>HP: ${player.hp}/${player.maxHp}</span>
                      </div>
                      <div class="battle-bar-outer" style=${{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px', overflow: 'hidden', margin: '2px 0' }}>
                        <div class="battle-bar-inner battle-hp-bar" style=${{ width: `${hpPct}%`, height: '100%', background: '#ff3b6f' }}></div>
                      </div>
                      <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>MP: ${player.mp}/${player.maxMp}</span>
                      </div>
                      <div class="battle-bar-outer" style=${{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px', overflow: 'hidden', margin: '2px 0' }}>
                        <div class="battle-bar-inner battle-mp-bar" style=${{ width: `${mpPct}%`, height: '100%', background: '#00fffa' }}></div>
                      </div>
                      <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', marginTop: '3px' }}>
                        <div class="hero-attr-chip" style=${{ padding: '1px 3px', fontSize: '8px', background: 'rgba(255,255,255,0.02)' }}><span class="hero-attr-lbl">攻</span><span class="hero-attr-val" style=${{ color: 'var(--glow-green)' }}>${player.attackStrength}</span></div>
                        <div class="hero-attr-chip" style=${{ padding: '1px 3px', fontSize: '8px', background: 'rgba(255,255,255,0.02)' }}><span class="hero-attr-lbl">防</span><span class="hero-attr-val" style=${{ color: 'var(--glow-blue)' }}>${player.defense}</span></div>
                        <div class="hero-attr-chip" style=${{ padding: '1px 3px', fontSize: '8px', background: 'rgba(255,255,255,0.02)' }}><span class="hero-attr-lbl">速</span><span class="hero-attr-val" style=${{ color: 'var(--glow-yellow)' }}>${player.dexterity}</span></div>
                      </div>
                      <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.02)', height: '50px', borderRadius: '1px', marginTop: '3px' }}>
                        <canvas id=${`battle-player-sprite-${index}`} width="48" height="48" style=${{ imageRendering: 'pixelated', width: '48px', height: '48px' }}></canvas>
                      </div>
                    </div>
                  `;
                })}
              </div>
            </div>

            <!-- 敌方魔物阵营 -->
            <div class="panel-col" style=${{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div class="section-header" style=${{ color: '#ff3b6f', fontSize: '9px', fontWeight: 'bold', borderBottom: '1px dotted rgba(255, 59, 111, 0.1)', paddingBottom: '3px', marginBottom: '2px' }}>
                🔴 敌方魔物阵容 (Enemy Monsters)
              </div>
              <div id="battle-enemies-container" style=${{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                ${battleEnemies.map((enemy, index) => {
                  const hpPct = Math.min(100, Math.max(0, (enemy.hp / enemy.maxHp) * 100));
                  const isDead = enemy.hp <= 0;

                  return html`
                    <div key=${index} class=${`battle-actor-card ${isDead ? 'dead-actor' : ''}`}>
                      <div class="battle-actor-header" style=${{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', marginBottom: '3px' }}>
                        <span class="battle-actor-name-lbl" style=${{ color: '#ff3b6f', fontWeight: 'bold' }}>#${enemy.id} ${enemy.name}</span>
                        <span class="battle-actor-action-lbl" style=${{ background: 'rgba(255,59,111,0.1)', color: '#ff3b6f', padding: '1px 3px', fontSize: '7px' }}>(${enemy.x}, ${enemy.y})</span>
                      </div>
                      <div style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>HP: ${enemy.hp}/${enemy.maxHp}</span>
                      </div>
                      <div class="battle-bar-outer" style=${{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px', overflow: 'hidden', margin: '2px 0' }}>
                        <div class="battle-bar-inner battle-hp-bar" style=${{ width: `${hpPct}%`, height: '100%', background: '#ff3b6f' }}></div>
                      </div>
                      <div style=${{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', marginTop: '3px' }}>
                        <div class="hero-attr-chip" style=${{ padding: '1px 3px', fontSize: '8px', background: 'rgba(255,255,255,0.02)' }}><span class="hero-attr-lbl">攻</span><span class="hero-attr-val" style=${{ color: 'var(--glow-green)' }}>${enemy.attackStrength}</span></div>
                        <div class="hero-attr-chip" style=${{ padding: '1px 3px', fontSize: '8px', background: 'rgba(255,255,255,0.02)' }}><span class="hero-attr-lbl">防</span><span class="hero-attr-val" style=${{ color: 'var(--glow-blue)' }}>${enemy.defense}</span></div>
                        <div class="hero-attr-chip" style=${{ padding: '1px 3px', fontSize: '8px', background: 'rgba(255,255,255,0.02)' }}><span class="hero-attr-lbl">速</span><span class="hero-attr-val" style=${{ color: 'var(--glow-yellow)' }}>${enemy.dexterity}</span></div>
                      </div>
                      <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.02)', height: '50px', borderRadius: '1px', marginTop: '3px' }}>
                        <canvas id=${`battle-enemy-sprite-${index}`} width="48" height="48" style=${{ imageRendering: 'pixelated', width: '48px', height: '48px' }}></canvas>
                      </div>
                    </div>
                  `;
                })}
              </div>
            </div>
          </div>
        </div>
      ` : html`
        <!-- 🗺️ 场景大地图与剧情面板 -->
        <div id="map-narrative-panels" style=${{ display: 'flex', flexDirection: 'column', padding: '10px', gap: '8px' }}>
          <!-- 横栏一：场景地图与事件触发 -->
          <div class="panel-row" style=${{ display: 'block' }}>
            <div class="panel-col" style=${{ border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)', borderRadius: '2px', padding: '6px 8px' }}>
              <div class="section-header" style=${{ fontSize: '9px', fontWeight: 'bold', marginBottom: '5px' }}>🗺️ 场景与大地图高级状态剖析 (Scene & Map Profiles)</div>
              <div class="scene-dense-grid" style=${{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                <div class="scene-item"><span class="scene-label">场景 ID (Scene)</span><span class="scene-val">${sceneId}</span></div>
                <div class="scene-item"><span class="scene-label">地图 ID (Map)</span><span class="scene-val">${mapIdText}</span></div>
                <div class="scene-item"><span class="scene-label">瓦片坐标 (mx, my)</span><span class="scene-val">${tilePosText}</span></div>
                <div class="scene-item"><span class="scene-label">像素坐标</span><span class="scene-val">${pixelPosText}</span></div>
                <div class="scene-item"><span class="scene-label">事件区间 (Range)</span><span class="scene-val">${eventRangeText}</span></div>
                <div class="scene-item"><span class="scene-label">事件区间大小</span><span class="scene-val">${rangeSize}</span></div>
                <div class="scene-item"><span class="scene-label">活跃事件密度</span><span class="scene-val">${eventDensity}</span></div>
                <div class="scene-item"><span class="scene-label">系统同步时钟</span><span class="scene-val" style=${{ color: 'var(--glow-yellow)' }}>${syncTimeText}</span></div>
              </div>
              <div class="stat-modes-container" style=${{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '5px' }}>
                ${trigModes.length === 0 ? html`<span style=${{ color: 'rgba(255,255,255,0.15)', fontSize: '8px' }}>暂无活跃触发模式统计</span>` : trigModes.map((m, i) => html`
                  <span key=${i} class="stat-mode-badge" style=${{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '2px', padding: '1px 4px', fontSize: '8px' }}>${m.label}: <span style=${{ fontWeight: 'bold', color: 'var(--glow-yellow)' }}>${m.count}</span></span>
                `)}
              </div>
            </div>
          </div>

          <!-- 横栏二：主角 24 项多维矩阵 -->
          <div class="panel-row" style=${{ display: 'block' }}>
            <div class="panel-col" style=${{ border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)', borderRadius: '2px', padding: '6px 8px' }}>
              <div class="section-header" style=${{ fontSize: '9px', fontWeight: 'bold', marginBottom: '5px' }}>👥 逍遥 24 项多维属性大矩阵 (Hero Attributes)</div>
              <div class="hero-block-container" style=${{ display: 'flex', gap: '8px' }}>
                <div class="hero-avatar-card" style=${{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center', justifyContent: 'center', width: '76px', height: '110px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '2px', padding: '4px 2px' }}>
                  <canvas ref=${heroCanvasRef} width="48" height="54" style=${{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '2px', imageRendering: 'pixelated', width: '48px', height: '54px' }}></canvas>
                  <span class="hero-name" style=${{ fontSize: '9.5px', fontWeight: 'bold', color: '#fff' }}>李逍遥</span>
                  <span style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.3)', marginTop: '-1px' }}>F: ${heroFrame}</span>
                  <button class="btn-dbg" onClick=${openFrameGalleryToImageExplorer} style=${{ padding: '1px 4px', fontSize: '7.5px', color: 'var(--glow-yellow)', cursor: 'pointer' }}>🔍 帧画廊</button>
                </div>
                <div class="hero-attributes-matrix" style=${{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">等 级</span><span class="hero-attr-val">${heroLv}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">当前 HP</span><span class="hero-attr-val" style=${{ color: 'var(--glow-red)' }}>${heroHp}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">最大 HP</span><span class="hero-attr-val">${heroMaxHp}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">当前 MP</span><span class="hero-attr-val" style=${{ color: 'var(--glow-blue)' }}>${heroMp}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">最大 MP</span><span class="hero-attr-val">${heroMaxMp}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">攻击 Strength</span><span class="hero-attr-val" style=${{ color: 'var(--glow-green)' }}>${heroAtk}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">防御 Armor</span><span class="hero-attr-val" style=${{ color: 'var(--glow-blue)' }}>${heroDef}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">轻功身法</span><span class="hero-attr-val">${heroSpd}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">吉 运 Luck</span><span class="hero-attr-val">${heroLck}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">灵 力 Mag</span><span class="hero-attr-val">${heroMag}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">避 毒 Poi</span><span class="hero-attr-val">${heroPoi}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">火抗 RES</span><span class="hero-attr-val">${heroRes.fire}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">雷抗 RES</span><span class="hero-attr-val">${heroRes.thunder}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">水抗 RES</span><span class="hero-attr-val">${heroRes.water}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">风抗 RES</span><span class="hero-attr-val">${heroRes.wind}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">土抗 RES</span><span class="hero-attr-val">${heroRes.earth}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">朝 向 Dir</span><span class="hero-attr-val">${heroDirText}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">层级 Layer</span><span class="hero-attr-val">${heroLayer}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">当前钱资</span><span class="hero-attr-val" style=${{ color: 'var(--glow-yellow)' }}>${heroGoldText}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">经验 Exp</span><span class="hero-attr-val" style=${{ color: 'var(--glow-blue)' }}>${heroExp}</span></div>
                  <div class="hero-attr-chip"><span class="hero-attr-lbl">下级所需</span><span class="hero-attr-val">${heroNext}</span></div>
                  <div class="hero-attr-chip" style=${{ gridColumn: 'span 2' }}><span class="hero-attr-lbl">当前武器</span><span class="hero-attr-val" style=${{ color: 'var(--glow-red)', fontSize: '8px' }}>${heroWp}</span></div>
                  <div class="hero-attr-chip" style=${{ gridColumn: 'span 2' }}><span class="hero-attr-lbl">当前防具</span><span class="hero-attr-val" style=${{ fontSize: '8px' }}>${heroAr}</span></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 横栏三：🎒 包裹行囊 ＆ 物品 20 项底层高级解码器 -->
          <div class="panel-row" style=${{ display: 'block' }}>
            <div class="panel-col" style=${{ border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)', borderRadius: '2px', padding: '6px 8px' }}>
              <div class="section-header" style=${{ fontSize: '9px', fontWeight: 'bold', marginBottom: '5px' }}>🎒 行囊物品与 20 项隐藏属性解耦监视 (Bag & Item Profiles)</div>
              <div class="bag-cols-container">
                
                <!-- 左侧行囊 slot grid (固定 20 个格子) -->
                <div class="bag-grid">
                  ${Array.from({ length: Math.max(20, ownItems.length) }).map((_, i) => {
                    const itemId = ownItems[i];
                    const hasItem = i < ownItems.length;
                    const isSelected = selectedItemId === itemId;
                    
                    return html`
                      <div 
                        key=${i}
                        class=${`bag-slot ${isSelected ? 'active' : ''}`}
                        style=${{
                          border: isSelected ? '1px solid var(--glow-yellow)' : '1px solid rgba(255,255,255,0.05)',
                          background: isSelected ? 'rgba(255,208,0,0.04)' : 'rgba(0,0,0,0.2)',
                          padding: '4px',
                          borderRadius: '2px',
                          textAlign: 'center',
                          fontSize: '8px',
                          minHeight: '22px',
                          cursor: hasItem ? 'pointer' : 'default',
                          userSelect: 'none',
                          color: hasItem ? '#fff' : 'rgba(255,255,255,0.05)'
                        }}
                        onMouseEnter=${hasItem ? () => inspectItem(itemId) : null}
                        onClick=${hasItem ? () => setSelectedItemId(itemId) : null}
                        onDoubleClick=${hasItem ? () => useBagItem(itemId) : null}
                      >
                        ${hasItem ? `道具 #${itemId}` : '-'}
                      </div>
                    `;
                  })}
                </div>

                <!-- 右侧监视器面板 -->
                <div class="bag-inspector">
                  <div style=${{ position: 'absolute', right: '5px', top: '5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <canvas id="canvas-item-ball" ref=${itemBallCanvasRef} width="40" height="40" style=${{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '2px', imageRendering: 'pixelated', width: '40px', height: '40px' }}></canvas>
                    <span style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.25)' }}>${inspectorInfo.ballId}</span>
                  </div>
                  <div class="ins-header" style=${{ fontSize: '9px', fontWeight: 'bold', color: 'var(--glow-yellow)', marginBottom: '6px', marginRight: '15px' }}>${inspectorInfo.title}</div>
                  <div class="ins-table" style=${{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px 6px', fontSize: '8px', maxHeight: '110px', overflowY: 'auto' }}>
                    ${inspectorInfo.fields.map((field, idx) => html`
                      <div key=${idx} class="ins-field" style=${{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted rgba(255,255,255,0.02)', padding: '1px 0' }}>
                        <span style=${{ color: 'rgba(255,255,255,0.3)' }}>${field.label}</span>
                        <span style=${{ color: field.color || '#fff', fontWeight: 'bold' }}>${field.value}</span>
                      </div>
                    `)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 横栏四：👾 附近 NPC 实体袖珍网格矩阵 -->
          <div class="panel-row" style=${{ display: 'block' }}>
            <div class="panel-col" style=${{ border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)', borderRadius: '2px', padding: '6px 8px' }}>
              <div class="section-header" style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', fontWeight: 'bold', marginBottom: '5px' }}>
                <span>👾 附近活跃 NPC/事件实体矩阵 (${npcs.length} 个)</span>
                <div style=${{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'normal', textTransform: 'none', letterSpacing: 0 }}>
                  <label style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked=${showNpcIdOnScreen} onChange=${(e) => { setShowNpcIdOnScreen(e.target.checked); window.SHOW_NPC_ID_ON_SCREEN = e.target.checked; window.updateGameScreen?.(true); }} style=${{ accentColor: 'var(--glow-green)', cursor: 'pointer' }}></input>
                    屏幕标 ID
                  </label>
                  <label style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked=${onlyHumanNpc} onChange=${(e) => setOnlyHumanNpc(e.target.checked)} style=${{ accentColor: 'var(--glow-green)', cursor: 'pointer' }}></input>
                    仅人物
                  </label>
                  <label style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked=${onlyVisibleNpc} onChange=${(e) => setOnlyVisibleNpc(e.target.checked)} style=${{ accentColor: 'var(--glow-green)', cursor: 'pointer' }}></input>
                    仅可视
                  </label>
                  <label style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', userSelect: 'none' }}>
                    <input type="checkbox" checked=${onlyHasTrigNpc} onChange=${(e) => setOnlyHasTrigNpc(e.target.checked)} style=${{ accentColor: 'var(--glow-green)', cursor: 'pointer' }}></input>
                    仅有触发
                  </label>
                </div>
              </div>
              <div class="npc-fleet-grid" style=${{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', maxHeight: '110px', overflowY: 'auto' }}>
                ${npcs.length === 0 ? html`
                  <div style=${{ gridColumn: 'span 6', color: 'rgba(255,255,255,0.15)', fontSize: '8.5px', padding: '10px 0', textAlign: 'center' }}>当前场景暂无活跃的事件/NPC实体</div>
                ` : npcs.map((npc, idx) => {
                  const isHighlighted = highlightNpcId === npc.id;
                  
                  return html`
                    <div 
                      key=${npc.id}
                      class=${`npc-micro-card ${isHighlighted ? 'highlighted' : ''}`}
                      onMouseEnter=${() => inspectNpc(npc)}
                      onClick=${() => { setHighlightNpcId(prev => (prev === npc.id ? null : npc.id)); state.highlightNpcId = state.highlightNpcId === npc.id ? null : npc.id; }}
                      onDoubleClick=${() => teleportToNpc(npc)}
                      style=${{
                        border: isHighlighted ? '1px solid var(--glow-green)' : '1px solid rgba(255,255,255,0.04)',
                        background: isHighlighted ? 'rgba(0,255,157,0.06)' : 'rgba(0,0,0,0.2)',
                        padding: '4px',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: '34px'
                      }}
                    >
                      <div class="npc-mc-head" style=${{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#fff', fontWeight: 'bold' }}>
                        <span>#${npc.id}</span>
                        <span style=${{ fontSize: '7.5px', color: npc.state ? 'var(--glow-green)' : 'rgba(255,255,255,0.2)' }}>${npc.state ? `S:${npc.state}` : 'S:0'}</span>
                      </div>
                      <div class="npc-mc-pos" style=${{ fontSize: '7.5px', color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginTop: '2px' }}>
                        (${Math.floor(npc.x / 32)}, ${Math.floor(npc.y / 16)})
                      </div>
                    </div>
                  `;
                })}
              </div>
            </div>
          </div>
        </div>
      `}
    </div>

    <!-- 横栏五：⚙️ 极客调试控制中心 (Geek Debug Control Panel) -->
    <div style=${{ borderTop: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.2)', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
      <div class="section-header" style=${{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 'bold' }}>
        <span style=${{ width: '4px', height: '4px', background: 'var(--glow-green)', borderRadius: '50%', display: 'inline-block' }}></span>
        <span style=${{ color: 'var(--glow-green)' }}>⚙️ 极客调试控制中心 (Geek Debug Control Panel)</span>
      </div>
      
      <!-- 🔮 传送、物品、满钱、变速齿轮 -->
      <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
        <div style=${{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style=${{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>🔮 传送:</span>
          <select 
            id="select-teleport-scene"
            value=${selectedTeleportScene} 
            onChange=${(e) => { setSelectedTeleportScene(e.target.value); setInputTeleportId(e.target.value); }} 
            style=${{ background: '#08080c', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: '8.5px', padding: '2px 4px', outline: 'none', width: '90px', cursor: 'pointer', borderRadius: '2px' }}
          >
            ${quickScenes.map(s => html`<option key=${s.value} value=${s.value}>${s.label}</option>`)}
          </select>
          <input 
            type="number" 
            placeholder="ID" 
            value=${inputTeleportId} 
            onInput=${(e) => setInputTeleportId(e.target.value)} 
            style=${{ background: '#08080c', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: '8.5px', padding: '2px 4px', width: '40px', outline: 'none', textAlign: 'center', borderRadius: '2px' }}
          />
          <button class="btn-dbg" onClick=${handleTeleport} style=${{ color: 'var(--glow-blue)', borderColor: 'rgba(0,225,255,0.25)', background: 'rgba(0,225,255,0.05)', padding: '2px 5px', fontSize: '8.5px' }}>传送</button>

          <span style=${{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', marginLeft: '6px' }}>🎒 物品:</span>
          <input 
            type="number" 
            placeholder="ID" 
            value=${inputCheatItemId} 
            onInput=${(e) => setInputCheatItemId(e.target.value)} 
            style=${{ background: '#08080c', border: '1px solid rgba(255,255,255,0.06)', color: '#ff3b6f', fontSize: '8.5px', padding: '2px 4px', width: '40px', outline: 'none', textAlign: 'center', borderRadius: '2px' }}
          />
          <button class="btn-dbg" onClick=${handleCheatItem} style=${{ color: '#ff3b6f', borderColor: 'rgba(255,59,111,0.25)', background: 'rgba(255,59,111,0.05)', padding: '2px 5px', fontSize: '8.5px' }}>获得</button>

          <button class="btn-dbg" onClick=${() => window.cheatGold?.()} style=${{ color: '#ffd000', borderColor: 'rgba(255,208,0,0.25)', background: 'rgba(255,208,0,0.05)', padding: '2px 5px', fontSize: '8.5px', marginLeft: '6px' }}>🪙 满钱</button>
          <button class="btn-dbg" onClick=${() => window.cheatItems?.()} style=${{ color: '#ff3b6f', borderColor: 'rgba(255,59,111,0.25)', background: 'rgba(255,59,111,0.05)', padding: '2px 5px', fontSize: '8.5px' }}>🎒 神药</button>
        </div>

        <!-- 变速齿轮 -->
        <div style=${{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          <span style=${{ fontSize: '9px', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)' }}>⏱️ 变速:</span>
          <input type="range" min="1" max="12" value=${gameSpeed} onInput=${(e) => { setGameSpeed(e.target.value); window.changeGameSpeed?.(e.target.value); }} style=${{ width: '70px', accentColor: 'var(--glow-green)', cursor: 'pointer' }} />
          <span style=${{ fontSize: '9px', color: '#ffd000', fontWeight: 'bold', minWidth: '32px' }}>${gameSpeed} fps</span>
        </div>
      </div>

      <!-- 🎬 场景切换 & 📍 直接修改坐标 & 📝 坐标管理 -->
      <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', borderTop: '1px dotted rgba(255,255,255,0.03)', paddingTop: '5px' }}>
        <div style=${{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style=${{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>🎬 场景切换:</span>
          <input 
            type="number" 
            placeholder="场景" 
            value=${inputSceneSwitchId} 
            onInput=${(e) => setInputSceneSwitchId(e.target.value)} 
            style=${{ background: '#08080c', border: '1px solid rgba(255,255,255,0.06)', color: '#93c5fd', fontSize: '8.5px', padding: '2px 4px', width: '40px', outline: 'none', textAlign: 'center', borderRadius: '2px' }}
          />
          <button class="btn-dbg" onClick=${handleSceneSwitch} style=${{ color: '#93c5fd', borderColor: 'rgba(147,197,253,0.25)', background: 'rgba(147,197,253,0.05)', padding: '2px 5px', fontSize: '8.5px' }}>切换</button>

          <span style=${{ borderLeft: '1px dotted rgba(255,255,255,0.15)', height: '10px', margin: '0 4px' }}></span>

          <!-- 📍 直接修改坐标 -->
          <span style=${{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>📍 坐标:</span>
          <input 
            type="number" 
            id="input-coord-x"
            placeholder="X" 
            value=${inputCoordX} 
            onInput=${(e) => setInputCoordX(e.target.value)} 
            style=${{ background: '#08080c', border: '1px solid rgba(255,255,255,0.06)', color: '#00ff9d', fontSize: '8.5px', padding: '2px 4px', width: '30px', outline: 'none', textAlign: 'center', borderRadius: '2px' }}
          />
          <input 
            type="number" 
            id="input-coord-y"
            placeholder="Y" 
            value=${inputCoordY} 
            onInput=${(e) => setInputCoordY(e.target.value)} 
            style=${{ background: '#08080c', border: '1px solid rgba(255,255,255,0.06)', color: '#00ff9d', fontSize: '8.5px', padding: '2px 4px', width: '30px', outline: 'none', textAlign: 'center', borderRadius: '2px' }}
          />
          <select 
            id="select-coord-half"
            value=${inputCoordHalf} 
            onChange=${(e) => setInputCoordHalf(parseInt(e.target.value, 10))} 
            style=${{ background: '#08080c', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: '8.5px', padding: '2px 2px', outline: 'none', width: '36px', cursor: 'pointer', borderRadius: '2px' }}
          >
            <option value="0">全</option>
            <option value="1">半</option>
          </select>
          <button class="btn-dbg" onClick=${handleModifyCoords} style=${{ color: 'var(--glow-green)', borderColor: 'rgba(0,255,157,0.25)', background: 'rgba(0,255,157,0.05)', padding: '2px 5px', fontSize: '8.5px' }}>修改</button>
        </div>

        <div style=${{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
          <button class="btn-dbg" onClick=${() => window.openMapModal?.()} style=${{ color: 'var(--glow-blue)', borderColor: 'rgba(0, 225, 255, 0.2)', background: 'rgba(0, 225, 255, 0.03)', padding: '2px 6px', fontSize: '8.5px' }}>🗺️ 查看地图</button>
          <button class="btn-dbg" onClick=${() => setShowCoordsPanel(!showCoordsPanel)} style=${{ color: 'var(--glow-yellow)', borderColor: 'rgba(255,208,0,0.2)', background: 'rgba(255,208,0,0.03)', padding: '2px 6px', fontSize: '8.5px' }}>📝 坐标管理</button>
        </div>
      </div>

      <!-- 💾 存档控制器 -->
      <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', borderTop: '1px dotted rgba(255,255,255,0.03)', paddingTop: '5px' }}>
        <div style=${{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style=${{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>💾 存档控制:</span>
          <input 
            type="number" 
            min="1" 
            value=${saveSlotId} 
            onInput=${(e) => setSaveSlotId(parseInt(e.target.value, 10))} 
            style=${{ background: '#08080c', border: '1px solid rgba(255,255,255,0.06)', color: '#ffff00', fontSize: '8.5px', padding: '2px 4px', width: '40px', outline: 'none', textAlign: 'center', borderRadius: '2px' }}
          />
          <button class="btn-dbg" onClick=${() => window.debugLoadGame?.(saveSlotId)} style=${{ color: '#93c5fd', borderColor: 'rgba(147,197,253,0.25)', background: 'rgba(147,197,253,0.05)', padding: '2px 5px', fontSize: '8.5px' }}>读取</button>
          <button class="btn-dbg" onClick=${() => window.debugSaveGame?.(saveSlotId)} style=${{ color: 'var(--glow-green)', borderColor: 'rgba(0,255,157,0.25)', background: 'rgba(0,255,157,0.05)', padding: '2px 5px', fontSize: '8.5px' }}>保存</button>
        </div>
        <button class="btn-dbg" onClick=${() => window.debugSaveGameInstant?.()} style=${{ color: 'var(--glow-yellow)', borderColor: 'rgba(255,208,0,0.2)', background: 'rgba(255,208,0,0.03)', padding: '2px 6px', fontSize: '8.5px', marginLeft: 'auto' }}>⚡ 立即保存 (新槽位)</button>
      </div>

      <!-- 📝 坐标管理面板 -->
      ${showCoordsPanel && html`
        <div id="coords-manager-panel" style=${{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.04)', padding: '6px', borderRadius: '2px', marginTop: '2px' }}>
          <div style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dotted rgba(255, 255, 255, 0.05)', paddingBottom: '2px', marginBottom: '2px' }}>
            <span style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>编辑快捷传送点坐标 (JSON 数组)</span>
            <span style=${{ fontSize: '8px', color: 'rgba(0,255,157,0.5)' }}>localStorage 实时持久化</span>
          </div>
          <textarea id="textarea-coords" style=${{ width: '100%', height: '80px', background: '#050508', border: '1px solid rgba(255,255,255,0.08)', color: '#00ff9d', fontFamily: "'JetBrains Mono', monospace", fontSize: '8px', outline: 'none', padding: '4px', resize: 'vertical', lineHeight: '1.3' }} placeholder="请输入 JSON 坐标配置数组..."></textarea>
          <div style=${{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '2px' }}>
            <button onClick=${handleSaveCoords} class="btn-dbg" style=${{ color: 'var(--glow-green)', borderColor: 'rgba(0,255,157,0.25)', background: 'rgba(0,255,157,0.05)', padding: '2px 6px', fontSize: '8px' }}>💾 保存配置</button>
            <button onClick=${handleResetCoords} class="btn-dbg" style=${{ color: 'var(--glow-red)', borderColor: 'rgba(255,59,111,0.25)', background: 'rgba(255,59,111,0.05)', padding: '2px 6px', fontSize: '8px' }}>🔄 恢复默认</button>
          </div>
        </div>
      `}
    </div>

    <!-- 横栏六：💻 并行脚本指令流终端 ＆ 系统极客剖析指标 -->
    <div class="terminal-section" style=${{ borderTop: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div class="section-header" style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', padding: '5px 8px' }}>
        <span style=${{ fontSize: '9px', fontWeight: 'bold' }}>💻 并行脚本指令流终端 (Active Threads Console)</span>
        <div style=${{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span id="label-log-filter-mode" style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.5)' }}>${logFilterModeText}</span>
          <label style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            容量限制:
            <select value=${logLimit} onChange=${(e) => { setLogLimit(e.target.value); window.changeLogLimit?.(e.target.value); }} style=${{ background: '#111', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '8px', borderRadius: '2px', padding: '1px 2px', cursor: 'pointer', outline: 'none' }}>
              <option value="100">100 条</option>
              <option value="200">200 条</option>
              <option value="500">500 条</option>
              <option value="1000">1000 条</option>
            </select>
          </label>
          <button id="btn-toggle-all-logs" onClick=${() => { window.toggleShowAllScriptLogs?.(); }} style=${{ background: showAllLogs ? 'rgba(255,208,0,0.16)' : 'rgba(0, 225, 255, 0.08)', border: '1px solid rgba(0, 225, 255, 0.2)', color: showAllLogs ? 'var(--glow-yellow)' : 'var(--glow-blue)', padding: '1px 6px', fontSize: '8px', fontWeight: 'bold', borderRadius: '2px', cursor: 'pointer', outline: 'none' }}>
            ${showAllLogs ? '普通日志' : '全部日志'}
          </button>
          <button onClick=${() => window.clearScriptLogs?.()} style=${{ background: 'rgba(255, 59, 111, 0.12)', border: '1px solid rgba(255, 59, 111, 0.25)', color: 'var(--glow-red)', padding: '1px 6px', fontSize: '8px', fontWeight: 'bold', borderRadius: '2px', cursor: 'pointer', outline: 'none' }}>🗑️ 清空日志</button>
        </div>
      </div>
      
      <!-- 系统分析极客标签面板 -->
      <div class="profiler-header" style=${{ display: 'flex', flexWrap: 'wrap', gap: '2px', background: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderBottom: '1px solid var(--border-glass)' }}>
        <div class="prof-badge">Render: <span>${renderSize}</span></div>
        <div class="prof-badge">Back Ref: <span>${profBackRef}</span></div>
        <div class="prof-badge">Stage Ref: <span>${profStageRef}</span></div>
        <div class="prof-badge">Talk Ref: <span>${profTalkRef}</span></div>
        <div class="prof-badge">Render Density: <span>${profRenderDensity}</span></div>
        <div class="prof-badge">File Cache: <span>${profFileCache}</span></div>
        <div class="prof-badge">Resource Cache: <span>${profResCache}</span></div>
        <div class="prof-badge">Active Threads: <span>${profThreads}</span></div>
        <div class="prof-badge">Active Timers: <span>${profTimers}</span></div>
        <div class="prof-badge">Timer Pause: <span style=${{ color: 'var(--glow-green)' }}>${profTimerPause}</span></div>
        <div class="prof-badge">Timer Seq: <span>${profTimerSeq}</span></div>
      </div>
      
      <!-- 指令日志外层限高 stream -->
      <div class="log-stream" ref=${terminalLogsRef} id="container-logs-wrapper" style=${{ height: '110px', overflowY: 'auto', background: '#050508' }}>
        <div class="log-stream-inner" id="container-logs" style=${{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '4px' }}>
          ${logs.length === 0 ? html`<div style=${{ color: 'rgba(255,255,255,0.15)', fontSize: '8.5px' }}>等待并行脚本指令执行日志流式输入...</div>` : logs.map((log, i) => html`
            <div key=${i} dangerouslySetInnerHTML=${{ __html: log.html || log }} style=${{ fontSize: '8px', fontFamily: "'JetBrains Mono', monospace", lineHeight: '1.2' }}></div>
          `)}
        </div>
      </div>
    </div>

    <!-- 调试扩展：🐛 剧情脚本单步调试器 (Step Debugger) -->
    <div style=${{ borderTop: '1px solid var(--border-glass)', background: 'rgba(0,0,0,0.3)', padding: '5px 8px', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
      <div style=${{ display: 'flex', justifyScontent: 'space-between', alignItems: 'center', borderBottom: '1px dotted rgba(255,255,255,0.03)', paddingBottom: '2px' }}>
        <span style=${{ fontSize: '9px', fontWeight: 'bold', color: 'var(--glow-yellow)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style=${{ width: '4px', height: '4px', background: 'var(--glow-yellow)', borderRadius: '50%', display: 'inline-block' }}></span>
          🐛 剧情脚本单步调试器 (Active Thread Step Debugger)
        </span>
        <span id="step-dbg-indicator" style=${{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>${stepIndicator}</span>
      </div>
      <div style=${{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <label style=${{ fontSize: '8.5px', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" id="check-step-debug" checked=${stepDebugEnabled} onChange=${(e) => { setStepDebugEnabled(e.target.checked); window.toggleStepDebug?.(e.target.checked); }} style=${{ accentColor: 'var(--glow-green)' }}></input>
          启用单步拦截 (Step Mode)
        </label>
        <div style=${{ display: 'flex', gap: '4px' }}>
          <button class="btn-dbg" id="btn-next-step" onClick=${() => window.executeNextStep?.()} style=${{ color: 'var(--glow-green)', borderColor: 'rgba(0,255,157,0.15)', padding: '2px 5px', fontSize: '8.5px' }}>⬇️ 下一步 (Next)</button>
          <button class="btn-dbg" id="btn-resume-run" onClick=${() => window.resumeRunning?.()} style=${{ color: 'var(--glow-blue)', borderColor: 'rgba(0,225,255,0.15)', padding: '2px 5px', fontSize: '8.5px' }}>▶️ 恢复 (Resume)</button>
        </div>
      </div>
      <!-- 当前挂起指令详情高亮气泡 -->
      ${stepInstruction && html`
        <div id="step-instruction-box" style=${{ display: 'block', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,208,0,0.1)', padding: '3px 5px', borderRadius: '2px', fontSize: '8.5px' }}>
          <span style=${{ color: 'var(--glow-yellow)', fontWeight: 'bold' }}>[暂停于 IP ${stepInstruction.ip}]</span>: 
          <span style=${{ color: 'var(--glow-blue)', fontWeight: 'bold' }}>${stepInstruction.code}</span> ➔ 
          <span style=${{ color: '#fff', fontWeight: 500 }}>${stepInstruction.desc}</span> 
          <span style=${{ color: 'rgba(255,255,255,0.35)' }}>Params: (${stepInstruction.params})</span>
        </div>
      `}
    </div>
  `;
}

// 侧边栏 React Root 惰性挂载器
export function initDashboardRuntime({ drawDecodedSprite, getDetailedItemInfo, scriptLogApi }) {
  const container = document.getElementById('dashboard-inner-root');
  if (container) {
    const root = ReactDOM.createRoot(container);
    root.render(html`
      <${DashboardApp} 
        drawDecodedSprite=${drawDecodedSprite} 
        getDetailedItemInfo=${getDetailedItemInfo} 
        scriptLogApi=${scriptLogApi} 
      />
    `);
  }
}
