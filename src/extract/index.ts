// 업무자료에서 글자 뽑기. 원본은 읽기만 하고 고치지 않는다(대회 공통 규칙).
// 결과 조각마다 파일·위치를 남겨, 인수인계 초안의 출처로 쓴다.
import {readZip, zipText} from './zip';

export type Chunk = {id: string; file: string; kind: FileKind; loc: string; text: string};
export type FileKind = 'hwpx' | 'pdf' | 'xlsx' | 'docx' | 'text';
export type Skipped = {file: string; why: string};
export type InFile = {name: string; data: ArrayBuffer};
/** PDF는 pdf.js가 필요해 따로 넣는다(extract/pdf.ts). 쪽마다 글자를 돌려준다. */
export type PdfReader = (data: ArrayBuffer) => Promise<string[]>;

const ENT: Record<string, string> = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"};
const unxml = (s: string) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (_, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e] ?? `&${e};`);
const tags = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1]);
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 문단 단위(hp:p, w:p)로 글자를 모은다 */
function paragraphs(xml: string, p: string, t: string): string[] {
  return xml.split(new RegExp(`</${p}>`)).map(seg => clean(tags(seg, t).map(unxml).join(''))).filter(Boolean);
}

async function hwpx(f: InFile): Promise<Omit<Chunk, 'id'>[]> {
  const z = readZip(f.data);
  const secs = z.filter(e => /^Contents\/section\d+\.xml$/.test(e.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
  const out: Omit<Chunk, 'id'>[] = [];
  let n = 0;
  for (const s of secs) for (const text of paragraphs(new TextDecoder().decode(await s.read()), 'hp:p', 'hp:t')) out.push({file: f.name, kind: 'hwpx', loc: `${++n}문단`, text});
  return out;
}

async function docx(f: InFile): Promise<Omit<Chunk, 'id'>[]> {
  const xml = await zipText(readZip(f.data), 'word/document.xml');
  if (!xml) throw new Error('word/document.xml이 없습니다');
  return paragraphs(xml, 'w:p', 'w:t').map((text, i) => ({file: f.name, kind: 'docx', loc: `${i + 1}문단`, text}));
}

async function xlsx(f: InFile): Promise<Omit<Chunk, 'id'>[]> {
  const z = readZip(f.data);
  const shared = tags((await zipText(z, 'xl/sharedStrings.xml')) ?? '', 'si').map(si => unxml(tags(si, 't').join('')));
  const names = [...((await zipText(z, 'xl/workbook.xml')) ?? '').matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map(m => unxml(m[1]));
  const sheets = z.filter(e => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name)).sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
  const out: Omit<Chunk, 'id'>[] = [];
  for (const [si, s] of sheets.entries()) {
    const xml = new TextDecoder().decode(await s.read());
    for (const row of xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [...row[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(c => {
        const attr = c[1], body = c[2] ?? '';
        if (/\bt="s"/.test(attr)) return shared[Number(tags(body, 'v')[0])] ?? '';
        if (/\bt="inlineStr"/.test(attr)) return unxml(tags(body, 't').join(''));
        return unxml(tags(body, 'v')[0] ?? '');
      }).map(clean).filter(Boolean);
      if (cells.length) out.push({file: f.name, kind: 'xlsx', loc: `${names[si] ?? `시트${si + 1}`} ${row[1]}행`, text: cells.join(' | ')});
    }
  }
  return out;
}

function text(f: InFile): Omit<Chunk, 'id'>[] {
  const bytes = new Uint8Array(f.data);
  let s: string;
  try { s = new TextDecoder('utf-8', {fatal: true}).decode(bytes); } catch { s = new TextDecoder('euc-kr').decode(bytes); } // 오래된 한글 글은 EUC-KR
  return s.split(/\n\s*\n/).map(clean).filter(Boolean).map((t, i) => ({file: f.name, kind: 'text', loc: `${i + 1}단락`, text: t}));
}

const ext = (n: string) => n.toLowerCase().split('.').pop() ?? '';

/** 폴더째 넣은 파일들을 읽는다. 읽지 못한 파일은 이유와 함께 따로 돌려준다(조용히 버리지 않는다). */
export async function extractAll(files: InFile[], pdf?: PdfReader): Promise<{chunks: Chunk[]; skipped: Skipped[]}> {
  const chunks: Chunk[] = [], skipped: Skipped[] = [];
  for (const f of files) {
    const e = ext(f.name);
    try {
      let got: Omit<Chunk, 'id'>[];
      if (e === 'hwpx') got = await hwpx(f);
      else if (e === 'hwp') { skipped.push({file: f.name, why: '예전 한글 형식(HWP)이에요. 한글에서 HWPX로 저장해 넣어 주세요'}); continue; }
      else if (e === 'docx') got = await docx(f);
      else if (e === 'xlsx') got = await xlsx(f);
      else if (e === 'pdf') {
        if (!pdf) { skipped.push({file: f.name, why: 'PDF 읽기를 불러오지 못했어요'}); continue; }
        got = (await pdf(f.data)).flatMap((pg, i) => pg.split(/\n\s*\n/).map(clean).filter(Boolean).map(t => ({file: f.name, kind: 'pdf' as const, loc: `${i + 1}쪽`, text: t})));
      } else if (['txt', 'csv', 'md', 'eml'].includes(e)) got = text(f);
      else { skipped.push({file: f.name, why: '읽을 수 없는 형식이에요'}); continue; }
      if (!got.length) skipped.push({file: f.name, why: '글자를 찾지 못했어요(그림으로 된 문서일 수 있어요)'});
      got.forEach(c => chunks.push({...c, id: `c${chunks.length + 1}`}));
    } catch (err) {
      skipped.push({file: f.name, why: `읽다가 멈췄어요: ${(err as Error).message}`});
    }
  }
  return {chunks, skipped};
}
