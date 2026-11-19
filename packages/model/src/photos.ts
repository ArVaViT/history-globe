/** A photo's page on Wikimedia Commons, where its author and licence are given in full. */
export function commonsPage(file: string): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replaceAll(" ", "_"))}`;
}

/**
 * The licence text a photo's credit links to (CC BY asks for the link), from Commons'
 * metadata (content/photos.yaml), over https; none for a photo in the public domain.
 */
export function licenceUrl(photo: {
  readonly license_url?: string | undefined;
}): string | undefined {
  return photo.license_url?.replace(/^http:\/\//, "https://");
}
