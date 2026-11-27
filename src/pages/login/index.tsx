import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { callFunction } from '@/services/cloud'
import { ensureLogin } from '@/utils/auth'
import styles from './index.module.scss'

const TAB_PAGES = ['/pages/home/index', '/pages/category/index', '/pages/cart/index', '/pages/user/index']

const navigateAfterLogin = (redirect: string) => {
  const target = decodeURIComponent(redirect)
  // 判断是否为 tabBar 页
  if (TAB_PAGES.some((p) => target.includes(p))) {
    Taro.switchTab({ url: target })
  } else {
    // 非 tab 页，有页面栈则 navigateBack，否则 redirectTo
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
    } else {
      Taro.redirectTo({ url: target })
    }
  }
}

const LoginPage: React.FC = () => {
  const router = useRouter()
  const redirect = router.params.redirect || '/pages/user/index'
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    try {
      const isWeapp = typeof wx !== 'undefined' && (wx as any).login

      if (isWeapp) {
        ;(wx as any).login({
          success: async (res: any) => {
            if (res.code) {
              try {
                await callFunction('login', {
                  action: 'login',
                  code: res.code,
                })
                Taro.showToast({ title: '登录成功', icon: 'success' })
                setTimeout(() => navigateAfterLogin(redirect), 500)
              } catch (err: any) {
                Taro.showToast({ title: err.message || '登录失败', icon: 'none' })
              }
            }
          },
          fail: () => {
            Taro.showToast({ title: '登录失败', icon: 'none' })
          },
        })
      } else {
        // H5 mock
        await ensureLogin()
        Taro.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => navigateAfterLogin(redirect), 500)
      }
    } catch (err: any) {
      Taro.showToast({ title: err.message || '登录失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <View className={styles.logo}>🛍️</View>
        <Text className={styles.title}>x-shop</Text>
        <Text className={styles.subtitle}>欢迎来到 x-shop 商城</Text>
      </View>

      <View className={styles.form}>
        <View className={styles.loginBtn} onClick={handleLogin}>
          {loading ? '登录中...' : '微信一键登录'}
        </View>

        <View className={styles.tips}>
          <Text className={styles.tipText}>
            登录即代表同意 <Text className={styles.link}>《用户协议》</Text> 和 <Text className={styles.link}>《隐私政策》</Text>
          </Text>
        </View>
      </View>

      <View className={styles.skipBtn} onClick={() => Taro.switchTab({ url: '/pages/home/index' })}>
        先逛逛
      </View>
    </View>
  )
}

export default LoginPage
