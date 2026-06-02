// 游戏统一状态管理模块，负责存放并共享原来所有的全局运行时变量
export const state = {
  // 游戏画面基准尺寸（320x200，随后自适应缩放）
  WIDTH: 320,
  HEIGHT: 200,

  // 瓦片坐标与实际像素坐标
  mx: 8,
  my: 14,
  mhalf: 0,
  mapX: 0,
  mapY: 0,
  mapId: 12,
  
  sceneId: -1,
  nextSceneId: -1,
  needToFadeIn: false,  // 标识是否fadeIn、fadeOut 场景
  fadeAlpha: 0,         // 场景渐变过渡的黑色遮罩透明度（0表示完全透明，1表示完全黑色）
  fadeColor: '0, 0, 0', // 场景渐变过渡遮罩的 RGB 颜色（默认为黑色 '0, 0, 0'，支持红色 '255, 0, 0' 等）
  _isTransitionPaused: false, // 标识切换过渡期间是否挂起主循环
  get isPaused() {
    const startup = document.getElementById('startup');
    const isEscVisible = !!(startup && startup.style.display === 'block');
    return isEscVisible || this._isTransitionPaused;
  },
  set isPaused(val) {
    this._isTransitionPaused = val;
  },
  transitionTask: null, // 场景渐变过渡的同步定时任务对象
  nextTriggerScriptId: -1, // 延迟触发的 trigger 脚本 ID，将在下一 tick 执行
  nextTriggerScriptObject: null, // 延迟触发的 trigger 脚本绑定的实体对象
  fadeOutSpeed: 1,

  startEventId: 0,
  endEventId: 0x20,

  // GOP 动画图片缓存
  images: {},

  // 从 SSS 资源中读取的数据表
  eventObjects: [],
  scripts: [],
  scenes: [],
  items: [],
  words: [],

  // 主角与队伍列表
  roles: [{
    type: 'role',
    x: 0,
    y: 0,
    layer: 0,
    tileId: 0,
    frame: 0,
    index: 0,
    count: 0
  }],

  // 行囊道具列表（ownItems）
  ownItems: [],
  
  // 金钱
  money: 0,

  // 当前读写的存档槽位
  currentSaveSlot: 1,

  // 变速齿轮帧数控制（原本为 core-timer.js 中的 frameCount）
  frameCount: 6,

  // 并行脚本执行历史（用于右侧监控流）
  scriptLogs: [],

  // 当前被高亮追踪的 NPC ID
  highlightNpcId: null,

  // 各层 Canvas 上下文引用
  contexts: {
    main: null,
    back: null,
    map: null,
    front: null,
    temp: null,
    talk: null,
    startup: null
  }
};
