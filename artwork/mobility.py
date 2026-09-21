"""Character-part recall sprites. Rejected locomotion is not shipped.

walk-* names remain API-compatible aliases of the original idle artwork until
proper, identity-reviewed locomotion frames are supplied. This is a stationary
pose during host translation, not an authored running animation.
"""
from math import sin, pi
import json
from copy import deepcopy
INK = '#665775'
DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

def path(d, fill, stroke=INK, width=3):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>'

def peek(kind, frame):
    phase=2*pi*frame/8
    if kind == 'dogegg':
        # White mitten and pink pads from Dogegg's wave pose, disappearing into the edge.
        return '<g stroke-linejoin="round">'+path('M93 268L87 151Q87 122 126 120Q163 120 164 152L170 268Z','#29282e','#383442',5)+f'<g transform="rotate({sin(phase)*5} 128 188)">'+path('M65 121C59 80 76 43 104 48Q117 25 136 47Q161 32 177 60Q200 71 193 111L189 147Q176 183 128 185Q79 181 69 151Z','#fffdf1','#383442',5)+path('M105 137Q87 119 110 104Q126 77 146 105Q172 120 152 139Q141 155 127 147Q115 155 105 137Z','#ffadb8','none')+''.join(f'<ellipse cx="{x}" cy="{y}" rx="10" ry="14" fill="#ffadb8"/>' for x,y in [(88,88),(115,68),(145,69),(171,91)])+'</g></g>'
    # Open U-shaped horseshoe viewed from underneath; the center stays transparent.
    metal = '#d9c9ed' if kind == 'boniu' else '#c7d3e4'
    outline = '#756184' if kind == 'boniu' else '#586a83'
    shadow = '#ad96c7' if kind == 'boniu' else '#91a7c4'
    angle = [0, -1.5, -3, -1.5, 0, 1.5, 3, 1.5][frame]
    shoe = path('M70 50Q62 50 60 59L48 125C40 187 78 223 128 223C178 223 216 187 208 125L196 59Q194 50 186 50H157Q150 50 151 59L164 132C169 165 152 182 128 182C104 182 87 165 92 132L105 59Q106 50 99 50Z', metal, outline, 5)
    bevel = path('M53 151C55 192 87 216 128 216C169 216 201 192 203 151', 'none', shadow, 6)
    shine = path('M67 65L57 128M189 65L199 128M99 187Q128 204 157 187', 'none', '#fffafc', 4)
    nails = ''.join(f'<ellipse cx="{x}" cy="{y}" rx="4" ry="6" transform="rotate({tilt} {x} {y})" fill="{outline}"/>' for x,y,tilt in [(78,87,9),(73,133,0),(89,175,-38),(178,87,-9),(183,133,0),(167,175,38)])
    return f'<g transform="rotate({angle} 128 151)">{shoe}{bevel}{shine}{nails}</g>'



def generate(root):
    for kind in ['dogegg','boniu','bolo']:
        folder=root/kind
        pack=json.loads((folder/'character.json').read_text())
        groups=[]
        for frame in range(8):
            body=peek(kind,frame)
            (folder/'frames'/f'peek-{frame:02}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">{body}</svg>')
            groups.append(f'<g transform="translate({frame*256} 0)">{body}</g>')
        for direction in DIRECTIONS:
            pack['reactions']['walk-'+direction]=deepcopy(pack['reactions']['idle'])
        # Old generated cels must not appear in the public studio or future packs.
        for old in (folder/'frames').glob('walk-*.svg'):
            old.unlink()
        pack['reactions']['peek']={'frames':[{'asset':'mobility','rect':[i*256,0,256,256],'duration':240} for i in range(8)],'loop':True,'poster':0}
        (folder/'mobility.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="256">{"".join(groups)}</svg>')
        pack['assets']['mobility']={'src':'./mobility.png','width':2048,'height':256}
        pack['presentation']={'movement':{d:'walk-'+d for d in DIRECTIONS},'peek':'peek'}
        (folder/'character.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2)+'\n')
