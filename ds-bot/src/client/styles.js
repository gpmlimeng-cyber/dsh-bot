import { INKS } from './inks.js'
import { DEFAULT_MASK } from './characters.js'
import { MENTION_ORIGIN } from './text.js'
import { SPRING_SHAPE, SPRING_TAP, SPRING_STRETCH, SPRING_POP, spring } from './motion.js'

// The pill stretches for "Memory updated" on SPRING_STRETCH, and its icon pops on
// SPRING_POP; it closes on SPRING_SHAPE.

// The base styles split the way the surface groups do. SHELL_CSS carries the marks,
// the Bot sidebar, every overlay, and the shell chrome they reshape; markup shared
// with the overlays (the exchange dialog reuses bubbles, the Secrets page reuses
// question-card fields) stays here so a plain view keeps it styled.
// CONVERSATION_CSS re-skins the shell's own conversation DOM and styles what only
// the conversation renders.
export const SHELL_CSS = `
body{--bt-ink:#141414;--bt-ink-2:rgba(20,20,20,.6);--bt-ink-3:rgba(20,20,20,.36);--bt-bubble:#eeeeee;--bt-sidebar:#f7f7f7;--bt-main:#fcfcfc;--bt-line:rgba(20,20,20,.08);--bt-line-2:rgba(20,20,20,.15);--bt-line-weak:rgba(20,20,20,.1);--bt-hover:rgba(119,119,119,.09);--bt-active:rgba(119,119,119,.17);--bt-card:#ffffff;--bt-accent:#4d6bfe;--bt-green:#00c972;--bt-star:#ff9800;--bt-user:#070707;--bt-user-ink:#fcfcfc;--bt-tag-bg:rgba(20,20,20,.06);--bt-tag-ink:rgba(20,20,20,.56)}
body[data-ds-dark-theme]{--bt-ink:#f2f2f2;--bt-ink-2:rgba(242,242,242,.6);--bt-ink-3:rgba(242,242,242,.36);--bt-bubble:#262626;--bt-sidebar:#1b1b1b;--bt-main:#141414;--bt-line:rgba(255,255,255,.08);--bt-line-2:rgba(255,255,255,.15);--bt-line-weak:rgba(255,255,255,.1);--bt-hover:rgba(160,160,160,.12);--bt-active:rgba(160,160,160,.2);--bt-card:#1f1f1f;--bt-user:#f2f2f2;--bt-user-ink:#141414;--bt-tag-bg:rgba(255,255,255,.09);--bt-tag-ink:rgba(242,242,242,.62)}
${Object.entries(INKS).map(([name, [light]]) => `body{--bt-ink-${name}:${light}}`).join('')}
${Object.entries(INKS).map(([name, [, dark]]) => `body[data-ds-dark-theme]{--bt-ink-${name}:${dark}}`).join('')}
.bt-mark{display:inline-block;flex:none;position:relative;line-height:0}
.bt-mark svg{width:100%;height:100%;overflow:visible}
.bt-mark-img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;box-shadow:inset 0 0 0 1px var(--bt-line)}
.bt-mark .bt-b,.bt-mark .bt-eye,.bt-mark .bt-eyes,.bt-mark .bt-gaze{transform-box:fill-box}
.bt-mark .bt-b{transform-origin:50% 100%}
.bt-mark .bt-eye,.bt-mark .bt-eyes{transform-origin:center}
/* Motion levels (Settings → Bots → Animation) set body[data-bt-motion]: quiet moves a
   mark only for its state; normal, the default, adds petting, pokes and eyes that follow
   the pointer; lively adds blinks and fidgets at rest and a question riding on the head. */
body[data-bt-motion=lively] .bt-mark[data-live]:is([data-state=idle],[data-state=alert]) .bt-eye{animation:bt-blink-idle 5s linear infinite;animation-delay:var(--bt-delay,0s)}
body[data-bt-motion=lively] .bt-mark[data-live][data-state=idle]:is([data-fidget=hop],[data-fidget=sway],[data-fidget=stretch]) :is(.bt-b,.bt-mark-img){animation:var(--bt-fidget) 9s ease-in-out var(--bt-fidget-delay,0s) infinite}
body[data-bt-motion=lively] .bt-mark[data-live][data-state=idle][data-fidget=hop]{--bt-fidget:bt-fidget-hop}
body[data-bt-motion=lively] .bt-mark[data-live][data-state=idle][data-fidget=sway]{--bt-fidget:bt-fidget-sway}
body[data-bt-motion=lively] .bt-mark[data-live][data-state=idle][data-fidget=stretch]{--bt-fidget:bt-fidget-stretch}
body[data-bt-motion=lively] .bt-mark[data-live][data-state=idle][data-fidget=look] .bt-eyes{animation:bt-fidget-look 9s ease-in-out var(--bt-fidget-delay,0s) infinite}
@keyframes bt-fidget-hop{0%,8%,100%{transform:none}3%{transform:translateY(-10%) scale(.97,1.04)}5.5%{transform:translateY(0) scale(1.05,.95)}}
@keyframes bt-fidget-sway{0%,10%,100%{transform:none}2.5%{transform:rotate(-8deg)}5%{transform:rotate(7deg)}7.5%{transform:rotate(-3deg)}}
@keyframes bt-fidget-stretch{0%,9%,100%{transform:none}4%{transform:scale(.94,1.08)}7%{transform:scale(1.03,.97)}}
@keyframes bt-fidget-look{0%,22%,100%{transform:none}3%,9%{transform:translateX(-14%)}12%,19%{transform:translateX(14%)}}
body[data-bt-motion=lively] .bt-badge-alert{right:auto;bottom:auto;left:50%;top:calc(var(--bt-size,36px) * -.14);translate:-50% 0;animation:bt-q-ride 1.3s cubic-bezier(.3,.7,.4,1) infinite}
body[data-bt-motion=lively] :is(.bt-row,.bt-tile)>.bt-mark:hover .bt-badge-alert{animation:none}
@keyframes bt-q-ride{0%,55%,100%{transform:translateY(0)}20%{transform:translateY(calc(var(--bt-size,36px) * -.14))}40%{transform:translateY(0)}}
/* Petting: with the pointer on a sidebar avatar or just around it (a ring a fifth of its
   size wide), a resting mark leans into the pointer and keeps nuzzling it, its eyes
   closed in a happy arc, and springs back when the pointer leaves. */
:is(.bt-row,.bt-tile)>:is(.bt-mark,.bt-cluster)::before{content:'';position:absolute;inset:-20%;border-radius:50%}
.bt-mark[data-live] .bt-b,.bt-mark[data-live] .bt-mark-img{transition:rotate .5s cubic-bezier(.34,1.56,.64,1),translate .5s cubic-bezier(.34,1.56,.64,1),scale .3s ease-out}
.bt-mark[data-live] .bt-eye{transition:scale .14s ease-in}
.bt-mark[data-live] .bt-eye-happy{transition:opacity .12s ease-out}
body:not([data-bt-motion=quiet]) :is(.bt-row,.bt-tile)>:is(.bt-mark,.bt-cluster):hover .bt-mark[data-live]:is([data-state=idle],[data-state=alert]):not(.bt-mark-poke) :is(.bt-b,.bt-mark-img){rotate:8deg;translate:5% -1%;animation:bt-nuzzle .78s ease-in-out .32s infinite}
body:not([data-bt-motion=quiet]) :is(.bt-row,.bt-tile)>:is(.bt-mark,.bt-cluster):hover .bt-mark[data-live]:is([data-state=idle],[data-state=alert]) .bt-eye{scale:1 0;animation:none}
body:not([data-bt-motion=quiet]) :is(.bt-row,.bt-tile)>:is(.bt-mark,.bt-cluster):hover .bt-mark[data-live]:is([data-state=idle],[data-state=alert]) .bt-eye-happy{opacity:1;transition-delay:.1s}
@keyframes bt-nuzzle{50%{rotate:14deg;translate:8% -3%;scale:1.03 .97}}
.bt-mark[data-gaze] .bt-b{translate:calc(var(--bt-gx,0) * 5%) calc(var(--bt-gy,0) * 4%);transition:translate .18s ease-out}
.bt-mark[data-gaze] .bt-gaze{transform:translate(calc(var(--bt-gx,0) * 12%),calc(var(--bt-gy,0) * 11%));transition:transform .18s ease-out}
body[data-bt-motion=quiet] .bt-mark[data-gaze] .bt-b{translate:none}
body[data-bt-motion=quiet] .bt-mark[data-gaze] .bt-gaze{transform:none}
.bt-mark[data-state=thinking] .bt-b{animation:bt-ponder 2.2s ease-in-out infinite}
.bt-mark[data-state=thinking] .bt-eyes{animation:bt-squint 2.2s ease-in-out infinite}
.bt-mark[data-state=searching] .bt-b{animation:bt-seek 1s ease-in-out infinite}
.bt-mark[data-state=searching] .bt-eyes{animation:bt-scan 1.6s ease-in-out infinite}
.bt-mark[data-state=working] .bt-b{animation:bt-bob 1.6s ease-in-out infinite}
.bt-mark[data-state=working]:is([data-shape=star],[data-shape=hex],[data-shape=plus],[data-shape=gem],[data-shape=magnet],[data-shape=ring]) .bt-b{animation:bt-wiggle 1.4s ease-in-out infinite;transform-origin:50% 50%}
.bt-mark[data-state=working]:is([data-shape=gumdrop],[data-shape=peanut],[data-shape=cushion],[data-shape=squircle],[data-shape=moon],[data-shape=wave]) .bt-b{animation:bt-squash 1.2s ease-in-out infinite}
.bt-mark[data-state=working] .bt-eye{animation:bt-blink 2.4s ease-in-out infinite}
.bt-mark[data-state=sending] .bt-b{animation:bt-dash 1.1s cubic-bezier(.4,0,.2,1) infinite}
.bt-mark[data-state=orbit] .bt-b{animation:bt-sway 2.6s ease-in-out infinite;transform-origin:50% 50%}
.bt-mark[data-state=orbit] .bt-eyes{animation:bt-roll 2.6s linear infinite}
/* A question for you hops twice when it arrives and the badge keeps it in view after;
   a lively mark keeps hopping. */
.bt-mark[data-state=alert] .bt-b{animation:bt-hop 1.3s cubic-bezier(.3,.7,.4,1) 2}
.bt-mark[data-shape=image]:not([data-state=idle]) .bt-mark-img{animation:bt-bob 1.6s ease-in-out infinite}
.bt-mark[data-shape=image][data-state=alert] .bt-mark-img{animation:bt-hop 1.3s cubic-bezier(.3,.7,.4,1) 2}
body[data-bt-motion=lively] .bt-mark[data-state=alert] :is(.bt-b,.bt-mark-img){animation-iteration-count:infinite}
.bt-mark[data-state=done] .bt-b{animation:bt-done 1.8s linear 1}
.bt-mark[data-shape=image][data-state=done] .bt-mark-img{animation:bt-done 1.8s linear 1;transform-origin:50% 100%}
@keyframes bt-done{0%{transform:none;animation-timing-function:cubic-bezier(.4,0,.2,1)}13.3%{transform:scale(1.12,.88);animation-timing-function:cubic-bezier(.4,0,.2,1)}25.6%{transform:scale(.93,1.09);animation-timing-function:cubic-bezier(.4,0,.2,1)}37.8%{transform:scale(1.04,.97);animation-timing-function:cubic-bezier(.4,0,.2,1)}51.1%,100%{transform:none}}
.bt-mark-poke .bt-b{animation:bt-poke .8s cubic-bezier(.3,.7,.4,1) 1!important;transform-origin:50% 60%!important}
.bt-mark-poke .bt-mark-img{animation:bt-poke-img .6s ease-out 1!important}
.bt-mark[data-poke]{cursor:pointer}
body[data-bt-motion=quiet] .bt-mark-poke :is(.bt-b,.bt-mark-img){animation:none!important}
body[data-bt-motion=quiet] .bt-mark[data-poke]{cursor:default}
@keyframes bt-bob{0%,100%{transform:translateY(0) rotate(0)}30%{transform:translateY(-4%) rotate(-5deg)}65%{transform:translateY(0) rotate(4deg)}}
@keyframes bt-wiggle{0%,100%{transform:rotate(0) scale(1)}25%{transform:rotate(-12deg) scale(1.04)}75%{transform:rotate(12deg) scale(1.04)}}
@keyframes bt-squash{0%,100%{transform:scale(1,1)}30%{transform:scale(1.08,.9)}55%{transform:translateY(-4%) scale(.94,1.08)}80%{transform:scale(1.02,.98)}}
@keyframes bt-ponder{0%,100%{transform:translateY(0) rotate(4deg)}50%{transform:translateY(-3%) rotate(7deg)}}
@keyframes bt-squint{0%,100%{transform:translate(0,-4%) scaleY(.7)}50%{transform:translate(5%,-5%) scaleY(.78)}}
@keyframes bt-seek{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-5%) rotate(-1deg)}}
@keyframes bt-scan{0%,100%{transform:translateX(-12%)}50%{transform:translateX(12%)}}
@keyframes bt-dash{0%,100%{transform:translateX(0) rotate(0)}35%{transform:translateX(9%) rotate(7deg)}55%{transform:translateX(-2%) rotate(-3deg)}}
@keyframes bt-sway{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(10deg)}}
@keyframes bt-roll{0%,100%{transform:translate(12%,0)}25%{transform:translate(0,9%)}50%{transform:translate(-12%,0)}75%{transform:translate(0,-9%)}}
@keyframes bt-hop{0%,55%,100%{transform:translateY(0) scale(1,1)}20%{transform:translateY(-14%) scale(.96,1.05)}40%{transform:translateY(0) scale(1.06,.94)}}
@keyframes bt-poke{0%{transform:none}55%{transform:translateY(-16%) rotate(360deg)}78%{transform:translateY(0) scale(1.08,.92) rotate(360deg)}100%{transform:rotate(360deg)}}
@keyframes bt-poke-img{0%,100%{transform:scale(1)}40%{transform:scale(1.14) rotate(-6deg)}}
/* Idle clip: two .26s blinks (lid to 3%, then a 6% overshoot) at 1.48s and 3.46s. */
@keyframes bt-blink-idle{0%,29.6%,35%,69.2%,74.6%,100%{transform:scaleY(1)}32.2%,71.8%{transform:scaleY(.03)}33.8%,73.4%{transform:scaleY(1.06)}}
@keyframes bt-blink{0%,42%,50%,100%{transform:scaleY(1)}46%{transform:scaleY(.03)}48%{transform:scaleY(1.06)}}
@media (prefers-reduced-motion:reduce){.bt-mark *{animation:none!important;transition:none!important}}
.bt-badge{position:absolute;right:0;bottom:0;width:12px;height:12px;border-radius:50%;corner-shape:round;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1.5px var(--bt-sidebar)}
.bt-badge-admin{background:color-mix(in srgb,var(--bt-star) 82%,var(--bt-sidebar))}
.bt-badge-admin svg{width:7px;height:7px}
.bt-badge-main{right:calc(var(--bt-size,36px) * -.07);bottom:calc(var(--bt-size,36px) * -.07);width:clamp(14px,calc(var(--bt-size,36px) * .36),22px);height:clamp(14px,calc(var(--bt-size,36px) * .36),22px);border-radius:0;box-shadow:none}
.bt-badge-main svg{width:100%;height:100%;overflow:visible}
.bt-badge-main path{fill:var(--bt-star);stroke:var(--bt-sidebar);stroke-width:2.6;stroke-linejoin:round;paint-order:stroke}
.bt-badge-alert{background:color-mix(in srgb,var(--bt-accent) 78%,var(--bt-sidebar));color:var(--bt-accent-ink,#fff);font-size:8.5px;line-height:12px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
.bt-badge-working{background:color-mix(in srgb,var(--bt-green) 82%,var(--bt-sidebar));width:8px;height:8px;right:1px;bottom:1px}
.bt-cluster{position:relative;display:inline-block;flex:none;line-height:0}
.bt-cluster>*{position:absolute}
.bt-cluster-more,.bt-cluster-you{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:var(--bt-active);color:var(--bt-ink-3);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;font-weight:500;line-height:1;font-variant-numeric:tabular-nums}
.bt-cluster-you{background:color-mix(in srgb,var(--bt-ink) 12%,transparent)}
.bt-stack{display:inline-flex;align-items:center;flex:none;line-height:0}
.bt-stack>*+*{margin-left:calc(var(--bt-stack-size) * -.3)}
.bt-stack-more{font-size:11px;line-height:16px;color:var(--bt-ink-3);margin-left:3px!important}

.bt-side{display:flex;flex-direction:column;min-height:0;flex:1 1 auto;gap:2px;padding:0 12px 8px 0;color:var(--bt-ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
.bt-side-top{display:flex;justify-content:flex-end;align-items:center;gap:8px;padding:6px 5px 0 0}
.bt-brand{display:inline-flex;align-items:center;gap:6px;margin-right:auto;padding:4px 8px 4px 4px;border:0;border-radius:8px;background:none;cursor:pointer;font-family:inherit;font-size:15px;line-height:20px;font-weight:600;letter-spacing:-.01em;color:var(--bt-ink);white-space:nowrap}
.bt-brand-whale{display:inline-flex;color:var(--bt-accent)}
.bt-round{width:36px;height:36px;border-radius:50%;border:1px solid var(--bt-line);background:var(--bt-main);color:var(--bt-ink);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;transition:background-color .12s ease,transform .12s ease}
.bt-round:hover,html[data-bt-mobile] .bt-side.bt-rail .bt-side-top .bt-round:hover{background:var(--bt-hover)}
.bt-round:active{transform:scale(.94)}
.bt-list{display:flex;flex-direction:column;gap:3px;overflow-y:auto;min-height:0;flex:1 1 auto}
.bt-tile-wrap{position:relative;display:flex;flex-direction:column;align-items:center;padding:30px 0 40px}
.bt-tile{display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;max-width:104px;padding:6px 8px 4px;border-radius:12px;border:0;background:transparent;color:var(--bt-ink);cursor:pointer;font-family:inherit;transition:background-color .12s ease}
.bt-tile:hover{background:var(--bt-hover)}
.bt-tile[aria-current=page]{background:var(--bt-active)}
.bt-tile-name{font-size:13px;line-height:18px;font-weight:400;max-width:84px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* The role chip a group member wears (Admin) is a tag on a row, not on a tile. */
.bt-chip{font-size:11px;line-height:16px;padding:1px 4px;border-radius:4px;background:var(--bt-hover);border:1px solid var(--bt-line);color:var(--bt-ink-2);white-space:nowrap;max-width:84px;overflow:hidden;text-overflow:ellipsis}
.bt-row{display:flex;align-items:center;gap:8px;min-height:54px;padding:8px;border:0;border-radius:10px;background:transparent;color:var(--bt-ink);text-align:left;cursor:pointer;width:100%;box-sizing:border-box;font-family:inherit;transition:background-color .12s ease}
.bt-row:hover{background:var(--bt-hover)}
.bt-row[aria-current=page]{background:var(--bt-active)}
.bt-row-body{display:flex;flex-direction:column;min-width:0;flex:1 1 auto}
.bt-row-name{display:flex;align-items:center;gap:6px;min-width:0;font-size:14px;line-height:20px;font-weight:400}
.bt-row-title{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-tag{flex:none;max-width:96px;font-size:12px;line-height:16px;font-weight:400;padding:1px 6px;border-radius:4px;background:var(--bt-tag-bg);color:var(--bt-tag-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* The row's second line: the preview takes what the count leaves, so a long preview is
   cut short of the number instead of running under it. */
.bt-row-sub{display:flex;align-items:center;gap:8px;min-width:0}
.bt-row-preview{flex:1 1 auto;min-width:0;font-size:13px;line-height:18px;color:var(--bt-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-row-meta{display:flex;align-items:center;gap:6px;flex:none;margin-left:auto;padding-left:6px;font-size:12px;line-height:16px;color:var(--bt-ink-3)}
.bt-row-time{flex:none}
.bt-row-count{flex:none;margin-left:auto;padding:0 5px;border-radius:999px;background:var(--bt-tag-bg);color:var(--bt-tag-ink);font-variant-numeric:tabular-nums}
.bt-unread{width:8px;height:8px;border-radius:50%;background:#1084fe;flex:none;margin-right:2px;animation:bt-fade .13s cubic-bezier(.22,1,.36,1)}
.bt-unread-wait{background:var(--bt-star)}
.bt-rail{align-items:center;padding:0 0 8px}
.bt-rail .bt-tile-wrap{padding:0}
.bt-rail .bt-row{justify-content:center;padding:6px 0;min-height:44px}
/* Below the shell's own narrow line the rail becomes a modal drawer, opened by the
   floating hamburger and closed by a tap on the scrim. Both are portalled to <body>
   (see mobile.js), so no column of the shell can clip them, and the html flag is the
   same breakpoint the JS uses: stylesheet and React tree can never disagree. */
.bt-mobile-scrim{display:none}
html[data-bt-mobile] .bt-mobile-scrim{position:fixed;inset:var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px))) 0 0;z-index:78;border:0;padding:0;background:rgba(0,0,0,.4);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .2s ease,visibility .2s}
html[data-bt-mobile] .bt-mobile-scrim[data-open]{opacity:1;visibility:visible;pointer-events:auto}
/* The drawer is inset once, at its top edge: its top already starts below the status bar, so
   the content keeps only a visual 10px gap. Padding it with env(safe-area-inset-top) again
   stacked a second inset (46px on this device) on top: every row slid down one bar and the
   last one fell out of view. Height comes from top/bottom — never height:100vh, which would
   overshoot the screen by exactly the inset. The list already scrolls (styles.js:122,
   overflow-y:auto + min-height:0), so a long roster scrolls inside the drawer. */
html[data-bt-mobile] .bt-side.bt-rail{position:fixed;z-index:79;top:var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px)));bottom:0;left:0;width:var(--bt-drawer-w,min(86vw,320px));box-sizing:border-box;align-items:stretch;gap:0;padding:10px 12px max(12px,env(safe-area-inset-bottom));background:var(--bt-sidebar);border-right:.5px solid var(--bt-line-2);box-shadow:0 10px 30px -12px rgba(0,0,0,.35);transform:translateX(-105%);transition:transform ${SPRING_SHAPE.duration}ms ${SPRING_SHAPE.easing};overflow:hidden;touch-action:pan-y}
html[data-bt-mobile] .bt-side.bt-rail[data-mobile-open]{transform:none}
/* The menus a row or the account launcher opens are portalled to body, so they compete
   with the drawer instead of living inside it: at the shared 60 they painted behind the
   drawer's own panel, and a tap read as nothing happening. Lifted only while the drawer
   is open, and only one step above it, so every menu opened anywhere else keeps its seat. */
html[data-bt-mobile] body:has(.bt-side.bt-rail[data-mobile-open]) .bt-menu{z-index:80}
html[data-bt-mobile] .bt-side.bt-rail .bt-row{justify-content:flex-start;gap:11px;min-height:52px;padding:8px 10px;border-radius:12px}
/* pan-y on the drawer leaves the vertical drag to the list's own scrolling and keeps the
   horizontal one for the close gesture; contain stops a flick at the end of the list from
   chaining into whatever is behind the drawer. */
html[data-bt-mobile] .bt-side.bt-rail .bt-list{width:100%;overscroll-behavior:contain}
.bt-side-foot{display:flex;align-items:center;gap:8px;flex:none;padding-top:8px}
/* The drawer's bottom row: the account/settings launcher on the left, Connect plugins
   taking the rest, the order the shell's own footer area uses. The connect button is a
   full-width row under that area's rules; here it takes what the launcher leaves. */
.bt-side-foot .bt-connect-foot{width:auto;flex:1 1 auto;min-width:0}
.bt-connect{flex:1;height:36px;border-radius:999px;border:1px solid var(--bt-line);background:var(--bt-main);color:var(--bt-ink);font-family:inherit;font-size:14px;line-height:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background-color .12s ease}
.bt-connect:hover{background:var(--bt-hover)}
.bt-connect svg{flex:none;width:15px;height:15px}
.bt-connect-wrap{position:relative;display:flex;flex:1 1 auto;min-width:0}
.bt-connect-warn{flex:none;width:16px;height:16px;border-radius:50%;background:#E5484D;color:#fff;font-size:11px;line-height:16px;font-weight:700;display:inline-flex;align-items:center;justify-content:center}
.bt-connect-tip{position:fixed;box-sizing:border-box;width:max-content;max-width:260px;padding:8px 12px;border-radius:10px;background:var(--bt-main);border:.5px solid var(--bt-line-2);box-shadow:0 8px 24px -4px rgba(0,0,0,.14);color:var(--bt-ink);font-size:12px;line-height:17px;white-space:normal;text-align:center;z-index:70;transform-origin:bottom left;animation:bt-tip-in $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing}}
@keyframes bt-tip-in{from{opacity:0;transform:scale(.96);filter:blur(4px)}}
@media (prefers-reduced-motion:reduce){.bt-connect-tip{animation:none}}

.bt-head{position:relative;display:flex;justify-content:center;align-items:center;height:40px;flex:none;pointer-events:none}
/* One skin for every floating control in the chrome: the conversation pill and the phone
   bar's two controls read this single declaration, so a value changed here cannot drift
   between them; the panel's mobile back button and the drawer's search field are the same
   control again, so they read it too. Keep the skin properties here and only here — the
   selectors below must not repeat border, radius, fill or shadow, or the two would be free
   to disagree. */
.bt-pill,.bt-mobile-nav,.bt-mobile-acts,.bt-side-search,
html[data-bt-mobile] .bt-side.bt-rail .bt-side-top .bt-round,
html[data-bt-pc] .bt-side .bt-side-top .bt-round{background:var(--bt-main);border:.5px solid var(--bt-line-2);border-radius:999px;box-shadow:0 2px 8px -1px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)}
.bt-pill{pointer-events:auto;display:inline-flex;align-items:center;gap:8px;height:40px;padding:7.5px 13.5px 7.5px 7.5px;color:var(--bt-ink);font-family:inherit;font-size:14px;line-height:20px;cursor:pointer;max-width:70%;box-sizing:border-box;transition:background-color .12s ease,transform ${SPRING_TAP.duration}ms ${SPRING_TAP.easing}}
.bt-pill:hover{background:color-mix(in srgb,var(--bt-main),#777 9%)}
.bt-pill:active{transform:scale(.965)}
.bt-pill-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
.bt-pill-mem{flex:none;display:inline-flex;width:0;margin-left:-8px;overflow:hidden;transition:${spring(SPRING_SHAPE, 'width', 'margin-left')}}
.bt-pill[data-memory=updated] .bt-pill-mem{width:var(--bt-mem-w);margin-left:0;transition:${spring(SPRING_STRETCH, 'width', 'margin-left')}}
.bt-pill-mem-in{flex:none;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;color:var(--bt-ink-2);font-size:13px;font-weight:500;opacity:0;filter:blur(6px);transform:translateX(-8px);transition:opacity .14s ease,filter .18s ease,${spring(SPRING_SHAPE, 'transform')}}
.bt-pill-mem-in::before{content:"";flex:none;width:1px;height:14px;margin-right:4px;background:var(--bt-line-2)}
.bt-pill[data-memory=updated] .bt-pill-mem-in{opacity:1;filter:none;transform:none;transition-delay:70ms}
.bt-pill-mem-ico{flex:none;display:inline-flex;width:16px;height:16px;color:var(--bt-accent)}
.bt-pill-mem-ico svg{width:16px;height:16px}
.bt-pill[data-memory=updated] .bt-pill-mem-ico{animation:bt-mem-pop ${SPRING_POP.duration}ms ${SPRING_POP.easing} 90ms both}
@keyframes bt-mem-pop{from{transform:scale(.4) rotate(-14deg)}to{transform:none}}
.bt-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@media (prefers-reduced-motion:reduce){.bt-pill-mem,.bt-pill-mem-in{transition:none!important}.bt-pill-mem-in{filter:none;transform:none}.bt-pill[data-memory=updated] .bt-pill-mem-ico{animation:none}}
.bt-swap{color:var(--bt-ink-3);font-size:12px}
.bt-pill-go{flex:none;display:inline-flex;align-items:center;justify-content:flex-end;width:0;margin-left:-8px;overflow:hidden;opacity:0;filter:blur(6px);transform:translateX(-6px);color:var(--bt-ink-2);transition:width $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing},margin-left $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing},transform $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing},opacity .18s ease,filter .18s ease}
.bt-pill-go svg{flex:none;transition:transform $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing}}
.bt-pill:hover .bt-pill-go,.bt-pill:focus-visible .bt-pill-go,.bt-pill[aria-expanded=true] .bt-pill-go{width:18px;margin-left:0;opacity:1;filter:none;transform:none}
.bt-pill[aria-expanded=true] .bt-pill-go svg{transform:rotate(180deg)}
.bt-pill[data-memory=updated]:is(:hover,:focus-visible,[aria-expanded=true]) .bt-pill-go{width:0;margin-left:-8px;opacity:0;filter:blur(6px);transform:translateX(-6px)}
@media (prefers-reduced-motion:reduce){.bt-pill,.bt-pill-go,.bt-pill-go svg{transition:none!important}.bt-pill-go{filter:none}.bt-pill:active{transform:none}}

.bt-astack{display:flex;flex-direction:column;align-items:flex-start;gap:4px;margin:0}
.bt-bubble{max-width:var(--bt-bubble-max);background:var(--bt-bubble);color:var(--bt-ink);border-radius:18px;padding:7px 12px;font-size:var(--dsh-content-font-size,14px);line-height:calc(var(--dsh-content-font-size,14px) + 8px);box-sizing:border-box;overflow-wrap:anywhere}
.bt-msg:not(:first-child)>.bt-msg-line>.bt-bubble{border-start-start-radius:6px}
.bt-msg:not(:last-child)>.bt-msg-line>.bt-bubble{border-end-start-radius:6px}
.bt-bubble [class*="_markdown"]>*+*{margin-top:10px}
.bt-bubble [class*="_markdown"]{color:inherit!important;font-size:inherit!important;line-height:inherit!important}
.bt-bubble p{margin:0}
.bt-bubble p + p{margin-top:6px}
.bt-bubble ul,.bt-bubble ol{margin:4px 0;padding-left:20px}
.bt-bubble a[href^="${MENTION_ORIGIN}"]{text-decoration:none;font-weight:400;cursor:pointer;white-space:nowrap}
.bt-bubble a[href^="${MENTION_ORIGIN}"]::before{content:"";display:inline-block;width:16px;height:16px;margin-right:3px;vertical-align:-3px;background:currentColor;-webkit-mask:${DEFAULT_MASK} center/contain no-repeat;mask:${DEFAULT_MASK} center/contain no-repeat}
.bt-group-msg{display:flex;flex-direction:column;gap:4px;margin:16px 0 0}
.bt-group-msg:first-child{margin-top:0}
.bt-lead{flex:none;display:flex;margin-bottom:1px}
button.bt-lead{border:0;background:none;padding:0;cursor:pointer}
/* Rows without the avatar start where the bubble beside it starts: 22px avatar + 8px gap. */
.bt-astack[data-lead]>.bt-msg:not(:last-child)>.bt-msg-line,.bt-astack[data-lead] .bt-reacts{margin-left:30px}
.bt-group-name{font-size:12px;line-height:16px;font-weight:500;margin-left:42px}
/* Deliverable cards under a group reply: one card per presented file, in DSH's own
   shape — a 60px tile in a two-column grid that folds to one column once the card
   column is narrow, a 40px type tile, the name over its metadata, and one hit
   target covering the whole card. The fallback hint sits under the card, not in it,
   so the tile keeps its height and a phone can still read the whole sentence. */
.bt-dcards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-left:42px;container-type:inline-size}
.bt-dcard-wrap{min-width:0;display:flex;flex-direction:column;gap:6px}
.bt-dcard{position:relative;box-sizing:border-box;display:flex;align-items:center;gap:10px;height:60px;padding:8px 10px;border-radius:10px;background:var(--bt-card);box-shadow:inset 0 0 0 .5px var(--bt-line);color:var(--bt-ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;overflow:hidden;transition:background-color .12s ease}
.bt-dcard:hover{background:var(--bt-hover)}
.bt-dcard-hit{position:absolute;inset:0;z-index:1;width:100%;padding:0;border:0;border-radius:inherit;background:0 0;cursor:pointer}
.bt-dcard-hit:focus-visible{box-shadow:inset 0 0 0 2px var(--bt-accent);outline:none}
.bt-dcard-ico{position:relative;z-index:2;pointer-events:none;flex:none;box-sizing:border-box;width:40px;height:40px;display:grid;place-items:center;border-radius:10px;border:.5px solid var(--bt-line);background:var(--bt-card);color:var(--bt-accent);overflow:hidden}
.bt-dcard-copy{position:relative;z-index:2;pointer-events:none;flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:2px}
.bt-dcard-name{font-size:13px;line-height:20px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-dcard-desc{font-size:10px;line-height:16px;color:var(--bt-ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-dcard-hint{font-size:12px;line-height:16px;color:var(--bt-ink-3);word-break:break-all}
/* The exits sit in one row inside the card, and the sentence that explains a refusal
   is written by the card itself -- outside the tile -- since the tile clips at 60px. The
   preview page renders the same acts row at its foot. Three controls go in one row and
   never wrap: the tile is a fixed 60px, so a second row would be clipped, and the name
   column is the one that gives way instead. */
.bt-dcard-acts{position:relative;z-index:2;pointer-events:auto;flex:none;display:flex;flex-wrap:nowrap;align-items:center;gap:4px;justify-content:flex-end}
@container (width<=620px){.bt-dcards{grid-template-columns:minmax(0,1fr)}}
/* One icon, no words: the words live in aria-label and in the preview page's menu. 44x44
   is the touch target the card's own 60px tile can hold exactly (8px of padding above and
   below), and the same size the preview page's controls take. The drawing is what the eye
   judges, and these glyphs paint about 0.8 of their box, so the box is 24px: the eye lands
   at 19.8px, the arrow and the sheets at 17.4, next to the 20px icon the card's own 40px
   type tile draws. */
.bt-dcard-btn{display:inline-flex;align-items:center;justify-content:center;flex:none;width:44px;height:44px;padding:0;border:0;border-radius:10px;background:none;color:var(--bt-ink-2);cursor:pointer;transition:background-color .12s ease,color .12s ease}
.bt-dcard-btn:hover{background:var(--bt-active);color:var(--bt-ink)}
.bt-dcard-btn:disabled{opacity:.5;cursor:default}
.bt-dcard-btn svg{width:24px;height:24px}
.bt-x{border:0;background:none;color:var(--bt-ink-2);cursor:pointer;width:24px;height:24px;border-radius:6px;font-size:16px;line-height:24px;padding:0;transition:background-color .12s ease,color .12s ease,${spring(SPRING_TAP, 'scale')}}
.bt-x:hover{background:var(--bt-hover);color:var(--bt-ink)}

.bt-q{margin:0 auto 8px;width:100%;max-width:var(--dsh-chat-content-width,748px);display:flex;flex-direction:column;gap:12px;--bt-q-edge:color-mix(in srgb,var(--bt-ink) 10%,transparent);--bt-q-rule:color-mix(in srgb,var(--bt-ink) 8%,transparent);--bt-q-rule-2:color-mix(in srgb,var(--bt-ink) 5%,transparent);background:var(--bt-card);box-shadow:0 1px 3px rgba(20,20,20,.04),inset 0 0 0 1px var(--bt-q-edge);border-radius:16px;padding:14px 16px;box-sizing:border-box;color:var(--bt-ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;animation:bt-q-in $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing} backwards,bt-veil-in .2s ease-out backwards}
body[data-ds-dark-theme] .bt-q{--bt-q-edge:rgba(255,255,255,.16);--bt-q-rule:rgba(255,255,255,.12);--bt-q-rule-2:rgba(255,255,255,.08)}
@keyframes bt-q-in{from{transform:translateY(10px) scale(.97)}}
.bt-q-settled{animation:none}
.bt-q-head{display:flex;align-items:flex-start;gap:8px;min-width:0}
.bt-q-text{flex:1 1 0;min-width:0;display:flex;flex-direction:column}
.bt-q-title{margin:0;font-size:15px;line-height:22px;font-weight:600;overflow-wrap:anywhere}
.bt-q-detail{font-size:13px;line-height:18px;color:var(--bt-ink-2)}
.bt-q-x{flex:none;width:20px;height:20px;border:0;padding:0;border-radius:6px;background:none;color:var(--bt-ink-2);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background-color .12s ease,color .12s ease,${spring(SPRING_TAP, 'scale')}}
.bt-q-x svg{width:14px;height:14px}
.bt-q-x:hover{background:var(--bt-hover);color:var(--bt-ink)}
.bt-q-x:focus-visible,.bt-q-opt:focus-visible{outline:2px solid var(--bt-accent);outline-offset:-2px}
.bt-q-list{display:flex;flex-direction:column;gap:1px;min-width:0;box-sizing:border-box;margin:0 -8px}
.bt-q-opt{position:relative;display:flex;align-items:flex-start;gap:16px;width:100%;min-width:0;box-sizing:border-box;margin:0;border:0;border-radius:12px;background:transparent;padding:10px 8px;font:inherit;color:var(--bt-ink);text-align:start;cursor:pointer;transition:background-color .12s ease}
.bt-q:not(.bt-q-raised)>.bt-q-head:has(+.bt-q-list){padding-bottom:12px;border-bottom:1px solid var(--bt-q-rule)}
.bt-q:not(.bt-q-raised)>.bt-q-head+.bt-q-list{margin-top:-6px}
.bt-q-opt+.bt-q-opt::before{content:"";position:absolute;left:calc(var(--bt-key,24px) + 24px);right:8px;top:-1px;height:1px;background:var(--bt-q-rule-2);transition:opacity .12s ease;pointer-events:none}
button.bt-q-opt:hover::before,button.bt-q-opt:hover+.bt-q-opt::before,.bt-q-opt[aria-pressed=true]::before,.bt-q-opt[aria-pressed=true]+.bt-q-opt::before{opacity:0}
.bt-q-raised .bt-q-opt::before{display:none}
button.bt-q-opt:hover{background:var(--bt-hover)}
button.bt-q-opt:active{background:var(--bt-active)}
.bt-q-opt[aria-pressed=true]{background:var(--bt-active)}
.bt-q:not(.bt-q-raised) :is(button.bt-q-opt:hover,.bt-q-opt[aria-pressed=true]) .bt-key{background:var(--bt-card);color:var(--bt-ink)}
.bt-key{flex:none;box-sizing:border-box;width:var(--bt-key,24px);height:var(--bt-key,24px);border-radius:8px;background:var(--bt-hover);color:var(--bt-ink-2);font-size:12px;line-height:var(--bt-key,24px);font-weight:500;text-align:center;font-variant-numeric:tabular-nums;transition:background-color .12s ease,color .12s ease}
.bt-q-body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px;padding-top:2px}
/* With a description the key spans the two text lines less 2px above and below. */
.bt-q-opt:has(.bt-q-desc){--bt-key:34px}
.bt-q-opt:has(.bt-q-desc) .bt-key{margin-top:2px;border-radius:10px;font-size:13px}
.bt-q-opt:has(.bt-q-desc) .bt-q-body{padding-top:0}
.bt-q-label{font-size:14px;line-height:20px;font-weight:500;white-space:normal;overflow-wrap:anywhere}
.bt-q-desc{font-size:12px;line-height:17px;color:var(--bt-ink-2);overflow-wrap:anywhere}
.bt-q-check{flex:none;display:inline-flex;align-items:center;color:var(--bt-ink-2);animation:bt-check-pop ${SPRING_POP.duration}ms ${SPRING_POP.easing} backwards}
.bt-q-settled .bt-q-check{animation:none}
.bt-q-check svg{width:16px;height:16px}
.bt-q-settled .bt-key{opacity:.4}
.bt-q-settled .bt-q-label{color:color-mix(in srgb,var(--bt-ink) 45%,transparent)}
.bt-q-dismissed .bt-q-title{color:var(--bt-ink-2)}
.bt-q.bt-q-settled{gap:6px;padding:12px 16px}
.bt-q-settled .bt-q-title{font-size:14px;line-height:20px;font-weight:500}
.bt-q.bt-q-settled>.bt-q-head:has(+.bt-q-list){padding-bottom:0;border-bottom:0}
.bt-q.bt-q-settled>.bt-q-head+.bt-q-list{margin-top:0}
.bt-q-settled .bt-q-opt{padding:4px 8px}
.bt-q-badge{flex:none;height:20px;padding:0 7px;border-radius:999px;border:1px dotted var(--bt-line-2);color:var(--bt-ink-2);font-size:12px;line-height:18px;box-sizing:border-box}
.bt-q-custom{display:flex;align-items:flex-start;gap:8px;width:100%;min-width:0}
.bt-q-field{flex:1 1 0;min-width:0;display:flex;box-sizing:border-box;min-height:32px;padding:5px 11px;border-radius:8px;border:.5px solid var(--bt-line-2);background:none;cursor:text;transition:border-color .12s ease}
.bt-q-field:focus-within{border-color:color-mix(in srgb,var(--bt-ink) 30%,transparent)}
.bt-q-input{flex:1;width:100%;min-width:0;max-height:120px;margin:0;padding:0;border:0;outline:none;background:transparent;color:var(--bt-ink);font:inherit;font-size:14px;line-height:20px;resize:none;overflow-y:hidden;white-space:pre-wrap;overflow-wrap:anywhere}
.bt-q-input:not(:placeholder-shown){field-sizing:content}
.bt-q-input::placeholder{color:var(--bt-ink-3)}
.bt-q-submit,.bt-q-btn{flex:none;height:36px;padding:0 14px;border:0;border-radius:999px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;transition:opacity .12s ease,background-color .12s ease,${spring(SPRING_TAP, 'scale')}}
.bt-q-submit{background:var(--bt-accent);color:var(--bt-accent-ink,#fff);animation:bt-q-submit-in ${SPRING_TAP.duration}ms ${SPRING_TAP.easing} backwards,bt-veil-in .16s ease-out backwards}
@keyframes bt-q-submit-in{from{transform:translateX(8px) scale(.9)}}
.bt-q-submit:hover:not(:disabled){opacity:.86}
.bt-q-submit:disabled{opacity:.4;cursor:default}
.bt-q-btn{background:var(--bt-hover);color:var(--bt-ink)}
.bt-q-btn:hover{background:var(--bt-active)}
.bt-q-foot{display:flex;justify-content:flex-end;gap:8px}
.bt-q-raised{width:calc(var(--dsh-chat-content-width,748px) - 32px);max-width:calc(100% - 32px);gap:0;padding:0;box-shadow:0 2px 8px rgba(20,20,20,.035),inset 0 0 0 .5px color-mix(in srgb,var(--bt-ink) 5%,transparent)}
.bt-q-raised .bt-q-head{padding:14px 16px 4px 20px}
.bt-q-raised .bt-q-head:last-child{padding-bottom:16px}
.bt-q-raised .bt-q-list{gap:1px;margin:0;padding:8px}
.bt-q-raised .bt-q-opt{gap:4px;padding:7px;border-radius:16px;color:var(--bt-ink-2)}
.bt-q-raised button.bt-q-opt:hover{color:var(--bt-ink)}
.bt-q-raised .bt-q-opt[aria-pressed=true]{background:transparent;color:var(--bt-ink)}
.bt-q-raised .bt-q-opt[aria-pressed=true]:hover{background:var(--bt-hover)}
.bt-q-raised .bt-q-opt[aria-pressed=true] .bt-key,.bt-q-ownrow:focus-within .bt-key,.bt-q-ownrow[data-filled] .bt-key{background:var(--bt-user);color:var(--bt-user-ink)}
.bt-q-raised .bt-q-body{padding:2px 6px 0}
.bt-q-raised .bt-q-desc{color:color-mix(in srgb,var(--bt-ink) 61%,transparent)}
.bt-q-ownrow{cursor:text}
.bt-q-ownrow .bt-q-input{color:var(--bt-ink)}
.bt-q-raised .bt-q-foot{padding:0 8px 8px}
@media (prefers-reduced-motion:reduce){.bt-q{animation:bt-fade .12s ease-out backwards}.bt-q-settled{animation:none}.bt-q-submit{animation:none}}

.bt-newchat{flex:1;display:flex;flex-direction:column;min-width:0;position:relative;animation:bt-veil-in .18s ease-out}
.bt-to{display:flex;align-items:center;flex-wrap:wrap;gap:6px;min-height:48px;padding:6px 12px;border-bottom:1px solid var(--bt-line);font-size:14px;box-sizing:border-box}
.bt-to-label{color:var(--bt-ink-2)}
.bt-to input{flex:1;min-width:120px;border:0;outline:none;background:none;color:var(--bt-ink);font-size:14px;height:26px}
.bt-token{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 6px 0 4px;border-radius:999px;background:var(--bt-hover);font-size:13px;animation:bt-check-pop ${SPRING_POP.duration}ms ${SPRING_POP.easing}}
.bt-token button{border:0;background:none;color:var(--bt-ink-2);cursor:pointer;padding:0 2px}
.bt-admin-star{flex:none;display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;border-radius:50%;corner-shape:round;background:color-mix(in srgb,var(--bt-star) 82%,var(--bt-sidebar));vertical-align:-1px}
.bt-to-star{display:inline-flex;margin-right:-2px;animation:bt-check-pop ${SPRING_POP.duration}ms ${SPRING_POP.easing}}
.bt-to .bt-to-create{flex:none;height:28px;padding:0 12px;font-size:13px;animation:bt-q-submit-in ${SPRING_TAP.duration}ms ${SPRING_TAP.easing},bt-veil-in .16s ease-out}
.bt-drop{position:absolute;top:48px;left:32px;width:min(550px,calc(100% - 64px));display:flex;flex-direction:column;padding:6px;max-height:min(420px,60vh);overflow-y:auto;background:var(--bt-card);border:1px solid var(--bt-line-2);border-radius:12px;box-shadow:0 6px 20px -4px rgba(0,0,0,.12);box-sizing:border-box;z-index:1;transform-origin:24px 0;animation:bt-pop-drop ${SPRING_TAP.duration}ms ${SPRING_TAP.easing},bt-veil-in .14s ease-out}
.bt-option{display:flex;align-items:center;gap:10px;border:0;background:none;border-radius:8px;padding:7px 8px;min-height:36px;box-sizing:border-box;font-size:13px;line-height:18px;color:var(--bt-ink);cursor:pointer;text-align:left;width:100%}
.bt-option[aria-selected=true]{background:var(--bt-active)}
.bt-drop-list>.bt-option:not([aria-selected=true]):hover{background:var(--bt-hover)}
.bt-option-label{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bt-option-hint{font-size:11px;color:var(--bt-ink-2);flex:none;animation:bt-veil-in .16s ease-out}
.bt-option-icon{width:22px;height:22px;border-radius:50%;background:var(--bt-hover);color:var(--bt-ink-2);display:inline-flex;align-items:center;justify-content:center;flex:none}
.bt-hint{padding:14px;text-align:center;font-size:13px;color:var(--bt-ink-2)}
.bt-nc-spacer{flex:1}
.bt-nc-compose{padding:0 16px 14px;display:flex;justify-content:center}
.bt-nc-card{display:flex;align-items:flex-end;gap:6px;width:100%;max-width:var(--dsh-chat-content-width,748px);min-height:44px;padding:4px 6px;border-radius:22px;border:1px solid var(--bt-line-2);background:var(--bt-main);box-shadow:0 2px 8px -2px rgba(0,0,0,.06);box-sizing:border-box}
.bt-nc-plus{width:34px;height:34px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:var(--bt-ink-2);background:var(--bt-hover);flex:none}
.bt-nc-card textarea{flex:1;resize:none;border:0;outline:none;background:none;color:var(--bt-ink);font:inherit;font-size:14px;line-height:20px;padding:7px 4px;min-height:34px;max-height:140px;box-sizing:border-box}
.bt-nc-send{width:34px;height:34px;border-radius:50%;border:0;background:var(--bt-accent);color:var(--bt-accent-ink,#fff);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
.bt-nc-send:disabled{opacity:.3;cursor:default}
.bt-create{flex:1;display:flex;flex-direction:column;min-width:0}
.bt-create-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:48px;padding:6px 12px;border-bottom:1px solid var(--bt-line);box-sizing:border-box}
.bt-create-gap{width:28px}
.bt-create-title{font-size:14px;line-height:20px;font-weight:500}
.bt-create-body{flex:1;overflow-y:auto;padding:28px 16px 32px;display:flex;justify-content:center}
.bt-create-card{width:100%;max-width:400px;display:flex;flex-direction:column;gap:18px;animation:bt-q-in $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing} both,bt-veil-in .22s ease-out both}
.bt-create-preview{display:flex;flex-direction:column;align-items:center;gap:10px}
.bt-create-pop{display:inline-flex;animation:bt-create-pop ${SPRING_POP.duration}ms ${SPRING_POP.easing} both}
@keyframes bt-create-pop{from{transform:scale(.72);opacity:.4}}
.bt-create-name{font-size:17px;line-height:24px;font-weight:500;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-create-step{font-size:12px;line-height:16px;color:var(--bt-ink-2);margin-bottom:-10px}
.bt-create-looks{display:flex;flex-direction:column;gap:10px;padding:10px;border:1px solid var(--bt-line);border-radius:12px;background:var(--bt-card)}
.bt-create-lookbar{justify-content:center}
.bt-create-foot{display:flex;justify-content:flex-end;gap:8px;padding-top:4px}
.bt-create-go{height:36px;padding:0 20px}
@media (prefers-reduced-motion:reduce){.bt-create-card,.bt-create-pop{animation:none}}
.bt-send{height:40px;min-width:40px;border-radius:999px;border:0;background:var(--bt-accent);color:var(--bt-accent-ink,#fff);font-size:14px;padding:0 14px;cursor:pointer}
.bt-send:disabled{opacity:.35;cursor:default}
.bt-error{padding:0 14px 10px;color:#e02135;font-size:12px}

.bt-pane{position:fixed;top:var(--dsh-frame-chrome-top,0px);right:0;bottom:0;z-index:45;pointer-events:auto;background:var(--bt-main);color:var(--bt-ink);display:flex;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
.bt-dialog{flex:1;display:flex;flex-direction:column;min-width:0}
.bt-dialog .bt-head{height:62px}
.bt-dialog-log{flex:1;overflow-y:auto;padding:8px 16px 20px;width:100%;max-width:var(--dsh-chat-content-width,748px);margin:0 auto;box-sizing:border-box}
.bt-dialog-foot{display:flex;justify-content:center;padding:10px 10px 16px}
.bt-exchange{animation:bt-sheet-in $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing} both,bt-veil-in .24s ease-out both}
.bt-exchange[data-leaving]{animation:bt-sheet-out .22s cubic-bezier(.4,0,1,1) forwards;pointer-events:none}
@keyframes bt-sheet-in{from{transform:translateY(24px)}}
@keyframes bt-sheet-out{to{opacity:0;transform:translateY(16px);filter:blur(4px)}}
.bt-exchange .bt-dialog{position:relative}
.bt-exchange .bt-dialog-log{max-width:none;margin:0;padding:39px max(16px,calc((100% - 960px)/2)) 76px;scrollbar-width:thin}
.bt-exchange .bt-tools{display:none}
.bt-exchange .bt-dialog-foot{position:absolute;left:0;right:0;bottom:0;height:76px;box-sizing:border-box;align-items:flex-end;padding:0 0 28px;background:var(--bt-main);z-index:3;animation:bt-foot-in .3s cubic-bezier(.22,1,.36,1) .3s both}
.bt-exchange .bt-dialog-foot::before{content:"";position:absolute;left:0;right:0;bottom:100%;height:40px;background:linear-gradient(to top,var(--bt-main),transparent);pointer-events:none}
.bt-exchange[data-leaving] .bt-dialog-foot{animation:bt-foot-out .22s cubic-bezier(.4,0,1,1) forwards}
@keyframes bt-foot-in{from{opacity:0;transform:translateY(6px)}}
@keyframes bt-foot-out{to{opacity:0;transform:translateY(6px)}}
@media (prefers-reduced-motion:reduce){.bt-exchange,.bt-exchange .bt-dialog-foot{animation-duration:.01s}}
.bt-soft{height:36px;border-radius:999px;border:0;background:var(--bt-hover);color:var(--bt-ink);padding:0 16px;font-size:14px;cursor:pointer}
.bt-soft:hover{background:var(--bt-active)}
.bt-time{display:block;text-align:center;font-size:12px;line-height:16px;color:var(--bt-ink-2);padding:6px 0}

.bt-panel{position:fixed;top:var(--dsh-frame-chrome-top,0px);right:0;bottom:0;width:var(--bt-panel-w,320px);pointer-events:auto;z-index:40;background:var(--bt-main);border-left:.5px solid var(--bt-line-2);display:flex;flex-direction:column;color:var(--bt-ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;box-sizing:border-box;animation:bt-pane-in .3s cubic-bezier(.2,0,0,1);transition:width $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing}}
.bt-panel[data-leaving]{transform:translateX(100%);transition:transform .3s cubic-bezier(.2,0,0,1);pointer-events:none}
.bt-panel[data-instant]{transition:none}
@keyframes bt-pane-in{from{transform:translateX(100%)}}
[class*="_centerCol"]{transition:margin-right $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing}}
.bt-panel-grip{position:absolute;left:-5px;top:0;bottom:0;width:8px;cursor:col-resize;z-index:3;touch-action:none}
.bt-panel-grip:hover,.bt-panel[data-dragging] .bt-panel-grip{background:linear-gradient(to right,transparent 4px,var(--bt-line-2) 4px,var(--bt-line-2) 6px,transparent 6px)}
.bt-drag-shield{position:fixed;inset:0;z-index:45;cursor:col-resize}
.bt-panel-view{flex:1;min-height:0;display:flex;flex-direction:column}
.bt-drawer-top{display:flex;justify-content:flex-end;gap:8px;padding:12px 17px 6px 12px}
.bt-drawer-id{display:flex;flex-direction:column;align-items:center;padding:14px 16px 0}
.bt-drawer-id>.bt-mark,.bt-drawer-id>.bt-cluster{margin-bottom:16px}
.bt-drawer-name{font-size:17px;line-height:24px;font-weight:500;border:0;background:none;color:inherit;cursor:text;padding:0 6px;border-radius:6px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-drawer-name:hover{background:var(--bt-hover)}
.bt-drawer-name-input{font-size:17px;line-height:24px;text-align:center;border:.5px solid var(--bt-line-2);border-radius:6px;padding:0 6px;background:var(--bt-main);color:var(--bt-ink);outline:none;font-weight:500}
.bt-drawer-role{font-size:12px;line-height:16px;color:var(--bt-ink-3);margin-top:6px;text-align:center}
.bt-tabs{position:relative;display:flex;justify-content:center;gap:2px;margin:16px 16px 0}
.bt-tab{position:relative;z-index:1;border:0;background:none;border-radius:9999px;padding:4px 8px;font-size:13px;line-height:20px;color:var(--bt-ink-2);cursor:pointer;white-space:nowrap}
.bt-tab:hover{color:var(--bt-ink)}
.bt-tab[aria-selected=true]{background:var(--bt-hover);color:var(--bt-ink)}
.bt-tabs>.bt-thumb{top:0;bottom:0;border-radius:9999px;background:var(--bt-hover)}
.bt-tabs[data-glide] .bt-tab[aria-selected=true]{background:transparent}
.bt-drawer-body{flex:1;overflow-y:auto;padding:20px 16px 16px;font-size:13px;line-height:18px;display:flex;flex-direction:column;gap:16px}
.bt-empty{text-align:center;color:var(--bt-ink-3);font-size:13px;line-height:18px;padding:8px 12px}
.bt-section-title{font-size:12px;color:var(--bt-ink-2);margin-bottom:6px}
.bt-muted{color:var(--bt-ink-2)}
.bt-swatches{display:flex;flex-wrap:wrap;gap:6px}
.bt-swatch{width:22px;height:22px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0;box-shadow:inset 0 0 0 1px var(--bt-line-2)}
.bt-swatch[aria-pressed=true]{border-color:var(--bt-ink)}
.bt-textarea{width:100%;box-sizing:border-box;min-height:120px;border:1px solid var(--bt-line);border-radius:8px;padding:8px;background:var(--bt-card);color:var(--bt-ink);font:inherit;resize:vertical}
.bt-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.bt-kv{display:flex;justify-content:space-between;gap:8px;font-size:12px;line-height:20px;color:var(--bt-ink-2)}
.bt-kv span:last-child{color:var(--bt-ink);font-variant-numeric:tabular-nums}
/* The three conversation figures: one heading, then a row per figure whose value opens a
   detail popover. */
.bt-stat-block{display:flex;flex-direction:column;gap:2px}
.bt-stat-row{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:24px}
.bt-stat-label{font-size:12px;line-height:20px;color:var(--bt-ink-2)}
.bt-stat-value{display:flex;justify-content:flex-end;min-width:0}
.bt-stat-pill{font:inherit;font-size:12px;line-height:18px;color:var(--bt-ink);font-variant-numeric:tabular-nums;
  padding:1px 6px;border-radius:8px;border:1px solid transparent;background:transparent;cursor:pointer;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.bt-stat-pill:hover{background:var(--bt-hover)}
.bt-stat-pill[data-open]{background:var(--bt-active);border-color:var(--bt-line)}
.bt-stat-pop{z-index:80;min-width:200px;max-width:280px;padding:10px 12px;border-radius:12px;
  background:var(--bt-main);border:1px solid var(--bt-line-2);box-shadow:0 12px 32px -8px rgba(0,0,0,.2);
  color:var(--bt-ink);font-family:inherit;animation:bt-pop-in .14s ease-out}
.bt-stat-pop-title{font-size:11px;line-height:16px;color:var(--bt-ink-2);margin-bottom:6px}
.bt-stat-pop-row{display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:20px}
.bt-stat-pop-row span:last-child{font-variant-numeric:tabular-nums}
.bt-danger{color:#e02135}

/* Bot settings: fields, the avatar editor popover, and the details-pane sub-view. */
.bt-field{display:flex;flex-direction:column;gap:6px}
.bt-field-label{font-size:13px;line-height:18px;font-weight:500}
.bt-input{width:100%;box-sizing:border-box;height:36px;border:1px solid var(--bt-line);border-radius:8px;padding:0 10px;background:var(--bt-card);color:var(--bt-ink);font:inherit;font-size:13px;outline:none}
.bt-input:focus{border-color:var(--bt-line-2)}
.bt-input-area{height:auto;min-height:96px;padding:8px 10px;line-height:18px;resize:vertical}
.bt-note{font-size:12px;line-height:16px;color:var(--bt-ink-3)}
.bt-soft-sm{height:28px;padding:0 12px;font-size:12px}
.bt-set-avatar{display:flex;justify-content:center;padding:4px 0}
.bt-avatar-anchor{position:relative}
.bt-avatar-trigger{position:relative;width:64px;height:64px;border:0;border-radius:50%;background:none;cursor:pointer;padding:0}
.bt-avatar-pencil{position:absolute;right:-2px;bottom:-2px;width:22px;height:22px;border-radius:50%;background:var(--bt-main);border:1px solid var(--bt-line-2);color:var(--bt-ink-2);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.12)}
.bt-avedit{position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);width:300px;background:var(--bt-main);border:1px solid var(--bt-line);border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.18);padding:10px;z-index:70;display:flex;flex-direction:column;gap:10px;color:var(--bt-ink);transform-origin:top center;animation:bt-pop-drop ${SPRING_TAP.duration}ms ${SPRING_TAP.easing},bt-veil-in .16s ease-out}
.bt-bs .bt-avedit{transform-origin:32px 0}
.bt-avedit-top{display:flex;align-items:center;justify-content:space-between}
.bt-avedit-tabs{position:relative;display:flex;gap:2px;background:var(--bt-hover);border-radius:999px;padding:2px}
.bt-avedit-tab{position:relative;z-index:1;border:0;background:none;border-radius:999px;padding:3px 10px;font-size:12px;line-height:16px;color:var(--bt-ink-2);cursor:pointer}
.bt-avedit-tab[aria-selected=true]{background:var(--bt-main);color:var(--bt-ink)}
.bt-avedit-tabs>.bt-thumb{top:2px;bottom:2px;border-radius:999px;background:var(--bt-main);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.bt-avedit-tabs[data-glide] .bt-avedit-tab[aria-selected=true]{background:transparent}
.bt-avedit-reset{color:var(--bt-ink-3)}
.bt-avedit-reset:hover{color:var(--bt-ink)}
.bt-shapes{display:flex;flex-direction:column;gap:2px}
.bt-shape-row{display:grid;grid-template-columns:repeat(6,1fr);gap:2px}
.bt-shape{position:relative;aspect-ratio:1;border:0;border-radius:8px;background:none;color:var(--bt-ink);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.bt-shape:hover{background:var(--bt-hover)}
.bt-shape .bt-ring{position:absolute;left:50%;top:50%;width:36px;height:36px;translate:-50% -50%;overflow:visible;opacity:0;scale:.82;pointer-events:none;transition:opacity .14s ease,${spring(SPRING_POP, 'scale')}}
.bt-shape[aria-pressed=true] .bt-ring{opacity:1;scale:1}
.bt-colors{display:flex;justify-content:space-between}
.bt-color{width:22px;height:22px;border-radius:50%;border:2px solid transparent;padding:2px;background:none;cursor:pointer;box-sizing:border-box;transition:border-color .14s ease,${spring(SPRING_TAP, 'scale')}}
.bt-color[aria-pressed=true] span{animation:bt-check-pop ${SPRING_POP.duration}ms ${SPRING_POP.easing}}
.bt-color span{display:block;width:100%;height:100%;border-radius:50%}
.bt-color[aria-pressed=true]{border-color:var(--bt-ink)}
.bt-dropzone{border:1.5px dashed var(--bt-line-2);border-radius:10px;padding:18px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--bt-ink-2);font-size:12px;line-height:16px;text-align:center}
.bt-dropzone[data-over]{border-color:var(--bt-accent);color:var(--bt-ink)}
.bt-dropzone img{width:64px;height:64px;border-radius:50%;object-fit:cover}
.bt-set-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.bt-about{white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
.bt-about[data-open]{display:block;-webkit-line-clamp:unset}
.bt-more{border:0;background:none;color:var(--bt-ink-3);font-size:12px;line-height:16px;cursor:pointer;padding:2px 0}
.bt-more:hover{color:var(--bt-ink)}
.bt-subhead{display:flex;align-items:center;gap:4px;padding:10px 12px 4px}
.bt-subhead-title{flex:1;font-size:15px;line-height:24px;font-weight:600;padding-left:4px}
.bt-icon-btn{width:28px;height:28px;border-radius:50%;border:0;background:none;color:var(--bt-ink-2);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.bt-icon-btn:hover{background:var(--bt-hover);color:var(--bt-ink)}
.bt-set-body{gap:20px}
.bt-drawer-model{display:flex;flex-direction:column}
.bt-drawer-model .bt-note{margin-top:6px}
.bt-drawer-permission{display:flex;flex-direction:column}
.bt-seg button.bt-perm-danger,.bt-seg button.bt-perm-danger[aria-pressed=true]{color:#e02135}

/* Settings dialog: a 198px page list beside the page. */
.bt-settings-layer{position:fixed;inset:var(--dsh-frame-chrome-top,0px) 0 0;z-index:60;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
.bt-scrim{position:absolute;inset:0;background:rgba(0,0,0,.32);animation:bt-fade .22s ease-out}
body[data-ds-dark-theme] .bt-scrim{background:rgba(0,0,0,.5)}
.bt-settings{--bt-set-w:min(800px,calc(100vw - 48px));--bt-set-h:min(620px,calc(100vh - 2*max(32px,var(--dsh-frame-overlay-top,32px))));position:relative;width:var(--bt-set-w);height:var(--bt-set-h);background:var(--bt-main);border-radius:16px;border:.5px solid var(--bt-line-2);box-shadow:0 24px 80px rgba(0,0,0,.24);display:flex;overflow:hidden;color:var(--bt-ink);transition:${spring(SPRING_SHAPE, 'width', 'height')};animation:bt-dialog-rise $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing},bt-veil-in .2s ease-out}
.bt-settings[data-wide]{--bt-set-w:min(1100px,calc(100vw - 48px));--bt-set-h:min(780px,calc(100vh - 2*max(32px,var(--dsh-frame-overlay-top,32px))))}
:is(.bt-settings-layer,.bt-mem-layer)[data-leaving]{pointer-events:none}
:is(.bt-settings-layer,.bt-mem-layer)[data-leaving] .bt-scrim{opacity:0;transition:opacity .16s ease-in}
:is(.bt-settings-layer,.bt-mem-layer)[data-leaving]>[role=dialog]{animation:bt-dialog-sink .16s cubic-bezier(.4,0,1,1) forwards}
@keyframes bt-dialog-rise{from{transform:translateY(12px) scale(.96)}}
@keyframes bt-dialog-sink{to{opacity:0;transform:translateY(6px) scale(.975);filter:blur(3px)}}
@media (prefers-reduced-motion:reduce){.bt-settings{transition:none}.bt-settings,.bt-scrim,.bt-settings-page>*{animation:bt-fade .12s ease-out!important}}
.bt-settings-nav{position:relative;width:198px;flex:none;padding:16px 8px;border-right:.5px solid var(--bt-line);display:flex;flex-direction:column;gap:2px;background:var(--bt-sidebar);box-sizing:border-box}
.bt-settings-item{position:relative;z-index:1;display:flex;align-items:center;gap:8px;padding:6px 8px;border:0;border-radius:8px;background:none;color:var(--bt-ink-2);font:inherit;font-size:13px;line-height:20px;cursor:pointer;text-align:left;width:100%;box-sizing:border-box;transition:background-color .12s ease,color .12s ease}
.bt-settings-item:hover{color:var(--bt-ink);background:var(--bt-hover)}
.bt-settings-item[aria-current=page]{background:var(--bt-active);color:var(--bt-ink)}
.bt-settings-nav>.bt-thumb{left:8px;right:8px;border-radius:8px;background:var(--bt-active)}
.bt-settings-nav[data-glide] .bt-settings-item[aria-current=page]{background:transparent}
.bt-settings-shell{margin-top:auto}
/* The phone groups the page list into cards under headings; the wide dialog's 198px
   column is the same rows with these two shells flattened away, so one structure draws
   both and the rows can never drift apart. */
.bt-settings-group,.bt-settings-group-card{display:contents}
.bt-settings-group-head{display:none}
/* The phone's own title bar, drawn outside the two screens it spans. */
.bt-settings-top{display:none}
/* The row's arrow belongs to the phone's one-screen list; the wide dialog's 198px column
   has no room for it and its rows already read as a list. */
.bt-set-go{display:none}
/* Usage while another page is open: out of the flow at Usage's own width, so it keeps
   its layout, and not rendered. */
.bt-settings-usage[data-off]{position:absolute;top:0;left:198px;width:calc(min(1100px,calc(100vw - 48px)) - 198px);height:100%;box-sizing:border-box;content-visibility:hidden;pointer-events:none}
/* The page column takes the dialog's final size at once, so while the dialog resizes
   only its edge moves and the page does not lay out again every frame. */
.bt-settings-main{flex:none;display:flex;flex-direction:column;min-width:0;width:calc(var(--bt-set-w) - 198px);height:var(--bt-set-h)}
.bt-settings-head{display:flex;align-items:center;gap:6px;padding:16px 56px 4px 20px}
.bt-settings-head h2{margin:0;font-size:15px;line-height:24px;font-weight:600;animation:bt-veil-in .2s ease-out}
.bt-settings-head>.bt-icon-btn{animation:bt-back-in ${SPRING_TAP.duration}ms ${SPRING_TAP.easing},bt-veil-in .16s ease-out}
@keyframes bt-back-in{from{translate:6px 0;scale:.8}}
.bt-settings-scroll{flex:1;overflow-y:auto;padding:12px 20px 24px;display:flex;flex-direction:column;gap:20px;scrollbar-width:thin}
.bt-settings-page>:not(.bt-us){animation:bt-page-up $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing} backwards,bt-veil-in .22s ease-out backwards}
.bt-settings-page[data-move=in]>:not(.bt-us){animation-name:bt-page-in,bt-veil-in}
.bt-settings-page[data-move=out]>:not(.bt-us){animation-name:bt-page-out,bt-veil-in}
.bt-settings-page>:nth-child(2){animation-delay:30ms}
.bt-settings-page>:nth-child(3){animation-delay:60ms}
.bt-settings-page>:nth-child(4){animation-delay:90ms}
.bt-settings-page>:nth-child(n+5){animation-delay:120ms}
@keyframes bt-page-up{from{transform:translateY(10px)}}
@keyframes bt-page-in{from{transform:translateX(18px)}}
@keyframes bt-page-out{from{transform:translateX(-18px)}}
.bt-settings-close{position:absolute;top:12px;right:12px;width:32px;height:32px;border-radius:50%;border:0;background:var(--bt-hover);color:var(--bt-ink-2);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.bt-settings-close:hover{background:var(--bt-active);color:var(--bt-ink)}
.bt-settings-form{display:flex;flex-direction:column;gap:16px}
.bt-set-section h3{font-size:13px;line-height:18px;font-weight:600;margin:0 0 8px;padding:0 4px}
.bt-set-card{border:1px solid var(--bt-line);border-radius:12px;background:var(--bt-card);display:flex;flex-direction:column}
.bt-set-card>*+*{border-top:.5px solid var(--bt-line)}
.bt-set-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border:0;background:none;color:var(--bt-ink);font:inherit;font-size:13px;line-height:18px;text-align:left;width:100%;box-sizing:border-box;border-radius:0}
button.bt-set-row{cursor:pointer}
button.bt-set-row:hover{background:var(--bt-hover)}
.bt-set-card>.bt-set-row+.bt-set-row{border-top:.5px solid var(--bt-line)}
.bt-set-row:first-child{border-top-left-radius:12px;border-top-right-radius:12px}
.bt-set-row:last-child{border-bottom-left-radius:12px;border-bottom-right-radius:12px}
.bt-set-copy{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.bt-set-hint{font-size:12px;line-height:16px;color:color-mix(in srgb,var(--bt-ink-2) 50%,var(--bt-ink-3))}
.bt-set-control{flex:none;display:flex;align-items:center;gap:6px}
.bt-set-value{font-size:13px;color:var(--bt-ink-2);text-align:right}
.bt-set-bot{flex:1;display:flex;align-items:center;gap:8px;min-width:0}
.bt-set-paste{flex-direction:column;align-items:stretch;gap:8px}
.bt-chevron{color:var(--bt-ink-3);display:inline-flex;flex:none}

/* Settings → Connectors. */
.bt-connector{display:flex;flex-direction:column;gap:10px;padding:12px}
.bt-connector-head{display:flex;align-items:center;gap:12px;min-width:0}
.bt-connector-mark{flex:none;width:36px;height:36px;border-radius:10px;background:var(--bt-card);border:.5px solid var(--bt-line);display:flex;align-items:center;justify-content:center;color:var(--bt-ink)}
.bt-connector-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.bt-connector-name{font-size:14px;line-height:20px;font-weight:500}
.bt-connector-status{font-size:12px;line-height:16px;color:var(--bt-ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-connector[data-state=ready] .bt-connector-status{color:var(--bt-ink-2)}
.bt-connector[data-state=error] .bt-connector-status{color:#e02135;white-space:normal}
.bt-connector-actions{flex:none;display:flex;gap:6px}
.bt-connector-form{display:flex;flex-direction:column;gap:8px;padding-left:48px;animation:bt-q-in $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing},bt-veil-in .2s ease-out}
.bt-connector-form-row{display:flex;align-items:center;gap:6px}
.bt-connector-link{flex:1;font-size:12px;color:var(--bt-ink-2)}
.bt-connector-error{padding-left:48px;font-size:12px;line-height:16px;color:#e02135}

/* Shell chrome reshaped for the team view. Selectors use stable data attributes where the
   shell offers them and CSS-module name suffixes elsewhere. */
[class*="_logoRow"],[class*="_newSession"],nav[class*="_panelList"]{display:none!important}
[class*="_footArea"]{display:flex!important;flex-direction:row-reverse;align-items:center;gap:9px;padding:8px 6px 6px!important}
[class*="_footArea"]>[class*="_footerActions"]{flex:1 1 auto;min-width:0}
[class*="_footArea"]>[class*="_settingsArea"]{flex:none;width:auto!important}
[class*="_footArea"] button[aria-label="Settings"]{width:auto!important;padding:0!important;background:none!important;border-radius:50%!important;height:auto!important}
/* The shell's width handle stays: it sizes the conversation column from the user's
   drag and persists the choice, which this plugin reads through the column width. */

.bt-voice-pane{flex-direction:column;align-items:center;justify-content:center;animation:bt-fade .2s ease-out}
.bt-voice-stage{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;max-width:560px;text-align:center}
.bt-voice-orb{position:relative;width:200px;height:200px;display:grid;place-items:center;margin-bottom:8px}
.bt-voice-ring{position:absolute;inset:34px;border-radius:50%;background:var(--bt-hover);transform:scale(calc(1 + var(--bt-level,0) * .55));transition:transform .08s linear}
.bt-voice-ring-2{inset:14px;background:none;box-shadow:inset 0 0 0 1px var(--bt-line-2);transform:scale(calc(.94 + var(--bt-level,0) * .3));opacity:.8}
.bt-voice-stage[data-phase=thinking] .bt-voice-ring{animation:bt-voice-breathe 1.6s ease-in-out infinite}
.bt-voice-stage[data-phase=speaking] .bt-voice-ring{animation:bt-voice-speak .9s ease-in-out infinite}
@keyframes bt-voice-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
@keyframes bt-voice-speak{0%,100%{transform:scale(1.04)}30%{transform:scale(1.2)}60%{transform:scale(1.1)}}
.bt-voice-orb>.bt-mark{position:relative}
.bt-voice-name{font-size:16px;line-height:22px;font-weight:500}
.bt-voice-status{font-size:13px;line-height:18px;color:var(--bt-ink-2);min-height:18px}
.bt-voice-caption{min-height:44px;font-size:15px;line-height:22px;color:var(--bt-ink);animation:bt-blur-in .25s ease-out;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.bt-voice-note{font-size:12px;color:#e02135}
.bt-voice-setup{height:32px;padding:0 14px;border-radius:16px;border:0;background:var(--bt-hover);color:var(--bt-ink);font:inherit;font-size:13px;cursor:pointer;transition:background-color .15s ease}
.bt-voice-setup:hover{background:var(--bt-active)}
.bt-voice-bar{display:flex;gap:16px;padding:0 0 32px}
.bt-voice-btn{position:relative;width:52px;height:52px;border-radius:50%;border:0;background:var(--bt-hover);color:var(--bt-ink);display:grid;place-items:center;cursor:pointer;transition:background-color .15s ease,transform .12s ease}
.bt-voice-btn:hover{background:var(--bt-active)}
.bt-voice-btn:active{transform:scale(.94)}
.bt-voice-btn[aria-pressed=true]{background:var(--bt-user);color:var(--bt-user-ink)}
.bt-voice-slash{position:absolute;width:24px;height:2px;border-radius:1px;background:currentColor;transform:rotate(-45deg)}
.bt-voice-end{background:#ff3e51;color:#fff}
.bt-voice-end:hover{background:#e02135}
@keyframes bt-fade{from{opacity:0}to{opacity:1}}
@keyframes bt-blur-in{from{opacity:0;filter:blur(2px)}to{opacity:1;filter:blur(0)}}
@media (prefers-reduced-motion:reduce){.bt-voice-pane,.bt-voice-caption,.bt-voice-ring{animation:none!important}}
/* The same cap the user's own bubbles use (--bt-bubble-max), so both sides take the same
   share of a wide column. The hover toolbar is absolutely positioned beside the bubble,
   so nothing here reserves room for it. */
.bt-msg{display:flex;flex-direction:column;align-items:flex-start;max-width:var(--bt-bubble-max)}
/* The bubble's row: reactions hang below it, so the hover toolbar (and a group
   sender's avatar) line up with the bubble alone. */
.bt-msg-line{position:relative;display:flex;align-items:flex-end;gap:8px;max-width:100%}
.bt-msg-line>.bt-bubble{max-width:none;min-width:0}
/* The same cap as an unled row: the 22px avatar and its 8px gutter already indent the
   bubble through .bt-msg-line's margin, so the right edge lands in the same place. */
.bt-astack[data-lead]>.bt-msg{max-width:var(--bt-bubble-max)}
.bt-tools{position:absolute;top:50%;left:100%;margin-left:6px;transform:translateY(-50%);display:flex;gap:2px;opacity:0;visibility:hidden;transition:opacity .12s ease,visibility .12s}
.bt-tools::after{content:"";position:absolute;top:-8px;bottom:-8px;right:100%;width:128px;z-index:-1}
.bt-msg:hover>.bt-msg-line>.bt-tools,.bt-msg:focus-within>.bt-msg-line>.bt-tools,.bt-tools[data-open]{opacity:1;visibility:visible}
.bt-tool{width:24px;height:24px;border:0;padding:0;border-radius:6px;background:none;color:var(--bt-ink-2);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background-color .12s ease,color .12s ease}
.bt-tool:hover,.bt-tool[aria-expanded=true]{background:var(--bt-hover);color:var(--bt-ink)}
.bt-tool:active{background:var(--bt-active)}
.bt-tool:focus-visible{outline:2px solid var(--bt-accent);outline-offset:-2px}
.bt-react-strip{position:fixed;z-index:60;pointer-events:auto;display:flex;gap:2px;padding:4px;border-radius:999px;background:var(--bt-main);border:.5px solid var(--bt-line-2);box-shadow:0 10px 20px -3px rgba(0,0,0,.08),0 4px 6px -4px rgba(0,0,0,.06);transform:translate(-50%,-100%);transform-origin:bottom center;animation:bt-pop-lift ${SPRING_TAP.duration}ms ${SPRING_TAP.easing},bt-veil-in .14s ease-out}
.bt-react-strip button{width:32px;height:32px;border:0;border-radius:50%;background:none;font-size:18px;line-height:1;cursor:pointer;transition:background-color .12s ease,${spring(SPRING_POP, 'transform')};animation:bt-check-pop ${SPRING_POP.duration}ms ${SPRING_POP.easing} backwards}
.bt-react-strip button:nth-child(2){animation-delay:20ms}
.bt-react-strip button:nth-child(3){animation-delay:40ms}
.bt-react-strip button:nth-child(4){animation-delay:60ms}
.bt-react-strip button:nth-child(n+5){animation-delay:80ms}
.bt-react-strip button:hover{background:var(--bt-hover);transform:scale(1.15)}
.bt-react-strip button:active{transform:scale(.92)}
.bt-reacts{display:flex;gap:4px;margin-top:4px}
.bt-react{height:22px;min-width:30px;padding:0 6px;border-radius:999px;border:.5px solid var(--bt-line-2);background:var(--bt-main);font-size:13px;line-height:20px;cursor:pointer;animation:bt-react-pop ${SPRING_POP.duration}ms ${SPRING_POP.easing};transition:background-color .12s ease,${spring(SPRING_TAP, 'scale')}}
.bt-react:hover{background:var(--bt-hover)}
.bt-react:active{scale:.92}
@keyframes bt-react-pop{from{transform:scale(.6);opacity:0}}
.bt-bubble a[href^="${MENTION_ORIGIN}"] svg{display:none}
.bt-you{width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--bt-ink) 5%,var(--bt-sidebar));color:var(--bt-ink-2);box-shadow:inset 0 0 0 1px var(--bt-line);transition:background-color .12s ease}
button:hover .bt-you{background:color-mix(in srgb,var(--bt-ink) 9%,var(--bt-sidebar))}
.bt-you-wrap{display:inline-flex;padding:0}
.bt-connect-foot{width:100%;height:36px}

.bt-menu{position:fixed;pointer-events:auto;z-index:60;min-width:200px;padding:6px;border-radius:12px;background:var(--bt-main);border:.5px solid var(--bt-line-2);box-shadow:0 10px 20px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1),0 0 0 1px rgba(228,228,228,.04);display:flex;flex-direction:column;gap:2px;transform-origin:var(--bt-origin,top left);animation:bt-pop-drop ${SPRING_TAP.duration}ms ${SPRING_TAP.easing},bt-veil-in .14s ease-out;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;box-sizing:border-box}
.bt-menu button{display:flex;align-items:center;gap:4px;width:100%;min-height:30px;text-align:left;border:0;background:none;border-radius:6px;padding:6px 8px;font:inherit;font-size:13px;line-height:18px;color:var(--bt-ink);cursor:pointer;box-sizing:border-box}
.bt-menu button:hover{background:var(--bt-hover)}
.bt-menu button svg{flex:none;width:16px;height:16px;margin:0 1px}
.bt-menu .bt-danger{color:#c21d2e}
.bt-menu-sep{height:.5px;flex:none;background:var(--bt-line-2);margin:4px 8px}
.bt-menu-up{--bt-origin:bottom left;animation-name:bt-pop-lift,bt-veil-in}
.bt-menu[data-leaving]{pointer-events:none;animation:bt-pop-out .12s cubic-bezier(.4,0,1,1) forwards}
.bt-menu-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-menu-hint{flex:none;color:var(--bt-ink-3);font-size:12px;font-variant-numeric:tabular-nums}
.bt-palette-layer{position:fixed;inset:var(--dsh-frame-chrome-top,0px) 0 0;z-index:70;pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
.bt-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.46);animation:bt-fade .22s ease-out}
.bt-palette{position:absolute;top:50%;left:50%;width:min(560px,92vw);transform:translate(-50%,-50%);display:flex;flex-direction:column;border-radius:12px;background:var(--bt-main);border:1px solid var(--bt-line-2);box-shadow:0 24px 48px -12px rgba(0,0,0,.25);overflow:hidden;color:var(--bt-ink);animation:bt-palette-in $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing},bt-veil-in .2s ease-out}
.bt-palette-layer[data-leaving]{pointer-events:none}
.bt-palette-layer[data-leaving] .bt-backdrop{opacity:0;transition:opacity .16s ease-in}
.bt-palette-layer[data-leaving] .bt-palette{animation:bt-dialog-sink .16s cubic-bezier(.4,0,1,1) forwards}
@keyframes bt-palette-in{from{translate:0 -10px;scale:.96}}
.bt-palette-head{display:flex;align-items:center;gap:4px;padding:14px 10px 14px 14px;border-bottom:.5px solid var(--bt-line-2)}
.bt-palette-glyph{display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;color:var(--bt-ink-3);margin-right:4px}
.bt-palette-head input{flex:1;min-width:0;border:0;outline:none;background:none;color:var(--bt-ink);font:inherit;font-size:15px;line-height:22px;padding:0}
.bt-palette-head input::placeholder{color:var(--bt-ink-3)}
.bt-palette-clear{width:18px;height:18px;border:0;padding:0;border-radius:6px;background:none;color:var(--bt-ink-3);display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.bt-palette-clear:hover{color:var(--bt-ink)}
.bt-palette-clear svg{width:12px;height:12px}
.bt-palette-list{position:relative;height:402px;overflow-y:auto;padding:8px;display:flex;flex-direction:column;gap:2px;box-sizing:border-box}
.bt-palette-list>.bt-thumb,.bt-drop-list>.bt-thumb{left:0;right:0;border-radius:8px;background:var(--bt-active)}
.bt-palette-list>.bt-thumb{left:8px;right:8px}
:is(.bt-palette-list,.bt-drop-list)[data-glide] [aria-selected=true]{background:transparent}
:is(.bt-palette-row,.bt-palette-section,.bt-drop-list>.bt-option){position:relative;z-index:1}
.bt-palette-section{padding:8px 8px 4px;font-size:12px;line-height:16px;color:var(--bt-ink-3);flex:none}
.bt-palette-section:first-of-type{padding-top:0}
.bt-palette-row{flex:none;display:flex;align-items:center;gap:8px;height:49px;padding:6px 10px 6px 8px;border:0;border-radius:8px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;box-sizing:border-box;width:100%}
.bt-palette-row[aria-selected=true]{background:var(--bt-active)}
.bt-palette-lead{flex:none;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center}
.bt-palette-cmd{width:24px;height:24px;border-radius:50%;background:var(--bt-hover);display:inline-flex;align-items:center;justify-content:center;color:var(--bt-ink-2)}
.bt-palette-cmd svg{width:14px;height:14px}
.bt-palette-agent{width:24px;height:24px;border-radius:50%;background:var(--bt-hover);display:inline-flex;align-items:center;justify-content:center;color:var(--bt-ink)}
.bt-palette-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.bt-palette-title{font-size:14px;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-palette-sub{font-size:12px;line-height:16px;color:var(--bt-ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-palette-badge{flex:none;font-size:11px;line-height:16px;padding:0 6px;border-radius:4px;background:var(--bt-tag-bg);color:var(--bt-tag-ink)}
.bt-palette-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:0 16px;text-align:center;animation:bt-veil-in .22s ease-out}
.bt-palette-empty-icon{color:var(--bt-line-2)}
.bt-palette-empty-icon svg{width:32px;height:32px}
.bt-palette-empty-label{font-size:14px;font-weight:500;color:var(--bt-ink-2)}
.bt-palette-empty-hint{font-size:13px;line-height:16px;color:var(--bt-ink-3)}
@media (prefers-reduced-motion:reduce){.bt-palette{animation:bt-fade .1s ease-out}}
.bt-account-menu{width:224px}
.bt-account{flex:none;width:36px;height:36px;border:0;padding:0;background:none;border-radius:50%;cursor:pointer;display:inline-flex}
.bt-account:hover .bt-you,.bt-account[aria-expanded=true] .bt-you{background:color-mix(in srgb,var(--bt-ink) 9%,var(--bt-sidebar))}
/* Popover keyframes move translate and scale, which compose with a transform the popover
   already has. */
@keyframes bt-pop-drop{from{translate:0 -4px;scale:.96}}
@keyframes bt-pop-lift{from{translate:0 4px;scale:.96}}
@keyframes bt-pop-out{to{opacity:0;scale:.97;filter:blur(2px)}}
@keyframes bt-veil-in{from{opacity:0;filter:blur(6px)}}
@keyframes bt-check-pop{from{opacity:0;scale:.4}}
@media (prefers-reduced-motion:reduce){.bt-menu,.bt-avedit,.bt-react-strip{animation:bt-fade .1s ease-out}.bt-react-strip button,.bt-q-check,.bt-color[aria-pressed=true] span{animation:none}}
.bt-brand:hover{background:var(--bt-hover)}
.bt-drop-list{position:relative;display:flex;flex-direction:column;gap:2px}
.bt-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}
.bt-pick{display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 2px 6px;border-radius:10px;border:1px solid transparent;background:none;color:var(--bt-ink);cursor:pointer;font:inherit;font-size:11px;line-height:14px;min-width:0}
.bt-pick:hover{background:var(--bt-hover)}
.bt-pick[aria-pressed=true]{border-color:var(--bt-line-2);background:var(--bt-hover)}
.bt-pick>span:last-child:not(.bt-mark){max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-pick:hover .bt-mark[data-state=idle] .bt-eye{animation:bt-blink .5s linear 1}
.bt-select{width:100%;height:34px;box-sizing:border-box;border-radius:8px;border:1px solid var(--bt-line);background:var(--bt-card);color:var(--bt-ink);padding:0 8px;font:inherit;font-size:13px}
.bt-note{font-size:12px;line-height:16px;color:var(--bt-ink-2);margin-top:6px}
.bt-swatch-sep{width:1px;height:22px;background:var(--bt-line-2);margin:0 2px}
.bt-swatch-custom{position:relative;overflow:hidden;background:conic-gradient(#ff3e51,#ffaf38,#00c972,#1cc3b0,#2a92fe,#a97efe,#ff5eb1,#ff3e51);box-sizing:border-box}
.bt-swatch-custom[data-on=true]{border-color:var(--bt-ink)}
.bt-swatch-custom input{position:absolute;inset:-4px;width:calc(100% + 8px);height:calc(100% + 8px);opacity:0;cursor:pointer;border:0;padding:0}
.bt-swatch-default{background:linear-gradient(135deg,var(--bt-card) 0 46%,var(--bt-line-2) 46% 54%,var(--bt-card) 54%);box-shadow:inset 0 0 0 1px var(--bt-line-2)}
.bt-states{display:flex;flex-wrap:wrap;gap:4px}
.bt-state{border:1px solid var(--bt-line);background:none;border-radius:999px;font:inherit;font-size:11px;line-height:16px;padding:2px 8px;color:var(--bt-ink-2);cursor:pointer}
.bt-state:hover{color:var(--bt-ink)}
.bt-state[aria-pressed=true]{background:var(--bt-active);border-color:var(--bt-line-2);color:var(--bt-ink)}
.bt-theme-chip{position:relative;width:46px;height:30px;border-radius:8px;box-shadow:inset 0 0 0 1px var(--bt-line-2);background:linear-gradient(90deg,var(--ls) 0 36%,var(--lb) 36%);overflow:hidden}
.bt-theme-chip i{position:absolute;right:7px;bottom:7px;width:10px;height:10px;border-radius:50%;background:var(--la)}
body[data-ds-dark-theme] .bt-theme-chip{background:linear-gradient(90deg,var(--ds) 0 36%,var(--db) 36%)}
body[data-ds-dark-theme] .bt-theme-chip i{background:var(--da)}
.bt-tabs{flex-wrap:wrap}
.bt-soft:disabled{opacity:.4;cursor:default}
.bt-group-role{margin-left:6px;font-size:11px;line-height:14px;padding:1px 5px;border-radius:4px;background:var(--bt-tag-bg);color:var(--bt-tag-ink);vertical-align:1px}
.bt-members{display:flex;flex-direction:column;gap:1px}
.bt-member{display:flex;align-items:center;gap:4px;min-height:40px;padding:0 4px 0 6px;border-radius:8px;animation:bt-rise .18s ease-out}
.bt-member:hover{background:var(--bt-hover)}
.bt-member-name{flex:1;min-width:0;display:flex;align-items:center;gap:10px;border:0;background:none;padding:6px 0;color:var(--bt-ink);font:inherit;font-size:14px;line-height:20px;cursor:pointer;text-align:left}
.bt-member-name>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-chip-admin{background:var(--bt-tag-bg);color:var(--bt-tag-ink);border-color:transparent}
.bt-mini{flex:none;border:0;background:none;border-radius:6px;padding:2px 6px;font:inherit;font-size:12px;line-height:18px;color:var(--bt-ink-2);cursor:pointer}
.bt-mini:hover{background:var(--bt-active);color:var(--bt-ink)}
.bt-member .bt-mini,.bt-member .bt-x{opacity:0;transition:opacity .15s ease}
.bt-member:hover .bt-mini,.bt-member:hover .bt-x,.bt-member .bt-mini:focus-visible,.bt-member .bt-x:focus-visible{opacity:1}
.bt-add{color:var(--bt-ink-2);margin-top:2px}
.bt-add:hover,.bt-addlist .bt-option:hover{background:var(--bt-hover);color:var(--bt-ink)}
.bt-addlist{display:flex;flex-direction:column;margin-top:4px;padding:4px;border:1px solid var(--bt-line);border-radius:10px;background:var(--bt-card);animation:bt-rise .16s ease-out}
.bt-seg{position:relative;display:flex;gap:2px;padding:2px;border-radius:10px;background:var(--bt-hover)}
.bt-motion-seg{width:216px}
.bt-seg button{position:relative;z-index:1;flex:1;height:30px;border:0;border-radius:8px;background:none;font:inherit;font-size:13px;color:var(--bt-ink-2);cursor:pointer;transition:background-color .15s ease,color .15s ease,box-shadow .15s ease,${spring(SPRING_TAP, 'scale')}}
.bt-seg button[aria-pressed=true]{background:var(--bt-card);color:var(--bt-ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.bt-seg button:disabled{opacity:.4;cursor:default}
.bt-seg button:active:not(:disabled){scale:.96}
.bt-seg>.bt-thumb{top:2px;bottom:2px;border-radius:8px;background:var(--bt-card);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.bt-seg[data-glide] button[aria-pressed=true]{background:transparent;box-shadow:none}
@keyframes bt-rise{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.bt-member,.bt-addlist{animation:none}}

/* Memory dialog: a summary of every entry, the entries behind the menu, "Ask or update" below. */
.bt-mem-row{display:flex;align-items:center;gap:8px;width:100%;height:36px;padding:0 8px 0 10px;border:.5px solid var(--bt-line-2);border-radius:10px;background:var(--bt-card);color:var(--bt-ink);font:inherit;font-size:13px;cursor:pointer;box-sizing:border-box;transition:background-color .12s ease}
.bt-mem-row:hover{background:var(--bt-hover)}
.bt-mem-row>svg{flex:none;color:var(--bt-ink-2)}
.bt-mem-row-copy{flex:1;text-align:left}
.bt-mem-row-go{display:inline-flex;align-items:center;gap:2px;color:var(--bt-ink-3);font-size:12px}
.bt-mem-layer{position:fixed;inset:var(--dsh-frame-chrome-top,0px) 0 0;z-index:61;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
.bt-mem-scrim{animation:bt-fade .2s ease-out}
.bt-mem{position:relative;width:min(680px,calc(100vw - 48px));height:min(760px,calc(100vh - 2*max(32px,var(--dsh-frame-overlay-top,32px))));background:var(--bt-main);border-radius:20px;border:.5px solid var(--bt-line-2);box-shadow:0 24px 80px rgba(0,0,0,.24);display:flex;flex-direction:column;overflow:hidden;color:var(--bt-ink);animation:bt-dialog-rise $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing},bt-veil-in .2s ease-out}
.bt-mem-head{position:relative;display:flex;align-items:center;gap:8px;height:60px;flex:none;padding:0 14px 0 24px;border-bottom:.5px solid var(--bt-line);box-sizing:border-box}
.bt-mem-head .bt-icon-btn{width:32px;height:32px;flex:none}
.bt-mem-head [aria-haspopup] svg{width:18px;height:18px;stroke-width:2.6}
.bt-mem-head>.bt-icon-btn:first-child{margin-left:-10px}
.bt-mem-head h2{margin:0;font-size:17px;line-height:24px;font-weight:600;white-space:nowrap}
.bt-mem-status{font-size:13px;line-height:18px;color:var(--bt-ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;font-variant-numeric:tabular-nums}
.bt-mem-head-gap{flex:1}
.bt-mem-menu{position:absolute;top:52px;right:50px;min-width:220px;--bt-origin:top right}
.bt-mem-menu button:disabled{opacity:.4;cursor:default;background:none}
.bt-mem-body{flex:1;overflow-y:auto;padding:22px 28px 24px;scrollbar-width:thin;display:flex;flex-direction:column;gap:12px}
.bt-mem-summary{transition:opacity .3s ease}
.bt-mem-summary[data-stale]{opacity:.55}
.bt-mem-summary h3{margin:20px 0 6px;font-size:17px;line-height:26px;font-weight:600}
.bt-mem-summary h3:first-child{margin-top:0}
.bt-mem-summary p{margin:0;font-size:15px;line-height:26px}
.bt-mem-summary>*{animation:bt-mem-line .45s cubic-bezier(.16,1,.3,1) both}
.bt-mem-summary>:nth-child(2){animation-delay:.03s}
.bt-mem-summary>:nth-child(3){animation-delay:.06s}
.bt-mem-summary>:nth-child(4){animation-delay:.09s}
.bt-mem-summary>:nth-child(5){animation-delay:.12s}
.bt-mem-summary>:nth-child(6){animation-delay:.15s}
.bt-mem-summary>:nth-child(n+7){animation-delay:.18s}
@keyframes bt-mem-line{from{opacity:0;transform:translateY(4px)}}
.bt-mem-skel{display:flex;flex-direction:column;gap:24px}
.bt-mem-skel-block{display:flex;flex-direction:column;gap:10px}
.bt-mem-skel-block span{display:block;height:12px;border-radius:6px;background:linear-gradient(90deg,var(--bt-hover) 25%,var(--bt-active) 50%,var(--bt-hover) 75%);background-size:200% 100%;animation:bt-mem-skel 1.4s ease-in-out infinite}
.bt-mem-skel-block .bt-mem-skel-head{width:30%;height:16px;margin-bottom:2px}
@keyframes bt-mem-skel{from{background-position:150% 0}to{background-position:-50% 0}}
.bt-mem-skel-label{font-size:13px;line-height:18px;color:var(--bt-ink-3)}
.bt-mem-empty{margin:auto;max-width:400px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:24px 0;animation:bt-mem-line .45s cubic-bezier(.16,1,.3,1) both}
.bt-mem-empty-mark{width:48px;height:48px;border-radius:50%;background:var(--bt-hover);display:flex;align-items:center;justify-content:center;color:var(--bt-ink-2);margin-bottom:4px}
.bt-mem-empty-mark svg{width:22px;height:22px}
.bt-mem-empty-title{font-size:15px;line-height:22px;font-weight:600}
.bt-mem-empty-text{font-size:13px;line-height:20px;color:var(--bt-ink-2)}
.bt-mem-failed{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;background:var(--bt-hover);font-size:13px;line-height:18px;color:var(--bt-ink-2)}
.bt-mem-failed>span{flex:1;min-width:0;overflow-wrap:anywhere}
.bt-mem-entries{display:flex;flex-direction:column;gap:28px;animation:bt-page-in $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing},bt-veil-in .22s ease-out}
.bt-mem-section-head{display:flex;align-items:baseline;gap:8px;margin-bottom:4px}
.bt-mem-section-head h3{margin:0;font-size:15px;line-height:22px;font-weight:600}
.bt-mem-section-head span{font-size:12px;line-height:16px;color:var(--bt-ink-3)}
.bt-mem-section-head .bt-mem-size{margin-left:auto;font-variant-numeric:tabular-nums;white-space:nowrap}
.bt-mem-topic{font-size:12px;line-height:16px;color:var(--bt-ink-2);margin:14px 0 2px 4px;font-weight:500}
.bt-mem-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.bt-mem-entry{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:.5px solid var(--bt-line);transition:opacity .2s ease}
.bt-mem-entry[data-busy]{opacity:.4}
.bt-mem-entry-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.bt-mem-entry-text{font-size:14px;line-height:20px;overflow-wrap:anywhere}
.bt-mem-entry-meta{font-size:12px;line-height:16px;color:var(--bt-ink-3);font-variant-numeric:tabular-nums}
.bt-mem-remove{flex:none;height:28px;min-width:28px;border-radius:999px;border:0;background:none;color:var(--bt-ink-3);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0 6px;font:inherit;font-size:12px;opacity:0;transition:opacity .12s ease,background-color .12s ease,color .12s ease}
.bt-mem-entry:hover .bt-mem-remove,.bt-mem-remove:focus-visible,.bt-mem-remove[data-confirm]{opacity:1}
.bt-mem-remove:hover{background:var(--bt-hover);color:var(--bt-ink)}
.bt-mem-remove[data-confirm]{background:rgba(224,33,53,.1);color:#e02135;padding:0 10px}
@media (hover:none){.bt-mem-remove{opacity:1}}
.bt-mem-none{font-size:13px;line-height:18px;color:var(--bt-ink-3);padding:8px 4px}
.bt-mem-foot{flex:none;padding:8px 20px 20px;display:flex;flex-direction:column;gap:10px}
.bt-mem-reply{border-radius:16px;background:var(--bt-hover);padding:8px 8px 12px 16px;display:flex;flex-direction:column;gap:6px;max-height:36vh;overflow-y:auto;scrollbar-width:thin;transform-origin:50% 100%;animation:bt-pop-lift $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing},bt-veil-in .2s ease-out}
.bt-mem-reply-head{display:flex;align-items:center;gap:8px;min-height:24px}
.bt-mem-reply-asked{flex:1;min-width:0;font-size:12px;line-height:16px;color:var(--bt-ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-mem-reply .bt-icon-btn{width:24px;height:24px;flex:none}
.bt-mem-reply-text{font-size:14px;line-height:21px;padding-right:8px;overflow-wrap:anywhere}
.bt-mem-changes{list-style:none;margin:2px 0 0;padding:0 8px 0 0;display:flex;flex-direction:column;gap:4px}
.bt-mem-changes li{display:flex;align-items:flex-start;gap:6px;font-size:13px;line-height:18px;color:var(--bt-ink-2);overflow-wrap:anywhere}
.bt-mem-changes li svg{flex:none;margin-top:1px;color:#e02135;animation:bt-check-pop ${SPRING_POP.duration}ms ${SPRING_POP.easing} .12s backwards}
.bt-mem-changes li[data-ok] svg{color:var(--bt-green)}
.bt-mem-ask{display:flex;align-items:center;gap:8px;height:52px;padding:0 8px 0 22px;border-radius:999px;border:.5px solid var(--bt-line-2);background:var(--bt-card);box-shadow:0 4px 16px rgba(0,0,0,.06);box-sizing:border-box;transition:border-color .15s ease,box-shadow .15s ease}
.bt-mem-ask:focus-within{border-color:var(--bt-ink-3);box-shadow:0 4px 20px rgba(0,0,0,.1)}
.bt-mem-input{flex:1;min-width:0;border:0;background:none;outline:none;color:var(--bt-ink);font:inherit;font-size:15px;line-height:22px;padding:0}
.bt-mem-input::placeholder{color:var(--bt-ink-3)}
.bt-mem-send{flex:none;width:36px;height:36px;border-radius:50%;border:0;background:var(--bt-ink);color:var(--bt-main);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;transition:opacity .15s ease,${spring(SPRING_TAP, 'scale')}}
.bt-mem-send:disabled{opacity:.22;cursor:default}
.bt-mem-send:not(:disabled):active{scale:.92}
.bt-mem-send>*{animation:bt-check-pop ${SPRING_POP.duration}ms ${SPRING_POP.easing}}
.bt-mem-spin{width:14px;height:14px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;box-sizing:border-box;animation:bt-mem-spin .7s linear infinite}
@keyframes bt-mem-spin{to{transform:rotate(360deg)}}
@media (max-width:640px){.bt-mem{width:100vw;height:100%;border-radius:0;border:0}.bt-mem-body{padding:18px 18px 20px}.bt-mem-foot{padding:8px 12px 12px}}
@media (prefers-reduced-motion:reduce){.bt-mem,.bt-mem-scrim,.bt-mem-summary>*,.bt-mem-empty,.bt-mem-reply,.bt-mem-skel-block span,.bt-mem-entries,.bt-mem-send>*,.bt-mem-changes li svg{animation:none}}

.bt-thumb{position:absolute;left:0;top:0;z-index:0;pointer-events:none;transition:opacity .14s ease}
.bt-thumb[data-hidden]{opacity:0}
[data-morph]{overflow:hidden!important}
.bt-veil{animation:bt-veil-in .22s ease-out}
.bt-with-icon{display:inline-flex;align-items:center;gap:4px}
.bt-with-icon svg{width:14px;height:14px}
.bt-tag-admin{display:inline-flex;align-items:center;gap:4px}
.bt-create-inline{padding:18px 16px;border:1px solid var(--bt-line);border-radius:12px;background:var(--bt-card)}
.bt-create-inline .bt-create-card{max-width:none}
.bt-panel-view>[data-move=in]{animation:bt-page-in $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing} backwards,bt-veil-in .2s ease-out backwards}
.bt-panel-view>[data-move=out]{animation:bt-page-out $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing} backwards,bt-veil-in .2s ease-out backwards}
.bt-panel-view>:is([data-move=in],[data-move=out]):nth-child(2){animation-delay:25ms}
.bt-panel-view>:is([data-move=in],[data-move=out]):nth-child(n+3){animation-delay:50ms}
.bt-panel-view>.bt-drawer-body[data-move=tab]{animation:bt-veil-in .2s ease-out}
.bt-drawer-name-input{animation:bt-veil-in .16s ease-out}
.bt-pop-in{display:inline-flex;animation:bt-check-pop ${SPRING_POP.duration}ms ${SPRING_POP.easing}}
:is(.bt-soft,.bt-send,.bt-icon-btn,.bt-settings-close,.bt-mini,.bt-tab,.bt-nc-send,.bt-avedit-tab,.bt-shape,.bt-pick,.bt-swatch,.bt-palette-clear){transition:background-color .12s ease,color .12s ease,border-color .12s ease,opacity .12s ease,${spring(SPRING_TAP, 'scale')}}
:is(.bt-icon-btn,.bt-settings-close,.bt-nc-send,.bt-shape,.bt-swatch,.bt-color,.bt-x,.bt-q-x,.bt-palette-clear):active:not(:disabled){scale:.9}
:is(.bt-soft,.bt-send,.bt-mini,.bt-tab,.bt-avedit-tab,.bt-pick,.bt-q-submit,.bt-q-btn):active:not(:disabled){scale:.96}
@media (prefers-reduced-motion:reduce){.bt-thumb{transition:none}.bt-panel-view>[data-move],.bt-drawer-name-input,.bt-veil,.bt-pop-in,.bt-token,.bt-drop,.bt-newchat,.bt-option-hint,.bt-connector-form,.bt-settings-head>*{animation:none}}
`

