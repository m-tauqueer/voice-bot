import { MemoryIcon } from "../../lib/memory-icons";
import { QUICK_ACTIONS } from "../data";
import type { QuickAction } from "../data";

function ActionTile({ action }: { action: QuickAction }) {
  return (
    <button className={"mc-action" + (action.primary ? " mc-action--primary" : "")}>
      <span className="mc-action__ic"><MemoryIcon name={action.icon} size={20} weight={1.8} /></span>
      <span className="mc-action__txt">
        <span className="mc-action__title">{action.title}</span>
        <span className="mc-action__sub">{action.sub}</span>
      </span>
      <span className="mc-action__arrow"><MemoryIcon name="chevron-right" size={16} weight={2} /></span>
    </button>
  );
}

export function QuickActions() {
  return (
    <div className="mc-actions">
      {QUICK_ACTIONS.map((action) => <ActionTile key={action.id} action={action} />)}
    </div>
  );
}
