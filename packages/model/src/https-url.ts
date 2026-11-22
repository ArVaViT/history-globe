import { z } from "zod";

/**
 * An address the content links to or cites: https only. A bare `z.url()` also takes
 * `javascript:`, `data:` and `http:` addresses, which a page must never carry as a link.
 * Every address in the content schemas is one of these (https-url.test.ts holds them to it).
 */
export const httpsUrl = z.url({ protocol: /^https$/ });
