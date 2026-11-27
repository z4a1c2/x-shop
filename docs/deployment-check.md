# 部署上线检查分析

> 审计时间：2026-11-25
> 最近更新：2026-11-27（P0 4/5、P1 6/7、P2 3/6 已完成；剩余：微信支付、集合权限、物流/图片/监控）
> 项目：x-shop 电商微信小程序
> 技术栈：Taro 3 + React + TypeScript + 微信云开发 CloudBase

***

## 🔴 P0 — 不做就无法上线（业务致命缺口）

> 进度：**4 / 5 已完成**。仅「真实微信支付接入」因需企业主体商户号而阻塞。

### 1. 真实微信支付接入

- **现状：** 支付完全是 mock（`src/data/pay.ts` 的 `mockPay` 直接流转状态），无 `wx.requestPayment` 调用
- **差距：** 无法完成真实资金交易
- **需要做：**
  - 接入微信支付商户号（需企业主体资质）
  - 调用 `wx.cloud.cloudPay.unifiedOrder` 统一下单
  - 服务端接收支付回调更新订单状态（`PENDING_PAYMENT → PENDING_SHIPMENT`）
  - 支付失败/超时回滚
- **工作量：** 3-5 天（含商户号申请）
- **相关文件：** `src/pages/pay-result/index.tsx`、`cloudfunctions/pay/index.js`

### 2. 云函数与 Mock 的 Parity 断裂 ✅ 已修复（2026-11-27）

- **原现状：** `cloudfunctions/order/index.js` 存在多个 action 缺失，与 `src/data/order.ts` mock 版本不一致
- **修复情况：** 5 个 action 已全部补齐，并额外对齐「取消状态范围」「退款积分退回比例」「退款后订单状态」
- **原缺失清单（均已补齐）：**

| Action           | Mock 版本 | 云函数版本              | 影响         |
| ---------------- | ------- | ------------------ | ---------- |
| `confirmReceipt` | ✅ 发放积分  | ❌ 未写入 `points_log` | 确认收货后积分不增加 |
| `agreeRefund`    | ✅ 退回积分  | ❌ 未退回积分            | 同意退款后积分不退回 |
| `completeRefund` | ✅ 退回积分  | ❌ 未退回积分            | 退款完成后积分不退回 |
| `pay`            | ✅ 状态流转  | ❌ 无对应 case         | 真实支付回调无处理  |
| `cancel`         | ✅ 状态流转  | ❌ 无对应 case         | 待付款订单无法取消  |

- **完成内容：** 逐个 action 对照 mock 版本补齐云函数逻辑（`confirmReceipt` 发放积分 / `agreeRefund` 退回积分 / `completeRefund` 退回积分 / 新增 `pay` 支付回调 / `cancel` 支持待发货取消）
- **相关文件：** `cloudfunctions/order/index.js`、`cloudfunctions/pay/index.js`、`src/data/order.ts`

### 3. 服务端价格校验 ✅ 已修复（2026-11-27）

- **原现状：** 下单时直接信任客户端传入的 `items.price`，可被恶意篡改（如改为 ¥0.01 下单）
- **修复情况：** 云函数 `create` 新增 `verifySkuPriceAndStock()`，从 `skus` 集合（回退 `products` 内嵌 `skus`）重新查询真实价格，与客户端不一致直接拒绝下单
- **相关文件：** `cloudfunctions/order/index.js`

### 4. SKU 库存扣减 ✅ 已修复（2026-11-27）

- **原现状：** 无任何 SKU 库存检查和扣减逻辑，存在超卖风险
- **修复情况：**
  - 下单时由 `verifySkuPriceAndStock()` 检查 SKU 库存
  - 支付成功后在云数据库事务中原子扣减库存（`deductStock()`，含 `stock >= quantity` 校验，杜绝负库存）
  - 取消订单 / 退款时通过 `returnStock()` 归还库存
  - 支持独立 `skus` 集合与 `products` 内嵌 `skus` 两种数据模式
- **相关文件：** `cloudfunctions/order/index.js`、`cloudfunctions/pay/index.js`

### 5. 下单幂等性 ✅ 已修复（2026-11-27）

- **原现状：** 同一请求重复提交可能生成多笔订单
- **修复情况：** 前端下单时生成 `client_order_id` 幂等键，云函数 `create` 按 `_openid + client_order_id` 去重，重复提交直接返回已有订单（Mock 层同步支持）
- **相关文件：** `cloudfunctions/order/index.js`、`src/pages/order-confirm/index.tsx`、`src/types/order.ts`、`src/data/order.ts`

***

## 🟡 P1 — 上线前必须完成（影响体验/合规）

> 进度：**6 / 7 已完成**。仅「云数据库集合权限配置」待办（云开发控制台运维项，无代码改动）。

### 6. TabBar 图标格式 ✅ 已修复（2026-11-27）

