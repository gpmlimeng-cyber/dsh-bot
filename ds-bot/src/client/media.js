// A picture a Bot writes as a local path shows up as nothing on its own: the shell's MarkdownText
// renders http(s) images by itself and asks its owner about every other one, through `pathImages` --
// and the native chat's answer is three lines long (dsh-client-ui-chat/lib/client.js:64,5307):
//
//   { resolve: value => localPathMediaUrl(document.baseURI, value) }
//   localPathMediaUrl = (base, value) => fileMediaUrl(base, path-without-?-and-#)
//   fileMediaUrl      = (base, path) => new URL(`api/file?path=${encodeURIComponent(path)}`, base).href
//
// with the guards inside fileMediaUrl: an http(s)/dsh-app base, an absolute workspace path, no UNC and
// no control characters -- otherwise nothing is returned and the picture keeps its own alt text. This
// is that shape, copied rather than invented, so a local path becomes the app's own file URL exactly as
// it does in a native message. There is no prefetch and no cache: the resolver is a pure function.
import { isAbsoluteWorkspacePath, resolveWorkspacePath } from '@deepseek-ai/dsh-util-workspace-path'

const baseIsServable = (base) => typeof base === 'string' && (/^https?:/u.test(base) || base.startsWith('dsh-app://app/'))

/** One authored image destination, as the shell resolves it. `undefined` leaves the alt text in place. */
export function localPathMediaUrl(base, cwd, value) {
  if (!baseIsServable(base) || typeof value !== 'string') return undefined
  let path
  try {
    path = decodeURIComponent(value.split(/[?#]/u)[0] ?? '')
  } catch {
    return undefined
  }
  const absolute = resolveWorkspacePath(cwd, path)
  if (!isAbsoluteWorkspacePath(absolute) || /^[/\\]{2}/u.test(absolute) || /[\u0000-\u001f\u007f]/u.test(absolute)) return undefined
  try {
    return new URL(`api/file?path=${encodeURIComponent(absolute)}`, base).href
  } catch {
    return undefined
  }
}

/** The `pathImages` vocabulary MarkdownText wants, for one workspace. Memoize it at the call site: the
 *  shell discards its streaming render cache when the object's identity changes. */
export const pathImagesFor = (cwd) => ({ resolve: (value) => localPathMediaUrl(document.baseURI, cwd, value) })
