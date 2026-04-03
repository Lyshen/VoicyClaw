# VoicyClaw Usage / Allowance / Billing Foundation

## 背景

VoicyClaw 现在已经具备下面这些能力：

- `workspace / project / platform key` 的基础对象模型已经存在
- hosted onboarding 已经能为新用户自动准备 starter workspace、starter project、starter key
- 多家 TTS 供应商已经接入，主链路可以真实跑通
- Studio / OpenClaw connector / 本地 mock bot 都已经形成可体验的产品闭环

下一步的核心问题不再是“能不能发声”，而是：

- 系统如何记录每次 TTS 调用的真实 usage
- starter 免费额度如何真正落地，而不是只显示文案
- 多供应商的成本和对用户的内部计价，如何通过统一换算层表达
- 后续接 payment 时，如何不推翻现在的业务模型

这份设计文档只解决 **usage / allowance / billing foundation**，**不包含 payment**。

## 目标

本分支要完成的目标：

1. 把 TTS 调用记录成可追溯的 usage event
2. 让 starter allowance 从“文案”变成真实的余额和消耗
3. 建立 provider -> 内部 credits 的换算层
4. 为未来 payment、entitlement、套餐体系留出稳定接口

## 非目标

本次不做：

- Stripe / 支付宝 / 微信 / Paddle 等支付接入
- 发票、充值、订阅管理
- 团队级 entitlement 规则
- 完整账单页面
- 全量覆盖 ASR / LLM / plugin usage

本次只先把 **server-owned TTS** 的 usage / allowance / billing 地基打好。

## 概念定义

### Usage

记录事实消耗。

例子：

- 哪个 workspace
- 哪个 project
- 哪个 provider
- 一次 TTS 请求是否成功
- 输入了多少字符
- 输出了多少音频时长

### Allowance

记录“还能免费用多少”。

例子：

- starter workspace 默认送多少 preview credits
- 当前 workspace 还剩多少 credits
- 成功的 TTS usage 是否消耗 credits

### Billing

记录“应该按什么内部规则换算”。

例子：

- `google-tts` 每 1,000,000 input chars 对应多少内部 credits
- `azure-streaming-tts` 用哪个 metric 计价
- 是否保留 supplier cost estimate

### Payment

记录“钱怎么收进来”。

本次不做。

## 当前代码基础

当前代码里已经有很适合落这层设计的基础：

- `apps/server/src/db.ts`
  - 已有 `users / workspaces / projects / platform_keys / bot_registrations`
- `apps/server/src/hosted-resources.ts`
  - 已有 starter workspace / project / key 的自动初始化入口
- `apps/server/src/realtime-utterance-pipeline.ts`
  - 已有 server-owned TTS 的统一出口，适合插 usage metering
- `apps/server/src/tts-provider.ts`
  - 已有明确的 provider id，适合挂 rate card

也就是说，owner 维度已经有，调用链路也已经明确，现在只差把 usage / allowance / billing 模型补齐。

## 设计原则

### 1. 事实记录和计费规则分开

- usage event 记录事实
- billing rate 记录换算规则
- allowance ledger 记录余额变动

三者不能混成一张表。

### 2. 只对 server-owned TTS 计量

本次只记录：

- `ttsMode === "server"` 的调用

不记录：

- browser TTS
- browser SpeechSynthesis

因为浏览器路径不消耗 VoicyClaw server 资源，也不适合作为平台计费基础。

### 3. 失败调用也记录，但默认不扣 allowance

失败调用仍然是重要事实，必须入账。

但 V1 默认策略是：

- `failed` usage event：记录
- allowance：不扣
- charged credits：记为 `0`

未来如果要做“部分失败也扣费”的策略，再单独扩展。

### 4. 先做内部 credits，不直接等同于 payment

V1 先统一成内部 credits。

这样后续无论接：

- 预充值
- 月账单
- 套餐
- 企业合同价

都不需要推翻 usage 和 billing 基础模型。

## V1 计量范围

V1 只覆盖一类 usage：

- `feature = "tts"`

记录字段重点：

