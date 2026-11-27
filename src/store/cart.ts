import { create } from 'zustand'
import Taro from '@tarojs/taro'
import { CartItem } from '@/types/cart'

const STORAGE_KEY = 'x-shop:cart'

/** 从本地存储读取购物车（失败时返回空数组） */
function loadFromStorage(): CartItem[] {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    if (raw && Array.isArray(raw)) {
      return raw as CartItem[]
    }
  } catch (err) {
    console.error('[Cart] load storage error:', err)
  }
  return []
}

/** 写入本地存储（失败时静默忽略，不影响内存态） */
function saveToStorage(items: CartItem[]) {
  try {
    Taro.setStorageSync(STORAGE_KEY, items)
  } catch (err) {
    console.error('[Cart] save storage error:', err)
  }
}

interface CartState {
  items: CartItem[]
  initialized: boolean
  setItems: (items: CartItem[]) => void
  addItem: (skuId: string, productId: string, quantity?: number, product?: CartItem['product'], sku?: CartItem['sku']) => void
  updateItem: (id: string, patch: Partial<Pick<CartItem, 'quantity' | 'checked'>>) => void
  removeItems: (ids: string[]) => void
  toggleAll: (checked: boolean) => void
  clear: () => void
  getTotalCount: () => number
  getTotalPrice: () => number // 单位：分
}

export const useCartStore = create<CartState>((set, get) => ({
  items: loadFromStorage(),
  initialized: false,

  setItems: (items) => {
    saveToStorage(items)
    set({ items, initialized: true })
  },

  addItem: (skuId, productId, quantity = 1, product, sku) => {
    const items = [...get().items]
    const idx = items.findIndex((i) => i.sku_id === skuId)
    if (idx >= 0) {
      items[idx] = { ...items[idx], quantity: items[idx].quantity + quantity }
      // 更新 product/sku 信息（如果有传）
      if (product) items[idx].product = product
      if (sku) items[idx].sku = sku
    } else {
      items.push({
        _id: `ci-${skuId}-${Date.now()}`,
        product_id: productId,
        sku_id: skuId,
        quantity,
        checked: true,
        status: 1,
        product,
        sku,
      })
    }
    saveToStorage(items)
    set({ items })
  },

  updateItem: (id, patch) => {
    const items = get().items.map((i) => (i._id === id ? { ...i, ...patch } : i))
    saveToStorage(items)
    set({ items })
  },

  removeItems: (ids) => {
    const items = get().items.filter((i) => !ids.includes(i._id))
    saveToStorage(items)
    set({ items })
  },

  toggleAll: (checked) => {
    const items = get().items.map((i) => ({ ...i, checked }))
    saveToStorage(items)
    set({ items })
  },

  clear: () => {
    saveToStorage([])
    set({ items: [] })
  },

  getTotalCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  getTotalPrice: () =>
    get().items
      .filter((i) => i.checked && i.sku)
      .reduce((sum, i) => sum + i.sku!.price * i.quantity, 0),
}))
