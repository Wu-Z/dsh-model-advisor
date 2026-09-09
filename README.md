# dsh-model-advisor

<div align="center">

**DeepSeek Harness 模型顾问插件** — 左下角固定显示账户余额，点开查看各模型擅长的领域与 API 费用。

MIT · [GitHub](https://github.com/Wu-Z/dsh-model-advisor)

</div>

---

## 它做什么

| 位置 | 内容 |
|---|---|
| 侧边栏左下角（设置按钮上方） | 两段独立控件：点 `余额：¥45` **刷新余额**，点右侧 `▸` **打开面板** |
| 面板 · 余额区 | 当前模型所在渠道的账户余额（总额 / 赠送 / 充值）、来源与更新时间 |
| 面板 · 余额未知 | 渠道没有余额接口时（如 Kimi / Moonshot）显示安静的「余额未知」+ 小字说明，不把原因当金额渲染 |
| 面板 · 模型列表 | 三列紧凑表格：**模型 / 擅长 / 价格**（560px，桌面优先）；已配置模型置顶，下面接可搜索的全库模型 |
| 面板 · 筛选 | **擅长** 6 个标签 + **模态** 6 项，均可多选：组内 OR、组间 AND；命中在全库（7612 条）里查 |
| 面板 · 排序 | 默认 / 价格（点一下在 ↑↓ 之间切换）/ 最新；无价格的模型始终排在最后 |
| 面板 · API 费用 | 每百万 token 的输入 / 输出价格，USD / CNY 分段开关切换；DeepSeek 显示官方峰谷两档价并标出当前档位 |
| 面板 · 数据来源 | 页脚常驻一行：**余额来源**（跟着当前模型走）+ **模型列表来源**（models.dev） |
| 刷新 | **余额每 5 分钟自动刷新**（间隔可配），页面隐藏时暂停、切回立即刷新；模型目录按需拉取（展开面板 / 搜索 / 筛选时才查），无目录轮询 |

## 安装

```bash
dsh plugin --profile web add dsh-model-advisor
```

npm 包内含构建好的 `lib/`，**安装时不执行任何构建脚本**（pnpm 11 默认拦截依赖的 build 脚本，所以这一点很重要）。

从源码构建：

```bash
git clone https://github.com/Wu-Z/dsh-model-advisor.git
cd dsh-model-advisor
npm install && npm run build
dsh plugin --profile web add /absolute/path/to/dsh-model-advisor
```

安装后**重启 `dsh web`**：新增 bundle 属于 profile 组合变更，`patchReload: live` 只热重载用户 patch 文件，不会重读 bundles 列表。

> ⚠️ 不要用 `dsh plugin add github:Wu-Z/dsh-model-advisor`。pnpm 11 会因 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` 拒绝安装——本仓库不提交 `lib/`，而 git 依赖的构建脚本默认被拦。

## 数据来源

| 数据 | 来源 | 刷新 |
|---|---|---|
| 模型能力与价格 | <https://models.dev/api.json>（200+ 渠道、7600+ 条目） | Host 侧裁剪后缓存 6 小时 |
| 账户余额 | `GET https://api.deepseek.com/user/balance`，密钥取自 DSH 凭据库的 `DEEPSEEK_API_KEY` | 缓存 5 分钟；点余额即刷新 |
| DeepSeek 峰谷价 | 官方定价页（中英两版 HTML） | 缓存 6 小时，失败回退内置表 |
| USD → CNY 汇率 | <https://open.er-api.com/v6/latest/USD> | 缓存 12 小时，失败回退配置值 |

密钥只在 Host 进程内使用，绝不下发浏览器。

### 余额怎么更新

- **每 5 分钟自动刷新一次**（`balanceRefreshMinutes` 可配，范围 1 分钟–24 小时）；
- 点左下角的余额文字可**立即刷新**；
- 浏览器标签页隐藏时暂停轮询，切回来自动刷新一次再继续——避免后台空跑；
- 余额是唯一会定期请求的数据；**模型目录仍然只在展开面板、搜索或筛选时才查**。

一轮刷新只发一次请求（约百字节），Host 侧还有 5 分钟缓存兜底，所以不会打爆接口。

## 价格口径

### 渠道优先

models.dev 汇总了 200+ 个渠道，**同一个模型在不同渠道价格不同**（例如 Claude Sonnet 4.6 官方 $3/$15，某中转可能更高）。插件按「你实际接入的渠道」定价：

1. **已配置模型**先按接入渠道取价——provider id 能对上就用该渠道；对不上则用 `llm-pi-ai.providers.<id>.baseURL` 的主机名匹配（如 `openrouter.ai` → OpenRouter 渠道）；
2. 该渠道未收录这个模型时，回退到模型拥有方的挂牌价，并在价格下方标注「该渠道未收录，按挂牌价」；
3. 每行显示价格所属的 provider；配置的渠道名与价格渠道不同时，额外显示「渠道 <你的名字>」；
4. 未配置的模型（全库搜索）显示拥有方挂牌价，便于横向比较；
5. 同名模型只显示一行，优先模型拥有方；搜索忽略标点与厂商前缀差异（`claude-fable-5.1`、`anthropic:claude-sonnet-4` 都能正确归并）；
6. 搜索排序在得分相同时优先官方渠道、再按发布时间倒序，所以搜 `claude-sonnet` 首条是最新的官方 Sonnet，而不是某中转商的旧条目。

### 价格缺失的四种状态

上游有 1047 条没有按 token 计费的价格（订阅套餐、网关未标注、免费变体）。一律显示「未标价」会丢掉一半可用信息，所以按**原因**分类：

| 状态 | 判定 | 显示 | 条数 |
|---|---|---|---|
| `listed` | 本渠道有价 | 正常价格 | 6565 |
| `reference` | 本渠道无价，但同名模型在别的渠道有价 | 该价 + 小字「参考 Morph 挂牌价」 | 536 |
| `plan` | 订阅/套餐渠道（`*-token-plan`、`*-coding-plan`、`gitlab`、`opencode` 等） | 「套餐内」 | 98 |
| `free` | 模型 id 以 `:free` 结尾 | 「免费」 | 58 |
| `unknown` | 其余 | 「未标价」 | 355 |

两条硬规则：

1. **参考价只用于展示**：`cost` 仍为 `null`，因此**不参与价格排序**（沉底），也**不会拿到「高性价比」标签**，避免「参考价便宜 = 性价比高」的误判。
2. **订阅渠道不假装有单价**：全库都没有价的套餐模型显示「套餐内」，不拿别处的挂牌价冒充。

另外，上游有 **612 条把价格记成 `输入=0 且 输出=0`**（多为套餐渠道）——插件一律视为无价，不读作「免费」；否则这些 0 价会被当成最便宜，误拿「高性价比」标签（Wan2.7 Image 系列曾被误标）。

### DeepSeek 峰谷价

models.dev 上 DeepSeek 的价格是**改版前的旧基础价**（v4-flash $0.14/$0.28），比实际低约三倍。插件改为直接解析官方定价页（中英两版），取峰/谷两档：

| 模型 | 谷时 | 峰时 |
|---|---|---|
| deepseek-v4-flash | $0.22 / $0.66 | $0.44 / $1.32 |
| deepseek-v4-pro | $0.66 / $1.98 | $1.32 / $3.96 |

峰时段（**北京时间 / UTC+8**）：

| 北京时间 | 对应 UTC |
|---|---|
| 09:00–12:00 | 01:00–04:00 |
| 14:00–18:00 | 06:00–10:00 |

周六、周日（北京时间）全天按谷价。面板标出当前档位，并按显示币种直接使用官方人民币价（不再靠汇率折算）。官方页取不到时回退内置价格表。

## 擅长标签

「擅长」和「能力」是两件事，面板分开呈现：

| 擅长标签（可筛选） | 官方渠道覆盖率 |
|---|---|
| 代码 Agent | 18% |
| 数学 | 4% |
| 中文写作 | 34% |
| 长文（上下文 ≥ 1M） | 28% |
| 高性价比 | 18% |
| 开放权重 | 39% |

平均每个模型 **1.40 个标签**。规则按语料调过，每个标签落在 4%~39% 的可区分区间。

**能力**（不可筛选，如实陈述，放在行内第二行的悬停提示里）：面向编码 / 带推理 / 支持工具调用 / 支持图像输入 / 上下文长度。

两点设计取舍：

- **不把能力布尔量当擅长标签**。第一版把「工具调用 82%、推理 74%」当成标签，结果平均 4.99 个标签、人人一样——那版是错的，已重做。
- **「高性价比」是相对判断**：在同推理档的模型里取价格最低的四分之一，而不是会随市场漂移的绝对美元阈值。

## 筛选

- **多选语义**：同组内「或」（代码 Agent 或 数学），跨组「且」（且支持图像输入）。标准分面行为。
- **模态**取自 models.dev 的 `modalities.input` / `modalities.output`，输入输出分开命名，避免「能看图」和「能画图」混淆：

| 模态 | 官方渠道覆盖 |
|---|---|
| 图像输入 | 64% |
| PDF 输入 | 28% |
| 视频输入 | 22% |
| 音频输入 | 16% |
| 图像生成（输出） | 6% |
| 音频生成（输出） | 6% |

- 结果上限 40 条，触顶时列表底部提示「只显示前 40 条」。

## 配置

配置存放在 `$DSH_HOME/model-advisor/config.json`，由面板写入：

| 字段 | 默认 | 说明 |
|---|---|---|
| `currency` | `USD` | 面板显示币种，`USD` 或 `CNY` |
| `fxRate` | `7.2` | 实时汇率不可用时的兜底 USD→CNY |
| `balanceRefreshMinutes` | `5` | 余额自动刷新间隔（分钟，1–1440）；页面隐藏时不轮询 |
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
- **图标**：用宿主自己的 `@deepseek-ai/dsh-client-ui-primitives` 图标（搜索 / 刷新 / 关闭 / 箭头），不用字符或 emoji 充当结构图标；图标走 `currentColor`。
- **交互态**：所有可点元素有 hover / active / focus-visible 三态，过渡 120ms；面板进入动画 140ms，`prefers-reduced-motion` 下关闭。
- **状态完备**：首次加载显示骨架行，空结果显示图标 + 文案 + 提示。
- **间距**：4/8/12/16 节奏；价格列 `tabular-nums` 对齐。
- **信息分层**：行内第二行只放厂商 · 上下文（永不截断）；能力与上游定位说明放在悬停提示。

## 开发

```bash
npm install
npm run build      # 产出 lib/index.js、lib/typert.host.js、lib/client.js
npm test           # Host 冒烟 + 浏览器渲染两套测试
npm run prepare    # 发布前自动构建（npm publish 会触发）
```

改动请改 `src/`，`lib/` 是构建产物（已 gitignore）。

测试覆盖：Host 侧 39 项（余额解析、渠道识别、价格状态分类、峰谷价、分面筛选、JSON 安全），浏览器侧 53 项（样式注入、组件渲染、排序、筛选控件、空/错/加载态）。

## 项目结构

```
src/host/
  index.js       插件入口：modelAdvisor 服务、快照组装、按需刷新
  catalog.js     models.dev 拉取、裁剪、缓存、搜索、价格状态分类
  domains.js     擅长标签规则、能力摘要、模态词表
  deepseek.js    官方峰谷定价页解析 + 当前档位判定
  balance.js     DeepSeek 余额 / 自定义端点 / 汇率
  config.js      配置读写与校验
  typert.js      手写 Typert 清单（Remote 注册）
  paths.js       $DSH_HOME 路径解析
src/client/
  index.jsx      注册样式、字典、Remote 贡献与 sidebar.footer.action 席位
  Corner.jsx     左下角余额 + 打开面板按钮
  Panel.jsx      三列表格面板（搜索 / 筛选 / 排序 / 价格状态）
  store.js       浏览器侧状态与 Remote 调用
  sort.js        排序逻辑（可单测）
  format.js      金额 / 价格 / token / 时间格式化、峰谷档位
  styles.js      注入式样式表
  locales.js     中英文字典
  remote.js      Remote 客户端贡献（与 Host 清单对齐）
src/shared/wire.js 两端共用的 zod 线协议 schema
scripts/           构建与两套测试
lib/               构建产物（gitignore）
```

## 已知边界

- 外部目录未收录的模型（如内测版 `deepseek-v4.1-flash-expires-on-0910`）如果已配置，仍会列出并标注「本地」，价格显示「未标价」。
- 只展示列表价，不统计本会话实际花费（不做账本）。
- 不注册模型可调用工具，纯 Web UI。
- 余额接口目前只对接 DeepSeek 官方；其他渠道要么走自定义端点，要么显示「余额未知」。
- 参考价取自同名模型在别处的挂牌价，不是该渠道真价。

## 许可证

[MIT](LICENSE)
