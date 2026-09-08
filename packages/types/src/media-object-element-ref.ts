import type { MediaObject } from "./generated/types.ts";

/** Context carried by one ordered MediaObject-to-MediaElement association. */
export type MediaObjectElementRef = MediaObject["elements"][number];
