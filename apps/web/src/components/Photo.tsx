import type { PlacePhoto } from "@hg/model";
import { useState } from "react";
import { useTranslation } from "../i18n";
import { DATA_URL } from "../data";

/**
 * The place's photo, served from the site, with its author and licence linked to the
 * file's Commons page (CC BY asks for the credit next to the image).
 */
export function Photo({
  photo,
  placeId,
  title,
  className = "mx-5 mt-3",
  aspect = "aspect-[16/9]",
}: {
  photo: PlacePhoto;
  placeId: string;
  title: string;
  className?: string;
  /** The frame: 16:9 in the place card, wider and lower in a tour stop. */
  aspect?: string;
}) {
  const { t, i18n } = useTranslation();
  // A disputed place's photo shows one candidate: named, so the picture settles nothing.
  const shows =
    photo.shows && (i18n.language === "ru" ? (photo.shows.ru ?? photo.shows.en) : photo.shows.en);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const page = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(photo.file.replaceAll(" ", "_"))}`;
  const free = photo.license === "Public domain" || photo.license.startsWith("CC0");
  return (
    <figure className={className}>
      {/* The credit sits on the photo's corner: next to the image, as CC BY asks, without a
          line of small print under it. */}
      <div className="relative">
        <img
          src={`${DATA_URL}/photos/${placeId}.jpg`}
          alt={title}
          loading="lazy"
          onError={() => {
            setFailed(true);
          }}
          className={`${aspect} w-full rounded-xl object-cover`}
        />
        <a
          href={page}
          target="_blank"
          rel="noopener noreferrer"
          title={`${t("place.photo")}: ${photo.author ? `${photo.author}, ` : ""}${photo.license === "Public domain" ? t("place.photo_pd") : photo.license}, Wikimedia Commons`}
          className="absolute right-1.5 bottom-1.5 flex max-w-[85%] rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] text-white/95 hover:bg-black/75"
        >
          {/* The licence stays in sight (CC BY asks for it, and a phone has no tooltip); a
              long name is cut instead. No copyright to mark on a free photo. */}
          <span className="truncate">
            {free ? "" : "© "}
            {photo.author ?? "Wikimedia Commons"}
          </span>
          {photo.license !== "Public domain" && (
            <span className="shrink-0" aria-hidden>
              &nbsp;· {photo.license}
            </span>
          )}
          <span className="sr-only">
            {" "}
            ({t("place.photo")}:{" "}
            {photo.license === "Public domain" ? t("place.photo_pd") : photo.license}, Wikimedia
            Commons, {t("new_tab")})
          </span>
        </a>
      </div>
      {shows && (
        <figcaption className="mt-1 text-[11px] text-ink-soft">
          {t("place.photo_shows", { site: shows })}
        </figcaption>
      )}
    </figure>
  );
}
