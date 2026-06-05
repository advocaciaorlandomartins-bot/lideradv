import crypto from "node:crypto";

// Standard PDF padding (ISO 32000-1 §7.6.3.3)
const PDF_PAD = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56, 0xff,
  0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80, 0x2f, 0x0c,
  0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

// Restricted permissions bitmask (bits 3,4,5,6 clear = no print/modify/copy/annotate)
const P_RESTRICTED = -3904; // 0xFFFFF0C0 as signed 32-bit int

function padPassword(pwd: string): Buffer {
  const raw = Buffer.from(pwd, "utf8").slice(0, 32);
  return Buffer.concat([raw, PDF_PAD]).slice(0, 32);
}

function rc4(key: Uint8Array, data: Uint8Array): Buffer {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) % 256;
    const t = s[i];
    s[i] = s[j];
    s[j] = t;
  }
  let x = 0,
    y = 0;
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    x = (x + 1) % 256;
    y = (y + s[x]) % 256;
    const t = s[x];
    s[x] = s[y];
    s[y] = t;
    out[i] = data[i] ^ s[(s[x] + s[y]) % 256];
  }
  return out;
}

// Algorithm 3: compute /O entry
function computeO(userPwd: string, ownerPwd: string): Buffer {
  let h = crypto.createHash("md5").update(padPassword(ownerPwd)).digest();
  for (let i = 0; i < 50; i++) h = crypto.createHash("md5").update(h).digest();
  const key = h; // 16 bytes
  let o = rc4(key, padPassword(userPwd));
  for (let i = 1; i <= 19; i++) {
    const k = Buffer.from(key.map((b) => b ^ i));
    o = rc4(k, o);
  }
  return o;
}

// Algorithm 2: compute 128-bit encryption key
function computeEncKey(
  userPwd: string,
  O: Buffer,
  P: number,
  fileId: Buffer
): Buffer {
  const pBuf = Buffer.alloc(4);
  pBuf.writeInt32LE(P, 0);
  let h = crypto
    .createHash("md5")
    .update(padPassword(userPwd))
    .update(O)
    .update(pBuf)
    .update(fileId.slice(0, 16))
    .digest();
  for (let i = 0; i < 50; i++) h = crypto.createHash("md5").update(h).digest();
  return h; // 16 bytes
}

// Algorithm 5 (R3): compute /U entry
function computeU(encKey: Buffer, fileId: Buffer): Buffer {
  let u: Uint8Array = Buffer.from(
    crypto
      .createHash("md5")
      .update(PDF_PAD)
      .update(fileId.slice(0, 16))
      .digest()
  );
  u = rc4(encKey, u);
  for (let i = 1; i <= 19; i++) {
    const k = Uint8Array.from(encKey.map((b) => b ^ i));
    u = rc4(k, u);
  }
  return Buffer.concat([Buffer.from(u), Buffer.alloc(16)]); // 32 bytes
}

// Per-object key (§7.6.3.1)
function objectKey(encKey: Buffer, objNum: number, genNum: number): Buffer {
  const suffix = Buffer.alloc(5);
  suffix.writeUIntLE(objNum & 0xffffff, 0, 3);
  suffix.writeUInt16LE(genNum & 0xffff, 3);
  const h = crypto.createHash("md5").update(encKey).update(suffix).digest();
  return h.slice(0, Math.min(encKey.length + 5, 16));
}

interface XrefEntry {
  objNum: number;
  gen: number;
  offset: number;
}

// Parse traditional xref table, return sorted by offset
function parseXref(buf: Buffer): XrefEntry[] {
  const text = buf.toString("binary");
  // Find xref keyword (not inside a stream)
  const xrefIdx = text.lastIndexOf("\nxref\n");
  if (xrefIdx === -1) return [];

  const entries: XrefEntry[] = [];
  let pos = xrefIdx + 6; // skip '\nxref\n'

  while (pos < text.length) {
    // Skip whitespace/newlines
    while (pos < text.length && /\s/.test(text[pos])) pos++;
    if (text.startsWith("trailer", pos)) break;

    // Read "first count" line
    const lineEnd = text.indexOf("\n", pos);
    if (lineEnd === -1) break;
    const parts = text.slice(pos, lineEnd).trim().split(/\s+/);
    if (parts.length !== 2) break;
    const first = parseInt(parts[0]);
    const count = parseInt(parts[1]);
    if (isNaN(first) || isNaN(count)) break;
    pos = lineEnd + 1;

    for (let i = 0; i < count; i++) {
      const entryEnd = text.indexOf("\n", pos);
      if (entryEnd === -1) break;
      const entry = text.slice(pos, entryEnd).trim();
      pos = entryEnd + 1;
      const ep = entry.split(/\s+/);
      if (ep.length < 3) continue;
      const offset = parseInt(ep[0]);
      const gen = parseInt(ep[1]);
      const flag = ep[2];
      if (flag === "n" && !isNaN(offset)) {
        entries.push({ objNum: first + i, gen, offset });
      }
    }
  }

  return entries.sort((a, b) => a.offset - b.offset);
}

