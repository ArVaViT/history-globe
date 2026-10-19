/**
 * The open data API (scripts/build-api.ts) described in OpenAPI 3.1: api/v1/openapi.json.
 * Static files, no key, no server; every path is a GET of a JSON file. The schemas say what
 * a reader may rely on: fields are only ever added (readers must ignore unknown ones), and
 * an optional field is left out rather than sent empty. Kept beside build-api.ts, which
 * writes the files it describes and checks each against it (`violations`) before writing.
 */

const LANGS = ["en", "ru", "uk", "es", "pt", "de", "fr", "it", "pl", "cs", "nl"] as const;

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object, description: string) => ({
  description,
  content: { "application/json": { schema } },
});
const get = (summary: string, description: string, schema: object, parameters?: object[]) => ({
  get: {
    summary,
    description,
    ...(parameters ? { parameters } : {}),
    responses: { "200": json(schema, summary), "404": { description: "No such file" } },
  },
});
const book = {
  name: "book",
  in: "path",
  required: true,
  description:
    "OSIS book id with the English abbreviations (Gen, Exod, 1Sam, Matt, Acts); index.json lists those with data",
  schema: { type: "string", pattern: "^[1-3]?[A-Z][A-Za-z]+$" },
  example: "Acts",
};

export function openApi(version: string): object {
  return {
    openapi: "3.1.0",
    info: {
      title: "History Globe open data",
      version,
      summary: "Bible places, the verses and chapters that name them, people, tours, events",
      description:
        "Static JSON files served with `Access-Control-Allow-Origin: *`; no key. Years are astronomical (1 BC is 0, 586 BC is -585). References are OSIS with English book abbreviations and KJV numbering. Version 1 only grows: new fields and new files are added, none is renamed or removed, so a reader should ignore what it does not know.",
      license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
      contact: { name: "Vadym Arnaut", email: "historyglobe.vadym@gmail.com" },
    },
    servers: [{ url: "https://historyglobe.app/api/v1" }],
    externalDocs: { url: "https://historyglobe.app/docs/api.html" },
    paths: {
      "/index.json": get(
        "What is here",
        "The licence and the credit lines it asks for, the files, and the books with verse data.",
        ref("Index"),
      ),
      "/places.json": get("Every place", "Every place record; join on id, no order is promised.", {
        type: "array",
        items: ref("Place"),
      }),
      "/verses/{book}.json": get(
        "Verses to places, one book",
        "A verse (OSIS) to the ids of the places it names; the verses in the order of the book, the ids in none.",
        {
          type: "object",
          additionalProperties: { type: "array", items: { type: "string" } },
          example: { "Acts.16.12": ["a49e1d0"] },
        },
        [book],
      ),
      "/chapters/{book}.json": get(
        "Chapters to places and people, one book",
        "A chapter (OSIS book.chapter) to the places (our ids) and the people (STEPBible TIPNR ids) it names. A chapter that names neither is left out.",
        { type: "object", additionalProperties: ref("Chapter") },
        [book],
      ),
      "/people.json": get(
        "The people the Bible names",
        "From STEPBible's TIPNR (CC BY 4.0); only people the text names.",
        { type: "array", items: ref("Person") },
      ),
      "/tours.json": get("The tours", "Journeys told in the Bible, stop by stop.", {
        type: "array",
        items: ref("Tour"),
      }),
      "/events.json": get("Dated events", "With the passage where the Bible tells it.", {
        type: "array",
        items: ref("Event"),
      }),
      "/battles.json": get("Battles and sieges", "Place, year, sides and outcome.", {
        type: "array",
        items: ref("Battle"),
      }),
      "/questions.json": get(
        "Questions people ask",
        "Answered in every language, with the view of the map that shows the answer. The answers are History Globe's own texts under CC BY-NC-ND 4.0 (https://creativecommons.org/licenses/by-nc-nd/4.0/), not CC BY: quote and link them with credit; do not change, translate or republish them.",
        { type: "array", items: ref("Question") },
      ),
      "/ancient.json": get(
        "What ancient writers say of a place",
        "Place id to the passages of writers outside the Bible that name it.",
        { type: "object", additionalProperties: { type: "array", items: ref("AncientMention") } },
      ),
      "/openapi.json": get("This description", "OpenAPI 3.1.", { type: "object" }),
    },
    components: {
      schemas: {
        Localized: {
          type: "object",
          description: "Text in the site's languages, by language code; English is always there",
          properties: Object.fromEntries(LANGS.map((l) => [l, { type: "string" }])),
          required: ["en"],
          additionalProperties: { type: "string" },
        },
        Names: {
          type: "object",
          description: "Names in the languages other than English, where there is one",
          additionalProperties: { type: "string" },
        },
        Pages: {
          type: "object",
          description: "The page on historyglobe.app in each language (paths from the site root)",
          additionalProperties: { type: "string" },
        },
        Year: {
          type: "integer",
          description: "Astronomical year: 1 BC is 0, 586 BC is -585",
        },
        Osis: {
          type: "string",
          description: "A verse or a range: Gen.12.6, Acts.16.12-Acts.16.15",
          example: "Acts.16.12",
        },
        Index: {
          type: "object",
          properties: {
            name: { type: "string" },
            version: { type: "integer", const: 1 },
            built_at: { type: "string", format: "date-time" },
            license: { type: "string" },
            license_url: { type: "string", format: "uri" },
            credit: { type: "array", items: { type: "string" } },
            notice: {
              type: "string",
              description:
                "What may be taken and how, in a few sentences: the same notice every page and llms.txt carry (added 2026-10)",
            },
            years: { type: "string" },
            refs: { type: "string" },
            files: { type: "object", additionalProperties: { type: "string" } },
            fields_added: { type: "object", additionalProperties: { type: "string" } },
            books: { type: "array", items: { type: "string" } },
          },
          required: ["name", "version", "license", "credit", "files", "books"],
        },
        Place: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Our id, the same as OpenBible.info's ancient place id",
              example: "a49e1d0",
            },
            name: { type: "string", description: "English name" },
            names: ref("Names"),
            name_ru: {
              type: "string",
              description: "The same as names.ru; kept for the first version's readers",
            },
            kind: {
              type: "string",
              description: "settlement, region, river, mountain, spring, valley, … (open list)",
            },
            lon: { type: "number" },
            lat: { type: "number" },
            disputed: {
              type: "boolean",
              const: true,
              description: "Several candidate sites are serious",
            },
            duplicate: {
              type: "boolean",
              const: true,
              description: "Another record of the same place under a repeated name",
            },
            verses: { type: "integer", description: "How many verses name it" },
            wikidata: {
              type: "string",
              pattern: "^Q\\d+$",
              description: "Wikidata item, as OpenBible links it",
            },
            pleiades: { type: "string", pattern: "^\\d+$", description: "Pleiades place id" },
            page: ref("Pages"),
          },
          required: ["id", "name", "names", "name_ru", "kind", "lon", "lat", "verses"],
        },
        Chapter: {
          type: "object",
          properties: {
            places: { type: "array", items: { type: "string" }, description: "Place ids" },
            people: { type: "array", items: { type: "string" }, description: "Person ids (TIPNR)" },
          },
          required: ["places", "people"],
        },
        Person: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "STEPBible TIPNR unique name: name@first verse (-last book)",
              example: "Lydia@Act.16.14-",
            },
            name: { type: "string", description: "English name" },
            names: ref("Names"),
            sex: { type: "string", enum: ["m", "f"] },
            verses: { type: "integer", description: "How many verses name them" },
            first: {
              type: "string",
              description:
                "The verse TIPNR gives as the first to name them, in STEPBible's abbreviations (Act.16.14)",
            },
          },
          required: ["id", "name", "sex", "verses", "first"],
        },
        Stop: {
          type: "object",
          properties: {
            place: { type: "string" },
            ref: ref("Osis"),
            note: ref("Localized"),
            by: {
              type: "string",
              description: "How the stop was reached when not on foot: sea, …",
            },
            sailed: {
              type: "object",
              properties: {
                days: { type: "integer" },
                about: { type: "boolean", const: true },
                ref: ref("Osis"),
              },
              required: ["days", "ref"],
            },
          },
          required: ["place", "ref", "note"],
        },
        Tour: {
          type: "object",
          properties: {
            id: { type: "string" },
            year: ref("Year"),
            title: ref("Localized"),
            people: { type: "array", items: { type: "string" }, description: "TIPNR ids" },
            stops: { type: "array", items: ref("Stop") },
          },
          required: ["id", "year", "title", "stops"],
        },
        Event: {
          type: "object",
          properties: {
            id: { type: "string" },
            year: ref("Year"),
            approximate: { type: "boolean", const: true },
            title: ref("Localized"),
            place: { type: "string" },
            site: {
              type: "object",
              description: "A site of the ancient world the Bible does not name",
              properties: {
                id: { type: "string" },
                lon: { type: "number" },
                lat: { type: "number" },
              },
              required: ["id", "lon", "lat"],
            },
            ref: ref("Osis"),
            sources: { type: "array", items: { type: "string" } },
          },
          required: ["id", "year", "title", "sources"],
        },
        Battle: {
          type: "object",
          properties: {
            id: { type: "string" },
            year: ref("Year"),
            approximate: { type: "boolean", const: true },
            title: ref("Localized"),
            place: { type: "string" },
            ref: ref("Osis"),
            sides: ref("Localized"),
            outcome: ref("Localized"),
            sources: { type: "array", items: { type: "string" } },
          },
          required: ["id", "year", "title", "place", "sides", "outcome", "sources"],
        },
        Question: {
          type: "object",
          properties: {
            id: { type: "string" },
            question: ref("Localized"),
            answer: {
              type: "object",
              description: "Paragraphs in each language",
              additionalProperties: { type: "array", items: { type: "string" } },
            },
            map: {
              type: "object",
              properties: { place: { type: "string" }, year: ref("Year"), ref: ref("Osis") },
            },
            scripture: { type: "array", items: ref("Osis") },
            sources: { type: "array", items: { type: "string" } },
            page: ref("Pages"),
          },
          required: ["id", "question", "answer", "scripture", "sources", "page"],
        },
        AncientMention: {
          type: "object",
          properties: {
            place: { type: "string" },
            author: ref("Localized"),
            work: ref("Localized"),
            passage: { type: "string", example: "5.11-12" },
            url: { type: "string", format: "uri", description: "A free text of the passage" },
            note: ref("Localized"),
          },
          required: ["place", "author", "work", "passage", "url", "note"],
        },
      },
    },
  };
}

