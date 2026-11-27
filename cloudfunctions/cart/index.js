const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 内存购物车（用于 demo，实际部署应使用云数据库）
const cartStore = {} // { openid: [ {sku_id, quantity, ...} ] }

const mockProducts = [
  {
    _id: 'p1', name: '纯棉情侣短袖 T 恤',
    skus: {
      'p1-sku1': { specs: { 颜色: '白色' }, price: 9900, stock: 50, image: 'https://picsum.photos/id/103/400/400' },
      'p1-sku2': { specs: { 颜色: '黑色' }, price: 12900, stock: 30, image: 'https://picsum.photos/id/119/400/400' },
    },
  },
]

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID || 'demo-user'
    const action = event.action || 'list'

    if (!cartStore[openid]) cartStore[openid] = []

    switch (action) {
      case 'list':
        return { code: 0, message: 'success', data: cartStore[openid] }

      case 'add': {
        const { skuId, productId, quantity = 1 } = event
        const exist = cartStore[openid].find((i) => i.sku_id === skuId)
        if (exist) {
          exist.quantity += quantity
        } else {
          cartStore[openid].push({
            _id: `ci-${skuId}-${Date.now()}`,
            product_id: productId,
            sku_id: skuId,
            quantity,
            checked: true,
            status: 1,
          })
        }
        return { code: 0, message: 'success', data: cartStore[openid] }
      }

      case 'update': {
        const { id, quantity, checked } = event
        const item = cartStore[openid].find((i) => i._id === id)
        if (item) {
          if (typeof quantity === 'number') item.quantity = Math.max(1, quantity)
          if (typeof checked === 'boolean') item.checked = checked
        }
        return { code: 0, message: 'success', data: cartStore[openid] }
      }

      case 'remove': {
        const ids = event.ids || []
        cartStore[openid] = cartStore[openid].filter((i) => !ids.includes(i._id))
        return { code: 0, message: 'success', data: cartStore[openid] }
      }

      default:
        return { code: -1, message: '未知操作', data: null }
    }
  } catch (err) {
    console.error('[cart] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
