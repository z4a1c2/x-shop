// 收货地址

export interface Address {
  _id: string
  _openid?: string
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  is_default: boolean
  created_at?: number
  updated_at?: number
}
