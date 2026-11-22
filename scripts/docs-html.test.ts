import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { unsafeHtml } from "./docs-html.ts";

const docs = join(import.meta.dirname, "../content/docs");

describe("the documentation's page sources", () => {
  const files = readdirSync(docs, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      readdirSync(join(docs, d.name))
        .filter((f) => f.endsWith(".html"))
        .map((f) => `${d.name}/${f}`),
    );

  it("are there, in every language", () => {
    expect(files.length).toBeGreaterThanOrEqual(21 * 9);
  });

  it.each(files)("%s is markup only", (file) => {
    expect(unsafeHtml(readFileSync(join(docs, file), "utf8"))).toEqual([]);
  });
});

describe("unsafeHtml", () => {
  it.each([
    '<p>Text with <a href="https://example.org/">a link</a> and <code>&lt;script&gt;</code>.</p>',
    '<script src="../hg-places.js" data-scope=".hgp-demo" defer></script>',
    '<script src="../../hg-places.js" data-scope=".hgp-demo" defer></script>',
    '<iframe src="../embed/v1?ref=Acts.16&amp;locale=en" title="x" loading="lazy"></iframe>',
    '<iframe src="https://historyglobe.app/embed/v1?place=af2161c"></iframe>',
    '<pre><code>&lt;iframe src="https://example.org/"&gt;&lt;/iframe&gt;</code></pre>',
    '<a href="mailto:someone@example.org">mail</a>',
  ])("lets markup through: %s", (html) => {
    expect(unsafeHtml(html)).toEqual([]);
  });

  it.each([
    "<script>alert(1)</script>",
    '<script src="https://example.org/x.js"></script>',
    '<script src="../hg-places.js">alert(1)</script>',
    '<SCRIPT src="../hg-places.js" onload="x()"></SCRIPT>',
    '<img src="x.png" onerror="alert(1)" />',
    '<a href="#" title=">" onclick="alert(1)">x</a>',
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVa&#x53;cript&colon;alert(1)">x</a>',
    '<a href=" java\tscript:alert(1)">x</a>',
    "<a href='vbscript:x'>x</a>",
    '<a href="data:text/html,<b>x</b>">x</a>',
    '<iframe src="https://example.org/"></iframe>',
    '<iframe src="../embed/v1" srcdoc="<script>x</script>"></iframe>',
    "<iframe></iframe>",
    '<object data="x.swf"></object>',
    '<embed src="x.swf" />',
    '<form action="https://example.org/"><input /></form>',
    '<base href="https://example.org/" />',
    '<meta http-equiv="refresh" content="0;url=https://example.org/" />',
    '<link rel="stylesheet" href="https://example.org/x.css" />',
    "<style>body{}</style>",
    // A lone quote in an unquoted value is part of the value, not the start of a string.
    '<script x=a"b>alert(1)</script>',
    '<iframe src=https://evil.example/ x=a"b></iframe>',
    '<object data=x.swf x=a"b></object>',
    '<form x=a"b action=https://evil.example></form>',
    '<a title=x"y onclick=alert(1)>x</a>',
    // The browser keeps the first of two.
    '<iframe src="https://evil.example/" src="../embed/v1"></iframe>',
    '<script src="https://evil.example/x.js" src="../hg-places.js"></script>',
    '<a href="javascript:alert(1)" href="https://example.org/">x</a>',
    // An address after the start of a value.
    '<svg><animate attributeName="href" values="https://x;javascript:alert(1)" /></svg>',
    '<svg><animate attributeName="href" values="https://x, data:text/html,x" /></svg>',
    '<a href="&#x110000;">x</a>',
    '<a href="x',
    "<p>text <b",
    '<script src="../hg-places.js" async></script>',
  ])("refuses %s", (html) => {
    expect(unsafeHtml(html).length).toBeGreaterThan(0);
  });
});
