export type ArticleHeading = { id: string; text: string; level: number };

export function headingTone(text: string) {
  const label = text.trim().toLowerCase();
  return label === "too hot" ? "hot" : label === "just right" ? "balanced" : "cold";
}

export function createHeadingId(reserved: Iterable<string> = []) {
  const used = new Set(reserved);
  return (text: string) => {
    const base = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section";
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    used.add(id);
    return id;
  };
}

export function portableHeadings(blocks: any[] = []) {
  const nextId = createHeadingId();
  return blocks.filter((block) => block._type === "block" && /^h[1-4]$/.test(block.style)).map((block) => {
    const text = (block.children || []).map((child: { text?: string }) => child.text || "").join("");
    return { key: block._key, text, id: nextId(text), level: Math.max(2, Number(block.style.slice(1))) };
  });
}
