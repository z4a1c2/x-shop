const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 优惠券模板
const couponTemplates = [
  {
    _id: 'c1',
    name: '新人满 199 减 20',
    amount: 2000,
    threshold: 19900,
    description: '全场商品可用',
    expire_at: Date.now() + 30 * 24 * 3600 * 1000,
    status: 'active',
  },
  {
    _id: 'c2',
    name: '满 99 减 10',
    amount: 1000,
    threshold: 9900,
    description: '服装品类专享',
    expire_at: Date.now() + 15 * 24 * 3600 * 1000,
    status: 'active',
  },
  {
    _id: 'c3',
    name: '无门槛 5 元券',
    amount: 500,
    threshold: 0,
    description: '限首次下单使用',
    expire_at: Date.now() + 7 * 24 * 3600 * 1000,
    status: 'active',
  },
]

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || 'demo-user'
  const action = event.action || 'list'

  try {
    if (action === 'list') {
      // 查询用户已领取的券
      const userCoupons = await db.collection('user_coupons').where({ _openid: openid }).get()
      const receivedIds = userCoupons.data.map((uc) => uc.coupon_id)

      const type = event.type || 'available'
      let list = couponTemplates.map((t) => ({
        ...t,
        received: receivedIds.includes(t._id),
        status: t.expire_at < Date.now() ? 'expired' : 'available',
      }))

      if (type === 'available') {
        list = list.filter((c) => c.status === 'available' && !c.received)
      } else if (type === 'used') {
        list = list.filter((c) => c.received && c.status === 'available')
      } else if (type === 'expired') {
        list = list.filter((c) => c.status === 'expired')
      }

      return { code: 0, message: 'success', data: list }
    }

    if (action === 'usable') {
      // 当前用户已领取且未使用、未过期的优惠券（供下单页抵扣）
      const userCoupons = await db
        .collection('user_coupons')
        .where({ _openid: openid, status: 'unused' })
        .get()
      const now = Date.now()
      const list = userCoupons.data
        .map((uc) => {
          const t = couponTemplates.find((x) => x._id === uc.coupon_id)
          if (!t) return null
          return {
            coupon_id: t._id,
            user_coupon_id: uc._id,
            name: t.name,
            amount: t.amount,
            threshold: t.threshold,
            description: t.description,
            expire_at: t.expire_at,
            expired: t.expire_at < now,
          }
        })
        .filter((c) => c && !c.expired)
      return { code: 0, message: 'success', data: list }
    }

    if (action === 'receive') {
      const coupon_id = event.coupon_id
      // 检查是否已领取
      const exist = await db.collection('user_coupons').where({ _openid: openid, coupon_id }).get()
      if (exist.data.length > 0) {
        return { code: -1, message: '已领取过该优惠券', data: null }
      }
      await db.collection('user_coupons').add({
        data: {
          coupon_id,
          received_at: Date.now(),
          status: 'unused',
        },
      })
      return { code: 0, message: 'success', data: true }
    }

    return { code: -1, message: '未知操作', data: null }
  } catch (err) {
    console.error('[coupon] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
