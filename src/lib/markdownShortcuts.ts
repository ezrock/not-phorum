import type { KeyboardEvent } from 'react';

type ShortcutConfig = {
  prefix: string;
  suffix: string;
};

function applyWrapper(
  value: string,
  start: number,
  end: number,
  config: ShortcutConfig
): { text: string; selectionStart: number; selectionEnd: number } {
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);

  const hasSelection = end > start;
  if (!hasSelection) {
    const inserted = `${config.prefix}${config.suffix}`;
    const nextText = `${before}${inserted}${after}`;
    const cursor = start + config.prefix.length;
    return { text: nextText, selectionStart: cursor, selectionEnd: cursor };
  }

  if (selected.startsWith(config.prefix) && selected.endsWith(config.suffix)) {
    const unwrapped = selected.slice(config.prefix.length, selected.length - config.suffix.length);
    const nextText = `${before}${unwrapped}${after}`;
    return {
      text: nextText,
      selectionStart: start,
      selectionEnd: start + unwrapped.length,
    };
  }

  const wrapped = `${config.prefix}${selected}${config.suffix}`;
  const nextText = `${before}${wrapped}${after}`;
  return {
    text: nextText,
    selectionStart: start + config.prefix.length,
    selectionEnd: start + config.prefix.length + selected.length,
  };
}

export function handleMarkdownTextareaShortcut(
  event: KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (nextValue: string) => void
): boolean {
  const isCommand = event.metaKey || event.ctrlKey;
  if (!isCommand || event.altKey) return false;

  const key = event.key.toLowerCase();
  const target = event.currentTarget;

  let config: ShortcutConfig | null = null;
  if (key === 'b') config = { prefix: '**', suffix: '**' };
  if (key === 'i') config = { prefix: '*', suffix: '*' };
  if (key === 'u') config = { prefix: '++', suffix: '++' };
  if (!config) return false;

  event.preventDefault();

  const start = target.selectionStart ?? 0;
  const end = target.selectionEnd ?? start;
  const next = applyWrapper(value, start, end, config);

  onChange(next.text);

  requestAnimationFrame(() => {
    target.selectionStart = next.selectionStart;
    target.selectionEnd = next.selectionEnd;
    target.focus();
  });

  return true;
}
