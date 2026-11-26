// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { Script } from "node:vm";
import { describe, expect, it } from "vitest";
import { clientScript } from "../client-script.ts";
import { hitHtml } from "./docs.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${String(c.charCodeAt(0))};`);

describe("a search hit of the docs", () => {
  it("escapes the address as it escapes the text", () => {
    const html = hitHtml(
      { t: 'Places <b>"x"</b>', p: "A & B", u: '"><img src=x onerror=alert(1)>' },
      0,
      true,
      esc,
    );
    expect(html).not.toContain("<img");
    expect(html).toContain('href="&#34;&#62;&#60;img src=x onerror=alert(1)&#62;"');
    expect(html).toContain("<b>Places &#60;b&#62;&#34;x&#34;&#60;/b&#62;</b>");
    expect(html).toContain("<span>A &#38; B</span>");
    expect(html).toContain('aria-selected="true"');
  });

  it("writes a plain hit, with the mono face for a defined name", () => {
    expect(
      hitHtml({ t: "lon", p: "Open data › Places", u: "api.html#places", c: 1 }, 2, false, esc),
    ).toBe(
      '<li role="option" id="hit-2"><a href="api.html#places"><b class="mono">lon</b><span>Open data › Places</span></a></li>',
    );
  });

  it("is served as one plain script, the fold it imports joined in", () => {
    const script = clientScript("packages/model/src/fold.ts", "scripts/client/docs.ts");
    expect(script).not.toMatch(/^\s*(import|export) /m);
    expect(script).toMatch(/function foldText\(/);
    expect(script).toMatch(/function hitHtml\(h, i, selected, esc\)/);
    // A classic script, as the pages load it: it compiles.
    expect(() => new Script(script)).not.toThrow();
  });
});
