/**
 * user 云函数 mock
 * action: 'info'
 */

const g = global as any
const openid = 'demo-user'

// 幂等初始化 points log store（防止 order mock 尚未 import 时 user mock 读不到数据）
if (!g._pointsLogStore) g._pointsLogStore = {}
if (!g._pointsLogStore[openid]) {
  g._pointsLogStore[openid] = [
    {
      _id: 'init',
      delta: 100,
      reason: '新用户注册赠送',
      balance: 100,
      created_at: Date.now() - 7 * 86400 * 1000,
    },
  ]
}

function getUserCouponCount() {
  const userCoupons = g._userCouponStore?.[openid] || []
  return userCoupons.length
}

function getCurrentPoints() {
  const pointsList = g._pointsLogStore?.[openid] || []
  return pointsList.reduce((sum: number, item: { delta: number }) => sum + item.delta, 0)
}

// 会员等级规则（与 user 云函数保持一致）
const LEVEL_THRESHOLDS = [
  { level: '钻石会员', min: 20000 },
  { level: '金卡会员', min: 5000 },
  { level: '银卡会员', min: 1000 },
  { level: '普通会员', min: 0 },
]

function calcLevel(points: number) {
  const p = points || 0
  const matched = LEVEL_THRESHOLDS.find((l) => p >= l.min)
  return matched ? matched.level : '普通会员'
}

export default function userMock(data: { action?: string } = {}) {
  const action = data.action || 'info'

  if (action === 'info') {
    const points = getCurrentPoints()
    return Promise.resolve({
      code: 0,
      message: 'success',
      data: {
        nickname: '微信用户',
        avatar: '',
        level: calcLevel(points),
        points,
        coupon_count: getUserCouponCount(),
      },
    })
  }

  return Promise.resolve({ code: -1, message: '未知操作', data: null })
}
