// 🔰 GitHub 用户名采集表单：输入账号、时间范围、数量 → POST /api/github/starred-search 逐账号采集 Star 项目。项目库页使用
'use client'

import { useEffect, useState } from 'react'
import { validateGithubUsername } from '@/lib/github-validation'
import { readBrowserStorage } from '@/lib/browser-storage'
import { getDefaultPreference, preferenceStorageKey } from '@/lib/default-preference'
import { ProjectLibraryBuildDialog } from '@/components/projects/project-library-build-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CollectionProgress, GithubProject, GithubStarredSearchResponse } from '@/types/insight-radar'

interface GithubUsernameFormProps {
  githubUsername: string
  days: string
  maxProjects: string
  onGithubUsernameChange: (value: string) => void
  onDaysChange: (value: string) => void
  onMaxProjectsChange: (value: string) => void
  onCreated?: (payload: { username: string; days: number | null; maxProjects: number; projects: GithubProject[] }) => void
  onProjectsCollected?: (projects: GithubProject[]) => void
  onProgressChange?: (progress: CollectionProgress) => void
  compact?: boolean
  multiple?: boolean
  inline?: boolean
}

// 🔰 GitHub 用户名采集表单：校验 → 逐账号 POST /api/github/starred-search 采集 Star 项目 → 更新进度。项目库页使用
export function GithubUsernameForm({ githubUsername, days, maxProjects, onGithubUsernameChange, onDaysChange, onMaxProjectsChange, onCreated, onProjectsCollected, onProgressChange, compact = false, multiple = false, inline = false }: GithubUsernameFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isCollecting, setIsCollecting] = useState(false)
  const [buildDialogOpen, setBuildDialogOpen] = useState(false)
  const [buildStepIndex, setBuildStepIndex] = useState(0)
  const [successToastVisible, setSuccessToastVisible] = useState(false)
  const [buildDialogProgress, setBuildDialogProgress] = useState<CollectionProgress>({
    status: 'pending',
    currentUsername: null,
    fetchedCount: 0,
    duplicateCount: 0,
    updatedDuplicateCount: 0,
    unchangedDuplicateCount: 0,
    estimatedTotalCount: null,
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
  })
  const usernames = githubUsername.split(/[\n,，、]+/).map((username) => username.trim()).filter(Boolean)
  const maxProjectsValue = Number(maxProjects)
  const formClassName = compact || inline ? 'grid gap-3 md:grid-cols-[minmax(260px,1fr)_160px_160px_auto] md:items-start' : 'space-y-4'
  const usernameFieldClassName = inline ? 'w-full rounded-xl border border-slate-300 bg-white px-4 text-sm leading-[20px] text-black outline-none transition placeholder:text-slate-500 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-white dark:text-black dark:disabled:bg-slate-200' : 'mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-slate-500 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-white dark:text-black dark:disabled:bg-slate-200'

  useEffect(() => {
    if (!isCollecting || !buildDialogOpen) {
      return
    }

    const timer = window.setInterval(() => {
      setBuildStepIndex((currentStep) => Math.min(currentStep + 1, 3))
    }, 1600)

    return () => window.clearInterval(timer)
  }, [buildDialogOpen, isCollecting])

  useEffect(() => {
    if (!successToastVisible) {
      return
    }

    const timer = window.setTimeout(() => setSuccessToastVisible(false), 2400)

    return () => window.clearTimeout(timer)
  }, [successToastVisible])

  // 🔰 表单提交处理：preventDefault 阻止页面刷新 → 校验用户名 → 逐账号调 /api/github/starred-search 采集 → finally 恢复按钮状态
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = multiple ? usernames : [githubUsername.trim()]
    const emptyError = values.length === 0 ? '请输入 GitHub 用户名' : null
    const maxProjectsError = Number.isInteger(maxProjectsValue) && maxProjectsValue >= 0 ? null : '最多项目数量必须是大于等于 0 的整数。'
    const validationError = emptyError ?? maxProjectsError ?? values.map(validateGithubUsername).find((message) => message)

    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setIsCollecting(true)
    setBuildDialogOpen(true)
    setBuildStepIndex(0)
    setSuccessToastVisible(false)

    const startedAt = new Date().toISOString()
    let fetchedCount = 0
    let duplicateCount = 0
    let updatedDuplicateCount = 0
    let unchangedDuplicateCount = 0
    let estimatedTotalCount: number | null = null
    let lastReportedFetchedCount = 0
    const collectedProjects: GithubProject[] = []

    setBuildDialogProgress({
      status: 'running',
      currentUsername: values[0] ?? null,
      fetchedCount,
      duplicateCount,
      updatedDuplicateCount,
      unchangedDuplicateCount,
      estimatedTotalCount,
      startedAt,
      finishedAt: null,
      errorMessage: null,
    })

    // 🔰 进度上报：每采集 10 个项目或强制上报时，通过 onProgressChange 通知父组件更新进度条
    function reportRunningProgress(currentUsername: string, force = false) {
      if (!force && fetchedCount < lastReportedFetchedCount + 10) {
        return
      }

      lastReportedFetchedCount = fetchedCount
      const progress: CollectionProgress = {
        status: 'running',
        currentUsername,
        fetchedCount,
        duplicateCount,
        updatedDuplicateCount,
        unchangedDuplicateCount,
        estimatedTotalCount,
        startedAt,
        finishedAt: null,
        errorMessage: null,
      }

      setBuildDialogProgress(progress)
      onProgressChange?.(progress)
    }

    try {
      for (const username of values) {
        reportRunningProgress(username, true)

        const response = await fetch('/api/github/starred-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filters: {
              query: '',
              languages: [],
              maturity: [],
              sourceGithubUsername: username,
              days: days === 'all' ? null : Number(days),
            },
            githubToken: window.localStorage.getItem('insight-radar-github-token') || undefined,
            maxProjects: maxProjectsValue,
            preference: readBrowserStorage(preferenceStorageKey, getDefaultPreference()),
          }),
        })
        const rawResult = await response.text()
        const result = rawResult ? JSON.parse(rawResult) as GithubStarredSearchResponse : null

        if (!response.ok || result?.error || !result) {
          const message = result?.error || `采集请求失败，服务端返回 ${response.status}。`
          setError(message)
          const failureProgress: CollectionProgress = {
            status: 'failed',
            currentUsername: username,
            fetchedCount,
            duplicateCount,
            updatedDuplicateCount,
            unchangedDuplicateCount,
            estimatedTotalCount,
            startedAt,
            finishedAt: new Date().toISOString(),
            errorMessage: message,
          }
          setBuildDialogProgress(failureProgress)
          onProgressChange?.(failureProgress)
          return
        }

        fetchedCount += result.fetchedCount
        duplicateCount += result.duplicateCount
        updatedDuplicateCount += result.updatedDuplicateCount
        unchangedDuplicateCount += result.unchangedDuplicateCount
        estimatedTotalCount = result.estimatedTotalCount === null
          ? estimatedTotalCount
          : (estimatedTotalCount ?? 0) + result.estimatedTotalCount
        collectedProjects.push(...result.projects)
        onProjectsCollected?.([...collectedProjects])
        onCreated?.({ username, days: days === 'all' ? null : Number(days), maxProjects: maxProjectsValue, projects: [...collectedProjects] })
        reportRunningProgress(username)
      }

      const successProgress: CollectionProgress = {
        status: 'success',
        currentUsername: values.at(-1) ?? null,
        fetchedCount,
        duplicateCount,
        updatedDuplicateCount,
        unchangedDuplicateCount,
        estimatedTotalCount: estimatedTotalCount ?? fetchedCount,
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: null,
      }
      setBuildStepIndex(3)
      setBuildDialogProgress(successProgress)
      onProgressChange?.(successProgress)
      window.setTimeout(() => {
        setBuildDialogOpen(false)
        setSuccessToastVisible(true)
      }, 700)
    } catch (error) {
      const message = error instanceof Error ? error.message : '采集请求失败，请稍后重试。'
      setError(message)
      const failureProgress: CollectionProgress = {
        status: 'failed',
        currentUsername: values.at(-1) ?? null,
        fetchedCount,
        duplicateCount,
        updatedDuplicateCount,
        unchangedDuplicateCount,
        estimatedTotalCount,
        startedAt,
        finishedAt: new Date().toISOString(),
        errorMessage: message,
      }
      setBuildDialogProgress(failureProgress)
      onProgressChange?.(failureProgress)
    } finally {
      setIsCollecting(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className={formClassName}>
        <div className="space-y-2">
        <p id="githubUsername-error" className={`h-5 truncate whitespace-nowrap text-sm leading-5 ${error ? 'text-red-600 dark:text-red-300' : 'text-slate-500 dark:text-slate-400'}`}>{error || '请输入 GitHub 用户名'}</p>
        <div className="h-5" />
        {multiple ? (
          <Input
            id="githubUsername"
            name="githubUsername"
            value={githubUsername}
            onChange={(event) => onGithubUsernameChange(event.target.value)}
            disabled={isCollecting}
            aria-describedby="githubUsername-error"
            className={usernameFieldClassName}
            placeholder="GitHub 用户名"
          />
        ) : (
          <Input
            id="githubUsername"
            name="githubUsername"
            value={githubUsername}
            onChange={(event) => onGithubUsernameChange(event.target.value)}
            disabled={isCollecting}
            aria-describedby="githubUsername-error"
            placeholder="GitHub 用户名"
          />
        )}
        {multiple && !inline ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">每行一个 GitHub 用户名，也支持用逗号分隔。</p> : null}
      </div>

      <div className="space-y-2">
        <div className="h-5" />
        <Label className="flex h-5 items-center text-white dark:text-black">
          时间范围
        </Label>
        <Select value={days} onValueChange={onDaysChange} disabled={isCollecting}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择时间范围" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">最近 7 天</SelectItem>
            <SelectItem value="30">最近 30 天</SelectItem>
            <SelectItem value="90">最近 90 天</SelectItem>
            <SelectItem value="all">不限时间</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="h-5" />
        <Label htmlFor="maxProjects" className="flex h-5 items-center">
          最多项目数量
        </Label>
        <Input
          id="maxProjects"
          name="maxProjects"
          type="number"
          min={0}
          step={1}
          value={maxProjects}
          onChange={(event) => onMaxProjectsChange(event.target.value)}
          disabled={isCollecting}
          placeholder="0 表示全部"
        />
      </div>

      <div className="space-y-2">
        <div className="h-5" />
        <div className="h-5" />
        <Button
          type="submit"
          disabled={isCollecting}
          className="min-w-24 bg-brand-primary hover:bg-brand-primary-hover active:scale-95"
        >
          {isCollecting ? '采集中' : '开始采集'}
        </Button>
      </div>
      </form>
      {successToastVisible ? (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-2xl border border-brand-primary/20 bg-white px-5 py-3 text-sm font-medium text-brand-primary shadow-lg dark:border-brand-primary/30 dark:bg-slate-900">
          项目库构建成功
        </div>
      ) : null}
      <ProjectLibraryBuildDialog
        open={buildDialogOpen}
        status={buildDialogProgress.status}
        activeStepIndex={buildStepIndex}
        fetchedCount={buildDialogProgress.fetchedCount}
        estimatedTotalCount={buildDialogProgress.estimatedTotalCount}
        errorMessage={buildDialogProgress.errorMessage}
        onClose={() => setBuildDialogOpen(false)}
      />
    </>
  )
}
