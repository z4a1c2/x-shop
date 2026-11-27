/**
 * 鉴权工具 — H5 mock 环境自动建立 demo-user 会话
 * 真实微信环境通过 wx.login + 云开发 openid 鉴权
 * 会话持久化通过 Taro.setStorageSync
 */

import Taro from '@tarojs/taro'

const g = global as any

export interface AuthUser {
  _id: string
  nickname: string
  avatar: string
  level: string
  points: number
  growth: number
}

const TOKEN_KEY = 'x_shop_token'
const USER_KEY = 'x_shop_user'

function isBrowser(): boolean {
  return typeof window !== 'undefined' || typeof Taro !== 'undefined'
}

export function isLoggedIn(): boolean {
  // 优先从 storage 读
  try {
    const token = Taro.getStorageSync(TOKEN_KEY)
    if (token) return true
  } catch (e) { /* ignore */ }
  // H5 mock fallback：global session
  if (g._session?.token) return true
  return false
}

export function getToken(): string | null {
  try {
    const token = Taro.getStorageSync(TOKEN_KEY)
    if (token) return token
  } catch (e) { /* ignore */ }
  return g._session?.token || null
}

export function getUser(): AuthUser | null {
  // 优先从 storage 读
  try {
    const userStr = Taro.getStorageSync(USER_KEY)
    if (userStr) return JSON.parse(userStr)
  } catch (e) { /* ignore */ }
  // H5 mock fallback
  const openid = g._session?.openid
  if (!openid || !g._userStore?.[openid]) return null
  const user = g._userStore[openid]
  return {
    _id: user._id,
    nickname: user.nickname,
    avatar: user.avatar,
    level: user.level,
    points: user.points,
    growth: user.growth || 0,
  }
}

/**
 * 确保已登录。H5 mock 环境自动建立 demo-user 会话。
 */
export async function ensureLogin(): Promise<AuthUser> {
  // H5 mock 环境自动登录
  if (typeof window !== 'undefined' && !(window as any).wx) {
    if (isLoggedIn()) {
      const user = getUser()
      if (user) return user
    }
    // 自动建立会话
    const { default: loginMock } = await import('@/data/login')
    const result: any = await loginMock({ action: 'login' })
    if (result && result.data) {
      const { token, user } = result.data
      // 持久化
      try {
        Taro.setStorageSync(TOKEN_KEY, token)
        Taro.setStorageSync(USER_KEY, JSON.stringify(user))
      } catch (e) { /* ignore */ }
      return user
    }
  }

  if (!isLoggedIn()) {
    throw new Error('请先登录')
  }
  return getUser()!
}

export async function logout(): Promise<void> {
  try {
    Taro.removeStorageSync(TOKEN_KEY)
    Taro.removeStorageSync(USER_KEY)
  } catch (e) { /* ignore */ }
  g._session = null
}
