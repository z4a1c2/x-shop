import React, { useEffect, useState } from 'react'
import { View, Text, Image, ScrollView, Swiper, SwiperItem } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import { Product, Banner } from '@/types/product'
import { mockCategories, mockBanners } from '@/data/product'
import ProductCard from '@/components/ProductCard'
import styles from './index.module.scss'

const HomePage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const [categories] = useState(mockCategories)

  const loadData = async () => {
    try {
      const result: any = await callFunction('product', { action: 'list' })
      setProducts(result || [])
      setBanners(mockBanners)
    } catch (err) {
      console.error('[HomePage] load error:', err)
      setProducts([])
      setBanners(mockBanners)
    }
  }

  useDidShow(() => {
    loadData()
  })

  useEffect(() => {
    loadData()
  }, [])

  const handleSearch = () => {
    Taro.navigateTo({ url: '/pages/search/index' })
  }

  const handleCategoryClick = (categoryId: string) => {
    Taro.navigateTo({ url: `/pages/product-list/index?categoryId=${categoryId}` })
  }

  const handleBannerClick = (link?: string) => {
    if (link) Taro.navigateTo({ url: link })
  }

  return (
    <View className={styles.page}>
      {/* 顶部搜索栏 */}
      <View className={styles.header}>
        <View className={styles.searchBar} onClick={handleSearch}>
          <Text className={styles.searchIcon}>🔍</Text>
          <Text className={styles.searchText}>搜索商品 / 品牌 / 品类</Text>
        </View>
      </View>

      {/* Banner 区域 */}
      <View className={styles.bannerSection}>
        <Swiper
          className={styles.banner}
          indicatorDots
          autoplay
          interval={3500}
          duration={500}
          circular
        >
          {banners.map((b) => (
            <SwiperItem key={b.id}>
              <Image
                className={styles.bannerImage}
                src={b.image}
                mode='aspectFill'
                onClick={() => handleBannerClick(b.link)}
              />
            </SwiperItem>
          ))}
        </Swiper>
      </View>

      {/* 金刚区分类 */}
      <View className={styles.categorySection}>
        <View className={styles.categoryGrid}>
          {categories.map((cat) => (
            <View
              key={cat._id}
              className={styles.categoryItem}
              onClick={() => handleCategoryClick(cat._id)}
            >
              <View className={styles.categoryIcon}>
                {cat.name.charAt(0)}
              </View>
              <Text className={styles.categoryName}>{cat.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 推荐商品 */}
      <View className={styles.sectionHeader}>
        <Text className={styles.sectionTitle}>为你推荐</Text>
        <Text className={styles.sectionMore} onClick={() => Taro.switchTab({ url: '/pages/category/index' })}>
          查看更多 ›
        </Text>
      </View>

      <View className={styles.productGrid}>
        {products.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </View>

      {products.length === 0 && (
        <View className={styles.emptyTip}>暂无商品，稍后再来看看吧～</View>
      )}
    </View>
  )
}

export default HomePage
