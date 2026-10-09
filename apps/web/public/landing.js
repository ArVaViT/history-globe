/*
 * The front page's motion and its live globe (scripts/build-pages.ts writes the page).
 *
 * Progressive: the page is whole without this file. Blocks are hidden for their entrance
 * only once this script runs, and never those already on screen, so nothing blinks out;
 * numbers count up from what the page already says. With `prefers-reduced-motion` (the
 * head's script sets `anim` only without it) there is no entrance, tilt or count.
 *
 * The globe in the hero is the app itself in embed mode (docs/embed-protocol.md), loaded
 * only when the reader asks for it (or points at it, to have it ready); until it is pressed
 * the frame does not take the wheel or a finger, so the page scrolls past it as past a
 * picture. "Done" gives the page its scroll back.
 */
(() => {
  "use strict";
  const root = document.documentElement;
  const motion = root.classList.contains("anim");
  const io = "IntersectionObserver" in window;

  // Counting up: the number the page states, reached with an easing that slows at the end.
  const fmt = new Intl.NumberFormat(root.lang || "en");
  const count = (list) => {
    for (const b of list.querySelectorAll("b[data-n]")) {
      const to = Number(b.dataset.n);
      if (!(to > 0)) continue;
      const ms = 1400;
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        b.textContent = fmt.format(Math.round(to * (1 - Math.pow(2, -10 * k))));
        if (k < 1) requestAnimationFrame(step);
        else b.textContent = fmt.format(to);
      };
      requestAnimationFrame(step);
    }
  };

  // Entrances as blocks come into view; children of a block follow one another.
  const blocks = [...document.querySelectorAll("[data-rv]")];
  if (motion && io) {
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("in");
          seen.unobserve(e.target);
          if (e.target.matches(".numbers")) count(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    const h = innerHeight;
    for (const el of blocks) {
      const r = el.getBoundingClientRect();
      // Already on screen: left as it is (no blink), only counted.
      if (r.top < h && r.bottom > 0) {
        el.classList.add("in", "now");
        if (el.matches(".numbers")) count(el);
      } else seen.observe(el);
    }
    root.classList.add("rv-on");
  }

  // The hero's frame lies back like a screen on a desk and rises as the page scrolls.
  const fig = document.querySelector(".shot[data-live]");
  const stage = fig && fig.querySelector(".stage");
  if (!fig || !stage) return;
  // Once the reader has pressed it, the frame stays flat: a tilted map is hard to steer.
  let flat = false;
  if (motion) {
    let top = 0;
    let queued = false;
    const measure = () => {
      top = fig.getBoundingClientRect().top + scrollY;
    };
    const tilt = () => {
      queued = false;
      if (flat) return;
      const span = Math.max(1, top - innerHeight * 0.14);
      const p = Math.min(1, Math.max(0, scrollY / span));
      stage.style.setProperty("--p", p.toFixed(3));
    };
    const onScroll = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(tilt);
      }
    };
    measure();
    tilt();
    // Only now does the frame lie back: without this script it is simply flat.
    fig.classList.add("tilt");
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", () => {
      measure();
      onScroll();
    });
  }

  // The live globe.
  const poster = stage.querySelector(".poster");
  const done = stage.querySelector(".done");
  let frame = null;
  const show = () => stage.classList.add("ready");
  const load = () => {
    if (frame) return;
    const narrow = stage.clientWidth < 700;
    frame = document.createElement("iframe");
    frame.title = fig.dataset.title || "History Globe";
    frame.src = `${fig.dataset.live}&camera=${narrow ? fig.dataset.narrow : fig.dataset.wide}`;
    frame.setAttribute("allow", "fullscreen");
    frame.tabIndex = -1;
    addEventListener("message", (e) => {
      if (e.source === frame.contentWindow && e.data && e.data.type === "hg:ready") show();
    });
    // A map that never says it is ready (no WebGL) is shown anyway: it says why itself.
    frame.addEventListener("load", () => setTimeout(show, 6000));
    stage.append(frame);
  };
  const live = (on) => {
    stage.classList.toggle("live", on);
    if (frame) frame.tabIndex = on ? 0 : -1;
    if (on) {
      load();
      flat = true;
      stage.style.setProperty("--p", "1");
      frame.focus({ preventScroll: true });
    }
  };
  poster.addEventListener("click", (e) => {
    // A click with a modifier opens the app in a tab, as the link says.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    live(true);
  });
  done.addEventListener("click", () => {
    live(false);
    poster.focus({ preventScroll: true });
  });
  // Pointing at the picture starts the load, so a press finds the map nearly ready.
  stage.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && load(), {
    once: true,
  });
  // Scrolled away: the page gets its wheel and its finger back.
  if (io)
    new IntersectionObserver((entries) => {
      for (const e of entries) if (!e.isIntersecting) live(false);
    }).observe(stage);
})();