type Schema = {
  $ref?: string;
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  additionalProperties?: Schema | boolean;
  const?: unknown;
  enum?: unknown[];
  pattern?: string;
};

/**
 * Where a value breaks a schema of the description: the subset it uses (type, properties,
 * required, items, additionalProperties, const, enum, pattern, $ref). Unknown fields are
 * allowed, as the description promises readers. An empty list: it conforms.
 */
export function violations(
  value: unknown,
  schema: Schema,
  schemas: Record<string, Schema>,
  at = "$",
): string[] {
  if (schema.$ref) {
    const target = schemas[schema.$ref.replace("#/components/schemas/", "")];
    return target ? violations(value, target, schemas, at) : [`${at}: unknown ${schema.$ref}`];
  }
  const out: string[] = [];
  const t = schema.type;
  const isObject = typeof value === "object" && value !== null && !Array.isArray(value);
  if (t === "object" && !isObject) return [`${at}: not an object`];
  if (t === "array" && !Array.isArray(value)) return [`${at}: not an array`];
  if (t === "string" && typeof value !== "string") return [`${at}: not a string`];
  if (t === "integer" && !Number.isInteger(value)) return [`${at}: not an integer`];
  if (t === "number" && typeof value !== "number") return [`${at}: not a number`];
  if (t === "boolean" && typeof value !== "boolean") return [`${at}: not a boolean`];
  if ("const" in schema && value !== schema.const) out.push(`${at}: not ${String(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value))
    out.push(`${at}: not one of ${schema.enum.join(", ")}`);
  if (schema.pattern && typeof value === "string" && !new RegExp(schema.pattern).test(value))
    out.push(`${at}: "${value}" does not match ${schema.pattern}`);
  if (Array.isArray(value) && schema.items) {
    const items = schema.items;
    value.forEach((v, i) => out.push(...violations(v, items, schemas, `${at}[${String(i)}]`)));
  }
  if (isObject) {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!(key in obj)) out.push(`${at}: no ${key}`);
    for (const [key, v] of Object.entries(obj)) {
      const own = schema.properties?.[key];
      const extra = schema.additionalProperties;
      const sub = own ?? (typeof extra === "object" ? extra : undefined);
      if (sub) out.push(...violations(v, sub, schemas, `${at}.${key}`));
    }
  }
  return out;
}
