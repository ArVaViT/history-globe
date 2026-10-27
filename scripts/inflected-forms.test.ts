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
  it("declines Serbian names", () => {
    has("Јерусалим", "sr", "Јерусалима", "Јерусалиму", "Јерусалимом");
    has("Галилеја", "sr", "Галилеје", "Галилеји", "Галилеју", "Галилејом");
    has("Самарија", "sr", "Самарије", "Самарији", "Самарију");
    has("Рама", "sr", "Раме", "Рами", "Раму", "Рамом");
    has("Египат", "sr", "Египта", "Египту");
    has("Филипи", "sr", "Филипима");
    has("Коринт", "sr", "Коринту", "Коринтом");
    expect(inflectedForms("Јерусалим", "sr")).not.toContain("Јерусалимем");
  });
  it("gives the Nordic genitive", () => {
    has("Jerusalem", "sv", "Jerusalems");
    has("Egypten", "sv", "Egyptens");
    has("Betlehem", "da", "Betlehems");
    has("Jeriko", "nb", "Jerikos");
    expect(inflectedForms("Damaskus", "sv")).toEqual(["Damaskus"]);
    expect(inflectedForms("Efesos", "nb")).toEqual(["Efesos"]);
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
  it("gives the Hungarian cases", () => {
    // The Károli Bible and the site's articles: «Jeruzsálemben», «Jeruzsálemmel», «Hebronnal».
    has(
      "Jeruzsálem",
      "hu",
      ...["Jeruzsálemben", "Jeruzsálembe", "Jeruzsálemből", "Jeruzsálemet", "Jeruzsálemnek"],
      ...["Jeruzsálemhez", "Jeruzsálemig", "Jeruzsálemen", "Jeruzsálemre", "Jeruzsálemről"],
      ...["Jeruzsálemtől", "Jeruzsálemmel", "Jeruzsálemért", "Jeruzsálemnél", "Jeruzsálemi"],
    );
    expect(inflectedForms("Jeruzsálem", "hu")).not.toContain("Jeruzsálemban");
    has("Betánia", "hu", "Betániában", "Betániába", "Betániából", "Betániát", "Betániának");
    has("Betánia", "hu", "Betániához", "Betániától", "Betániáig", "Betániai");
    has("Ninive", "hu", "Ninivét", "Ninivébe", "Ninivében", "Ninivétől", "Ninivénél", "Ninivével");
    has("Róma", "hu", "Rómának", "Rómával", "Rómán", "Rómaként", "Rómáé", "Rómája", "Rómájának");
    has("Pátmosz", "hu", "Pátmoszon", "Pátmoszt", "Pátmoszról", "Pátmoszig");
    has("Hebron", "hu", "Hebronba", "Hebront", "Hebronnal", "Hebrontól", "Hebronná");
    has("Ciprus", "hu", "Ciprusra", "Cipruson", "Ciprust", "Ciprussal");
    has("Tiberias", "hu", "Tiberiasba", "Tiberiasszal");
    has("Damaszkusz", "hu", "Damaszkuszt", "Damaszkuszon", "Damaszkusszal", "Damaszkusszá");
    has("Názáret", "hu", "Názáretben", "Názárettől", "Názárettel", "Názáretet");
    has("Egyiptom", "hu", "Egyiptomot", "Egyiptommal", "Egyiptomhoz");
    has("Jerikó", "hu", "Jerikóban", "Jerikót", "Jerikóval", "Jerikóvá");
    // The vowel before i, í and é decides; after a back vowel an é goes either way.
    has("Karkemis", "hu", "Karkemisnél");
    has("Athén", "hu", "Athénba", "Athéntól", "Athénben");
    // Front rounded: «a Hinnom-völgyön», «völgyhöz».
    has(
      "Hinnom-völgy",
      "hu",
      "Hinnom-völgyben",
      "Hinnom-völgyön",
      "Hinnom-völgyhöz",
      "Hinnom-völggyel",
    );
    has("Olajfák hegye", "hu", "Olajfák hegyén", "Olajfák hegyére", "Olajfák hegyéről");
    has("Galileai-tenger", "hu", "Galileai-tengeren", "Galileai-tengerbe", "Galileai-tengertől");
    has("Felső-tó", "hu", "Felső-tóhoz", "Felső-tavon");
    // The live sample of content/docs/hu/embedding.html.
    has("Cézárea", "hu", "Cézáreából");
    has("Efezus", "hu", "Efezusban");
    has("Korinthus", "hu", "Korinthusban");
    has("Sikem", "hu", "Sikembe");
    has("Betlehem", "hu", "Betlehemben");
    expect(inflectedForms("Ai", "hu")).toEqual(["Ai"]);
  });
  it("gives the Finnish cases", () => {
    // Pyhä Raamattu 1933/1938: «Jerusalemiin», «Betaniaan», «Niiniveen», «Efesoon».
    has(
      "Jerusalem",
      "fi",
      ...["Jerusalemin", "Jerusalemissa", "Jerusalemista", "Jerusalemiin", "Jerusalemilla"],
      ...["Jerusalemille", "Jerusalemilta", "Jerusalemia", "Jerusalemina"],
    );
    has(
      "Betania",
      "fi",
      "Betanian",
      "Betaniassa",
      "Betaniasta",
      "Betaniaan",
      "Betanialla",
      "Betaniaa",
    );
    has("Niinive", "fi", "Niiniven", "Niinivessä", "Niinivestä", "Niiniveen", "Niiniveä");
    has("Kapernaum", "fi", "Kapernaumissa", "Kapernaumiin");
    has("Egypti", "fi", "Egyptin", "Egyptissä", "Egyptistä", "Egyptiin", "Egyptiä", "Egyptille");
    has("Efesos", "fi", "Efeson", "Efesossa", "Efesoon", "Efesosta", "Efesoksen", "Efesoksessa");
    has("Kypros", "fi", "Kyproon", "Kyproksella", "Kyprokselle", "Kyprosta");
    has("Damaskos", "fi", "Damaskon", "Damaskoon", "Damaskossa", "Damaskoa", "Damaskolta");
    has("Korintti", "fi", "Korintin", "Korintissa", "Korinttiin");
    has("Siinai", "fi", "Siinain", "Siinailta", "Siinaihin");
    has("Karmelvuori", "fi", "Karmelvuorella", "Karmelvuorelle", "Karmelvuoren", "Karmelvuorta");
    has("Galileanjärvi", "fi", "Galileanjärvellä", "Galileanjärveen");
    has("Pisidian Antiokia", "fi", "Pisidian Antiokiassa", "Pisidian Antiokiaan");
    has("Abel-Mehola", "fi", "Abel-Meholaan", "Abel-Meholassa");
    // An adjective before the noun would be declined too: «Uudessa portissa».
    expect(inflectedForms("Uusi portti", "fi")).toEqual(["Uusi portti"]);
  });
  it("gives the Romanian article and cases", () => {
    // Biblia 1914: «Ierusalimului», «Ierusalimul», «Galileei», «Samariei», «Iordanului».
    has("Ierusalim", "ro", "Ierusalimul", "Ierusalimului", "Ierusalime");
    has("Betleem", "ro", "Betleemul", "Betleemului");
    has("Galileea", "ro", "Galileii", "Galileei");
    has("Samaria", "ro", "Samariei");
    has("Roma", "ro", "Romei");
    has("Cipru", "ro", "Ciprul", "Ciprului");
    has("Ninive", "ro", "Ninivei");
    has("Iordan", "ro", "Iordanul", "Iordanului");
    // The cedilla letters of older keyboards: Aşdod for Așdod.
    has("Așdod", "ro", "Aşdod", "Așdodului", "Aşdodului");
  });
  it("matches Vietnamese and Bulgarian names as written", () => {
    expect(inflectedForms("Giê-ru-sa-lem", "vi")).toEqual(["Giê-ru-sa-lem"]);
    expect(inflectedForms("Йерусалим", "bg")).toEqual(["Йерусалим"]);
  });
  it("matches names of several words, and other languages, as written", () => {
    expect(inflectedForms("Góra Karmel", "pl")).toEqual(["Góra Karmel"]);
    expect(inflectedForms("Jerusalén", "es")).toEqual(["Jerusalén"]);
    expect(inflectedForms("Jerusalem", "tl")).toEqual(["Jerusalem"]);
    expect(inflectedForms("Ai", "pl")).toEqual(["Ai"]);
  });
});
