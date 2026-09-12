# 模块说明

每个模块包含：目的、主要交互、关键规则、代码路径。受约束重排的锁定与取舍见 [replan.md](./replan.md)。总览与标签对照见 [overview.md](./overview.md)。

---

## 旅行偏好与行程生成

**目的**：用结构化偏好生成（或带预订再生成）一份 3—5 天行程，而不是让用户写提示词。

**主要交互**

- 表单：出发日期、天数（3—5）、人数（1—8）、全部同行者活动预算（欧元）、米兰住宿位置（可选文本）。
- 兴趣芯片（可多选）：艺术与建筑、湖畔自然、街区生活。
- 勾选：慢节奏、大件行李、锁定第 1 天 09:30 大教堂（模拟已订）。
- 「确认偏好，生成我的行程」：通过后切到「全程安排」，并提示核实官网后再真实预订。
- 侧栏「我们理解的你」只预览当前表单，**确认前不替换**已有行程。

**关键规则**

- 非法日期、天数 / 人数越界、预算非正数会拒绝生成。
- `generate(profile, memories)` 用静态模板切片，不是模型输出。
- **艺术与建筑**：第 1 天下午布雷拉美术馆；否则布雷拉街区。
- **湖畔自然**：第 3 天科莫往返；未选则第 3 天留在米兰。
- **街区生活**：第 2 天下午改为布雷拉街区（覆盖公园）。
- **慢节奏** 或记忆「更喜欢慢节奏」：去掉公园、游船、运河等可选点。
- **出发日为周一**（UTC 日历）：当天「布雷拉美术馆」换成同名时段的街区漫步。
- **大件行李**：主要改科莫日的说明（轻装往返、先确认寄存），不改交通算法。
- **模拟已订**：仅把第 1 天大教堂 `locked: true`。不是购票。
- 住宿文本只用于记录与展示；交通时长是示范估计，**不按酒店地址算路**。
- 若当前行程已有 `kind === '我的预订'`，走 `regenerateWithBookings`：先按新偏好生成，再按原绝对日期与时段嵌回预订。预订落到新日期范围外，或与新锁定 / 交通冲突，会整单失败并提示，不覆盖原行程。
- 成功生成：`previous = 当前行程`，新行程 `version = 旧 version + 1`。

**代码路径**

- UI / 提交：`app/page.tsx`（`build`、`profile` 表单）
- 生成与模板：`lib/journey.ts`（`Profile`、`initialProfile`、`generate`）
- 带预订再生成：`lib/workspace.ts`（`regenerateWithBookings` → `previewBooking`）
- 回归：`tests/journey.test.mjs`、`tests/workspace.test.mjs`

---

## 认识目的地

**目的**：用区域关系建立方向感，并给出官方网站入口。不提供可缩放地图或实时班次。

**主要交互**

- 示意条：米兰车站 → 市中心 / 大教堂 → 布雷拉与城堡；米兰 → 火车 → 科莫镇 → 湖岸。
- 四张地点卡：大教堂、布雷拉、科莫湖、米兰公共交通；外链官网。
- 额外 Trenord 区域火车入口。

**关键规则**

- 文案写明：示意不是按比例地图；跳转后在对方网站自行选票支付；本站无库存、不代下单。
- 卡片数据写在 `app/page.tsx` 的 `placeCards`，官网 URL 来自 `lib/journey.ts` 的 `sources`。

**代码路径**

- `app/page.tsx`（`explore` TabsContent）
- `lib/journey.ts`（`sources`）

---

## 全程安排

**目的**：整段旅行的手账视图。与每日卡、活动估算共用同一份 `journey`。

**主要交互**

- 按天列出日期、城市、标题、原因、`时间 名称〔已订〕` 串。
- 「打开这一天的行动卡」：设 `day` 并切到 `today`。
- 「打印 / 存为 PDF」：`window.print()`。
- 侧栏：活动估算 vs 所设预算；偏好如何影响安排；导出 JSON 备份。

**关键规则**

- 活动估算 = 所有 `stop.cost` 之和 × `people`。不含机票、住宿、未安排餐饮与额外市内交通。是演示估值，不是报价。
- 估算超预算时标红提示；**不会**自动改行程。
- 确认重排之前，本页时间表不变（预览只活在每日卡侧栏）。确认后本页、日卡、估算一起变。
- JSON 备份包含 `journey`、`memories`、`saved`、`expenses`、`checks`，不含内存中的 `previous`。

