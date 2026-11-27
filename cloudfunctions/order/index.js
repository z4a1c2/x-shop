const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const ORDER_STATUS = {
  PENDING_PAYMENT: 10,
  PENDING_SHIPMENT: 20,
  PENDING_RECEIPT: 30,
  COMPLETED: 40,
  CANCELLED: 50,
  CLOSED: 60,
}

const genOrderNo = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${String(Date.now()).slice(-4)}`
}

// ============ 辅助函数 ============

/**
 * 写入积分日志 + 更新用户积分余额
 */
async function addPointsLog(openid, delta, reason) {
  const pointsLogs = db.collection('points_log')
  const users = db.collection('users')

  await pointsLogs.add({
    data: {
      _openid: openid,
      delta,
      reason,
      balance: 0, // 先占位，后面更新
      created_at: Date.now(),
    },
  })

  // 原子更新用户积分
  const userRes = await users.where({ _openid: openid }).limit(1).get()
  if (userRes.data.length > 0) {
    const user = userRes.data[0]
    const newBalance = (user.points || 0) + delta
    await users.doc(user._id).update({
      data: { points: newBalance, updated_at: Date.now() },
    })
    // 更新日志中的余额快照
    await pointsLogs.where({ _openid: openid }).orderBy('created_at', 'desc').limit(1).get()
      .then(res => {
        if (res.data.length > 0) {
          pointsLogs.doc(res.data[0]._id).update({ data: { balance: newBalance } })
        }
      }).catch(() => {})
  } else {
    // 首次写入，创建用户记录
    const initPoints = 100 + delta
    await users.add({
      data: {
        _openid: openid,
        nickname: '微信用户',
        avatar: '',
        level: '普通会员',
        points: initPoints,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    })
    // 更新日志余额
    const logs = await pointsLogs.where({ _openid: openid }).orderBy('created_at', 'desc').limit(1).get()
    if (logs.data.length > 0) {
      await pointsLogs.doc(logs.data[0]._id).update({ data: { balance: initPoints } })
    }
  }
}

/**
 * 校验 SKU 价格和库存（优先查 skus 集合，回退查 products 内嵌 skus）
 * @returns {{ valid: boolean, error?: string, skuInfo?: object }}
 */
async function verifySkuPriceAndStock(items) {
  const skusColl = db.collection('skus')
  const productsColl = db.collection('products')

  for (const item of items) {
    let skuDoc = null

    // 方式一：独立 skus 集合
    try {
      const res = await skusColl.doc(item.sku_id).get()
      skuDoc = res.data
    } catch (e) {
      // 方式二：products 内嵌 skus 数组
      try {
        const prodRes = await productsColl.doc(item.product_id).get()
        const product = prodRes.data
        if (product.skus && Array.isArray(product.skus)) {
          skuDoc = product.skus.find((s) => s._id === item.sku_id)
          if (skuDoc) skuDoc._fromProduct = true
        }
      } catch (e2) {
        return { valid: false, error: `商品「${item.name}」不存在或无法验证` }
      }
    }

    if (!skuDoc) {
      return { valid: false, error: `商品「${item.name}」的 SKU 不存在` }
    }

    // 价格校验
    if (skuDoc.price !== item.price) {
      return {
        valid: false,
        error: `商品「${item.name}」价格异常（标价 ¥${(skuDoc.price / 100).toFixed(2)}，提交 ¥${(item.price / 100).toFixed(2)}）`,
      }
    }

    // 库存校验
    if (skuDoc.stock < item.quantity) {
      return { valid: false, error: `商品「${item.name}」库存不足（剩余 ${skuDoc.stock}）` }
    }
  }

  return { valid: true }
}

/**
 * 原子扣减 SKU 库存（云数据库事务）
 */
async function deductStock(items) {
  const transaction = await db.startTransaction()

  try {
    for (const item of items) {
      // 优先尝试独立 skus 集合
      let skuDoc = null
      try {
        const res = await transaction.collection('skus').doc(item.sku_id).get()
        skuDoc = res.data
      } catch (e) {
        skuDoc = null
      }

      if (skuDoc) {
        // 库存充足性校验，防止扣成负数
        if (typeof skuDoc.stock === 'number' && skuDoc.stock < item.quantity) {
          await transaction.rollback()
          return { success: false, error: `商品「${item.name}」库存不足（剩余 ${skuDoc.stock}）` }
        }
        await transaction.collection('skus').doc(item.sku_id).update({
          data: {
            stock: _.inc(-item.quantity),
            sales: _.inc(item.quantity),
          },
        })
      } else {
        // 回退：products 内嵌 skus
        const prodRes = await transaction.collection('products').doc(item.product_id).get()
        const product = prodRes.data
        if (!product || !Array.isArray(product.skus)) {
          await transaction.rollback()
          return { success: false, error: `商品「${item.name}」库存记录不存在` }
        }
        const target = product.skus.find((s) => s._id === item.sku_id)
        if (!target) {
          await transaction.rollback()
          return { success: false, error: `商品「${item.name}」的 SKU 不存在` }
        }
        if (typeof target.stock === 'number' && target.stock < item.quantity) {
          await transaction.rollback()
          return { success: false, error: `商品「${item.name}」库存不足（剩余 ${target.stock}）` }
        }
        const updatedSkus = product.skus.map((s) => {
          if (s._id === item.sku_id) {
            return { ...s, stock: s.stock - item.quantity, sales: (s.sales || 0) + item.quantity }
          }
          return s
        })
        await transaction.collection('products').doc(item.product_id).update({
          data: { skus: updatedSkus },
        })
      }
    }
    await transaction.commit()
    return { success: true }
  } catch (err) {
    try { await transaction.rollback() } catch (_) {}
    return { success: false, error: err.message }
  }
}

/**
 * 归还 SKU 库存（取消/退款时调用）
 */
async function returnStock(items) {
  const skusColl = db.collection('skus')
  const productsColl = db.collection('products')

  for (const item of items) {
    try {
      await skusColl.doc(item.sku_id).update({
        data: { stock: _.inc(item.quantity) },
      })
    } catch (e) {
      try {
        const prodRes = await productsColl.doc(item.product_id).get()
        const product = prodRes.data
        const updatedSkus = (product.skus || []).map((s) => {
          if (s._id === item.sku_id) {
            return { ...s, stock: s.stock + item.quantity }
          }
          return s
        })
        await productsColl.doc(item.product_id).update({
          data: { skus: updatedSkus },
        })
      } catch (e2) {
        console.error(`[order] return stock failed for ${item.sku_id}:`, e2)
      }
    }
  }
}

// ============ 优惠券 / 积分辅助 ============

// 优惠券模板（与 coupon 云函数保持一致）
const COUPON_TEMPLATES = [
  { _id: 'c1', name: '新人满 199 减 20', amount: 2000, threshold: 19900, expire_at: Date.now() + 30 * 24 * 3600 * 1000 },
  { _id: 'c2', name: '满 99 减 10', amount: 1000, threshold: 9900, expire_at: Date.now() + 15 * 24 * 3600 * 1000 },
  { _id: 'c3', name: '无门槛 5 元券', amount: 500, threshold: 0, expire_at: Date.now() + 7 * 24 * 3600 * 1000 },
]

// 读取用户可用积分（无记录时与 user 云函数保持一致，视为 100）
async function getUserPoints(openid) {
  try {
    const res = await db.collection('users').where({ _openid: openid }).limit(1).get()
    if (res.data.length > 0) return res.data[0].points || 0
  } catch (e) { /* ignore */ }
  return 100
}

// 标记用户优惠券为已使用（下单时锁定）
async function markCouponUsed(openid, couponId) {
  if (!couponId) return
  try {
    const res = await db.collection('user_coupons')
      .where({ _openid: openid, coupon_id: couponId, status: 'unused' })
      .limit(1)
      .get()
    if (res.data.length > 0) {
      await db.collection('user_coupons').doc(res.data[0]._id).update({
        data: { status: 'used', used_at: Date.now() },
      })
    }
  } catch (e) {
    console.error('[order] mark coupon used failed:', e)
  }
}

// 恢复用户优惠券为未使用（取消/退款/关闭时）
async function restoreCoupon(openid, couponId) {
  if (!couponId) return
  try {
    const res = await db.collection('user_coupons')
      .where({ _openid: openid, coupon_id: couponId, status: 'used' })
      .get()
    for (const c of res.data) {
      await db.collection('user_coupons').doc(c._id).update({ data: { status: 'unused' } })
    }
  } catch (e) {
    console.error('[order] restore coupon failed:', e)
  }
}

// 会员等级规则（与 user 云函数保持一致）
const LEVEL_THRESHOLDS = [
  { level: '钻石会员', min: 20000 },
  { level: '金卡会员', min: 5000 },
  { level: '银卡会员', min: 1000 },
  { level: '普通会员', min: 0 },
]

function calcLevel(points) {
  const p = points || 0
  const matched = LEVEL_THRESHOLDS.find((l) => p >= l.min)
  return matched ? matched.level : '普通会员'
}

// 订单完成后按最新积分重算并更新会员等级
async function updateUserLevel(openid) {
  try {
    const res = await db.collection('users').where({ _openid: openid }).limit(1).get()
    if (res.data.length === 0) return
    const user = res.data[0]
    const newLevel = calcLevel(user.points || 0)
    if (newLevel !== user.level) {
      await db.collection('users').doc(user._id).update({
        data: { level: newLevel, updated_at: Date.now() },
      })
    }
  } catch (e) {
    console.error('[order] update user level failed:', e)
  }
}

// ============ 主入口 ============

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || 'demo-user'
  const action = event.action || 'list'
  const orders = db.collection('orders')
  const addresses = db.collection('addresses')

  try {
    switch (action) {
      // ===== 列表 & 详情 =====

      case 'list': {
        let query = { _openid: openid }
        if (event.status) query.status = event.status
        const res = await orders.where(query).orderBy('created_at', 'desc').limit(100).get()
        return { code: 0, message: 'success', data: res.data }
      }

      case 'detail': {
        const res = await orders.doc(event.id).get()
        return { code: 0, message: 'success', data: res.data }
      }

      // ===== 创建订单（含价格校验 + 幂等性） =====

      case 'create': {
        const { items, address_id, remark, client_order_id } = event

        // --- P0-5: 幂等性检查 ---
        if (client_order_id) {
          const existRes = await orders
            .where({ _openid: openid, client_order_id })
            .limit(1)
            .get()
          if (existRes.data.length > 0) {
            // 已存在相同幂等键的订单，直接返回已有订单
            const existing = existRes.data[0]
            return { code: 0, message: 'success (idempotent)', data: existing }
          }
        }

        // 参数校验
        if (!items || !Array.isArray(items) || items.length === 0) {
          return { code: -1, message: '商品列表不能为空', data: null }
        }
        if (!address_id) {
          return { code: -1, message: '请选择收货地址', data: null }
        }

        // --- P0-3 + P0-4: 价格校验 + 库存检查 ---
        const verifyResult = await verifySkuPriceAndStock(items)
        if (!verifyResult.valid) {
          return { code: -1, message: verifyResult.error, data: null }
        }

        // 计算金额
        const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
        const freight = totalAmount >= 9900 ? 0 : 600

        // --- P1-8: 优惠券校验 ---
        let discountAmount = 0
        const couponId = event.coupon_id || ''
        if (couponId) {
          const tmpl = COUPON_TEMPLATES.find((t) => t._id === couponId)
          if (!tmpl) {
            return { code: -1, message: '优惠券不存在', data: null }
          }
          const ucRes = await db.collection('user_coupons')
            .where({ _openid: openid, coupon_id: couponId, status: 'unused' })
            .limit(1)
            .get()
          if (ucRes.data.length === 0) {
            return { code: -1, message: '优惠券不可用', data: null }
          }
          if (tmpl.expire_at < Date.now()) {
            return { code: -1, message: '优惠券已过期', data: null }
          }
          if (totalAmount < tmpl.threshold) {
            return { code: -1, message: `未满 ${tmpl.threshold / 100} 元，无法使用该优惠券`, data: null }
          }
          discountAmount = tmpl.amount
        }

        // --- P1-8: 积分抵扣校验（100 积分 = 1 元，即 1 积分 = 1 分） ---
        let pointsUsed = event.points_used || 0
        if (pointsUsed < 0) pointsUsed = 0
        const balance = await getUserPoints(openid)
        if (pointsUsed > balance) {
          return { code: -1, message: '积分不足', data: null }
        }
        const maxDeduction = Math.max(0, totalAmount + freight - discountAmount)
        if (pointsUsed > maxDeduction) pointsUsed = maxDeduction

        const payAmount = Math.max(0, totalAmount + freight - discountAmount - pointsUsed)

        // 锁定优惠券（下单即占用，取消/退款时归还）
        await markCouponUsed(openid, couponId)

        // 获取地址快照
        let addressData = { name: '', phone: '', province: '', city: '', district: '', detail: '' }
        try {
          const addrRes = await addresses.doc(address_id).get()
          addressData = addrRes.data
        } catch (e) { /* 使用默认 */ }

        const orderData = {
          order_no: genOrderNo(),
          status: ORDER_STATUS.PENDING_PAYMENT,
          items,
          total_amount: totalAmount,
          freight,
          discount_amount: discountAmount,
          pay_amount: payAmount,
          coupon_id: couponId,
          points_used: pointsUsed,
          address: {
            name: addressData.name,
            phone: addressData.phone,
            province: addressData.province,
            city: addressData.city,
            district: addressData.district,
            detail: addressData.detail,
          },
          remark,
          client_order_id: client_order_id || '',
          expire_at: Date.now() + 30 * 60 * 1000,
          created_at: Date.now(),
          updated_at: Date.now(),
        }

        const addRes = await orders.add({ data: orderData })
        return { code: 0, message: 'success', data: { _id: addRes._id, ...orderData } }
      }

      // ===== P0-2: 支付成功回调（PENDING_PAYMENT → PENDING_SHIPMENT） =====

      case 'pay': {
        const orderRes = await orders.doc(event.id).get()
        const order = orderRes.data
        if (!order) {
          return { code: -1, message: '订单不存在', data: null }
        }
        if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
          return { code: -1, message: '订单状态不允许支付', data: null }
        }

        // --- P0-4: 原子扣减库存 ---
        const stockResult = await deductStock(order.items)
        if (!stockResult.success) {
          return { code: -1, message: `库存扣减失败：${stockResult.error}`, data: null }
        }

        const now = Date.now()
        await orders.doc(event.id).update({
          data: {
            status: ORDER_STATUS.PENDING_SHIPMENT,
            pay_at: now,
            updated_at: now,
          },
        })

        // 扣减用户使用的积分（下单时已锁定，支付成功后正式扣减）
        if (order.points_used && order.points_used > 0) {
          try {
            await addPointsLog(openid, -order.points_used, `订单支付扣减积分（${order.order_no}）`)
          } catch (e) {
            console.error('[order] deduct points failed:', e)
          }
        }

        return {
          code: 0,
          message: 'success',
          data: { ...order, status: ORDER_STATUS.PENDING_SHIPMENT, pay_at: now },
        }
      }

      // ===== 取消订单 =====

      case 'cancel': {
        const orderRes = await orders.doc(event.id).get()
        const order = orderRes.data
        if (order.status !== ORDER_STATUS.PENDING_PAYMENT && order.status !== ORDER_STATUS.PENDING_SHIPMENT) {
          return { code: -1, message: '当前状态不可取消', data: null }
        }

        const now = Date.now()

        // --- P0-4: 归还库存（待付款/待发货阶段取消需归还） ---
        if (order.items && order.items.length > 0) {
          try {
            await returnStock(order.items)
          } catch (e) {
            console.error('[order] return stock on cancel failed:', e)
          }
        }

        // 退还已扣积分（仅待发货状态可能已扣积分）
        if (order.status === ORDER_STATUS.PENDING_SHIPMENT && order.points_used && order.points_used > 0) {
          try {
            await addPointsLog(openid, order.points_used, `取消订单退回积分（${order.order_no}）`)
          } catch (e) {
            console.error('[order] return points on cancel failed:', e)
          }
        }

        // 归还优惠券
        await restoreCoupon(openid, order.coupon_id)

        await orders.doc(event.id).update({
          data: { status: ORDER_STATUS.CANCELLED, cancel_at: now, updated_at: now },
        })
        return { code: 0, message: 'success', data: { ...order, status: ORDER_STATUS.CANCELLED } }
      }

      // ===== 发货 =====

      case 'ship': {
        const orderRes = await orders.doc(event.id).get()
        const order = orderRes.data
        if (order.status !== ORDER_STATUS.PENDING_SHIPMENT) {
          return { code: -1, message: '当前状态不可发货', data: null }
        }
        const company = event.logistics_company || '顺丰速运'
        const no = event.logistics_no || `SF${Date.now()}`
        const now = Date.now()
        const shipment = {
          logistics_company: company,
          logistics_no: no,
          traces: [
            { time: now - 3600 * 1000, description: '包裹已到达【杭州下沙中转场】' },
            { time: now - 1800 * 1000, description: '包裹已从【杭州下沙中转场】发出' },
            { time: now, description: `${company}已揽收，快递单号：${no}` },
          ],
        }
        await orders.doc(event.id).update({
          data: {
            status: ORDER_STATUS.PENDING_RECEIPT,
            deliver_at: now,
            shipment,
            updated_at: now,
          },
        })
        return {
          code: 0,
          message: 'success',
          data: { ...order, status: ORDER_STATUS.PENDING_RECEIPT, shipment, deliver_at: now },
        }
      }

      // ===== P0-2: 确认收货（发放积分） =====

      case 'confirmReceipt': {
        const orderRes = await orders.doc(event.id).get()
        const order = orderRes.data
        if (order.status !== ORDER_STATUS.PENDING_RECEIPT) {
          return { code: -1, message: '当前状态不可确认收货', data: null }
        }
        const now = Date.now()
        let shipment = order.shipment
        if (shipment && shipment.traces) {
          shipment = {
            ...shipment,
            traces: [
              { time: now, description: '买家已确认收货，交易完成' },
              ...shipment.traces,
            ],
          }
        }

        // --- P0-2: 发放积分（按实付金额 1:1） ---
        const pointsEarned = Math.floor(order.pay_amount / 100)
        if (pointsEarned > 0) {
          try {
            await addPointsLog(openid, pointsEarned, `订单完成返积分（${order.order_no}）`)
          } catch (e) {
            console.error('[order] earn points failed:', e)
          }
        }

        // --- P2-14: 订单完成后自动重算会员等级 ---
        await updateUserLevel(openid)

        await orders.doc(event.id).update({
          data: {
            status: ORDER_STATUS.COMPLETED,
            finish_at: now,
            shipment,
            updated_at: now,
          },
        })

        const updatedOrder = { ...order, status: ORDER_STATUS.COMPLETED, shipment, finish_at: now }
        return { code: 0, message: 'success', data: updatedOrder }
      }

      // === 退款相关 ===

      case 'applyRefund': {
        const orderRes = await orders.doc(event.id).get()
        const order = orderRes.data
        if (!order) return { code: -1, message: '订单不存在', data: null }
        if (order.refund && order.refund.status !== 50 && order.refund.status !== 40) {
          return { code: -1, message: '已有进行中的退款申请', data: null }
        }
        // 仅允许待发货/待收货/已完成的订单
        if (![20, 30, 40].includes(order.status)) {
          return { code: -1, message: '当前订单状态不可申请退款', data: null }
        }
        const now = Date.now()
        const refundType = order.status <= 20 ? 'only_refund' : 'refund_return'
        const refund = {
          _id: `refund-${now}`,
          type: refundType,
          reason: event.reason || '用户申请退款',
          amount: event.amount || order.pay_amount,
          status: 10, // 待处理
          created_at: now,
        }
        await orders.doc(event.id).update({
          data: { refund, updated_at: now },
        })
        return { code: 0, message: 'success', data: { ...order, refund } }
      }

      // --- P0-2: 同意退款（only_refund 直接完成 + 退回积分） ---

      case 'agreeRefund': {
        const orderRes = await orders.doc(event.id).get()
        const order = orderRes.data
        if (!order.refund || order.refund.status !== 10) {
          return { code: -1, message: '退款状态不允许此操作', data: null }
        }
        const now = Date.now()

        if (order.refund.type === 'only_refund') {
          // 仅退款：直接完成，归还库存 + 退回积分
          const updatedRefund = {
            ...order.refund,
            status: 40, // 直接完成
            approved_at: now,
            completed_at: now,
          }

          // 归还库存
          if (order.items && order.items.length > 0) {
            try { await returnStock(order.items) } catch (e) {}
          }

          // 退回积分（100% 退回 used 积分）
          if (order.points_used && order.points_used > 0) {
            try {
              await addPointsLog(openid, order.points_used, `退款退回积分（${order.order_no}）`)
            } catch (e) {
              console.error('[order] refund points failed:', e)
            }
          }

          // 发放退款积分（订单完成时发放的）
          const earnedPoints = Math.floor(order.pay_amount / 100)
          if (earnedPoints > 0 && order.status === ORDER_STATUS.COMPLETED) {
            try {
              await addPointsLog(openid, -earnedPoints, `退款扣回积分（${order.order_no}）`)
            } catch (e) {}
          }

          // 归还优惠券
          await restoreCoupon(openid, order.coupon_id)

          await orders.doc(event.id).update({
            data: {
              status: ORDER_STATUS.CANCELLED,
              refund: updatedRefund,
              cancel_at: now,
              updated_at: now,
            },
          })
          return {
            code: 0,
            message: 'success',
            data: { ...order, status: ORDER_STATUS.CANCELLED, refund: updatedRefund },
          }
        } else {
          // 退货退款：进入待寄回状态
          const updatedRefund = { ...order.refund, status: 20, approved_at: now }
          await orders.doc(event.id).update({
            data: { refund: updatedRefund, updated_at: now },
          })
          return { code: 0, message: 'success', data: { ...order, refund: updatedRefund } }
        }
      }

      case 'rejectRefund': {
        const orderRes = await orders.doc(event.id).get()
        const order = orderRes.data
        if (!order.refund || order.refund.status !== 10) {
          return { code: -1, message: '退款状态不允许此操作', data: null }
        }
        const now = Date.now()
        const updatedRefund = { ...order.refund, status: 50, reject_reason: event.reason || '商家拒绝', updated_at: now }
        await orders.doc(event.id).update({
          data: { refund: updatedRefund, updated_at: now },
        })
        return { code: 0, message: 'success', data: { ...order, refund: updatedRefund } }
      }

      case 'buyerShipBack': {
        const orderRes = await orders.doc(event.id).get()
        const order = orderRes.data
        if (!order.refund || order.refund.status !== 20) {
          return { code: -1, message: '退款状态不允许此操作', data: null }
        }
        const now = Date.now()
        const updatedRefund = {
          ...order.refund,
          status: 30,
          return_company: event.company || '顺丰速运',
          return_no: event.no || `SF${Date.now()}`,
          return_at: now,
          updated_at: now,
        }
        await orders.doc(event.id).update({
          data: { refund: updatedRefund, updated_at: now },
        })
        return { code: 0, message: 'success', data: { ...order, refund: updatedRefund } }
      }

      // --- P0-2: 完成退款（退回积分 + 归还库存） ---

      case 'completeRefund': {
        const orderRes = await orders.doc(event.id).get()
        const order = orderRes.data
        if (!order.refund || order.refund.status !== 30) {
          return { code: -1, message: '退款状态不允许此操作', data: null }
        }
        const now = Date.now()
        const updatedRefund = { ...order.refund, status: 40, completed_at: now, updated_at: now }

        // 归还库存
        if (order.items && order.items.length > 0) {
          try { await returnStock(order.items) } catch (e) {}
        }

        // 退回积分（used 积分 100% 退回）
        if (order.points_used && order.points_used > 0) {
          try {
            await addPointsLog(openid, order.points_used, `退货退款退回积分（${order.order_no}）`)
          } catch (e) {
            console.error('[order] completeRefund points failed:', e)
          }
        }

        // 扣回已发放的订单积分（若订单已完成）
        const earnedPoints = Math.floor(order.pay_amount / 100)
        if (earnedPoints > 0 && order.status >= ORDER_STATUS.COMPLETED) {
          try {
            await addPointsLog(openid, -earnedPoints, `退货退款扣回积分（${order.order_no}）`)
          } catch (e) {}
        }

        // 归还优惠券
        await restoreCoupon(openid, order.coupon_id)

        await orders.doc(event.id).update({
          data: {
            status: ORDER_STATUS.CANCELLED,
            refund: updatedRefund,
            cancel_at: now,
            updated_at: now,
          },
        })
        return {
          code: 0,
          message: 'success',
          data: { ...order, status: ORDER_STATUS.CANCELLED, refund: updatedRefund },
        }
      }

      // ===== 积分查询 =====

      case 'points': {
        const logs = await db.collection('points_log')
          .where({ _openid: openid })
          .orderBy('created_at', 'desc')
          .limit(100)
          .get()
        const total = logs.data.reduce((sum, l) => sum + l.delta, 0)
        return { code: 0, message: 'success', data: { total, logs: logs.data } }
      }

      default:
        return { code: -1, message: '未知操作', data: null }
    }
  } catch (err) {
    console.error('[order] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
