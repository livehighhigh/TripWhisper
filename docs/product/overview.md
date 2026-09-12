# 产品总览

TripWhisper 是面向中文用户的 **米兰 + 科莫湖 3—5 天** 旅行工作台体验版。规则与精选文案驱动；**未接入**真实大模型、实时天气、票务库存、支付或云端账户。

默认打开「每日行动卡」。顶栏主按钮「定制我的行程」切到「旅行偏好」。

## 信息架构（标签页）

全部入口在 `app/page.tsx` 的同一组 Tabs。各页读写 **同一份** `journey`（以及账本、准备勾选、回顾等并列状态）。

| 标签 | `tab` 值 | 用户在做什么 | 详情 |
| --- | --- | --- | --- |
| 旅行偏好 | `profile` | 填日期 / 人数 / 预算 / 兴趣，生成行程 | [modules.md § 旅行偏好](./modules.md#旅行偏好与行程生成) |
| 认识目的地 | `explore` | 看区域关系与官网入口 | [modules.md § 认识目的地](./modules.md#认识目的地) |
| 全程安排 | `plan` | 看整段手账、活动估算、打印 / 导出 | [modules.md § 全程安排](./modules.md#全程安排) |
| 我的预订 | `bookings` | 录入已购项目，锁定时段 | [modules.md § 我的预订](./modules.md#我的预订) |
| 背景手册 | `handbook` | 出发清单、地点背景、交通与常用语 | [modules.md § 背景手册](./modules.md#背景手册) |
| 每日行动卡 | `today` | 按天执行；侧栏重排；导出当日 PNG | [modules.md § 每日行动卡](./modules.md#每日行动卡) |
| 旅行账本 | `budget` | 手记实际花费（与活动估算分开） | [modules.md § 旅行账本](./modules.md#旅行账本) |
| 旅行回顾 | `memory` | 写小记、确认「更喜欢慢节奏」 | [modules.md § 旅行回顾](./modules.md#旅行回顾) |

侧栏「计划跟着你走」挂在每日卡上，不是独立标签。规则见 [replan.md](./replan.md)。

```text
行前：旅行偏好 → 认识目的地 → 全程安排 / 我的预订 / 背景手册
行中：每日行动卡（含重排）→ 旅行账本
行后：旅行回顾（偏好可再带回「旅行偏好」重新生成）
```

## 共享数据：一份行程，三处同显

`Journey`（`lib/journey.ts`）是总行程、每日卡、活动预算估算的唯一来源。确认重排或加入预订后，这三处读的是同一个对象，不会各存一份时间表。

```text
Journey
├── profile     出发日、天数、人数、预算、住宿文本、兴趣、慢节奏、行李、模拟已订
├── days[]      每天 title / city / reason / stops[]
├── version     整数；确认写入时 +1
└── applied[]   生成时实际用上的记忆偏好（目前仅「更喜欢慢节奏」）

Stop
├── 时段 time–end、中英名称、地址、kind、交通说明、人均 cost
├── story / tip、可选 url、outdoor
└── locked      已订则重排与下雨不移动该时段
```

并列、但不在 `Journey` 里的状态（均在 `app/page.tsx`）：

| 状态 | 作用 | 是否写入 localStorage |
| --- | --- | --- |
| `expenses` | 旅行账本 | 是 |
| `checks` | 手册准备清单（最多 7 项） | 是 |
| `memories` | 已确认的可复用偏好 | 是 |
| `saved` | 回顾小记 | 是 |
| `previous` | 仅上一版行程，供「恢复上一版」 | **否**（刷新即丢失） |
| `day` / `tab` | 当前天、当前标签 | 否 |

版本策略：**每次确认写入 `version++`，只能恢复一层 `previous`**。跨版本列表与任意回退是 [Issue #9](https://github.com/3013038780-design/TripWhisper/issues/9)，本文不实现。

## 演示数据 ≠ 实时事实

代码内的米兰 / 科莫地点、故事、票价、交通时长是 **示范内容**，不是现场营业、班次、余票或报价。

| 用户可能以为是真的 | 当前实际 |
| --- | --- |
| 大教堂 / 美术馆 / 游船安排 | `lib/journey.ts` 静态模板；官网链接仅外跳 |
| 「锁定第 1 天大教堂」 | 模拟约束开关，**不代表已购票** |
| 活动预算 € | `stop.cost × 人数` 的演示估值 |
| 账本人民币折算 | 用户手填汇率，不是实时牌价 |
| 地图导航 | 用地址打开 Google Maps 搜索，未按住宿算路 |
| 天气 / 少走路 / 下雨 | 用户点选后的规则替换，无气象或路况接口 |
| 本机保存 | 仅当前浏览器 `localStorage`，无云同步 |
| WebMCP `read_trip_summary` | 浏览器提供 `document.modelContext` 时注册的只读摘要；**不是 EvoMap 集成** |

内容可追溯与「待核验」展示见 [Issue #5](https://github.com/3013038780-design/TripWhisper/issues/5)。云端持久化见 [Issue #6](https://github.com/3013038780-design/TripWhisper/issues/6)。EvoMap 最小工作流见 [Issue #7](https://github.com/3013038780-design/TripWhisper/issues/7)。

页脚与各模块文案已写明：体验版、须自行核实开放时间 / 天气 / 库存。

## 代码地图

```text
app/page.tsx                    标签页、共享状态、生成、本机存取、导出、WebMCP
app/layout.tsx                  页面标题与中文 lang
app/globals.css                 工作台样式

components/travel/bookings.tsx  预订录入 / 预览确认 / 移除 / 只读体检
components/travel/budget.tsx    账本 UI
components/travel/handbook.tsx  手册四章
components/travel/replan.tsx    晚出门 / 少走路 / 下雨 预览确认、恢复上一版

lib/journey.ts                  类型、示范地点、generate、adjust（下雨）、estimate
lib/replan.ts                   受约束重排预览（不写当前行程）
lib/workspace.ts                预订冲突、带预订再生成、账本、auditJourney
lib/export-card.ts              当日行程 PNG（画布绘制，不是截图）

tests/journey.test.mjs          生成、锁定、兴趣、下雨/休息不改锁定项
tests/workspace.test.mjs        预订保留、缓冲、金额
tests/replan.test.mjs           预览隔离、锁定交通、顺延/压缩/移除
```

`components/ui/` 是通用控件，不含旅行业务规则。

## 刻意未做（不要当成已上线）

| 缺口 | Issue |
| --- | --- |
| 行程体检 → 修复建议 → 确认应用 | [#4](https://github.com/3013038780-design/TripWhisper/issues/4) |
| 地点来源、核验时间、演示/用户数据可区分 | [#5](https://github.com/3013038780-design/TripWhisper/issues/5) |
| 服务端编排、密钥、跨设备恢复 | [#6](https://github.com/3013038780-design/TripWhisper/issues/6) |
| EvoMap OAuth / 检索 / 复用工作流 | [#7](https://github.com/3013038780-design/TripWhisper/issues/7) |
| 多版本历史与任意回退 | [#9](https://github.com/3013038780-design/TripWhisper/issues/9) |

受约束重排（[#3](https://github.com/3013038780-design/TripWhisper/issues/3)）已合入，规则以 [replan.md](./replan.md) 为准。
