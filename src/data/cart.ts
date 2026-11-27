import { products } from '@/data/mock'
import { CartItem } from '@/types/cart'

/**
 * 云函数 mock — cart
 * action: 'list' | 'add' | 'update' | 'remove'
 */
export default function cartMock(data: any = {}) {
  const action = data.action || 'list'

  // 使用内存 mock 存储（H5 预览时有效，刷新会丢失）
  const globalAny = global as any
  if (!globalAny._cartStore) globalAny._cartStore = []

  const toCartItem = (skuId: string, productId: string, quantity: number): CartItem => {
    const product = products.find((p) => p._id === productId)
    const sku = product?.skus?.find((s) => s._id === skuId)
    return {
      _id: `ci-${skuId}-${Date.now()}`,
      product_id: productId,
      sku_id: skuId,
      product: product ? { _id: product._id, name: product.name, cover: product.cover } : undefined,
      sku: sku ? { _id: sku._id, specs: sku.specs, price: sku.price, stock: sku.stock } : undefined,
      quantity,
      checked: true,
      status: 1,
    }
  }

  switch (action) {
    case 'list':
      return Promise.resolve({ code: 0, message: 'success', data: globalAny._cartStore })

    case 'add': {
      const { skuId, productId, quantity = 1 } = data
      const existIdx = globalAny._cartStore.findIndex((i: CartItem) => i.sku_id === skuId)
      if (existIdx >= 0) {
        globalAny._cartStore[existIdx].quantity += quantity
      } else {
        globalAny._cartStore.push(toCartItem(skuId, productId, quantity))
      }
      return Promise.resolve({ code: 0, message: 'success', data: globalAny._cartStore })
    }

    case 'update': {
      const { id, quantity, checked } = data
      const item = globalAny._cartStore.find((i: CartItem) => i._id === id)
      if (item) {
        if (typeof quantity === 'number') item.quantity = Math.max(1, quantity)
        if (typeof checked === 'boolean') item.checked = checked
      }
      return Promise.resolve({ code: 0, message: 'success', data: globalAny._cartStore })
    }

    case 'remove': {
      const { ids } = data
      globalAny._cartStore = globalAny._cartStore.filter((i: CartItem) => !ids.includes(i._id))
      return Promise.resolve({ code: 0, message: 'success', data: globalAny._cartStore })
    }

    default:
      return Promise.resolve({ code: 0, message: 'success', data: globalAny._cartStore })
  }
}
