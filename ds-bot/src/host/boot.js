// What tells one host start from the next, and how many events this host has published:
// a window that reconnects compares the two to tell "nothing missed" from "restart".
export const BOOT_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

let published = 0
export const publishedSeq = () => published
export const nextSeq = () => {
  published += 1
  return published
}
