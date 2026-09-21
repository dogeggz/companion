"""Identity-preserving portal cels; artwork is reused verbatim, never morphed."""
import json
import math
import re


def generate(root):
    for kind in ['dogegg', 'boniu', 'bolo']:
        folder = root / kind
        original = (folder / 'frames/idle-00.svg').read_text()
        body = re.sub(r'^<svg[^>]*>|</svg>$', '', original.strip())
        color, light = {'dogegg': ('#83c9b2', '#fff0af'), 'boniu': ('#bd91d7', '#ffe1ee'), 'bolo': ('#88b7dd', '#d7f7ff')}[kind]
        cels = []
        for i in range(12):
            t = i / 11
            if i == 0:
                cel = body
            elif i == 11:
                cel = ''
            else:
                strength = math.sin(math.pi * t)
                opacity = (1-t)**1.6
                ring = f'<g fill="none" stroke="{color}" opacity="{strength:.3f}"><ellipse cx="128" cy="219" rx="{42+45*t:.2f}" ry="{8+8*t:.2f}" stroke-width="3"/><ellipse cx="128" cy="219" rx="{33+45*t:.2f}" ry="{5+8*t:.2f}" stroke-width="1.5"/></g>'
                particles = []
                for n in range(10):
                    angle = n*2.399 + t*0.45
                    radius = 44 + (n%3)*13 + t*22
                    x = 128 + math.cos(angle)*radius
                    y = 207 - (n/9)*155 - t*24
                    size = (2 + n%3)*strength
                    particles.append(f'<path d="M{x-size:.2f} {y:.2f}Q{x:.2f} {y:.2f} {x:.2f} {y-size*1.8:.2f}Q{x:.2f} {y:.2f} {x+size:.2f} {y:.2f}Q{x:.2f} {y:.2f} {x:.2f} {y+size*1.8:.2f}Q{x:.2f} {y:.2f} {x-size:.2f} {y:.2f}Z" fill="{light if n%2 else color}" stroke="{color}" stroke-width="0.7" opacity="{strength:.3f}"/>')
                # A quiet orbit breaks into individual lights; no facial/path deformation.
                orbit = f'<path d="M{69-12*t:.2f} {167-30*t:.2f}Q128 {191-30*t:.2f} {187+12*t:.2f} {159-30*t:.2f}" fill="none" stroke="{color}" stroke-width="2" stroke-linecap="round" stroke-dasharray="{12*(1-t)+1:.2f} 9" opacity="{strength*0.7:.3f}"/>'
                cel = ring + f'<g opacity="{opacity:.3f}">{body}</g>' + orbit + ''.join(particles)
            cels.append(cel)
        groups = []
        pack = json.loads((folder/'character.json').read_text())
        for row, (name, frames) in enumerate([('disappear', cels), ('appear', list(reversed(cels)))]):
            for i, cel in enumerate(frames):
                (folder/'frames'/f'{name}-{i:02}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">{cel}</svg>')
                groups.append(f'<g transform="translate({i*256} {row*256})">{cel}</g>')
            pack['reactions'][name] = {'frames': [{'asset':'teleport','rect':[i*256,row*256,256,256],'duration':45} for i in range(12)], 'loop':False, 'poster':11, 'returnTo':None if name=='disappear' else pack['defaultReaction']}
        pack['assets']['teleport'] = {'src':'./teleport.png', 'width':3072, 'height':512}
        pack.setdefault('presentation', {}).update({'appear':'appear','disappear':'disappear'})
        (folder/'teleport.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="3072" height="512">{"".join(groups)}</svg>')
        (folder/'character.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2)+'\n')
