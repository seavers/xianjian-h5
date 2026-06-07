export function initScriptLogPanel({ getInstructionDetail }) {
  window.logLimit = 200;
  		window.showAllScriptLogs = false;
  		window.scriptLogStore = [];
  		window.scriptLogStoreMax = 1000;
  		window.lastLogFilterSignature = '';
  		window.scriptMainLogs = []; // 主指令内存池（非auto）
  		window.scriptNpcLogs = {}; // 每个 NPC 独立的分组日志映射表，键为 npcId，值为数组

  		// 根据角色 ID 获取人物/NPC名称 (以支持右侧指令区对 auto 指令的执行 NPC 展示)
  		function getRoleName(mgoId) {
  			if (!mgoId || mgoId <= 0) {
  				return "角色 -";
  			}
  			const names = {};
  			return names[mgoId] || `角色 #${mgoId}`;
  		}

  		// 1. 清空所有指令终端内存池数据并重置 UI 视图
  		function clearScriptLogs() {
  			window.scriptLogStore = [];
  			window.scriptMainLogs = [];
  			window.scriptNpcLogs = {};

  			renderScriptLogs({ force: true });
  		}

  		// 2. 容量限制下拉菜单联动：动态调整并截断主指令池中多出的数据
  		function changeLogLimit(val) {
  			window.logLimit = parseInt(val) || 200;
  			
  			if (window.scriptMainLogs.length > window.logLimit) {
  				window.scriptMainLogs.splice(0, window.scriptMainLogs.length - window.logLimit);
  			}
  			
  			renderScriptLogs({ force: true });
  		}

  		function getSelectedNpcLogId() {
  			const state = window.state;
  			return state && Number.isInteger(state.highlightNpcId) ? state.highlightNpcId : null;
  		}

  		function getScriptLogFilterState() {
  			const selectedNpcId = getSelectedNpcLogId();
  			if (window.showAllScriptLogs) {
  				return { mode: 'all', selectedNpcId };
  			}
  			if (selectedNpcId !== null) {
  				return { mode: 'npc-auto', selectedNpcId };
  			}
  			return { mode: 'non-auto', selectedNpcId: null };
  		}

  		function isSameScriptLog(a, b) {
  			return !!a && !!b &&
  				a.hexCode === b.hexCode &&
  				a.param1 === b.param1 &&
  				a.param2 === b.param2 &&
  				a.param3 === b.param3 &&
  				a.type === b.type &&
  				a.scriptId === b.scriptId &&
  				a.npcId === b.npcId;
  		}

  		function getScriptLogEmptyText() {
  			const filterState = getScriptLogFilterState();
  			if (filterState.mode === 'all') {
  				return '等待全部指令执行日志流式输入...';
  			}
  			if (filterState.mode === 'npc-auto') {
  				return `当前仅展示 NPC #${filterState.selectedNpcId} 的 auto 指令，暂未捕获到执行日志...`;
  			}
  			return '当前默认仅展示非 auto 类型指令...';
  		}

  		function updateScriptLogFilterUI() {
  			const filterState = getScriptLogFilterState();
  			const label = document.getElementById('label-log-filter-mode');
  			const btn = document.getElementById('btn-toggle-all-logs');

  			// 1. 同步顶部文案，让当前过滤模式始终可见
  			if (label) {
  				if (filterState.mode === 'all') {
  					label.innerText = '当前显示全部指令';
  					label.style.color = 'var(--glow-yellow)';
  				} else if (filterState.mode === 'npc-auto') {
  					label.innerText = `当前仅显示 NPC #${filterState.selectedNpcId} 的 auto 指令`;
  					label.style.color = 'var(--glow-green)';
  				} else {
  					label.innerText = '默认仅显示非 auto 指令';
  					label.style.color = 'rgba(255,255,255,0.5)';
  				}
  			}

  			// 2. 同步按钮状态，支持在“显示全部”和“恢复筛选”之间切换
  			if (btn) {
  				btn.innerText = window.showAllScriptLogs ? '恢复筛选' : '显示全部';
  				btn.style.color = window.showAllScriptLogs ? 'var(--glow-yellow)' : 'var(--glow-blue)';
  				btn.style.borderColor = window.showAllScriptLogs ? 'rgba(255,208,0,0.22)' : 'rgba(0,225,255,0.08)';
  				btn.style.background = window.showAllScriptLogs ? 'rgba(255,208,0,0.08)' : 'rgba(0,225,255,0.08)';
  			}
  		}

  		// 为指令终端生成通用的行指令 DOM 节点（宽度 490px / 500px 对齐）
  		function buildScriptLogElement(log, duplicateTimes) {
  			const detailInfo = getInstructionDetail(log.code, log.param1, log.param2, log.param3);

  			const logDiv = document.createElement('div');
  			logDiv.className = `log-item ${log.type}`;
  			logDiv.style.cssText = "position: relative; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 4px; height: 15px; display: flex; align-items: center;";

  			const leftSpan = document.createElement('span');
  			leftSpan.style.cssText = "width: 490px; overflow: hidden; text-overflow: ellipsis; display: inline-flex; align-items: center; white-space: nowrap; flex-shrink: 0;";
  			const objTagHtml = log.objTag ? `<span style="color: #ff9d00; font-weight: bold; font-size: 7.5px; background: rgba(255,157,0,0.1); border: 1px solid rgba(255,157,0,0.25); border-radius: 2px; padding: 0px 3px; margin-right: 3px;">${log.objTag}</span>` : '';
  			leftSpan.innerHTML = `
  				<span class="log-time">${log.time}</span>
  				<span class="log-script-id">[${log.scriptId}]</span>
  				<span class="log-badge ${log.type}">${log.type}</span>
  				${objTagHtml}
  				<span class="log-code">${log.hexCode}</span>: 
  				<span class="log-desc">${log.desc}</span> 
  				<span style="color:rgba(255,255,255,0.18); margin-left: 2px;">(${log.param1}, ${log.param2}, ${log.param3})</span>
  			`;

  			const rightSpan = document.createElement('span');
  			rightSpan.style.cssText = "color: var(--glow-green); font-size: 8px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; position: absolute; left: 490px; text-align: left; width: calc(100% - 500px); display: inline-block; white-space: nowrap;";

  			if (log.type === 'auto') {
  				const roleName = getRoleName(log.mgoId);
  				const npcText = `🤖 NPC #${log.npcId} (${roleName})`;

  				if (detailInfo) {
  					rightSpan.innerHTML = `<span style="color: var(--glow-yellow); font-weight: bold; margin-right: 8px;">${npcText}</span><span style="color: var(--glow-green);">${detailInfo}</span>`;
  				} else {
  					rightSpan.innerHTML = `<span style="color: var(--glow-yellow); font-weight: bold;">${npcText}</span>`;
  				}
  			} else {
  				rightSpan.innerText = detailInfo || '';
  			}

  			if (duplicateTimes > 1) {
  				const badge = document.createElement('span');
  				badge.className = 'dup-badge';
  				badge.style.cssText = "background: var(--glow-yellow); color: #000; font-size: 7.5px; font-weight: 800; padding: 0px 3.5px; margin-left: 6px; border-radius: 2px; flex-shrink: 0; line-height: 11px; height: 11px; display: inline-flex; align-items: center; text-shadow: none;";
  				badge.innerText = `x${duplicateTimes}`;
  				leftSpan.appendChild(badge);
  			}

  			logDiv.appendChild(leftSpan);
  			logDiv.appendChild(rightSpan);
  			return logDiv;
  		}

  		// 6. 重绘核心指令控制终端。根据当前过滤状态提取对应的日志序列在大窗口中统一渲染
  		function renderScriptLogs(options = {}) {
  			const { force = false, stickToBottom = false } = options;
  			const container = document.getElementById('container-logs');
  			const wrapper = document.getElementById('container-logs-wrapper');
  			if (!container) return;

  			// 读取高亮 NPC 和过滤状态
  			const selectedNpcId = getSelectedNpcLogId();
  			const activeNpcCount = Object.keys(window.scriptNpcLogs).length;
  			const filterState = getScriptLogFilterState();

  			// 缓存 Signature 避免频繁重绘
  			const filterSignature = `${filterState.mode}:${selectedNpcId ?? 'none'}:${window.logLimit}:${activeNpcCount}:${window.scriptMainLogs.length}`;
  			if (!force && window.lastLogFilterSignature === filterSignature) {
  				updateScriptLogFilterUI();
  				return;
  			}

  			const shouldStick = wrapper ? (stickToBottom || wrapper.scrollHeight - wrapper.scrollTop - wrapper.clientHeight < 30) : false;
  			container.innerHTML = '';

  			// 步骤 A: 提取需要渲染的日志数据序列
  			let visibleLogs = [];
  			if (filterState.mode === 'all') {
  				// 全部汇总模式：合并主日志与所有 NPC 日志并按时间戳升序排序
  				const allLogs = [...window.scriptMainLogs];
  				for (const npcId in window.scriptNpcLogs) {
  					allLogs.push(...window.scriptNpcLogs[npcId]);
  				}
  				visibleLogs = allLogs
  					.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
  					.slice(-window.logLimit);
  			} else if (filterState.mode === 'npc-auto') {
  				// NPC 专属过滤模式：只提取选中 NPC 的最新 30 条日志
  				visibleLogs = (window.scriptNpcLogs[filterState.selectedNpcId] || []).slice(-30);
  			} else {
  				// 默认模式：只展示非 auto 的主线程日志
  				visibleLogs = window.scriptMainLogs.slice(-window.logLimit);
  			}

  			// 步骤 B: 如果无数据则输出空态提示
  			if (!visibleLogs.length) {
  				container.innerHTML = `<div style="color: rgba(255,255,255,0.15)">${getScriptLogEmptyText()}</div>`;
  				window.lastLogFilterSignature = filterSignature;
  				updateScriptLogFilterUI();
  				return;
  			}

  			// 步骤 C: 相邻行去重合并
  			const mergedLogs = [];
  			for (const log of visibleLogs) {
  				const lastEntry = mergedLogs[mergedLogs.length - 1];
  				if (lastEntry && isSameScriptLog(lastEntry.log, log)) {
  					lastEntry.count++;
  					continue;
  				}
  				mergedLogs.push({ log, count: 1 });
  			}

  			// 步骤 D: 绘制 DOM 元素
  			mergedLogs.forEach(({ log, count }) => {
  				container.appendChild(buildScriptLogElement(log, count));
  			});

  			window.lastLogFilterSignature = filterSignature;
  			updateScriptLogFilterUI();

  			// 步骤 E: 自动跟到底部
  			if (wrapper && shouldStick) {
  				wrapper.scrollTop = wrapper.scrollHeight - wrapper.clientHeight;
  			}
  		}

  		function syncScriptLogFilterView(force = false) {
  			const selectedNpcId = getSelectedNpcLogId();
  			const activeNpcCount = Object.keys(window.scriptNpcLogs).length;
  			const filterState = getScriptLogFilterState();
  			const filterSignature = `${filterState.mode}:${selectedNpcId ?? 'none'}:${window.logLimit}:${activeNpcCount}:${window.scriptMainLogs.length}`;

  			if (!force && window.lastLogFilterSignature === filterSignature) {
  				updateScriptLogFilterUI();
  				return;
  			}
  			renderScriptLogs({ force: true });
  		}

  		function toggleShowAllScriptLogs() {
  			window.showAllScriptLogs = !window.showAllScriptLogs;
  			window.lastLogFilterSignature = '';
  			renderScriptLogs({ force: true, stickToBottom: true });
  		}

  		// 7. 并行指令流单条高速分流追加逻辑
  		function appendScriptLog(log) {
  			window.scriptLogStore.push(log);
  			if (window.scriptLogStore.length > window.scriptLogStoreMax) {
  				window.scriptLogStore.shift();
  			}

  			// 将日志分流至主指令或 NPC 独立池中
  			if (log.type !== 'auto') {
  				window.scriptMainLogs.push(log);
  				const currentLimit = window.logLimit || 200;
  				if (window.scriptMainLogs.length > currentLimit) {
  					window.scriptMainLogs.shift();
  				}

  				renderScriptLogs({ force: true, stickToBottom: true });
  			} else {
  				const npcId = log.npcId;
  				if (!window.scriptNpcLogs[npcId]) {
  					window.scriptNpcLogs[npcId] = [];
  				}
  				window.scriptNpcLogs[npcId].push(log);
  				if (window.scriptNpcLogs[npcId].length > 30) {
  					window.scriptNpcLogs[npcId].shift();
  				}
  			}

  			// renderScriptLogs({ force: true, stickToBottom: true });
  		}

		window.clearScriptLogs = clearScriptLogs;
		window.changeLogLimit = changeLogLimit;
		window.toggleShowAllScriptLogs = toggleShowAllScriptLogs;
		window.renderScriptLogs = renderScriptLogs;
		window.syncScriptLogFilterView = syncScriptLogFilterView;
		window.appendScriptLog = appendScriptLog;

		return {
			renderScriptLogs,
			syncScriptLogFilterView,
			appendScriptLog
		};
}
