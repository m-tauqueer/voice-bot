import { ArrowLeft, Plus } from "./icons";

function Stat({ n, label, badge, tone }: { n: string; label: string; badge: string; tone: "green" | "red" }) {
  return (
    <div className="stat">
      <div className="stat__num">
        {n}
        <span className={"stat__badge stat__badge--" + tone}>{badge}</span>
      </div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

export function WorkspaceHeader() {
  return (
    <div className="wshead">
      <button className="ibtn wshead__back" aria-label="Back"><ArrowLeft size={20} /></button>

      <h1 className="wshead__title">
        W<span className="wshead__target"><img src="/Logo-white.svg" style={{ marginTop: "6px" }} alt="Target" width={48} height={48} /></span>RKSPACE
      </h1>

      <button className="wshead__new">
        <span className="wshead__newicon"><Plus size={16} /></span>
        New Task
      </button>

      <div className="wshead__stats">
        <Stat n="34" label="Deals" badge="+3" tone="green" />
        <Stat n="20" label="won" badge="+2" tone="green" />
        <Stat n="3" label="lost" badge="-1" tone="red" />
      </div>
    </div>
  );
}
