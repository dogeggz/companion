import { createElement, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createCompanion, type CharacterPack } from '@companion-kit/core'
import { Companion } from '@companion-kit/core/react'

export function mountReact(container: HTMLElement, pack: CharacterPack) {
  const controller = createCompanion(pack)
  function Example() {
    const [reaction, setReaction] = useState('idle')
    useEffect(() => controller.subscribe(snapshot => setReaction(snapshot.reaction ?? 'idle')), [])
    return createElement('div', { className: 'framework-demo', 'data-adapter': 'react' },
      createElement(Companion, { controller, size: 110, label: 'React 小伙伴' }),
      createElement('span', { className: 'framework-state' }, reaction),
      createElement('button', { onClick: () => { controller.react('success'); controller.say('Hello from React.'); } }, 'React 发来好消息'),
    )
  }
  const root = createRoot(container); root.render(createElement(Example))
  return { controller, unmount: () => root.unmount() }
}
