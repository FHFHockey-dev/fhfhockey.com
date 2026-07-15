const INTERACTIVE_SELECTOR = [
  "input",
  "select",
  "textarea",
  "button",
  "a[href]",
  "[contenteditable='true']",
  "[role='button']",
  "[role='link']",
  "[role='textbox']",
  "[role='combobox']",
  "[role='dialog']",
].join(",");

export function isGlobalShortcutBlockedTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(INTERACTIVE_SELECTOR));
}
