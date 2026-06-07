export function initDashboardRuntime({ drawDecodedSprite, getDetailedItemInfo, scriptLogApi }) {
  let selectedItemId = null;
  let lastOwnItemsStr = '';
  let lastRefreshDashboardTime = null;
  let loadMgoFn = null;
  let loadBallFn = null;

  const renderScriptLogs = scriptLogApi?.renderScriptLogs || (() => {});
  const syncScriptLogFilterView = scriptLogApi?.syncScriptLogFilterView || (() => {});
  const appendScriptLog = scriptLogApi?.appendScriptLog || (() => {});

  import('../resources/pal.js').then(({ loadMgo, loadBall }) => {
    loadMgoFn = loadMgo;
    loadBallFn = loadBall;
  });

  function drawBattleSprite(canvasEl, spriteData, frameIndex) {
    if (!canvasEl || !spriteData) {
      return;
    }

    const ctx = canvasEl.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    import('../battle/battleData.js').then(({ loadSpriteFrame }) => {
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
      // 忽略帧越界等导致的绘制错误
    });
  }

  // 步骤 1：根据当前战斗状态刷新参战双方的统计卡片和精灵帧预览。
  function updateBattleDashboard() {
    const battleState = window.Battle.getBattleState();
    if (!battleState || !battleState.isBattleRunning) {
      return;
    }

    document.getElementById('battle-val-id').innerText = battleState.battleId;
    document.getElementById('battle-val-bg').innerText = battleState.battlefieldId !== undefined ? battleState.battlefieldId : '-';
    document.getElementById('battle-val-turn').innerText = battleState.turn;
    document.getElementById('battle-val-density').innerText = battleState.players.length + battleState.enemies.length + ' 战力';

    const phaseNames = { select: '指令选择 (SELECT)', action: '结算行动 (ACTION)', end: '战斗结束 (END)' };
    document.getElementById('battle-phase-badge').innerText = phaseNames[battleState.phase] || battleState.phase;

    const playersContainer = document.getElementById('battle-players-container');
    playersContainer.innerHTML = '';

    battleState.players.forEach((player, index) => {
      const card = document.createElement('div');
      card.className = 'battle-actor-card';
      if (player.hp <= 0) {
        card.className += ' dead-actor';
      }
      if (battleState.phase === 'select' && battleState.activePlayerIndex === index) {
        card.className += ' active-turn';
      }

      let actionText = '待命 (STANDBY)';
      if (player.action) {
        actionText = player.action.type === 'attack' ? `🗡️ 物理攻击 -> 怪 #${player.action.target + 1}` : '🔮 施法/合击';
      }

      const hpPct = Math.min(100, Math.max(0, player.hp / player.maxHp * 100));
      const mpPct = Math.min(100, Math.max(0, player.mp / player.maxMp * 100));

      card.innerHTML = `
        <div class="battle-actor-header">
          <span class="battle-actor-name-lbl" style="color: var(--glow-blue);">${player.name}</span>
          <span class="battle-actor-action-lbl">${actionText}</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 8px; color: rgba(255,255,255,0.4);">
          <span>HP: ${player.hp}/${player.maxHp}</span>
        </div>
        <div class="battle-bar-outer">
          <div class="battle-bar-inner battle-hp-bar" style="width: ${hpPct}%;"></div>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 8px; color: rgba(255,255,255,0.4);">
          <span>MP: ${player.mp}/${player.maxMp}</span>
        </div>
        <div class="battle-bar-outer">
          <div class="battle-bar-inner battle-mp-bar" style="width: ${mpPct}%;"></div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin-top: 2px;">
          <div class="hero-attr-chip" style="padding: 1px 3px;"><span class="hero-attr-lbl">攻</span><span class="hero-attr-val" style="font-size: 8px; color: var(--glow-green);">${player.attackStrength}</span></div>
          <div class="hero-attr-chip" style="padding: 1px 3px;"><span class="hero-attr-lbl">防</span><span class="hero-attr-val" style="font-size: 8px; color: var(--glow-blue);">${player.defense}</span></div>
          <div class="hero-attr-chip" style="padding: 1px 3px;"><span class="hero-attr-lbl">速</span><span class="hero-attr-val" style="font-size: 8px; color: var(--glow-yellow);">${player.dexterity}</span></div>
        </div>
        <div style="display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.02); height: 50px; border-radius: 1px; margin-top: 2px;">
          <canvas id="battle-player-sprite-${index}" width="48" height="48" style="image-rendering: pixelated; width: 48px; height: 48px;"></canvas>
        </div>
      `;

      playersContainer.appendChild(card);

      setTimeout(() => {
        const canvas = document.getElementById(`battle-player-sprite-${index}`);
        if (canvas && player.spriteData) {
          drawBattleSprite(canvas, player.spriteData, player.currentFrame);
        }
      }, 10);
    });

    const enemiesContainer = document.getElementById('battle-enemies-container');
    enemiesContainer.innerHTML = '';

    battleState.enemies.forEach((enemy, index) => {
      const card = document.createElement('div');
      card.className = 'battle-actor-card';
      if (enemy.hp <= 0) {
        card.className += ' dead-actor';
      }

      const hpPct = Math.min(100, Math.max(0, enemy.hp / enemy.maxHp * 100));

      card.innerHTML = `
        <div class="battle-actor-header">
          <span class="battle-actor-name-lbl" style="color: #ff3b6f;">怪 #${enemy.id} : ${enemy.name}</span>
          <span class="battle-actor-action-lbl" style="background: rgba(255, 59, 111, 0.1); color: #ff3b6f; font-size: 7px;">(${enemy.x}, ${enemy.y})</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 8px; color: rgba(255,255,255,0.4);">
          <span>HP: ${enemy.hp}/${enemy.maxHp}</span>
        </div>
        <div class="battle-bar-outer">
          <div class="battle-bar-inner battle-hp-bar" style="width: ${hpPct}%;"></div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; margin-top: 2px;">
          <div class="hero-attr-chip" style="padding: 1px 3px;"><span class="hero-attr-lbl">攻</span><span class="hero-attr-val" style="font-size: 8px; color: var(--glow-green);">${enemy.attackStrength}</span></div>
          <div class="hero-attr-chip" style="padding: 1px 3px;"><span class="hero-attr-lbl">防</span><span class="hero-attr-val" style="font-size: 8px; color: var(--glow-blue);">${enemy.defense}</span></div>
          <div class="hero-attr-chip" style="padding: 1px 3px;"><span class="hero-attr-lbl">速</span><span class="hero-attr-val" style="font-size: 8px; color: var(--glow-yellow);">${enemy.dexterity}</span></div>
        </div>
        <div style="display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.02); height: 50px; border-radius: 1px; margin-top: 2px;">
          <canvas id="battle-enemy-sprite-${index}" width="48" height="48" style="image-rendering: pixelated; width: 48px; height: 48px;"></canvas>
        </div>
      `;

      enemiesContainer.appendChild(card);

      setTimeout(() => {
        const canvas = document.getElementById(`battle-enemy-sprite-${index}`);
        if (canvas && enemy.spriteData) {
          drawBattleSprite(canvas, enemy.spriteData, enemy.currentFrame);
        }
      }, 10);
    });
  }

  function inspectItem(itemId) {
    const info = getDetailedItemInfo(itemId);
    document.getElementById('ins-item-name').innerText = `🏷️ 物品解码: ${info.name}`;
    document.getElementById('ins-val-id').innerText = itemId;
    document.getElementById('ins-val-role').innerText = info.role;
    document.getElementById('ins-val-buy').innerText = info.buy;
    document.getElementById('ins-val-sell').innerText = info.sell;
    document.getElementById('ins-val-type').innerText = info.type;
    document.getElementById('ins-val-slot').innerText = info.slot;
    document.getElementById('ins-val-atk').innerText = info.atk;
    document.getElementById('ins-val-def').innerText = info.def;
    document.getElementById('ins-val-spd').innerText = info.spd;
    document.getElementById('ins-val-mag').innerText = info.mag;
    document.getElementById('ins-val-lck').innerText = info.lck;
    document.getElementById('ins-val-usescr').innerText = info.usescr;
    document.getElementById('ins-val-equscr').innerText = info.equscr;
    document.getElementById('ins-val-dropscr').innerText = info.dropscr;
    document.getElementById('ins-val-flags').innerText = info.flags;
    document.getElementById('ins-val-res').innerText = info.res;
    document.getElementById('ins-val-offset').innerText = info.offset;

    if (!loadBallFn) {
      drawDecodedSprite(null, 'canvas-item-ball');
      return;
    }

    try {
      const ballCanvas = loadBallFn(itemId);
      if (ballCanvas) {
        drawDecodedSprite(ballCanvas, 'canvas-item-ball', 'Ball: #' + itemId);
      } else {
        drawDecodedSprite(null, 'canvas-item-ball');
      }
    } catch (error) {
      console.error('加载物品图片失败', error);
      drawDecodedSprite(null, 'canvas-item-ball');
    }
  }

  // 步骤 2：统一刷新场景面板、背包、NPC、Profiler 与战斗视图之间的联动显示。
  function refreshDashboard() {
    const state = window.state;
    if (!state) {
      return;
    }

    if (state.currentMode === 'battle' && window.Battle && typeof window.Battle.getBattleState === 'function') {
      document.getElementById('map-narrative-panels').style.display = 'none';
      document.getElementById('battle-panels').style.display = 'flex';
      updateBattleDashboard();
      return;
    }

    document.getElementById('map-narrative-panels').style.display = 'flex';
    document.getElementById('battle-panels').style.display = 'none';

    document.getElementById('val-scene-id').innerText = state.sceneId;
    document.getElementById('val-map-id').innerText = '0x' + state.mapId.toString(16).toUpperCase() + ` (${state.mapId})`;
    document.getElementById('val-tile-pos').innerText = `(${state.mx}, ${state.my})` + (state.mhalf ? ' +0.5' : '');
    document.getElementById('val-pixel-pos').innerText = `(${state.mapX}, ${state.mapY})`;

    const coordX = document.getElementById('input-coord-x');
    const coordY = document.getElementById('input-coord-y');
    const coordHalf = document.getElementById('select-coord-half');
    if (coordX && document.activeElement !== coordX) coordX.value = state.mx;
    if (coordY && document.activeElement !== coordY) coordY.value = state.my;
    if (coordHalf && document.activeElement !== coordHalf) coordHalf.value = state.mhalf;

    const rangeSize = state.endEventId - state.startEventId;
    document.getElementById('val-event-range').innerText = `${state.startEventId} ➔ ${state.endEventId}`;
    document.getElementById('val-range-size').innerText = rangeSize;

    let npcCount = 0;
    const trigModeCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
      const eventObject = state.eventObjects[i];
      if (eventObject && eventObject.mgoId !== 0) {
        npcCount++;
        if (typeof eventObject.trigMode === 'number') {
          trigModeCount[eventObject.trigMode] = (trigModeCount[eventObject.trigMode] || 0) + 1;
        }
      }
    }

    document.getElementById('val-event-density').innerText = (npcCount / (rangeSize || 1)).toFixed(2);

    import('../app.js').then(appModule => {
      const timeStr = new Date().toTimeString().split(' ')[0];
      document.getElementById('val-last-sync').innerText = `${timeStr} | ${appModule.lastMainLoopTime}ms | ${lastRefreshDashboardTime}ms`;
    });

    const modesContainer = document.getElementById('container-modes');
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

    let modesHtml = '';
    Object.keys(trigModeCount).forEach(mode => {
      const count = trigModeCount[mode];
      if (count > 0) {
        modesHtml += `<span class="stat-mode-badge">${trigNames[mode] || ('Mode-' + mode)}: <span>${count}</span></span>`;
      }
    });
    modesContainer.innerHTML = modesHtml || '<span style="color:rgba(255,255,255,0.15); font-size:8px;">暂无活跃触发模式统计</span>';

    const isCheated = state.money > 2000;
    document.getElementById('val-attr-lv').innerText = isCheated ? '99' : '1';
    document.getElementById('val-attr-hp').innerText = isCheated ? '999' : '100';
    document.getElementById('val-attr-maxhp').innerText = isCheated ? '999' : '100';
    document.getElementById('val-attr-mp').innerText = isCheated ? '999' : '80';
    document.getElementById('val-attr-maxmp').innerText = isCheated ? '999' : '80';
    document.getElementById('val-attr-atk').innerText = isCheated ? '640' : '45';
    document.getElementById('val-attr-def').innerText = isCheated ? '480' : '30';
    document.getElementById('val-attr-spd').innerText = isCheated ? '320' : '22';
    document.getElementById('val-attr-lck').innerText = isCheated ? '220' : '15';
    document.getElementById('val-attr-mag').innerText = isCheated ? '350' : '28';
    document.getElementById('val-attr-poi').innerText = isCheated ? '100%' : '5%';
    document.getElementById('val-attr-r-fire').innerText = isCheated ? '85%' : '10%';
    document.getElementById('val-attr-r-thunder').innerText = isCheated ? '85%' : '10%';
    document.getElementById('val-attr-r-water').innerText = isCheated ? '85%' : '10%';
    document.getElementById('val-attr-r-wind').innerText = isCheated ? '85%' : '10%';
    document.getElementById('val-attr-r-earth').innerText = isCheated ? '85%' : '10%';

    const role = state.party[0] || state.roles[0];
    if (role && loadMgoFn) {
      try {
        const heroCanvas = loadMgoFn(role.tileId || 0, role.frame || 0);
        document.getElementById('val-hero-desc').innerText = `Tile: ${role.tileId || 0} F: ${role.frame || 0}`;
        if (heroCanvas) {
          drawDecodedSprite(heroCanvas, 'canvas-hero-sprite');
        }
      } catch (error) {
        console.error('加载主角当前迈步像素立绘失败', error);
      }
    }

    let dirText = '下 (0)';
    if (role.dir === 1) dirText = '左 (1)';
    else if (role.dir === 2) dirText = '上 (2)';
    else if (role.dir === 3) dirText = '右 (3)';

    document.getElementById('val-attr-dir').innerText = dirText;
    document.getElementById('val-attr-layer').innerText = role.layer || '0';
    document.getElementById('val-attr-state').innerText = '正常';
    document.getElementById('val-attr-state').style.color = 'var(--glow-green)';
    document.getElementById('val-attr-gold').innerText = `${state.money || 0} 文`;
    document.getElementById('val-attr-exp').innerText = isCheated ? '99999' : '45';
    document.getElementById('val-attr-next').innerText = isCheated ? '0' : '120';
    document.getElementById('val-attr-eq-wp').innerText = isCheated ? '无极宝剑 (+120)' : '生锈铁剑 (+5)';
    document.getElementById('val-attr-eq-ar').innerText = isCheated ? '天蚕宝甲 (+85)' : '粗布麻衣 (+3)';

    const itemsContainer = document.getElementById('container-items');
    const ownItems = state.ownItems || [];
    const currentOwnItemsStr = JSON.stringify(ownItems);

    if (itemsContainer) {
      if (lastOwnItemsStr !== currentOwnItemsStr) {
        // 步骤 1：仅当物品内容或数量发生改变时，执行完整的 innerHTML 重绘
        lastOwnItemsStr = currentOwnItemsStr;
        itemsContainer.innerHTML = '';

        for (let i = 0; i < Math.max(20, ownItems.length); i++) {
          const slot = document.createElement('div');
          slot.className = 'bag-slot';

          if (i < ownItems.length) {
            const itemId = ownItems[i];
            slot.setAttribute('data-item-id', itemId);
            slot.innerHTML = `道具 #${itemId}`;

            if (selectedItemId === itemId) {
              slot.classList.add('active');
            }

            slot.onmouseenter = () => inspectItem(itemId);
            slot.onclick = () => {
              selectedItemId = itemId;
              refreshDashboard();
              inspectItem(itemId);
            };
            slot.ondblclick = () => {
              if (state.items && state.items[itemId]) {
                import('../engine/script.js').then(({ Script }) => {
                  Script.startItemScript(state.items[itemId]);
                });
              }
            };
          } else {
            slot.innerHTML = '<span style="color: rgba(255,255,255,0.04)">-</span>';
          }

          itemsContainer.appendChild(slot);
        }
      } else {
        // 步骤 2：若物品列表内容未变，仅切换选中类名，防止滚动条重置与无谓的 DOM 回流
        Array.from(itemsContainer.children).forEach(slot => {
          const itemIdAttr = slot.getAttribute('data-item-id');
          if (itemIdAttr) {
            const itemId = parseInt(itemIdAttr, 10);
            const isSelected = selectedItemId === itemId;
            const hasActive = slot.classList.contains('active');
            if (isSelected !== hasActive) {
              slot.classList.toggle('active', isSelected);
            }
          }
        });
      }
    }


    const npcContainer = document.getElementById('container-npcs');
    if (window.lastRenderedSceneId !== state.sceneId) {
      window.lastRenderedSceneId = state.sceneId;
      npcContainer.innerHTML = '';
    }

    const existingCards = {};
    Array.from(npcContainer.children).forEach(child => {
      const npcId = child.getAttribute('data-npc-id');
      if (npcId) {
        existingCards[npcId] = child;
      }
    });

    let npcCountForMicro = 0;
    let currentIdx = 0;

    for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
      const eventObject = state.eventObjects[i];
      if (!eventObject) {
        continue;
      }

      if (window.ONLY_HUMAN_NPC !== false && eventObject.mgoId === 0) {
        continue;
      }
      if (window.ONLY_VISIBLE_NPC === true && eventObject.state === 0) {
        continue;
      }
      if (window.ONLY_HAS_TRIG_NPC === true && eventObject.trigScr === 0) {
        continue;
      }

      npcCountForMicro++;
      let npcCard = existingCards[eventObject.id];
      let stateSpan;
      let posDiv;

      if (!npcCard) {
        npcCard = document.createElement('div');
        npcCard.className = 'npc-micro-card';
        npcCard.setAttribute('data-npc-id', eventObject.id);

        const headDiv = document.createElement('div');
        headDiv.className = 'npc-mc-head';

        const idSpan = document.createElement('span');
        idSpan.innerText = `#${eventObject.id}`;
        headDiv.appendChild(idSpan);

        stateSpan = document.createElement('span');
        stateSpan.className = 'npc-state-span';
        stateSpan.style.fontSize = '7.5px';
        headDiv.appendChild(stateSpan);

        posDiv = document.createElement('div');
        posDiv.className = 'npc-mc-pos';

        npcCard.appendChild(headDiv);
        npcCard.appendChild(posDiv);

        npcCard.onmouseenter = () => {
          document.getElementById('ins-item-name').innerText = `👾 NPC #${eventObject.id} 底层数据解剖`;
          document.getElementById('ins-val-id').innerText = eventObject.id;
          document.getElementById('ins-val-role').innerText = `Role #${eventObject.mgoId}`;
          document.getElementById('ins-val-buy').innerText = '无';
          document.getElementById('ins-val-sell').innerText = '无';
          document.getElementById('ins-val-type').innerText = 'NPC 实体物体';
          document.getElementById('ins-val-atk').innerText = '无';
          document.getElementById('ins-val-def').innerText = '无';
          document.getElementById('ins-val-spd').innerText = `方向: ${eventObject.dir}`;
          document.getElementById('ins-val-mag').innerText = `动作帧: ${eventObject.frame}`;
          document.getElementById('ins-val-lck').innerText = '无';
          document.getElementById('ins-val-autoscr').innerText = eventObject.autoScr ? '0x' + eventObject.autoScr.toString(16).toUpperCase() : '无';
          document.getElementById('ins-val-trigScr').innerText = eventObject.trigScr ? '0x' + eventObject.trigScr.toString(16).toUpperCase() : '无';
          document.getElementById('ins-val-usescr').innerText = eventObject.trigScr ? '0x' + eventObject.trigScr.toString(16).toUpperCase() : '无';
          document.getElementById('ins-val-equscr').innerText = eventObject.equScr ? '0x' + eventObject.equScr.toString(16).toUpperCase() : '无';
          document.getElementById('ins-val-dropscr').innerText = eventObject.dropScr ? '0x' + eventObject.dropScr.toString(16).toUpperCase() : '无';
          document.getElementById('ins-val-flags').innerText = `TrigMode: ${eventObject.trigMode}`;
          document.getElementById('ins-val-consumable').innerText = eventObject.state === 0 ? '隐蔽 (Hidden)' : '活跃 (Active)';
          document.getElementById('ins-val-throw').innerText = '否';
          document.getElementById('ins-val-sellable').innerText = '否';
          document.getElementById('ins-val-res').innerText = `ModRef: ${eventObject.ptrOffset}`;
          document.getElementById('ins-val-offset').innerText = `PX: (${eventObject.x}, ${eventObject.y})`;

          if (eventObject.mgoId !== 0 && loadMgoFn) {
            try {
              const npcCanvas = loadMgoFn(eventObject.mgoId, eventObject.frame);
              if (npcCanvas) {
                drawDecodedSprite(npcCanvas, 'canvas-item-ball', 'NPC: #' + eventObject.mgoId);
              } else {
                drawDecodedSprite(null, 'canvas-item-ball', '无');
              }
            } catch (error) {
              console.error('加载NPC立绘失败', error);
              drawDecodedSprite(null, 'canvas-item-ball', '无');
            }
          } else {
            drawDecodedSprite(null, 'canvas-item-ball', '无');
          }
        };

        npcCard.onclick = () => {
          state.highlightNpcId = state.highlightNpcId === eventObject.id ? null : eventObject.id;
          refreshDashboard();

          if (loadMgoFn) {
            try {
              const npcCanvas = loadMgoFn(eventObject.mgoId, eventObject.frame);
              if (npcCanvas) {
                drawDecodedSprite(npcCanvas, 'canvas-item-ball', 'NPC: #' + eventObject.mgoId);
              }
            } catch (error) {
              // 保持与旧逻辑一致，忽略点选绘制失败
            }
          }
        };

        npcCard.ondblclick = () => {
          const tx = Math.floor(eventObject.x / 32);
          const ty = Math.floor(eventObject.y / 16);
          const thalf = Math.round((eventObject.x - tx * 32) / 16);
          if (window.setRolePos) {
            window.setRolePos(tx, ty, thalf);
            import('./talk.js').then(({ Talk }) => {
              Talk.talkTips(`双击瞬移！已直接传送至 NPC #${eventObject.id} 所在的坐标 (${tx}, ${ty})`);
            });
          }
        };
      } else {
        delete existingCards[eventObject.id];
        stateSpan = npcCard.querySelector('.npc-state-span');
        posDiv = npcCard.querySelector('.npc-mc-pos');
      }

      const isHighlighted = state.highlightNpcId === eventObject.id;
      const hasHighlightedClass = npcCard.classList.contains('highlighted');
      if (isHighlighted !== hasHighlightedClass) {
        npcCard.classList.toggle('highlighted', isHighlighted);
      }

      const stateText = eventObject.state === 0 ? 'S:0' : `S:${eventObject.state} D:${eventObject.dir} F:${eventObject.frame}`;
      const stateColor = eventObject.state ? 'var(--glow-green)' : 'rgba(255,255,255,0.15)';
      if (stateSpan.innerText !== stateText) {
        stateSpan.innerText = stateText;
      }
      if (stateSpan.style.color !== stateColor) {
        stateSpan.style.color = stateColor;
      }

      const posText = `(${Math.floor(eventObject.x / 32)}, ${Math.floor(eventObject.y / 16)})${eventObject.mgoId === 0 ? '' : ' mgo:' + eventObject.mgoId}`;
      if (posDiv.innerText !== posText) {
        posDiv.innerText = posText;
      }

      const currentChild = npcContainer.children[currentIdx];
      if (currentChild !== npcCard) {
        if (currentIdx < npcContainer.children.length) {
          npcContainer.insertBefore(npcCard, currentChild);
        } else {
          npcContainer.appendChild(npcCard);
        }
      }
      currentIdx++;
    }

    Object.values(existingCards).forEach(card => npcContainer.removeChild(card));
    if (npcCountForMicro === 0) {
      npcContainer.innerHTML = '<div style="color:rgba(255,255,255,0.15); font-size:9.5px; padding: 6px 0; grid-column:span 6; text-align:center;">当前场景暂无活跃的事件/NPC实体</div>';
    }

    if (window.updateCount) {
      document.getElementById('prof-back-ref').innerText = window.updateCount[0];
      document.getElementById('prof-stage-ref').innerText = window.updateCount[1];
      document.getElementById('prof-talk-ref').innerText = window.updateCount[2];
      document.getElementById('prof-render-density').innerText = 14 * 20 + npcCount;
    }

    if (window.file_caches) {
      document.getElementById('prof-file-cache').innerText = Object.keys(window.file_caches).length;
    }
    if (window.pal_caches) {
      document.getElementById('prof-res-cache').innerText = Object.keys(window.pal_caches).length;
    }
    if (window.Timer) {
      const debugInfo = window.Timer.DEBUG;
      const timerCount = debugInfo && debugInfo.anims ? Object.keys(debugInfo.anims).length : 0;
      document.getElementById('prof-timers').innerText = timerCount;
      document.getElementById('prof-timer-seq').innerText = debugInfo ? debugInfo.animIndex : 0;
    }

    import('../engine/script.js').then(({ Script }) => {
      document.getElementById('prof-threads').innerText = Script.all ? Script.all.length : 0;
    });

    document.getElementById('prof-timer-pause').innerText = 'No';
    document.getElementById('prof-timer-pause').style.color = 'var(--glow-green)';
    renderScriptLogs();
  }

  function scheduleRefreshDashboard() {
    const start = Date.now();
    refreshDashboard();
    renderScriptLogs();
    lastRefreshDashboardTime = Date.now() - start;
  }

  // 步骤 3：接管运行时广播钩子与定时刷新，让入口页只保留初始化桥接。
  window.refreshDashboard = refreshDashboard;
  window.scheduleRefreshDashboard = scheduleRefreshDashboard;
  window.onSceneUpdate = () => {};
  window.onThreadsUpdate = () => {};
  window.onScriptExecute = (logItemOrArray) => {
    if (Array.isArray(logItemOrArray)) {
      logItemOrArray.forEach(item => {
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
    } else {
      appendScriptLog(logItemOrArray);
    }
  };

  syncScriptLogFilterView(true);
  setInterval(scheduleRefreshDashboard, 200);
}
