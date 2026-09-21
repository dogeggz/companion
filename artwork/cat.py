"""Dogegg: vector contours traced in the selected reference's coordinate space.

The rest pose uses the LEFT cat in artwork/dogegg/design-reference.png.
The wave pose uses the RIGHT cat translated 639px left. Keep the reference's
wide cheeks, large inward-looking eyes, low ears, rounded boots and long bib.
Coordinates stay in source-image pixels; one common transform fits the rig to
256px. Do not redesign the face while adding animation.
"""
from math import sin, pi

INK, FUR, WHITE = '#383442', '#29282e', '#fffdf1'
PINK, GREEN = '#ffadb8', '#ced681'
STATES = ['idle', 'thinking', 'notification', 'success', 'warning', 'sad', 'sleepy']
GESTURE = [0, .15, .4, .75, 1, 1, .85, .6, .35, .15, 0, 0]
# Each action has its own anticipation, held action and recovery. The three
# accepted clips retain GESTURE and their existing timing/artwork exactly.
MOTION = {
    'thinking': [0, .25, .7, 1, 1, 1, 1, 1, 1, .75, .3, 0],
    'notification': [0, .18, .6, 1, 1, 1, 1, 1, .8, .45, .1, 0],
    'warning': [0, .45, .9, 1, 1, 1, .9, .8, .5, .25, .1, 0],
    'sad': [0, .18, .4, .7, .9, 1, 1, .9, .7, .4, .15, 0],
}
DURATIONS = {
    'thinking': [140, 100, 120, 260, 350, 420, 260, 400, 200, 140, 100, 180],
    'notification': [100, 70, 90, 120, 90, 110, 90, 130, 90, 90, 100, 180],
    'warning': [60, 70, 70, 140, 120, 220, 120, 150, 140, 120, 120, 180],
    'sad': [140, 120, 140, 180, 260, 650, 240, 260, 200, 180, 160, 240],
}
SCALE = .27
OFFSET_X, OFFSET_Y = 45.11, -38.6


def path(d, fill='none', stroke=INK, width=10):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'


def ellipse(x, y, rx, ry, fill, stroke='none', width=10):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'


def paw(side, g, state, frame):
    # One continuous leg + one boot per side. A raised boot replaces the rest boot.
    lift = g if state == 'success' or (side == 1 and state in ('notification', 'thinking')) else 0
    x = 245 if side == -1 else 365
    y = 936
    x += side * 75 * lift
    y -= 205 * lift
    if state == 'thinking' and side == 1:
        x, y = 365 + 9*lift, 936 - 188*lift
    if state == 'warning':
        x += side*14*g
    elif state == 'sad':
        x -= side*12*g
    angle = side * 23 * lift if state != 'thinking' else -12*lift
    if state == 'notification' and side == 1:
        angle += [0, 0, 0, -10, 12, 0, -12, 10, 0, 0, 0, 0][frame]
    shoulder = 211 if side == -1 else 401
    out = [f'<g data-front-paw="{side}">']
    out += [path(f'M{shoulder-33} 809Q{x-56} {y-70} {x-44} {y+8}Q{x} {y+42} {x+44} {y+8}Q{x+47} {y-70} {shoulder+28} 802', FUR, FUR, 8)]
    out += [f'<g transform="translate({x} {y}) rotate({angle})">']
    # Broad, flat-bottomed white mitten from the reference, not a circular button.
    mitten = 'M-48 6C-52 -22 -33 -49 -5 -51C22 -54 45 -37 48 -10C53 17 35 40 7 43C-19 45 -43 31 -48 6Z' if lift > .35 else 'M-46 -20C-40 -46 -13 -50 4 -48C30 -46 45 -33 47 -8L49 13C48 33 28 37 1 37C-27 37 -48 32 -50 14Z'
    out += [path(mitten, WHITE, INK, 10)]
    if lift > .35 and state != 'thinking':
        out += [path('M-17 7C-27 3 -23 -13 -12 -15C-8 -28 7 -26 13 -14C28 -9 26 7 16 12C6 20 -1 13 -8 12C-12 13 -15 11 -17 7Z', PINK, 'none')]
        for dx, dy, rx, ry in [(-29, -24, 6, 9), (-10, -34, 6, 9), (13, -32, 6, 9), (30, -17, 6, 8)]:
            out += [ellipse(dx, dy, rx, ry, PINK)]
    else:
        out += [path('M-17 36Q-19 19 -17 8M19 36Q17 20 19 9', width=7)]
    return ''.join(out) + '</g></g>'


