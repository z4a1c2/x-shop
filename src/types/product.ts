// 商品相关类型

export interface ProductSku {
  _id: string
  product_id: string
  specs: Record<string, string>
  price: number // 分
  original_price?: number
  stock: number
  sales?: number
  image?: string
  status: number
}

export interface Product {
  _id: string
  category_id: string
  name: string
  subtitle?: string
  cover: string
  images: string[]
  detail?: string
  price_min: number // 分
  price_max: number // 分
  sales: number
  status: number
  sort: number
  skus?: ProductSku[]
}

export interface Category {
  _id: string
  name: string
  parent_id: string
  level: number
  icon?: string
  sort: number
  status: number
}

export interface Banner {
  id: string
  image: string
  link?: string
}

export interface ProductListQuery {
  categoryId?: string
  keyword?: string
  sort?: 'default' | 'sales' | 'price-asc' | 'price-desc'
  page?: number
  pageSize?: number
}
