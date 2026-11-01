// Window tiers, read by our own layout rules. Width decides — compact under 600, medium to
// 840, expanded above it — and a window shorter than 480 is compact whatever its width: a
// phone on its side has room across but only a few lines down, so splitting it into columns
// gives each one nothing.
export const TIER_MEDIUM = 600
export const TIER_EXPANDED = 840
export const TIER_SHORT = 480

export function tierOf(width, height) {
  if (height < TIER_SHORT) return 'compact'
  if (width < TIER_MEDIUM) return 'compact'
  if (width < TIER_EXPANDED) return 'medium'
  return 'expanded'
}

// Calls back with the tier now and on every resize, and returns the cleanup.
export function watchTier(onChange) {
  const update = () => onChange(tierOf(window.innerWidth, window.innerHeight))
  update()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', update)
  return () => {
    window.removeEventListener('resize', update)
    window.removeEventListener('orientationchange', update)
  }
}
