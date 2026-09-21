"""Authored four-legged run/trot cels in eight views; original faces and markings.

Each leg has contact, loading, push-off and recovery poses. The cat bounds with
staggered front/hind pairs and a flexing spine; ponies use a diagonal-pair trot.
The screen translation remains the host's job, never baked into sprite frames.
"""
from math import sin, cos, pi
from pathlib import Path
import json
from pony import cel
from cat import cat

DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
INK = '#665775'


def path(d, fill, stroke=INK, width=3):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>'


def head(kind, direction, frame):
    feline, girl = kind == 'dogegg', kind == 'boniu'
    side = 1 if 'e' in direction else 0
    rear = 'n' in direction
    mane = '#bca7e5' if girl else '#aa9bd1'
    fur, ink = ('#29282e', '#383442') if feline else ('#fff6df', INK)
    out = []

    head_id = f'head-{kind}-{direction}-{frame}'
    if direction in ('e','w'):
        mirror = 'translate(256 0) scale(-1 1)' if side < 0 else ''
        out += [f'<g transform="{mirror}">']
        if feline:
            out += [path('M78 86L69 36Q69 25 81 32L110 55M126 56L150 33Q160 27 165 42L167 77',fur,ink), path('M78 68Q103 48 133 52Q162 54 175 82L186 108Q191 115 202 123Q205 132 189 137Q186 153 168 160Q125 177 89 150Q57 126 64 99Q68 80 78 68Z',fur,ink), path('M170 107Q182 115 194 123L188 141Q179 159 149 163L126 155Q152 144 159 130Z','#fffdf1','none'), '<ellipse cx="151" cy="105" rx="15" ry="21" fill="#ced681"/><ellipse cx="156" cy="106" rx="6" ry="16" fill="#151719"/><ellipse cx="158" cy="96" rx="3" ry="4" fill="white"/>', path('M132 89Q145 80 163 94','none',ink,3), path('M190 119L201 123L193 130Z','#ffadb8','none'), path('M193 133Q183 141 179 134M167 139l-11 3M168 145l-9 5','none',ink,2)]
        else:
            out += [path('M99 82L94 39Q94 28 105 36L127 69M139 68L155 36Q162 28 166 42L168 83','#fff6df'), path('M91 94Q88 66 127 65Q164 63 170 94L173 113Q184 118 193 128Q199 146 180 153L144 159Q110 161 95 144Q87 127 91 94Z','#fff9e9'), path('M92 108Q78 96 84 82Q86 66 108 62L116 44Q134 42 144 61Q163 61 170 77Q177 97 161 106L151 87Q132 108 119 100Q123 115 105 112Z',mane), '<ellipse cx="153" cy="119" rx="4" ry="6" fill="#665775"/>', path('M177 140Q184 145 188 138','none',INK,2.5), '<ellipse cx="170" cy="132" rx="8" ry="5" fill="#f1bec0" opacity=".7"/>']
            if girl:
                out += [path('M103 88Q83 75 84 92Q89 106 105 96Q120 108 124 91Q122 77 107 88Z','#edb4ca','#ad7893',2), '<circle cx="105" cy="92" r="4" fill="#f5cbd9"/>']
        out += ['</g>']
    elif not rear:
        height = 163 if feline else 159
        face = cat('idle', 0) if feline else cel('idle', 0, girl)
        sx = .90 if side else 1
        out += [f'<defs><clipPath id="{head_id}"><rect width="256" height="{height}"/></clipPath></defs>', f'<g transform="translate({128*(1-sx)+side*5} 0) scale({sx} 1)" clip-path="url(#{head_id})">{face}</g>']
    elif feline:
        out += [path('M69 84L63 39Q64 25 77 33L107 55M151 55L181 32Q194 26 193 43L188 86',fur,ink), path('M72 69Q93 48 126 48Q165 48 187 72Q210 101 197 133Q184 161 128 164Q75 162 61 133Q48 100 72 69Z',fur,ink), path('M91 78Q103 67 113 68M151 69Q163 67 173 80','none','#45424b',2)]
    else:
        out += [path('M87 81L82 40Q82 28 94 37L111 64M140 62L154 32Q161 23 167 37L171 81','#fff6df'), path('M76 103Q75 66 121 61Q168 55 179 95L184 124Q184 154 148 159L106 156Q71 148 76 103Z','#fff6df'), path('M76 105Q64 83 79 72Q87 59 109 59L116 43Q133 41 146 59Q174 59 180 83L180 132Q168 150 155 143L147 126Q131 151 113 142L104 131Q89 151 77 134Z',mane), path('M92 90Q90 112 98 123M124 81Q125 108 119 123M157 87Q166 109 162 123','none','#d6c8ed',2)]
        if girl:
            out += [path('M164 86Q148 68 147 86Q148 101 165 94Q183 108 185 89Q183 73 167 86Z','#edb4ca','#ad7893',2), '<circle cx="166" cy="89" r="5" fill="#f5cbd9"/>']
    if rear and side:
        mirror = 'translate(256 0) scale(-1 1)' if side < 0 else ''
        out += [f'<g transform="{mirror}">']
        if feline:
            out += [path('M191 116Q202 122 197 135Q191 151 173 156L175 145Q188 139 191 116Z','#fffdf1','none'), '<ellipse cx="188" cy="111" rx="6" ry="14" fill="#ced681"/><ellipse cx="190" cy="111" rx="2.5" ry="11" fill="#151719"/>', path('M196 126l7 2-6 5Z','#ffadb8','none')]
        else:
            out += [path('M177 112Q192 120 192 133Q193 149 176 152L168 151Q184 137 177 112Z','#fff9e9'), '<ellipse cx="179" cy="124" rx="2.5" ry="4" fill="#665775"/>']
        out += ['</g>']

    return ''.join(out)


