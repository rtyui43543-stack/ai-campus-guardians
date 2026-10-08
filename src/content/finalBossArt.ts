import type { AdvancedBossArtFrame } from './advancedBossArt';

/**
 * Original final-boss atlas. All coordinates are absolute atlas pixels.
 * Frames retain the complete generated artwork; windup and release share its cast pose.
 * See public/art/final-bosses-provenance.md. Use alphaTest 0.08 for faint edge pixels.
 */
export interface FinalBossArtMetadata {
  readonly mode: 'starter' | 'advanced';
  readonly assetPath: string;
  readonly width: number;
  readonly height: number;
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
    "assetPath": "/art/final-bosses-v1.webp",
    "width": 1536,
    "height": 1024,
    "frames": {
      "idle": {
        "rect": {
          "x": 0,
          "y": 480,
          "width": 530,
          "height": 544
        },
        "foot": [
          241.5,
          973
        ],
        "emitter": [
          219,
          588
        ],
        "topY": 489
      },
      "release": {
        "rect": {
          "x": 530,
          "y": 480,
          "width": 543,
          "height": 544
        },
        "foot": [
          748.5,
          976
        ],
        "emitter": [
          573,
          654
        ],
        "topY": 487
      },
      "hurt": {
        "rect": {
          "x": 1073,
          "y": 480,
          "width": 463,
          "height": 544
        },
        "foot": [
          1273,
          968
        ],
        "emitter": [
          1218,
          597
        ],
        "topY": 492
      },
      "windup": {
        "rect": {
          "x": 530,
          "y": 480,
          "width": 543,
          "height": 544
        },
        "foot": [
          748.5,
          976
        ],
        "emitter": [
          573,
          654
        ],
        "topY": 487
      }
    }
  }
] as const satisfies readonly FinalBossArtMetadata[];
