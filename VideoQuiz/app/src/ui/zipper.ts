export async function zipBlobs(files: { name: string; blob: Blob }[]): Promise<Blob> {
  // Minimal ZIP writer (store only). For simplicity, we implement a tiny ZIP per spec.
  const encoder = new TextEncoder()
  let offset = 0
  const fileRecords: { name: string; localHeader: Uint8Array; data: Uint8Array; crc32: number; localOffset: number; centralHeader: Uint8Array }[] = []

  function crc32(bytes: Uint8Array) {
    let c = ~0
    for (let i = 0; i < bytes.length; i++) {
      c ^= bytes[i]
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    return ~c >>> 0
  }

  function dv(len: number) {
    return new DataView(new ArrayBuffer(len))
  }

  for (const f of files) {
    const nameBytes = encoder.encode(f.name)
    const data = new Uint8Array(await f.blob.arrayBuffer())
    const crc = crc32(data)
    const lh = dv(30 + nameBytes.length)
    let p = 0
    lh.setUint32(p, 0x04034b50, true); p += 4 // local file header signature
    lh.setUint16(p, 20, true); p += 2 // version needed
    lh.setUint16(p, 0, true); p += 2 // general purpose
    lh.setUint16(p, 0, true); p += 2 // compression (0 = store)
    lh.setUint16(p, 0, true); p += 2 // mod time
    lh.setUint16(p, 0, true); p += 2 // mod date
    lh.setUint32(p, crc, true); p += 4
    lh.setUint32(p, data.length, true); p += 4 // compressed size
    lh.setUint32(p, data.length, true); p += 4 // uncompressed size
    lh.setUint16(p, nameBytes.length, true); p += 2
    lh.setUint16(p, 0, true); p += 2 // extra length
    const lhBytes = new Uint8Array(lh.buffer)
    lhBytes.set(nameBytes, 30)

    const ch = dv(46 + nameBytes.length)
    p = 0
    ch.setUint32(p, 0x02014b50, true); p += 4 // central header signature
    ch.setUint16(p, 20, true); p += 2 // version made by
    ch.setUint16(p, 20, true); p += 2 // version needed
    ch.setUint16(p, 0, true); p += 2 // general purpose
    ch.setUint16(p, 0, true); p += 2 // compression
    ch.setUint16(p, 0, true); p += 2 // mod time
    ch.setUint16(p, 0, true); p += 2 // mod date
    ch.setUint32(p, crc, true); p += 4
    ch.setUint32(p, data.length, true); p += 4
    ch.setUint32(p, data.length, true); p += 4
    ch.setUint16(p, nameBytes.length, true); p += 2
    ch.setUint16(p, 0, true); p += 2 // extra len
    ch.setUint16(p, 0, true); p += 2 // comment len
    ch.setUint16(p, 0, true); p += 2 // disk number
    ch.setUint16(p, 0, true); p += 2 // internal attrs
    ch.setUint32(p, 0, true); p += 4 // external attrs
    ch.setUint32(p, offset, true); p += 4 // local header offset
    const chBytes = new Uint8Array(ch.buffer)
    chBytes.set(nameBytes, 46)

    fileRecords.push({ name: f.name, localHeader: lhBytes, data, crc32: crc, localOffset: offset, centralHeader: chBytes })
    offset += lhBytes.length + data.length
  }

  let centralDirLen = 0
  for (const fr of fileRecords) centralDirLen += fr.centralHeader.length

  const out = new Uint8Array(offset + centralDirLen + 22)
  let pos = 0
  for (const fr of fileRecords) {
    out.set(fr.localHeader, pos); pos += fr.localHeader.length
    out.set(fr.data, pos); pos += fr.data.length
  }
  const centralStart = pos
  for (const fr of fileRecords) { out.set(fr.centralHeader, pos); pos += fr.centralHeader.length }
  const eocd = dv(22)
  let ep = 0
  eocd.setUint32(ep, 0x06054b50, true); ep += 4
  eocd.setUint16(ep, 0, true); ep += 2 // disk
  eocd.setUint16(ep, 0, true); ep += 2 // start disk
  eocd.setUint16(ep, fileRecords.length, true); ep += 2
  eocd.setUint16(ep, fileRecords.length, true); ep += 2
  eocd.setUint32(ep, centralDirLen, true); ep += 4
  eocd.setUint32(ep, centralStart, true); ep += 4
  eocd.setUint16(ep, 0, true); ep += 2 // comment len
  out.set(new Uint8Array(eocd.buffer), pos)
  return new Blob([out], { type: 'application/zip' })
}



