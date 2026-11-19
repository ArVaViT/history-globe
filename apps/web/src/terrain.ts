/** The relief's tiles: Mapterhorn's public set (ADR 0020). */
export const TERRAIN_TILES = "https://tiles.mapterhorn.com/{z}/{x}/{y}.webp";

/**
 * The relief's credit, which the licences ask for where the map is shown (Copernicus 6(a));
 * the other sources, with the Copernicus disclaimer, are on the Sources page the renderer
 * links to after it, in the reader's language (`sourcesPage` in useGlobe.ts). The Copernicus
 * notice is kept whole, "all rights reserved" included (Mapterhorn's catalogue).
 */
export const TERRAIN_ATTRIBUTION =
  'Terrain: <a href="https://mapterhorn.com/attribution">Mapterhorn</a>, Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA; all rights reserved';