# Knee/hock and toe coordinates relative to each shoulder/hip. These are poses,
# not rigid rotations: knees fold during recovery while planted toes sweep back.
FRONT = [(10,25,25,56),(0,31,10,59),(-12,26,-16,58),(-18,14,-32,41),
         (-11,10,-19,25),(4,12,6,30),(16,15,28,38),(19,20,34,47)]
HIND = [(-5,26,-27,58),(10,18,-12,37),(23,14,12,26),(23,24,32,40),
        (16,30,22,55),(5,32,8,60),(-8,30,-12,58),(-15,29,-31,51)]
TROT = [(6,24,22,57),(0,29,11,59),(-6,30,-5,59),(-11,26,-21,54),
        (-12,18,-22,40),(-4,12,-4,29),(9,16,17,37),(14,22,25,49)]


def walk(kind, direction, frame):
    feline, girl = kind == 'dogegg', kind == 'boniu'
    # West views are mirrors of corresponding east views; front/back use their
    # own occlusion order and depth projection instead of rotating a side sprite.
    mirror = 'w' in direction
    view = direction.replace('w','e')
    side = 1 if view == 'e' else .67 if 'e' in view else 0
    depth = -1 if 'n' in view else 1 if 's' in view else 0
    phase = 2*pi*frame/8
    fur, ink = ('#29282e','#383442') if feline else ('#fff6df',INK)
    far = '#414049' if feline else '#e5dacc'
    mane = '#bca7e5' if girl else '#aa9bd1'
    bob = [0,3,1,-4,-6,-3,0,2][frame] if feline else [0,2,0,-2,0,2,0,-2][frame]
    flex = [0,-2,-7,-8,-3,2,4,2][frame] if feline else 0
    hx, sx = 125-39*side, 125+33*side
    hy, sy = 157-depth*12+bob, 151+depth*12+bob
    out=['<g stroke-linecap="round" stroke-linejoin="round">',
         '<ellipse cx="128" cy="220" rx="67" ry="5" fill="#756583" opacity=".13"/>']
    if mirror: out.append('<g transform="translate(256 0) scale(-1 1)">')
    # Project longitudinal stride + lateral separation onto each view. Both near
    # and far limbs remain present, with darker far legs and white cat socks.
    def leg(front, near):
        offset = (0 if near else 1) if feline else (0 if front == near else 4)
        pose = ((FRONT if front else HIND) if feline else TROT)[(frame+offset)%8]
        kx,ky,tx,ty=pose
        spread = (1 if near else -1)*(13 if side == 0 else 7)
        ax=(sx if front else hx)+spread*(1-side)
        ay=(sy if front else hy)+(3 if near else -6)
        ky += (ty-50)*abs(depth)*.08
        knee=(ax+kx*side, ay+ky*.78)
        toe=(ax+tx*side+spread*.25, ay+ty*.86+tx*depth*.15)
        color=fur if near else far
        d=f'M{ax} {ay-3}Q{ax+kx*side*.5} {ay+11} {knee[0]} {knee[1]}L{toe[0]} {toe[1]-4}'
        result=path(d,'none',ink,15 if feline else 16)+path(d,'none',color,10 if feline else 11)
        # A toe is flat at contact, rounded and flexed during recovery.
        x,y=toe
        result+=path(f'M{x-5} {y-7}Q{x} {y-9} {x+5} {y-6}L{x+9} {y-2}Q{x+10} {y+3} {x+3} {y+3}L{x-7} {y+3}Q{x-10} {y} {x-5} {y-7}Z', '#fffdf1' if feline else mane,ink,2)
        if feline:result+=path(f'M{x+1} {y+2}v-3M{x+5} {y+1}v-2','none',ink,1)
        return result
    def tail():
        wave=sin(phase-.8)*8
        x,y=hx-8*side,hy-6
        if feline:
            d=f'M{x} {y}Q{x-30*side-13} {y-15+wave} {x-48*side-8} {y-38+wave}Q{x-58*side-5} {y-50+wave} {x-56*side+5} {y-57+wave}'
            return path(d,'none',ink,12)+path(d,'none',fur,8)
        d=f'M{x} {y-4}Q{x-22*side-10} {y-17+wave} {x-29*side-15} {y+1+wave}Q{x-36*side-8} {y+18+wave} {x-47*side-8} {y+10+wave}Q{x-35*side} {y+40+wave} {x-13*side} {y+20}Q{x-4} {y+11} {x} {y+3}Z'
        return path(d,mane)+path(f'M{x-10*side-5} {y+3}Q{x-22*side-8} {y+23} {x-32*side-7} {y+18+wave}','none','#dfd2ee',2)
    out += [tail(),leg(False,False),leg(True,False)]
    if side:
        # Pelvis to shoulder forms a continuous four-legged silhouette. Flex
        # changes the spine and belly, not the whole image's width/height.
        out += [path(f'M{hx-18} {hy-16}C{hx+4} {hy-33+flex} {sx-20} {sy-30+flex} {sx+5} {sy-24}Q{sx+25} {sy-18} {sx+20} {sy+5}Q{sx+8} {sy+26} {sx-17} {sy+22}Q{hx+9} {hy+29+flex*.4} {hx-18} {hy+15}Q{hx-32} {hy} {hx-18} {hy-16}Z',fur,ink)]
    else:
        out += [path(f'M99 {hy-19}Q125 {hy-38} 151 {hy-19}Q165 {sy+3} 148 {sy+23}Q125 {sy+36} 103 {sy+23}Q87 {sy+3} 99 {hy-19}Z',fur,ink)]
    if not feline:
        out += [path(f'M{sx-12} {sy+1}Q{sx-17} {sy-27} {sx-4} {sy-47}L{sx+22} {sy-42}Q{sx+18} {sy-18} {sx+19} {sy+4}Z',fur,ink)]
    elif depth >= 0:
        out += [path(f'M{sx-9} {sy-17}Q{sx+13} {sy-23} {sx+21} {sy-5}L{sx+12} {sy+20}L{sx+3} {sy+11}L{sx-4} {sy+20}Z','#fffdf1','none')]
    out += [leg(False,True),leg(True,True)]
    # Reuse the actual approved face/mane in a smaller quadruped proportion.
    scale=.62 if feline else .64
    cx=128+side*49
    cy=(111 if feline else 103)+bob+(3 if depth>0 else -3 if depth<0 else 0)
    out += [f'<g transform="translate({cx-128*scale} {cy-105*scale}) scale({scale})">{head(kind,view,frame)}</g>']
    if not feline and depth>=0:
        out += [path(f'M{cx-16} {cy+32}Q{cx} {cy+40} {cx+16} {cy+31}L{cx+14} {cy+37}Q{cx} {cy+46} {cx-16} {cy+39}Z','#d69bb3' if girl else '#91c5bf','#9c697f' if girl else '#537d84',1.5)]
    if depth<0 and not side: out.append(tail())
    if mirror:out.append('</g>')
    return ''.join(out)+'</g>'


