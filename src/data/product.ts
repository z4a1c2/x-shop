import { products, categories, banners } from '@/data/mock'
import { ProductListQuery } from '@/types/product'

/**
 * 云函数 mock — product
 * 在 H5 预览时，cloud.ts 的 callFunction('product', ...) 会 fallback 到此函数
 */
export default function productMock(data: ProductListQuery & { action?: string } = {}) {
  const action = data.action || (data.keyword || data.categoryId ? 'list' : 'list')

  // action: 'list' | 'detail'
  if (action === 'detail') {
    const id = data.categoryId || '' // 复用 id 字段
    const product = products.find((p) => p._id === id)
    return Promise.resolve({ code: 0, message: 'success', data: product || null })
  }

  let list = [...products]
  if (data.categoryId) {
    list = list.filter((p) => p.category_id === data.categoryId)
  }
  if (data.keyword) {
    const kw = data.keyword.toLowerCase()
    list = list.filter((p) => p.name.toLowerCase().includes(kw) || (p.subtitle || '').toLowerCase().includes(kw))
  }
  switch (data.sort) {
    case 'sales':
      list.sort((a, b) => b.sales - a.sales)
      break
    case 'price-asc':
      list.sort((a, b) => a.price_min - b.price_min)
      break
    case 'price-desc':
      list.sort((a, b) => b.price_max - a.price_max)
      break
    default:
      list.sort((a, b) => a.sort - b.sort)
  }
  return Promise.resolve({ code: 0, message: 'success', data: list })
}

export const mockCategories = categories
export const mockBanners = banners
