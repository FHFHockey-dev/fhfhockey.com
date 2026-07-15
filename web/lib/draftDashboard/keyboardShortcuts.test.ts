import { describe, expect, it } from "vitest";
import { isGlobalShortcutBlockedTarget } from "./keyboardShortcuts";

describe("global draft shortcut target guard", () => {
  it.each(["input", "select", "textarea", "button", "a"])(
    "blocks shortcuts from %s interactions",
    (tag) => {
      const element = document.createElement(tag);
      if (tag === "a") element.setAttribute("href", "#player");
      expect(isGlobalShortcutBlockedTarget(element)).toBe(true);
    },
  );

  it("blocks editable and dialog descendants but permits the document body", () => {
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const child = document.createElement("span");
    dialog.appendChild(child);

    expect(isGlobalShortcutBlockedTarget(editable)).toBe(true);
    expect(isGlobalShortcutBlockedTarget(child)).toBe(true);
    expect(isGlobalShortcutBlockedTarget(document.body)).toBe(false);
  });
});
