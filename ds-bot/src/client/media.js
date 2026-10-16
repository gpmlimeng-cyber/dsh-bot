// A picture a Bot writes as a local path shows up as nothing on its own: the shell's MarkdownText
// renders http(s) images by itself and asks its owner about every other one, through `pathImages` --
// and the native chat's answer is three lines long (dsh-client-ui-chat/lib/client.js:64,5307):
//
//   { resolve: value => localPathMediaUrl(document.baseURI, value) }
//   localPathMediaUrl = (base, value) => fileMediaUrl(base, path-without-?-and-#)
//   fileMediaUrl      = (base, path) => new URL(`api/file?path=${encodeURIComponent(path)}`, base).href
//
// with the guards inside fileMediaUrl: an http(s)/dsh-app base, an absolute workspace path, no UNC and
// no control characters -- otherwise nothing is returned and the picture keeps its own alt text.
//
// The guards are the whole of the range check, and that is not a guess: the endpoint itself does not
// discriminate (measured on this device -- a path under the team's deliverables folder outside the
// workspace answered 200 with the same bytes as the file). So they must not be dropped, and nothing
// here may be used to build a path out of anything but what the markdown author wrote. This
// is that shape, copied rather than invented, so a local path becomes the app's own file URL exactly as
// it does in a native message. There is no prefetch and no cache: the resolver is a pure function.
import { fileMediaUrl, isAbsoluteWorkspacePath, resolveWorkspacePath } from '@deepseek-ai/dsh-util-workspace-path'

/** One authored image destination, as the shell resolves it. The guards -- an http(s)/dsh-app base, an
 *  absolute workspace path, no UNC, no control characters -- live inside the shell's own `fileMediaUrl`,
 *  which this util package exports; copying them here would be a second place for them to drift, and the
 *  endpoint itself does not discriminate (measured: a path outside the workspace answered 200), so they
 *  are the whole of the range check. `undefined` leaves the picture as the alt text it already was. */
export function localPathMediaUrl(base, cwd, value) {
  if (typeof value !== 'string') return undefined
  let path
  try {
    path = decodeURIComponent(value.split(/[?#]/u)[0] ?? '')
  } catch {
    return undefined
  }
  try {
    // An absolute path is taken as it is; a relative one is joined onto the workspace. `cwd ?? undefined`
    // matters: the helper treats undefined/'' as "no workspace" and returns the path unchanged, but a
    // null cwd falls through to a string join and throws.
    const absolute = isAbsoluteWorkspacePath(path) ? path : resolveWorkspacePath(cwd ?? undefined, path)
    return fileMediaUrl(base, absolute)
  } catch {
    return undefined
  }
}

/** The `pathImages` vocabulary MarkdownText wants, for one workspace. Memoize it at the call site: the
 *  shell discards its streaming render cache when the object's identity changes. */
export const pathImagesFor = (cwd) => ({ resolve: (value) => localPathMediaUrl(document.baseURI, cwd, value) })