export const CONVERSATION_CSS = `
.bt-think{font-size:13px;line-height:18px;color:var(--bt-ink-2);margin:2px 0 4px;max-width:var(--bt-bubble-max)}
.bt-think summary{cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:6px}
.bt-think summary::-webkit-details-marker{display:none}
.bt-think-text{white-space:pre-wrap;margin-top:6px;padding-left:10px;border-left:2px solid var(--bt-line-2)}
.bt-event{display:flex;justify-content:center;align-items:center;gap:2px;min-height:24px;margin:2px 0;font-size:12px;line-height:16px;color:var(--bt-ink-2);flex-wrap:wrap}
.bt-event>span{padding:0 2px}
.bt-event button{border:0;background:none;color:inherit;font:inherit;display:inline-flex;align-items:center;gap:4px;cursor:pointer;height:24px;padding:4px 6px 4px 4px;border-radius:999px;box-sizing:border-box;transition:background-color .12s ease}
.bt-event button:hover{background:var(--bt-hover)}
.bt-event button:active{background:var(--bt-active)}
.bt-event button.bt-event-whole{min-width:0;max-width:100%;padding:4px 6px 4px 8px}
.bt-event-whole>*{flex:none}
.bt-event-whole>span:first-child{margin-right:2px}
/* One button cannot wrap like separate parts, so a long name is cut to fit the chat. */
.bt-event-whole>.bt-event-name{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* One plain line of what was said, after the name; the whole line still opens it. */
.bt-event-whole>.bt-event-preview{flex:1 1 auto;min-width:0;color:var(--bt-ink-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:400}
.bt-time-sep{display:flex;justify-content:center;align-items:center;height:28px;margin:14px 0 8px;font-size:12px;line-height:16px;color:var(--bt-ink-2);white-space:nowrap}
[class*="_scroll"]>[class*="_column"]::before{content:var(--bt-first-sep,none);display:block;flex:none;height:28px;margin:17px 0 12px;font-size:12px;line-height:28px;text-align:center;color:var(--bt-ink-2);white-space:nowrap}
.bt-activity{display:flex;align-items:center;gap:10px;margin:8px 0 4px 2px;font-size:14px;color:var(--bt-ink-2)}
.bt-group-replies{display:contents}
/* A Bot chat is flat in every work-details mode, without changing the user's mode
   (it is a DSH-wide setting): step groups lose their header and stay open, and what a
   mode folds away in a finished turn stays shown. TurnProcessCell also opens that
   fold; these rules cover the first frame before it does. */
[data-step-process]>div:first-child{display:none!important}
[data-step-process]>[data-step-process-body]{display:block!important;content-visibility:visible!important;max-height:none!important;overflow:visible!important;mask-image:none!important;scrollbar-gutter:auto!important}
:is([data-step-process],[data-turn-process-hidden])[hidden]{content-visibility:visible!important}
[class*="_flowItem"]:has(> [data-slot="conversation.chat.node"]:empty){display:none!important}
[class*="_header"]:has(.bt-head){border-bottom-color:transparent!important;box-shadow:none!important}
/* The transcript runs under a floating header pill. */
header[class*="_header"]:has(.bt-head){position:absolute!important;top:0;left:0;right:0;z-index:8;display:flex!important;padding:10px 0 0!important;background:transparent!important;pointer-events:none;justify-content:center}
header[class*="_header"]:has(.bt-head)::before{content:"";position:absolute;inset:0 0 auto;height:60px;background:linear-gradient(to bottom,var(--bt-main),color-mix(in srgb,var(--bt-main) 0%,transparent));pointer-events:none;z-index:-1}
header[class*="_header"]:has(.bt-head)>[class*="_headerLeading"]{position:absolute;left:12px;top:10px;pointer-events:auto}
/* Below the shell's own narrow line the header row leaves the screen for good: the
   pill now floats from <body> (mobile.js), so display:none takes nothing of ours with
   it. The mark left behind in the slot is what identifies the row to hide. */
.bt-head-mark{display:none}
html[data-bt-mobile] header[class*="_header"]:has(.bt-head-mark){display:none!important}
/* The body-level bar the pill and its hamburger float in. It starts at the status-bar
   inset: the adaptation layer's --dsh-mobile-top-inset first, then env(safe-area-inset-top)
   for the bands it does not cover, and whatever mobile.js measured only if both are absent.
   The shell's own --dsh-frame-chrome-top is deliberately not in this chain: it is never
   defined on Android, so reading it only ever produced 0. */
/* The Android adaptation layer (@dsh-android/dsh-client-ui-responsive) draws its own phone
   chrome from the frame's overlay seat: a strip [data-dsh-mobile-topbar] whose height is
   44px + the status-bar inset, filled with the sidebar colour, and — from its own centerCol
   padding — a reserved band of that same height. On screen that band reads as a bar above
   the pill, and its 44px toggle sits exactly where a hand aims: we measured its toggle at
   the inset (11,123) and ours at 0 (33,24), which is why taps aimed below the status bar
   always toggled the shell's drawer and never ours. The skin floats its own bar and drawer,
   so the strip goes and the reserved space returns to the transcript. One line undoes it. */
html[data-bt-mobile] [data-dsh-mobile-topbar]{display:none!important}
/* The 44px band is the layer's own centerCol padding: calc(topbar-height + top-inset).
   Removing the strip alone leaves that band empty on screen (measured: transcript still
   started at 90px). Give the column back the status-bar inset only, and never let the
   measured --bt-top-inset feed back in here — that loop is what kept it at 90px. */
html[data-bt-mobile] [data-dsh-frame]>[class*="centerCol"]{padding-top:var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px))!important}
/* One definition, every consumer: the shell's own --dsh-frame-chrome-top is set only under
   html[data-windows-titlebar] (and the darwin frame), never on Android, so every fixed
   layer that reads it — ours and the shell's own masks alike — fell through to 0 and
   started under the status bar. That is the single cause behind the details panel's clipped
   top row, and it is why patching the top of each panel by hand was the wrong fix. Pin it
   here to the inset the rest of the skin already measures; --bt-top-inset is written by
   mobile.js and is absent for the first frames, hence the layer's own variable behind it.
   The Android layer is unaffected: it reads neither this nor --dsh-frame-overlay-top.
   This must stay off the --bt-top-inset chain's inputs: mobile.js measures --bt-top-inset
   from --dsh-mobile-top-inset, and a definition on html cannot feed back into it. */
html[data-bt-mobile]{--dsh-frame-chrome-top:var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px)))}
/* The same inset, for the desktop layout a foldable held sideways now gets (mobile.js):
   the Android layer's own rules stop at 767px, so above the mobile line nothing consumed
   --dsh-mobile-top-inset and the shell's frame began at y=0 — on this device the top 51px
   are the status bar, so the header row, the rail's first row and the panel's top row all
   sat behind it. The variable is published only where there is something to clear (the
   layer keeps it at 0 while the app runs immersive) and is absent in every desktop
   browser, so each rule here collapses to the 0px the shell already had. --bt-top-inset is
   deliberately not in this chain: it is mobile.js's measured value, and on a desktop that
   measurement would read the header's height and pad the frame for nothing. */
html:not([data-bt-mobile]) [data-dsh-frame]>[class*="centerCol"],
html:not([data-bt-mobile]) [data-dsh-frame]>[class*="sidebarCol"]{padding-top:var(--dsh-mobile-top-inset,0px)}
html:not([data-bt-mobile]) .bt-panel,
html:not([data-bt-mobile]) .bt-pane{top:max(var(--dsh-frame-chrome-top,0px),var(--dsh-mobile-top-inset,0px))}
html:not([data-bt-mobile]) .bt-settings-layer,
html:not([data-bt-mobile]) .bt-palette-layer,
html:not([data-bt-mobile]) .bt-mem-layer{inset:max(var(--dsh-frame-chrome-top,0px),var(--dsh-mobile-top-inset,0px)) 0 0}
/* The band's one top line, shared by all three columns. The middle column's header is the
   reference and it is not ours: the shell starts that row on the status bar's inset and its
   controls 10px below it (measured: header y=51, the pill inside at y=61, 40 tall). So 10px
   below its own top is what every other column's top row has to reach, and it is written
   once here for all of them. The right column's top row is 36px buttons today; they take the
   40 the other two columns' controls are, or the tops would line up with the middles 2px out
   of step. */
html[data-bt-pc]{--bt-top-line:10px}
html[data-bt-pc] .bt-drawer-top{padding-top:var(--bt-top-line)}
html[data-bt-pc] .bt-drawer-top .bt-round{width:40px;height:40px}
html[data-bt-pc] .bt-ptabs{margin-top:var(--bt-top-line)}
/* The PC band's sidebar column takes the phone drawer's top row — the hamburger, then the
   search field, then New — rather than the desktop row's brand and search button: the column
   is 280 there, and the three controls have to read as one line.
   That line is not where the column begins. The shell draws its own sidebar root inside the
   column and pads it 6px (18px once the column is the rail — both its own stylesheet, both
   measured on the device: our root starts at y=57 open and y=69 folded under the shell's 51px
   inset). So the list takes back the difference and the row rides on it: 4px down when open,
   nothing when folded, where the row is not drawn at all.
   The button is not placed from the root at all: it is fixed to the viewport, at 12 across and
   the line down. The column cannot be its frame of reference in either of its widths — the
   shell pads its root 12px inline open and 10px folded (so the same declaration would land at
   two addresses), the region area between the two clips anything dragged above its own top,
   and folded the column is taken to zero (below), which would cut the button away with it.
   Fixed to the viewport, one address is right in both states, which is what the fold has to
   show. The open row keeps the phone's own 52px clear for it, and its buttons take a position
   of their own: the update button's failure dot is absolute against the nearest positioned
   ancestor, which would otherwise be the column's own corner rather than the button's. */
html[data-bt-pc]{--bt-shell-pad-top:6px}
html[data-bt-pc] .bt-side{margin-top:calc(var(--bt-top-line) - var(--bt-shell-pad-top))}
html[data-bt-pc] .bt-side>.bt-mobile-nav{position:fixed;left:12px;top:calc(var(--bt-top-inset,var(--dsh-mobile-top-inset,0px)) + var(--bt-top-line))}
html[data-bt-pc] .bt-side .bt-side-top{padding-top:0;padding-left:52px;padding-right:0}
html[data-bt-pc] .bt-side .bt-side-top .bt-round{flex:0 0 40px;width:40px;height:40px;position:relative}
/* A fixed box is only anchored to the viewport while no ancestor is transformed, and the
   shell's rail transition animates the region area with a 49px translate for 150ms. That
   animation is the shell's cue that this area is arriving; the area holds this skin's own
   list, and it is empty while the column is folded, so the band drops it rather than let it
   carry the button sideways for the length of a fold. */
html[data-bt-pc] [class*="_sidebarCol"] [class*="_regionArea"]{animation:none!important}
/* Folded, the column goes to nothing: its 56px track, its row, its list, the chrome the shell
   draws around our slot (its logo row, its panel list and its foot area, which is the account
   launcher and Connect) — everything but the button, which no longer belongs to the column at
   all. The tracks are the shell's inline style, so the override is !important, exactly the
   shape the phone's own layout uses below 768px (it takes the sidebar out of flow as well;
   here there is nothing left in it, so the track is enough).
   All three tracks have to be restated, so this is written only for the case where the shell's
   own right column is already zero: the shell's panel is not ours, and restating the third
   track as 0 would squash it. Where that attribute is absent the fold falls back to the empty
   56px rail rather than breaking anything.
   The state is the shell's data-sidebar-collapsed on the frame rather than this skin's bt-rail
   class: that class follows the wide flag, which stays true for the few hundred ms a fold
   takes, so the row and the list would still be drawn over a column that is already gone. */
html[data-bt-pc] [data-dsh-frame][data-sidebar-collapsed][data-rightbar-collapsed]{grid-template-columns:0 minmax(0,1fr) 0!important}
html[data-bt-pc] [data-sidebar-collapsed] [class*="_sidebarCol"] :is([class*="_logoRow"],[class*="_panelList"],[class*="_footArea"]),
html[data-bt-pc] [data-sidebar-collapsed] [class*="_sidebarCol"] .bt-side>*:not(.bt-mobile-nav){display:none!important}
/* With the row gone, the open root's 4px is not re-applied: the shell pads the root 18px here,
   and the 4px only ever existed to finish the open row's climb onto the line. */
html[data-bt-pc] .bt-side.bt-rail{margin-top:0}
/* Touch feedback, shared by both touch bands (the PC band is the foldable held sideways,
   so it is a finger too). Android's own tap highlight is the grey block that ignores this
   skin's radius and colours: it is inherited, so one declaration on the root reaches every
   control the shell draws as well, and neither band is ever published on a desktop window,
   which is left alone entirely.
   What replaces it is our own press tint, laid over the element as a background image and
   not as a background colour, so a filled button keeps its fill and takes the tint on top;
   being a background layer it is drawn inside the element's own radius (no square corner)
   and it changes no box, so nothing can shift. Press only, never hover: a tap that turns
   into a long press or a drag cleans up by itself when the finger leaves.
   Reduced motion drops the press scale and nothing else: that setting is about movement, and
   the tint is a colour that arrives without moving anything. It has to stay, too -- this
   device itself reports reduce while system animations are off, and a press that answers with
   neither movement nor colour answers with nothing at all, which is the thing being fixed.
   The tint reads --bt-active, which the sheet defines on body, so it resolves for every
   descendant of body; nothing here needs the variable moved to the root.
   The tint is important because a few of the shell's filled buttons pin their background with
   an important shorthand of their own, and the one feedback has to outrank those too; the
   swatch that draws a two-tone preview with its own background image is the one pressable
   that keeps what it is drawing instead. */
:is(html[data-bt-mobile],html[data-bt-pc]){-webkit-tap-highlight-color:transparent}
:is(html[data-bt-mobile],html[data-bt-pc]) :is(button,[role="button"],[role="tab"],[role="option"],[role="menuitem"]):active:not(:disabled):not(.bt-swatch-default){background-image:linear-gradient(var(--bt-active),var(--bt-active))!important}
@media (prefers-reduced-motion:reduce){
:is(html[data-bt-mobile],html[data-bt-pc]) :is(button,[role="button"],[role="tab"],[role="option"],[role="menuitem"]):active{transform:none;scale:none}
}
/* No scrollbar anywhere in the mobile layouts -- on the band's own scroller as well as on
   every element under it. This WebView draws the bar as a gutter that takes width from the
   content it scrolls, which on a phone is noise in the middle of the skin, so the two touch
   bands hide the bar and leave the scrolling exactly as it was: no overflow is touched here,
   and every scroller keeps the scrolling a finger expects.
   One rule reaches every one of them, so the conversation, the settings pages, the detail
   panel, the palette, the memory page and this skin's own sidebar list do not each need their
   own. It is written against the band rather than the app: a desktop window publishes neither
   attribute, so its bars are left alone, and there is no bare scroller rule to catch it.
   scrollbar-width is the spelling for the engines that have it -- this WebView reports the
   property as unsupported, so on this device the weight is entirely on the WebKit
   pseudo-element, the same pairing the detail panel's own tab strip already uses. Neither
   declaration is inherited, hence the pseudo-element is written for the band element and for
   its descendants; display:none is what removes the gutter, and the zero width and height
   close the box a bar would have claimed on either axis. */
:is(html[data-bt-mobile],html[data-bt-pc]),
:is(html[data-bt-mobile],html[data-bt-pc]) *{scrollbar-width:none}
:is(html[data-bt-mobile],html[data-bt-pc])::-webkit-scrollbar,
:is(html[data-bt-mobile],html[data-bt-pc]) ::-webkit-scrollbar{display:none;width:0;height:0}
/* The mobile skin has three sizes, on the Compact/Medium/Expanded lines the platforms
   publish (Xiaomi and HarmonyOS both use 600 and 840). The defaults below are the compact
   phone the skin draws where no band matches; a band only re-points these variables, and
   every rule that needs one reads it here. The shell's own 1024 line stays the one switch
   between desktop and mobile, so 841-1023 is still ours. A list's pitch steps with the
   band: 48px on a phone, which is still clear of the 44px a finger wants, and the roomier
   52px where the screen has width to spare. The gap between cards moves with the pitch,
   or tighter rows would leave the gaps looking loose around them. */
html[data-bt-mobile]{
  --bt-drawer-w:min(86vw,320px);
  --bt-set-max:100%;
  --bt-set-row-h:48px;
  --bt-set-gap:14px;
  --bt-set-cols:1;
}
html[data-bt-mobile][data-bt-size=medium]{
  --bt-drawer-w:min(68vw,400px);
  --bt-set-max:720px;
  --bt-set-row-h:52px;
  --bt-set-gap:16px;
}
html[data-bt-mobile][data-bt-size=expanded]{
  --bt-drawer-w:min(520px,50vw);
  --bt-set-max:880px;
  --bt-set-row-h:52px;
  --bt-set-gap:16px;
  --bt-set-cols:2;
  /* The panel is a sidebar, not half the screen: 42% of a folded screen, capped at 400px.
     On the 859px this device reports that is 361px, which leaves 443 to the conversation
     column -- it was 480 of 859, 55.9%, and the column had 324. */
  --bt-detail-w:min(400px,42vw);
}/* The bar floats above every panel this skin opens, not just the conversation: the New…
   picker, the settings page, the palette and the memory dialog are all fixed layers of
   their own (pane 45, menu/settings 60, memory 61, palette 70) that start at the top of
   the screen, and at z-index 30 the bar was simply painted over by them — that is the
   "no bar on the New page" report. The drawer and its scrim (79 and 78) are below it on
   purpose: with the drawer up, the bar's hamburger is the visible way to collapse it,
   which is why the two rules below take the pill out of the way and make room for that
   button in the drawer's own top row. */
.bt-mobile-bar{position:fixed;top:var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px)));left:0;right:0;z-index:95;display:flex;justify-content:center;padding:10px 0 0;pointer-events:none}
/* With the drawer open the pill would sit on the drawer's own search/new row — same y,
   and the pill's centred box reaches ~136px past the drawer's left edge. The drawer is
   already where a chat is picked, so while it is up the bar carries only its collapse
   button; opacity keeps the row's layout (and so the button's position) unchanged, and
   visibility is what actually takes the pill out of hit testing — the pill sets
   pointer-events:auto itself, so a pointer-events:none parent would not stop it from
   swallowing taps aimed at the drawer underneath.
   The right pair goes with it, for a different reason the phone showed: the drawer has its
   own New button in the same top-right corner, and two plus signs on one screen invite the
   wrong tap even though only one of them is the drawer's. */
html[data-bt-mobile] .bt-mobile-bar[data-nav-open] .bt-head,
html[data-bt-mobile] .bt-mobile-bar[data-nav-open] .bt-mobile-acts{opacity:0;visibility:hidden;pointer-events:none}
/* Room for that button: the drawer's brand would otherwise sit under it. */
html[data-bt-mobile] .bt-side.bt-rail[data-mobile-open] .bt-side-top{padding-left:52px}
/* The drawer's top row on a phone: the brand goes, and the search button becomes a search
   field filling everything between the collapse arrow (the bar floats over this row, hence
   the 52px above) and the New button. The skin is the shared declaration — the field is
   added to it rather than restating it. The field hands off to the command palette on the
   first character: the palette owns the search (names, chats, message hits, keyboard nav)
   and opening it closes the drawer, so text typed into this box would go to a control that
   has already left the screen. */
html[data-bt-mobile] .bt-side.bt-rail[data-mobile-open] .bt-brand{display:none}
/* The three controls of that row read as one row only if they are one row: the 40px the pill
   above the conversation has, with their tops on the same line — the bar's collapse arrow
   sits 10px below the bar's top, and the drawer's own 10px top padding already lands the row
   exactly there, so the row contributes none of its own. New is locked at 40x40: the field is
   free to shrink (min-width:0) and used to take its share out of the round button beside it,
   which is what turned that button into an oval on the phone. Its right padding goes too:
   the drawer already insets its own contents by 12px, and the row added 5 more, which made
   the gap between New and the drawer's edge read as 17px against the bar's 12. */
html[data-bt-mobile] .bt-side.bt-rail .bt-side-top{padding-top:0;padding-right:0}
html[data-bt-mobile] .bt-side.bt-rail .bt-side-top .bt-round{flex:0 0 40px;width:40px;height:40px}
.bt-side-search{box-sizing:border-box;flex:1 1 auto;min-width:0;height:40px;display:flex;align-items:center;gap:8px;padding:0 12px}
.bt-side-search>svg{flex:none;width:16px;height:16px;color:var(--bt-ink-3)}
.bt-side-search input{flex:1 1 auto;min-width:0;border:0;background:none;outline:none;padding:0;color:var(--bt-ink);font-family:inherit;font-size:14px;line-height:20px}
.bt-side-search input::placeholder{color:var(--bt-ink-3)}
/* Three tracks, one of them centred. The bar keeps symmetric side padding so the pill's
   midpoint is the screen's midpoint no matter how wide the two side buttons are, and the
   padding is where the clearance lives: 104px covers the wider side (the right frame is
   12 + 89 = 101), so nothing can overlap on a 425px screen, and the pill's own
   70% cap plus the name's ellipsis keeps long titles inside the middle track. */
.bt-mobile-bar{--bt-mobile-clear:104px;position:fixed;top:var(--bt-top-inset,var(--dsh-mobile-top-inset,env(safe-area-inset-top,0px)));left:0;right:0;z-index:95;display:flex;justify-content:center;padding:10px var(--bt-mobile-clear) 0;pointer-events:none}
/* The three floating controls at the top are frosted: a message scrolling up shows
   through them instead of being hidden by them. The bar itself stays a plain container —
   no fill, no filter — so what is behind the *gaps* between the controls is untouched; the
   frost belongs to the pill, the hamburger and the right frame, edit each.
   The fade band is the mirror of the one the exchange dialog already puts above its own
   footer (.bt-exchange .bt-dialog-foot::before: 40px, opaque var(--bt-main) at the edge it
   hugs fading to nothing), so the top of the screen fades by the same 40px the bottom does,
   and only its direction differs. Its top edge is the bar's own top, which is the status
   bar's lower edge, so a message reads as arriving from under the status bar. Its head is
   the same colour mixed to 80% instead of opaque: that is the one shim this skin needs it to
   give, because the band's head is also the only part of it that runs behind the controls —
   at 100% it composited with their fill into near-total coverage, which is what the phone
   saw when it reported no translucency at all. The cost is stated rather than hidden: 20% of
   a bright message can ghost through the very first row at the status bar, and the band is
   no longer an exact match for the footer's, only a perceptually even one.
   The controls' own fill carries the rest: 30% with a 16px blur, so what is behind them
   reads as a soft shape rather than as letters. That is thin enough that their labels are
   carried by the blur, not by the fill: over the transcript's own dark backdrop the white
   ink keeps a contrast ratio of roughly 13:1, but a full-bleed bright image behind a control
   can flatten it to about 1.8:1. The remedy there is more blur or a text-shadow in the
   control's own colour — not fill, which is what this whole thread was about removing.
   To trade the other way — fade clear of the controls, frost at full strength — move this
   rule to top:100%; height:32px and put the fill back to 72%.
   It keeps z-index -1 so it paints under the controls rather than over them; it is a child
   of the bar, so the bar's own stacking context (95) still holds it above the conversation.
   The transcript already reserves 60px at the top of its scroll box for the floating pill
   row, which clears this 50px bar, so the first line is not covered on arrival.
   Two variables, set on the bar and inherited by its children, switch both the fill and the
   filter off together for every full-screen layer this skin opens: there the bar floats
   over a surface whose own first row sits in exactly this band and would be blurred out —
   the drawer (its top row is the bar's y), the New…/exchange/voice panes (their To: row),
   the settings page, the memory dialog and the palette.
   If the blur costs frames on this WebView, the fallback is to raise --bt-frost-fill to 92%
   and leave --bt-frost-blur at none — same two properties, no rule to hunt for. */
html[data-bt-mobile] .bt-mobile-bar{--bt-frost-fill:color-mix(in srgb,var(--bt-main) 30%,transparent);--bt-frost-blur:blur(16px)}
html[data-bt-mobile] .bt-pill,
html[data-bt-mobile] .bt-mobile-nav,
html[data-bt-mobile] .bt-mobile-acts{background:var(--bt-frost-fill,var(--bt-main));-webkit-backdrop-filter:var(--bt-frost-blur,none);backdrop-filter:var(--bt-frost-blur,none)}
html[data-bt-mobile] .bt-mobile-bar::after{content:"";position:absolute;left:0;right:0;top:0;height:40px;z-index:-1;pointer-events:none;background:linear-gradient(to bottom,color-mix(in srgb,var(--bt-main) 80%,transparent),transparent)}
html[data-bt-mobile] .bt-mobile-bar[data-nav-open],
html[data-bt-mobile] body:has(.bt-pane) .bt-mobile-bar,
html[data-bt-mobile] body:has(.bt-settings-layer) .bt-mobile-bar,
html[data-bt-mobile] body:has(.bt-mem-layer) .bt-mobile-bar,
html[data-bt-mobile] body:has(.bt-palette-layer) .bt-mobile-bar{--bt-frost-fill:var(--bt-main);--bt-frost-blur:none}
html[data-bt-mobile] .bt-mobile-bar[data-nav-open]::after,
html[data-bt-mobile] body:has(.bt-pane) .bt-mobile-bar::after,
html[data-bt-mobile] body:has(.bt-settings-layer) .bt-mobile-bar::after,
html[data-bt-mobile] body:has(.bt-mem-layer) .bt-mobile-bar::after,
html[data-bt-mobile] body:has(.bt-palette-layer) .bt-mobile-bar::after{display:none}
/* Every full-screen layer this skin draws brings its own top: the panes (New..., the
   exchange, voice and the browser, all .bt-pane), the details column (.bt-panel), the
   memory dialog and the palette close themselves, and the settings screen has its own
   title bar. Over any of them the bar is both useless and in the way -- its hamburger,
   the pill and the right pair land on the layer's first row, which is why the rule above
   used to keep those capsules opaque there. Hiding the bar is the right answer, not a
   solid bar. The two pane classes are separate: .bt-pane is the pane the chat opens and
   .bt-panel is the details column, and both are full screen here.
   The drawer is deliberately absent: the hamburger in the bar is what opens and closes it. */
html[data-bt-mobile] body:has(.bt-pane) .bt-mobile-bar,
html[data-bt-mobile] body:has(.bt-panel) .bt-mobile-bar,
html[data-bt-mobile] body:has(.bt-mem-layer) .bt-mobile-bar,
html[data-bt-mobile] body:has(.bt-palette-layer) .bt-mobile-bar,
html[data-bt-mobile] body:has(.bt-settings-layer) .bt-mobile-bar{display:none}
/* On a phone the settings dialog is the screen rather than a card floating on it. A 198px
   page column beside a page needs a width a phone has not got -- at 425px it left the page
   179px, which is what made the whole thing read as broken. The two columns become two
   screens instead: the list, then the page it opens, under an arrow that goes back up. */
html[data-bt-mobile] .bt-settings{flex-direction:column;width:100%;height:100%;border-radius:0;border:0;box-shadow:none}
html[data-bt-mobile] .bt-settings[data-screen=list] .bt-settings-main,
html[data-bt-mobile] .bt-settings[data-screen=page] .bt-settings-nav{display:none}
/* The title bar spans both screens, so it stays put when the list opens a page: back on
   the left, the title centred on the dialog, the close on the right. Both side buttons are
   40px with 44px of target; the title is out of their flow, so a wider button on one side
   cannot pull it off centre, and it ellipsises rather than wrapping. */
html[data-bt-mobile] .bt-settings-top{position:relative;flex:none;display:flex;align-items:center;justify-content:space-between;height:52px;padding:0 12px;box-sizing:border-box}
html[data-bt-mobile] .bt-settings-top>.bt-icon-btn{position:relative;flex:none;width:40px;height:40px;background:var(--bt-hover)}
html[data-bt-mobile] .bt-settings-top>.bt-icon-btn::after{content:"";position:absolute;inset:-2px}
html[data-bt-mobile] .bt-settings-top h2{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);margin:0;padding:0 60px;text-align:center;font-size:16px;line-height:24px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
/* The title bar is the page under it, not a surface of its own. It inherited the dialog's
   --bt-main, which on the list screen is not the colour there: the list's base is the
   sidebar colour, so a band of a different colour ran across the top, and it stayed there
   while the list scrolled under it. Each screen names its own base, so the seam cannot come
   back, and no rule adds a divider line. */
html[data-bt-mobile] .bt-settings[data-screen=list] .bt-settings-top{background:var(--bt-sidebar)}
html[data-bt-mobile] .bt-settings[data-screen=page] .bt-settings-top{background:var(--bt-main)}
/* That bar replaces the wide dialog's head and its floating close. */
html[data-bt-mobile] .bt-settings-head,
html[data-bt-mobile] .bt-settings-close{display:none}
/* The list is cards now, and it scrolls: rows plus headings no longer fit a phone. */
html[data-bt-mobile] .bt-settings-nav{width:100%;flex:1;overflow-y:auto;border-right:0;padding:8px max(12px,calc((100% - var(--bt-set-max,100%))/2)) max(16px,env(safe-area-inset-bottom))}
/* The glide thumb belongs to the wide dialog's column, where it parks behind the row
   matching [aria-current]. On a phone the list is the top level and no row is current --
   the row that opens a page is not that page -- so it has nothing to park on. */
html[data-bt-mobile] .bt-settings-nav>.bt-thumb{display:none}
html[data-bt-mobile] .bt-settings-group{display:block}
html[data-bt-mobile] .bt-settings-group+.bt-settings-group{margin-top:var(--bt-set-gap,14px)}
html[data-bt-mobile] .bt-settings-group-head{display:block;margin:0 0 8px;padding:0 12px 0 13px;font-size:13px;line-height:18px;font-weight:600;color:var(--bt-ink-2)}
/* The group card takes the widest radius in the skin, one step up from the 12px the page
   cards carry: it is the frame around a whole group, and at 12px its corners read tighter
   than the group heading above them suggests. The rows inside it are flush neighbours --
   the card's own edge and fill is what separates one group from the next, so no line is
   drawn between rows. */
html[data-bt-mobile] .bt-settings-group-card{display:block;border:1px solid var(--bt-line);border-radius:16px;background:var(--bt-card);overflow:hidden}
html[data-bt-mobile] .bt-settings-main{width:100%;height:auto;flex:1;min-height:0}
/* The list reads in two levels: the row's name is the text, one step below the 15px it
   was and in the primary ink, and everything beside it is the second level at the group
   heading's size and colour -- the 24px icons included, or they read as heavier than the
   name they belong to. The chevron is that same second level: same colour, same size. */
html[data-bt-mobile] .bt-settings-item{min-height:var(--bt-set-row-h,48px);padding:0 12px;border-radius:0;font-size:14px;line-height:20px;gap:12px;color:var(--bt-ink)}
/* The name takes the room the chevron does not: it ellipsises, and the chevron lands on
   the card's inner edge rather than behind the text. The row carries its own width
   because this is a <button> in a block card — without it the button shrinks to its
   content, and margin-left:auto on the chevron has no free space to spend. */
html[data-bt-mobile] .bt-settings-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html[data-bt-mobile] .bt-settings-item>svg{flex:none;width:24px;height:24px;color:var(--bt-ink-2)}
html[data-bt-mobile] .bt-set-go{display:flex;margin-left:auto;color:var(--bt-ink-2)}
html[data-bt-mobile] .bt-set-go svg{width:13px;height:13px}
/* The pages under the list open lists of the same kind -- a Bot, a group chat, a model's
   usage row -- so they read at the same two levels: the row's own line is the text, at the
   list's size in the primary ink, and what sits beside it is the second level, which means
   the tag pills one step down and the chevron at the group heading's colour and size. Only
   the rows that carry a Bot or a group chat are picked out: a form's own rows, which are a
   label and a control, keep the sizes the form gave them. */
html[data-bt-mobile] .bt-set-row:has(.bt-set-bot){font-size:14px;line-height:20px;color:var(--bt-ink)}
html[data-bt-mobile] .bt-set-row:has(.bt-set-bot) .bt-tag{font-size:13px;line-height:18px}
html[data-bt-mobile] .bt-set-row:has(.bt-set-bot) .bt-chevron{color:var(--bt-ink-2)}
html[data-bt-mobile] .bt-set-row:has(.bt-set-bot) .bt-chevron svg{width:13px;height:13px}
/* Those rows are options in a card, the same as the rows of the list above them, so no line
   is drawn between them either. */
html[data-bt-mobile] .bt-set-card>.bt-set-row:has(.bt-set-bot)+.bt-set-row:has(.bt-set-bot){border-top:0}
html[data-bt-mobile] .bt-us-row-line{font-size:14px;line-height:20px}
html[data-bt-mobile] .bt-us-row-sub{font-size:13px;line-height:18px;color:var(--bt-ink-2)}
/* The usage page opens with a strip of four figures in one row. On a phone that row cannot
   hold four: at 425px the 1.6fr 1fr 1fr 1fr columns leave the total about 103px of content
   and the three beside it about 51px, while the total's line -- a 34px figure, its unit and
   its delta, all nowrap -- wants about three times that. A nowrap box paints outside its
   own cell wherever there is no clip, so the total ran over the next cell's label, and the
   51px cells ellipsised their own labels ("缓存…"). The total takes a row of its own and
   the three figures share the row below, where each has room for its whole label, and the
   value is clipped at its own cell so it cannot reach a neighbour again. Expanded, which
   has the width for the original row, keeps it. */
html[data-bt-mobile]:not([data-bt-size=expanded]) .bt-us-stats{grid-template-columns:repeat(3,minmax(0,1fr))}
html[data-bt-mobile]:not([data-bt-size=expanded]) .bt-us-stat{padding:14px}
html[data-bt-mobile]:not([data-bt-size=expanded]) .bt-us-stat-main{grid-column:1/-1;border-bottom:1px solid var(--bt-line)}
html[data-bt-mobile]:not([data-bt-size=expanded]) .bt-us-stat+.bt-us-stat{border-left:0}
html[data-bt-mobile]:not([data-bt-size=expanded]) .bt-us-stat:nth-child(n+3){border-left:1px solid var(--bt-line)}
html[data-bt-mobile] .bt-us-stat-value{overflow:hidden}
html[data-bt-mobile] .bt-settings-scroll{padding:12px 12px max(24px,env(safe-area-inset-bottom))}
/* A settings row is a label and whatever changes it, side by side; on a phone the row has
   the width for that now, so it only needs the height a finger wants. */
html[data-bt-mobile] .bt-set-row{padding:12px;min-height:52px}
/* Medium and expanded are the same skin with room, and nothing here can reach the
   desktop: every rule needs data-bt-mobile, and mobile.js writes data-bt-size only while
   that flag is on. Above 1024px this file is exactly what it was. */
/* Medium: the panel is still the only thing on screen, but on a half-folded screen a
   full-bleed sheet wastes the width it has — it floats centred at 70vw instead. */
html[data-bt-mobile][data-bt-size=medium] .bt-panel{left:15vw;right:15vw;width:70vw!important;border-left:.5px solid var(--bt-line-2);border-radius:16px 16px 0 0;box-shadow:0 -12px 40px -12px rgba(0,0,0,.3)}
/* Expanded: there is room for the conversation and the panel at once, so the panel is a
   right-hand column again and the column keeps its 480px instead of being covered.
   The reservation is for the panel, so it is gated on the panel being there: without the
   gate it applied to a folded screen with nothing open, where the column is the whole
   screen (measured 859 wide: 56 of rail + 324 of column + 479 let go to nobody). */
html[data-bt-mobile][data-bt-size=expanded] .bt-panel{left:auto;right:0;width:var(--bt-detail-w)!important;border-left:.5px solid var(--bt-line-2)}
html[data-bt-mobile][data-bt-size=expanded] body:has(.bt-panel) [class*="_centerCol"]{margin-right:var(--bt-detail-w)!important}
/* The floating bar is hidden over a panel because the panel sits under it. Beside the
   panel there is nothing to hide from: it stays, over the conversation and clear of the
   column, which is how the session stays switchable while the details are open. */
html[data-bt-mobile][data-bt-size=expanded] body:has(.bt-panel) .bt-mobile-bar{display:flex;right:var(--bt-detail-w)}
/* Two columns of group cards, one gutter apart, each row as tall as its taller card. */
html[data-bt-mobile][data-bt-size=expanded] .bt-settings-nav{display:grid;grid-template-columns:repeat(var(--bt-set-cols,1),minmax(0,1fr));column-gap:var(--bt-set-gap,14px);row-gap:var(--bt-set-gap,14px);align-content:start;align-items:start}
html[data-bt-mobile][data-bt-size=expanded] .bt-settings-group{margin-top:0}
.bt-mobile-bar .bt-head{flex:1 1 auto;width:100%;max-width:var(--dsh-chat-content-width,748px);margin-inline:auto}
/* pointer-events:auto is required: .bt-head sets none to let the transcript scroll
   under the floating pill, and the property inherits into these buttons. Size lives here,
   the skin lives in the shared rule above; both controls are border-box 40px tall, the
   same 40px the pill itself has. */
.bt-mobile-nav,.bt-mobile-act{pointer-events:auto;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;padding:0;color:var(--bt-ink);cursor:pointer}
/* The hamburger sits on the screen's left edge, the group on its right; both are out of
   flow, so neither can push the pill off centre. */
.bt-mobile-nav{position:absolute;left:12px;top:10px;z-index:31;width:40px;height:40px}
/* The right pair is one component: the frame carries the shared skin, the two 44px buttons
   inside drop all of theirs, and nothing separates them — so the outline is continuous
   around both halves. overflow:hidden clips a button's own hover fill inside the frame's
   arc. 89x40 outer, its right edge 101px in, still inside the 104px clearance above. */
.bt-mobile-acts{position:absolute;right:12px;top:10px;z-index:31;display:flex;align-items:stretch;pointer-events:auto;box-sizing:border-box;height:40px;overflow:hidden}
.bt-mobile-acts .bt-mobile-act{width:44px;border:0;border-radius:0;background:none;box-shadow:none}
.bt-mobile-acts .bt-mobile-act:hover{background:var(--bt-hover)}
.bt-mobile-nav:active,.bt-mobile-act:active{transform:scale(.96)}
/* The details panel is a right-hand column on a desktop, but a phone has no room for one
   beside the conversation: it takes the whole screen instead. Its top is not set here — the
   base rule reads --dsh-frame-chrome-top, which the rule above now defines for the whole
   phone layout, so the panel follows it without a line of its own. 96 puts it over the
   floating bar (95) — with the panel up there is nothing of the bar left to click anyway,
   and the panel brings its own close button — and it stays under the toasts (1000). The
   width is forced because a panel dragged wide on a desktop would keep its
   inline width through a rotation. */
html[data-bt-mobile] .bt-panel{left:0;right:0;bottom:0;width:100%!important;z-index:96;border-left:0}
/* Full screen means the conversation is covered, not narrowed: the panel no longer writes
   its width into the chat column, so nothing on the left is squeezed off the screen. */
html[data-bt-mobile] [class*="_centerCol"]{margin-right:0!important}
/* No back button of our own: the panel already carries a close button in its top-right
   corner on this layout, so its first row starts at its own left padding and nothing has to
   be held clear of a button that is not there. */
/* The row that scrolls gets the gesture bar's height back, so the last line of a group's
   member list clears it. A view pinned to the desktop panel width while it settles would
   otherwise narrow itself back to 320px. */
html[data-bt-mobile] .bt-panel .bt-drawer-body{padding:20px 16px max(16px,env(safe-area-inset-bottom))}
/* A phone reads the panel as a page, not as a window with a frozen top: the identity
   block and the tab row travel with the content, and only the one row that carries the
   close control — the drawer's own row, or the settings sub-heading with its back arrow —
   stays put. One scroller, one scrollbar: the view scrolls, the body inside it no longer
   does. The tab strip is a sibling of the view, so it is already out of the scroll flow. */
html[data-bt-mobile] .bt-panel .bt-panel-view:has(> .bt-drawer-body){overflow-y:auto;overscroll-behavior:contain}
html[data-bt-mobile] .bt-panel .bt-panel-view:has(> .bt-drawer-body)>.bt-drawer-body{flex:0 0 auto;overflow:visible}
html[data-bt-mobile] .bt-panel .bt-panel-view:has(> .bt-drawer-body)>.bt-drawer-top,
html[data-bt-mobile] .bt-panel .bt-panel-view:has(> .bt-drawer-body)>.bt-subhead{position:sticky;top:0;z-index:3;background:var(--bt-main)}
html[data-bt-mobile] .bt-panel[data-settling]>.bt-ptabs,html[data-bt-mobile] .bt-panel[data-settling]>.bt-panel-view{width:100%}
/* The resize grip belongs to the column layout that no longer exists here. */
html[data-bt-mobile] .bt-panel-grip{display:none}
/* The shell's own top inset is left exactly as the shell set it: on this device it
   carries the status bar (measured ~46px), and zeroing it put the bar above the
   screen's usable area instead of clearing it. */
/* The pill centres itself in the same measure the transcript runs in: the shell's own
   --dsh-chat-content-width, read only, never redefined (see the note below). */
header[class*="_header"] .bt-head{flex:1 1 auto;width:100%;max-width:var(--dsh-chat-content-width,748px);margin-inline:auto}
/* The content column keeps the shell's own measure, including the width the user dragged:
   the shell defines --dsh-chat-content-width on its own body and sizes its width handle
   from it, so overriding it here collapsed that handle. Only the bubble cap is ours. */
[class*="_body"]:has(> [class*="_scrollBody"]){--bt-bubble-max:min(calc(var(--dsh-chat-content-width,748px) * .702),82%)}
/* A Bot's bubble in a hand sits between two equal gaps: the 30px its avatar column takes on
   the left, and the same 30px left over on the right, so the pair reads as centred without
   moving the avatar or where the text starts. The column takes 30px off the row's measure and
   the bubble then fills what the avatar column leaves, which lands the bubble's right edge
   exactly 30px inside the row -- the arithmetic the user asked for, and the reason the value is
   expressed as a subtraction rather than a share. (Only the wrapper consumes the cap: the
   bubble inside a line is deliberately uncapped, see the .bt-msg-line>.bt-bubble rule.) Only the
   Bot's own row is touched, and only in a group, where an avatar column is what holds the left:
   the user's side and a one-to-one chat keep the base cap. */
html[data-bt-mobile][data-bt-size=compact] [class*="_body"]:has(> [class*="_scrollBody"]) .bt-astack[data-lead]{--bt-bubble-max:calc(100% - 30px)}
/* On a hand the three tools sit under the bubble rather than beside it: there is no hover to
   chase, and beside the bubble they eat the text's width (at the widest cap they even reached
   past the viewport and made the page scroll sideways). They stay absolutely positioned, so a
   hidden toolbar still reserves no room, and they hang under the bubble's left corner; a
   group's avatar column is stepped over so they line up with the bubble. The hover bridge that
   existed for the sideways placement has nothing left to bridge. */
html[data-bt-mobile][data-bt-size=compact] .bt-tools{top:100%;left:0;margin:6px 0 0;transform:none}
html[data-bt-mobile][data-bt-size=compact] .bt-astack[data-lead] .bt-tools{left:30px}
html[data-bt-mobile][data-bt-size=compact] .bt-tools::after{display:none}
[data-turn-tail]>:not([data-slot="conversation.chat.turnTail"]){display:none!important}
[class*="_flowItem"][data-chat-flow-kind="turn-tail"]:not(:has([data-slot="conversation.chat.turnTail"]:not(:empty))){display:none!important}
/* The cards of the files a turn handed over sit at the turn's end, in every conversation
   (cells.js TurnTailCell). They are the message cards themselves, so they take the full
   width here instead of the avatar indent they have under a group reply. */
[data-turn-tail] .bt-dcards{margin-left:0;margin-top:10px;padding:0 2px}
/* DSH's own ui-deliverables draws its delivery cards in the very same turn tail, from the
   same per-turn record, so a turn that handed files over would otherwise draw two sets of
   cards. Ours is the one a phone can use -- it copies the path and hands the file to
   another app -- so the platform's block is taken out. Its "files changed" card is another
   module (compiled as P4kPIW_*) and this never touches it. The hook is the platform's own
   marker on the row of presented cards, and the rule climbs to the box that holds exactly
   that row (its heading and its "show all" toggle), so nothing of it is left behind. One
   rule, easy to take back: delete it and both surfaces show again. */
[class*="_root"]:has(>[data-presented-files-row]){display:none!important}
/* Every team Session belongs to a Bot or a group, so a blank one is an empty chat, not
   the shell's new-session hero: no headline, no workspace or mode picker, and the
   composer stays docked at the bottom. */
[data-content-phase=hero] [class*="_scrollBody"]{justify-content:flex-end!important}
[data-content-phase=hero] [class*="_composerHero"]{align-self:stretch!important;width:auto!important;padding-bottom:0!important}
[data-content-phase=hero] [class*="_composerHero"]>[class$="_root"],[data-content-phase=hero] [class*="_heroWorkspaceRow"]{display:none!important}
[data-content-phase=hero] [class*="_composerHero"] [class*="_input"]{min-height:0!important}
/* Both edges sit 16px from the column, so the content hugs the window on wide screens. */
[class*="_scroll"]:has(> [class*="_column"]){padding:60px 16px 16px 16px!important}
/* The shell's running status only hosts the activity row (.bt-typing). */
[data-chat-running]{display:block!important;width:100%;min-height:0!important;margin:0!important;padding:0!important}
[data-chat-running]>span:not([role=status]){display:none!important}
[data-chat-running]:has(> .bt-typing){margin-top:var(--dsh-chat-flow-gap,12px)!important}
.bt-typing{display:flex;align-items:center;gap:12px;height:36px;min-width:0;padding-inline-start:8px;transform-origin:0 50%;animation:bt-typing-in ${SPRING_TAP.duration}ms ${SPRING_TAP.easing} backwards}
.bt-typing[data-exiting]{animation:bt-typing-out .14s cubic-bezier(.22,1,.36,1) forwards}
.bt-typing>.bt-mark,.bt-typing>.bt-cluster{flex-shrink:0}
.bt-typing>.bt-mark{cursor:pointer;transition:filter .16s ease-out}
.bt-typing>.bt-mark:hover{filter:drop-shadow(0 2px 4px rgba(0,0,0,.18))}
.bt-typing>.bt-mark .bt-eyes{transition:scale .28s cubic-bezier(.4,.06,.18,1)}
.bt-typing>.bt-mark:hover .bt-eyes{scale:1.18}
.bt-typing-text{display:flex;align-items:center;flex:1 1 auto;min-width:0;animation:bt-typing-label .22s ease-out .2s backwards}
.bt-typing-label{display:inline-flex;align-items:center;gap:6px;min-width:0;animation:bt-typing-label .22s ease-out backwards}
.bt-typing-label>.bt-shimmer{font-size:14px;line-height:22px;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-typing-time{flex-shrink:0;font-size:12px;line-height:22px;color:var(--bt-ink-3);white-space:nowrap}
@keyframes bt-typing-in{from{opacity:0;transform:scale(.9)}}
@keyframes bt-typing-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.92);filter:blur(3px)}}
@keyframes bt-typing-label{from{opacity:0;filter:blur(5px);transform:translateY(3px)}}
/* Shimmer: a stepped sweep clipped to the text. */
.bt-shimmer{color:transparent;background:linear-gradient(90deg,var(--bt-shimmer-base) 0%,var(--bt-shimmer-base) 25%,var(--bt-ink) 60%,var(--bt-shimmer-base) 75%,var(--bt-shimmer-base) 100%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;animation:bt-shimmer 2.2s steps(60) infinite;--bt-shimmer-base:color-mix(in srgb,var(--bt-ink) 40%,transparent)}
@keyframes bt-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
/* New rows slide up; a reply that replaces the activity row grows out of its corner. */
[data-bt-enter="new"]{animation:bt-row-in $${SPRING_SHAPE.duration}ms $${SPRING_SHAPE.easing}}
[data-bt-enter="after-collapse"]{transform-origin:0 100%;animation:bt-row-after .24s cubic-bezier(.23,1,.32,1) .38s backwards}
@keyframes bt-row-in{from{transform:translateY(12px)}to{transform:none}}
@keyframes bt-row-after{0%{opacity:0;transform:translateY(12px) scale(.94)}55%{opacity:1}100%{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){
.bt-typing,.bt-typing[data-exiting]{animation-name:bt-fade-in;animation-duration:.12s;transform:none}
.bt-typing[data-exiting]{animation-name:bt-fade-out}
.bt-typing-text,.bt-typing-label{animation-name:bt-fade-in;animation-delay:0s}
.bt-shimmer{animation:none;background:none;color:var(--bt-ink-2)}
[data-bt-enter="new"]{animation:none}
[data-bt-enter="after-collapse"]{animation:bt-fade-in .12s ease-out}
}
@keyframes bt-fade-in{from{opacity:0}to{opacity:1}}
@keyframes bt-fade-out{from{opacity:1}to{opacity:0}}
[data-composer-card]{display:flex!important;flex-direction:row;flex-wrap:wrap;align-items:center;gap:0!important;min-height:44px;border-radius:22px!important;padding:7.5px!important;box-sizing:border-box;background:var(--bt-main)!important;border:.5px solid var(--bt-line-2)!important;box-shadow:0 2px 8px -1px rgba(0,0,0,.05),0 1px 2px rgba(0,0,0,.03),0 0 0 1px rgba(228,228,228,.04)!important;transition:border-color .15s ease,background-color .15s ease,${spring(SPRING_SHAPE, 'border-radius')}!important}
[data-composer-card]:hover,[data-composer-card]:focus-within{border-color:color-mix(in srgb,var(--bt-ink) 30%,transparent)!important}
[data-composer-card]:has(> [data-slot="conversation.input.attachments"] *),[data-composer-card]:has([data-composer-input] br + *),[data-composer-card]:has([data-composer-input] > :nth-child(2)){border-radius:18px!important}
/* The composer takes the same measure as the conversation column, so both edges line up:
   the same 16px padding on each side and the same width cap. */
[class*="_root"]:has(> [data-composer-card]){padding:0 16px 16px 16px!important}
[class*="_root"]:has(> [data-composer-card])>[data-composer-card]{max-width:var(--dsh-chat-content-width,1200px)!important;margin-inline:auto}
[data-composer-card]>[class*="_row"]{display:contents!important}
[data-composer-card] [class*="_tools"]{order:1;flex:none;align-self:flex-end;margin:0}
[data-composer-card]>[data-input-scroll]{order:2;flex:1 1 0;min-width:0;padding:0 8px!important;margin:0!important}
[data-composer-card] [class*="_trailing"]{order:3;flex:none;align-self:flex-end;margin:0}
[data-composer-card]>[data-slot="conversation.input.attachments"]{order:0;flex-basis:100%}
/* On a phone the preview rail leaves the card's own flow and hangs above it. Inside the
   card it took its height out of the draft, which is what pushed the input down as soon
   as a file was attached; absolutely positioned it costs the card nothing, so the card
   measures the same with and without attachments. The card is already position:relative
   and clips none of its own children.
   The slot itself cannot be positioned: its outlet is a div carrying an inline
   "display:contents" (dsh-client-ui-renderer, SlotOutlet), so it generates no box and
   flex/position on it are inert -- measured, the card still grew by the rail's height and
   the thumb sat left of the input on one line. The box that has to move is therefore the
   rail element inside the outlet, and only its outer one: the scrollable rail is nested in
   it and must keep its own flow. Its own -6px bottom margin would have eaten into the gap,
   so it goes.
   12px of clearance rather than 8: the accessibility tree's boxes run a couple of px
   larger than the elements they stand for (it reports the 64px thumbnail at 65-66px), so
   the same tree reads this gap about 2px short -- 8px of CSS came back as 6.2. The air is
   there to read as clear separation, not as a margin to argue over. */
html[data-bt-mobile] [data-composer-card] [data-slot="conversation.input.attachments"]>[class*="_rail"],
html[data-bt-mobile] [data-composer-card] [data-slot="conversation.input.attachments"] [class*="_rail"]:has([class*="_rail"]){position:absolute;left:0;right:0;bottom:calc(100% + 12px);margin:0}
/* That rail no longer changes the card's size, so the shape that used to follow the size
   change would now be a jump all by itself. */
html[data-bt-mobile] [data-composer-card]:has(> [data-slot="conversation.input.attachments"] *){border-radius:22px!important}
/* The host's remove button is 18px, and on a phone that is the whole target: a thumb
   does not land on it. The button keeps its pixels and an empty pseudo-element grows the
   target to 32x32 around it. The inset is uneven on purpose -- 4px up and 4px right reach
   the item's own edges, 10px left and 10px down make up the rest -- so the target stays
   inside the 64px item and the rail gains nothing to scroll: a wider target would have
   pushed the rail's own overflow arrows on for a single photo. The cost is the
   thumbnail's top-right corner, which now removes the image instead of opening it. */
html[data-bt-mobile] [data-slot="conversation.input.attachments"] [class*="_remove"]::after{content:"";position:absolute;inset:-4px -4px -10px -10px}
[data-composer-card] [data-composer-input]{min-height:24px;padding:2px 0!important}
[data-composer-card] [data-composer-placeholder]{left:0!important;top:2px!important}
[data-composer-placeholder]{font-size:0!important;line-height:0!important}
[data-composer-placeholder]::after{content:var(--bt-placeholder,"Message");display:block;font-size:14px;line-height:24px;color:color-mix(in srgb,var(--bt-ink) 36%,transparent)}
/* The team's "+" (ComposerPlus) takes the seat of the shell's command-menu button. */
[data-composer-card] button[class*="_add"]{display:none!important}
.bt-plus{flex:none;width:28px;height:28px;padding:0;border:0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--bt-ink) 5%,transparent);box-shadow:inset 0 0 0 .5px var(--bt-line);color:var(--bt-ink-2);cursor:pointer;transition:background-color .15s ease,color .15s ease,${spring(SPRING_TAP, 'scale')}}
.bt-plus:hover,.bt-plus[aria-expanded=true]{background:color-mix(in srgb,var(--bt-ink) 10%,transparent);color:var(--bt-ink)}
.bt-plus:active{scale:.9}
.bt-plus svg{width:14px;height:14px;transition:${spring(SPRING_POP, 'rotate')}}
.bt-plus[aria-expanded=true] svg{rotate:45deg}
.bt-plus-menu{min-width:180px}
[data-composer-card] [class*="_tools"]{gap:0!important}
[data-composer-card] [class*="_modes"]:empty{display:none!important}
[data-composer-card] [class*="_activity"]:not(:has([data-slot] > *)){display:none!important}
[data-composer-card] [class*="_trailing"]{gap:8px}
[data-composer-card] [class*="_standardControls"]{display:flex;align-items:center;gap:8px}
[data-composer-card] button[class*="_primary"]{width:28px!important;height:28px!important;background:var(--bt-accent)!important;color:var(--bt-accent-ink,#fff)!important;border-radius:50%!important;transition:opacity .15s ease,${spring(SPRING_TAP, 'scale')};animation:bt-icon-swap ${SPRING_POP.duration}ms ${SPRING_POP.easing}}
[data-composer-card] button[class*="_primary"]:hover:not(:disabled){opacity:.9}
[data-composer-card] button[class*="_primary"]:active:not(:disabled){scale:.9}
@keyframes bt-icon-swap{from{opacity:0;transform:scale(.5) rotate(-30deg)}}
[data-composer-card] button[class*="_primary"] svg{width:14px;height:14px}
[data-composer-card] button[class*="_primary"]:disabled{display:none!important}
/* The shell's statistics pills move to the details panel, so the composer keeps no
   stats row. The slot id is "stats"; this attribute is the fallback that hides it. */
[data-composer-stats]{display:none!important}
/* The whole dock row below the composer holds the shell's stats and its ContextMeter
   (measured: InputBar root's direct child "_dock", 26px tall under a 45px card, text
   "2%"). The :has anchor keeps ds-bot's own docks (members/model/question/secret,
   which render above the composer through the conversation.input.dock slot) intact. */
[class*="_root"]:has(> [data-composer-card])>[class*="_dock"]{display:none!important}
.bt-mic,.bt-voice{flex:none;width:28px;height:28px;border-radius:50%;border:0;padding:0;display:inline-grid;place-items:center;cursor:pointer;transition:background-color .15s ease,color .15s ease,${spring(SPRING_TAP, 'scale')}}
.bt-mic{background:color-mix(in srgb,var(--bt-ink) 5%,transparent);box-shadow:inset 0 0 0 .5px var(--bt-line);color:var(--bt-ink-2)}
.bt-mic:hover{background:color-mix(in srgb,var(--bt-ink) 10%,transparent);color:var(--bt-ink)}
.bt-mic[aria-pressed=true]{background:#ff3e51;color:#fff;animation:bt-mic-pulse 1.4s ease-in-out infinite}
@keyframes bt-mic-pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,62,81,.35)}50%{box-shadow:0 0 0 5px rgba(255,62,81,0)}}
.bt-voice{display:none;background:var(--bt-accent);color:var(--bt-accent-ink,#fff);animation:bt-icon-swap ${SPRING_POP.duration}ms ${SPRING_POP.easing}}
.bt-voice:hover{opacity:.9}
.bt-mic:active,.bt-voice:active{scale:.9}
[data-composer-card]:has(button[class*="_primary"]:disabled) .bt-voice{display:inline-grid}
body[data-bt-room] .bt-voice{display:none!important}
body[data-bt-room] [data-composer-card]:has(button[class*="_primary"]:disabled) .bt-mic:not([aria-pressed=true]){background:var(--bt-accent);color:var(--bt-accent-ink,#fff)}
.bt-mic-note{position:absolute;right:12px;bottom:calc(100% + 8px);padding:5px 10px;border-radius:8px;background:var(--bt-user);color:var(--bt-user-ink);font-size:12px;line-height:16px;white-space:nowrap;pointer-events:none;animation:bt-rise .16s ease-out}
[data-chain-overlay-fallback="conversation.composer"]:has(~ .bt-q){display:block!important;order:2}
.bt-q{order:1}
div:has(> nav [class*="_marks"]){display:none!important}
/* Every user-side bubble (sent, steering mid-turn, not yet admitted, question replies)
   takes its surface and its text from the one --bt-user pair: a skin that repaints
   the host's bubble surface alone would otherwise leave the text unreadable. */
[class*="_userRow"] [class*="_bubble"],[data-chat-flow-kind=question-reply] [class*="_bubble"],[data-chat-flow-kind=command-input] [class*="_bubble"]{background:var(--bt-user)!important;color:var(--bt-user-ink)!important;border-radius:18px!important;padding:7px 12px!important;font-size:var(--dsh-content-font-size,14px)!important;line-height:calc(var(--dsh-content-font-size,14px) + 8px)!important}
[class*="_userRow"] [class*="_bubble"] [class*="_markdown"],[class*="_userRow"] [class*="_bubble"] a{color:inherit}
/* Sent messages get the hover toolbar below; steering and unsent bubbles keep none. */
[class*="_userRow"] [class*="_actions"]{display:none!important}
[data-chat-flow-kind=user] [class*="_userRow"]{flex-direction:row-reverse;align-items:center;justify-content:flex-start}
[data-chat-flow-kind=user] [class*="_actions"]{display:flex!important;height:24px!important;gap:2px!important;opacity:0!important;visibility:hidden;transition:opacity .12s ease,visibility .12s!important;flex:none}
[data-chat-flow-kind=user] [class*="_userRow"]:hover [class*="_actions"],[data-chat-flow-kind=user] [class*="_userRow"]:focus-within [class*="_actions"]{opacity:1!important;visibility:visible}
[data-chat-flow-kind=user] [class*="_actions"] [class*="_timeStart"]{display:none}
[data-chat-flow-kind=user] [class*="_actions"] button{width:24px;height:24px;border-radius:6px;color:var(--bt-ink-2)}
[data-chat-flow-kind=user] [class*="_actions"] button:hover{background:var(--bt-hover);color:var(--bt-ink)}
[data-chat-flow-kind=user] [class*="_actions"] svg{width:15px;height:15px}
.bt-q-inline{display:flex;margin:4px 0 6px}
[data-chat-flow-kind=assistant-step]+[data-step-process]:has(.bt-q-inline){margin-top:0!important}
[data-chat-flow-kind=question-reply]:has(.bt-q-inline),[data-chat-group-key]:has([data-chat-flow-kind=question-reply] .bt-q-inline),[data-chat-group-key]:has(.bt-q-gone){margin-top:0!important}
.bt-q-inline .bt-q{margin:0;max-width:min(550px,86%);order:0}
.bt-q-dock{width:100%;display:flex;justify-content:center}
.bt-q-dock .bt-q{margin:0 auto 8px}
[class*="_toBottomSlot"]{justify-content:center!important;padding-right:0!important}
[data-conversation-scroll] [class*="_toBottomSlot"]{bottom:calc(var(--dsh-composer-height,152px) + 8px)!important}
[class*="_toBottomSlot"]>button{width:36px!important;height:36px!important;margin-top:-36px!important;background:var(--bt-main)!important;color:var(--bt-ink)!important;box-shadow:0 0 0 .5px var(--bt-line-2),0 2px 8px -2px rgba(0,0,0,.12)!important;animation:bt-tobottom-in ${SPRING_TAP.duration}ms ${SPRING_TAP.easing},bt-veil-in .16s ease-out;transition:background-color .12s ease,${spring(SPRING_TAP, 'scale')}}
[class*="_toBottomSlot"]>button:active{scale:.9}
[class*="_toBottomSlot"]>button:hover{background:color-mix(in srgb,var(--bt-ink) 4%,var(--bt-main))!important}
[class*="_toBottomSlot"]>button svg{display:none}
[class*="_toBottomSlot"]>button::before{content:"";width:20px;height:20px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 4v12M5 11l5 5 5-5'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 4v12M5 11l5 5 5-5'/%3E%3C/svg%3E") center/contain no-repeat}
@keyframes bt-tobottom-in{from{translate:0 8px;scale:.8}}
[data-bt-news] [class*="_toBottomSlot"]>button{visibility:hidden!important;pointer-events:none!important}
.bt-news{position:fixed;z-index:30;transform:translateX(-50%);display:inline-flex;align-items:center;overflow:hidden;border-radius:999px;background:#0c64c1;color:#fcfcfc;box-shadow:inset 0 0 0 1px rgba(20,20,20,.05),0 1px 3px 0 rgba(0,0,0,.12);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;animation:bt-news-in ${SPRING_TAP.duration}ms ${SPRING_TAP.easing},bt-veil-in .16s ease-out}
@keyframes bt-news-in{from{translate:0 8px;scale:.9}}
.bt-news[data-direction=up]{animation-name:bt-news-in-up,bt-veil-in}
@keyframes bt-news-in-up{from{translate:0 -8px;scale:.9}}
.bt-news-jump{display:inline-flex;align-items:center;gap:2px;margin:0;padding:4px 26px 4px 4px;border:0;border-radius:0;background:transparent;color:inherit;font:inherit;font-size:13px;line-height:18px;white-space:nowrap;cursor:pointer;outline:none}
.bt-news-ico{flex:none;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px}
.bt-news-ico svg{width:16px;height:16px}
.bt-news-x{position:absolute;right:4px;top:50%;z-index:1;transform:translateY(-50%);width:20px;height:20px;padding:0;border:0;border-radius:999px;background:transparent;color:inherit;opacity:.75;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.bt-news-x svg{width:12px;height:12px}
.bt-news-x:hover{opacity:1;background:rgba(20,20,20,.5)}
@media (prefers-reduced-motion:reduce){.bt-news,[class*="_toBottomSlot"]>button{animation:none}}
.bt-new-sep{display:flex;align-items:center;gap:8px;margin:14px 0 8px;padding:2px 0;font-size:11px;line-height:14px;font-weight:500;letter-spacing:.02em;text-transform:uppercase;color:#0c64c1;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
.bt-new-sep::before,.bt-new-sep::after{content:"";flex:1;height:1px;background:color-mix(in srgb,#0c64c1 20%,transparent)}
.bt-open-new{display:flex;flex-direction:column}
.bt-open-new .bt-new-sep{margin:18px 0 0}
.bt-open-new .bt-time-sep{height:16px;margin:32px 0 2px}
.bt-earlier{display:flex;flex-direction:column;gap:6px}
.bt-earlier-top{display:flex;justify-content:center;align-items:center;height:34px;flex:none}
.bt-earlier-top .bt-soft{height:28px;font-size:12px;padding:0 12px}
.bt-urow{display:flex;justify-content:flex-end}
.bt-ububble{max-width:var(--bt-bubble-max);background:var(--bt-user);color:var(--bt-user-ink);border-radius:18px;padding:7px 12px;font-size:14px;line-height:20px;box-sizing:border-box;overflow-wrap:anywhere}
.bt-ububble [class*="_markdown"],.bt-ububble a{color:inherit!important}
.bt-ububble p{margin:0;line-height:22px}
.bt-uimages{display:block;font-size:12px;opacity:.7}
.bt-earlier .bt-event{margin:4px 0}
.bt-part-line{display:flex;align-items:center;gap:10px;margin:10px 0 6px;font-size:11px;line-height:14px;color:var(--bt-ink-3)}
.bt-part-line::before,.bt-part-line::after{content:"";flex:1;height:1px;background:var(--bt-line)}
`

