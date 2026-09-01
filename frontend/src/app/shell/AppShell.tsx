import { useEffect, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import Grainient from "../../components/Grainient";
import { RadialMenu } from "../../components/RadialMenu";
import type { NavItem } from "../../lib/nav";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppShellProps {
  active: string;
  items: NavItem[];
  brand: string;
  homeTo: string;
  personaName: string;
  accountEmail: string;
  signOutLabel: string;
  onSignOut: () => void;
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

export function AppShell({
  active,
  items,
  brand,
  homeTo,
  personaName,
  accountEmail,
  signOutLabel,
  onSignOut,
  flush = false,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dialOpen, setDialOpen] = useState(false);

  useDialShortcut(setDialOpen);

  return (
    <div className={"mc-app" + (collapsed ? " mc-app--collapsed" : "")}>
      <Grainient color3="#202028" saturation={0.7} />

      <Sidebar
        active={active}
        items={items}
        brand={brand}
        homeTo={homeTo}
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        onOpenDial={() => setDialOpen(true)}
      />

      <div className="mc-main">
        <TopBar
          personaName={personaName}
          accountEmail={accountEmail}
          signOutLabel={signOutLabel}
          onSignOut={onSignOut}
        />
        <div className={"mc-canvas" + (flush ? " mc-canvas--flush" : "")}>{children}</div>
      </div>

      <RadialMenu
        open={dialOpen}
        onClose={() => setDialOpen(false)}
        items={items.map((item) => ({
          icon: item.icon,
          name: item.label,
          to: item.to,
          items: [item.label],
        }))}
      />
    </div>
  );
}
