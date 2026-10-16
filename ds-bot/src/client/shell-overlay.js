// The marker the shell's own overlay layer carries, and the reason our dialogs wear it too.
//
// The Android responsive plugin (@dsh-android/dsh-client-ui-responsive, mobile/form-marker.js,
// MobileFormMarker.syncModal) reads the whole document for `[role="dialog"][aria-modal="true"]`,
// keeps every one that is *not* inside `[data-shell-overlay]`, and flips `data-dsh-modal-open` on
// <html> when any of them is up. The plugin's own stylesheet then answers that flag with
//
//     html[data-dsh-modal-open] [data-dsh-frame] > [class*='sidebarCol'] { transform: none }
//
// because the shell's settings overlay is rendered inside that column and would otherwise be
// carried off canvas with it. So a dialog that declares itself aria-modal -- which ours now do,
// deliberately -- also drags the shell's off-canvas left column back on screen, and opening any
// popup slid a drawer in behind it (the regression the user hit on 10-16).
//
// Our dialogs are overlays, not a settings panel drawn inside that column: they belong to the same
// class as the shell's own overlay layer, which is what the plugin's exemption is for. Wearing the
// attribute is therefore the honest fix, and it keeps aria-modal true where it belongs (the shell's
// modal machinery reads it for Escape, the focus trap and the focus handed back on close).
//
// Nothing else in the shell reads this attribute (dsh-client-ui-layout renders it on its own
// overlay div; the plugin above is the only consumer), so it adds no styling of its own.
export const SHELL_OVERLAY = { 'data-shell-overlay': '' }
