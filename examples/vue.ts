import { createApp, defineComponent, h, onUnmounted, ref } from 'vue'
import { createCompanion, type CharacterPack } from '@companion-kit/core'
import { Companion } from '@companion-kit/core/vue'

export function mountVue(container: HTMLElement, pack: CharacterPack) {
  const controller = createCompanion(pack)
  const app = createApp(defineComponent({
    setup() {
      const reaction = ref('idle')
      const off = controller.subscribe(snapshot => { reaction.value = snapshot.reaction ?? 'idle' })
      onUnmounted(off)
      return () => h('div', { class: 'framework-demo', 'data-adapter': 'vue' }, [
        h(Companion, { controller, size: 110, label: 'Vue 小伙伴' }),
        h('span', { class: 'framework-state' }, reaction.value),
        h('button', { onClick: () => { controller.react('notification'); controller.say('Hello from Vue.'); } }, 'Vue 发来新通知'),
      ])
    },
  }))
  app.mount(container)
  return { controller, unmount: () => app.unmount() }
}