- `providerId`
- `status`
- `inputChars`
- `outputAudioMs`
- `outputAudioBytes`
- `workspaceId`
- `projectId`
- `channelId`
- `requestId / utteranceId`
- `chargedCredits`
- `estimatedProviderCost`

## Credit 模型

### 内部结算单位

系统引入统一内部单位：

- `voice credits`

为了避免小请求四舍五入过粗，存储层使用：

- `creditsMillis`

也就是：

- `1 credit = 1000 creditsMillis`

### 设计原因

- 小段文本 TTS 也能精细计量
- SQLite 中继续用整数，不引入浮点精度问题
- 后续 UI 再把 `creditsMillis` 格式化成人类可读的 `credits`

## 数据模型

### 1. `billing_rates`

存“换算规则”。

建议字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `feature` | 当前先固定为 `tts` |
| `provider_id` | 如 `google-tts` / `azure-tts` / `tencent-streaming-tts` |
| `billing_metric` | 当前支持 `input_chars`，后续可扩展 `output_audio_ms` / `tokens` |
| `unit_size` | 一个计价块包含多少单位，例如 `1_000_000` chars |
| `retail_credits_millis` | 每个计价块对应多少内部 creditsMillis |
| `provider_cost_usd_micros` | 可选，估算 supplier 原始成本 |
| `is_active` | 当前是否启用 |
| `created_at` / `updated_at` | 时间戳 |

说明：

- `retail_credits_millis` 是系统面对用户的内部换算
- `provider_cost_usd_micros` 是面向内部成本分析的可选字段
- 二者故意分开，后续可以独立调价

### 2. `usage_events`

存“事实调用记录”。

建议字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `workspace_id` | 可空；找不到 owner 时允许为空 |
| `project_id` | 可空 |
| `channel_id` | 所属 channel |
| `request_id` | 对应 utteranceId |
| `feature` | 当前为 `tts` |
| `provider_id` | TTS provider |
| `status` | `succeeded` / `failed` |
| `input_chars` | 输入到 TTS 的文本字符数 |
| `output_audio_bytes` | 实际输出音频字节数 |
| `output_audio_ms` | 实际输出音频毫秒数 |
| `billing_rate_id` | 命中的 rate card |
| `charged_credits_millis` | 对用户扣减的 credits |
| `estimated_provider_cost_usd_micros` | 对供应商成本的估算，可空 |
| `error_message` | 失败时记录 |
| `created_at` | 时间戳 |

说明：

- `usage_events` 是审计事实表
- 不要在这里直接存“剩余额度”
- 不要在这里直接存 payment 状态

### 3. `workspace_allowance_ledger`

存“额度发放和消耗”。

建议字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 主键 |
| `workspace_id` | 所属 workspace |
| `entry_type` | `grant` / `usage` / `adjustment` |
| `source_type` | 如 `starter-preview` / `tts-usage` |
| `source_id` | 例如 usage event id，或 `starter-preview-v1` |
| `credits_delta_millis` | 正数发放，负数扣减 |
| `note` | 人类可读备注 |
| `created_at` | 时间戳 |

说明：

- allowance 余额永远通过 ledger 聚合得到
- 不做“单字段直接覆盖余额”的设计
- 这样后续人工调整、活动赠送、退款回补都更自然

## Starter Allowance 规则

V1 规则：

- 每个 starter workspace 首次 bootstrap 时发放一次 preview allowance
- 通过 ledger entry 实现，不写死在返回文案里
- 要求幂等，重复 bootstrap 不能重复发放

建议方式：

- `source_type = "starter-preview"`
- `source_id = "starter-preview-v1"`

这样就可以用唯一约束保证只发一次。

## Rate Card 策略

V1 使用 **preview default rate cards**。

特点：

- 所有 server-owned TTS provider 都有一条默认 rate card
- 当前优先按 `input_chars` 计价
- `provider_cost_usd_micros` 允许为空
- `retail_credits_millis` 先作为平台内部统一换算值

注意：

- 这些默认 rate card 的目标是把架构和链路打通
- 在 payment 上线前，需要再单独校准真实成本和零售价

