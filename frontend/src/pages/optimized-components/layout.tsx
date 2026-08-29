import type { ReactNode } from "react";

export function Sec({ id, eyebrow, title, desc, children }: {
  id: string;
  eyebrow: string;
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="oc-sec">
      <header className="oc-sec__head">
        <div className="oc-sec__eyebrow">{eyebrow}</div>
        <h2 className="oc-sec__title">{title}</h2>
        {desc && <p className="oc-sec__desc">{desc}</p>}
      </header>
      {children}
    </section>
  );
}

export function Demo({ label, children, col = false, start = false }: {
  label: string;
  children: ReactNode;
  col?: boolean;
  start?: boolean;
}) {
  const stageClass = "oc-demo__stage"
    + (col ? " oc-demo__stage--col" : "")
    + (start ? " oc-demo__stage--start" : "");

  return (
    <div className="oc-demo">
      <div className={stageClass}>{children}</div>
      <div className="oc-demo__label">{label}</div>
    </div>
  );
}

export function Kbd({ children, pressed = false }: { children: ReactNode; pressed?: boolean }) {
  return <kbd className={"oc-kbd" + (pressed ? " oc-kbd--press" : "")}>{children}</kbd>;
}
