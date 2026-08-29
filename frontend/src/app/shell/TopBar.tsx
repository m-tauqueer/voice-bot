import type { ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";
import { MemoryIcon } from "../../lib/memory-icons";
import { Avatar } from "../../components/Avatar";
import { CURRENT_USER } from "../data";

function isTypingInAField() {
  const el = document.activeElement;
  return el instanceof HTMLElement
    && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

function useSlashToSearch(inputRef: RefObject<HTMLInputElement>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingInAField()) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputRef]);
}

export function TopBar({ left, actions }: { left?: ReactNode; actions?: ReactNode }) {
  const searchRef = useRef<HTMLInputElement>(null);
  useSlashToSearch(searchRef);

  const today = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long" });

  return (
    <header className="mc-topbar">
      <div className="mc-topbar__bar">
        {left}

        <span className="mc-topbar__date">
          <MemoryIcon name="calendar" size={15} weight={1.8} />
          {today}
        </span>

        <label className="mc-topbar__search">
          <MemoryIcon name="search" size={16} weight={1.8} />
          <input ref={searchRef} placeholder="Search memories, people…" />
        </label>

        <span className="mc-topbar__spacer" />
        {actions}
      </div>

      <div className="mc-topbar__right">
        <button className="mc-topbar__bell" aria-label="Notifications">
          <MemoryIcon name="bell" size={18} weight={1.8} />
          <span className="mc-topbar__ping" />
        </button>
        <Avatar name={CURRENT_USER.name} src={CURRENT_USER.avatar} size={42} />
      </div>
    </header>
  );
}
