import { MemoryIcon } from "../../lib/memory-icons";
import { DotMeter } from "../../components/ui/Meter";
import { ArrowUpRight, Bell } from "../../components/icons";
import { useCornerNotch } from "../../components/useCornerNotch";
import { FEATURED_MEMORY } from "../data";

const NOTCHES = [{ cxR: 33, cy: 27, r: 21 }, { cxR: 79, cy: 27, r: 19 }];
const NOTCH_SWEEP = { sweep: 30 };

export function FeaturedMemory() {
  const ref = useCornerNotch(NOTCHES, NOTCH_SWEEP);
  const memory = FEATURED_MEMORY;

  return (
    <article className="lead-wrap mc-feat">
      <div className="lead" ref={ref}>
        <div className="oc-mem__top" style={{ paddingRight: 100 }}>
          <span className="oc-mem__glyph"><MemoryIcon name={memory.icon} size={20} weight={1.7} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="oc-mem__src">{memory.source} · top recalled</div>
            <div className="oc-mem__kind">Memory</div>
          </div>
        </div>

        <div className="oc-mem__title">{memory.title}</div>
        <p className="oc-mem__excerpt">{memory.excerpt}</p>

        <div className="oc-mem__foot">
          <div className="oc-mem__tags">
            {memory.tags.map((tag) => <span key={tag} className="tagchip">{tag}</span>)}
          </div>
          <DotMeter value={memory.recalls} />
        </div>
      </div>

      <button className="float float--bell" aria-label="Set a reminder"><Bell size={15} /><span className="ping" /></button>
      <button className="float float--arrow" aria-label="Open memory"><ArrowUpRight size={16} /></button>
    </article>
  );
}
