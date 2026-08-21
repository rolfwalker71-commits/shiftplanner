import { useEffect, useState } from "react";
import { formatTime, normalizeTime } from "../lib/dates";

export function TimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(formatTime(value) || value);

  useEffect(() => {
    setText(formatTime(value) || value);
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      placeholder="06:30"
      className="mt-1 h-11 w-full rounded-xl bg-canvas px-3 text-ink"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const next = normalizeTime(text);
        if (next) {
          setText(next);
          onChange(next);
          return;
        }
        setText(formatTime(value) || "06:30");
      }}
    />
  );
}
