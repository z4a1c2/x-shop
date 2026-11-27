const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 统一规整：小写 + 去空白，便于「T恤」匹配「T 恤」这类输入
const normalize = (s) => String(s || '').toLowerCase().replace(/\s+/g, '')

/**
 * search 云函数
 * 入参：{ keyword: string, pageSize?: number }
 * 规则：按 商品名称 / 副标题 / 分类名 / 标签 模糊匹配（不区分大小写、忽略空白）
 */
exports.main = async (event, context) => {
  try {
    const keyword = normalize(event.keyword)
    if (!keyword) {
      return { code: 0, message: 'success', data: [] }
    }
    const pageSize = event.pageSize || 100

    // 分类名映射（用于按分类模糊搜索）
    const catMap = {}
    try {
      const cats = await db.collection('categories').limit(100).get()
      cats.data.forEach((c) => { catMap[c._id] = c.name })
    } catch (e) { /* 分类集合可能不存在 */ }

    // 拉取上架商品后内存过滤（演示数据量小）
    let all = []
    try {
      const res = await db.collection('products').where({ status: 1 }).limit(pageSize).get()
      all = res.data
    } catch (e) {
      return { code: 0, message: 'success', data: [] }
    }

    const list = all.filter((p) => {
      const hay = [
        p.name,
        p.subtitle,
        catMap[p.category_id],
        ...(Array.isArray(p.tags) ? p.tags : []),
      ]
        .map(normalize)
        .join(' ')
      return hay.includes(keyword)
    })

    return { code: 0, message: 'success', data: list }
  } catch (err) {
    console.error('[search] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
