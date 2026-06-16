// 🔰 GitHub 用户名校验：正则验证用户名格式合法性（1-39 位字母数字连字符），采集表单使用
const githubUsernamePattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/

export function validateGithubUsername(username: string) {
  const value = username.trim()

  if (!value) {
    return '请输入 GitHub 用户名。'
  }

  if (value.includes(',') || value.includes(' ') || value.includes('/')) {
    return '一次只能输入一个 GitHub 用户名。'
  }

  if (!githubUsernamePattern.test(value)) {
    return 'GitHub 用户名格式不正确。'
  }

  return null
}
