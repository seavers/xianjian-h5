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
