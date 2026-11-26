// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { htmlText, inlineScripts, readTag, scripts, withoutScriptText } from "./html-read.ts";

describe("htmlText", () => {
  it.each([
    ["plain text", "plain text"],
    ["<code>x</code> and <b>y</b>", "x and y"],
    ['<a href="#a" title="1 > 0">the link</a>', "the link"],
    ["<A HREF='x'>upper</A>", "upper"],
    ["a<br/>b", "ab"],
    ["a <!-- a <b>comment</b> --> b", "a  b"],
    ["a <!--> b", "a  b"],
    ["a <!---> b", "a  b"],
    ["a <!-- left open", "a "],
    ["a <!DOCTYPE html> b <?xml x?> c", "a  b  c"],
    ["a </> b </ x> c", "a  b  c"],
    // A "<" before anything but a letter, "/", "!" or "?" is text, as in the browser.
    ["1 < 2 and 3 <= 4", "1 < 2 and 3 <= 4"],
    ["a </", "a </"],
    ["&lt;script&gt; stays escaped", "&lt;script&gt; stays escaped"],
    ["a <script>if (1 < 2) document.write('<b>')</script> b", "a  b"],
    ["a <SCRIPT>x</script > b", "a  b"],
    ["a <script>x</scripts> y</script\n> b", "a  b"],
    ["a <style>p > b { }</style> b", "a  b"],
    ["a <b unclosed", "a "],
  ])("%j → %j", (html, text) => {
    expect(htmlText(html)).toBe(text);
  });

  // A pattern removed once can leave a tag behind ("<scr<b>ipt>"); the reader does not.
  it.each(["<scr<b>ipt>alert(1)</scr</b>ipt>", "<<script>script>x", "<!<!-- -->-- x -->"])(
    "leaves no tag nor comment opening in %j",
    (html) => {
      const text = htmlText(html);
      expect(text).not.toMatch(/<[a-zA-Z/!?]/);
      expect(htmlText(text)).toBe(text);
    },
  );

  it("puts the given text in place of each tag, not of a comment", () => {
    expect(htmlText("<p>a</p><p>b</p><!-- c -->d", { between: " " })).toBe(" a  b d");
  });

  it("drops the named elements with all they hold", () => {
    const drop = ["note", "title"];
    expect(
      htmlText('<title>T</title>In <note n="a">a <i>note</i></note>the beginning', { drop }),
    ).toBe("In the beginning");
    expect(htmlText("a<note>1<note>2</note>3</note>b", { drop })).toBe("ab");
    expect(htmlText('a<note n="x"/>b<title/>c', { drop })).toBe("abc");
    expect(htmlText("a<note>left open", { drop })).toBe("a");
    expect(htmlText("a<NOTE>x</NOTE >b", { drop })).toBe("ab");
  });
});

describe("readTag", () => {
  it("reads a quoted '>' as part of the value", () => {
    const html = '<a title="1 > 0" HREF=x>';
    const tag = readTag(html, 0);
    expect(tag.name).toBe("a");
    expect([...tag.attrs]).toEqual([
      ["title", "1 > 0"],
      ["href", "x"],
    ]);
    expect(tag.end).toBe(html.length);
  });
});

describe("scripts", () => {
  it("reads every way a browser writes a script's tags", () => {
    const page = [
      "<script>a()</script>",
      '<SCRIPT type="module">b()</SCRIPT>',
      "<script>c()</script >",
      "<script>d()</script\t>",
      "<script>e('</scripts>')</script/>",
      "<!-- <script>not()</script> -->",
      "<scripts>not a script</scripts>",
      "<script>f()",
    ].join("\n");
    expect(scripts(page).map((s) => s.text)).toEqual([
      "a()",
      "b()",
      "c()",
      "d()",
      "e('</scripts>')",
      "f()",
    ]);
  });

  // "İ".toLowerCase() is two characters: the end tag is still found where it is.
  it("finds the end tag after a letter whose lower case is longer", () => {
    expect(scripts("<p>İzmir</p><script>a()</script><p>b</p>").map((s) => s.text)).toEqual(["a()"]);
  });

  it("reads a script's text as text, not as tags", () => {
    const [s] = scripts("<script>if (a<b) x = '<a href=\"y\">';</script>");
    expect(s?.text).toBe("if (a<b) x = '<a href=\"y\">';");
  });
});

describe("inlineScripts", () => {
  it("lists the scripts in the page that run, by their text", () => {
    const page = [
      "<script>a()</script>",
      "<script type=module>b()</script>",
      '<script TYPE="Text/JavaScript">c()</script>',
      '<script type="">d()</script>',
      '<script type="application/ld+json">{}</script>',
      '<script src="x.js"></script>',
      '<script SRC="y.js" type="module"></script>',
      "<script\nsrc=z.js></script>",
    ].join("");
    expect(inlineScripts(page)).toEqual(["a()", "b()", "c()", "d()"]);
  });
});

describe("withoutScriptText", () => {
  it("keeps the tags, drops what the scripts hold", () => {
    expect(
      withoutScriptText(
        '<a href="a">a</a><script src="s.js"></script><SCRIPT>x = \'<a href="no">\'</script >' +
          '<a href="b">b</a>',
      ),
    ).toBe('<a href="a">a</a><script src="s.js"></script><SCRIPT></script ><a href="b">b</a>');
  });
});
