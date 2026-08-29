import { MemoryIcon } from "../../lib/memory-icons";
import { Card } from "../../components/ui/Card";
import { CONNECTORS } from "../data";
import type { Connector } from "../data";

function ConnectorRow({ connector }: { connector: Connector }) {
  return (
    <button className="mc-conn">
      <span className="mc-conn__glyph"><MemoryIcon name={connector.icon} size={18} weight={1.8} /></span>
      <span className="mc-conn__body">
        <span className="mc-conn__name">{connector.name}</span>
        <span className="mc-conn__sub">{connector.sub} · {connector.items.toLocaleString()} items</span>
      </span>
      <span className="mc-status">
        <span className={"mc-status__dot mc-status__dot--" + connector.status} />
        {connector.statusLabel}
      </span>
    </button>
  );
}

export function ConnectorList() {
  return (
    <Card variant="glass" className="mc-connlist">
      {CONNECTORS.map((connector) => <ConnectorRow key={connector.id} connector={connector} />)}

      <button className="mc-conn mc-conn--add">
        <span className="mc-conn__glyph mc-conn__glyph--add"><MemoryIcon name="plus" size={17} weight={2} /></span>
        <span className="mc-conn__body"><span className="mc-conn__name">Add a connector</span></span>
      </button>
    </Card>
  );
}
