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
  /** Teleport waits for authored disappearance/appearance clips; translate is backwards compatible. */
  mode?: 'translate' | 'teleport'
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
  let generation = 0, disposed = false, ownedPlay: number | undefined
  let stopClip: (() => void) | undefined
  const idle = () => {
    if (ownedPlay === controller.getSnapshot().playId) {
      ownedPlay = undefined
      const pack = controller.getSnapshot().character
      if (pack) controller.react(pack.defaultReaction)
    }
    ownedPlay = undefined
  }
  const cancel = () => {
    generation++
    if (scheduled !== undefined) clock.cancel(scheduled)
    scheduled = undefined
    stopClip?.(); stopClip = undefined
    if (settle) { const done = settle; settle = undefined; done(false) }
    idle()
  }
  // Playback completion, not a duplicated timer, defines the jump point. A newer
  // host reaction/character cancels the pending action and retains its ownership.
  const clip = (role: 'appear' | 'disappear', ticket: number): Promise<boolean> => {
    if (disposed || ticket !== generation) return Promise.resolve(false)
    const pack = controller.getSnapshot().character
    const name = pack?.presentation?.[role]
    if (!name || options.reducedMotion?.()) return Promise.resolve(true)
    const expected = controller.getSnapshot().playId + 1
    ownedPlay = expected
    return new Promise(resolve => {
      let done = false
      const finish = (ok: boolean) => {
        if (done) return
        done = true; offComplete(); offChange(); offError()
        stopClip = undefined
        if (!ok) { generation++; ownedPlay = undefined }
        resolve(ok)
      }
      const offComplete = controller.on('complete', event => { if (event.playId === expected) finish(true) })
      const offChange = controller.subscribe(snapshot => { if (snapshot.playId !== expected) finish(false) })
      const offError = controller.on('error', () => finish(false))
      stopClip = () => {
        // Preserve ownership so explicit cancellation can restore the idle pose.
        const own = ownedPlay; finish(false); ownedPlay = own
      }
      if (!controller.react(name, {loop:false, returnTo:null})) finish(false)
    })
  }
  const present = async (role: 'appear' | 'disappear') => {
    cancel()
    const ticket = generation
    if (!await clip(role, ticket) || ticket !== generation || disposed) return false
    if (role === 'appear') idle()
    return true
  }
  const teleport = async (end: Point, ticket: number) => {
    if (!await clip('disappear', ticket) || ticket !== generation || disposed) return false
    point = {...end}; options.onPosition({...point})
    if (ticket !== generation || disposed) return false
    if (!await clip('appear', ticket) || ticket !== generation || disposed) return false
    idle()
    return true
  }
  const moveTo = (destination: Point): Promise<boolean> => {
    if (!valid(destination)) throw new TypeError('Invalid destination')
    cancel()
    if (disposed) return Promise.resolve(false)
    const ticket = generation, start = { ...point }, end = { ...destination }
    const dx = end.x - start.x, dy = end.y - start.y
    if (!dx && !dy) return Promise.resolve(true)
    if (options.mode === 'teleport') return teleport(end, ticket)
    const duration = options.reducedMotion?.() ? 0 : Math.hypot(dx, dy) / (options.speed ?? 340) * 1000
    const reaction = controller.getSnapshot().character?.presentation?.movement?.[directionFromVector(dx, dy)]
    if (reaction && duration) { controller.react(reaction, {loop:true}); ownedPlay = controller.getSnapshot().playId }
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
    appear: () => present('appear'),
    disappear: () => present('disappear'),
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
