const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const ORDER_STATUS = {
  PENDING_PAYMENT: 10,
  PENDING_SHIPMENT: 20,
}

// ============ 辅助函数（与 order 云函数保持一致） ============

async function addPointsLog(openid, delta, reason) {
  const pointsLogs = db.collection('points_log')
  const users = db.collection('users')

  await pointsLogs.add({
    data: {
      _openid: openid,
      delta,
      reason,
      balance: 0,
      created_at: Date.now(),
    },
  })

  const userRes = await users.where({ _openid: openid }).limit(1).get()
  if (userRes.data.length > 0) {
    const user = userRes.data[0]
    const newBalance = (user.points || 0) + delta
    await users.doc(user._id).update({
      data: { points: newBalance, updated_at: Date.now() },
    })
    const logs = await pointsLogs.where({ _openid: openid }).orderBy('created_at', 'desc').limit(1).get()
    if (logs.data.length > 0) {
      await pointsLogs.doc(logs.data[0]._id).update({ data: { balance: newBalance } })
    }
  } else {
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
    const logs = await pointsLogs.where({ _openid: openid }).orderBy('created_at', 'desc').limit(1).get()
    if (logs.data.length > 0) {
      await pointsLogs.doc(logs.data[0]._id).update({ data: { balance: initPoints } })
    }
  }
}

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
        if (typeof skuDoc.stock === 'number' && skuDoc.stock < item.quantity) {
          await transaction.rollback()
          return { success: false, error: `商品「${item.name}」库存不足（剩余 ${skuDoc.stock}）` }
        }
        await transaction.collection('skus').doc(item.sku_id).update({
          data: { stock: _.inc(-item.quantity), sales: _.inc(item.quantity) },
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

// ============ 主入口 ============

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || 'demo-user'
  const action = event.action || ''

  try {
    if (action === 'mockPay' || action === 'pay') {
      const orderId = event.orderId || event.id
      const orders = db.collection('orders')

      const orderRes = await orders.doc(orderId).get()
      const order = orderRes.data

      if (!order) {
        return { code: -1, message: '订单不存在', data: null }
      }
      if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
        return { code: -1, message: '订单状态不允许支付', data: null }
      }

      // 原子扣减库存
      if (order.items && order.items.length > 0) {
        const stockResult = await deductStock(order.items)
        if (!stockResult.success) {
          return { code: -1, message: `库存扣减失败：${stockResult.error}`, data: null }
        }
      }

      // 扣减用户使用的积分
      if (order.points_used && order.points_used > 0) {
        try {
          await addPointsLog(openid, -order.points_used, `订单支付扣减积分（${order.order_no}）`)
        } catch (e) {
          console.error('[pay] deduct points failed:', e)
        }
      }

      // 流转到待发货
      const now = Date.now()
      await orders.doc(orderId).update({
        data: {
          status: ORDER_STATUS.PENDING_SHIPMENT,
          pay_at: now,
          updated_at: now,
        },
      })

      return {
        code: 0,
        message: 'success',
        data: { ...order, status: ORDER_STATUS.PENDING_SHIPMENT, pay_at: now },
      }
    }

    return { code: -1, message: '未知操作', data: null }
  } catch (err) {
    console.error('[pay] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
