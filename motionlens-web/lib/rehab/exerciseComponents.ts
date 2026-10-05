"use client";
// Every rehab exercise, mountable as a component.
//
// A prescribed session runs inside ONE route and swaps the exercise by
// `key`, the way Biomechanics Auto Mode swaps LiveAssessment — moving
// between routes turned out to cost tens of seconds per exercise, in a
// production build as well as in dev.
//
// These are the SAME components the standalone /rehab/<slug> routes
// render; each one still brings its own Nav, Footer and layout, so the
// runner adds no chrome of its own and a session looks exactly like
// opening the exercise directly.
//
// Static imports on purpose: the whole set loads once when the session
// starts, and every switch after that is instant because nothing has
// to be fetched. Generated from the pages on disk — regenerate rather
// than hand-edit when an exercise is added or retired.

import { Inner as BackExtension } from "@/app/rehab/back-extension/page";
import { Inner as BirdDog } from "@/app/rehab/bird-dog/page";
import { Inner as Bridge } from "@/app/rehab/bridge/page";
import { Inner as HeelRaises } from "@/app/rehab/heel-raises/page";
import { Inner as HeelSlides } from "@/app/rehab/heel-slides/page";
import { Inner as StraightLegRaise } from "@/app/rehab/straight-leg-raise/page";
import { Inner as HamstringStretch } from "@/app/rehab/hamstring-stretch/page";
import { Inner as SeatedSoleusRaise } from "@/app/rehab/seated-soleus-raise/page";
import { Inner as IsometricCalfHold } from "@/app/rehab/isometric-calf-hold/page";
import { Inner as EccentricHeelDrops } from "@/app/rehab/eccentric-heel-drops/page";
import { Inner as RathleffHeelRaise } from "@/app/rehab/rathleff-heel-raise/page";
import { Inner as CalfWallStretch } from "@/app/rehab/calf-wall-stretch/page";
import { Inner as CatCow } from "@/app/rehab/cat-cow/page";
import { Inner as CervicalRotation } from "@/app/rehab/cervical-rotation/page";
import { Inner as CervicalSideFlexion } from "@/app/rehab/cervical-side-flexion/page";
import { Inner as CervicalFlexionExtension } from "@/app/rehab/cervical-flexion-extension/page";
import { Inner as UpperTrapLevatorStretch } from "@/app/rehab/upper-trap-levator-stretch/page";
import { Inner as SelfSnag } from "@/app/rehab/self-snag/page";
import { Inner as ElbowArom } from "@/app/rehab/elbow-arom/page";
import { Inner as EccentricBicepsCurl } from "@/app/rehab/eccentric-biceps-curl/page";
import { Inner as ExternalRotation } from "@/app/rehab/external-rotation/page";
import { Inner as HipAbduction } from "@/app/rehab/hip-abduction/page";
import { Inner as HipHinge } from "@/app/rehab/hip-hinge/page";
import { Inner as KneeExtension } from "@/app/rehab/knee-extension/page";
import { Inner as LateralStep } from "@/app/rehab/lateral-step/page";
import { Inner as Marching } from "@/app/rehab/marching/page";
import { Inner as MiniSquat } from "@/app/rehab/mini-squat/page";
import { Inner as PelvicHold } from "@/app/rehab/pelvic-hold/page";
import { Inner as PostureHold } from "@/app/rehab/posture-hold/page";
import { Inner as ScapularSet } from "@/app/rehab/scapular-set/page";
import { Inner as ShoulderRaise } from "@/app/rehab/shoulder-raise/page";
import { Inner as SideBend } from "@/app/rehab/side-bend/page";
import { Inner as SingleLegSquat } from "@/app/rehab/single-leg-squat/page";
import { Inner as SitToStand } from "@/app/rehab/sit-to-stand/page";
import { Inner as DeclineSquat } from "@/app/rehab/decline-squat/page";
import { Inner as SpanishSquat } from "@/app/rehab/spanish-squat/page";
import { Inner as QuadStretch } from "@/app/rehab/quad-stretch/page";
import { Inner as SingleLegBridge } from "@/app/rehab/single-leg-bridge/page";
import { Inner as BridgeOnHeels } from "@/app/rehab/bridge-on-heels/page";
import { Inner as KneeToChest } from "@/app/rehab/knee-to-chest/page";
import { Inner as ChildsPose } from "@/app/rehab/childs-pose/page";
import { Inner as McKenziePressUp } from "@/app/rehab/mckenzie-press-up/page";
import { Inner as ProneThoracicExtension } from "@/app/rehab/prone-thoracic-extension/page";
import { Inner as SidePlank } from "@/app/rehab/side-plank/page";
import { Inner as QuadrupedRockBack } from "@/app/rehab/quadruped-rock-back/page";
import { Inner as RomanianDeadlift } from "@/app/rehab/romanian-deadlift/page";
import { Inner as HipFlexorStretch } from "@/app/rehab/hip-flexor-stretch/page";
import { Inner as SingleLegBalance } from "@/app/rehab/single-leg-balance/page";
import { Inner as NordicHamstringCurl } from "@/app/rehab/nordic-hamstring-curl/page";
import { Inner as StandingHamstringCurl } from "@/app/rehab/standing-hamstring-curl/page";
import { Inner as Squat } from "@/app/rehab/squat/page";
import { Inner as StepUp } from "@/app/rehab/step-up/page";
import { Inner as WallClock } from "@/app/rehab/wall-clock/page";
import { Inner as WallSit } from "@/app/rehab/wall-sit/page";
import { Inner as WallSlide } from "@/app/rehab/wall-slide/page";
import { Inner as WallFingerWalk } from "@/app/rehab/wall-finger-walk/page";
import { Inner as WandFlexion } from "@/app/rehab/wand-flexion/page";
import { Inner as TableSlides } from "@/app/rehab/table-slides/page";
import { Inner as Rows } from "@/app/rehab/rows/page";
import { Inner as PulleyFlexion } from "@/app/rehab/pulley-flexion/page";
import { Inner as WeightShift } from "@/app/rehab/weight-shift/page";

