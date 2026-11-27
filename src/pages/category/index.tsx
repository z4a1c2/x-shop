import React, { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { mockCategories } from '@/data/product'
import { Category } from '@/types/product'
import styles from './index.module.scss'

// Mock 二级分类
const subCategories: Record<string, Category[]> = {
  c1: [
    { _id: 'c1-1', name: 'T恤', parent_id: 'c1', level: 2, sort: 1, status: 1 },
    { _id: 'c1-2', name: '衬衫', parent_id: 'c1', level: 2, sort: 2, status: 1 },
    { _id: 'c1-3', name: '外套', parent_id: 'c1', level: 2, sort: 3, status: 1 },
    { _id: 'c1-4', name: '裤子', parent_id: 'c1', level: 2, sort: 4, status: 1 },
  ],
  c2: [
    { _id: 'c2-1', name: '手机', parent_id: 'c2', level: 2, sort: 1, status: 1 },
    { _id: 'c2-2', name: '耳机', parent_id: 'c2', level: 2, sort: 2, status: 1 },
    { _id: 'c2-3', name: '手表', parent_id: 'c2', level: 2, sort: 3, status: 1 },
  ],
  c3: [
    { _id: 'c3-1', name: '家具', parent_id: 'c3', level: 2, sort: 1, status: 1 },
    { _id: 'c3-2', name: '家纺', parent_id: 'c3', level: 2, sort: 2, status: 1 },
  ],
  c4: [
    { _id: 'c4-1', name: '护肤', parent_id: 'c4', level: 2, sort: 1, status: 1 },
    { _id: 'c4-2', name: '彩妆', parent_id: 'c4', level: 2, sort: 2, status: 1 },
  ],
  c5: [
    { _id: 'c5-1', name: '咖啡豆', parent_id: 'c5', level: 2, sort: 1, status: 1 },
    { _id: 'c5-2', name: '挂耳咖啡', parent_id: 'c5', level: 2, sort: 2, status: 1 },
  ],
}

const CategoryPage: React.FC = () => {
  const [categories] = useState<Category[]>(mockCategories)
  const [activeId, setActiveId] = useState<string>(mockCategories[0]._id)

  const activeCategory = categories.find((c) => c._id === activeId)
  const children = subCategories[activeId] || []

  const handleCategoryClick = (_subId: string) => {
    // 跳转到商品列表
    Taro.navigateTo({ url: `/pages/product-list/index?categoryId=${activeId}` })
  }

  return (
    <View className={styles.page}>
      <View className={styles.container}>
        {/* 左侧一级分类 */}
        <ScrollView className={styles.leftSide} scrollY>
          {categories.map((cat) => (
            <View
              key={cat._id}
              className={`${styles.leftItem} ${activeId === cat._id ? styles.active : ''}`}
              onClick={() => setActiveId(cat._id)}
            >
              <Text className={styles.leftText}>{cat.name}</Text>
              {activeId === cat._id && <View className={styles.leftBar} />}
            </View>
          ))}
        </ScrollView>

        {/* 右侧二级分类 + 商品预览 */}
        <ScrollView className={styles.rightSide} scrollY>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>{activeCategory?.name} · 全部分类</Text>
          </View>

          {/* 二级分类 */}
          <View className={styles.subGrid}>
            {children.map((sub) => (
              <View key={sub._id} className={styles.subItem} onClick={() => handleCategoryClick(sub._id)}>
                <View className={styles.subIcon}>
                  {sub.name.charAt(0)}
                </View>
                <Text className={styles.subName}>{sub.name}</Text>
              </View>
            ))}
          </View>

          {/* 查看全部入口 */}
          <View
            className={styles.viewAll}
            onClick={() => Taro.navigateTo({ url: `/pages/product-list/index?categoryId=${activeId}` })}
          >
            <Text>查看「{activeCategory?.name}」全部商品</Text>
            <Text style={{ marginLeft: '8rpx' }}>›</Text>
          </View>
        </ScrollView>
      </View>
    </View>
  )
}

export default CategoryPage
