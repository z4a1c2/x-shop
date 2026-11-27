/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 云数据库种子数据导入脚本（P1-12）
 *
 * 用途：首次部署后将 mock 数据一键导入云数据库，避免线上 products / skus /
 *       categories / addresses / coupons 集合为空导致无数据可展示。
 *
 * 运行方式（需 Node 14+）：
 *   TCB_ENV=<你的云环境ID> npx ts-node --transpile-only scripts/seed-data.ts
 *
 * 注意：
 *   - 脚本会先清空目标集合再写入，仅用于初始化环境，请勿在有生产数据的库上直接执行。
 *   - 本地运行需具备云开发管理凭据；推荐在云开发控制台或云函数中执行。
 */
const path = require('path')
const Module = require('module')

// 让 '@/' 别名在独立脚本中可解析（与 tsconfig paths 保持一致）
const origResolve = Module._resolveFilename
Module._resolveFilename = function (request: string, ...args: any[]) {
  if (request.indexOf('@/') === 0) {
    request = path.join(__dirname, '..', 'src', request.slice(2))
  }
  return origResolve.call(this, request, ...args)
}

const cloud = require('wx-server-sdk')
const { products, categories } = require('../src/data/mock')

// 优惠券模板（与 coupon / order 云函数保持一致）
const COUPON_TEMPLATES = [
  { _id: 'c1', name: '新人满 199 减 20', amount: 2000, threshold: 19900, description: '全场商品可用', expire_at: Date.now() + 30 * 24 * 3600 * 1000, status: 'active' },
  { _id: 'c2', name: '满 99 减 10', amount: 1000, threshold: 9900, description: '服装品类专享', expire_at: Date.now() + 15 * 24 * 3600 * 1000, status: 'active' },
  { _id: 'c3', name: '无门槛 5 元券', amount: 500, threshold: 0, description: '限首次下单使用', expire_at: Date.now() + 7 * 24 * 3600 * 1000, status: 'active' },
]

// 示例收货地址
const DEMO_ADDRESSES = [
  { _id: 'addr-1', name: '张三', phone: '13800138000', province: '浙江省', city: '杭州市', district: '西湖区', detail: '文三路 100 号 A 座 801 室', is_default: true },
  { _id: 'addr-2', name: '李四', phone: '13900139000', province: '上海市', city: '上海市', district: '浦东新区', detail: '陆家嘴环路 1000 号', is_default: false },
]

cloud.init({ env: process.env.TCB_ENV || cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function seedCollection(name: string, docs: any[]) {
  const coll = db.collection(name)
  // 清空已有数据（仅用于初始化环境）
  try {
    await coll.where({ _id: db.command.neq('') }).remove()
  } catch (e) {
    /* 集合可能尚未创建，忽略 */
  }
  let count = 0
  for (const doc of docs) {
    const { _id, ...rest } = doc
    try {
      await coll.add({ data: { ...rest, _id } })
      count++
    } catch (e) {
      console.error(`[seed] ${name} 写入失败:`, e)
    }
  }
  console.log(`[seed] ${name}: ${count}/${docs.length}`)
}

async function main() {
  // 商品（保留内嵌 skus，兼容 order 云函数的回退逻辑）
  await seedCollection('products', products)

  // 独立 skus 集合（order 云函数优先查询该集合）
  const skus = products.reduce((acc: any[], p: any) => acc.concat(p.skus || []), [])
  await seedCollection('skus', skus)

  // 分类
  await seedCollection('categories', categories)

  // 收货地址（示例）
  await seedCollection('addresses', DEMO_ADDRESSES)

  // 优惠券模板
  await seedCollection('coupons', COUPON_TEMPLATES)

  console.log('[seed] 完成')
}

main().catch((err) => {
  console.error('[seed] 失败:', err)
  process.exit(1)
})
