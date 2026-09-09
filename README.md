# dsh-model-advisor

<div align="center">

**DeepSeek Harness 模型顾问插件** — 左下角固定显示账户余额，点开查看各模型擅长的领域、API 费用与配置链接。

</div>

---

## 它做什么

| 位置 | 内容 |
|---|---|
| 侧边栏左下角（设置按钮上方） | 两段独立控件：点 `余额：¥45` **刷新余额**，点右侧 `▸` **打开面板**（无图标） |
| 面板 · 余额区 | DeepSeek 官方余额（总额 / 赠送 / 充值）、来源与更新时间 |
| 面板 · 模型列表 | 三列紧凑表格：**模型 / 擅长 / 价格**（560px，桌面优先）；已配置模型置顶，下面接可搜索的全库模型 |
| 面板 · 排序 | 默认 / 价格（点一下在 ↑↓ 之间切换）/ 最新；无价格的模型始终排在最后 |
| 面板 · 筛选 | **擅长**（代码 Agent / 数学 / 中文写作 / 长文 / 高性价比 / 开放权重）+ **模态**（图像输入 / PDF 输入 / 视频输入 / 音频输入 / 图像生成 / 音频生成）两组，**可多选**：组内 OR、组间 AND；命中在全库（7612 条）里查，不受当前页限制；有筛选时显示「清除筛选」 |
| 面板 · API 费用 | 每百万 token 的输入 / 输出价格，USD / CNY 分段开关切换；DeepSeek 显示官方峰谷两档价并标出当前档位 |
| 面板 · 余额未知 | 当前模型的渠道没有余额接口时（如 Kimi / Moonshot），余额区显示安静的「余额未知」+ 小字说明「该渠道未提供余额接口」，不把原因当金额渲染、也不重复两遍 |
| 面板 · 数据来源 | 页脚常驻一行：**余额来源**（跟着当前模型走——模型在 DeepSeek 渠道就标 DeepSeek 官方余额接口，其他渠道显示「当前渠道未提供余额接口」，不会拿别家的数字充数）+ **模型列表来源**（models.dev），都可点开 |
| 面板 · 配置链接 | 每个模型给「控制台」（拿 API Key）与「定价 / 文档」外链，底部给「打开 settings.yaml」 |
| 刷新 | 仅按需：展开面板或点「刷新」时请求，无后台轮询 |

## 数据来源

- **模型能力与价格**：<https://models.dev/api.json>（实时拉取，Host 侧裁剪并缓存 6 小时）
- **余额**：`GET https://api.deepseek.com/user/balance`，密钥取自 DSH 凭据库的 `DEEPSEEK_API_KEY`
- **汇率**：<https://open.er-api.com/v6/latest/USD>（实时，失败回退配置里的固定值）

密钥只在 Host 进程内使用，绝不下发浏览器。

### 筛选怎么算的

- **多选语义**：同组内「或」（代码 Agent 或 数学），跨组「且」（且支持图像输入）。这是标准分面行为。
- **模态**取自 models.dev 的 `modalities.input` / `modalities.output`，输入输出分开命名，避免「能看图」和「能画图」混淆。
- 结果上限 40 条，触顶时列表底部会提示「只显示前 40 条」。

### 擅长领域怎么来的

「擅长」和「能力」是两件事，面板分开呈现：

- **标签**（可筛选）只留有区分度的 5 个：代码 Agent / 数学 / 中文写作 / 长文 / 高性价比。规则按语料调过，每个标签覆盖 4%~34% 的模型；平均每个模型 0.98 个标签。
- **能力**（不可筛选，如实陈述）：面向编码 / 带推理 / 支持工具调用 / 支持图像输入 / 上下文长度 / 开放权重。

第一版把能力布尔量（工具调用 82%、推理 74%）当成了「擅长标签」，结果平均每个模型 4.99 个标签、人人一样——那版是错的，已重做。

「高性价比」是**相对**判断：在同推理档的模型里取价格最低的四分之一，而不是一个会随市场漂移的绝对美元阈值。

### 价格缺失怎么处理

models.dev 有 1047 条没有按 token 计费的价格（订阅套餐、网关未标注、免费变体）。一律显示「未标价」会丢掉一半可用信息，所以按**原因**分四种状态：

| 状态 | 判定 | 显示 |
|---|---|---|
| `listed` | 本渠道有价 | 正常价格（6565 条） |
| `reference` | 本渠道无价，但同名模型在别的渠道有价 | 显示该价 + 小字「参考 Morph 挂牌价」（536 条） |
| `plan` | 订阅/套餐渠道（`*-token-plan`、`*-coding-plan`、`gitlab`、`opencode` 等） | 「套餐内」（98 条） |
| `free` | 模型 id 以 `:free` 结尾 | 「免费」（58 条） |
| `unknown` | 其余 | 「未标价」（355 条） |

两条硬规则：

1. **参考价只用于展示**，`cost` 仍为 `null` —— 因此它**不参与价格排序**（排序时沉底），也**不会拿到「高性价比」标签**，避免「参考价便宜 = 性价比高」的误判。
2. **订阅渠道不假装有单价**：全库都没有价的套餐模型显示「套餐内」，而不是拿别处的挂牌价冒充。

另外，`输入=0 且 输出=0`（612 条，多为套餐渠道）一律视为无价，不读作「免费」——此前 Wan2.7 Image 系列就被 0 价误标过「高性价比」。

### DeepSeek 峰谷价