// Find streams in the PDF buffer; returns array of {dataStart, dataEnd, objNum, genNum}
function findStreams(
  buf: Buffer,
  xref: XrefEntry[]
): Array<{
  dataStart: number;
  dataEnd: number;
  objNum: number;
  genNum: number;
}> {
  const results: Array<{
    dataStart: number;
    dataEnd: number;
    objNum: number;
    genNum: number;
  }> = [];

  const STREAM = Buffer.from("stream\n");
  const STREAM_CR = Buffer.from("stream\r\n");
  const ENDSTREAM = Buffer.from("endstream");

  let pos = 0;
  while (pos < buf.length) {
    // Try both \n and \r\n variants
    let streamMarkerEnd = -1;
    let found = buf.indexOf(STREAM_CR, pos);
    if (found !== -1) {
      streamMarkerEnd = found + STREAM_CR.length;
    }
    const found2 = buf.indexOf(STREAM, pos);
    if (found2 !== -1 && (found === -1 || found2 < found)) {
      found = found2;
      streamMarkerEnd = found + STREAM.length;
    }
    if (found === -1) break;

    const dataStart = streamMarkerEnd;

    // Find endstream
    const endPos = buf.indexOf(ENDSTREAM, dataStart);
    if (endPos === -1) break;

    // Strip trailing CR/LF before endstream
    let dataEnd = endPos;
    if (dataEnd > 0 && buf[dataEnd - 1] === 0x0a) dataEnd--;
    if (dataEnd > 0 && buf[dataEnd - 1] === 0x0d) dataEnd--;

    // Find which object this stream belongs to (largest xref offset <= found)
    let objNum = 0,
      genNum = 0;
    for (const entry of xref) {
      if (entry.offset <= found) {
        objNum = entry.objNum;
        genNum = entry.gen;
      } else break;
    }

    results.push({ dataStart, dataEnd, objNum, genNum });
    pos = endPos + ENDSTREAM.length;
  }

  return results;
}

export function encryptPdf(pdfBytes: Uint8Array, password: string): Buffer {
  const buf = Buffer.from(pdfBytes);
  const fileId = crypto.randomBytes(16);
  const O = computeO(password, password);
  const encKey = computeEncKey(password, O, P_RESTRICTED, fileId);
  const U = computeU(encKey, fileId);

  // Parse xref to map offsets → object numbers
  const xref = parseXref(buf);

  // Find all stream data and encrypt in-place (RC4 = same length, safe to modify in place)
  const streams = findStreams(buf, xref);
  for (const s of streams) {
    const data = buf.slice(s.dataStart, s.dataEnd);
    const okey = objectKey(encKey, s.objNum, s.genNum);
    const encrypted = rc4(okey, data);
    encrypted.copy(buf, s.dataStart);
  }

  // Determine next object number
  const maxObjNum =
    xref.length > 0 ? Math.max(...xref.map((e) => e.objNum)) : 0;
  const encObjNum = maxObjNum + 1;

  // Get original startxref offset
  const text = buf.toString("binary");
  const sxIdx = text.lastIndexOf("startxref");
  const prevStartxref = parseInt(text.slice(sxIdx + 9).trim());

  // Find original /Size from trailer
  const trailerIdx = text.lastIndexOf("trailer");
  const origSize = (() => {
    const m = text.slice(trailerIdx).match(/\/Size\s+(\d+)/);
    return m ? parseInt(m[1]) : encObjNum;
  })();

  // Build /Encrypt dict
  const OHex = O.toString("hex").toUpperCase();
  const UHex = U.toString("hex").toUpperCase();
  const encObj = Buffer.from(
    `${encObjNum} 0 obj\n<< /Filter /Standard /V 2 /R 3 /Length 128 /P ${P_RESTRICTED} /O <${OHex}> /U <${UHex}> >>\nendobj\n`,
    "ascii"
  );

  // /Encrypt object is appended right after the (modified) original PDF
  const encObjOffset = buf.length;

  // xref section starts after the /Encrypt object
  const xrefOffset = encObjOffset + encObj.length;

  // Build xref section — entry must be exactly 20 bytes per PDF spec
  const xrefSection = Buffer.from(
    `xref\n${encObjNum} 1\n${String(encObjOffset).padStart(10, "0")} 00000 n \n`,
    "ascii"
  );

  // startxref points to where the xref section begins
  const startxrefValue = xrefOffset;

  const rootRef =
    text.slice(trailerIdx).match(/\/Root\s+(\d+ \d+ R)/)?.[1] ?? "1 0 R";
  const idHex = fileId.toString("hex").toUpperCase();
  const newTrailer = Buffer.from(
    `trailer\n<< /Size ${origSize + 1} /Root ${rootRef} /Encrypt ${encObjNum} 0 R /ID [<${idHex}><${idHex}>] /Prev ${prevStartxref} >>\nstartxref\n${startxrefValue}\n%%EOF\n`,
    "ascii"
  );

  return Buffer.concat([buf, encObj, xrefSection, newTrailer]);
}
