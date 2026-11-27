import React, { useState, useEffect } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import { Product } from '@/types/product'
import ProductCard from '@/components/ProductCard'
import styles from './index.module.scss'

const HOT_KEYWORDS = ['T恤', '耳机', '咖啡豆', '精华液', '牛仔外套', '手表', '实木餐桌']

const SearchPage: React.FC = () => {
  const [keyword, setKeyword] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [results, setResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    // 读取搜索历史
    try {
      const stored = Taro.getStorageSync('search_history')
      if (stored) setHistory(JSON.parse(stored))
    } catch (e) { /* empty */ }
  }, [])

  const saveHistory = (kw: string) => {
    const next = [kw, ...history.filter((h) => h !== kw)].slice(0, 10)
    setHistory(next)
    try {
      Taro.setStorageSync('search_history', JSON.stringify(next))
    } catch (e) { /* empty */ }
  }

  const handleSearch = async () => {
    const kw = keyword.trim()
    if (!kw) return
    setSearching(true)
    setSearched(true)
    try {
      saveHistory(kw)
      const data: any = await callFunction('search', { keyword: kw })
      setResults(data || [])
    } catch (err) {
      console.error('[Search] error:', err)
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleHotClick = (kw: string) => {
    setKeyword(kw)
    Taro.navigateTo({ url: `/pages/product-list/index?keyword=${encodeURIComponent(kw)}` })
  }

  const handleHistoryClick = (kw: string) => {
    setKeyword(kw)
    Taro.navigateTo({ url: `/pages/product-list/index?keyword=${encodeURIComponent(kw)}` })
  }

  const clearHistory = () => {
    setHistory([])
    try {
      Taro.removeStorageSync('search_history')
    } catch (e) { /* empty */ }
  }

  return (
    <View className={styles.page}>
      {/* 搜索框 */}
      <View className={styles.searchBar}>
        <View className={styles.searchInput}>
          <Text className={styles.searchIcon}>🔍</Text>
          <Input
            className={styles.input}
            value={keyword}
            placeholder='搜索商品'
            confirmType='search'
            onInput={(e: any) => setKeyword(e.detail.value)}
            onConfirm={handleSearch}
            autoFocus
          />
          {keyword && (
            <Text className={styles.clearIcon} onClick={() => setKeyword('')}>✕</Text>
          )}
        </View>
        <Text className={styles.searchBtn} onClick={handleSearch}>搜索</Text>
      </View>

      {/* 搜索结果 */}
      {searched && (
        searching ? (
          <View className={styles.emptyTip}>搜索中...</View>
        ) : results.length === 0 ? (
          <View className={styles.emptyTip}>未找到相关商品</View>
        ) : (
          <View className={styles.results}>
            {results.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </View>
        )
      )}

      {/* 热搜 */}
      {!searched && (
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>热门搜索</Text>
          <View className={styles.tagList}>
            {HOT_KEYWORDS.map((kw) => (
              <View key={kw} className={styles.tag} onClick={() => handleHotClick(kw)}>
                {kw}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 搜索历史 */}
      {!searched && history.length > 0 && (
        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>搜索历史</Text>
            <Text className={styles.clearBtn} onClick={clearHistory}>清空</Text>
          </View>
          <View className={styles.tagList}>
            {history.map((kw) => (
              <View key={kw} className={styles.tag} onClick={() => handleHistoryClick(kw)}>
                {kw}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

export default SearchPage
