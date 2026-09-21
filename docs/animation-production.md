# Animation production handoff

Status: procedural quadruped cycles rejected on 2026-09-21. Do not reuse their
faces or advertise them as production-ready. Current walk-* clips deliberately
alias original idle frames for compatibility. The current preferred automatic
travel is an identity-preserving portal animation (core 0.6 / packs 0.5). The
EvalHub host uses teleport; quadruped production below is optional future work.

Use characters/dogegg/base.png and artwork/dogegg/design-reference.png for Dogegg
identity; use the pony base.png files for their approved faces/colors. Preserve
cheek width, ears, green eyes, white muzzle/bib/boots, pony mane and accessories.
Do not derive new profiles by clipping a sitting sprite or stretching the face.
First deliver one right-facing cat run with a matching static profile for approval,
then expand to front/back/diagonal views and the two ponies. Use actual quadruped
contact, compression, passing and suspension poses; grounded feet must not slide.

Deliver transparent 256x256 PNG cels (optional 512x512 source), consistent canvas
and ground line, per-frame durations, seamless loop, character turnarounds,
editable layered source/rig, and PNG atlas plus frame rectangles. Keep face
features and markings consistent frame to frame. Review at both native scale
and the 144px in-app size, dark/light backgrounds, slow motion and screen travel.
Do not crop or auto-trim each frame independently; hold a stable pivot.

Preferred production: a 2D character animator working in Spine, then export PNG
sequences/atlas to retain the existing portable renderer. The package does not
need a Spine runtime for rendered PNG frames. Check the artist/tool license for
the actual deliverable. Official export: https://esotericsoftware.com/spine-export

AI-assisted trial: Scenario's reference-image -> video -> extracted frames workflow:
https://help.scenario.com/articles/9088582240-create-spritesheets-with-scenario
Treat output as candidates requiring identity, loop, alpha and foot-contact review.
No paid account, API integration or asset upload has been performed by this project.
PixelLab focuses on pixel-art animation and is a less direct fit for this smooth
illustration style: https://www.pixellab.ai/docs/tools/animation

Import approved frames by replacing CharacterPack reaction data and
presentation.movement mappings. Keep reaction names/API backwards compatible;
custom packs remain unrestricted. The existing renderer consumes PNGs and timing.
