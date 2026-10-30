# patches

- 用户已确认全站圆角统一用标准圆弧：ds-bot 补丁在 html:root 上把 --dsw-corner-shape 从 superellipse(1.5) 改为 round（变量传递、不用 !important、不改 border-radius 数值），补丁随之增至 24 hunk。 [source: group "DS-Bot 非侵入二开" 10-29 19:27; added: 2026-10-29]
- ds-bot 补丁纪律新增：styles.js 的 CSS 在模板字符串里，注释必须写 /* */，写 // 会变成非法选择器并把紧随其后的一条规则一起吞掉。 [source: group "DS-Bot 非侵入二开" 10-29 20:33; added: 2026-10-29]
- 基线退回 3e84754 后，补丁与台账已重生成：48 hunk / 15 文件 / 65,937 B，仍从 4a7b550 起算，排除 client.js 与 gaze.js；hunks.md 48 行与 hunk 一致，双向 apply --check 通过，patch-conflict-check.sh 4a7b550 输出 clean。 [source: group "DS-Bot 非侵入二开" 10-30 01:48; added: 2026-10-30]
