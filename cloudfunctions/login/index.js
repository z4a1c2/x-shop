const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || 'demo-user'
  const action = event.action || 'login'

  try {
    if (action === 'login') {
      // 查找或创建用户
      let user = null
      try {
        const res = await db.collection('users').where({ _openid: openid }).limit(1).get()
        if (res.data.length > 0) {
          user = res.data[0]
        }
      } catch (e) { /* ignore */ }

      if (!user) {
        // 新用户注册
        const newUser = {
          nickname: event.nickname || '微信用户',
          avatar: event.avatar || '',
          level: '普通会员',
          points: 100,
          growth: 0,
          status: 'active',
          created_at: Date.now(),
          updated_at: Date.now(),
        }
        const addRes = await db.collection('users').add({ data: newUser })
        user = { _id: addRes._id, ...newUser }
      } else {
        // 更新登录时间
        await db.collection('users').doc(user._id).update({
          data: { updated_at: Date.now() },
        })
      }

      // 生成 token（实际项目用 JWT）
      const token = `token_${openid}_${Date.now()}`

      return {
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
            growth: user.growth || 0,
          },
        },
      }
    }

    if (action === 'check') {
      // 检查 token 有效性
      const token = event.token
      if (!token) {
        return { code: -1, message: '未登录', data: null }
      }
      const uid = token.split('_')[1]
      if (uid !== openid) {
        return { code: -1, message: '登录已过期', data: null }
      }
      try {
        const user = await db.collection('users').where({ _openid: openid }).limit(1).get()
        if (user.data.length === 0) {
          return { code: -1, message: '用户不存在', data: null }
        }
        return {
          code: 0,
          message: 'success',
          data: {
            user: {
              _id: user.data[0]._id,
              nickname: user.data[0].nickname,
              avatar: user.data[0].avatar,
              level: user.data[0].level,
              points: user.data[0].points,
              growth: user.data[0].growth || 0,
            },
          },
        }
      } catch (e) {
        return { code: -1, message: '校验失败', data: null }
      }
    }

    return { code: -1, message: '未知操作', data: null }
  } catch (err) {
    console.error('[login] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
