import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { CLIP_BUTTON_SIZE, clipShapePath } from "./clipShapes";
import type { ClipShape } from "./clipShapes";

export type { ClipShape };

const EDGE_WIDTH = 2;

export function ClipButton({
  shape,
  variant,
  icon,
  children,
  className = "",
  style,
  ...rest
}: {
  shape: ClipShape;
  variant: "glass" | "solid" | "ember";
  icon?: ReactNode;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { width, height } = CLIP_BUTTON_SIZE;
  const d = clipShapePath(shape, CLIP_BUTTON_SIZE);
  const cls = `ui-btn ui-btn--${variant} oc-btn-clip ${className}`.trim();

  return (
    <button
      className={cls}
      style={{ width, height, clipPath: `path('${d}')`, ...style } as CSSProperties}
      {...rest}
    >
      <svg className="oc-btn-clip__edge" viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <path d={d} fill="none" stroke="currentColor" strokeWidth={EDGE_WIDTH} />
      </svg>
      {icon && <span className="ui-btn__ic oc-btn-clip__ic">{icon}</span>}
      <span className="ui-btn__lb">{children}</span>
    </button>
  );
}
