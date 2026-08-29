export type ClipShape = "chamfer" | "leaf" | "tab";

export interface ClipGeometry {
  width: number;
  height: number;
}

export const CLIP_BUTTON_SIZE: ClipGeometry = { width: 150, height: 46 };

const RADIUS = {
  soft: 13 / 46,
  small: 12 / 46,
  large: 23 / 46,
};

const CHAMFER_CUT = 24 / 46;

type Corners = { tl: number; tr: number; br: number; bl: number };

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function clampRadius(r: number, w: number, h: number) {
  return round(Math.min(r, w / 2, h / 2));
}

function arc(r: number, x: number, y: number) {
  return `A ${r} ${r} 0 0 1 ${round(x)} ${round(y)}`;
}

function line(x: number, y: number) {
  return `L ${round(x)} ${round(y)}`;
}

function roundedPath(w: number, h: number, { tl, tr, br, bl }: Corners) {
  return [
    `M ${tl} 0`,
    line(w - tr, 0),
    arc(tr, w, tr),
    line(w, h - br),
    arc(br, w - br, h),
    line(bl, h),
    arc(bl, 0, h - bl),
    line(0, tl),
    arc(tl, tl, 0),
    "Z",
  ].join(" ");
}

function chamferPath(w: number, h: number, r: number, cut: number) {
  return [
    `M ${r} 0`,
    line(w - cut, 0),
    line(w, cut),
    line(w, h - r),
    arc(r, w - r, h),
    line(r, h),
    arc(r, 0, h - r),
    line(0, r),
    arc(r, r, 0),
    "Z",
  ].join(" ");
}

export function clipShapePath(shape: ClipShape, geometry: ClipGeometry = CLIP_BUTTON_SIZE) {
  const { width: w, height: h } = geometry;
  const soft = clampRadius(RADIUS.soft * h, w, h);
  const small = clampRadius(RADIUS.small * h, w, h);
  const large = clampRadius(RADIUS.large * h, w, h);

  if (shape === "chamfer") {
    const cut = round(Math.min(CHAMFER_CUT * h, w - soft, h - soft));
    return chamferPath(w, h, soft, cut);
  }

  if (shape === "leaf") {
    return roundedPath(w, h, { tl: large, tr: small, br: large, bl: small });
  }

  return roundedPath(w, h, { tl: small, tr: large, br: small, bl: large });
}
