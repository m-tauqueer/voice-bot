import type { ReactNode } from "react";

export function Chip({
  active = false,
  icon,
  onRemove,
  onClick,
  children,
  className = "",
}: {
  active?: boolean;
  icon?: ReactNode;
  onRemove?: () => void;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const cls = `fpill${active ? " fpill--active" : ""} ${className}`.trim();

  if (onRemove) {
    return (
      <span className={cls} style={{ cursor: "default" }}>
        {icon}
        {children}
        <button type="button" className="ui-chip__x" aria-label="Remove" onClick={onRemove}>
          ✕
        </button>
      </span>
    );
  }

  return (
    <button type="button" className={cls} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}
