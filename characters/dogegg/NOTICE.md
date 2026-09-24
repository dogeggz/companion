# Artwork provenance

Boniu and Bolo are project-authored adaptations of the original standing pony
in EvalHub controller's `internal/server/ui/index.html` (`symbol#pony`). That
source is copied conceptually into the versioned generator here, not loaded at
runtime. Bolo develops the earlier Bouno prototype. Boniu adds a distinct soft
fringe, rose scarf and bow across all animation cels. Mimo is new artwork made
for this project. Its revised design uses a porcelain shell, mint ear cups,
a layered face display and fully drawn hands. Both ponies use clean mouth
lines without a tinted muzzle patch or nostril dots. No external image service or
third-party stock asset was used for those three characters.

Dogegg (狗蛋) is based on a cat photograph supplied by the user. Its cartoon
design reference was created with OpenAI's built-in imagegen tool, then adapted
into the original editable vector rig in `artwork/cat.py`. The user's requested
design has an entirely pink nose, pink paw pads, no blush, and two articulated
front paws. The original photograph and AI design/review images are not runtime
assets. Regenerating the shipped vector cels and PNG atlas is deterministic and
does not call an image service.

Source and downloadable packages are distributed through GitHub. A general
code/artwork license has not been selected; this repository does not include a
LICENSE file. This notice records artwork provenance and is included in each
character package.
