const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || 'demo-user'
  const action = event.action || 'list'
  const addresses = db.collection('addresses')

  try {
    switch (action) {
      case 'list': {
        const res = await addresses.where({ _openid: openid }).orderBy('is_default', 'desc').get()
        return { code: 0, message: 'success', data: res.data }
      }

      case 'detail': {
        const res = await addresses.doc(event.id).get()
        return { code: 0, message: 'success', data: res.data }
      }

      case 'default': {
        // 先取默认，没有则取第一条
        let res = await addresses.where({ _openid: openid, is_default: true }).limit(1).get()
        if (res.data.length === 0) {
          res = await addresses.where({ _openid: openid }).limit(1).get()
        }
        return { code: 0, message: 'success', data: res.data[0] || null }
      }

      case 'save': {
        const { id, ...data } = event
        if (id) {
          // 更新
          await addresses.doc(id).update({ data: { ...data, updated_at: Date.now() } })
          return { code: 0, message: 'success', data: { _id: id, ...data } }
        } else {
          // 新增
          const addRes = await addresses.add({
            data: { ...data, created_at: Date.now(), updated_at: Date.now() },
          })
          return { code: 0, message: 'success', data: { _id: addRes._id, ...data } }
        }
      }

      case 'remove': {
        await addresses.doc(event.id).remove()
        return { code: 0, message: 'success', data: true }
      }

      default:
        return { code: -1, message: '未知操作', data: null }
    }
  } catch (err) {
    console.error('[address] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
