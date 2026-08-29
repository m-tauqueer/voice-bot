import { useState } from "react";
import { MemoryIcon } from "../../lib/memory-icons";

export function OcCheckbox({ checked, onChange, label }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={"oc-check" + (checked ? " is-on" : "")}
      onClick={() => onChange(!checked)}
    >
      <span className="oc-check__box">{checked && <MemoryIcon name="check" size={12} weight={2.8} />}</span>
      <span className="oc-check__lbl">{label}</span>
    </button>
  );
}

export function OcRadioGroup({ value, onChange, options }: {
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="oc-radios" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={"oc-radio" + (option.value === value ? " is-on" : "")}
          onClick={() => onChange(option.value)}
        >
          <span className="oc-radio__dot" />
          <span className="oc-radio__lbl">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function OcSlider() {
  const [value, setValue] = useState(64);

  return (
    <div className="oc-slider">
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(+e.target.value)}
        className="oc-range"
        aria-label="Recall threshold"
      />
      <div className="oc-slider__val">{value}<span>%</span></div>
    </div>
  );
}

export function TagInput() {
  const [tags, setTags] = useState(["pricing", "auth"]);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const tag = draft.trim().toLowerCase();
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setDraft("");
  };

  const focusInput = (container: HTMLElement) => {
    container.querySelector("input")?.focus();
  };

  return (
    <div className="oc-taginput" onClick={(e) => focusInput(e.currentTarget)}>
      {tags.map((tag) => (
        <span className="tagchip oc-taginput__tag" key={tag}>{tag}
          <button
            aria-label={`Remove ${tag}`}
            onClick={(e) => { e.stopPropagation(); setTags(tags.filter((x) => x !== tag)); }}
          >✕</button>
        </span>
      ))}
      <input
        className="oc-taginput__in"
        value={draft}
        placeholder={tags.length ? "" : "add a tag…"}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && tags.length) {
            setTags(tags.slice(0, -1));
          }
        }}
      />
    </div>
  );
}
