export const Canvas = {
  // 利用字节数组生成 canvas 对象，每个字节/数值为一个 32 位 RGBA 像素数据
  create(data, width, height) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');

    const image = ctx.createImageData(width, height);
    const pixels = image.data;
    
    for (let i = 0; i < width * height; i++) {
      // 在原代码中数据可能采用的是 BGRA/RGBA 的某种特定排列
      pixels[i * 4 + 2] = (data[i] & 0x000000FF) >> 0;  // blue
      pixels[i * 4 + 1] = (data[i] & 0x0000FF00) >> 8;  // green
      pixels[i * 4 + 0] = (data[i] & 0x00FF0000) >> 16; // red
      pixels[i * 4 + 3] = ((data[i] & 0xFF000000) >> 24) & 0xFF; // alpha
    }

    ctx.putImageData(image, 0, 0);
    return c;
  }
};
