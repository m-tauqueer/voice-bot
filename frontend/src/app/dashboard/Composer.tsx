import { useEffect, useRef, useState } from "react";
import { MemoryIcon } from "../../lib/memory-icons";
import { IconButton } from "../../components/ui/Button";
import { ArrowUpRight } from "../../components/icons";
import { MODELS } from "../data";

function useDismissOnOutsideClick(active: boolean, onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [active, onDismiss]);

  return ref;
}

function ModelPicker() {
  const [model, setModel] = useState(MODELS[0]);
  const [open, setOpen] = useState(false);
  const ref = useDismissOnOutsideClick(open, () => setOpen(false));

  return (
    <div className="mc-modelpick" ref={ref}>
      <button className="mc-modelpick__btn" onClick={() => setOpen((value) => !value)}>
        <span className="mc-modelpick__dot" />
        {model.label}
        <MemoryIcon name="chevron-down" size={13} weight={2} />
      </button>

      {open && (
        <div className="mc-modelpick__menu" role="menu">
          {MODELS.map((option) => (
            <button
              key={option.id}
              className={"mc-modelpick__opt" + (option.id === model.id ? " is-on" : "")}
              onClick={() => { setModel(option); setOpen(false); }}
            >
              <span className="mc-modelpick__optname">{option.label}</span>
              <span className="mc-modelpick__opthint">{option.hint}</span>
              {option.id === model.id && <MemoryIcon name="check" size={14} weight={2.6} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Composer() {
  const [text, setText] = useState("");

  return (
    <div className="mc-composer">
      <div className="mc-composer__bar">
        <ModelPicker />
        <input
          className="mc-composer__in"
          placeholder="Ask your second brain anything…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <IconButton size={36} aria-label="Attach" className="mc-composer__attach">
          <MemoryIcon name="link" size={17} weight={1.8} />
        </IconButton>
        <button className="mc-composer__send" aria-label="Send">
          <ArrowUpRight size={18} />
        </button>
      </div>

      <div className="mc-composer__hint">
        <span><MemoryIcon name="memory" size={13} weight={1.7} /> Grounded in 48,210 memories</span>
        <span className="mc-composer__sep">·</span>
        <span>Press <kbd>↵</kbd> to start a chat</span>
      </div>
    </div>
  );
}
