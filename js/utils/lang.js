import { ByteArray } from './view.js';

export const Lang = {
  arrayRemove(arr, item) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === item) {
        arr.splice(i, 1);
      }
    }
  },

  endWiths(str, ch) {
    return str.getByte(str.length - 1) == 71 && str.getByte(str.length - 2) == 161;
  },

  // 现代原生 Ajax 请求二进制字节流
  ajaxByteArray(url, callback, base = 'pal/') {
    const req = new XMLHttpRequest();
    req.url = url;

    req.open('GET', base + url, true);  
    req.responseType = "arraybuffer";

    req.onreadystatechange = function () {
      if (req.readyState == 4) {
        if (req.status == 200) {
          const byteArray = new ByteArray(new Uint8Array(req.response));
          callback && callback(byteArray, url);
        } else {
          console.error('资源下载失败: ' + url);
          alert('资源下载失败: ' + url);
        }
      }
    };
    req.send(null);

    return req;
  }
};
