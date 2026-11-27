/**
 * coupon 云函数 mock
 * action: 'list' | 'receive'
 */

const g = global as any
if (!g._couponStore) g._couponStore = {}
if (!g._userCouponStore) g._userCouponStore = {}

const couponTemplates = [
  {
    _id: 'c1',
    name: '新人满 199 减 20',
    amount: 2000, // 分
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

const openid = 'demo-user'

interface UserCoupon {
  _id: string
  coupon_id: string
  status: 'unused' | 'used'
  received_at?: number
  used_at?: number
}

interface UsableCoupon {
  coupon_id: string
  user_coupon_id: string
  name: string
  amount: number
  threshold: number
  description: string
  expire_at: number
  expired: boolean
}

interface CouponActionPayload {
  action?: string
  type?: 'available' | 'used' | 'expired'
  coupon_id?: string
}

function getUserCoupons(): UserCoupon[] {
  if (!g._userCouponStore[openid]) g._userCouponStore[openid] = []
  return g._userCouponStore[openid]
}

export default function couponMock(data: CouponActionPayload = {}) {
  const action = data.action || 'list'

  if (action === 'list') {
    const type = data.type || 'available'
    const userCoupons = getUserCoupons()
    const receivedIds = userCoupons.map((uc) => uc.coupon_id)

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

    return Promise.resolve({ code: 0, message: 'success', data: list })
  }

  if (action === 'usable') {
    // 当前用户已领取且未使用、未过期的优惠券（供下单页抵扣）
    const now = Date.now()
    const userCoupons = getUserCoupons()
    const list = userCoupons
      .filter((uc) => uc.status === 'unused')
      .map((uc): UsableCoupon | null => {
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
      .filter((c): c is UsableCoupon => !!c && !c.expired)
    return Promise.resolve({ code: 0, message: 'success', data: list })
  }

  if (action === 'receive') {
    const coupon_id = data.coupon_id || ''
    const userCoupons = getUserCoupons()
    const exists = userCoupons.find((uc) => uc.coupon_id === coupon_id)
    if (exists) {
      return Promise.resolve({ code: -1, message: '已领取过该优惠券', data: null })
    }
    userCoupons.push({
      _id: `user-coupon-${Date.now()}`,
      coupon_id,
      received_at: Date.now(),
      status: 'unused',
    })
    return Promise.resolve({ code: 0, message: 'success', data: true })
  }

  return Promise.resolve({ code: -1, message: '未知操作', data: null })
}
