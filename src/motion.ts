import type { CompanionController } from './controller.js'

export const directions = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const
export type Direction = typeof directions[number]
export interface Point { x: number; y: number }
export interface InteractionTarget {
  position: () => Point | null
  /** Only host-registered callbacks can activate a target. */
  activate?: () => void | Promise<void>
}
export interface MotionOptions {
  position: Point
  onPosition: (point: Point) => void
  speed?: number
  reducedMotion?: () => boolean
  clock?: { now: () => number; schedule: (callback: () => void) => unknown; cancel: (id: unknown) => void }
}
export function directionFromVector(x: number, y: number): Direction {
  return directions[(Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8]
}
function valid(point: Point) { return Number.isFinite(point.x) && Number.isFinite(point.y) }

/** Portable, cancellable movement. Coordinates and permitted interactions belong to the host. */
export function createCompanionMotion(controller: CompanionController, options: MotionOptions) {
  if (!valid(options.position) || (options.speed !== undefined && (!Number.isFinite(options.speed) || options.speed <= 0))) throw new TypeError('Invalid motion options')
  const clock = options.clock ?? { now: () => Date.now(), schedule: (fn: () => void) => setTimeout(fn, 16), cancel: (id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>) }
  const targets = new Map<string, InteractionTarget>()
  let point = { ...options.position }, scheduled: unknown, settle: ((completed: boolean) => void) | undefined
  let generation = 0, disposed = false
  const idle = () => { const pack = controller.getSnapshot().character; if (pack) controller.react(pack.defaultReaction) }
  const cancel = () => {
    generation++
    if (scheduled !== undefined) clock.cancel(scheduled)
    scheduled = undefined
    if (settle) { const done = settle; settle = undefined; idle(); done(false) }
  }
  const moveTo = (destination: Point): Promise<boolean> => {
    if (!valid(destination)) throw new TypeError('Invalid destination')
    cancel()
    if (disposed) return Promise.resolve(false)
    const ticket = generation, start = { ...point }, end = { ...destination }
    const dx = end.x - start.x, dy = end.y - start.y
    const duration = options.reducedMotion?.() ? 0 : Math.hypot(dx, dy) / (options.speed ?? 340) * 1000
    const reaction = controller.getSnapshot().character?.presentation?.movement?.[directionFromVector(dx, dy)]
    if (reaction && duration) controller.react(reaction, {loop:true})
    const begun = clock.now()
    return new Promise(resolve => {
      settle = resolve
      const tick = () => {
        if (ticket !== generation || disposed) return
        const fraction = duration ? Math.min(1, Math.max(0, (clock.now() - begun) / duration)) : 1
        point = {x:start.x+dx*fraction, y:start.y+dy*fraction}
        options.onPosition({...point})
        if (ticket !== generation || disposed) return
        if (fraction < 1) scheduled = clock.schedule(tick)
        else { scheduled = undefined; settle = undefined; idle(); resolve(true) }
      }
      tick()
    })
  }
  return {
    moveTo, cancel,
    getPosition: () => ({...point}),
    setPosition(next: Point) { if (!valid(next)) throw new TypeError('Invalid position'); cancel(); point = {...next} },
    registerTarget(name: string, target: InteractionTarget) {
      if (disposed || !name.trim()) throw new TypeError('Invalid target registration')
      targets.set(name, target)
      return () => { if (targets.get(name) === target) targets.delete(name) }
    },
    async visit(name: string, activate = false) {
      const target = targets.get(name), destination = target?.position()
      if (!target || !destination || disposed) return false
      const pending = moveTo(destination), ticket = generation
      if (!await pending || ticket !== generation || targets.get(name) !== target) return false
      if (activate) await target.activate?.()
      return ticket === generation && !disposed
    },
    dispose() { cancel(); disposed = true; targets.clear() },
  }
}
