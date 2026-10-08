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
import { Inner as ToeRaises } from "@/app/rehab/toe-raises/page";
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
import { Inner as TricepsExtension } from "@/app/rehab/triceps-extension/page";
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
import { Inner as QuadrupedWeightShift } from "@/app/rehab/quadruped-weight-shift/page";
import { Inner as WallPushUp } from "@/app/rehab/wall-push-up/page";
import { Inner as BicepsCurl } from "@/app/rehab/biceps-curl/page";
import { Inner as MedianNerveSlider } from "@/app/rehab/median-nerve-slider/page";
import { Inner as UlnarNerveTensioner } from "@/app/rehab/ulnar-nerve-tensioner/page";
import { Inner as WristFlexionExtension } from "@/app/rehab/wrist-flexion-extension/page";
import { Inner as WristFlexorExtensorStretch } from "@/app/rehab/wrist-flexor-extensor-stretch/page";
import { Inner as PronationSupination } from "@/app/rehab/pronation-supination/page";
import { Inner as WristCurls } from "@/app/rehab/wrist-curls/page";
import { Inner as ChinTuck } from "@/app/rehab/chin-tuck/page";
import { Inner as GazeStability } from "@/app/rehab/gaze-stability/page";
import { Inner as WallAngels } from "@/app/rehab/wall-angels/page";
import { Inner as Walking } from "@/app/rehab/walking/page";
import { Inner as LateralBandWalk } from "@/app/rehab/lateral-band-walk/page";
import { Inner as FullCanScaption } from "@/app/rehab/full-can-scaption/page";
import { Inner as BandIrAtSide } from "@/app/rehab/band-ir-at-side/page";
import { Inner as SerratusPunch } from "@/app/rehab/serratus-punch/page";
import { Inner as BallToss } from "@/app/rehab/ball-toss/page";
import { Inner as BodybladeHold } from "@/app/rehab/bodyblade-hold/page";
import { Inner as SideLyingHipAbduction } from "@/app/rehab/side-lying-hip-abduction/page";
import { Inner as DartThrowersMotion } from "@/app/rehab/dart-throwers-motion/page";
import { Inner as EccentricWristFlexion } from "@/app/rehab/eccentric-wrist-flexion/page";
import { Inner as EccentricWristExtension } from "@/app/rehab/eccentric-wrist-extension/page";
import { Inner as TowelIrStretch } from "@/app/rehab/towel-ir-stretch/page";
import { Inner as FoamRollerThoracicExtension } from "@/app/rehab/foam-roller-thoracic-extension/page";
import { Inner as HeelProp } from "@/app/rehab/heel-prop/page";
import { Inner as ShortArcQuads } from "@/app/rehab/short-arc-quads/page";
import { Inner as StationaryCycling } from "@/app/rehab/stationary-cycling/page";
import { Inner as LegPress } from "@/app/rehab/leg-press/page";
import { Inner as StepUpsStepDowns } from "@/app/rehab/step-ups-step-downs/page";
import { Inner as AgilityHops } from "@/app/rehab/agility-hops/page";
import { Inner as ItBandStretch } from "@/app/rehab/it-band-stretch/page";
import { Inner as SingleLegBridge } from "@/app/rehab/single-leg-bridge/page";
import { Inner as BridgeOnHeels } from "@/app/rehab/bridge-on-heels/page";
import { Inner as KneeToChest } from "@/app/rehab/knee-to-chest/page";
import { Inner as ChildsPose } from "@/app/rehab/childs-pose/page";
import { Inner as McKenziePressUp } from "@/app/rehab/mckenzie-press-up/page";
import { Inner as ProneThoracicExtension } from "@/app/rehab/prone-thoracic-extension/page";
import { Inner as SeatedThoracicExtension } from "@/app/rehab/seated-thoracic-extension/page";
import { Inner as McGillCurlUp } from "@/app/rehab/mcgill-curl-up/page";
import { Inner as SciaticNerveSlider } from "@/app/rehab/sciatic-nerve-slider/page";
import { Inner as SidePlank } from "@/app/rehab/side-plank/page";
import { Inner as DeadBug } from "@/app/rehab/dead-bug/page";
import { Inner as OpenBook } from "@/app/rehab/open-book/page";
import { Inner as ThreadTheNeedle } from "@/app/rehab/thread-the-needle/page";
import { Inner as QuadrupedRockBack } from "@/app/rehab/quadruped-rock-back/page";
import { Inner as RomanianDeadlift } from "@/app/rehab/romanian-deadlift/page";
import { Inner as HipFlexorStretch } from "@/app/rehab/hip-flexor-stretch/page";
import { Inner as SingleLegBalance } from "@/app/rehab/single-leg-balance/page";
import { Inner as StarExcursion } from "@/app/rehab/star-excursion/page";
import { Inner as SingleLegHops } from "@/app/rehab/single-leg-hops/page";
import { Inner as LateralHops } from "@/app/rehab/lateral-hops/page";
import { Inner as AnklePumps } from "@/app/rehab/ankle-pumps/page";
import { Inner as NordicHamstringCurl } from "@/app/rehab/nordic-hamstring-curl/page";
import { Inner as Clamshell } from "@/app/rehab/clamshell/page";
import { Inner as SupineAbductionSlide } from "@/app/rehab/supine-abduction-slide/page";
import { Inner as SideLyingEr } from "@/app/rehab/side-lying-er/page";
import { Inner as CrossBodyStretch } from "@/app/rehab/cross-body-stretch/page";
import { Inner as DoorwayPecStretch } from "@/app/rehab/doorway-pec-stretch/page";
import { Inner as SerratusWallSlide } from "@/app/rehab/serratus-wall-slide/page";
import { Inner as ProneIyt } from "@/app/rehab/prone-iyt/page";
import { Inner as ProneYtw } from "@/app/rehab/prone-ytw/page";
import { Inner as PiriformisStretch } from "@/app/rehab/piriformis-stretch/page";
import { Inner as CopenhagenPlank } from "@/app/rehab/copenhagen-plank/page";
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
  "toe-raises": ToeRaises,
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
  "triceps-extension": TricepsExtension,
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
  "quadruped-weight-shift": QuadrupedWeightShift,
  "wall-push-up": WallPushUp,
  "biceps-curl": BicepsCurl,
  "median-nerve-slider": MedianNerveSlider,
  "ulnar-nerve-tensioner": UlnarNerveTensioner,
  "wrist-flexion-extension": WristFlexionExtension,
  "wrist-flexor-extensor-stretch": WristFlexorExtensorStretch,
  "pronation-supination": PronationSupination,
  "wrist-curls": WristCurls,
  "chin-tuck": ChinTuck,
  "gaze-stability": GazeStability,
  "wall-angels": WallAngels,
  "walking": Walking,
  "lateral-band-walk": LateralBandWalk,
  "full-can-scaption": FullCanScaption,
  "band-ir-at-side": BandIrAtSide,
  "serratus-punch": SerratusPunch,
  "ball-toss": BallToss,
  "bodyblade-hold": BodybladeHold,
  "side-lying-hip-abduction": SideLyingHipAbduction,
  "dart-throwers-motion": DartThrowersMotion,
  "eccentric-wrist-flexion": EccentricWristFlexion,
  "eccentric-wrist-extension": EccentricWristExtension,
  "towel-ir-stretch": TowelIrStretch,
  "foam-roller-thoracic-extension": FoamRollerThoracicExtension,
  "heel-prop": HeelProp,
  "short-arc-quads": ShortArcQuads,
  "stationary-cycling": StationaryCycling,
  "leg-press": LegPress,
  "step-ups-step-downs": StepUpsStepDowns,
  "agility-hops": AgilityHops,
  "it-band-stretch": ItBandStretch,
  "single-leg-bridge": SingleLegBridge,
  "bridge-on-heels": BridgeOnHeels,
  "knee-to-chest": KneeToChest,
  "childs-pose": ChildsPose,
  "mckenzie-press-up": McKenziePressUp,
  "prone-thoracic-extension": ProneThoracicExtension,
  "seated-thoracic-extension": SeatedThoracicExtension,
  "mcgill-curl-up": McGillCurlUp,
  "sciatic-nerve-slider": SciaticNerveSlider,
  "side-plank": SidePlank,
  "dead-bug": DeadBug,
  "open-book": OpenBook,
  "thread-the-needle": ThreadTheNeedle,
  "quadruped-rock-back": QuadrupedRockBack,
  "romanian-deadlift": RomanianDeadlift,
  "hip-flexor-stretch": HipFlexorStretch,
  "single-leg-balance": SingleLegBalance,
  "star-excursion": StarExcursion,
  "single-leg-hops": SingleLegHops,
  "lateral-hops": LateralHops,
  "ankle-pumps": AnklePumps,
  "nordic-hamstring-curl": NordicHamstringCurl,
  "clamshell": Clamshell,
  "supine-abduction-slide": SupineAbductionSlide,
  "side-lying-er": SideLyingEr,
  "cross-body-stretch": CrossBodyStretch,
  "doorway-pec-stretch": DoorwayPecStretch,
  "serratus-wall-slide": SerratusWallSlide,
  "prone-iyt": ProneIyt,
  "prone-ytw": ProneYtw,
  "piriformis-stretch": PiriformisStretch,
  "copenhagen-plank": CopenhagenPlank,
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
