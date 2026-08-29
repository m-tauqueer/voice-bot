import { useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import Grainient from "../../components/Grainient";
import { RadialMenu } from "../../components/RadialMenu";
import { Sidebar } from "./Sidebar";
import type { NavId } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  active: NavId;
  topLeft?: ReactNode;
  topActions?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}

function useDialShortcut(setOpen: Dispatch<SetStateAction<boolean>>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}

export function AppShell({ active, topLeft, topActions, flush = false, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dialOpen, setDialOpen] = useState(false);

  useDialShortcut(setDialOpen);

  return (
    <div className={"mc-app" + (collapsed ? " mc-app--collapsed" : "")}>
      <Grainient color3="#202028" saturation={0.7} />

      <Sidebar
        active={active}
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        onOpenDial={() => setDialOpen(true)}
      />

      <div className="mc-main">
        <TopBar left={topLeft} actions={topActions} />
        <div className={"mc-canvas" + (flush ? " mc-canvas--flush" : "")}>{children}</div>
      </div>

      <RadialMenu open={dialOpen} onClose={() => setDialOpen(false)} />
    </div>
  );
}
