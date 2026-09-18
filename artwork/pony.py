"""Original pony artwork: deterministic, individually posed SVG cels.

Run from anywhere with Python 3. No network or third-party packages needed.
The browser rasterizer beside this file exports the PNG atlas.
"""
from pathlib import Path
import json

OUT = Path(__file__).resolve().parent
INK = '#665775'
CREAM = '#fff6df'
MANE = '#aa9bd1'
STATES = ['idle', 'thinking', 'notification', 'success', 'warning', 'sad']
# Deliberate anticipation / action / settle poses, not a translated whole image.
GESTURE = [0, .15, .4, .75, 1, 1, .85, .6, .35, .15, 0, 0]


def path(d, fill='none', stroke=INK, width=3):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'


def cel(state='idle', frame=0, girl=False):
    g = GESTURE[frame]
    attentive = state in ('notification', 'warning')
    happy = state == 'success'
    sad = state == 'sad'
    thinking = state == 'thinking'
    blink = state == 'idle' and frame in (4, 5, 6)
    droop = (12 if sad else -3 if attentive else 0) * g
    out = ['<ellipse cx="128" cy="225" rx="61" ry="7" fill="#b1a1c6" opacity=".18"/>',
           '<g stroke-linecap="round" stroke-linejoin="round">']
    # Short tail curls; all feet keep the same baseline.
    out += [path(f'M94 178Q{55-5*g} {160+6*g} 62 189Q66 199 {51-3*g} 201Q79 217 91 193L103 188', MANE),
            path('M94 183L91 212Q91 224 103 223Q113 223 113 212L115 186', '#eee3d6'),
            path('M141 186L141 213Q140 224 152 223Q164 223 162 211L158 181', '#eee3d6'),
            path('M91 213Q102 217 113 212L113 221Q101 228 91 222Z', MANE),
            path('M141 213Q151 217 162 212L163 220Q151 228 141 222Z', MANE),
            path('M97 151Q85 162 89 186Q94 204 127 202Q159 202 165 183Q169 165 155 152', CREAM),
            '<ellipse cx="128" cy="184" rx="21" ry="12" fill="#fffdf4"/>']
    # Forelegs have explicit bent silhouettes in each cel.
    if happy:
        out += [path(f'M99 158Q{83-8*g} {157-15*g} {82-9*g} {170-33*g}Q{76-10*g} {176-36*g} {71-5*g} {169-38*g}Q{66-4*g} {162-35*g} {77-3*g} {159-33*g}L91 149', CREAM)]
    else:
        out += [path('M98 158Q88 157 84 169L79 179Q78 188 86 189Q94 190 99 179L105 167', CREAM),
                path('M79 181Q86 185 94 183', stroke='#b9a8d7', width=4)]
    if thinking or sad:
        x, y = 167-16*g, 181-48*g
        out += [path(f'M151 158Q167 153 {x+6} {y-9}Q{x+10} {y+2} {x} {y+5}Q{x-9} {y+6} {x-9} {y-4}L148 172', CREAM)]
    elif state == 'notification' or happy:
        x, y = 172+7*g, 175-43*g
        out += [path(f'M152 158Q162 151 {x-2} {y-9}Q{x+5} {y-18} {x+10} {y-10}Q{x+15} {y-2} {x+7} {y+4}L161 177', CREAM)]
    else:
        out += [path('M155 159Q168 159 171 171L176 182Q176 191 168 191Q160 191 156 179L149 169', CREAM),
                path('M163 186Q169 184 174 181', stroke='#b9a8d7', width=4)]
    # A tiny scout scarf, with a constant four-point brass star clasp.
    out += [path(f'M132 161L{139+g*4} 182L151 177L145 158Z', '#80b6b4', '#537d84', 2),
            path('M95 151Q127 161 159 150L159 160Q129 175 96 161Z', '#91c5bf', '#537d84', 2),
            path('M101 157Q118 163 131 163', stroke='#d4e9db', width=2),
            path('M139 157L142 163L148 165L142 168L139 174L136 168L130 165L136 163Z', '#f2cb7b', '#a98a5c', 1.5)]
    # Long horse ears (not round dog ears), with independently redrawn tips.
    out += [path(f'M87 79L{82-droop} {40+droop}Q{82-droop} {28+droop} {94-droop} {37+droop}L111 64', CREAM),
            path(f'M140 62L{154+droop} {32+droop}Q{161+droop} {23+droop} {167+droop} {37+droop}L171 81', CREAM),
            path(f'M{90-droop*.7} {45+droop}L99 65M{160+droop*.7} {40+droop}L157 65', stroke='#e8b5ba', width=6),
            path('M76 103Q75 66 121 61Q168 55 179 95L184 124Q184 152 148 159L106 156Q71 148 76 103Z', '#fff9e9')]
    # Three recognizable short locks and a small off-centre cowlick.
    out += [path('M76 105Q64 89 77 77Q83 63 104 62L109 50Q114 45 122 50L120 39Q139 43 145 59Q167 58 177 76Q185 87 177 102Q162 103 156 88Q147 108 124 100Q136 89 133 77Q118 99 99 91Q95 106 76 105Z', MANE),
            path('M84 83Q92 72 104 73M145 71Q161 68 170 84', stroke='#d2c6e9', width=3),
            '<ellipse cx="94" cy="131" rx="11" ry="6" fill="#f1bec0" opacity=".8"/>',
            '<ellipse cx="164" cy="131" rx="11" ry="6" fill="#f1bec0" opacity=".8"/>']
    # Eyes and mouth are separate cels, with actual shape changes.
    if (happy and g > .3) or blink:
        eyes = 'M103 120Q108 114 113 120M149 120Q154 114 159 120' if happy else 'M103 123Q108 126 113 123M149 123Q154 126 159 123'
        out += [path(eyes, width=3.5)]
    elif sad and g > .3:
        out += [path('M103 119Q107 117 112 114M148 114Q153 117 158 119', width=2),
                '<ellipse cx="108" cy="125" rx="3.4" ry="4.6" fill="#665775"/><ellipse cx="153" cy="125" rx="3.4" ry="4.6" fill="#665775"/>',
                path(f'M157 130Q{163+g*2} {139+g*5} 158 {140+g*5}Q152 139 157 130', '#b4dce6', '#84b7ce', 1)]
    elif attentive and g > .4:
        out += ['<ellipse cx="108" cy="120" rx="4" ry="6" fill="#665775"/><ellipse cx="154" cy="120" rx="4" ry="6" fill="#665775"/>',
                '<circle cx="109" cy="118" r="1.3" fill="white"/><circle cx="155" cy="118" r="1.3" fill="white"/>']
    else:
        shift = 3*g if thinking else 0
        out += [path(f'M{107+shift} 118v5M{153+shift} 118v5', width=5)]
    if happy and g > .3:
        out += [path('M120 141Q130 146 140 141Q138 155 130 154Q122 153 120 141Z', '#a26f83', INK, 2),
                path('M126 151Q131 147 136 151', stroke='#edb2b7', width=3)]
    elif sad and g > .3:
        out += [path('M125 146Q130 141 136 146', width=2.5)]
    elif (attentive or thinking) and g > .4:
        out += ['<ellipse cx="132" cy="144" rx="3" ry="4" fill="#a58186"/>']
    else:
        out += [path('M123 141Q130 148 138 140', width=2.5)]
    # Accents are timed with the action, never used as the only animation.
    if g > .3:
        if happy:
            out += [path('M47 79L50 86L57 89L50 92L47 99L44 92L37 89L44 86Z', '#e7bf70', 'none'), path('M207 111l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z', '#91c5bf', 'none')]
        if thinking:
            out += [f'<circle cx="{192+i*10}" cy="{78-i*8}" r="{2+i}" fill="#aa9bd1" opacity="{1 if frame >= 2+i else .2}"/>' for i in range(3)]
        if state == 'notification':
            out += [path('M198 79l8-7M202 90l10-2', stroke='#80b6b4', width=3)]
        if state == 'warning':
            out += [path('M205 68L219 93Q220 97 216 97H191Q188 97 190 93L202 69Q203 67 205 68Z', '#f7db91', '#b99754', 2), path('M204 78v8M204 91v.1', stroke='#987945', width=3)]
    if girl:
        # Distinct soft, longer fringe and the original companion's rose bow.
        male = 'M76 105Q64 89 77 77Q83 63 104 62L109 50Q114 45 122 50L120 39Q139 43 145 59Q167 58 177 76Q185 87 177 102Q162 103 156 88Q147 108 124 100Q136 89 133 77Q118 99 99 91Q95 106 76 105Z'
        female = 'M76 105Q59 89 75 76Q83 54 108 59Q130 41 152 61Q180 60 182 91Q170 112 159 86Q145 112 122 101Q135 88 132 76Q112 102 94 91Q96 108 76 105Z'
        out = [part.replace(male, female).replace('#aa9bd1','#bca7e5').replace('#91c5bf','#d69bb3').replace('#80b6b4','#c98fa5').replace('#537d84','#9c697f').replace('#d4e9db','#efd1dd') for part in out]
        out += ['<g transform="translate(166 81) rotate(15)" stroke="#ad7893" stroke-width="1.7" fill="#edb4ca">',
                path('M-2 0Q-24-16-23-3L-22 8Q-17 16-2 5M3 0Q25-16 24-2L22 10Q17 16 3 5', '#edb4ca', '#ad7893', 1.7),
                path('M-3 4L-8 19L-1 16L3 20L5 5M4 4L8 18L13 15L17 17L10 2', '#edb4ca', '#ad7893', 1.7),
                '<rect x="-4" y="-3" width="9" height="11" rx="3" fill="#f5cbd9"/>',
                path('M-17 1L-7 3M17 1L8 3', stroke='#ffe2ed', width=2), '</g>']
    out.append('</g>')
    return ''.join(out)
