// 아주 작은 zip 읽기 — HWPX·DOCX·XLSX는 모두 zip 안의 XML이다. 외부 라이브러리 없이 브라우저의 DecompressionStream으로 푼다.
export type ZipEntry = {name: string; read: () => Promise<Uint8Array>};

const u16 = (b: DataView, o: number) => b.getUint16(o, true);
const u32 = (b: DataView, o: number) => b.getUint32(o, true);

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function readZip(buf: ArrayBuffer): ZipEntry[] {
  const v = new DataView(buf), bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (u32(v, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('zip 형식이 아닙니다');
  const count = u16(v, eocd + 10);
  let p = u32(v, eocd + 16);
  const dec = new TextDecoder();
  const out: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (u32(v, p) !== 0x02014b50) break;
    const method = u16(v, p + 10), csize = u32(v, p + 20), nlen = u16(v, p + 28), xlen = u16(v, p + 30), clen = u16(v, p + 32), local = u32(v, p + 42);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    out.push({name, read: async () => {
      const start = local + 30 + u16(v, local + 26) + u16(v, local + 28);
      const raw = bytes.subarray(start, start + csize);
      if (method === 0) return raw;
      if (method === 8) return inflateRaw(raw);
      throw new Error(`지원하지 않는 압축 방식(${method})`);
    }});
  }
  return out;
}

export async function zipText(entries: ZipEntry[], name: string): Promise<string | undefined> {
  const e = entries.find(x => x.name === name);
  return e ? new TextDecoder().decode(await e.read()) : undefined;
}
