// 部分short如65535，代表负数
export function intToShort(short) {
  if (short > 65536/2) {
    return short - 65536;
  } else {
    return short;
  }
}