**代码路径**

- `app/page.tsx`（`plan`、`estimate`、`exportTrip`）
- `lib/journey.ts`（`estimate`、`dateAt`）

---

## 我的预订

**目的**：把用户已在官网买好的项目写进行程并锁定，避免重排或再生成挪走。本站不支付、不改真实订单。

**主要交互**

- 表单：日期（限制在当前行程内）、名称、当地地址、起止时间、每人欧元价格、可选 `https://` 官网链接。
- 「检查并预览」→ 冲突说明 →「确认加入并锁定」。
- 侧栏列出所有 `locked` 项：区分「你录入的预订」与「模拟预订」。
- 仅用户录入项可「从行程移除」（二次确认）。明确写：不取消、不退款。
- 侧栏「行程体检」只读列出 `auditJourney` 发现。

**关键规则**

- 预览用 `previewBooking`，确认前不写 `journey`。行程 `version` 已变则必须重新检查。
- 与已有 stop 的重叠判定含 **前后各 15 分钟** 缓冲。
- 与 **已锁定或 `kind === '交通'`** 冲突：直接拒绝。
- 与普通活动冲突：预览列出将移除的名称，确认后删除这些 stop，插入锁定预订并按开始时间排序。
- 新 stop：`kind: '我的预订'`、`locked: true`、说明系统不会改其日期时间。
- 链接必须是合法 `https:`；拒绝 `javascript:` 等。
- 再生成时按**绝对日期 + 原时段**保留用户预订（见上一模块）。
- 移除只删行程记录，`version++`，并写入 `previous`。
- **行程体检现状**：缺住宿文本、相邻 stop 衔接不足 15 分钟、科莫日缺返程 `id === 'return'`，并固定提示天气 / 开放 / 余票未自动核验。没有「选修复 → 确认应用」。补闭环见 [Issue #4](https://github.com/3013038780-design/TripWhisper/issues/4)，本文不实现。

**代码路径**

- `components/travel/bookings.tsx`
- `lib/workspace.ts`（`previewBooking`、`regenerateWithBookings`、`auditJourney`）
- 状态写回：`app/page.tsx`（`onApply` → `setPrevious` + `setJourney`）

---

## 背景手册

**目的**：行前 / 行中可打印的背景，不替代官方核验。

**主要交互**

- 四章芯片：准备出发、看懂目的地、交通与订票、当地常用语。
- 「打印这一章」：`window.print()`。
- 准备出发：7 项勾选，进度 `n / 7`。
- 看懂目的地：按当前行程 stop 去重后展示 story / tip / 官网（排除「我的预订」）。
- 交通与订票：ATM / Trenord / 游船官网及预订注意。
- 常用语：固定 5 句，不是翻译引擎。

**关键规则**

- 勾选只是准备记录，不代表系统已核验签证、航班或开放时间。
- 最多记住 7 条清单文本（读档时 `slice(0, 7)`）。
- 抵达交通不会凭空生成；文案要求用户自行查机场路线，固定车次请录入「我的预订」。
- 「锁定」只保护行程安排，不是购买确认。

**代码路径**

- `components/travel/handbook.tsx`
- 勾选状态：`app/page.tsx`（`checks`）
- 官网：`lib/journey.ts`（`sources`）

---

## 每日行动卡

**目的**：按天执行同一份行程：时段、地址、交通说明、锁定标记、地图与官网。

**主要交互**

- Day 芯片切换 `day`；展示版本号、日期、城市、标题、原因、路线条、每站 `StopCard`。
- 「保存今日行程图」：按当前 `journey` + `day` 画 PNG 下载（不是网页截图）。
- 每站：当地名、地址、类型、人均预算参考、交通、可展开故事 / 提醒、Google Maps、可选官网。
- `locked` 显示「已订 · 保留」。
- 右侧：`ReplanPanel` + 创始人经验提示 + 当天纸质清单（天气未接入）。

**关键规则**

- 卡片数据全部来自 `journey.days[day]`，与全程安排同源。
- PNG 含时间、地址、交通、锁定文案和版本号；页脚写明未实时核验。
- 重排确认后日卡立刻反映新 stops；确认前侧栏预览不影响卡片列表。

**代码路径**

- `app/page.tsx`（`today`、`StopCard`、`directions`）
- `lib/export-card.ts`（`exportDayCard`）
- `lib/journey.ts`（`directions`）
- 侧栏：`components/travel/replan.tsx`

---

## 旅行账本

**目的**：记录整组同行者的**实际支出**，与全程安排里的活动估算分开。

**主要交互**

- 汇总：已记录支出、所设预算、差额、进度条。
- 按行程日汇总笔数与欧元小计。
- 记一笔：日期、名称、分类、金额、EUR/CNY、手填「1 欧元 ≈ 多少人民币」。
- 删除后可「撤销删除」最近一笔（只记一笔待撤销）。
- 不在当前行程日期内的记录仍列出，并标注不计入本次统计。

**关键规则**

- 金额按最小货币单位（分）整数存储，避免 `0.1 + 0.2` 误差。
- 人民币：`eurMinor = round(amountMinor / rate)`，按**录入当时**汇率固化，之后改展示汇率不回算旧账。
- 汇率须为有限正数且 ≤ 100；默认输入框 `8.00` 仅为演示。
- 统计不乘人数（用户应记整笔账单）。
- 账本**不会**自动写入行程 `stop.cost`，行程估算也不会自动变成账单。
- 随旅行 JSON 备份导出；只存在本浏览器。

**代码路径**

- `components/travel/budget.tsx`
- `lib/workspace.ts`（`Expense`、`createExpense`、`parseMoney`、`dailyExpenses`、`safeExpense`）
- 状态：`app/page.tsx`（`expenses`）

---

## 旅行回顾

**目的**：把一句感受收成私密小记，并可确认一条可复用偏好。

**主要交互**

- 输入感受 →「整理为小记草稿」（固定模板，保留原话）→ 可改语气 →「保存到本机手账」。
- 已保存条目可导出 `.txt`。
- 「确认：我更喜欢慢节奏」写入 `memories`；可删除。文案说明：**当前行程不变**，需回偏好页重新生成才生效。
- 再次提示：数据只在此浏览器；可导出备份。

**关键规则**

- 不会自动发布、不会后台追问。
- 目前可复用记忆只有「更喜欢慢节奏」一条。
- 小记日期用当前选中的行程日 `dateAt(profile.date, day)`。

**代码路径**

- `app/page.tsx`（`memory`、`note` / `draft` / `saved` / `memories`）

---

## 本机持久化与单层恢复

**目的**：刷新后仍能看到当前旅行；误操作时可回到**紧邻的上一版**行程。

**主要交互**

- 就绪后自动写入 `localStorage` 键 `tripwhisper-local-v1`。
- 读档失败：提示并回退到 `generate(initialProfile)` 示范行程。
- 存储不可用：提示内容仅留在本页，请导出。
- 「恢复上一版」在每日卡侧栏，仅当内存里有 `previous` 时出现。

**关键规则**

- schema `1`。写入字段：`journey`、`memories`、`saved`、`expenses`、`checks`。
- **不写入** `previous`、当前标签、当前天。刷新后不能恢复上一版。
- 无登录、无多设备同步。清除站点数据即丢失。云端与跨浏览器恢复见 [Issue #6](https://github.com/3013038780-design/TripWhisper/issues/6)。
- 下列确认会 `setPrevious(当前)` 再替换 `journey`（并 `version++`）：生成、加入/移除预订、确认重排、确认下雨调整。
- 恢复：`journey` / `profile` 回到 `previous`，然后清空 `previous`（只能退一层）。**不会**再 `version++`。
- 连续确认多次后，中间版本不可点选。多版本历史见 [Issue #9](https://github.com/3013038780-design/TripWhisper/issues/9)。

**代码路径**

- `app/page.tsx`（`KEY`、两个 `useEffect`、各 `onApply` / `onRestore`）
- 读档校验：`safeExpense`、`generate(profile)` 试跑、days/stops 形状检查

---

## 只读行程摘要（WebMCP）

**目的**：在支持 `document.modelContext` 的浏览器里，让外部工具只读当前行程摘要。

**关键规则**

- 工具名 `read_trip_summary`：日期、版本、每天标题与 stop 名称 / 时间 / locked。
- `readOnlyHint: true`，空参数；不修改数据。
- **不是** EvoMap OAuth、检索或 gene/recipe 复用。接入见 [Issue #7](https://github.com/3013038780-design/TripWhisper/issues/7)。

**代码路径**

- `app/page.tsx`（`modelContext.registerTool`）
