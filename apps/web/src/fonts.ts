// Map label fonts, self-hosted (ADR 0004): Literata covers Latin, Cyrillic and polytonic
// Greek. OFL-1.1. MapLibre builds SDF glyphs on the client from these files.
import cyrillicItalic from "@fontsource-variable/literata/files/literata-cyrillic-wght-italic.woff2?url";
import cyrillic from "@fontsource-variable/literata/files/literata-cyrillic-wght-normal.woff2?url";
import greekExt from "@fontsource-variable/literata/files/literata-greek-ext-wght-normal.woff2?url";
import greek from "@fontsource-variable/literata/files/literata-greek-wght-normal.woff2?url";
import latinExtItalic from "@fontsource-variable/literata/files/literata-latin-ext-wght-italic.woff2?url";
import latinExt from "@fontsource-variable/literata/files/literata-latin-ext-wght-normal.woff2?url";
import latinItalic from "@fontsource-variable/literata/files/literata-latin-wght-italic.woff2?url";
import latin from "@fontsource-variable/literata/files/literata-latin-wght-normal.woff2?url";
import { MAP_FONT, MAP_FONT_ITALIC } from "@hg/core";

const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215";
const LATIN_EXT =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";
const CYRILLIC = "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116";
const GREEK = "U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF";
const GREEK_EXT = "U+1F00-1FFF";

export const MAP_FONTS = {
  [MAP_FONT]: [
    { url: latin, unicodeRange: LATIN },
    { url: latinExt, unicodeRange: LATIN_EXT },
    { url: cyrillic, unicodeRange: CYRILLIC },
    { url: greek, unicodeRange: GREEK },
    { url: greekExt, unicodeRange: GREEK_EXT },
  ],
  [MAP_FONT_ITALIC]: [
    { url: latinItalic, unicodeRange: LATIN },
    { url: latinExtItalic, unicodeRange: LATIN_EXT },
    { url: cyrillicItalic, unicodeRange: CYRILLIC },
  ],
};
