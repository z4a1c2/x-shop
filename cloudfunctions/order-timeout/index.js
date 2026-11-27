const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const ORDER_STATUS = {
  PENDING_PAYMENT: 10,
  CLOSED: 60,
}

// 恢复用户优惠券为未使用（超时关闭时归还下单锁定的券）
async function restoreCoupon(openid, couponId) {
  if (!couponId || !openid) return
  try {
    const res = await db
      .collection('user_coupons')
      .where({ _openid: openid, coupon_id: couponId, status: 'used' })
      .get()
    for (const c of res.data) {
      await db.collection('user_coupons').doc(c._id).update({ data: { status: 'unused' } })
    }
  } catch (e) {
    console.error('[order-timeout] restore coupon failed:', e)
  }
}

/**
 * 定时触发器：扫描 expire_at 已过期的待付款订单，自动置为已关闭（60）
 * 未支付订单不占用库存（库存在支付成功时才扣减），因此仅需归还优惠券
 */
exports.main = async () => {
  const now = Date.now()
  const orders = db.collection('orders')

  try {
    const res = await orders
      .where({ status: ORDER_STATUS.PENDING_PAYMENT, expire_at: _.lt(now) })
      .limit(100)
      .get()

    let closed = 0
    for (const order of res.data) {
      await restoreCoupon(order._openid, order.coupon_id)
      await orders.doc(order._id).update({
        data: { status: ORDER_STATUS.CLOSED, close_at: now, updated_at: now },
      })
      closed++
    }

    console.log(`[order-timeout] scanned=${res.data.length} closed=${closed}`)
    return { code: 0, message: 'success', data: { scanned: res.data.length, closed } }
  } catch (err) {
    console.error('[order-timeout] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
