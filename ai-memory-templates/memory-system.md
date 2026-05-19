# memory-system.md

这是 Morpheus AI 记忆系统说明。

文件分层：

- `soul.md`：AI 自身人格、原则、长期工作边界
- `user.md`：用户画像、偏好、长期主题
- `daily/*.md`：按天记录互动摘要、结论与动作

运行规则：

- 每次 AI 对话结束后，自动向当日日志追加一条记忆
- 这些记忆进入应用主数据，并随同步一起保存
- Markdown 镜像会把这套记忆输出到 `morph_md_mirror/ai-memory/`

