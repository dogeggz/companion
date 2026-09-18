"""Mimo: porcelain shell, mint ear cups and a soft illuminated face.

Each cel redraws articulated arms, hands, antenna and facial expressions.
The 240 px canvas leaves room for gestures without cropping the silhouette.
"""
from math import sin, pi

INK = '#596c78'


def path(d, fill='none', stroke=INK, width=2.6):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'


def circle(x, y, r, fill, stroke='none', width=2):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'


def robot(state, i, count):
    gesture = [0, .12, .35, .65, .9, 1, .9, .65, .35, .12, 0, 0]
    g = gesture[min(i, 11)] if state != 'dance' else sin(pi*i/(count-1))
    happy = state in ('success', 'dance')
    sad = state == 'sad'
    thinking = state == 'thinking'
    notify = state == 'notification'
    warning = state == 'warning'
    dance = sin(2*pi*i/(count-1)) if state == 'dance' else 0
    blink = state == 'idle' and i in (5, 6)
    body = '''<defs>
<linearGradient id="shell" x1="0" y1="0" x2=".7" y2="1" gradientUnits="objectBoundingBox"><stop stop-color="#fffdf4"/><stop offset=".65" stop-color="#f4f1e8"/><stop offset="1" stop-color="#d9e0dc"/></linearGradient>
<linearGradient id="mint" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d3e7dc"/><stop offset="1" stop-color="#91bdb5"/></linearGradient>
<linearGradient id="screen" x1="0" y1="0" x2=".65" y2="1"><stop stop-color="#596d7b"/><stop offset=".55" stop-color="#405362"/><stop offset="1" stop-color="#344552"/></linearGradient>
<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#cce6df" stop-opacity=".2"/><stop offset="1" stop-color="#cce6df" stop-opacity="0"/></linearGradient>
</defs>'''
    body += '<ellipse cx="120" cy="222" rx="56" ry="6" fill="#7c9995" opacity=".17"/>'
    body += '<g stroke-linecap="round" stroke-linejoin="round">'
    # Little socks and rounded, visibly separated boots.
    for x, sway in [(102, -dance*4), (140, dance*4)]:
        body += path(f'M{x-6} 183Q{x-7+sway} 195 {x-7+sway} 208L{x+7+sway} 208Q{x+6} 195 {x+6} 183', '#c2d5ce')
        body += path(f'M{x-8+sway} 203Q{x+sway} 199 {x+8+sway} 204L{x+11+sway} 213Q{x+12+sway} 219 {x+4+sway} 219H{x-12+sway}Q{x-18+sway} 217 {x-15+sway} 211Z', 'url(#shell)')
        body += path(f'M{x-13+sway} 214Q{x+sway} 217 {x+9+sway} 213', stroke='#a4bcb3', width=2)
    # Neck ring and shoulders behind the head.
    body += path('M103 133V149Q120 157 138 149V133', '#aac7bf')
    body += path('M93 145Q120 134 148 145Q163 161 157 184Q154 201 121 202Q87 201 83 183Q78 160 93 145Z', 'url(#shell)')
    body += path('M88 173Q87 193 105 195', stroke='#ffffff', width=3)
    body += path('M148 174Q151 186 143 190', stroke='#c7d6cf', width=2)
    body += '<rect x="100" y="155" width="40" height="29" rx="11" fill="#e6ede4" stroke="#afc4b8" stroke-width="1.5"/>'
    body += path('M113 167Q107 160 111 158Q117 155 121 162Q124 156 129 159Q136 165 121 176Z', '#b2cfc0', '#8fb1a5', 1.3)
    body += '<path d="M112 185h16" stroke="#c5d4cb" stroke-width="1.8"/>'
    body += circle(113, 191, 1.5, '#a3bcaf') + circle(120, 191, 1.5, '#a3bcaf') + circle(127, 191, 1.5, '#a3bcaf')
    # Left arm and right arm: actual joint and mitten silhouettes per pose.
    left = (68-15*g if happy else 68, 177-47*g if happy else 177+3*g)
    right = (173+10*g, 177-51*g) if happy or notify else (174-13*g, 177-53*g) if thinking or sad else (175, 177-10*g if warning else 177)
    for side, (x, y) in [(-1, left), (1, right)]:
        shoulder = 86 if side == -1 else 156
        elbowx = 72 if side == -1 else 168
        elbowy = (162+y)/2
        d = f'M{shoulder} 158Q{elbowx} {elbowy} {x} {y-3}'
        body += path(d, stroke=INK, width=13)
        body += path(d, stroke='#d6e0d8', width=8)
        body += circle(shoulder, 158, 6, 'url(#mint)', INK, 2)
    # Antenna: a soft flexible stalk, with separate leaning poses.
    tipx, tipy = 123+g*(14 if sad else 5), 28+g*(9 if sad else -3)
    body += path(f'M120 49Q117 35 {tipx} {tipy+4}', stroke=INK, width=4)
    body += path(f'M120 47Q119 36 {tipx} {tipy+4}', stroke='#bacfc2', width=2)
    body += circle(tipx, tipy, 7, '#efc48c' if warning else '#b5d6c2', INK, 2)
    body += circle(tipx-2, tipy-2, 2, '#f5fff1')
    # Mint ear cups with an inset ivory ring and a small seam.
    for x in (52, 188):
        body += f'<rect x="{x-10}" y="80" width="20" height="43" rx="9" fill="url(#mint)" stroke="{INK}" stroke-width="2.5"/>'
        body += path(f'M{x-5} 89V111', stroke='#e6f1e7', width=2)
        body += path(f'M{x+5} 90V112', stroke='#82a9a2', width=1.5)
    body += path('M57 80Q59 49 89 47Q120 43 151 48Q183 51 184 82L182 115Q179 143 149 148Q119 152 88 147Q59 143 56 116Z', 'url(#shell)', INK, 2.8)
    body += path('M67 78Q70 56 94 55L146 55', stroke='#ffffff', width=3)
    body += path('M71 132Q91 144 122 142', stroke='#cdd9d0', width=2)
    # Recessed display rim, inner glass and broad controlled reflection.
    body += '<rect x="66" y="62" width="108" height="69" rx="24" fill="#91a9ad" stroke="#819899" stroke-width="1.4"/>'
    body += '<rect x="70" y="66" width="100" height="61" rx="21" fill="url(#screen)" stroke="#526574" stroke-width="1.5"/>'
    body += path('M75 86Q76 71 91 71H152Q127 81 78 94Z', 'url(#gloss)', 'none')
    body += path('M80 78Q84 72 93 73', stroke='#d3e7e3', width=2)
    body += path('M153 117h5', stroke='#9ac5b6', width=1.5)
    # Soft screen expressions; no eyes changing only by uniform scaling.
    eye = '#d4f1dc'
    if blink:
        body += path('M91 98Q97 101 103 98M136 98Q142 101 148 98', stroke=eye, width=3)
    elif happy and g > .3:
        body += path('M90 98Q97 84 104 98M135 98Q142 84 149 98', stroke=eye, width=3.5)
    elif sad and g > .3:
        body += path('M91 89Q98 90 104 85M135 85Q142 90 149 89', stroke=eye, width=2.5)
        body += '<ellipse cx="98" cy="98" rx="3.8" ry="5" fill="#d4f1dc"/><ellipse cx="142" cy="98" rx="3.8" ry="5" fill="#d4f1dc"/>'
        body += path('M148 104Q155 112 150 115Q143 116 148 104Z', '#add5e3', 'none')
    else:
        dx = g*3 if thinking else 0
        ry = 8 if warning and g > .3 else 6
        for x in (97+dx, 143+dx):
            body += f'<ellipse cx="{x}" cy="96" rx="4.5" ry="{ry}" fill="{eye}"/>'
            body += circle(x-1, 94, 1.2, '#f7fff8')
    body += '<ellipse cx="85" cy="109" rx="6" ry="2.5" fill="#dcacaa" opacity=".52"/><ellipse cx="155" cy="109" rx="6" ry="2.5" fill="#dcacaa" opacity=".52"/>'
    if happy and g > .3:
        body += path('M113 108Q120 112 127 108Q127 119 120 119Q114 119 113 108Z', '#d4f1dc', 'none')
    elif sad and g > .3:
        body += path('M114 113Q120 108 126 113', stroke=eye, width=2)
    elif warning and g > .3:
        body += '<ellipse cx="120" cy="111" rx="3" ry="4" fill="#d4f1dc"/>'
    elif thinking and g > .3:
        body += path('M118 111h5', stroke=eye, width=2)
    else:
        body += path('M115 109Q120 114 125 109', stroke=eye, width=2)
    # Frontmost hands overlap the shell when touching the cheek.
    for x, y in (left, right):
        body += path(f'M{x-7} {y-8}Q{x-13} {y-3} {x-11} {y+4}Q{x-6} {y+12} {x+3} {y+9}Q{x+12} {y+6} {x+9} {y-2}Q{x+9} {y-8} {x+4} {y-9}Z', 'url(#mint)', INK, 2.3)
        body += path(f'M{x-7} {y-3}Q{x-5} {y-7} {x-1} {y-6}', stroke='#edf6e9', width=2)
        body += path(f'M{x+5} {y-1}L{x+5} {y+3}', stroke='#8cb2a9', width=1.4)
    if g > .3:
        if thinking:
            for j in range(3): body += circle(196+j*9, 62-j*9, 1.8+j*.6, '#a9bfaa')
        elif happy:
            body += path('M33 68l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z', '#eac586', 'none')
            body += path('M208 146l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z', '#adb8d6', 'none')
            if state == 'dance': body += path('M201 63v15q-7-3-7 2t7 0M201 65l10-3v12q-7-3-7 2t7 0', stroke='#a3a3c6', width=2)
        elif notify:
            body += path('M200 94l8-5M202 104h9', stroke='#b7a071', width=2)
        elif warning:
            body += path('M207 67v11M207 85v.2', stroke='#ce9a65', width=3)
    body += '</g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">{body}</svg>'
