import React, { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { callFunction } from '@/services/cloud'
import styles from './index.module.scss'

interface PointsLog {
  _id: string
  delta: number
  reason: string
  balance: number
  created_at: number
}

const PointsLogPage: React.FC = () => {
  const [total, setTotal] = useState(0)
  const [logs, setLogs] = useState<PointsLog[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const data: any = await callFunction('order', { action: 'points' })
      if (data) {
        setTotal(data.total || 0)
        setLogs(data.logs || [])
      }
    } catch (err) {
      // H5 fallback
      const g = global as any
      const pointsList = g._pointsLogStore?.['demo-user'] || []
      const sorted = [...pointsList].sort((a, b) => b.created_at - a.created_at)
      const finalBalances: PointsLog[] = []
      let running = total
      // Recalculate balances from sorted list
      for (const item of sorted) {
        finalBalances.push({
          _id: item._id,
          delta: item.delta,
          reason: item.reason,
          balance: item.balance || (running += item.delta),
          created_at: item.created_at,
        })
      }
      setLogs(finalBalances)
      setTotal(pointsList.reduce((s: number, i: any) => s + i.delta, 0))
    }
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  // Group logs by date
  const grouped: Record<string, PointsLog[]> = {}
  logs.forEach((log) => {
    const date = new Date(log.created_at)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(log)
  })

  return (
    <View className={styles.page}>
      {/* 总积分 */}
      <View className={styles.header}>
        <Text className={styles.totalLabel}>当前积分</Text>
        <Text className={styles.totalValue}>{total}</Text>
      </View>

      {/* 积分明细 */}
      {logs.length === 0 ? (
        <View className={styles.empty}>
          <Text className={styles.emptyIcon}>📊</Text>
          <Text className={styles.emptyText}>暂无积分记录</Text>
        </View>
      ) : (
        <View className={styles.logList}>
          {Object.keys(grouped).map((date) => (
            <View key={date} className={styles.dateGroup}>
              <Text className={styles.dateLabel}>{date}</Text>
              {grouped[date].map((log) => (
                <View key={log._id} className={styles.logItem}>
                  <View className={styles.logInfo}>
                    <Text className={styles.logReason}>{log.reason}</Text>
                    <Text className={styles.logTime}>{formatDate(log.created_at)}</Text>
                  </View>
                  <View className={`${styles.logDelta} ${log.delta > 0 ? styles.deltaPlus : styles.deltaMinus}`}>
                    {log.delta > 0 ? '+' : ''}{log.delta}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

export default PointsLogPage
