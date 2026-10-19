import { describe, expect, it } from "vitest";
import { hitHtml } from "./docs-script.ts";

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

  it("is plain JavaScript once its types are stripped, as docs.js embeds it", () => {
    const source = hitHtml.toString();
    expect(source).toMatch(/^function hitHtml\(/);
    expect(source).not.toMatch(/: string|: number|: boolean/);
  });
});
