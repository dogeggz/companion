# Character pack v1

A pack supplies a stable canvas, assets, a resting pose and any number of named
reactions. All reaction names are data. The player knows nothing about horses,
gender, six standard states, a fixed frame count or a fixed atlas layout.

```json
{
  "schemaVersion": 1,
  "id": "my-companion",
  "name": "My companion",
  "size": { "width": 128, "height": 128 },
  "assets": {
    "rest": { "src": "./rest.png", "width": 128, "height": 128 },
    "wave": { "src": "./wave.png", "width": 384, "height": 128 }
  },
  "base": { "asset": "rest" },
  "defaultReaction": "idle",
  "reactions": {
    "idle": { "frames": [{ "asset": "rest", "duration": 1500 }], "loop": true },
    "wave": {
      "frames": [
        { "asset": "wave", "rect": [0, 0, 128, 128], "duration": 120 },
        { "asset": "wave", "rect": [128, 0, 128, 128], "duration": 280 },
        { "asset": "wave", "rect": [256, 0, 128, 128], "duration": 180 }
      ],
      "poster": 1,
      "returnTo": "idle"
    }
  }
}
```

`size` is the logical output canvas. Asset dimensions describe the actual image.
`rect` is `[x, y, width, height]` in source pixels. Omit it for an entire image.
Source rectangles are drawn onto the full logical canvas. Use transparent
padding in the source to keep the feet/pivot at the same point across frames.
Assets may be shared by frames or point to separate images.

`duration` is a positive number of milliseconds. `poster` is a zero-based frame
index used for reduced motion; omitted means 0. `loop` defaults to false.
`returnTo` defaults to `defaultReaction`; null holds the last pose. A reaction
that returns to itself also holds instead of endlessly retriggering.

The JSON boundary validates missing assets, empty clips, invalid duration,
cropping outside assets, poster indices and return targets. Image loading also
checks actual dimensions. Validation returns an immutable copy. To extend:

```ts
const next = structuredClone(companion.getSnapshot().character)
next.reactions.listening = {
  frames: [/* your own frame definitions */],
  loop: true,
}
companion.setCharacter(next)
companion.react('listening')
```

Add the assets referenced by those frames to `next.assets`. `setCharacter`
validates and resets to that character's default reaction. Unknown reactions
emit an `unknown-reaction` error and preserve the current state, so a bad name
does not silently display a different emotion.

## Consistent artwork

1. Approve the rest pose and reference views first. Freeze body/head ratio,
   eye spacing, palette, outline width, mane and accessory placement.
2. Draw anticipation, action, recovery and rest from that master. Preserve
   canvas, scale, baseline and transparent edge padding.
3. Start with 8–12 cels for small actions, adding frames where timing or
   secondary motion needs them. Holds need duration changes, not duplicated
   pictures. Keep notification/sad responses short; idle/thinking can loop.
4. Review a contact sheet and playback at 64, 96 and 144 px, on light/dark
   backgrounds. Check silhouettes, face readability, clipping and seams.
5. Re-export the atlas/frames and update JSON. No component changes are needed.

Both pony packs contain seven clips (80 cels each). They share a source rig and
palette conventions but have distinct hair and accessories. `sleepy` has 8 cels;
the other clips have 12. Mimo uses a 240 px canvas, separate SVG assets and 12–14
cels per clip, with a porcelain shell, layered face display and articulated hands. This difference is intentional: it tests the format's flexibility.

AI reference editing can assist a different art style, but independently
generating each frame from a prompt is not the consistency mechanism. The
approved master and frame review remain the source of truth.

Goudan uses a 256 px flat-vector rig with seven 12-cel clips (84 total), exported
to a PNG atlas. The AI-assisted design reference stays in `artwork/goudan/`.
`artwork/cat.py` redraws the tail, ears, face and two front legs consistently;
a raised paw replaces its resting pose rather than adding an extra limb.
The same artwork command generates a review sheet on light/dark backgrounds
at 64, 96 and 144 px. Review material is outside the shipped character directory.
