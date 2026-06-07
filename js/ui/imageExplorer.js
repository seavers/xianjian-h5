export function initImageExplorer({ drawDecodedSprite, getDetailedItemInfo }) {
  // ==================== 🔍 2D Sprite Explorer 帧画廊浏览器前端交互 ====================
  		let loadMgoFn = null;
  		let loadMgoCountFn = null;
  		let loadBallFn = null;

  		// 动态载入图片浏览与解包所需的全部底层 API 接口
  		let palResources = null;
  		let loaderModule = null;
  		let rngModule = null;

  		import('../resources/pal.js').then((module) => {
  			palResources = module;
  			loadMgoFn = module.loadMgo;
  			loadMgoCountFn = module.loadMgoCount;
  			loadBallFn = module.loadBall;
  		});

  		import('../resources/loader.js').then((module) => {
  			loaderModule = module;
  		});

  		import('../engine/rng.js').then((module) => {
  			rngModule = module;
  		});

  		let musicModule = null;
  		let soundModule = null;

  		import('../resources/music.js').then((module) => {
  			musicModule = module;
  			window.musicModule = module;
  		});

  		import('../resources/sound.js').then((module) => {
  			soundModule = module;
  		});

  		// ==================== 🖼️ 通用图片精灵资源浏览器前端核心逻辑 ====================
  		// 1. 初始化核心状态管理器，用于记录当前分类、分页、像素放大倍率和子过滤ID
  		const imageExplorerState = {
  			currentType: 'rgm',
  			currentPage: 0,
  			itemsPerPage: 48,
  			currentScale: 2,
  			totalItems: 0,
  			subId: 0
  		};

  		// 2. 开启图片资源浏览器，同步当前状态并执行首次渲染
  		function openImageExplorer() {
  			document.getElementById('image-explorer-modal').style.display = 'flex';
  			switchImageType(imageExplorerState.currentType);
  		}

  		// 3. 关闭图片资源浏览器浮层
  		function closeImageExplorer() {
  			if (window.clearAllRngTimers) window.clearAllRngTimers();
  			if (window.closeRngPlayer) window.closeRngPlayer();
  			document.getElementById('image-explorer-modal').style.display = 'none';
  		}

  		// 4. 切换浏览的精灵大类（例如头像、角色动作、大背景图、剧情文本等）
  		function switchImageType(type) {
  			if (window.clearAllRngTimers) window.clearAllRngTimers();
  			if (window.closeRngPlayer) window.closeRngPlayer();
  			imageExplorerState.currentType = type;
  			imageExplorerState.currentPage = 0;

  			// 切换大类选项卡高亮样式
  			document.querySelectorAll('.image-tab-btn').forEach(btn => {
  				btn.classList.remove('active');
  			});
  			const activeTab = document.getElementById(`tab-${type}`);
  			if (activeTab) {
  				activeTab.classList.add('active');
  			}

  			// 控制特定的二级筛选项容器的显示/隐藏
  			document.getElementById('filter-mgo-container').style.display = (type === 'mgo') ? 'flex' : 'none';
  			document.getElementById('filter-gop-container').style.display = (type === 'gop') ? 'flex' : 'none';



  			// 根据各类精灵尺寸的最佳显示习惯，自适应调整单页容量与初始放大比例
  			// 除剧情文本 MSG 依然进行分页（根据容量选择下拉框的值分页）之外，其余全部类型都将 itemsPerPage 设为 100000 极大值以滚动平铺，并隐藏底部分页按钮
  			const pageController = document.getElementById('image-page-controller');
  			if (type === 'msg') {
  				const selectLimit = document.getElementById('select-image-page-limit');
  				if (selectLimit) {
  					imageExplorerState.itemsPerPage = parseInt(selectLimit.value);
  				} else {
  					imageExplorerState.itemsPerPage = 15;
  				}
  				imageExplorerState.currentScale = 1.5;
  				if (pageController) pageController.style.display = 'flex';
  			} else {
  				imageExplorerState.itemsPerPage = 100000;
  				if (pageController) pageController.style.display = 'none';

  				if (type === 'rgm') {
  					imageExplorerState.currentScale = 1;
  				} else if (type === 'mgo') {
  					imageExplorerState.currentScale = 2;
  				} else if (type === 'fbp') {
  					imageExplorerState.currentScale = 1;
  				} else if (type === 'gop') {
  					imageExplorerState.currentScale = 1.5;
  				} else if (type === 'pic') {
  					imageExplorerState.currentScale = 2;
  				} else if (type === 'ball') {
  					imageExplorerState.currentScale = 2;
  				} else if (type === 'wor16') {
  					imageExplorerState.currentScale = 2;
  				} else if (type === 'word') {
  					imageExplorerState.currentScale = 2;
  				} else if (type === 'rng') {
  					imageExplorerState.currentScale = 1;
  				} else if (type === 'music') {
  					imageExplorerState.currentScale = 1;
  				} else if (type === 'sound') {
  					imageExplorerState.currentScale = 1;
  				}
  			}

  			// 同步刷新滑块 UI 显式数值与 CSS 变量以支持极致像素放大
  			document.getElementById('image-gallery-scale').value = imageExplorerState.currentScale;
  			document.getElementById('label-image-scale-val').innerText = `${imageExplorerState.currentScale}X`;
  			document.documentElement.style.setProperty('--image-explorer-scale', imageExplorerState.currentScale);

  			updateTotalItemsAndRender();
  		}

  		// 5. 全局缩放滑块拉动响应：通过 CSS 特效实时对 Canvas 节点进行防糊等比拉伸
  		function changeImageScale(val) {
  			imageExplorerState.currentScale = parseFloat(val);
  			document.getElementById('label-image-scale-val').innerText = `${val}X`;
  			document.documentElement.style.setProperty('--image-explorer-scale', val);
  		}

  		// 6. 处理 MGO 角色二级分类的快速选择与强制数值检索
  		function onImageRoleSelect(roleId) {
  			document.getElementById('input-image-role-id').value = roleId;
  			imageExplorerState.subId = parseInt(roleId);
  			imageExplorerState.currentPage = 0;
  			updateTotalItemsAndRender();
  		}

  		function searchImageRole() {
  			const roleIdInput = document.getElementById('input-image-role-id').value;
  			if (roleIdInput === '') return;
  			imageExplorerState.subId = parseInt(roleIdInput);
  			imageExplorerState.currentPage = 0;
  			updateTotalItemsAndRender();
  		}

  		// 7. 处理 GOP 地图二级分类的快速选择与强制数值检索
  		function onImageMapSelect(mapId) {
  			document.getElementById('input-image-map-id').value = mapId;
  			imageExplorerState.subId = parseInt(mapId);
  			imageExplorerState.currentPage = 0;
  			updateTotalItemsAndRender();
  		}

  		function searchImageMap() {
  			const mapIdInput = document.getElementById('input-image-map-id').value;
  			if (mapIdInput === '') return;
  			imageExplorerState.subId = parseInt(mapIdInput);
  			imageExplorerState.currentPage = 0;
  			updateTotalItemsAndRender();
  		}

  		// 8. 精密计算当前选定资源包内含有的物理总块数
  		async function updateTotalItemsAndRender() {
  			if (!palResources || !loaderModule) {
  				setTimeout(updateTotalItemsAndRender, 50);
  				return;
  			}

  			const type = imageExplorerState.currentType;
  			try {
  				if (type === 'rgm') {
  					const data = loaderModule.load('rgm.mkf');
  					imageExplorerState.totalItems = data.getInt(0) / 4 - 1;
  				} else if (type === 'fbp') {
  					const data = loaderModule.load('fbp.mkf');
  					imageExplorerState.totalItems = data.getInt(0) / 4 - 1;
  				} else if (type === 'ball') {
  					const data = loaderModule.load('ball.mkf');
  					imageExplorerState.totalItems = data.getInt(0) / 4 - 1;
  				} else if (type === 'mgo') {
  					const selectEl = document.getElementById('select-image-role');
  					const inputEl = document.getElementById('input-image-role-id');
  					imageExplorerState.subId = parseInt(inputEl.value || selectEl.value || 0);
  					imageExplorerState.totalItems = palResources.loadMgoCount(imageExplorerState.subId);
  				} else if (type === 'gop') {
  					const selectEl = document.getElementById('select-image-map');
  					const inputEl = document.getElementById('input-image-map-id');
  					imageExplorerState.subId = parseInt(inputEl.value || selectEl.value || 12);
  					imageExplorerState.totalItems = palResources.mkf2Count('gop.mkf', imageExplorerState.subId);
  				} else if (type === 'pic') {
  					const pics = loaderModule.loadMkf('data.mkf', 9);
  					imageExplorerState.totalItems = pics.getShort(0);
  				} else if (type === 'msg') {
  					const talk = loaderModule.loadMkf('sss.mkf', 3);
  					imageExplorerState.totalItems = talk.length / 4 - 1;
  				} else if (type === 'wor16') {
  					const data = loaderModule.load('wor16.asc');
  					imageExplorerState.totalItems = data.length / 2;
  				} else if (type === 'word') {
  					const data = loaderModule.load('word.dat');
  					imageExplorerState.totalItems = data.length / 10;
  				} else if (type === 'rng') {
  					const data = loaderModule.load('rng.mkf');
  					imageExplorerState.totalItems = data.getInt(0) / 4 - 1;
  				} else if (type === 'music') {
  					if (musicModule) {
  						await musicModule.initMusic();
  						const musMkf = musicModule.getMusMkf();
  						const mkf = musMkf;
  						if (mkf) {
  							imageExplorerState.totalItems = Math.floor(mkf.getInt(0) / 4) - 1;
  						} else {
  							imageExplorerState.totalItems = 100;
  						}
  					} else {
  						imageExplorerState.totalItems = 100;
  					}
  				} else if (type === 'sound') {
  					if (soundModule) {
  						await soundModule.initSound();
  						const vocMkf = soundModule.getVocMkf();
  						const soundsMkf = soundModule.getSoundsMkf();
  						const mkf = vocMkf || soundsMkf;
  						if (mkf) {
  							imageExplorerState.totalItems = Math.floor(mkf.getInt(0) / 4) - 1;
  						} else {
  							imageExplorerState.totalItems = 250;
  						}
  					} else {
  						imageExplorerState.totalItems = 250;
  					}
  				}
  			} catch (e) {
  				console.error("获取精灵包大小时发生异常:", e);
  				imageExplorerState.totalItems = 0;
  			}

  			renderImagePage();
  		}

  		// 9. 精准遍历并分页平铺生成 Canvas 图像卡片 DOM 并写入容器中
  		function renderImagePage() {
  			const gallery = document.getElementById('image-gallery-container');
  			if (!gallery) return;

  			gallery.innerHTML = '<span style="color:rgba(255,255,255,0.4); font-size:9px; grid-column:span 8; text-align:center;">正在解包并渲染像素点阵数据...</span>';

  			const type = imageExplorerState.currentType;
  			const total = imageExplorerState.totalItems;

  			if (total <= 0) {
  				gallery.innerHTML = '<span style="color:rgba(255,255,255,0.25); font-size:9.5px; grid-column:span 8; text-align:center;">未找到有效精灵资源，或该资源包未完全就绪</span>';
  				document.getElementById('image-total-count').innerText = `资源总数: 0`;
  				document.getElementById('image-page-num').innerText = `1 / 1`;
  				return;
  			}

  			const limit = imageExplorerState.itemsPerPage;
  			const pageCount = Math.max(1, Math.ceil(total / limit));

  			if (imageExplorerState.currentPage >= pageCount) {
  				imageExplorerState.currentPage = pageCount - 1;
  			}
  			if (imageExplorerState.currentPage < 0) {
  				imageExplorerState.currentPage = 0;
  			}

  			const start = imageExplorerState.currentPage * limit;
  			const end = Math.min(total, start + limit);

  			// 更新底栏的统计元数据以及分页按钮的高亮/禁用状态
  			let totalText = `资源总数: ${total} 个`;
  			if (type === 'mgo') {
  				totalText += ` (动作形象 ID: ${imageExplorerState.subId})`;
  			} else if (type === 'gop') {
  				totalText += ` (大地图 ID: ${imageExplorerState.subId})`;
  			}
  			document.getElementById('image-total-count').innerText = totalText;
  			document.getElementById('image-page-num').innerText = `${imageExplorerState.currentPage + 1} / ${pageCount}`;

  			const prevBtn = document.getElementById('btn-image-prev');
  			const nextBtn = document.getElementById('btn-image-next');
  			prevBtn.disabled = (imageExplorerState.currentPage === 0);
  			nextBtn.disabled = (imageExplorerState.currentPage === pageCount - 1);
  			prevBtn.style.opacity = (imageExplorerState.currentPage === 0) ? '0.4' : '1';
  			nextBtn.style.opacity = (imageExplorerState.currentPage === pageCount - 1) ? '0.4' : '1';

  			const firstBtn = document.getElementById('btn-image-first');
  			const lastBtn = document.getElementById('btn-image-last');
  			if (firstBtn) {
  				firstBtn.disabled = (imageExplorerState.currentPage === 0);
  				firstBtn.style.opacity = (imageExplorerState.currentPage === 0) ? '0.4' : '1';
  			}
  			if (lastBtn) {
  				lastBtn.disabled = (imageExplorerState.currentPage === pageCount - 1);
  				lastBtn.style.opacity = (imageExplorerState.currentPage === pageCount - 1) ? '0.4' : '1';
  			}

  			gallery.innerHTML = '';

  			// 逐个生成解包 Canvas
  			for (let i = start; i < end; i++) {
  				let card = null;
  				if (type === 'rgm') {
  					card = renderSingleItem(i, `RGM #${i}`, (id) => palResources.loadRgm(id));
  				} else if (type === 'fbp') {
  					card = renderSingleItem(i, `FBP #${i}`, (id) => palResources.loadFbp(id));
  				} else if (type === 'ball') {
  					card = renderSingleItem(i, `BALL #${i}`, (id) => palResources.loadBall(id));
  				} else if (type === 'mgo') {
  					card = renderSingleItem(i, `MGO F:#${i}`, (id) => palResources.loadMgo(imageExplorerState.subId, id));
  				} else if (type === 'gop') {
  					card = renderSingleItem(i, `GOP #${i}`, (id) => palResources.loadGop(imageExplorerState.subId, id));
  				} else if (type === 'pic') {
  					card = renderSingleItem(i, `PIC #${i + 1}`, (id) => palResources.loadPic(id + 1));
  				} else if (type === 'msg') {
  					card = renderMsgItem(i, `MSG #${i}`);
  				} else if (type === 'wor16') {
  					const data = loaderModule.load('wor16.asc');
  					const code = data.getShort(i * 2);
  					card = renderSingleItem(i, `FON #${i}\n0x${code.toString(16).toUpperCase()}`, (id) => palResources.loadFon(id));
  				} else if (type === 'word') {
  					card = renderWordItem(i, `WORD #${i}`);
  				} else if (type === 'rng') {
  					card = renderRngItem(i, `RNG #${i}`);
  				} else if (type === 'music') {
  					card = renderMusicItem(i, `BGM #${i}`);
  				} else if (type === 'sound') {
  					card = renderSoundItem(i, `SFX #${i}`);
  				}

  				if (card) {
  					gallery.appendChild(card);
  				}
  			}
  		}

  		// ==================== 🎬 RNG 动画播放核心控制器 ====================
  		window.activeRngTimers = [];
  		window.clearAllRngTimers = function() {
  			if (window.activeRngTimers) {
  				window.activeRngTimers.forEach(t => {
  					if (t.timeoutId) clearTimeout(t.timeoutId);
  					if (t.onStop) t.onStop();
  				});
  				window.activeRngTimers = [];
  			}
  		};

  		// ==================== 🎵 背景音乐播放核心控制器 ====================
  		window.activeMusicControls = [];
  		window.clearAllMusicControls = function() {
  			if (window.activeMusicControls) {
  				window.activeMusicControls.forEach(c => {
  					if (c.onStop) c.onStop();
  				});
  				window.activeMusicControls = [];
  			}
  		};

  		function drawBufferToCanvas(canvas, buffer, palette) {
  			const ctx = canvas.getContext('2d');
  			const imageData = ctx.createImageData(320, 200);
  			const data = imageData.data;
  			for (let i = 0; i < 64000; i++) {
  				const color = palette[buffer[i]];
  				data[i * 4 + 0] = (color >> 16) & 0xFF;
  				data[i * 4 + 1] = (color >> 8) & 0xFF;
  				data[i * 4 + 2] = color & 0xFF;
  				data[i * 4 + 3] = (color >> 24) & 0xFF;
  			}
  			ctx.putImageData(imageData, 0, 0);
  		}

  		// ==================== 🎬 RNG 独立大尺寸弹窗播放器控制器 ====================
  		window.rngModalState = {
  			rngId: 0,
  			totalFrames: 0,
  			currentFrame: 0,
  			isPlaying: false,
  			rngChunk: null,
  			palette: null,
  			frameBuffer: new Uint8Array(320 * 200),
  			timeoutId: null
  		};

  		function openRngPlayer(rngId, labelText) {
  			window.clearAllRngTimers();

  			const modal = document.getElementById('rng-player-modal');
  			modal.style.display = 'flex';

  			const rngChunk = loaderModule.loadMkf('rng.mkf', rngId);
  			const firstOffset = rngChunk.getInt(0);
  			const totalFrames = Math.floor((firstOffset - 4) / 4);

  			window.rngModalState = {
  				rngId: rngId,
  				totalFrames: totalFrames,
  				currentFrame: 0,
  				isPlaying: true,
  				rngChunk: rngChunk,
  				palette: palResources.loadPal(window.state ? window.state.paletteId : 0),
  				frameBuffer: new Uint8Array(320 * 200),
  				timeoutId: null
  			};

  			document.getElementById('rng-modal-title').innerText = `正在播放: ${labelText}`;
  			
  			const slider = document.getElementById('rng-modal-slider');
  			slider.max = totalFrames - 1;
  			slider.value = 0;

  			const selectScale = document.getElementById('select-rng-scale');
  			const scale = parseInt(selectScale.value) || 2;
  			changeRngModalScale(scale);

  			const playBtn = document.getElementById('btn-rng-modal-play');
  			playBtn.innerText = "⏸ 暂停";
  			playBtn.style.color = "var(--glow-red)";
  			playBtn.style.borderColor = "rgba(255, 59, 111, 0.25)";
  			playBtn.style.background = "rgba(255, 59, 111, 0.05)";

  			runRngModalLoop();
  		}

  		function closeRngPlayer() {
  			window.rngModalState.isPlaying = false;
  			if (window.rngModalState.timeoutId) {
  				clearTimeout(window.rngModalState.timeoutId);
  				window.rngModalState.timeoutId = null;
  			}
  			document.getElementById('rng-player-modal').style.display = 'none';
  		}

  		function runRngModalLoop() {
  			if (!window.rngModalState.isPlaying) return;

  			const { rngChunk, currentFrame, totalFrames, frameBuffer, palette } = window.rngModalState;
  			const canvas = document.getElementById('rng-modal-canvas');

  			if (window.rngModalState.currentFrame >= totalFrames) {
  				window.rngModalState.currentFrame = 0;
  				frameBuffer.fill(0);
  			}

  			const f = window.rngModalState.currentFrame;
  			const ok = rngModule.decodeRngFrame(rngChunk, f, frameBuffer);
  			if (ok) {
  				drawBufferToCanvas(canvas, frameBuffer, palette);
  				
  				document.getElementById('rng-modal-slider').value = f;
  				document.getElementById('rng-modal-frame-lbl').innerText = `${f + 1} / ${totalFrames} 帧`;
  				
  				window.rngModalState.currentFrame++;
  				window.rngModalState.timeoutId = setTimeout(runRngModalLoop, 62.5);
  			} else {
  				toggleRngModalPlay();
  			}
  		}

  		function toggleRngModalPlay() {
  			const playBtn = document.getElementById('btn-rng-modal-play');
  			if (window.rngModalState.isPlaying) {
  				window.rngModalState.isPlaying = false;
  				if (window.rngModalState.timeoutId) {
  					clearTimeout(window.rngModalState.timeoutId);
  					window.rngModalState.timeoutId = null;
  				}
  				playBtn.innerText = "▶ 播放";
  				playBtn.style.color = "var(--glow-green)";
  				playBtn.style.borderColor = "rgba(0, 255, 157, 0.25)";
  				playBtn.style.background = "rgba(0, 255, 157, 0.05)";
  			} else {
  				window.rngModalState.isPlaying = true;
  				playBtn.innerText = "⏸ 暂停";
  				playBtn.style.color = "var(--glow-red)";
  				playBtn.style.borderColor = "rgba(255, 59, 111, 0.25)";
  				playBtn.style.background = "rgba(255, 59, 111, 0.05)";
  				runRngModalLoop();
  			}
  		}

  		function changeRngModalScale(scale) {
  			const canvas = document.getElementById('rng-modal-canvas');
  			if (canvas) {
  				canvas.style.width = (320 * scale) + 'px';
  				canvas.style.height = (200 * scale) + 'px';
  			}
  		}

  		function onRngSliderChange(val) {
  			const targetFrame = parseInt(val);
  			const { rngChunk, totalFrames, frameBuffer, palette } = window.rngModalState;
  			const canvas = document.getElementById('rng-modal-canvas');

  			if (window.rngModalState.timeoutId) {
  				clearTimeout(window.rngModalState.timeoutId);
  				window.rngModalState.timeoutId = null;
  			}

  			frameBuffer.fill(0);
  			for (let f = 0; f <= targetFrame; f++) {
  				rngModule.decodeRngFrame(rngChunk, f, frameBuffer);
  			}
  			drawBufferToCanvas(canvas, frameBuffer, palette);

  			window.rngModalState.currentFrame = targetFrame;
  			document.getElementById('rng-modal-frame-lbl').innerText = `${targetFrame + 1} / ${totalFrames} 帧`;

  			if (window.rngModalState.isPlaying) {
  				window.rngModalState.timeoutId = setTimeout(runRngModalLoop, 62.5);
  			}
  		}

  		window.openRngPlayer = openRngPlayer;
  		window.closeRngPlayer = closeRngPlayer;
  		window.toggleRngModalPlay = toggleRngModalPlay;
  		window.changeRngModalScale = changeRngModalScale;
  		window.onRngSliderChange = onRngSliderChange;

  		// 10.0 针对全屏剧情动画 (rng.mkf) 的微型互动 Canvas 播放渲染引擎
  		function renderRngItem(rngId, labelText) {
  			const card = document.createElement('div');
  			card.style.cssText = "background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.02); border-radius:2px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:8px; transition:all 0.1s; position:relative; width: 156px; box-sizing:border-box;";

  			card.onmouseenter = () => {
  				card.style.borderColor = 'var(--glow-green)';
  				card.style.background = 'rgba(0, 255, 157, 0.02)';
  			};
  			card.onmouseleave = () => {
  				if (!isPlaying) {
  					card.style.borderColor = 'rgba(255,255,255,0.02)';
  					card.style.background = 'rgba(255,255,255,0.015)';
  				}
  			};

  			const canvas = document.createElement('canvas');
  			canvas.width = 320;
  			canvas.height = 200;
  			canvas.style.cssText = "width: 140px; height: 88px; background: #000; border-radius: 1px; image-rendering: pixelated; display: block;";
  			card.appendChild(canvas);

  			const label = document.createElement('span');
  			label.style.cssText = "font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold; margin-top: 4px; text-align: center;";
  			card.appendChild(label);

  			const btnContainer = document.createElement('div');
  			btnContainer.style.cssText = "display: flex; gap: 4px; margin-top: 4px; width: 100%; justify-content: center;";
  			card.appendChild(btnContainer);

  			const playBtn = document.createElement('button');
  			playBtn.innerText = "▶ 播放";
  			playBtn.style.cssText = "background: rgba(0, 255, 157, 0.1); border: 1px solid rgba(0, 255, 157, 0.2); color: var(--glow-green); font-size: 8.5px; padding: 2px 6px; border-radius: 2px; cursor: pointer; font-weight: bold; outline: none; transition: all 0.1s;";
  			playBtn.onmouseenter = () => { if (!isPlaying) playBtn.style.background = 'rgba(0, 255, 157, 0.2)'; };
  			playBtn.onmouseleave = () => { if (!isPlaying) playBtn.style.background = 'rgba(0, 255, 157, 0.1)'; };
  			btnContainer.appendChild(playBtn);

  			const zoomBtn = document.createElement('button');
  			zoomBtn.innerText = "🔍 放大";
  			zoomBtn.style.cssText = "background: rgba(0, 225, 255, 0.1); border: 1px solid rgba(0, 225, 255, 0.2); color: var(--glow-blue); font-size: 8.5px; padding: 2px 6px; border-radius: 2px; cursor: pointer; font-weight: bold; outline: none; transition: all 0.1s;";
  			zoomBtn.onmouseenter = () => { zoomBtn.style.background = 'rgba(0, 225, 255, 0.2)'; };
  			zoomBtn.onmouseleave = () => { zoomBtn.style.background = 'rgba(0, 225, 255, 0.1)'; };
  			zoomBtn.onclick = () => {
  				if (isPlaying) {
  					isPlaying = false;
  					if (timerControl.timeoutId) {
  						clearTimeout(timerControl.timeoutId);
  						timerControl.timeoutId = null;
  					}
  					timerControl.onStop();
  				}
  				window.clearAllRngTimers();
  				openRngPlayer(rngId, labelText);
  			};
  			btnContainer.appendChild(zoomBtn);

  			let isPlaying = false;
  			const timerControl = {
  				timeoutId: null,
  				onStop: () => {
  					isPlaying = false;
  					playBtn.innerText = "▶ 播放";
  					playBtn.style.background = 'rgba(0, 255, 157, 0.1)';
  					playBtn.style.color = 'var(--glow-green)';
  					playBtn.style.borderColor = 'rgba(0, 255, 157, 0.2)';
  					card.style.borderColor = 'rgba(255,255,255,0.02)';
  					card.style.background = 'rgba(255,255,255,0.015)';
  				}
  			};

  			window.activeRngTimers.push(timerControl);

  			try {
  				const rngChunk = loaderModule.loadMkf('rng.mkf', rngId);
  				if (!rngChunk) {
  					card.innerHTML = `<span style="font-size:8px; color:rgba(255,255,255,0.15);">${labelText}\n[无数据]</span>`;
  					return card;
  				}

  				const firstOffset = rngChunk.getInt(0);
  				const totalFrames = Math.floor((firstOffset - 4) / 4);
  				label.innerText = `${labelText} (${totalFrames} 帧)`;

  				const palette = palResources.loadPal(window.state ? window.state.paletteId : 0);
  				const frameBuffer = new Uint8Array(320 * 200);

  				// 载入并直接绘制首帧预览
  				const success = rngModule.decodeRngFrame(rngChunk, 0, frameBuffer);
  				if (success) {
  					drawBufferToCanvas(canvas, frameBuffer, palette);
  				}

  				playBtn.onclick = () => {
  					if (isPlaying) {
  						isPlaying = false;
  						if (timerControl.timeoutId) {
  							clearTimeout(timerControl.timeoutId);
  							timerControl.timeoutId = null;
  						}
  						timerControl.onStop();
  					} else {
  						// 独占播放：先清理所有其他的播放器
  						window.clearAllRngTimers();

  						// 将我们自己重新注册回活动计时器中
  						window.activeRngTimers.push(timerControl);

  						isPlaying = true;
  						playBtn.innerText = "⏸ 暂停";
  						playBtn.style.background = 'rgba(255, 59, 111, 0.15)';
  						playBtn.style.color = 'var(--glow-red)';
  						playBtn.style.borderColor = 'rgba(255, 59, 111, 0.25)';
  						card.style.borderColor = 'var(--glow-green)';
  						card.style.background = 'rgba(0, 255, 157, 0.02)';

  						let currentFrame = 0;
  						frameBuffer.fill(0);

  						function playNext() {
  							if (!isPlaying) return;
  							if (currentFrame >= totalFrames) {
  								currentFrame = 0;
  								frameBuffer.fill(0);
  							}
  							const ok = rngModule.decodeRngFrame(rngChunk, currentFrame, frameBuffer);
  							if (ok) {
  								drawBufferToCanvas(canvas, frameBuffer, palette);
  								currentFrame++;
  								timerControl.timeoutId = setTimeout(playNext, 62.5);
  							} else {
  								timerControl.onStop();
  							}
  						}
  						playNext();
  					}
  				};

  			} catch (e) {
  				console.error(`初始化 RNG #${rngId} 失败:`, e);
  				card.innerHTML = `<span style="font-size:8px; color:var(--glow-red);">${labelText}\n[解析失败]</span>`;
  			}

  			return card;
  		}

  		// 10.0.1 针对背景音乐 (midi.mkf / mus.mkf / Musics) 的微型互动播放卡片渲染引擎
  		function renderMusicItem(musicId, labelText) {
  			const card = document.createElement('div');
  			card.style.cssText = "background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.02); " +
  				"border-radius:2px; display:flex; flex-direction:column; align-items:center; " +
  				"justify-content:center; padding:10px; transition:all 0.1s; position:relative; " +
  				"width: 140px; box-sizing:border-box; gap: 6px;";

  			card.onmouseenter = () => {
  				card.style.borderColor = 'var(--glow-yellow)';
  				card.style.background = 'rgba(253, 220, 132, 0.02)';
  			};
  			card.onmouseleave = () => {
  				if (!isPlaying) {
  					card.style.borderColor = 'rgba(255,255,255,0.02)';
  					card.style.background = 'rgba(255,255,255,0.015)';
  				}
  			};

  			const icon = document.createElement('span');
  			icon.innerHTML = "🎵";
  			icon.style.fontSize = "20px";
  			card.appendChild(icon);

  			const label = document.createElement('span');
  			label.innerText = labelText;
  			label.style.cssText = "font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; text-align: center;";
  			card.appendChild(label);

  			const playBtn = document.createElement('button');
  			playBtn.innerText = "▶ 播放";
  			playBtn.style.cssText = "background: rgba(253, 220, 132, 0.1); border: 1px solid rgba(253, 220, 132, 0.2); " +
  				"color: var(--glow-yellow); font-size: 8px; padding: 2px 8px; border-radius: 2px; " +
  				"cursor: pointer; font-weight: bold; outline: none; transition: all 0.1s; width: 100%; text-align: center;";
  			playBtn.onmouseenter = () => { if (!isPlaying) playBtn.style.background = 'rgba(253, 220, 132, 0.2)'; };
  			playBtn.onmouseleave = () => { if (!isPlaying) playBtn.style.background = 'rgba(253, 220, 132, 0.1)'; };
  			card.appendChild(playBtn);

  			let isPlaying = false;
  			const musicControl = {
  				onStop: () => {
  					isPlaying = false;
  					playBtn.innerText = "▶ 播放";
  					playBtn.style.background = 'rgba(253, 220, 132, 0.1)';
  					playBtn.style.borderColor = 'rgba(253, 220, 132, 0.2)';
  					playBtn.style.color = 'var(--glow-yellow)';
  					card.style.borderColor = 'rgba(255, 255, 255, 0.02)';
  					card.style.background = 'rgba(255, 255, 255, 0.015)';
  				}
  			};

  			playBtn.onclick = () => {
  				if (!musicModule) return;
  				if (isPlaying) {
  					musicModule.stopMusic();
  					musicControl.onStop();
  				} else {
  					// 独占播放：先停止并重置所有其它正在播放的音乐卡片 UI
  					window.clearAllMusicControls();

  					musicModule.playMusic(musicId, true, 0);
  					isPlaying = true;
  					playBtn.innerText = "■ 停止";
  					playBtn.style.background = 'rgba(255, 59, 111, 0.15)';
  					playBtn.style.borderColor = 'rgba(255, 59, 111, 0.3)';
  					playBtn.style.color = '#ff3b6f';
  					card.style.borderColor = 'var(--glow-yellow)';

  					window.activeMusicControls.push(musicControl);
  				}
  			};

  			const downloadBtn = document.createElement('button');
  			downloadBtn.innerText = "📥 下载 RIX";
  			downloadBtn.style.cssText = "background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); " +
  				"color: rgba(255,255,255,0.7); font-size: 8px; padding: 2px 4px; border-radius: 2px; " +
  				"cursor: pointer; outline: none; transition: all 0.1s; width: 100%; text-align: center;";
  			downloadBtn.onmouseenter = () => { downloadBtn.style.background = 'rgba(255,255,255,0.08)'; };
  			downloadBtn.onmouseleave = () => { downloadBtn.style.background = 'rgba(255, 255, 255, 0.03)'; };
  			card.appendChild(downloadBtn);

  			downloadBtn.onclick = () => {
  				if (!musicModule) return;
  				const musMkf = musicModule.getMusMkf();
  				const mkf = musMkf;
  				if (!mkf) {
  					alert("当前环境未检测到 mus.mkf 归档文件。");
  					return;
  				}
  				const total = Math.floor(mkf.getInt(0) / 4) - 1;
  				if (musicId >= total) {
  					alert(`背景音乐索引 #${musicId} 越界 (归档文件内最大索引为: ${total - 1})`);
  					return;
  				}
  				const start = mkf.getInt(musicId * 4);
  				const end = mkf.getInt(musicId * 4 + 4);
  				if (end <= start) {
  					alert("该索引对应的音频块数据为空。");
  					return;
  				}
  				const chunk = mkf.slice(start, end);
  				const bytes = new Uint8Array(chunk.length);
  				for (let k = 0; k < chunk.length; k++) {
  					bytes[k] = chunk.getByte(k);
  				}
  				const blob = new Blob([bytes], { type: 'application/octet-stream' });
  				const url = URL.createObjectURL(blob);
  				const a = document.createElement('a');
  				const ext = 'rix';
  				a.href = url;
  				a.download = `music_${musicId}.${ext}`;
  				a.click();
  				URL.revokeObjectURL(url);
  			};

  			return card;
  		}

  		// 10.0.2 针对特技音效 (voc.mkf / sounds.mkf) 的微型互动播放卡片渲染引擎
  		function renderSoundItem(soundId, labelText) {
  			const card = document.createElement('div');
  			card.style.cssText = "background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.02); " +
  				"border-radius:2px; display:flex; flex-direction:column; align-items:center; " +
  				"justify-content:center; padding:10px; transition:all 0.1s; position:relative; " +
  				"width: 140px; box-sizing:border-box; gap: 6px;";

  			card.onmouseenter = () => {
  				card.style.borderColor = 'var(--glow-green)';
  				card.style.background = 'rgba(0, 255, 157, 0.02)';
  			};
  			card.onmouseleave = () => {
  				card.style.borderColor = 'rgba(255,255,255,0.02)';
  				card.style.background = 'rgba(255,255,255,0.015)';
  			};

  			const icon = document.createElement('span');
  			icon.innerHTML = soundId === 0 ? "🔇" : "🔊";
  			icon.style.fontSize = "20px";
  			card.appendChild(icon);

  			const label = document.createElement('span');
  			label.innerText = soundId === 0 ? "全部静音" : labelText;
  			label.style.cssText = "font-size: 8.5px; color: rgba(255,255,255,0.4); font-weight: bold; text-align: center;";
  			card.appendChild(label);

  			const playBtn = document.createElement('button');
  			playBtn.innerText = soundId === 0 ? "■ 静音" : "▶ 播放";
  			playBtn.style.cssText = soundId === 0 ?
  				"background: rgba(255, 59, 111, 0.1); border: 1px solid rgba(255, 59, 111, 0.2); color: #ff3b6f; " +
  				"font-size: 8px; padding: 2px 8px; border-radius: 2px; cursor: pointer; font-weight: bold; outline: none; transition: all 0.1s; width: 100%; text-align: center;" :
  				"background: rgba(0, 255, 157, 0.1); border: 1px solid rgba(0, 255, 157, 0.2); color: var(--glow-green); " +
  				"font-size: 8px; padding: 2px 8px; border-radius: 2px; cursor: pointer; font-weight: bold; outline: none; transition: all 0.1s; width: 100%; text-align: center;";
  			playBtn.onmouseenter = () => { playBtn.style.background = soundId === 0 ? 'rgba(255, 59, 111, 0.2)' : 'rgba(0, 255, 157, 0.2)'; };
  			playBtn.onmouseleave = () => { playBtn.style.background = soundId === 0 ? 'rgba(255, 59, 111, 0.1)' : 'rgba(0, 255, 157, 0.1)'; };
  			card.appendChild(playBtn);

  			playBtn.onclick = async () => {
  				if (!soundModule) return;
  				if (soundId === 0) {
  					soundModule.stopAllSounds();
  				} else {
  					await soundModule.playSound(soundId);
  				}
  			};

  			if (soundId > 0) {
  				const downloadBtn = document.createElement('button');
  				downloadBtn.innerText = "📥 下载 VOC";
  				downloadBtn.style.cssText = "background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); " +
  					"color: rgba(255,255,255,0.7); font-size: 8px; padding: 2px 4px; border-radius: 2px; " +
  					"cursor: pointer; outline: none; transition: all 0.1s; width: 100%; text-align: center;";
  				downloadBtn.onmouseenter = () => { downloadBtn.style.background = 'rgba(255,255,255,0.08)'; };
  				downloadBtn.onmouseleave = () => { downloadBtn.style.background = 'rgba(255, 255, 255, 0.03)'; };
  				card.appendChild(downloadBtn);

  				downloadBtn.onclick = () => {
  					if (!soundModule) return;
  					const vocMkf = soundModule.getVocMkf();
  					const soundsMkf = soundModule.getSoundsMkf();
  					const mkf = vocMkf || soundsMkf;
  					if (!mkf) {
  						alert("当前环境未检测到 voc.mkf / sounds.mkf 归档文件。");
  						return;
  					}
  					const chunk = soundModule.getMkfChunk(mkf, soundId);
  					if (!chunk) {
  						alert(`无法获取特技音效索引 #${soundId} 的数据块`);
  						return;
  					}
  					const bytes = new Uint8Array(chunk.length);
  					for (let k = 0; k < chunk.length; k++) {
  						bytes[k] = chunk.getByte(k);
  					}
  					const ext = soundModule.isVoc(chunk) ? 'voc' : 'wav';
  					const blob = new Blob([bytes], { type: 'application/octet-stream' });
  					const url = URL.createObjectURL(blob);
  					const a = document.createElement('a');
  					a.href = url;
  					a.download = `sound_${soundId}.${ext}`;
  					a.click();
  					URL.revokeObjectURL(url);
  				};
  			}

  			return card;
  		}

  		// 10. 针对剧情文本 (msg) 用游戏字库原生 16x16 点阵字顺次拼接绘制的特殊渲染引擎
  		function renderMsgItem(msgId, labelText) {
  			const card = document.createElement('div');
  			card.style.cssText = "background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.02); border-radius:2px; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; padding:8px; transition:all 0.1s; max-width:calc(330px * var(--image-explorer-scale)); overflow:hidden; box-sizing:border-box;";

  			card.onmouseenter = () => {
  				card.style.borderColor = 'var(--glow-green)';
  				card.style.background = 'rgba(0, 255, 157, 0.02)';
  			};
  			card.onmouseleave = () => {
  				card.style.borderColor = 'rgba(255,255,255,0.02)';
  				card.style.background = 'rgba(255,255,255,0.015)';
  			};

  			try {
  				const text = palResources.loadMsg(msgId);
  				if (text && text.length > 0) {
  					// 将剧情文本二进制段转换为汉字短整型字码与颜色编码的结合数组
  					const r = [];
  					let color = null;
  					for (let i = 0; i < text.length; i++) {
  						const b = text.getByte(i);
  						if (b === 34) { // "
  							color = color === 0xFCDC84 ? null : 0xFCDC84;
  						} else if (b === 45) { // -
  							color = color === 0xFFFF00 ? null : 0xFFFF00;
  						} else if (b === 39) { // '
  							color = color === 0x0000FF ? null : 0x0000FF;
  						} else {
  							// 两个字节表示一个汉字字码，以 short 读取
  							r.push({
  								charCode: text.getShort(i++),
  								color: color
  							});
  						}
  					}

  					if (r.length > 0) {
  						// 创建高度为 16px、宽度根据字数自适应的 Canvas 容器
  						const canvas = document.createElement('canvas');
  						canvas.width = r.length * 16;
  						canvas.height = 16;

  						canvas.style.setProperty('--raw-width', `${canvas.width}px`);
  						canvas.style.setProperty('--raw-height', '16px');
  						canvas.style.background = 'rgba(0,0,0,0.4)';
  						canvas.style.borderRadius = '1px';

  						const ctx = canvas.getContext('2d');
  						ctx.imageSmoothingEnabled = false;

  						// 逐字使用原版 loadWord(charCode, color) 进行点阵贴图拼合绘制
  						for (let j = 0; j < r.length; j++) {
  							const wordImg = r[j].color ? palResources.loadWord(r[j].charCode, r[j].color) : palResources.loadWord(r[j].charCode);
  							if (wordImg) {
  								ctx.drawImage(wordImg, j * 16, 0);
  							}
  						}

  						card.appendChild(canvas);

  						// 文字说明底签
  						const label = document.createElement('span');
  						label.innerText = `${labelText} (${r.length} 字)`;
  						label.style.cssText = "font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold; margin-top: 4px;";
  						card.appendChild(label);
  					} else {
  						card.innerHTML = `<span style="font-size:8px; color:rgba(255,255,255,0.15);">${labelText}\n[控制字符或空指令]</span>`;
  					}
  				} else {
  					card.innerHTML = `<span style="font-size:8px; color:rgba(255,255,255,0.15);">${labelText}\n[空文本]</span>`;
  				}
  			} catch (e) {
  				console.error(`绘制剧本文本 MSG #${msgId} 失败:`, e);
  				card.innerHTML = `<span style="font-size:8px; color:var(--glow-red);">${labelText}\n[解析/绘制失败]</span>`;
  			}

  			return card;
  		}

  		// 10.1 针对短语 (word) 用游戏字库原生 16x16 点阵字顺次拼接绘制的特殊渲染引擎
  		function renderWordItem(wordId, labelText) {
  			const card = document.createElement('div');
  			card.style.cssText = "background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.02); border-radius:2px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:8px; transition:all 0.1s;";

  			card.onmouseenter = () => {
  				card.style.borderColor = 'var(--glow-green)';
  				card.style.background = 'rgba(0, 255, 157, 0.02)';
  			};
  			card.onmouseleave = () => {
  				card.style.borderColor = 'rgba(255,255,255,0.02)';
  				card.style.background = 'rgba(255,255,255,0.015)';
  			};

  			try {
  				const data = loaderModule.load('word.dat');
  				const offset = wordId * 10;
  				const r = [];
  				for (let i = 0; i < 5; i++) {
  					const code = data.getShort(offset + i * 2);
  					if (code !== 0 && code !== 32) { // 过滤掉 0 和空格填充字符
  						r.push(code);
  					}
  				}

  				if (r.length > 0) {
  					// 创建高度为 16px、宽度自适应的 Canvas
  					const canvas = document.createElement('canvas');
  					canvas.width = r.length * 16;
  					canvas.height = 16;

  					canvas.style.setProperty('--raw-width', `${canvas.width}px`);
  					canvas.style.setProperty('--raw-height', '16px');
  					canvas.style.background = 'rgba(0,0,0,0.4)';
  					canvas.style.borderRadius = '1px';

  					const ctx = canvas.getContext('2d');
  					ctx.imageSmoothingEnabled = false;

  					for (let j = 0; j < r.length; j++) {
  						const wordImg = palResources.loadWord(r[j]);
  						if (wordImg) {
  							ctx.drawImage(wordImg, j * 16, 0);
  						}
  					}

  					card.appendChild(canvas);

  					const label = document.createElement('span');
  					label.innerText = `${labelText}`;
  					label.style.cssText = "font-size: 8px; color: rgba(255,255,255,0.3); font-weight: bold; margin-top: 4px;";
  					card.appendChild(label);
  				} else {
  					card.innerHTML = `<span style="font-size:8px; color:rgba(255,255,255,0.15);">${labelText}\n[空短语]</span>`;
  				}
  			} catch (e) {
  				console.error(`绘制短语 WORD #${wordId} 失败:`, e);
  				card.innerHTML = `<span style="font-size:8px; color:var(--glow-red);">${labelText}\n[绘制失败]</span>`;
  			}

  			return card;
  		}

  		// 11. 渲染单个资源卡片的无模像素卡片渲染引擎
  		function renderSingleItem(itemId, itemLabelText, loadFn) {
  			const card = document.createElement('div');
  			card.style.cssText = "background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.02); border-radius:2px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:6px; transition:all 0.1s;";

  			card.onmouseenter = () => {
  				card.style.borderColor = 'var(--glow-green)';
  				card.style.background = 'rgba(0, 255, 157, 0.02)';
  			};
  			card.onmouseleave = () => {
  				card.style.borderColor = 'rgba(255,255,255,0.02)';
  				card.style.background = 'rgba(255,255,255,0.015)';
  			};

  			try {
  				const img = loadFn(itemId);
  				if (img) {
  					// img 本身已经是一个原生 Canvas 节点！
  					// 我们直接对其应用倍率缩放样式，以求最佳性能和 100% 图像完整性。
  					img.style.setProperty('--raw-width', `${img.width}px`);
  					img.style.setProperty('--raw-height', `${img.height}px`);
  					img.style.background = 'rgba(0,0,0,0.3)';
  					img.style.borderRadius = '1px';

  					card.appendChild(img);

  					const label = document.createElement('span');
  					label.innerText = `${itemLabelText}\n(${img.width}x${img.height})`;
  					label.style.cssText = "font-size: 7.5px; color: rgba(255,255,255,0.3); font-weight: bold; margin-top: 4px; text-align: center; white-space: pre-line; line-height: 1.2;";
  					card.appendChild(label);
  				} else {
  					card.innerHTML = `<span style="font-size:7.5px; color:rgba(255,255,255,0.15);">${itemLabelText}\n[无数据]</span>`;
  				}
  			} catch (e) {
  				console.error(`渲染项 #${itemId} 失败:`, e);
  				card.innerHTML = `<span style="font-size:7.5px; color:var(--glow-red);">${itemLabelText}\n[解包失败]</span>`;
  			}

  			return card;
  		}

  		// 11. 执行翻页控制逻辑
  		function prevImagePage() {
  			if (imageExplorerState.currentPage > 0) {
  				imageExplorerState.currentPage--;
  				renderImagePage();
  			}
  		}

  		function nextImagePage() {
  			const limit = imageExplorerState.itemsPerPage;
  			const pageCount = Math.ceil(imageExplorerState.totalItems / limit);
  			if (imageExplorerState.currentPage < pageCount - 1) {
  				imageExplorerState.currentPage++;
  				renderImagePage();
  			}
  		}

  		function firstImagePage() {
  			if (imageExplorerState.currentPage > 0) {
  				imageExplorerState.currentPage = 0;
  				renderImagePage();
  			}
  		}

  		function lastImagePage() {
  			const limit = imageExplorerState.itemsPerPage;
  			const pageCount = Math.ceil(imageExplorerState.totalItems / limit);
  			if (imageExplorerState.currentPage < pageCount - 1) {
  				imageExplorerState.currentPage = pageCount - 1;
  				renderImagePage();
  			}
  		}

  		function changeImagePageLimit(val) {
  			imageExplorerState.itemsPerPage = parseInt(val);
  			imageExplorerState.currentPage = 0;
  			renderImagePage();
  		}

  		// 12. 将所有与 HTML 直接交互 of API 绑定注册至全局作用域
  		window.openImageExplorer = openImageExplorer;
  		window.closeImageExplorer = closeImageExplorer;
  		window.switchImageType = switchImageType;
  		window.changeImageScale = changeImageScale;
  		window.onImageRoleSelect = onImageRoleSelect;
  		window.searchImageRole = searchImageRole;
  		window.onImageMapSelect = onImageMapSelect;
  		window.searchImageMap = searchImageMap;
  		window.prevImagePage = prevImagePage;
  		window.nextImagePage = nextImagePage;
  		window.firstImagePage = firstImagePage;
  		window.lastImagePage = lastImagePage;
  		window.changeImagePageLimit = changeImagePageLimit;
  		window.openFrameGalleryToImageExplorer = openFrameGalleryToImageExplorer;

  		// 帧画廊按钮：直接跳转至「图片资源」角色动作 Tab 并选中当前角色
  		function openFrameGalleryToImageExplorer() {
  			// 从主角描述标签中提取当前角色的 Tile ID，格式为 "Tile: 0 F: 0"
  			let roleId = 0;
  			const heroDesc = document.getElementById('val-hero-desc');
  			if (heroDesc) {
  				const match = heroDesc.innerText.match(/Tile:\s*(\d+)/);
  				if (match) roleId = parseInt(match[1]);
  			}

  			// 打开图片资源浏览器并切换到 mgo Tab
  			document.getElementById('image-explorer-modal').style.display = 'flex';
  			switchImageType('mgo');

  			// 设置角色选择下拉框和输入框，触发渲染
  			const imageRoleSelect = document.getElementById('select-image-role');
  			if (imageRoleSelect) {
  				const option = imageRoleSelect.querySelector(`option[value="${roleId}"]`);
  				if (option) {
  					imageRoleSelect.value = roleId;
  				} else {
  					imageRoleSelect.selectedIndex = 0;
  				}
  			}
  			document.getElementById('input-image-role-id').value = roleId;
  			imageExplorerState.subId = roleId;
  			imageExplorerState.currentPage = 0;
  			updateTotalItemsAndRender();
  		}
}
