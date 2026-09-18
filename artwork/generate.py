"""Generate both ponies and a deliberately different, loose-frame robot pack."""
from pathlib import Path
import json
from pony import cel, STATES
from robot import robot

ROOT = Path(__file__).resolve().parent.parent / 'characters'


def svg(body, size=256):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">{body}</svg>'


def write_pack(folder, pack):
    (folder / 'character.json').write_text(json.dumps(pack, ensure_ascii=False, indent=2) + '\n')


for character, name, girl in [('boniu', '波妞 Boniu', True), ('bolo', '波洛 Bolo', False)]:
    folder = ROOT / character
    frames = folder / 'frames'
    frames.mkdir(parents=True, exist_ok=True)
    groups, reactions = [], {}
    for row, state in enumerate(STATES + ['sleepy']):
        count = 8 if state == 'sleepy' else 12
        durations = ([1800] + [100]*10 + [900] if state == 'idle' else [180]+[100]*10+[500]) if count == 12 else [180, 120, 120, 300, 600, 300, 120, 300]
        for i in range(count):
            if state == 'sleepy':
                body = cel('idle', [0, 2, 4, 5, 6, 6, 5, 0][i], girl)
                if 2 <= i <= 6:
                    body += '<g fill="none" stroke="#aa9bd1" stroke-width="2.5" stroke-linecap="round">' + ''.join(f'<path d="M{189+j*13} {90-j*18}h8l-8 9h8" opacity="{1 if i > j+1 else .2}"/>' for j in range(2)) + '</g>'
            else:
                body = cel(state, i, girl)
            (frames / f'{state}-{i:02}.svg').write_text(svg(body))
            groups.append(f'<g transform="translate({i*256} {row*256})">{body}</g>')
        reactions[state] = {
            'frames': [{'asset': 'atlas', 'rect': [i*256, row*256, 256, 256], 'duration': durations[i]} for i in range(count)],
            'loop': state in ['idle', 'thinking'], 'poster': 0 if state == 'idle' else 4 if state == 'sleepy' else 5,
        }
    (folder / 'base.svg').write_text(svg(cel('idle', 0, girl)))
    (folder / 'atlas.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="3072" height="1792">{"".join(groups)}</svg>')
    write_pack(folder, {
        'schemaVersion': 1, 'id': character, 'name': name,
        'description': '戴粉色蝴蝶结、温柔好奇的小女马' if girl else '短翘鬃毛、薄荷领巾的小男马',
        'size': {'width': 256, 'height': 256},
        'assets': {'atlas': {'src': './atlas.png', 'width': 3072, 'height': 1792}, 'portrait': {'src': './base.png', 'width': 256, 'height': 256}},
        'base': {'asset': 'portrait'}, 'defaultReaction': 'idle', 'reactions': reactions,
    })


folder = ROOT / 'mimo'
frames = folder / 'frames'
frames.mkdir(parents=True, exist_ok=True)
assets, reactions = {}, {}
for state in STATES + ['dance']:
    count = 14 if state == 'dance' else 12
    for i in range(count):
        key = f'{state}-{i}'
        (frames / f'{key}.svg').write_text(robot(state, i, count))
        assets[key] = {'src': f'./frames/{key}.svg', 'width': 240, 'height': 240}
    reactions[state] = {'frames': [{'asset': f'{state}-{i}', 'duration': 1700 if state == 'idle' and i == 0 else 500 if i == count-1 else 100} for i in range(count)], 'loop': state in ['idle', 'thinking'], 'poster': 0 if state == 'idle' else 5}
(folder / 'base.svg').write_text(robot('idle', 0, 12))
write_pack(folder, {'schemaVersion': 1, 'id': 'mimo', 'name': '米莫 Mimo', 'description': '奶油白机壳、薄荷耳罩与发光表情的口袋机器人', 'size': {'width': 240, 'height': 240}, 'assets': assets, 'base': {'asset': 'idle-0'}, 'defaultReaction': 'idle', 'reactions': reactions})
print('Generated Boniu, Bolo and Mimo character packs.')
