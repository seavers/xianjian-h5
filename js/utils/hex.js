const code = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];

export const Hex = {
  toHex(dec) {
    const h = (dec & 0xF0) >> 4;
    const l = (dec & 0x0F) >> 0;
    return code[h] + code[l];
  },

  toHex2(dec) {
    const b0 = (dec & 0x0000000F) >> 0;
    const b1 = (dec & 0x000000F0) >> 4;
    const b2 = (dec & 0x00000F00) >> 8;
    const b3 = (dec & 0x0000F000) >> 12;
    return code[b3] + code[b2] + code[b1] + code[b0];
  },

  toHex4(dec) {
    const b0 = (dec & 0x0000000F) >> 0;
    const b1 = (dec & 0x000000F0) >> 4;
    const b2 = (dec & 0x00000F00) >> 8;
    const b3 = (dec & 0x0000F000) >> 12;
    const b4 = (dec & 0x000F0000) >> 16;
    const b5 = (dec & 0x00F00000) >> 20;
    const b6 = (dec & 0x0F000000) >> 24;
    const b7 = (dec & 0xF0000000) >> 28;
    return code[b7] + code[b6] + code[b5] + code[b4] + code[b3] + code[b2] + code[b1] + code[b0];
  }
};

// 兼容老代码的导出
export const toHex = Hex.toHex;
export const toHex2 = Hex.toHex2;
export const toHex4 = Hex.toHex4;
