import { Lang } from '../utils/lang.js';

export const Queue = {
  create(queueLength = 4) {
    const max = queueLength;
    let queue = [];
    let current = 0;
    let finishCallback = null;

    function add(fn) {
      queue.push(fn);
      check();
    }

    function remove() {
      current--;
      check();
      if (current === 0 && queue.length === 0 && finishCallback) {
        finishCallback();
      }
    }

    function finish(c) {
      finishCallback = c;
    }

    function check() {
      while (queue.length > 0 && current < max) {
        const fn = queue.shift();
        current++;
        fn();
      }
    }

    return {
      add,
      remove,
      finish
    };
  }
};

const base = 'pal/'; // 资源目录
const files = [
  ['sss.mkf', 5],     // 核心数据
  ['pat.mkf', 9],     // 调色板
  ['wor16.asc'],      // 码表
  ['jianti.fon', 0],  // 简体字库
  ['word.dat'],       // 短语
  ['fbp.mkf', 72],    // 背景图
  ['map.mkf', 226],   // 地图
  ['gop.mkf', 226],   // 图元
  ['mgo.mkf', 637],   // 角色
  ['rgm.mkf', 92],    // 头像
  ['m.msg', 0],       // 对话数据
  ['data.mkf'],       // 数据类
  ['abc.mkf'],        
  ['ball.mkf'],       // 物品类
];

export const file_caches = {}; // key -> ByteArray

// 缓存存取
export function load(url) {
  const file = file_caches[url];
  if (!file) {
    console.error('资源未加载: ' + url);
    alert('未加载资源: ' + url);
    return;
  }
  return file;
}

export function save(url, byteArray) {
  file_caches[url] = byteArray;
}

// 提前并发加载需要的资源文件
export function ready(callback) {
  console.log('开始并发下载仙剑核心资源数据包...');
  const queue = Queue.create(6); // 提速，最大并发 6

  // 渲染右边面板或页面的下载状态
  const infoEl = document.getElementById('info');
  if (infoEl) {
    infoEl.innerHTML = '';
  }

  for (let i = 0; i < files.length; i++) {
    const filename = files[i][0];
    queue.add(() => {
      loadUrl(filename, (byteArray, url) => {
        save(url, byteArray);
        queue.remove();
      }, i);
    });
  }

  queue.finish(callback);
}

function loadUrl(url, callback, id) {
  const spanId = 'info-p' + id;
  const infoEl = document.getElementById('info');
  if (infoEl) {
    infoEl.innerHTML += `<li>正在下载: <span class="res-name">${url}</span> <span id="${spanId}" class="res-pct">(0%)</span></li>`;
  }
  console.log('正在下载资源文件: ' + url);

  const ajax = Lang.ajaxByteArray(url, (ret, url) => {
    console.log('资源下载完成: ' + url + ' (' + ret.length + ' 字节)');
    const pctSpan = document.getElementById(spanId);
    if (pctSpan) {
      pctSpan.innerHTML = '<span class="done-badge">完成</span>';
    }
    return callback && callback(ret, url);
  }, base);

  ajax.addEventListener('progress', (ev) => {
    if (ev.lengthComputable) {
      const pct = Math.ceil(ev.loaded / ev.total * 100);
      const pctSpan = document.getElementById(spanId);
      if (pctSpan) {
        pctSpan.innerText = `(${pct}%)`;
      }
    }
  });
}

// 解包仙剑的 mkf 打包格式，返回其对应索引的 ByteArray 子视图
export function loadMkf(file, index) {
  const data = load(file);
  const start = data.getInt(index * 4);
  const end = data.getInt(index * 4 + 4);
  
  if (end - start > 655360) {
    console.warn(`[warning]: mkf 数据块过大: ${file} index:${index} size:${end - start}`);
    return;
  }

  return data.slice(start, end);
}
