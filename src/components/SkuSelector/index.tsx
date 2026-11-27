import React, { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import classnames from 'classnames'
import { ProductSku } from '@/types/product'
import styles from './index.module.scss'

interface SkuSelectorProps {
  skus: ProductSku[]
  selectedSkuId?: string
  onSelect: (sku: ProductSku) => void
}

const SkuSelector: React.FC<SkuSelectorProps> = ({ skus, selectedSkuId, onSelect }) => {
  // 按 specs 拆分维度
  const dimensions = React.useMemo(() => {
    const map: Record<string, Set<string>> = {}
    skus.forEach((sku) => {
      Object.entries(sku.specs).forEach(([k, v]) => {
        if (!map[k]) map[k] = new Set()
        map[k].add(v)
      })
    })
    return Object.entries(map).map(([key, values]) => ({ key, values: Array.from(values) }))
  }, [skus])

  const [selected, setSelected] = useState<Record<string, string>>(() => {
    if (selectedSkuId) {
      const sku = skus.find((s) => s._id === selectedSkuId)
      if (sku) return { ...sku.specs }
    }
    const first = skus[0]
    return first ? { ...first.specs } : {}
  })

  const handleSelect = (key: string, value: string) => {
    const next = { ...selected, [key]: value }
    setSelected(next)
    // 查找匹配的 SKU
    const match = skus.find((sku) =>
      Object.entries(next).every(([k, v]) => sku.specs[k] === v)
    )
    if (match) onSelect(match)
  }

  return (
    <View className={styles.wrapper}>
      {dimensions.map((dim) => (
        <View key={dim.key} className={styles.dimension}>
          <Text className={styles.dimLabel}>{dim.key}</Text>
          <View className={styles.options}>
            {dim.values.map((value) => (
              <View
                key={value}
                className={classnames(
                  styles.option,
                  selected[dim.key] === value && styles.selected
                )}
                onClick={() => handleSelect(dim.key, value)}
              >
                <Text className={styles.optionText}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

export default SkuSelector