export type RehabExerciseComponent = () => React.ReactElement;

export const REHAB_EXERCISE_COMPONENTS: Record<string, RehabExerciseComponent> = {
  "back-extension": BackExtension,
  "bird-dog": BirdDog,
  "bridge": Bridge,
  "heel-raises": HeelRaises,
  "heel-slides": HeelSlides,
  "straight-leg-raise": StraightLegRaise,
  "hamstring-stretch": HamstringStretch,
  "seated-soleus-raise": SeatedSoleusRaise,
  "isometric-calf-hold": IsometricCalfHold,
  "eccentric-heel-drops": EccentricHeelDrops,
  "rathleff-heel-raise": RathleffHeelRaise,
  "calf-wall-stretch": CalfWallStretch,
  "cat-cow": CatCow,
  "cervical-rotation": CervicalRotation,
  "cervical-side-flexion": CervicalSideFlexion,
  "cervical-flexion-extension": CervicalFlexionExtension,
  "upper-trap-levator-stretch": UpperTrapLevatorStretch,
  "self-snag": SelfSnag,
  "elbow-arom": ElbowArom,
  "eccentric-biceps-curl": EccentricBicepsCurl,
  "external-rotation": ExternalRotation,
  "hip-abduction": HipAbduction,
  "hip-hinge": HipHinge,
  "knee-extension": KneeExtension,
  "lateral-step": LateralStep,
  "marching": Marching,
  "mini-squat": MiniSquat,
  "pelvic-hold": PelvicHold,
  "posture-hold": PostureHold,
  "scapular-set": ScapularSet,
  "shoulder-raise": ShoulderRaise,
  "side-bend": SideBend,
  "single-leg-squat": SingleLegSquat,
  "sit-to-stand": SitToStand,
  "decline-squat": DeclineSquat,
  "spanish-squat": SpanishSquat,
  "quad-stretch": QuadStretch,
  "single-leg-bridge": SingleLegBridge,
  "bridge-on-heels": BridgeOnHeels,
  "knee-to-chest": KneeToChest,
  "childs-pose": ChildsPose,
  "mckenzie-press-up": McKenziePressUp,
  "prone-thoracic-extension": ProneThoracicExtension,
  "side-plank": SidePlank,
  "quadruped-rock-back": QuadrupedRockBack,
  "romanian-deadlift": RomanianDeadlift,
  "hip-flexor-stretch": HipFlexorStretch,
  "single-leg-balance": SingleLegBalance,
  "nordic-hamstring-curl": NordicHamstringCurl,
  "standing-hamstring-curl": StandingHamstringCurl,
  "squat": Squat,
  "step-up": StepUp,
  "wall-clock": WallClock,
  "wall-sit": WallSit,
  "wall-slide": WallSlide,
  "wall-finger-walk": WallFingerWalk,
  "wand-flexion": WandFlexion,
  "table-slides": TableSlides,
  "rows": Rows,
  "pulley-flexion": PulleyFlexion,
  "weight-shift": WeightShift,
};

/** The component for a slug, or null when the catalogue and the pages
 *  disagree — a retired exercise still sitting in someone's saved
 *  prescription reaches here. */
export function exerciseComponent(slug: string): RehabExerciseComponent | null {
  return REHAB_EXERCISE_COMPONENTS[slug] ?? null;
}