// -------------------------------------------------------------------------

export function installStyles(text, tag) {
  const style = document.createElement('style')
  style.dataset.dshBot = tag
  style.textContent = text
  document.head.appendChild(style)
  return style
}

// Shell chrome only exposes hashed CSS-module classes (`hem6sG_footArea`,
// `_bubble_12mhf_1`), so the overrides above match on name fragments. Substring
// attribute selectors bypass the style engine's class index, and ~20 of them made
// every style recalc about ten times slower. Rewrite each one into the exact class
// names defined by the loaded stylesheets; keep the substring form when none match.
const FRAGMENT_SELECTOR = /\[class\*="(_[\w-]+)"\]/g
const CLASS_TOKEN = /\.((?:\\.|[\w-])+)/g

function sheetClassNames(sheet) {
  const names = []
  const visit = (rules) => {
    for (const rule of rules) {
      if (rule.selectorText) for (const match of rule.selectorText.matchAll(CLASS_TOKEN)) names.push(match[1])
      if (rule.cssRules) visit(rule.cssRules)
    }
  }
  try { visit(sheet.cssRules) } catch { /* cross-origin sheet */ }
  return names
}

function compileFragmentSelectors(text, names) {
  const compiled = new Map()
  return text.replace(FRAGMENT_SELECTOR, (whole, fragment) => {
    if (!compiled.has(fragment)) {
      const exact = []
      for (const name of names) if (name.includes(fragment)) exact.push(`.${name}`)
      compiled.set(fragment, exact.length ? `:is(${exact.join(',')})` : whole)
    }
    return compiled.get(fragment)
  })
}

export function installCompiledStyles(text, tag) {
  const style = installStyles('', tag)
  const cache = new WeakMap()
  const render = () => {
    const names = new Set()
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode?.dataset?.dshBot) continue
      let list = cache.get(sheet)
      if (!list) { list = sheetClassNames(sheet); cache.set(sheet, list) }
      for (const name of list) names.add(name)
    }
    const next = compileFragmentSelectors(text, names)
    if (style.textContent !== next) style.textContent = next
  }
  render()
  // Lazily loaded shell features append their own sheets later.
  let timer
  const schedule = () => { clearTimeout(timer); timer = setTimeout(render, 120) }
  const onLoad = (event) => { if (event.target instanceof HTMLLinkElement) schedule() }
  const observer = new MutationObserver(schedule)
  observer.observe(document.head, { childList: true })
  document.addEventListener('load', onLoad, true)
  return () => {
    observer.disconnect()
    document.removeEventListener('load', onLoad, true)
    clearTimeout(timer)
    style.remove()
  }
}
