const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 会员等级规则（按积分区间）
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

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || 'demo-user'
  const action = event.action || 'info'

  try {
    if (action === 'info') {
      let user = null
      try {
        const res = await db.collection('users').where({ _openid: openid }).limit(1).get()
        if (res.data.length > 0) user = res.data[0]
      } catch (e) { /* ignore */ }

      if (!user) {
        return {
          code: 0,
          message: 'success',
          data: {
            nickname: '微信用户',
            avatar: '',
            level: '普通会员',
            points: 100,
            coupon_count: 0,
          },
        }
      }

      // 统计优惠券数
      let couponCount = 0
      let points = user.points || 0
      try {
        const uc = await db.collection('user_coupons').where({ _openid: openid, status: 'unused' }).count()
        couponCount = uc.total
      } catch (e) { /* ignore */ }

      return {
        code: 0,
        message: 'success',
        data: {
          nickname: user.nickname || '微信用户',
          avatar: user.avatar || '',
          level: calcLevel(points),
          points,
          coupon_count: couponCount,
        },
      }
    }

    return { code: -1, message: '未知操作', data: null }
  } catch (err) {
    console.error('[user] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
