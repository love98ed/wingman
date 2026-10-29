/**
 * What can be wrong with an uploaded photo, in words for the user. Safe to import from client
 * components. A hard problem means the try-on won't work; a soft one may still work, so the
 * user can choose to go on. Glasses and sunglasses are never a problem (CLAUDE.md section 6).
 */

export const PHOTO_PROBLEMS = {
  TOO_SMALL: {
    soft: false,
    message: "This photo is too small for a good try-on.",
    tip: "Use the original photo from your camera, not a screenshot or a thumbnail.",
  },
  NO_PERSON: {
    soft: false,
    message: "We can't find a face in this photo.",
    tip: "Face the camera with your whole face in the frame.",
  },
  MULTIPLE_PEOPLE: {
    soft: false,
    message: "There's more than one person in this photo.",
    tip: "Use a photo of just you, or crop the others out first.",
  },
  FACE_CUT_OFF: {
    soft: false,
    message: "Your head is cut off at the edge of the photo.",
    tip: "Leave a little space above your head and on both sides.",
  },
  SHOULDERS_CUT_OFF: {
    soft: false,
    message: "We need to see your shoulders and chest to try clothes on you.",
    tip: "Step back so the photo shows you from the waist up.",
  },
  FACE_TOO_SMALL: {
    soft: false,
    message: "You're too far from the camera.",
    tip: "Move closer so you fill the photo from the waist up.",
  },
  FACE_COVERED: {
    soft: true,
    message: "Something is covering part of your face.",
    tip: "Move your hand, hat or hair away from your face. Glasses are fine.",
  },
  NOT_FACING: {
    soft: true,
    message: "You're turned away from the camera.",
    tip: "Look straight at the camera with your shoulders square to it.",
  },
  TOO_DARK: {
    soft: true,
    message: "Your photo looks too dark.",
    tip: "Try somewhere with more light, facing a window or a lamp.",
  },
  TOO_BRIGHT: {
    soft: true,
    message: "Your photo looks washed out.",
    tip: "Move out of direct sun or away from a bright light behind the camera.",
  },
  BLURRY: {
    soft: true,
    message: "Your photo looks blurry.",
    tip: "Hold the phone steady, or prop it up and use the timer.",
  },
} as const;

export type PhotoProblemCode = keyof typeof PHOTO_PROBLEMS;

export type PhotoProblem = { code: PhotoProblemCode; soft: boolean; message: string; tip: string };

export const photoProblem = (code: PhotoProblemCode): PhotoProblem => ({ code, ...PHOTO_PROBLEMS[code] });

/** POST /api/photo/check response. `ok` is false when any problem is hard. */
export type PhotoCheck = { ok: boolean; problems: PhotoProblem[] };
