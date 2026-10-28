/**
 * YouCam preset templates Wingman offers, by title. Ids come from the template
 * listings saved in fixtures/youcam/*-templates.json. Dyed and novelty styles are left out.
 */
export const HAIR_TEMPLATES: Record<string, string> = {
  "Modern Slick Back": "male_modern_slick_back",
  Curtain: "male_curtain",
  "Center-Parted Style": "male_center_parted_style",
  "Textured Flow": "male_textured_flow",
  "Messy Surfer Cut": "male_messy_surfer_cut",
  "Wavy Undercut": "male_wavy_undercut",
  "Medium Tousled Waves": "male_medium_tousled_waves",
  "Relaxed Waves": "male_relaxed_waves",
  "Defined Curls": "male_defined_curls",
  "Dark Brown Flow": "male_dark_brown_flow",
};

export const BEARD_TEMPLATES: Record<string, string> = {
  Shaved: "all_shaved",
  Circle: "all_circle",
  Goatee: "all_goatee",
  Anchor: "all_anchor",
  Garibaldi: "all_garibaldi",
  Bandholz: "all_bandholz",
};

export const HAIR_STYLES = Object.keys(HAIR_TEMPLATES);
export const BEARD_STYLES = Object.keys(BEARD_TEMPLATES);
