# 狗蛋 / Goudan

A cute, slightly cheeky male tuxedo cat based on the user's photograph.
`design-reference.png` is the user-selected design made with built-in imagegen.
`../cat.py` traces its contours in the original reference coordinate space,
then applies one scale/translation to fit the 256px runtime canvas. Preserve
the wide face, large oval eyes/pupils, continuous muzzle/bib, broad boots and
curved haunches when changing reactions. The earlier simplified rig was rejected.
`implemented-poses.png` shows the actual rest/wave vector output at the same
positions and scale as the reference for a direct visual comparison.

Head constraints: pupil axes are vertical within the face (only the green iris
outlines lean); upper lids taper downward toward the nose and overlap the iris,
rather than becoming detached eyebrows. The cheeks are widest around reference
y=540–560 and taper below that. Browser checks compare cheek edges and pupil
axes directly with the selected reference image, in its original coordinates.

Design constraints: charcoal fur, ivory blaze/bib/mittens, yellow-green eyes,
a solid pink nose without a black spot, no blush or eyelashes, and pink paw
pads. Each front leg has exactly one paw: raising it removes that paw from
the ground. Black hind haunches remain seated.

Run `bun run artwork` to regenerate SVG cels, PNG atlas, portrait and manifest.
This deterministic rig makes no network requests. `review.png` shows all seven
reactions at 64, 96 and 144px on light/dark backgrounds. Front legs, ears,
eyelids, mouth and tail are redrawn per frame. Idle and thinking loop.

The four refined clips have separate motion curves and per-frame durations in
`cat.py`. Thinking holds a chin-rest pose while the gaze and dots move slowly;
notification is a brief two-part wrist wave; warning braces both paws, pricks
the ears and shows an amber alert; sad lowers the head, turns the ears outward,
tucks the paws and lowers the tail before recovering. `motion-review.png`
shows their anticipation, held poses and recovery with elapsed timestamps.
The approved idle, success and sleepy cels and their timing are preserved.

The photograph and discarded concepts are not distributed. This directory's
design reference, prompt record and review sheet stay out of the runtime pack.
