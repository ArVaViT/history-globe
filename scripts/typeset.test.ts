// SPDX-License-Identifier: AGPL-3.0-or-later
// Additional terms under section 7: see LICENSING.md

import { describe, expect, it } from "vitest";
import { TYPESET } from "./typeset.ts";

const NB = " ";
const NNB = " ";
const fr = TYPESET.fr;

describe("French typesetting", () => {
  it("keeps ; ! ? on their word with a thin no-break space", () => {
    expect(fr("<p>Où ? Ici ; là !</p>")).toBe(`<p>Où${NNB}? Ici${NNB}; là${NNB}!</p>`);
    expect(fr("<p>Où? Ici; là!</p>")).toBe(`<p>Où${NNB}? Ici${NNB}; là${NNB}!</p>`);
    expect(fr("<p>« Oui »</p>")).toBe(`<p>«${NNB}Oui${NNB}»</p>`);
  });

  it("leaves a character reference whole", () => {
    expect(fr("<li>Astronomy &amp; Geophysics</li>")).toBe("<li>Astronomy &amp; Geophysics</li>");
    expect(fr("<li>I &amp; II Kings; T. &amp; T. Clark</li>")).toBe(
      `<li>I &amp; II Kings${NNB}; T. &amp; T. Clark</li>`,
    );
    expect(fr("<p>l&#39; arbre &#x2019; &nbsp; fin</p>")).toBe(
      "<p>l&#39; arbre &#x2019; &nbsp; fin</p>",
    );
    expect(fr("<p>Argentina &amp;\nResearcher</p>")).toBe("<p>Argentina &amp;\nResearcher</p>");
  });

  it("gives an element marked in another language that language's punctuation", () => {
    expect(fr('<p>Voir <cite lang="en">Where? Here; now!</cite> ici ?</p>')).toBe(
      `<p>Voir <cite lang="en">Where? Here; now!</cite> ici${NNB}?</p>`,
    );
    expect(fr('<p><span lang="en">586 BC</span> 586 av. J.-C.</p>')).toBe(
      `<p><span lang="en">586 BC</span> 586${NB}av.${NB}J.-C.</p>`,
    );
    expect(fr('<html lang="fr"><p>Où ?</p></html>')).toBe(
      `<html lang="fr"><p>Où${NNB}?</p></html>`,
    );
  });

  it("leaves code alone", () => {
    expect(fr("<code>a; b!</code>")).toBe("<code>a; b!</code>");
  });
});

describe("other languages", () => {
  it("do not take the French spaces", () => {
    expect(TYPESET.it("<p>Dove? Qui; là!</p>")).toBe("<p>Dove? Qui; là!</p>");
    expect(TYPESET.en("<p>Astronomy &amp; Geophysics; 586 BC</p>")).toBe(
      `<p>Astronomy &amp; Geophysics; 586${NB}BC</p>`,
    );
  });
});
