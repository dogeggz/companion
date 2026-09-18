import { defineComponent, h, onMounted, shallowRef, watch, type PropType } from 'vue'
import type { CompanionController } from '../controller.js'
import { defineCompanion, type CompanionElement } from '../element.js'

/** Vue is a peer dependency of this entry only; no custom-element compiler setting required. */
export const Companion = defineComponent({
  name: 'AgentCompanion',
  props: {
    controller: { type: Object as PropType<CompanionController>, required: true },
    size: { type: Number, default: 144 },
    label: String,
  },
  setup(props) {
    const element = shallowRef<CompanionElement | null>(null)
    onMounted(() => {
      defineCompanion()
      if (element.value) element.value.controller = props.controller
    })
    watch(() => props.controller, value => { if (element.value) element.value.controller = value })
    return () => h('agent-companion', { ref: element, size: props.size, label: props.label })
  },
})