- **原现状：** `src/assets/tabbar/*.svg` 使用 SVG 格式
- **差距：** 微信原生小程序 tabBar **仅支持 png/jpg**，真机图标不显示
- **修复情况：** 8 个 SVG 已转换为 81×81 PNG，`app.config.ts` 中引用改为对应的 `.png`，原 SVG 已移除
- **相关文件：** `src/assets/tabbar/`、`src/app.config.ts`

### 7. 购物车持久化 ✅ 已修复（2026-11-27）

- **原现状：** 购物车仅存 zustand 内存，页面刷新/重进小程序即丢失
- **修复情况：** `useCartStore` 使用 `Taro.getStorageSync/setStorageSync` 持久化到本地存储（key: `x-shop:cart`），初始化时读取，所有增删改操作后写回，并新增 `clear()` 方法
- **相关文件：** `src/store/cart.ts`

### 8. 优惠券/积分抵扣链路 ✅ 已修复（2026-11-27）

- **原现状：** 订单确认页无优惠券选择、无积分抵扣，`discount_amount` 恒为 0
- **修复情况：**
  - 订单确认页展示当前用户可用优惠券（`coupon` 云函数新增 `usable` action），支持选择/取消，并按门槛过滤
  - 新增积分抵扣输入框（100 积分 = 1 元），实时计算可抵扣上限
  - `create` 订单时服务端校验优惠券（归属/未使用/未过期/满门槛）与积分余额，写入 `discount_amount`、`points_used`，并重算 `pay_amount`
  - 下单即锁定优惠券；支付成功扣减积分；取消/退款/超时关闭时归还优惠券，取消/退款时退还积分
- **相关文件：** `src/pages/order-confirm/index.tsx`、`cloudfunctions/order/index.js`、`cloudfunctions/coupon/index.js`、`cloudfunctions/pay/index.js`、`src/data/order.ts`、`src/data/coupon.ts`、`src/data/pay.ts`

### 9. 订单超时自动取消 ✅ 已修复（2026-11-27）

- **原现状：** 待付款订单无任何自动取消机制
- **修复情况：** 新增 `order-timeout` 云函数，通过 `config.json` 配置定时触发器（每 5 分钟），扫描 `expire_at` 已过期的待付款订单置为 `CLOSED(60)` 并归还优惠券；H5 Mock 在读取订单时惰性扫描，保持行为一致
- **相关文件：** `cloudfunctions/order-timeout/index.js`、`cloudfunctions/order-timeout/config.json`、`src/data/order.ts`

### 10. 买家端隐藏模拟操作 ✅ 已修复（2026-11-27）

- **原现状：** 订单详情页的「模拟发货」「同意/拒绝退款」等商家按钮在买家端可见
- **修复情况：** 通过 `SHOW_MERCHANT_ACTIONS = process.env.NODE_ENV === 'development'` 控制，仅开发环境展示模拟发货、同意/拒绝退款、商家确认收货等商家操作；买家操作（填写退货物流）保持可见
- **相关文件：** `src/pages/order-detail/index.tsx`

### 11. 云数据库集合权限配置

- **现状：** 项目未定义集合权限规则
- **差距：** 可能导致数据泄露或越权访问
- **需要做：** 在云开发控制台配置每个集合的读/写权限

| 集合           | 建议权限          |
| ------------ | ------------- |
| `orders`     | 仅创建者可读写，管理员可读 |
| `products`   | 所有用户可读，仅管理员可写 |
| `skus`       | 所有用户可读，仅管理员可写 |
| `addresses`  | 仅创建者可读写       |
| `points_log` | 仅创建者可读，管理员可读  |
| `coupons`    | 所有用户可读，仅管理员可写 |
| `users`      | 仅自己可读，管理员可读写  |

- **工作量：** 0.5 天（含权限规则编写）

### 12. 种子数据初始化 ✅ 已修复（2026-11-27）

- **原现状：** 真实环境 `products`、`skus`、`addresses`、`coupons` 集合为空
- **修复情况：** 新增 `scripts/seed-data.ts`，从 mock 数据导入 `products`（含内嵌 skus）、`skus`、`categories`、`addresses`、`coupons`；可通过 `npm run seed`（需 `TCB_ENV` 环境变量与 Node 14+）执行
- **相关文件：** `scripts/seed-data.ts`、`package.json`

***

## 🟢 P2 — 影响质量但可延后

> 进度：**3 / 6 已完成**（14 会员等级 / 16 搜索 / 18 类型收紧）。剩余：13 物流轨迹、15 图片 CDN、17 异常监控。

### 13. 物流轨迹对接

- **现状：** 物流轨迹是 mock 硬编码
- **需要做：** 对接顺丰/京东物流 API 或使用微信物流接口
- **工作量：** 2-3 天
- **相关文件：** `cloudfunctions/logistics/index.js`

### 14. 会员等级自动升级 ✅ 已修复（2026-11-27）