## 运行链路

### 1. Hosted bootstrap

在 `apps/server/src/hosted-resources.ts` 中：

1. 确保 user / workspace / project / starter key 存在
2. 确保 starter allowance grant 存在
3. 返回真实 allowance summary，而不是纯文案占位

### 2. TTS usage metering

在 `apps/server/src/realtime-utterance-pipeline.ts` 中：

当 `ttsMode === "server"` 时：

1. 统计进入 TTS 的累计文本字符数
2. 统计输出的累计音频字节数
3. 根据 `sampleRate` 推导 `outputAudioMs`
4. 匹配 `billing_rates`
5. 写入一条 `usage_event`
6. 如果成功，则写一条负向 allowance ledger entry
7. 如果失败，则 `usage_event.status = failed`，但 allowance 不扣

### 3. Owner 归属

owner 归属优先级：

1. 通过 `channel_id -> project`
2. 再通过 `project -> workspace`

这样可以把 usage 挂回现有 starter project / workspace 模型。

这一步是 V1 的关键，因为它让 billing 基础和现有产品对象模型真正接上。

## API 设计

V1 增加一个只读 summary API：

- `GET /api/workspaces/:workspaceId/billing`

返回建议：

```json
{
  "workspaceId": "ws_demo",
  "allowance": {
    "grantedCreditsMillis": 1000000,
    "usedCreditsMillis": 2400,
    "remainingCreditsMillis": 997600,
    "currency": "voice-credits"
  },
  "usage": {
    "totalEvents": 3,
    "successCount": 2,
    "failureCount": 1,
    "inputChars": 1240,
    "outputAudioMs": 8930,
    "chargedCreditsMillis": 2400
  },
  "recentEvents": []
}
```

V1 不做写接口，不做 payment，不做发票。

## 与现有 Web 的衔接

V1 不要求立刻做完整 billing UI。

但建议最少做两件事：

1. hosted bootstrap 返回的 `allowance.note` 改为真实余额说明
2. 后续 settings 页面可以自然接 `workspace billing summary`

这样当前 UI 不会被打断，但以后扩展空间足够。

## 测试策略

V1 需要补三类测试：

### 1. Hosted bootstrap integration

验证：

- 重复 bootstrap 不会重复发 starter allowance
- 返回结果里 allowance 是真实 summary，不再只是静态文案

### 2. TTS usage integration

验证：

- server-owned TTS 成功调用会写 usage event
- allowance 会扣减
- summary API 数据正确

### 3. Failure path integration

验证：

- TTS 调用失败也会写 usage event
- 但 allowance 不扣减

## 这次实现后能带来的收益

完成这层地基后，VoicyClaw 会真正具备：

- 免费额度不是假文案，而是真余额
- 多供应商的调用可以统一记账
- 后续 payment 可以后接，不需要返工 usage 基础
- 未来支持多 bot、多 project、多套餐会自然很多

## 暂留问题

### 1. 默认 rate card 的真实定价是否放代码里

V1 可以先放 preview defaults。

后续更合理的方向是：

- 改成可配置来源
- 例如 env / yaml / admin panel

### 2. Allowance 是按 workspace 还是按 project

V1 建议按 workspace。

原因：

- 和 SaaS owner 更一致
- 未来一个 workspace 下多个 project 可以共享预算

### 3. 是否立刻覆盖 ASR / LLM usage

不建议。

V1 先把 server-owned TTS 做扎实，再按同样模型扩到：

- ASR
- LLM
- 未来 voice cloning / voice asset pipeline

## 结论

V1 最合理的落地顺序是：

1. 增加 `billing_rates`
2. 增加 `usage_events`
3. 增加 `workspace_allowance_ledger`
4. hosted bootstrap 时真实发 starter allowance
5. 在 realtime TTS pipeline 中写 usage 和 allowance consumption
6. 增加 workspace billing summary API

这样做的好处是：

- 改动面集中在 server
- 不需要先做 payment
- 与现有 `workspace / project / starter key` 模型天然兼容
- 足够支撑下一阶段开放试用和成本控制
