import { pick, commonsPage, creditLine, creditNamesCommons, licenceUrl } from "@hg/model";
import type { PlacePhoto } from "@hg/model";
import { useState } from "react";
import { useTranslation } from "../i18n";
import { DATA_URL } from "../data";

/**
 * The place's photo, served from the site, with its credit (the line the author asks for,
 * else the author) linked to the file's Commons page and its licence linked to the licence
 * text (CC BY asks for the credit next to the image).
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
  const shows = photo.shows && pick(photo.shows, i18n.language);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const page = commonsPage(photo.file);
  const free = photo.license === "Public domain" || photo.license.startsWith("CC0");
  const licence = licenceUrl(photo);
  const credit = creditLine(photo);
  const licenceName = photo.license === "Public domain" ? t("place.photo_pd") : photo.license;
  // "Wikimedia Commons" once: not after a credit that names it already.
  const source = creditNamesCommons(credit) ? "" : ", Wikimedia Commons";
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
        <span className="absolute right-1.5 bottom-1.5 max-w-[85%] rounded-[10px] bg-black/60 px-2 py-0.5 text-[10.5px] leading-snug text-white/95 hover:bg-black/75">
          {/* The licence stays in sight (CC BY asks for it, and a phone has no tooltip), and
              so does the whole credit: a long one wraps rather than being cut. No copyright
              to mark on a free photo, nor twice where the credit carries its own. The credit
              opens the file's page, the licence its text (CC BY asks for its link). */}
          <a
            href={page}
            target="_blank"
            rel="noopener noreferrer"
            title={`${t("place.photo")}: ${credit ? `${credit}, ` : ""}${licenceName}${source}`}
            className="break-words"
          >
            {free || credit?.startsWith("©") ? "" : "© "}
            <bdi>{credit ?? "Wikimedia Commons"}</bdi>
            <span className="sr-only">
              {" "}
              ({t("place.photo")}: {licenceName}
              {source}, {t("new_tab")})
            </span>
          </a>
          {photo.license !== "Public domain" && (
            <span className="whitespace-nowrap">
              &nbsp;·{" "}
              {licence ? (
                <a href={licence} target="_blank" rel="noopener noreferrer">
                  {photo.license}
                </a>
              ) : (
                photo.license
              )}
            </span>
          )}
        </span>
      </div>
      {shows && (
        <figcaption className="mt-1 text-[11px] text-ink-soft">
          {t("place.photo_shows", { site: shows })}
        </figcaption>
      )}
    </figure>
  );
}
