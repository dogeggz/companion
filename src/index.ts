export { createCompanion, CompanionController } from './controller.js'
export { defineCharacter, loadCharacter, sampleReaction } from './character.js'
export { connectAgent } from './agent.js'
export type { AgentBindingOptions } from './agent.js'
export type * from './types.js'

export { createSSEAgent } from './sse.js'

export { createCompanionMotion, directionFromVector, directions } from './motion.js'
export type { Direction, Point, MotionOptions, InteractionTarget } from './motion.js'

export type { CompanionSource } from './sse.js'
