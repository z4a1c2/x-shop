import { Address } from '@/types/address'

/**
 * address 云函数 mock
 * action: 'list' | 'detail' | 'default' | 'save' | 'remove'
 */
const g = global as any
if (!g._addressStore) {
  g._addressStore = {
    'demo-user': [
      {
        _id: 'addr-1',
        name: '张三',
        phone: '13800138000',
        province: '浙江省',
        city: '杭州市',
        district: '西湖区',
        detail: '文三路 100 号 A 座 801 室',
        is_default: true,
      },
      {
        _id: 'addr-2',
        name: '李四',
        phone: '13900139000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detail: '陆家嘴环路 1000 号',
        is_default: false,
      },
    ],
  }
}
const store: Record<string, Address[]> = g._addressStore

export default function addressMock(data: any = {}) {
  const action = data.action || 'list'
  const openid = 'demo-user'

  if (!store[openid]) store[openid] = []
  const list = store[openid]

  switch (action) {
    case 'list':
      return Promise.resolve({ code: 0, message: 'success', data: list })

    case 'detail': {
      const item = list.find((i: Address) => i._id === data.id)
      return Promise.resolve({ code: 0, message: 'success', data: item || null })
    }

    case 'default': {
      const item = list.find((i: Address) => i.is_default) || list[0] || null
      return Promise.resolve({ code: 0, message: 'success', data: item })
    }

    case 'save': {
      if (data.id) {
        // 更新
        const idx = list.findIndex((i: Address) => i._id === data.id)
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...data, _id: data.id }
        }
      } else {
        // 新增
        const newAddr: Address = {
          _id: `addr-${Date.now()}`,
          name: data.name,
          phone: data.phone,
          province: data.province,
          city: data.city,
          district: data.district,
          detail: data.detail,
          is_default: !!data.is_default,
        }
        if (newAddr.is_default) {
          list.forEach((i: Address) => (i.is_default = false))
        }
        list.unshift(newAddr)
      }
      return Promise.resolve({ code: 0, message: 'success', data: list })
    }

    case 'remove': {
      const idx = list.findIndex((i: Address) => i._id === data.id)
      if (idx >= 0) list.splice(idx, 1)
      return Promise.resolve({ code: 0, message: 'success', data: list })
    }

    default:
      return Promise.resolve({ code: -1, message: '未知操作', data: null })
  }
}
