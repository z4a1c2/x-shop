const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 商品 mock 数据（实际部署时应从云数据库读取）
const mockProducts = [
  {
    _id: 'p1',
    category_id: 'c1',
    name: '纯棉情侣短袖 T 恤',
    subtitle: '夏季新品 · 宽松显瘦',
    cover: 'https://picsum.photos/id/103/400/400',
    images: ['https://picsum.photos/id/103/750/750'],
    price_min: 9900,
    price_max: 19900,
    sales: 1280,
    status: 1,
    sort: 1,
    skus: [
      { _id: 'p1-sku1', specs: { 颜色: '白色' }, price: 9900, stock: 50, sales: 500, image: 'https://picsum.photos/id/103/400/400', status: 1 },
      { _id: 'p1-sku2', specs: { 颜色: '黑色' }, price: 12900, stock: 30, sales: 400, image: 'https://picsum.photos/id/119/400/400', status: 1 },
      { _id: 'p1-sku3', specs: { 颜色: '墨绿' }, price: 19900, stock: 20, sales: 380, image: 'https://picsum.photos/id/220/400/400', status: 1 },
    ],
  },
  {
    _id: 'p2',
    category_id: 'c2',
    name: '降噪无线蓝牙耳机 Pro',
    subtitle: '主动降噪 · 长续航',
    cover: 'https://picsum.photos/id/1/400/400',
    images: ['https://picsum.photos/id/1/750/750'],
    price_min: 59900,
    price_max: 89900,
    sales: 860,
    status: 1,
    sort: 2,
    skus: [
      { _id: 'p2-sku1', specs: { 颜色: '曜石黑' }, price: 69900, stock: 40, sales: 600, image: 'https://picsum.photos/id/1/400/400', status: 1 },
    ],
  },
  {
    _id: 'p3',
    category_id: 'c3',
    name: '北欧风实木餐桌',
    subtitle: '简约现代 · 小户型',
    cover: 'https://picsum.photos/id/225/400/400',
    images: ['https://picsum.photos/id/225/750/750'],
    price_min: 89900,
    price_max: 129900,
    sales: 240,
    status: 1,
    sort: 3,
    skus: [
      { _id: 'p3-sku1', specs: { 规格: '1.4m' }, price: 99900, stock: 15, sales: 100, image: 'https://picsum.photos/id/225/400/400', status: 1 },
    ],
  },
  {
    _id: 'p4',
    category_id: 'c4',
    name: '玻尿酸补水精华液',
    subtitle: '持久保湿 · 敏感肌可用',
    cover: 'https://picsum.photos/id/230/400/400',
    images: ['https://picsum.photos/id/230/750/750'],
    price_min: 15900,
    price_max: 25900,
    sales: 3200,
    status: 1,
    sort: 4,
    skus: [
      { _id: 'p4-sku1', specs: { 规格: '30ml' }, price: 18900, stock: 200, sales: 1500, image: 'https://picsum.photos/id/230/400/400', status: 1 },
    ],
  },
  {
    _id: 'p5',
    category_id: 'c5',
    name: '手冲精品咖啡豆 500g',
    subtitle: '云南小粒 · 中度烘焙',
    cover: 'https://picsum.photos/id/292/400/400',
    images: ['https://picsum.photos/id/292/750/750'],
    price_min: 8800,
    price_max: 15800,
    sales: 2100,
    status: 1,
    sort: 5,
    skus: [
      { _id: 'p5-sku1', specs: { 规格: '500g' }, price: 10800, stock: 80, sales: 900, image: 'https://picsum.photos/id/292/400/400', status: 1 },
    ],
  },
  {
    _id: 'p6',
    category_id: 'c1',
    name: '轻薄牛仔外套',
    subtitle: '春秋百搭 · 复古水洗',
    cover: 'https://picsum.photos/id/250/400/400',
    images: ['https://picsum.photos/id/250/750/750'],
    price_min: 29900,
    price_max: 49900,
    sales: 680,
    status: 1,
    sort: 6,
    skus: [
      { _id: 'p6-sku1', specs: { 颜色: '浅蓝色' }, price: 35900, stock: 25, sales: 300, image: 'https://picsum.photos/id/250/400/400', status: 1 },
    ],
  },
  {
    _id: 'p7',
    category_id: 'c2',
    name: '智能手表运动版',
    subtitle: '心率监测 · 50 米防水',
    cover: 'https://picsum.photos/id/9/400/400',
    images: ['https://picsum.photos/id/9/750/750'],
    price_min: 79900,
    price_max: 129900,
    sales: 1500,
    status: 1,
    sort: 7,
    skus: [
      { _id: 'p7-sku1', specs: { 颜色: '石墨黑' }, price: 99900, stock: 30, sales: 800, image: 'https://picsum.photos/id/9/400/400', status: 1 },
    ],
  },
  {
    _id: 'p8',
    category_id: 'c3',
    name: '记忆棉护颈枕头',
    subtitle: '慢回弹 · 人体工学',
    cover: 'https://picsum.photos/id/582/400/400',
    images: ['https://picsum.photos/id/582/750/750'],
    price_min: 7900,
    price_max: 12900,
    sales: 4300,
    status: 1,
    sort: 8,
    skus: [
      { _id: 'p8-sku1', specs: { 规格: '标准款' }, price: 9900, stock: 500, sales: 2000, image: 'https://picsum.photos/id/582/400/400', status: 1 },
    ],
  },
]

/**
 * product 云函数
 * 入参：{ action: 'list'|'detail', categoryId?, keyword?, sort? }
 */
exports.main = async (event, context) => {
  try {
    const action = event.action || 'list'

    if (action === 'detail') {
      const id = event.categoryId || ''
      const product = mockProducts.find((p) => p._id === id)
      return { code: 0, message: 'success', data: product || null }
    }

    // list
    let list = [...mockProducts]
    if (event.categoryId) list = list.filter((p) => p.category_id === event.categoryId)
    if (event.keyword) {
      const kw = String(event.keyword).toLowerCase()
      list = list.filter(
        (p) => p.name.toLowerCase().includes(kw) || (p.subtitle || '').toLowerCase().includes(kw)
      )
    }
    switch (event.sort) {
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

    return { code: 0, message: 'success', data: list }
  } catch (err) {
    console.error('[product] error:', err)
    return { code: -1, message: err.message || '服务异常', data: null }
  }
}
