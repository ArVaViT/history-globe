/** Plane geometry on lon/lat rings, shared by the states' build and the rulers' bands. */

export type Ring = [number, number][];

/** Ray casting: whether the point lies inside the ring. */
export function pointInRing([x, y]: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
    const [xk, yk] = ring[k] ?? [0, 0];
    const [xm, ym] = ring[m] ?? [0, 0];
    if (yk > y !== ym > y && x < ((xm - xk) * (y - yk)) / (ym - yk) + xk) inside = !inside;
  }
  return inside;
}

/** The shoelace area of a ring, in square degrees. */
export const ringArea = (ring: Ring): number =>
  Math.abs(
    ring.reduce((a, [x0, y0], k) => {
      const [x1, y1] = ring[(k + 1) % ring.length] ?? [x0, y0];
      return a + x0 * y1 - x1 * y0;
    }, 0),
  ) / 2;