def peek(kind, frame):
    phase=2*pi*frame/8
    if kind == 'dogegg':
        # White mitten and pink pads from Dogegg's wave pose, disappearing into the edge.
        return '<g stroke-linejoin="round">'+path('M93 268L87 151Q87 122 126 120Q163 120 164 152L170 268Z','#29282e','#383442',5)+f'<g transform="rotate({sin(phase)*5} 128 188)">'+path('M65 121C59 80 76 43 104 48Q117 25 136 47Q161 32 177 60Q200 71 193 111L189 147Q176 183 128 185Q79 181 69 151Z','#fffdf1','#383442',5)+path('M105 137Q87 119 110 104Q126 77 146 105Q172 120 152 139Q141 155 127 147Q115 155 105 137Z','#ffadb8','none')+''.join(f'<ellipse cx="{x}" cy="{y}" rx="10" ry="14" fill="#ffadb8"/>' for x,y in [(88,88),(115,68),(145,69),(171,91)])+'</g></g>'
    mane = '#bca7e5' if kind == 'boniu' else '#aa9bd1'
    swing=sin(phase)*13
    return '<g stroke-linecap="round" stroke-linejoin="round">'+path(f'M111 268Q77 215 {92+swing} 155Q{112+swing} 115 107 95Q102 73 83 66Q130 44 153 77Q184 115 145 167Q128 195 151 268Z',mane,INK,5)+path(f'M125 249Q104 206 {120+swing/2} 169Q{151+swing/2} 119 133 87','none','#e0d4f1',4)+'</g>'


def generate(root):
    for kind in ['dogegg','boniu','bolo']:
        folder=root/kind
        groups=[]
        pack=json.loads((folder/'character.json').read_text())
        for row, direction in enumerate(DIRECTIONS+['peek']):
            name='peek' if direction=='peek' else 'walk-'+direction
            for frame in range(8):
                body=peek(kind,frame) if direction=='peek' else walk(kind,direction,frame)
                (folder/'frames'/f'{name}-{frame:02}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">{body}</svg>')
                groups.append(f'<g transform="translate({frame*256} {row*256})">{body}</g>')
            pack['reactions'][name]={'frames':[{'asset':'mobility','rect':[i*256,row*256,256,256],'duration':80 if kind=='dogegg' and direction!='peek' else 100 if direction!='peek' else 240} for i in range(8)],'loop':True,'poster':0}
        (folder/'mobility.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2304">{"".join(groups)}</svg>')
        pack['assets']['mobility']={'src':'./mobility.png','width':2048,'height':2304}
        pack['presentation']={'movement':{d:'walk-'+d for d in DIRECTIONS},'peek':'peek'}
        (folder/'character.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2)+'\n')
