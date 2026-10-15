/**
 * A place page's slug from the English name. It must not move when the data is rebuilt,
 * so it depends on names only: a name held by one place (its duplicates aside) is the
 * plain slug ("jerusalem"); namesakes and duplicates add their id ("aphek-a4cf129").
 * Shared by the place pages and the places-in-any-text index, which links to them.
 */
export function placeSlugs(
  places: readonly { readonly id: string; readonly name: string; readonly dup?: boolean }[],
): Map<string, string> {
  const base = (p: { id: string; name: string }) =>
    p.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || p.id;
  const holders = new Map<string, number>();
  for (const p of places) if (!p.dup) holders.set(base(p), (holders.get(base(p)) ?? 0) + 1);
  return new Map(
    places.map((p) => [
      p.id,
      !p.dup && holders.get(base(p)) === 1 ? base(p) : `${base(p)}-${p.id}`,
    ]),
  );
}
