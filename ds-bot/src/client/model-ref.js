// Which model a Bot runs on, and what to call it. This is the one leaf of the picker
// (model-menu.js) that other surfaces need -- the picker itself drags in the editor's own
// dependencies, and a list that only wants to print a model's name must not carry those.
//
// Nothing here reads a DOM or a locale: it is a rule over the roster, so it can be read by the
// pages that only name a model and checked without rendering anything.

// The catalog entry a model ref points at, when the roster carries one -- DSH owns that list and
// can change it at any time (roster.modelsKey).
export const servedOf = (roster, ref) => (roster.models ?? []).find(model => model.ref === ref)

// What a Bot runs on, for display: the chosen model, else the one it last ran on. The name is the
// catalog's own when it is served, and the ref's last segment when it is not; the provider is the
// provider's display name when it has one. `undefined` when the Bot has no model at all.
export function modelOf(bot, roster) {
  const ref = bot.model ?? bot.appliedModel
  if (!ref) return undefined
  const served = servedOf(roster, ref)
  const [provider, ...rest] = ref.split('/')
  return { ref, name: served?.name ?? rest.join('/'), provider: served?.providerName ?? provider, served: served !== undefined }
}
