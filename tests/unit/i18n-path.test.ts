import { statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { resolveLocalesDirectory } from "../../src/bot/i18n.js";

describe("i18n locale directory resolution", () => {
  it("resolves to an absolute locales directory for current module", () => {
    const directory = resolveLocalesDirectory();

    expect(path.isAbsolute(directory)).toBe(true);
    expect(directory.endsWith(path.join("locales"))).toBe(true);
    expect(statSync(directory).isDirectory()).toBe(true);
  });

  it("resolves correctly when module URL is provided explicitly", () => {
    const moduleUrl = pathToFileURL(
      path.join(process.cwd(), "src", "bot", "i18n.ts"),
    ).href;
    const directory = resolveLocalesDirectory(moduleUrl);

    expect(path.isAbsolute(directory)).toBe(true);
    expect(directory.endsWith(path.join("locales"))).toBe(true);
  });
});
