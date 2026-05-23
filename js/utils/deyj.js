import { ByteArray } from './view.js';

export function deyj(src) {
  if (src.getInt(0) !== 0x315F4A59) { // YJ_1 魔法字符，用于标识 YJ_1 压缩
    return src;
  }

  const data = src.toDataView();    
  
  data.skipByte(4); // YJ_1
  const UncompressedLength = data.nextInt(); 
  const CompressedLength = data.nextInt();   
  const BlockCount = data.nextShort();       
  const reserved = data.nextByte();          
  const HuffmanTreeLength = data.nextByte(); 

  const huffmanTreeLen = HuffmanTreeLength * 2;
  const leafView = src.toDataView(16 + huffmanTreeLen);

  // 构建 Huffman 树
  const codes = []; // huffman array
  (() => {
    codes[0] = {
      i: 0,
      leaf: false,
      value: 0,
      left: 1,
      right: 2
    };
    for (let i = 1; i <= huffmanTreeLen; i++) {
      const leaf = !leafView.nextBits(1);
      const value = data.nextByte();
      codes[i] = {
        i: i,
        leaf: leaf,
        value: value,
        left: leaf ? null : (value * 2 + 1),
        right: leaf ? null : (value * 2 + 2)
      };
    }

    for (let i = 0; i <= huffmanTreeLen; i++) {
      codes[i].left = codes[codes[i].left];
      codes[i].right = codes[codes[i].right];
    }
  })();

  const n = ((huffmanTreeLen & 0xf) ? (huffmanTreeLen >> 4) + 1 : (huffmanTreeLen >> 4)) << 1; 
  data.skipByte(n);

  let buf = [];

  let LZSSRepeatTable = null;
  let LZSSOffsetCodeLengthTable = null;
  let LZSSRepeatCodeLengthTable = null;
  let CodeCountCodeLengthTable = null;
  let CodeCountTable = null;

  for (let i = 0; i < BlockCount; i++) {
    const block = data.nextView();

    const bUncompressedLength = block.nextShort();
    const bCompressedLength = block.nextShort(); 
    LZSSRepeatTable = block.nextShortArray(4);
    LZSSOffsetCodeLengthTable = block.nextByteArray(4);
    LZSSRepeatCodeLengthTable = block.nextByteArray(3);
    CodeCountCodeLengthTable = block.nextByteArray(3);
    CodeCountTable = block.nextByteArray(2);

    if (bCompressedLength === 0) {
      const temp = data.nextView();
      temp.skipByte(4);
      buf = [];
      for (let j = 0; j < bUncompressedLength; j++) {
        buf.push(temp.getByte());
      }
      continue;
    }

    while (true) {
      const loop = getLoop(block);
      if (!loop) break;

      for (let j = 0; j < loop; j++) {
        let node = codes[0];
        while (!node.leaf) {
          const bit = block.nextBits(1);
          node = bit ? node.right : node.left;
        }
        buf[buf.length] = node.value;
      }

      const loop2 = getLoop(block);
      if (!loop2) break;

      for (let j = 0; j < loop2; j++) {
        const count = getCount(block);
        const pos1 = block.nextBits(2);
        const pos2 = block.nextBits(LZSSOffsetCodeLengthTable[pos1]);
        const pos = pos2;

        for (let k = 0; k < count; k++) {
          buf[buf.length] = buf[buf.length - pos];
        }
      }
    }
    data.skipByte(bCompressedLength);

    if (buf.length > 65536) {
      alert('解压溢出: ' + buf.length);
      break;
    }
  }

  function getLoop(block) {
    const temp1 = block.nextBits(1);
    if (temp1) {
      return CodeCountTable[0];
    } else {
      let temp;
      if ((temp = block.nextBits(2))) {
        return block.nextBits(CodeCountCodeLengthTable[temp - 1]);
      } else {
        return CodeCountTable[1];
      }
    }  
  }

  function getCount(block) {
    let temp;
    if ((temp = block.nextBits(2))) {
      if (block.nextBits(1)) {
        return block.nextBits(LZSSRepeatCodeLengthTable[temp - 1]);
      } else {
        return LZSSRepeatTable[temp];
      }
    } else {
      return LZSSRepeatTable[0];
    }
  }

  return new ByteArray(buf);
}
