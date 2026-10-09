import type { AdvancedBossArtFrame } from './advancedBossArt';

/**
 * Original final-boss assets. All coordinates are absolute image pixels.
 * Starter retains its three-pose atlas; advanced uses one complete nine-head silhouette.
 * See public/art/final-bosses-provenance.md and final-dragon-v2-provenance.md.
 * Use alphaTest 0.08 for faint edge pixels.
 */
export interface FinalBossArtMetadata {
  readonly mode: 'starter' | 'advanced';
  readonly assetPath: string;
  readonly width: number;
  readonly height: number;
  /** Visual-review landmarks, one face center per clearly visible dragon head. */
  readonly headCenters?: readonly (readonly [number, number])[];
  readonly frames: Readonly<Record<'idle' | 'windup' | 'release' | 'hurt', AdvancedBossArtFrame>>;
}

export const FINAL_BOSS_ART = [
  {
    "mode": "starter",
    "assetPath": "/art/final-bosses-v1.webp",
    "width": 1536,
    "height": 1024,
    "frames": {
      "idle": {
        "rect": {
          "x": 0,
          "y": 0,
          "width": 510,
          "height": 480
        },
        "foot": [
          313,
          465
        ],
        "emitter": [
          274,
          78
        ],
        "topY": 31
      },
      "release": {
        "rect": {
          "x": 510,
          "y": 0,
          "width": 560,
          "height": 480
        },
        "foot": [
          865.5,
          469
        ],
        "emitter": [
          794,
          82
        ],
        "topY": 33
      },
      "hurt": {
        "rect": {
          "x": 1075,
          "y": 0,
          "width": 461,
          "height": 480
        },
        "foot": [
          1343,
          473
        ],
        "emitter": [
          1347,
          76
        ],
        "topY": 28
      },
      "windup": {
        "rect": {
          "x": 510,
          "y": 0,
          "width": 560,
          "height": 480
        },
        "foot": [
          865.5,
          469
        ],
        "emitter": [
          794,
          82
        ],
        "topY": 33
      }
    }
  },
  {
    "mode": "advanced",
    "assetPath": "/art/final-dragon-v2.webp",
    "width": 1254,
    "height": 1254,
    "headCenters": [
      [
        554,
        232
      ],
      [
        352,
        217
      ],
      [
        192,
        351
      ],
      [
        370,
        421
      ],
      [
        130,
        532
      ],
      [
        837,
        227
      ],
      [
        1017,
        351
      ],
      [
        836,
        431
      ],
      [
        1121,
        514
      ]
    ],
    "frames": {
      "idle": {
        "rect": {
          "x": 0,
          "y": 0,
          "width": 1254,
          "height": 1254
        },
        "foot": [
          625,
          1209
        ],
        "emitter": [
          535,
          310
        ],
        "topY": 19
      },
      "windup": {
        "rect": {
          "x": 0,
          "y": 0,
          "width": 1254,
          "height": 1254
        },
        "foot": [
          625,
          1209
        ],
        "emitter": [
          535,
          310
        ],
        "topY": 19
      },
      "release": {
        "rect": {
          "x": 0,
          "y": 0,
          "width": 1254,
          "height": 1254
        },
        "foot": [
          625,
          1209
        ],
        "emitter": [
          535,
          310
        ],
        "topY": 19
      },
      "hurt": {
        "rect": {
          "x": 0,
          "y": 0,
          "width": 1254,
          "height": 1254
        },
        "foot": [
          625,
          1209
        ],
        "emitter": [
          535,
          310
        ],
        "topY": 19
      }
    }
  }
] as const satisfies readonly FinalBossArtMetadata[];