models.dev 上 DeepSeek 的价格是**改版前的旧基础价**（v4-flash $0.14/$0.28），比实际低约三倍。插件改为直接解析官方定价页（中英两版），取峰/谷两档：

| 模型 | 谷时 | 峰时 |
|---|---|---|
| deepseek-v4-flash | $0.22 / $0.66 | $0.44 / $1.32 |
| deepseek-v4-pro | $0.66 / $1.98 | $1.32 / $3.96 |

峰时段为 UTC 01:00–04:00、06:00–10:00；北京时间周末全天按谷价。面板标出当前档位，并按显示币种直接使用官方人民币价（不再靠汇率折算）。官方页取不到时回退内置价格表。

### 价格口径

models.dev 汇总了 200+ 个渠道，**同一个模型在不同渠道价格不同**（例如 Claude Sonnet 4.6 官方 $3/$15，某中转可能更高）。插件按「你实际接入的渠道」定价：

1. **已配置模型**先按你配置的接入渠道取价——provider id 能对上就用该渠道；对不上则用 `llm-pi-ai.providers.<id>.baseURL` 的主机名匹配（如 `openrouter.ai` → OpenRouter 渠道）；
2. 该渠道未收录这个模型时，回退到模型拥有方的挂牌价，并在价格下方标注「该渠道未收录，按挂牌价」；
3. 每行显示价格所属的 provider；配置的渠道名与价格渠道不同时，额外显示「渠道 <你的名字>」；
4. 未配置的模型（全库搜索）显示拥有方挂牌价，便于横向比较；
5. 同名模型只显示一行，优先模型拥有方；搜索忽略标点与厂商前缀差异（`claude-fable-5.1`、`anthropic:claude-sonnet-4` 都能正确归并）；
6. 搜索排序在得分相同时优先官方渠道、再按发布时间倒序，所以搜 `claude-sonnet` 首条是最新的官方 Sonnet，而不是某中转商的旧条目。

## 安装

```bash
# 从 GitHub 安装（安装时自动构建 lib/）
dsh plugin --profile web add github:Wu-Z/dsh-model-advisor

# 或从本地目录安装
dsh plugin --profile web add /path/to/dsh-model-advisor
```

安装后**重启 `dsh web`**：新增 bundle 属于 profile 组合变更，`patchReload: live` 只热重载用户 patch 文件，不会重读 bundles 列表。

## 配置

配置存放在 `$DSH_HOME/model-advisor/config.json`，由面板写入：

| 字段 | 默认 | 说明 |
|---|---|---|
| `currency` | `USD` | 面板显示币种，`USD` 或 `CNY` |
| `fxRate` | `7.2` | 实时汇率不可用时的兜底 USD→CNY |
| `balanceRefreshMinutes` | `5` | 余额缓存有效期 |
| `catalogTtlHours` | `6` | models.dev 缓存有效期 |
| `customBalance` | 关闭 | 自定义余额端点：`url` / `method` / `headerName` / `credentialRef` / `path`（点路径，如 `data.total_available`）/ `currency` |

自定义余额端点示例（NewApi 风格）：

```json
{
  "customBalance": {
    "enabled": true,
    "url": "https://gateway.example/api/usage/token",
    "method": "GET",
    "headerName": "Authorization",
    "credentialRef": "GATEWAY_API_KEY",
    "path": "data.total_available",
    "currency": "USD"
  }
}
```

## 视觉规范

界面完全跟随 DSH 主题令牌，浅色/深色模式同一套规则：

- **样式注入**：`src/client/styles.js` 注入一份 `<style data-plugin data-plugin-css>`，不用内联样式——内联无法表达 hover / active / focus-visible / 过渡 / 滚动条。
- **颜色**：只用 `--dsw-alias-*` 语义令牌（`bg-layer-*` / `label-*` / `border-l2` / `interactive-bg-hover` / `brand-primary` / `scrollbar-*`），不硬编码 hex；fallback 仅在令牌缺失时生效。
- **图标**：用宿主自己的 `@deepseek-ai/dsh-client-ui-primitives` 图标（搜索/刷新/关闭/箭头），不用字符或 emoji 充当结构图标；图标走 `currentColor`，颜色随令牌。
- **交互态**：所有可点元素有 hover / active / focus-visible 三态，过渡 120ms；面板进入动画 140ms，且 `prefers-reduced-motion` 下关闭。
- **状态完备**：首次加载显示骨架行，空结果显示图标 + 文案 + 提示，错误显示在余额区与页脚。
- **间距**：4/8/12/16 节奏；价格列 `tabular-nums` 对齐。
- **信息分层**：行内第二行只放厂商 · 上下文（永不截断）；能力（面向编码 / 带推理 / 工具调用 / 图像 / 开放权重）与上游定位说明放在**悬停 tooltip**，避免长文本被省略号切掉。

## 开发

```bash
npm install
npm run build     # 产出 lib/index.js、lib/typert.host.js、lib/client.js
node scripts/smoke.mjs
```

`lib/` 是构建产物，改动请改 `src/`。

## 结构

```
src/host/      Host 半：余额、汇率、models.dev 拉取与缓存、Typert 服务
src/client/    浏览器半：左下角元素、popover 面板、Remote 客户端贡献
src/shared/    两端共用的 zod 线协议 schema
lib/           构建产物
```

## 已知边界

- 外部目录未收录的模型（如内测版 `deepseek-v4.1-flash-expires-on-0910`）如果已配置，仍会列出，标注「本地」，价格显示「价格未知」。
- 只展示列表价，不统计本会话实际花费（不做账本）。
- 不注册模型可调用工具，纯 Web UI。