def cat(state='idle', frame=0):
    g, phase = MOTION.get(state, GESTURE)[frame], sin(2*pi*frame/11)
    happy, sad, sleepy = state == 'success', state == 'sad', state == 'sleepy'
    blink = (state == 'idle' and frame in (5, 6)) or (sleepy and 2 <= frame <= 9)
    out = [f'<g transform="translate({OFFSET_X} {OFFSET_Y}) scale({SCALE})" stroke-linecap="round" stroke-linejoin="round">']
    out += [ellipse(310, 962, 210-12*g if happy else 210, 24, '#b5afbf')]
    out += [f'<g transform="translate(0 {-20*g if happy else 0})">']
    tail = 13*phase if state in ('idle', 'thinking') else 16*g
    if state == 'thinking':
        tail = 5*phase
    elif state == 'warning':
        tail = 30*g
    elif sad:
        tail = -65*g
    out += [path(f'M415 927C484 929 535 895 554 {851-tail}C571 {810-tail} 551 {764-tail} 514 {746-tail}C482 {730-tail} 466 {752-tail} 470 {774-tail}C471 {790-tail} 488 {798-tail} 492 {815-tail}C508 859 456 879 412 878Z', FUR, INK, 12)]
    out += [path('M182 710C168 748 151 798 150 833C124 850 111 883 119 912C128 945 163 953 205 950L412 950C450 950 478 932 484 908C494 873 469 845 455 833C451 785 436 746 421 710Z', FUR, INK, 12)]
    # Two broad black hind haunches, with no separate circular or white feet.
    out += [path('M161 833C140 845 120 873 120 898C120 933 147 948 191 948M447 833C475 852 485 878 479 904C475 934 447 947 411 948', width=10)]
    # The long bib is a continuous tapered chest marking, separate from the paws.
    out += [path('M190 717C221 708 385 708 421 717C416 742 409 755 393 755C402 779 388 805 371 806C357 831 332 849 321 867L307 938L295 867C279 851 261 832 247 807C227 813 208 787 208 764C196 758 190 738 190 717Z', WHITE, 'none')]
    bob = 5*g if sad or sleepy else -2.5*phase if state == 'idle' else -2*g
    tilt = -5*g if state == 'thinking' else 4*g if sad else 2*g if sleepy else 0
    droop = 22*g if sad or sleepy else -7*g if state == 'warning' else 0
    if sad:
        bob, tilt, droop = 22*g, 0, 12*g
    elif state == 'warning':
        bob, droop = -12*g, -15*g
    elif state == 'notification':
        droop = -5*g
    head_x = [0, 0, -7, 7, -4, 0, 0, 0, 0, 0, 0, 0][frame] if state == 'warning' else 0
    out += [f'<g transform="translate({head_x} {bob}) rotate({tilt} 307 710)">']
    left_ear = path(f'M91 443C76 403 63 345 76 {294+droop}C79 {269+droop} 86 {257+droop} 107 {266+droop}C153 276 207 310 239 346L242 436Z', FUR, FUR, 12)
    right_ear = path(f'M378 346C419 307 477 {266+droop} 504 {266+droop}C533 {261+droop} 543 {289+droop} 541 {329+droop}C540 374 533 411 522 442L378 432Z', FUR, FUR, 12)
    left_inner = path(f'M105 {303+droop}C116 {285+droop} 164 327 193 365L104 416C96 388 93 336 105 {303+droop}Z', PINK, 'none')
    right_inner = path(f'M506 {302+droop}C493 {288+droop} 450 329 431 365L513 416C521 380 522 325 506 {302+droop}Z', PINK, 'none')
    if sad:
        out += [f'<g transform="rotate({-16*g} 145 420)">{left_ear}{left_inner}</g>', f'<g transform="rotate({16*g} 475 420)">{right_ear}{right_inner}</g>']
    else:
        out += [left_ear, right_ear, left_inner, right_inner]
    # Outer cheek extrema measured from the selected reference: widest at
    # y=540..560, then taper to x=124/489 at y=700. Not a bottom-heavy pear.
    head = 'M89 436C119 387 180 353 237 345C284 330 332 330 378 345C441 354 495 391 527 436C552 481 568 524 568 557C568 609 545 653 515 681C480 718 429 732 369 727Q307 737 242 727C184 732 133 718 99 681C66 652 46 608 47 553C46 518 63 478 89 436Z'
    out += [path(head, FUR, 'none')]
    out += [path('M307 438L328 494L333 487C344 548 355 581 379 602C411 628 465 651 505 676C467 712 411 729 369 727Q307 737 242 727C195 729 143 712 110 678C147 652 204 628 235 604C262 581 272 546 281 488L285 496Z', WHITE, 'none')]
    # Only the cheek/bottom contour is outlined, matching the open ear joins.
    out += [path('M89 436C65 480 52 520 53 553C52 607 71 649 104 677C137 714 188 728 238 726M373 726C426 728 477 713 510 677C540 650 562 607 562 557C562 524 548 483 526 436', width=12)]
    out += [path('M242 719Q307 733 369 719L390 749H224Z', WHITE, 'none')]
    for side in (-1, 1):
        x = 191 if side == -1 else 423
        y = 552 + (6*g if sad else 0)
        if blink or (happy and g > .3):
            out += [path(f'M{x-34} {y}Q{x} {y+18 if not happy else y-23} {x+34} {y}', stroke=GREEN, width=9)]
        else:
            # Only the iris outline leans. The reference pupils are vertical.
            angle = -13 if side == -1 else 13
            out += [f'<g transform="rotate({angle} {x} {y})">', ellipse(x, y, 43, 50+5*g if state == 'warning' else 50, GREEN), '</g>']
            look = 14 if side == -1 else -13
            if state == 'thinking':
                look += [0, -4, -9, -13, -13, 0, 10, 10, 0, -6, -3, 0][frame]
            py = y - (12*g if state == 'thinking' else 0) + (9*g if sad else 0)
            if state == 'thinking':
                eye_clip = f'dogegg-thinking-eye-{frame}-{side}'
                out += [f'<defs><clipPath id="{eye_clip}"><ellipse cx="{x}" cy="{y}" rx="43" ry="50" transform="rotate({angle} {x} {y})"/></clipPath></defs><g clip-path="url(#{eye_clip})">']
            out += [ellipse(x+look, py, 20-6*g if state == 'warning' else 20, 37, '#151719')]
            out += [ellipse(x+look, py-22, 7, 8, '#ffffff')]
            if state == 'thinking':
                out += ['</g>']
            # Trace the tapered upper lid across the iris, dropping toward the
            # nose. A detached symmetric eyebrow loses the reference expression.
            lid_shift = -14*g if state == 'warning' else (side*5*g if state == 'thinking' else 0)
            mirror = '' if side == -1 else 'translate(615 0) scale(-1 1)'
            out += [f'<g transform="translate(0 {lid_shift})"><g transform="{mirror}">']
            if sad and g > 0:
                # Inner corners lift while outer corners fall: worried, not angry.
                out += [path(f'M145 477H244V{550-42*g}L239 {550-42*g}Q185 {482+30*g} 151 {521+20*g}L145 543Z', FUR, 'none')]
                out += [path(f'M151 {521+20*g}Q185 {482+30*g} 239 {550-42*g}', width=6)]
            else:
                out += [path('M151 521C153 505 160 498 174 496C201 492 229 516 239 550C224 527 210 513 190 508C172 501 158 506 151 521Z', '#202024', 'none')]
                out += [path('M157 499C179 482 213 497 229 522', width=5)]
            out += ['</g></g>']
    out += [path('M96 594L140 606M97 635L139 627M474 606L516 594M474 626L516 634', stroke=WHITE, width=6)]
    out += [path('M285 601C295 597 320 597 328 602C335 606 320 621 311 627C307 631 303 628 299 625C289 617 277 606 285 601Z', PINK, 'none')]
    if happy and g > .3:
        out += [path('M279 638Q307 654 336 637C331 675 320 682 307 682C292 682 282 667 279 638Z', '#68444e', INK, 5), ellipse(307, 674, 12, 7, PINK)]
    elif state == 'warning' and g > .3:
        out += [path('M293 645Q307 640 321 645', width=6)]
    elif state == 'thinking' and g > .3:
        out += [path('M297 641Q310 645 321 639', width=6)]
    elif sad and g > .3:
        out += [path('M290 650Q307 633 324 650', width=6)]
    else:
        out += [path('M307 630C307 646 280 655 274 636M307 635C315 653 334 653 341 636', width=6)]
    out += ['</g>', paw(-1, g, state, frame), paw(1, g, state, frame)]
    if state == 'thinking' and g > .35:
        for dot in range(3):
            opacity = 1 if dot == (frame//2) % 3 else .3
            out += [f'<g opacity="{opacity*g}">{ellipse(584+dot*39, 355, 8, 8, "#95a685")}</g>']
    if state == 'notification' and g > .35:
        out += [path('M550 653l14 -12M563 679l19 -2', stroke='#b6a36b', width=6)]
    if state == 'warning' and g > .35:
        out += [f'<g opacity="{g}">', path('M617 405v45', stroke='#d19a50', width=12), ellipse(617, 475, 7, 7, '#d19a50'), '</g>']
    if sleepy and g > .3:
        out += [path('M566 475h24l-24 29h24M600 430h18l-18 22h18', stroke='#a4ad86', width=7)]
    return ''.join(out) + '</g></g>'
