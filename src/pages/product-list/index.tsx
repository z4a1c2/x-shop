import React, { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import classnames from 'classnames'
import { callFunction } from '@/services/cloud'
import { Product } from '@/types/product'
import ProductCard from '@/components/ProductCard'
import styles from './index.module.scss'

type SortKey = 'default' | 'sales' | 'price-asc' | 'price-desc'

const ProductListPage: React.FC = () => {
  const router = useRouter()
  const categoryId = router.params.categoryId || ''
  const keyword = decodeURIComponent(router.params.keyword || '')
  const [products, setProducts] = useState<Product[]>([])
  const [sort, setSort] = useState<SortKey>('default')

  const loadData = async (sortKey: SortKey = sort) => {
    try {
      const result: any = await callFunction('product', {
        action: 'list',
        categoryId: categoryId || undefined,
        keyword: keyword || undefined,
        sort: sortKey,
      })
      setProducts(result || [])
    } catch (err) {
      console.error('[ProductList] load error:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSort = (key: SortKey) => {
    const next = sort === key ? key : key
    // 价格切换
    if (key === 'price-asc' && sort === 'price-desc') {
      setSort('price-desc')
      loadData('price-desc')
      return
    }
    if (key === 'price-desc' && sort === 'price-asc') {
      setSort('price-asc')
      loadData('price-asc')
      return
    }
    setSort(next)
    loadData(next)
  }

  return (
    <View className={styles.page}>
      {/* 筛选栏 */}
      <View className={styles.filterBar}>
        <View
          className={classnames(styles.filterItem, sort === 'default' && styles.active)}
          onClick={() => handleSort('default')}
        >
          综合
        </View>
        <View
          className={classnames(styles.filterItem, sort === 'sales' && styles.active)}
          onClick={() => handleSort('sales')}
        >
          销量
        </View>
        <View
          className={classnames(
            styles.filterItem,
            (sort === 'price-asc' || sort === 'price-desc') && styles.active
          )}
          onClick={() => handleSort(sort === 'price-asc' ? 'price-desc' : 'price-asc')}
        >
          价格
          <Text className={styles.sortArrow}>
            {sort === 'price-asc' ? '↑' : sort === 'price-desc' ? '↓' : '↕'}
          </Text>
        </View>
      </View>

      {/* 商品列表 */}
      {products.length === 0 ? (
        <View className={styles.emptyTip}>暂无相关商品</View>
      ) : (
        <View className={styles.grid}>
          {products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </View>
      )}
    </View>
  )
}

export default ProductListPage
