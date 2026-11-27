// 购物车相关类型

export interface CartItem {
  _id: string // 购物车记录 id
  product_id: string
  sku_id: string
  product?: {
    _id: string
    name: string
    cover: string
  }
  sku?: {
    _id: string
    specs: Record<string, string>
    price: number
    stock: number
    image?: string
  }
  quantity: number
  checked: boolean
  status?: number // 1 正常 0 下架
}
