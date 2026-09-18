import { createElement, useEffect, useRef, type CSSProperties } from 'react'
import type { CompanionController } from '../controller.js'
import { defineCompanion, type CompanionElement } from '../element.js'

export interface CompanionProps {
  controller: CompanionController
  size?: number
  label?: string
  className?: string
  style?: CSSProperties
}
/** React is a peer dependency of this entry only. The controller is owned by the host. */
export function Companion({ controller, size = 144, label, className, style }: CompanionProps) {
  const ref = useRef<CompanionElement>(null)
  useEffect(() => {
    defineCompanion()
    if (ref.current) ref.current.controller = controller
  }, [controller])
  return createElement('agent-companion', { ref, size, label, className, style })
}
