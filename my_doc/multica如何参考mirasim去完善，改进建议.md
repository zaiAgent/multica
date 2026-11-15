# Multica 如何参考 MiraSim 去完善：改进建议

> 三原则（延续《Multica改进架构设计书-Multica-NG》NG-A~F 框架）：**插件化、开关化、不破坏**。
> 每项登记为 MS-XX，含：机制 → 痛点 → 改法 → NG 衔接 → 人日。合计 **67~72 人日**。
> 不照搬清单见文末。参考文档：《mirasim软件架构原理与说明.md》《对比两软件的差异.md》。

| 编号 | 内容 | 优先级 | 人日 | 挂接 |
|---|---|---|---|---|
| MS-01 | 成本账本五维分摊（智能体/模型/账号/工作区/Run）+ 单次调用下钻 + CSV | P0 | 10 | NG-A |
| MS-02 | Run 内 steer/jump/recall 干预（复用 daemon 心跳通道下发，记入 Issue 时间线） | P1 | 8 | NG-B+D |
| MS-03 | worktree-per-run（isolation 属性，Verdict 决定合并/放弃） | P1 | 12 | NG-B |
| MS-04 | 智能体间通信三重熔断（30/2s、24 跳、12 条/5min）+ jsonl 账本 | P1 | 6 | NG-B+D |
| MS-05 | Run 上下文观测环（心跳带用量）+ 80% 触发装箱裁剪 + 手动 /compact | P1/P2 | 3+5 | NG-C |
| MS-06 | 模拟用户 eval：质量门第四成员 SimulatedUser，结构化浏览器读取 | P2 | 10~15 | NG-F |
| MS-07 | Transcript ForkFromTurn/ReplayTurn/RollbackTurn | P2 | 10 | NG-B |
| MS-08 | 项目级配置 `<repo>/.multica/`（skills/ + autopilot.json + workflows.json）随仓库走 | P1 | 3 | NG-C |

---

## MS-01 成本账本五维分摊（P0，10 人日，NG-A 预算治理）

**机制**（MiraSim）：每次模型调用记 智能体×模型×账号×工作区×会话 五维，可下钻单次调用，导出 CSV。

**痛点**：Multica 的成本观测停留在订阅/席位级；一个 Run 烧了多少钱、哪个智能体/哪个模型是吞金兽，完全黑箱。预算治理（NG-A）没有数据地基。

**改法**：
1. daemon 心跳包里带上本轮 token 用量（in/out/cache），server 落 `run_usage` 表：`(run_id, agent_id, model, account_id, workspace_id, turn, tokens_in, tokens_out, cached, ts)`；
2. 查询接口按五维聚合，Run 详情页下钻到轮；
3. CSV 导出复用现有报表通道；
4. 开关：`usage_ledger.enabled`，默认开（只增不改现有表）。

**NG 衔接**：NG-A 的预算阈值/熔断直接以本账本为数据源。

## MS-02 Run 内 steer/jump/recall 干预（P1，8 人日，NG-B+D）

**机制**（MiraSim）：steer 不打断下一步生效；jump 立即打断；recall 撤回排队指令。干预延迟以"步"计。

**痛点**：Multica 的 Run 是黑箱八态机，人只能在交付后审核；发现方向错了只能整轮取消重跑，浪费一整轮 token 与时间。

**改法**：
1. 复用 daemon 15s 心跳通道：server 下发 `intervention` 消息（type=steer|jump|recall, payload=指令文本）；
2. daemon 收到后在下一个步边界（steer）或当前步结束点（jump）注入；
3. 每次干预记入 Issue 时间线（`run_intervened` activity），保审计；
4. UI：Run 详情页输入框 + 三个按钮；
5. 开关：`run_intervention.enabled`。

**NG 衔接**：NG-B 运行时弹性 + NG-D 治理审计。心跳通道复用意味着不新增长连接。

## MS-03 worktree-per-run（P1，12 人日，NG-B）

**机制**（MiraSim）：每个并行会话一个 git worktree，互不踩踏，Verdict 决定合并/放弃。

**痛点**：Multica 同一 Issue 上的多个 Run 共享工作目录，物理并行不可行；串行等待是隐形吞吐瓶颈。

**改法**：
1. Run 模型加 `isolation` 属性（shared | worktree，默认 shared 不破坏现状）；
2. daemon 派发任务时按属性创建/复用 worktree；
3. 交付时 worktree 分支交由人审核（与现有 PR 流程衔接）；Verdict=放弃则删除 worktree；
4. 与 MS-07 的 RollbackTurn 天然配合。

**NG 衔接**：NG-B 工作流运行时。

## MS-04 智能体间通信三重熔断 + jsonl 账本（P1，6 人日，NG-B+D）