- **原现状：** 会员等级基于积分手动判断
- **修复情况：** 按积分区间（1000/5000/20000）定义等级，`user` 云函数 `info` 动态计算等级；`order` 云函数在订单完成返积分后自动重算并写回用户等级；Mock 层同步按积分计算
- **相关文件：** `cloudfunctions/user/index.js`、`cloudfunctions/order/index.js`、`src/data/user.ts`

### 15. 商品图片 CDN

- **现状：** 使用 `picsum.photos` 外部随机图
- **需要做：** 上传商品图到云存储 CDN，改为引用云存储 URL
- **工作量：** 1 天（含图片素材准备）

### 16. 搜索功能 ✅ 已修复（2026-11-27）

- **原现状：** 搜索页 UI 已有但搜索接口未对接
- **修复情况：** 新增 `search` 云函数与 `src/data/search.ts` mock，按 商品名称/副标题/分类名/标签 模糊匹配（忽略大小写与空白，支持「T恤」匹配「T 恤」）；搜索页对接该接口并渲染结果卡片
- **相关文件：** `cloudfunctions/search/index.js`、`src/data/search.ts`、`src/pages/search/index.tsx`

### 17. 异常监控与日志

- **现状：** 无日志上报/告警机制
- **需要做：** 接入云函数日志监控，生产异常时能及时排查
- **工作量：** 0.5 天

### 18. TypeScript 类型收紧 ✅ 部分修复（2026-11-27）

- **原现状：** 部分 mock 返回用 `any` 类型
- **修复情况：** 收紧数据层类型——新增 `Order.client_order_id` / `close_at` 字段并移除 `@ts-ignore` 与 `as any`；`coupon`/`user`/`order` mock 的入参与内部对象改为显式接口（`CouponActionPayload`、`UserCoupon`、`OrderActionPayload` 等）
- **剩余：** 全局 `const g = global as any` 等仍保留，页面层部分 `catch (err: any)` 未逐一处理
- **相关文件：** `src/data/*.ts`、`src/types/order.ts`

***

## 📋 上线前 Checklist

```
🔴 P0 致命级
□ 接入真实微信支付 + 支付回调（阻塞：需企业主体商户号）
✅ 补齐云函数与 mock 的 parity（5 个 action）
✅ 服务端价格校验 + SKU 库存扣减
✅ 下单幂等性防重复提交

🟡 P1 重要级
✅ TabBar SVG → PNG 替换
✅ 购物车 Taro.setStorageSync 持久化
✅ 优惠券/积分抵扣链路贯通
✅ 订单超时自动取消（定时触发器）
✅ 买家端隐藏模拟操作按钮
✅ 种子数据导入脚本
□ 云数据库集合权限配置

🟢 P2 质量级
□ 物流轨迹对接真实 API
✅ 会员等级自动升级
□ 商品图片上传云存储
✅ 搜索功能对接
□ 异常监控与日志
✅ TypeScript 类型收紧（部分）
```

***

## 🏁 预估上线时间

> 说明：P0-2 \~ P0-5、P1-6/7/8/9/10/12、P2-14/16/18 已于 2026-11-27 完成，以下仅列剩余工作。

| 阶段        | 内容                                          | 预估工期         |
| --------- | ------------------------------------------- | ------------ |
| **第 1 周** | P0-1 微信支付接入（含商户号申请、统一下单、支付回调、超时回滚）          | 3-5 天        |
| **第 2 周** | P1-11 集合权限配置 + P2 剩余项（物流轨迹 / 图片 CDN / 异常监控） | 3-4 天        |
| **第 3 周** | 联调测试 + 灰度发布 + 线上观测                          | 2 天          |
| **合计**    |                                             | **\~8-11 天** |

***

## 备注

- 当前 H5 mock 演示链路已完整验证（下单→支付→发货→收货→积分回写）
- P0-2 \~ P0-5 已完成修复：云函数与 Mock parity 全对齐（含取消状态、退款积分比例、退款后订单状态）；服务端价格校验、SKU 库存原子扣减（含超卖防护）、下单幂等性均已落地
- 本轮已完成 P1-6/7/8/9/10/12 与 P2-14/16/18：TabBar 转 PNG、购物车持久化、优惠券+积分抵扣贯通、订单超时自动取消（定时触发器）、买家端隐藏商家模拟操作、种子数据脚本、会员等级自动升级、搜索接口对接、数据层类型收紧
- 云函数 JavaScript 语法校验已通过（含新增的 `order-timeout`、`search`）；受本机 Node 12 环境限制无法执行 Taro 构建，需在 Node 20+ 或微信开发者工具中编译验证
- 微信支付为唯一剩余 P0 阻塞项，需企业主体资质，个人开发者无法开通，需提前准备
- P1-11（云数据库集合权限配置）需在云开发控制台操作，属运维配置项，未改动代码
- **剩余待办：** P0-1 微信支付接入、P1-11 集合权限配置、P2-13 物流轨迹、P2-15 商品图片 CDN、P2-17 异常监控与日志
