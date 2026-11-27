import { products, categories } from '@/data/mock'
import { Product } from '@/types/product'

/**
 * search 云函数 mock
 * 入参：{ keyword: string }
 * 规则：按 商品名称 / 副标题 / 分类名 模糊匹配（与 search 云函数保持一致）
 */
const normalize = (s?: string) => String(s || '').toLowerCase().replace(/\s+/g, '')

export default function searchMock(data: { keyword?: string } = {}) {
  const keyword = normalize(data.keyword)
  if (!keyword) {
    return Promise.resolve({ code: 0, message: 'success', data: [] })
  }

  const catMap: Record<string, string> = {}
  categories.forEach((c) => { catMap[c._id] = c.name })

  const list: Product[] = products.filter((p) => {
    const hay = normalize([p.name, p.subtitle, catMap[p.category_id]].join(' '))
    return hay.includes(keyword)
  })

  return Promise.resolve({ code: 0, message: 'success', data: list })
}
