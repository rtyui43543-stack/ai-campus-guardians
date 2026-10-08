/**
 * Original advanced boss pose atlases, measured in source image pixels.
 * The complete generated RGBA atlas is preserved without cropping or repacking.
 * See public/art/advanced-bosses-provenance.md for prompts, hashes and alpha checks.
 * alphaTest 0.08 discards the generated faint background fringes (alpha <= 20).
 */
export type AdvancedBossArtPose = 'idle' | 'windup' | 'release' | 'hurt';

export interface AdvancedBossArtFrame {
  readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly foot: readonly [number, number];
  readonly emitter: readonly [number, number];
  readonly topY: number;
}

export interface AdvancedBossArtMetadata {
  readonly chapterId: number;
  readonly width: number;
  readonly height: number;
  readonly frames: Readonly<Record<AdvancedBossArtPose, AdvancedBossArtFrame>>;
}

export const ADVANCED_BOSS_ART = [
  {
    "chapterId": 1,
    "width": 1254,
    "height": 1254,
    "frames": {
      "idle": {
        "rect": {
          "x": 48,
          "y": 64,
          "width": 582,
          "height": 540
        },
        "foot": [
          343.5,
          573
        ],
        "emitter": [
          90,
          491
        ],
        "topY": 84
      },
      "windup": {
        "rect": {
          "x": 650,
          "y": 80,
          "width": 584,
          "height": 525
        },
        "foot": [
          958,
          566
        ],
        "emitter": [
          695,
          349
        ],
        "topY": 109
      },
      "release": {
        "rect": {
          "x": 20,
          "y": 650,
          "width": 665,
          "height": 570
        },
        "foot": [
          413.5,
          1166
        ],
        "emitter": [
          76,
          925
        ],
        "topY": 693
      },
      "hurt": {
        "rect": {
          "x": 700,
          "y": 650,
          "width": 535,
          "height": 570
        },
        "foot": [
          978,
          1156
        ],
        "emitter": [
          806,
          907
        ],
        "topY": 672
      }
    }
  },
  {
    "chapterId": 2,
    "width": 1254,
    "height": 1254,
    "frames": {
      "idle": {
        "rect": {
          "x": 100,
          "y": 0,
          "width": 535,
          "height": 620
        },
        "foot": [
          331,
          604
        ],
        "emitter": [
          142,
          338
        ],
        "topY": 19
      },
      "windup": {
        "rect": {
          "x": 700,
          "y": 0,
          "width": 540,
          "height": 620
        },
        "foot": [
          950.5,
          603
        ],
        "emitter": [
          758,
          296
        ],
        "topY": 20
      },
      "release": {
        "rect": {
          "x": 20,
          "y": 630,
          "width": 660,
          "height": 604
        },
        "foot": [
          396.5,
          1210
        ],
        "emitter": [
          104,
          858
        ],
        "topY": 635
      },
      "hurt": {
        "rect": {
          "x": 720,
          "y": 630,
          "width": 534,
          "height": 604
        },
        "foot": [
          951,
          1212
        ],
        "emitter": [
          811,
          915
        ],
        "topY": 649
      }
    }
  },
  {
    "chapterId": 3,
    "width": 1254,
    "height": 1254,
    "frames": {
      "idle": {
        "rect": {
          "x": 48,
          "y": 0,
          "width": 622,
          "height": 630
        },
        "foot": [
          378.5,
          621
        ],
        "emitter": [
          105,
          360
        ],
        "topY": 16
      },
      "windup": {
        "rect": {
          "x": 690,
          "y": 0,
          "width": 535,
          "height": 630
        },
        "foot": [
          943.5,
          618
        ],
        "emitter": [
          1098,
          382
        ],
        "topY": 18
      },
      "release": {
        "rect": {
          "x": 0,
          "y": 630,
          "width": 700,
          "height": 604
        },
        "foot": [
          495,
          1210
        ],
        "emitter": [
          62,
          866
        ],
        "topY": 637
      },
      "hurt": {
        "rect": {
          "x": 710,
          "y": 630,
          "width": 544,
          "height": 604
        },
        "foot": [
          992,
          1216
        ],
        "emitter": [
          796,
          911
        ],
        "topY": 652
      }
    }
  },
  {
    "chapterId": 4,
    "width": 1254,
    "height": 1254,
    "frames": {
      "idle": {
        "rect": {
          "x": 110,
          "y": 0,
          "width": 535,
          "height": 620
        },
        "foot": [
          287.5,
          609
        ],
        "emitter": [
          213,
          453
        ],
        "topY": 13
      },
      "windup": {
        "rect": {
          "x": 685,
          "y": 0,
          "width": 569,
          "height": 620
        },
        "foot": [
          887,
          607
        ],
        "emitter": [
          956,
          305
        ],
        "topY": 21
      },
      "release": {
        "rect": {
          "x": 60,
          "y": 620,
          "width": 630,
          "height": 614
        },
        "foot": [
          321,
          1196
        ],
        "emitter": [
          110,
          899
        ],
        "topY": 631
      },
      "hurt": {
        "rect": {
          "x": 745,
          "y": 620,
          "width": 509,
          "height": 614
        },
        "foot": [
          956.5,
          1198
        ],
        "emitter": [
          910,
          944
        ],
        "topY": 660
      }
    }
  },
  {
    "chapterId": 5,
    "width": 1254,
    "height": 1254,
    "frames": {
      "idle": {
        "rect": {
          "x": 75,
          "y": 10,
          "width": 575,
          "height": 610
        },
        "foot": [
          329.5,
          584
        ],
        "emitter": [
          590,
          193
        ],
        "topY": 37
      },
      "windup": {
        "rect": {
          "x": 700,
          "y": 10,
          "width": 554,
          "height": 610
        },
        "foot": [
          947,
          597
        ],
        "emitter": [
          1180,
          90
        ],
        "topY": 36
      },
      "release": {
        "rect": {
          "x": 0,
          "y": 630,
          "width": 675,
          "height": 604
        },
        "foot": [
          425,
          1200
        ],
        "emitter": [
          35,
          803
        ],
        "topY": 658
      },
      "hurt": {
        "rect": {
          "x": 725,
          "y": 630,
          "width": 529,
          "height": 604
        },
        "foot": [
          945.5,
          1200
        ],
        "emitter": [
          1100,
          830
        ],
        "topY": 682
      }
    }
  },
  {
    "chapterId": 6,
    "width": 1254,
    "height": 1254,
    "frames": {
      "idle": {
        "rect": {
          "x": 50,
          "y": 0,
          "width": 565,
          "height": 630
        },
        "foot": [
          329.5,
          622
        ],
        "emitter": [
          123,
          456
        ],
        "topY": 14
      },
      "windup": {
        "rect": {
          "x": 635,
          "y": 40,
          "width": 619,
          "height": 590
        },
        "foot": [
          961,
          616
        ],
        "emitter": [
          1090,
          187
        ],
        "topY": 69
      },
      "release": {
        "rect": {
          "x": 0,
          "y": 635,
          "width": 705,
          "height": 619
        },
        "foot": [
          437,
          1212
        ],
        "emitter": [
          107,
          856
        ],
        "topY": 656
      },
      "hurt": {
        "rect": {
          "x": 715,
          "y": 630,
          "width": 539,
          "height": 624
        },
        "foot": [
          1055.5,
          1214
        ],
        "emitter": [
          842,
          903
        ],
        "topY": 642
      }
    }
  }
] as const satisfies readonly AdvancedBossArtMetadata[];
