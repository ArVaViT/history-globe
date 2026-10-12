import { describe, expect, it } from "vitest";
import { inflectedForms } from "./inflected-forms.ts";

const has = (name: string, l: Parameters<typeof inflectedForms>[1], ...forms: string[]) => {
  const got = inflectedForms(name, l);
  for (const f of forms) expect(got, `${name} → ${f}`).toContain(f);
};

describe("inflectedForms", () => {
  it("declines Ukrainian names", () => {
    has("Єрусалим", "uk", "Єрусалима", "Єрусалиму", "Єрусалимом", "Єрусалимі");
    has("Галілея", "uk", "Галілеї", "Галілею", "Галілеєю");
    has("Самарія", "uk", "Самарії", "Самарію", "Самарією");
    has("Рама", "uk", "Рами", "Рамі", "Раму", "Рамою");
    has("Єгипет", "uk", "Єгипту", "Єгипті");
    has("Дамаск", "uk", "Дамаску");
    expect(inflectedForms("Дамаск", "uk")).not.toContain("Дамаскі");
    has("Мареша", "uk", "Мареші", "Марешею");
  });
  it("declines Polish names", () => {
    has("Jerozolima", "pl", "Jerozolimy", "Jerozolimie", "Jerozolimę", "Jerozolimą");
    has("Egipt", "pl", "Egiptu", "Egipcie", "Egiptem");
    has("Betlejem", "pl", "Betlejemu", "Betlejemie");
    has("Antiochia", "pl", "Antiochii", "Antiochię", "Antiochią");
    has("Galilea", "pl", "Galilei", "Galileę", "Galileą");
    has("Tyr", "pl", "Tyru", "Tyrze");
    has("Liban", "pl", "Libanu", "Libanie");
    has("Grecja", "pl", "Grecji", "Grecję");
    has("Achaja", "pl", "Achai");
    expect(inflectedForms("Jordan", "pl")).not.toContain("Jordana");
    expect(inflectedForms("Ikonium", "pl")).toEqual(["Ikonium"]);
  });
  it("declines Czech names", () => {
    has("Jeruzalém", "cs", "Jeruzaléma", "Jeruzalémě", "Jeruzalémem");
    has("Egypt", "cs", "Egypta", "Egyptě");
    has("Galilea", "cs", "Galileje", "Galileji", "Galileou");
    has("Rama", "cs", "Ramy", "Ramě", "Ramu", "Ramou");
  });
  it("gives the German genitive", () => {
    has("Jerusalem", "de", "Jerusalems");
    expect(inflectedForms("Damaskus", "de")).toEqual(["Damaskus"]);
    expect(inflectedForms("Säulenhalle", "de")).toEqual(["Säulenhalle"]);
  });
  it("keeps the Portuguese spellings in use", () => {
    has("Galileia", "pt", "Galiléia");
    has("Babilônia", "pt", "Babilónia");
  });
  it("matches names of several words, and other languages, as written", () => {
    expect(inflectedForms("Góra Karmel", "pl")).toEqual(["Góra Karmel"]);
    expect(inflectedForms("Jerusalén", "es")).toEqual(["Jerusalén"]);
    expect(inflectedForms("Ai", "pl")).toEqual(["Ai"]);
  });
});
