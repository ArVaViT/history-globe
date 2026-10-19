import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HONEYPOT_PATH, honeypotLink } from "./honeypot.ts";

const web = join(import.meta.dirname, "../../../apps/web");
const read = (file: string) => readFileSync(join(web, file), "utf8");

interface Group {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

/** robots.txt as its groups: the agents a group names and its Allow and Disallow lines. */
function groups(text: string): Group[] {
  const out: Group[] = [];
  let g: Group | undefined;
  let open = false;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [, key = "", value = ""] = m;
    if (key.toLowerCase() === "user-agent") {
      if (!open || !g) out.push((g = { agents: [], rules: [] }));
      g.agents.push(value);
      open = true;
    } else {
      open = false;
      if (g && (key.toLowerCase() === "allow" || key.toLowerCase() === "disallow"))
        g.rules.push({ allow: key.toLowerCase() === "allow", path: value });
    }
  }
  return out;
}

/** What the group says of a path: the most specific rule wins, Allow on a tie, allowed by default. */
function allowed(g: Group, path: string): boolean {
  let best: { allow: boolean; path: string } | undefined;
  for (const r of g.rules) {
    if (r.path === "" || !path.startsWith(r.path)) continue;
    if (
      !best ||
      r.path.length > best.path.length ||
      (r.path.length === best.path.length && r.allow)
    )
      best = r;
  }
  return best?.allow ?? true;
}

describe("the honeypot", () => {
  const robots = groups(read("public/robots.txt"));

  it("is disallowed for every crawler in robots.txt, and the places are not", () => {
    expect(robots.length).toBeGreaterThan(1);
    for (const g of robots) {
      expect(allowed(g, HONEYPOT_PATH), g.agents.join(", ")).toBe(false);
      expect(allowed(g, `${HONEYPOT_PATH}articles.json`), g.agents.join(", ")).toBe(false);
    }
    const everyone = robots.find((g) => g.agents.includes("*"));
    expect(everyone && allowed(everyone, "/en/place/jerusalem/")).toBe(true);
    expect(everyone && allowed(everyone, "/data/photos/x.jpg")).toBe(true);
  });

  it("is a page that asks not to be indexed and links nowhere", () => {
    const page = read(`public${HONEYPOT_PATH}index.html`);
    expect(page).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(page).not.toMatch(/href="(?!https:\/\/historyglobe\.app\/)/);
  });

  it("is linked by a link no reader sees, in the app's page as in the built ones", () => {
    for (const root of ["", "../", "../../"]) {
      const link = honeypotLink(root);
      expect(link).toContain(`href="${root}export/"`);
      for (const attr of ['rel="nofollow"', 'aria-hidden="true"', 'tabindex="-1"', " hidden>"])
        expect(link).toContain(attr);
    }
    expect(read("index.html")).toContain(`\n    ${honeypotLink("")}\n`);
  });
});
