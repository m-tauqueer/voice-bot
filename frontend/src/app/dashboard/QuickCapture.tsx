import { MemoryIcon } from "../../lib/memory-icons";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

const SOURCES = [
  { id: "notion", icon: "note", label: "Notion", active: false },
  { id: "slack", icon: "chat", label: "Slack", active: true },
  { id: "web", icon: "globe", label: "Web clip", active: false },
];

export function QuickCapture() {
  return (
    <Card variant="glass" className="mc-capture">
      <div className="mc-capture__row">
        {SOURCES.map((source) => (
          <button key={source.id} className={"mc-capture__btn" + (source.active ? " is-active" : "")}>
            <span className="mc-capture__btn-ic"><MemoryIcon name={source.icon} size={15} weight={1.8} /></span>{source.label}
          </button>
        ))}
      </div>

      <div className="mc-capture__foot">
        <span className="mc-capture__hint">
          <MemoryIcon name="upload" size={14} weight={1.8} /> Drop a file or paste a URL to capture instantly
        </span>
        <Button variant="danger" size="sm" icon={<MemoryIcon name="trash" size={14} weight={1.8} />}>Clear queue</Button>
      </div>
    </Card>
  );
}
