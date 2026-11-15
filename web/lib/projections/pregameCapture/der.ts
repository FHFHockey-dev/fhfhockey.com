/** Minimal strict DER reader/writer for RFC 3161 tokens. No dependency, no BER leniency. */

export interface DerNode {
  tag: number; // full first identifier byte
  start: number; // offset of identifier byte
  headerLength: number;
  length: number;
  bytes: Buffer; // whole TLV
  value: Buffer; // contents only
  children?: DerNode[];
}

const CONSTRUCTED = 0x20;

export function readDer(buffer: Buffer, offset = 0, end = buffer.length): DerNode {
  if (offset + 2 > end) throw new Error("der_truncated");
  const tag = buffer[offset];
  if ((tag & 0x1f) === 0x1f) throw new Error("der_high_tag_unsupported");
  let pos = offset + 1;
  let length = buffer[pos++];
  if (length & 0x80) {
    const count = length & 0x7f;
    if (count === 0 || count > 4) throw new Error("der_bad_length");
    if (pos + count > end) throw new Error("der_truncated");
    length = 0;
    for (let i = 0; i < count; i++) length = length * 256 + buffer[pos++];
    if (length < 0x80 || (count > 1 && buffer[pos - count] === 0)) throw new Error("der_non_minimal_length");
  }
  const headerLength = pos - offset;
  if (pos + length > end) throw new Error("der_truncated");
  const node: DerNode = {
    tag, start: offset, headerLength, length,
    bytes: buffer.subarray(offset, pos + length), value: buffer.subarray(pos, pos + length),
  };
  if (tag & CONSTRUCTED) {
    node.children = [];
    let child = pos;
    while (child < pos + length) {
      const next = readDer(buffer, child, pos + length);
      node.children.push(next);
      child = next.start + next.headerLength + next.length;
    }
  }
  return node;
}

export function parseDerExact(buffer: Buffer): DerNode {
  const node = readDer(buffer);
  if (node.bytes.length !== buffer.length) throw new Error("der_trailing_bytes");
  return node;
}

export function kids(node: DerNode, expectTag?: number): DerNode[] {
  if (expectTag !== undefined && node.tag !== expectTag) throw new Error(`der_unexpected_tag:${node.tag.toString(16)}`);
  if (!node.children) throw new Error("der_not_constructed");
  return node.children;
}

export function oid(node: DerNode): string {
  if (node.tag !== 0x06 || node.value.length === 0) throw new Error("der_not_oid");
  const bytes = node.value;
  if (bytes[bytes.length - 1] & 0x80) throw new Error("der_oid_truncated");
  const parts: string[] = [];
  let value = BigInt(0);
  let started = false;
  for (let i = 0; i < bytes.length; i++) {
    if (!started && bytes[i] === 0x80) throw new Error("der_oid_non_minimal");
    started = true;
    value = value * BigInt(128) + BigInt(bytes[i] & 0x7f);
    if (!(bytes[i] & 0x80)) {
      if (parts.length === 0) {
        const first = value < BigInt(80) ? value / BigInt(40) : BigInt(2);
        parts.push(first.toString(), (value - first * BigInt(40)).toString());
      } else parts.push(value.toString());
      value = BigInt(0);
      started = false;
    }
  }
  return parts.join(".");
}

export function integer(node: DerNode): bigint {
  // Universal INTEGER, or a context-specific PRIMITIVE implicit integer (constructed encodings are refused).
  if (node.tag !== 0x02 && ((node.tag & 0xc0) !== 0x80 || (node.tag & 0x20) !== 0)) throw new Error("der_not_integer");
  const bytes = node.value;
  if (bytes.length === 0) throw new Error("der_empty_integer");
  if (bytes.length > 1 && ((bytes[0] === 0x00 && !(bytes[1] & 0x80)) || (bytes[0] === 0xff && (bytes[1] & 0x80)))) throw new Error("der_integer_non_minimal");
  let value = BigInt(0);
  for (const byte of bytes) value = (value << BigInt(8)) | BigInt(byte);
  if (bytes[0] & 0x80) value -= BigInt(1) << BigInt(bytes.length * 8);
  return value;
}

/** GeneralizedTime "YYYYMMDDHHMMSS[.fff…]Z" → microseconds since epoch, rounded up (conservative upper bound). */
export function generalizedTimeMicros(node: DerNode): { micros: bigint; text: string } {
  if (node.tag !== 0x18) throw new Error("der_not_generalized_time");
  const text = node.value.toString("latin1");
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.(\d*[1-9]))?Z$/.exec(text);
  if (!match) throw new Error("der_bad_generalized_time");
  const [, y, mo, d, h, mi, s, fraction = ""] = match;
  const year = Number(y), month = Number(mo), day = Number(d), hour = Number(h), minute = Number(mi), second = Number(s);
  // Date.UTC would silently normalise month 13, hour 24 or years 0-99; refuse instead.
  if (year < 1970 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()
    || hour > 23 || minute > 59 || second > 59) throw new Error("der_generalized_time_range");
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  const padded = fraction.padEnd(9, "0");
  let micros = BigInt(ms) * BigInt(1000) + BigInt(padded.slice(0, 6));
  if (/[1-9]/.test(padded.slice(6))) micros += BigInt(1);
  return { micros, text };
}

/**
 * Buffer is a Uint8Array at runtime, but @types/node 18 Buffers do not type-check against TS 5.7's
 * generic Uint8Array parameters. u8() is a zero-cost type view for those call sites.
 */
export const u8 = (bytes: Buffer | Uint8Array): Uint8Array => bytes as unknown as Uint8Array;
export const concatBytes = (parts: Array<Buffer | Uint8Array>): Buffer => Buffer.concat(parts.map(u8));

// ----- writer (TimeStampReq only) -----

function encodeLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  const bytes: number[] = [];
  for (let v = length; v > 0; v = Math.floor(v / 256)) bytes.unshift(v & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
export const tlv = (tag: number, value: Buffer) => concatBytes([Buffer.from([tag]), encodeLength(value.length), value]);
export const seq = (...items: Buffer[]) => tlv(0x30, concatBytes(items));
export function encodeOid(text: string): Buffer {
  const parts = text.split(".").map(Number);
  const out: number[] = [parts[0] * 40 + parts[1]];
  for (const part of parts.slice(2)) {
    const stack: number[] = [part & 0x7f];
    for (let v = Math.floor(part / 128); v > 0; v = Math.floor(v / 128)) stack.unshift((v & 0x7f) | 0x80);
    out.push(...stack);
  }
  return tlv(0x06, Buffer.from(out));
}
export function encodeUnsigned(value: bigint): Buffer {
  if (value < BigInt(0)) throw new Error("der_negative");
  let hex = value.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let bytes = Buffer.from(hex, "hex");
  if (bytes[0] & 0x80) bytes = concatBytes([Buffer.from([0]), bytes]);
  return tlv(0x02, bytes);
}
