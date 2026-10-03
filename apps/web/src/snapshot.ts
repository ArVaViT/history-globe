/**
 * A picture of the map for a lesson or a sermon slide: the view as drawn, with a band
 * under it naming what is shown and the year, the site, and the map's attribution (the
 * data's licences ask for it on every copy).
 */
export async function mapPicture(o: {
  shot: { image: string; width: number; height: number; attribution: string };
  title: string;
  year: string;
  site: string;
}): Promise<Blob | null> {
  const img = new Image();
  img.src = o.shot.image;
  await img.decode();
  // The map's canvas is in device pixels: the band is drawn at the same scale.
  const k = o.shot.width / Math.max(1, document.documentElement.clientWidth);
  const px = (n: number) => Math.round(n * k);
  const pad = px(20);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const small = `${String(px(11.5))}px "Golos Text", system-ui, sans-serif`;
  ctx.font = small;
  const lines = wrap(ctx, o.shot.attribution, o.shot.width - pad * 2);
  const band = px(58) + lines.length * px(15);
  canvas.width = o.shot.width;
  canvas.height = o.shot.height + band;
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = "#f6efe1";
  ctx.fillRect(0, o.shot.height, canvas.width, band);

  const top = o.shot.height + px(32);
  ctx.font = `${String(px(14))}px "Golos Text", system-ui, sans-serif`;
  const siteWidth = ctx.measureText(o.site).width;
  ctx.fillStyle = "#9a3b1f";
  ctx.fillText(o.site, canvas.width - pad - siteWidth, top);
  ctx.font = `600 ${String(px(21))}px Literata, Georgia, serif`;
  ctx.fillStyle = "#2b2418";
  ctx.fillText(
    o.title ? `${o.title} · ${o.year}` : o.year,
    pad,
    top,
    canvas.width - pad * 3 - siteWidth,
  );
  ctx.font = small;
  ctx.fillStyle = "#6b5d48";
  lines.forEach((line, i) => {
    ctx.fillText(line, pad, top + px(22) + i * px(15));
  });
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
}

/** Text broken into lines no wider than `width`, at the word. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Hands the browser a file to save. */
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
