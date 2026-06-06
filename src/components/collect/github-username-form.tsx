'use client'

import { useState } from 'react'
import { validateGithubUsername } from '@/lib/github-validation'
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

export function GithubUsernameForm({ githubUsername, days, maxProjects, onGithubUsernameChange, onDaysChange, onMaxProjectsChange, onCreated, onProjectsCollected, onProgressChange, compact = false, multiple = false, inline = false }: GithubUsernameFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isCollecting, setIsCollecting] = useState(false)
  const usernames = githubUsername.split(/[\n,，、]+/).map((username) => username.trim()).filter(Boolean)
  const maxProjectsValue = Number(maxProjects)
  const formClassName = compact || inline ? 'grid gap-3 md:grid-cols-[minmax(260px,1fr)_160px_160px_auto] md:items-start' : 'space-y-4'
  const usernameFieldClassName = inline ? 'h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 text-sm leading-[20px] text-black outline-none transition placeholder:text-slate-500 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-white dark:text-black dark:disabled:bg-slate-200' : 'mt-2 min-h-28 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-slate-500 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-white dark:text-black dark:disabled:bg-slate-200'

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

    const startedAt = new Date().toISOString()
    let fetchedCount = 0
    let duplicateCount = 0
    let updatedDuplicateCount = 0
    let unchangedDuplicateCount = 0
    let estimatedTotalCount: number | null = null
    let lastReportedFetchedCount = 0
    const collectedProjects: GithubProject[] = []

    function reportRunningProgress(currentUsername: string, force = false) {
      if (!force && fetchedCount < lastReportedFetchedCount + 10) {
        return
      }

      lastReportedFetchedCount = fetchedCount
      onProgressChange?.({
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
      })
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
              sourceGithubUsername: username,
              days: days === 'all' ? null : Number(days),
            },
            githubToken: window.localStorage.getItem('insight-radar-github-token') || undefined,
            maxProjects: maxProjectsValue,
          }),
        })
        const rawResult = await response.text()
        const result = rawResult ? JSON.parse(rawResult) as GithubStarredSearchResponse : null

        if (!response.ok || result?.error || !result) {
          const message = result?.error || `采集请求失败，服务端返回 ${response.status}。`
          setError(message)
          onProgressChange?.({
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
          })
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

      onProgressChange?.({
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
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '采集请求失败，请稍后重试。'
      setError(message)
      onProgressChange?.({
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
      })
    } finally {
      setIsCollecting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={formClassName}>
      <div className="space-y-2">
        <p id="githubUsername-error" className={`h-5 truncate whitespace-nowrap text-sm leading-5 ${error ? 'text-red-600 dark:text-red-300' : 'text-slate-500 dark:text-slate-400'}`}>{error || '请输入 GitHub 用户名'}</p>
        <div className="h-5" />
        {multiple ? (
          <input
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
          <input
            id="githubUsername"
            name="githubUsername"
            value={githubUsername}
            onChange={(event) => onGithubUsernameChange(event.target.value)}
            disabled={isCollecting}
            aria-describedby="githubUsername-error"
            className="h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 text-sm leading-[20px] text-black outline-none transition placeholder:text-slate-500 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-white dark:text-black dark:disabled:bg-slate-200"
            placeholder="GitHub 用户名"
          />
        )}
        {multiple && !inline ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">每行一个 GitHub 用户名，也支持用逗号分隔。</p> : null}
      </div>

      <div className="space-y-2">
        <div className="h-5" />
        <label htmlFor="days" className="block text-sm font-medium text-white dark:text-black">
          时间范围
        </label>
        <select
          id="days"
          name="days"
          value={days}
          onChange={(event) => onDaysChange(event.target.value)}
          disabled={isCollecting}
          className="h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 text-sm leading-[20px] text-black outline-none transition placeholder:text-slate-500 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-white dark:text-black dark:disabled:bg-slate-200"
        >
          <option value="7">最近 7 天</option>
          <option value="30">最近 30 天</option>
          <option value="90">最近 90 天</option>
          <option value="all">不限时间</option>
        </select>
      </div>

      <div className="space-y-2">
        <div className="h-5" />
        <label htmlFor="maxProjects" className="block text-sm font-medium text-white dark:text-black">
          最多项目数量
        </label>
        <input
          id="maxProjects"
          name="maxProjects"
          type="number"
          min={0}
          step={1}
          value={maxProjects}
          onChange={(event) => onMaxProjectsChange(event.target.value)}
          disabled={isCollecting}
          className="h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 text-sm leading-[20px] text-black outline-none transition placeholder:text-slate-500 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-white dark:text-black dark:disabled:bg-slate-200"
          placeholder="0 表示全部"
        />
      </div>

      <div className="space-y-2">
        <div className="h-5" />
        <div className="h-5" />
        <button
          type="submit"
          disabled={isCollecting}
          className="inline-flex h-[46px] min-w-24 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:hover:bg-slate-400"
        >
          {isCollecting ? '采集中' : '开始采集'}
        </button>
      </div>
    </form>
  )
}
