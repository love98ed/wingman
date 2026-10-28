export type YouCamErrorCode =
  | "NO_FACE"
  | "BAD_LIGHTING"
  | "TIMEOUT"
  | "QUOTA"
  | "UNKNOWN";

export class YouCamError extends Error {
  constructor(
    readonly code: YouCamErrorCode,
    message: string,
    /** Raw code from YouCam (e.g. `error_no_face`), when there is one. */
    readonly detail?: string,
  ) {
    super(message);
    this.name = "YouCamError";
  }
}

// Engine error codes from the YouCam reference pages (clothes, hair, beard,
// skin analysis, watch). Anything unlisted falls through to UNKNOWN.
const NO_FACE = new Set([
  "error_no_face",
  "error_src_face_too_small",
  "error_face_pose",
  "error_large_face_angle",
  "error_insufficient_landmarks",
  "error_no_shoulder",
  "error_face_parsing",
  "error_pose",
  "error_invalid_src",
  "error_multi_person",
  "PHOTO_DETECTION_FAIL",
  "PHOTO_CHECK_INVALID",
]);

const FRIENDLY: Record<YouCamErrorCode, string> = {
  NO_FACE: "We couldn't find a clear face and shoulders. Try a front-facing, waist-up photo.",
  BAD_LIGHTING: "The photo is too dark or blurry. Try again in even, bright light.",
  TIMEOUT: "Styling took too long. Please try again.",
  QUOTA: "We've hit today's styling limit. Please try again later.",
  UNKNOWN: "Something went wrong while styling. Please try again.",
};

export function friendlyMessage(code: YouCamErrorCode): string {
  return FRIENDLY[code];
}

/** Map a YouCam engine error (task_status "error") to a typed error. */
export function fromEngineError(raw: string | null | undefined, message?: string): YouCamError {
  const detail = raw ?? undefined;
  const text = `${raw ?? ""} ${message ?? ""}`.toLowerCase();
  let code: YouCamErrorCode = "UNKNOWN";
  if (raw && NO_FACE.has(raw)) code = "NO_FACE";
  else if (/light|exposure|too_dark|blur/.test(text)) code = "BAD_LIGHTING";
  else if (/credit|insufficien/.test(text)) code = "QUOTA";
  return new YouCamError(code, message || raw || "YouCam task failed", detail);
}