**机制**（MiraSim）：会话互联五工具 + 投递语义表 + 三重熔断（频次 30 条后 2s 恢复、链深 24 跳、乒乓 12 条/5min）+ 本地 jsonl 消息账本 90 天。

**痛点**：Multica 智能体间无直接通道，跨智能体协作全靠人搬看板列；一旦将来开放通信，没有防雪崩机制就是事故。

**改法**：
1. 先落地**熔断与账本**（安全带），再开通道（油门）：账本表/文件双写，jsonl 按 Issue 归档保留 90 天；
2. 通道初版仅允许同 Issue 的活动 Run 之间互发（最小爆炸半径）；
3. 三重熔断参数进工作区级配置，默认沿用 MiraSim 实测值。

**NG 衔接**：NG-B + NG-D。

## MS-05 Run 上下文观测环 + 装箱裁剪（P1/P2，3+5 人日，NG-C）

**机制**（MiraSim）：会话上下文用量可见，80% 阈值触发装箱裁剪，支持手动 /compact。

**痛点**：Multica Run 的上下文膨胀不可见，长任务隐形成本高（与 MS-01 叠加）。

**改法**：
1. 观测环（3 人日）：心跳带上下文用量，Run 详情页画出用量曲线；
2. 裁剪（5 人日）：80% 触发自动装箱（摘要化早期轮次），Run 页提供手动 /compact 按钮；
3. 开关：`context_autocompact.enabled` 默认关。

**NG 衔接**：NG-C 记忆层。

## MS-06 模拟用户 eval（P2，10~15 人日，NG-F）

**机制**（MiraSim）：SimulatedUser 以结构化 DOM 读取模拟用户验收，做质量门。

**痛点**：Multica 质量门是人（in_review 人工审核）。可形式化的验收（页面能开、按钮能点、表单能交）占人工审核量的大头。

**改法**：
1. 质量门可选第四成员 SimulatedUser：Run 交付后自动跑 eval 脚本（结构化读取，非截图比对）；
2. eval 结论（pass/fail/证据）作为评论挂到 Issue，人只处理机器判 fail 或无 eval 的部分；
3. 与《multica审核改进计划.md》AR-04 ReviewVerdict 衔接：eval 结论可预填审核建议；
4. 开关：工作区级 `simulated_user.enabled`。

**NG 衔接**：NG-F CI 护航。

## MS-07 Transcript 三操作（P2，10 人日，NG-B）

**机制**（MiraSim）：ForkFromTurn / ReplayTurn / RollbackTurn。

**改法**：transcript 按轮存储（已有基础）；新增"从第 N 轮重跑"入口，生成新 Run 继承前 N 轮上下文；与 MS-03 worktree 配合实现文件级回滚。

## MS-08 项目级配置 `<repo>/.multica/`（P1，3 人日，NG-C）

**机制**（MiraSim）：`<workspace>/.mirasim` 项目配置随仓库提交，团队共享技能与配置。

**痛点**：Multica 的 skills/autopilot/工作流配置全在工作区级（服务端库表），换环境重配，且不进版本控制——团队无法"配置即代码"。

**改法**：
1. 约定 `<repo>/.multica/` 目录：`skills/`、`autopilot.json`、`workflows.json`；
2. daemon claim 任务时读取项目根的 `.multica/`，合并进运行时简报（工作区级配置优先级高于项目级）；
3. 配置示例放 `examples/`；
4. 3 人日是最小可用版：读取与注入，不含编辑 UI。

**NG 衔接**：NG-C。

---

## 三阶段路线图衔接

- **第一阶段（快赢）**：MS-01 观测部分 + MS-05 观测环 + MS-08；
- **第二阶段（核心）**：MS-02 干预 + MS-03 worktree + MS-04 通信熔断；
- **第三阶段（质量）**：MS-06 eval + MS-07 transcript 三操作 + MS-01 预算熔断联动。

## 不照搬清单（5 条）

1. **IDE 化界面**：Multica 是 Web 工作台，不做本地 IDE 形态；
2. **平台额度计费**：Multica 自托管无平台费结构，三付费模式不适用；
3. **云端空间运营**：与自托管数据主权冲突；
4. **会话中心替换任务中心**：不动 Multica 的组织骨架——会话式能力（干预/回放）以 Run 为载体叠加，而非推倒重来；
5. **放弃语义记忆规划**：MiraSim 无长程记忆设计；记忆层沿用 NG-C 自有路线。

## 与既有登记清单的关系

NG 登记清单 43 项 + MS 8 项 + AR 8 项（见《multica审核改进计划.md》）= **59 项**，统一挂接 NG-A~F 六子域，可并入一张登记总表排期。
