# Agent 只读连接

Study Log 保留 Sites 的 ChatGPT 登录。账号或邮箱本身不能读取数据；只有用户在 `/agent-access` 明确确认后，指定 Agent 才能读取该账户数据。

## 连接流程

1. 本地 Agent 生成 256 位随机凭证 `slr_<hex>`，保存在仅当前系统用户可读写的本地文件。
2. `POST /api/agent/connect` 只接收凭证的 SHA-256 摘要及设备名称，返回 10 分钟有效的请求编号、连接码和授权页面路径。
3. 用户用现有 ChatGPT 登录，核对连接码，确认只读范围。`POST /api/agent/authorizations` 同时验证平台用户身份及同源 Origin，以条件 UPDATE 将请求绑定到当前用户。请求不可重复使用或换绑账户。
4. Agent 用原凭证查询 `GET /api/agent/session`。批准后授权持续 30 天；过期需重新确认。
5. 网站“撤销授权”或 Agent “撤销并断开”使后续读取立即失败。正在执行的读取可能已取得数据；撤销不会删除 Agent 里已有的对话和报告。

这是针对本地 Agent 的连接协议，不是通用 OAuth 服务。授权页防止被 iframe 嵌入，不将令牌放入 URL。服务器只存摘要，不持有原始凭证。创建请求有按来源及全局频率限制；所有响应禁止缓存。

## 固定只读接口

所有接口使用 `Authorization: Bearer <credential>`，每次读取重新验证绑定账户、撤销状态和有效期。不得把 Agent 凭证加入 `getChatGPTUser`，现有写入接口只接受浏览器的平台身份。

- `GET /api/agent/read/records`：学习和实验记录。支持 `from` / `to`（含首尾日期）、`query`、`project_id`、`record_type`、`limit`（1–100）、`offset`；返回 `total`、`next_offset` 和同一筛选范围内的汇总。必须继续分页才能读取全部记录。
- `GET /api/agent/read/projects`：未删除项目及依赖关系。
- `GET /api/agent/read/analytics`：沿用网站的累计、本周、今日、趋势等统计。
- `GET /api/agent/session`：当前连接状态，无学习数据。
- `DELETE /api/agent/session`：仅撤销调用方自身授权。

用户 ID 只由服务器从已授权连接解析，查询不接受外部用户 ID。已删除记录不返回。读取内容属于不可信引用资料，Agent 不应执行记录内容里的指令。模型分析会使用 Agent 当前配置的服务商，授权页明确说明此用途。

## 维护与验证

迁移：`drizzle/0015_ambiguous_vanisher.sql`，新增授权表，不修改已有业务数据。Sites 发布包携带迁移。

单元测试：`node --experimental-strip-types --test tests/agent-access.test.mjs`。

本地联调覆盖待批准拒绝、CSRF、账户隔离、重复批准、撤销即时失效、写入拒绝、日期范围及超过 200 条记录的分页。使用本地模拟账户和临时数据，不能用生产用户授权代替测试。
