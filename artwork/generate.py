"""Generate pony, robot and tuxedo-cat character packs and cat review assets."""
from pathlib import Path
import json
from pony import cel, STATES
from robot import robot
from cat import cat, STATES as CAT_STATES, SCALE, OFFSET_X, OFFSET_Y, DURATIONS

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
folder = ROOT / 'goudan'
(folder / 'frames').mkdir(parents=True, exist_ok=True)
groups, reactions = [], {}
for row, state in enumerate(CAT_STATES):
    durations = [1800] + [100]*10 + [900] if state == 'idle' else [180] + [100]*10 + [500]
    if state == 'sleepy':
        durations[5] = 1000
    durations = DURATIONS.get(state, durations)
    for i in range(12):
        body = cat(state, i)
        (folder / 'frames' / f'{state}-{i:02}.svg').write_text(svg(body))
        groups.append(f'<g transform="translate({i*256} {row*256})">{body}</g>')
    reactions[state] = {
        'frames': [{'asset': 'atlas', 'rect': [i*256, row*256, 256, 256], 'duration': durations[i]} for i in range(12)],
        'loop': state in ['idle', 'thinking'], 'poster': 0 if state == 'idle' else 5,
    }
(folder / 'base.svg').write_text(svg(cat()))
(folder / 'atlas.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="3072" height="1792">{"".join(groups)}</svg>')
write_pack(folder, {
    'schemaVersion': 1, 'id': 'goudan', 'name': '狗蛋',
    'description': '绿眼睛、粉鼻头、白手套，带点小帅气的黑白男猫',
    'size': {'width': 256, 'height': 256},
    'assets': {'atlas': {'src': './atlas.png', 'width': 3072, 'height': 1792}, 'portrait': {'src': './base.png', 'width': 256, 'height': 256}},
    'base': {'asset': 'portrait'}, 'defaultReaction': 'idle', 'reactions': reactions,
})
# Art review stays outside characters/ so it never enters the runtime bundle.
review = []
for row, state in enumerate(CAT_STATES):
    for col, (size, background) in enumerate([(64, '#faf9f5'), (96, '#faf9f5'), (144, '#faf9f5'), (64, '#242f2b'), (96, '#242f2b'), (144, '#242f2b')]):
        x, y = col*170, row*190
        review += [f'<rect x="{x}" y="{y}" width="170" height="190" fill="{background}"/>']
        color = '#45414f' if col < 3 else '#e1e8d9'
        review += [f'<text x="{x+10}" y="{y+20}" font-family="sans-serif" font-size="12" fill="{color}">{state} / {size}px</text>']
        review += [f'<g transform="translate({x+(170-size)/2} {y+35+(144-size)/2}) scale({size/256})">{cat(state, 0 if state == "idle" else 5)}</g>']
review_dir = ROOT.parent / 'artwork' / 'goudan'
review_dir.mkdir(parents=True, exist_ok=True)
(review_dir / 'review.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="1020" height="1330">{"".join(review)}</svg>')
motion_review = ['<rect width="1080" height="800" fill="#faf9f5"/>']
for row, state in enumerate(DURATIONS):
    for col, frame in enumerate([0, 2, 4, 6, 8, 11]):
        x, y = col*180, row*200
        elapsed = sum(DURATIONS[state][:frame])
        motion_review += [f'<text x="{x+10}" y="{y+20}" font-family="sans-serif" font-size="12" fill="#45414f">{state} / {elapsed}ms</text>']
        motion_review += [f'<g transform="translate({x+18} {y+35}) scale(.5625)">{cat(state, frame)}</g>']
(review_dir / 'motion-review.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="800">{"".join(motion_review)}</svg>')
# Rest/wave shown in the exact coordinate space of the selected design reference.
def reference_pose(state, frame):
    return f'<g transform="translate({-OFFSET_X/SCALE} {-OFFSET_Y/SCALE}) scale({1/SCALE})">{cat(state, frame)}</g>'
(review_dir / 'implemented-poses.svg').write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1254" height="1254">'
    '<rect width="1254" height="1254" fill="#fffdf3"/>'
    + reference_pose('idle', 0) + '<g transform="translate(639 0)">'
    + reference_pose('notification', 5) + '</g></svg>')
print('Generated Boniu, Bolo, Mimo and Goudan character packs.')
