/**
 * login 云函数 mock
 * action: 'login' | 'check' | 'logout'
 */

const g = global as any
if (!g._userStore) g._userStore = {}
const openid = 'demo-user'

function loginMock(data: any = {}) {
  const action = data.action || 'login'

  if (action === 'login') {
    // 查找或创建用户
    let user = g._userStore[openid]
    if (!user) {
      user = {
        _id: `user-${openid}`,
        nickname: data.nickname || '微信用户',
        avatar: data.avatar || '',
        level: '普通会员',
        points: 100,
        growth: 0,
        status: 'active',
        created_at: Date.now(),
        updated_at: Date.now(),
      }
      g._userStore[openid] = user
    } else {
      user.updated_at = Date.now()
    }

    // 建立会话
    const token = `token_${openid}_${Date.now()}`
    g._session = { token, openid, login_at: Date.now() }

    return Promise.resolve({
      code: 0,
      message: 'success',
      data: {
        token,
        user: {
          _id: user._id,
          nickname: user.nickname,
          avatar: user.avatar,
          level: user.level,
          points: user.points,
          growth: user.growth,
        },
      },
    })
  }

  if (action === 'check') {
    const session = g._session
    const token = data.token
    if (!session || session.token !== token) {
      return Promise.resolve({ code: -1, message: '登录已过期', data: null })
    }
    const user = g._userStore[session.openid]
    if (!user) {
      return Promise.resolve({ code: -1, message: '用户不存在', data: null })
    }
    return Promise.resolve({
      code: 0,
      message: 'success',
      data: {
        user: {
          _id: user._id,
          nickname: user.nickname,
          avatar: user.avatar,
          level: user.level,
          points: user.points,
          growth: user.growth,
        },
      },
    })
  }

  if (action === 'logout') {
    g._session = null
    return Promise.resolve({ code: 0, message: 'success', data: true })
  }

  return Promise.resolve({ code: -1, message: '未知操作', data: null })
}

export default loginMock
