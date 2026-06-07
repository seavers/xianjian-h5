export function initMapModal() {
  // ==================== 🗺️ 场景大地图瞬移定位器逻辑 ====================
  		let mapCanvasCache = null;
  		let mapCacheId = null;
  		let mapZoomLevel = 0.5;

  		// 开启地图查看模态弹窗
  		function openMapModal() {
  			document.getElementById('map-modal').style.display = 'flex';
  			refreshMapModal();
  		}

  		// 关闭地图查看模态弹窗
  		function closeMapModal() {
  			document.getElementById('map-modal').style.display = 'none';
  		}

  		// 设置大地图的显示缩放比例
  		function setMapZoom(zoom) {
  			mapZoomLevel = zoom;
  			const canvas = document.getElementById('map-modal-canvas');
  			
  			if (canvas) {
  				canvas.style.width = (canvas.width * zoom) + 'px';
  				canvas.style.height = (canvas.height * zoom) + 'px';
  			}
  			
  			document.querySelectorAll('.map-zoom-btn').forEach(btn => btn.classList.remove('active'));
  			if (zoom === 0.25) {
  				document.getElementById('btn-map-zoom-1').classList.add('active');
  			} else if (zoom === 0.5) {
  				document.getElementById('btn-map-zoom-2').classList.add('active');
  			} else if (zoom === 1.0) {
  				document.getElementById('btn-map-zoom-3').classList.add('active');
  			}
  		}

  		// 刷新并重绘大地图内容
  		function refreshMapModal() {
  			const state = window.state;
  			if (!state) {
  				return;
  			}

  			const mapId = state.mapId;
  			document.getElementById('map-modal-info').innerText = `地图: 0x${mapId.toString(16).toUpperCase()} (${mapId}) | 主角坐标: (${state.mx}, ${state.my})${state.mhalf ? ' +0.5' : ''}`;

  			import('../resources/pal.js').then(({ loadMap, loadGop, u9s }) => {
  				const canvas = document.getElementById('map-modal-canvas');
  				if (!canvas) {
  					return;
  				}
  				const ctx = canvas.getContext('2d');

  				// 步骤 1：若大地图ID变更，则重新解析大地图瓦片并渲染到底图缓存 canvas 中
  				if (!mapCanvasCache || mapCacheId !== mapId) {
  					const data = loadMap(mapId);
  					if (!data) {
  						return;
  					}

  					const cacheCanvas = document.createElement('canvas');
  					cacheCanvas.width = 2112;
  					cacheCanvas.height = 2112;
  					const cacheCtx = cacheCanvas.getContext('2d');

  					const offsetX = 32;
  					const offsetY = 32;

  					// 双重循环遍历绘制 128x128 的瓦片拼图
  					for (let y = 0; y < 128; y++) {
  						for (let x = 0; x < 128; x++) {
  							const posX = 16 * x;
  							const posY = 16 * y + (x % 2 === 0 ? 0 : 8);
  							const index = y * 128 + x;

  							// 渲染第一层背景瓦片
  							const tileId1 = u9s(data, index);
  							const img1 = loadGop(mapId, tileId1);
  							if (img1) {
  								cacheCtx.drawImage(img1, posX - 16 + offsetX, posY - 8 + offsetY);
  							}

  							// 渲染第二层覆盖瓦片（如有）
  							let tileId2 = u9s(data, index, 2);
  							tileId2--;
  							if (tileId2 !== -1) {
  								const img2 = loadGop(mapId, tileId2);
  								if (img2) {
  									cacheCtx.drawImage(img2, posX - 16 + offsetX, posY - 8 + offsetY);
  								}
  							}
  						}
  					}
  					mapCanvasCache = cacheCanvas;
  					mapCacheId = mapId;
  				}

  				// 重置实际绘制 canvas 尺寸
  				canvas.width = 2112;
  				canvas.height = 2112;

  				// 步骤 2：先绘制缓存好的大地图底图
  				ctx.drawImage(mapCanvasCache, 0, 0);

  				// 步骤 3：遍历当前场景事件实体，在地图上绘制 NPC 和事件触发位置
  				const offsetX = 32;
  				const offsetY = 32;
  				for (let i = state.startEventId + 1; i <= state.endEventId; i++) {
  					const o = state.eventObjects[i];
  					if (o && o.state > 0) {
  						const cx = o.x + offsetX;
  						const cy = o.y + offsetY;

  						ctx.beginPath();
  						ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  						ctx.fillStyle = o.mgoId === 0 ? '#ff3b6f' : '#ffd000'; // 机关类用红，人物角色用黄
  						ctx.fill();
  						ctx.closePath();

  						ctx.font = '9px sans-serif';
  						ctx.fillStyle = '#ffffff';
  						ctx.fillText(`#${o.id}`, cx + 6, cy + 3);
  					}
  				}

  				// 步骤 4：在地图上绘制主角当前的绝对像素坐标标识点
  				const px = state.mapX + offsetX;
  				const py = state.mapY + offsetY;

  				ctx.beginPath();
  				ctx.arc(px, py, 6, 0, Math.PI * 2);
  				ctx.fillStyle = '#00ff9d'; // 主角使用专属的明亮绿
  				ctx.fill();
  				ctx.lineWidth = 2;
  				ctx.strokeStyle = '#ffffff';
  				ctx.stroke();
  				ctx.closePath();

  				// 同步缩放样式
  				setMapZoom(mapZoomLevel);
  			});
  		}

  		// 挂载到全局 window 作用域以便 onclick 访问
  		window.openMapModal = openMapModal;
  		window.closeMapModal = closeMapModal;
  		window.setMapZoom = setMapZoom;
  		window.refreshMapModal = refreshMapModal;

  		// 步骤 5：立即为地图 Canvas 绑定鼠标交互监听器以实现坐标定位与悬浮提示
  		(() => {
  			const mapCanvas = document.getElementById('map-modal-canvas');
  			if (mapCanvas) {
  				// 点击瞬间移动主角
  				mapCanvas.addEventListener('click', (event) => {
  					const rect = mapCanvas.getBoundingClientRect();
  					const clickX = (event.clientX - rect.left) / mapZoomLevel;
  					const clickY = (event.clientY - rect.top) / mapZoomLevel;

  					const mapX = clickX - 32;
  					const mapY = clickY - 32;

  					let mx = Math.floor(mapX / 32);
  					let my = Math.floor(mapY / 16);
  					let mhalf = Math.round((mapX - mx * 32) / 16);

  					if (mhalf < 0) mhalf = 0;
  					if (mhalf > 1) mhalf = 1;
  					if (mx < 0) mx = 0;
  					if (mx > 127) mx = 127;
  					if (my < 0) my = 0;
  					if (my > 127) my = 127;

  					if (window.setRolePos) {
  						window.setRolePos(mx, my, mhalf);
  						Promise.all([
  							import('./talk.js'),
  							import('./draw.js')
  						]).then(([{ Talk }, { update }]) => {
  							Talk.talkTips(`瞬间移动！已将主角位置修改为 (${mx}, ${my})` + (mhalf ? ' (半网格)' : ''));
  							update(true);
  						});
  						refreshMapModal();
  					}
  				});

  				// 双击瞬间移动主角并关闭大地图
  				mapCanvas.addEventListener('dblclick', (event) => {
  					// 步骤 1：获取点击位置并换算为大地图的像素坐标与瓦片网格坐标
  					const rect = mapCanvas.getBoundingClientRect();
  					const clickX = (event.clientX - rect.left) / mapZoomLevel;
  					const clickY = (event.clientY - rect.top) / mapZoomLevel;

  					const mapX = clickX - 32;
  					const mapY = clickY - 32;

  					let mx = Math.floor(mapX / 32);
  					let my = Math.floor(mapY / 16);
  					let mhalf = Math.round((mapX - mx * 32) / 16);

  					if (mhalf < 0) mhalf = 0;
  					if (mhalf > 1) mhalf = 1;
  					if (mx < 0) mx = 0;
  					if (mx > 127) mx = 127;
  					if (my < 0) my = 0;
  					if (my > 127) my = 127;

  					// 步骤 2：执行瞬移定位并重绘画面，随后关闭大地图模态窗口
  					if (window.setRolePos) {
  						window.setRolePos(mx, my, mhalf);
  						Promise.all([
  							import('./talk.js'),
  							import('./draw.js')
  						]).then(([{ Talk }, { update }]) => {
  							Talk.talkTips(`瞬间移动！已将主角位置修改为 (${mx}, ${my})` + (mhalf ? ' (半网格)' : ''));
  							update(true);
  						});
  						closeMapModal();
  					}
  				});

  				// 鼠标移动显示光标对应的瓦片位置
  				mapCanvas.addEventListener('mousemove', (event) => {
  					const rect = mapCanvas.getBoundingClientRect();
  					const clickX = (event.clientX - rect.left) / mapZoomLevel;
  					const clickY = (event.clientY - rect.top) / mapZoomLevel;

  					const mapX = clickX - 32;
  					const mapY = clickY - 32;

  					let mx = Math.floor(mapX / 32);
  					let my = Math.floor(mapY / 16);
  					let mhalf = Math.round((mapX - mx * 32) / 16);

  					if (mhalf < 0) mhalf = 0;
  					if (mhalf > 1) mhalf = 1;
  					if (mx < 0) mx = 0;
  					if (mx > 127) mx = 127;
  					if (my < 0) my = 0;
  					if (my > 127) my = 127;

  					const state = window.state;
  					const mapId = state ? state.mapId : 0;
  					document.getElementById('map-modal-info').innerText = `地图: 0x${mapId.toString(16).toUpperCase()} (${mapId}) | 主角: (${state?.mx}, ${state?.my}) | 光标: (${mx}, ${my})${mhalf ? ' +0.5' : ''}`;
  				});

  				// 鼠标移开时恢复显示主角当前位置
  				mapCanvas.addEventListener('mouseleave', () => {
  					const state = window.state;
  					if (!state) return;
  					const mapId = state.mapId;
  					document.getElementById('map-modal-info').innerText = `地图: 0x${mapId.toString(16).toUpperCase()} (${mapId}) | 主角: (${state.mx}, ${state.my})${state.mhalf ? ' +0.5' : ''}`;
  				});
  			}
  		})();
}
