export class ByteArray {
  constructor(buffer, offset = 0, length) {
    this.buffer = buffer;
    this.byteOffset = offset;
    this.byteLength = length;
    this.length = length || buffer.length - this.byteOffset;
  }

  getByte(index) {
    return this.buffer[this.byteOffset + index];
  }

  getShort(index) {
    const high = this.getByte(index + 0);
    const low = this.getByte(index + 1);
    return low * 256 + high;
  }

  getInt(index) {
    const b1 = this.getByte(index + 0);
    const b2 = this.getByte(index + 1);
    const b3 = this.getByte(index + 2);
    const b4 = this.getByte(index + 3);
    return b4 * 256 * 256 * 256 + b3 * 256 * 256 + b2 * 256 + b1;
  }

  slice(start, end) {
    if (end > this.byteLength) {
      console.log('slice: ' + this.byteOffset + ' ' + this.byteLength + ' ' + start + ' ' + end);
      return;
    }
    if (end === 0) {
      end = this.byteLength;
    }
    try {
      return new ByteArray(this.buffer, this.byteOffset + start, end - start);
    } catch (e) {
      console.warn('[error]: slice ' + this.byteOffset + ' ' + this.byteLength + ' ' + start + ' ' + end);
    }
  }

  toDataView(offset = 0) {
    return new ByteView(this.buffer, this.byteOffset + offset);
  }
}

export class ByteView {
  constructor(buffer, offset = 0, length) {
    this.buffer = buffer;
    this.byteOffset = offset;
    this.byteLength = length || (buffer.length - offset);
    this.index = 0;
  }

  skipByte(count) {
    this.index += count;
  }

  _getShort(index) {
    const high = this.buffer[this.byteOffset + index + 0];
    const low = this.buffer[this.byteOffset + index + 1];
    return low * 256 + high;
  }

  nextByte() {
    const r = this.buffer[this.byteOffset + this.index];
    this.index += 1;
    return r;
  }

  nextShort() {
    const high = this.buffer[this.byteOffset + this.index + 0];
    const low = this.buffer[this.byteOffset + this.index + 1];
    const r = low * 256 + high;
    this.index += 2;
    return r;
  }

  nextInt() {
    const b1 = this.buffer[this.byteOffset + this.index + 0];
    const b2 = this.buffer[this.byteOffset + this.index + 1];
    const b3 = this.buffer[this.byteOffset + this.index + 2];
    const b4 = this.buffer[this.byteOffset + this.index + 3];
    const r = b4 * 256 * 256 * 256 + b3 * 256 * 256 + b2 * 256 + b1;
    this.index += 4;
    return r;
  }

  nextByteArray(count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr[i] = this.nextByte();
    }
    return arr;
  }

  nextShortArray(count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr[i] = this.nextShort();
    }
    return arr;
  }

  nextBits(count) {
    this.index = this.index || 0;
    this.bitptr = this.bitptr || 0;

    const temp = this._getShort(this.index + (this.bitptr >> 4) * 2);
    const bp = this.bitptr & 0xf;

    let ret = 0;
    if (count > 16 - bp) {
      const mask = 0xffff >> bp;
      const temp1 = this._getShort(this.index + (this.bitptr >> 4) * 2 + 2);
      ret = (((temp & mask) << (count + bp - 16)) | (temp1 >> (32 - count - bp))) & 0xFFFF;
    } else {
      ret = ((temp << bp) & 0xFFFF) >> (16 - count);
    }

    this.bitptr += count;
    return ret;
  }

  nextView() {
    return new ByteView(this.buffer, this.byteOffset + this.index);
  }
}
