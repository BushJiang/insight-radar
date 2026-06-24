// GitHub 用户名采集表单连接“项目库页面输入”到“GitHub Star 采集请求”，真正请求逻辑委托给 github-starred-request.ts
'use client'

import { useEffect, useState } from 'react'
import { validateGithubUsername } from '@/lib/github-validation'
import { collectGithubStarredProjects } from '@/components/projects/github-starred-request'
import { ProjectLibraryBuildDialog } from '@/components/projects/project-library-build-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CollectionProgress, GithubProject } from '@/types/insight-radar'

// GithubUsernameFormProps 描述父组件交给采集表单的状态和回调，表单只负责展示输入、触发采集和上报结果
interface GithubUsernameFormProps {
  // 【数据字段】当前 GitHub 用户名输入值，由父组件持有，表单通过 onGithubUsernameChange 通知外层更新
  githubUsername: string
  // 【数据字段】采集时间范围，"all" 表示不限制 Star 时间，其他值会在请求前转成天数
  days: string
  // 【数据字段】本次最多采集的项目数量，字符串来自输入框，提交时再统一转成数字校验
  maxProjects: string
  // 【回调字段】用户修改 GitHub 用户名输入框时触发，把新值交给父组件保存草稿
  onGithubUsernameChange: (value: string) => void
  // 【回调字段】用户修改时间范围下拉框时触发，把新范围交给父组件保存草稿
  onDaysChange: (value: string) => void
  // 【回调字段】用户修改最多项目数量时触发，把新数量交给父组件保存草稿
  onMaxProjectsChange: (value: string) => void
  // 【回调字段】单个账号采集成功后触发，给外层保留兼容的“账号 + 参数 + 当前累计项目”回调入口
  onCreated?: (payload: { username: string; days: number | null; maxProjects: number; projects: GithubProject[] }) => void
  // 【回调字段】每次有新项目返回时触发，把累计项目列表交给项目库页面刷新卡片列表
  onProjectsCollected?: (projects: GithubProject[]) => void
  // 【回调字段】采集进度变化时触发，把 running/success/failed 状态交给父组件更新任务卡片
  onProgressChange?: (progress: CollectionProgress) => void
  // 【开关字段】compact 控制表单是否使用更紧凑的布局，适合放在较小容器中
  compact?: boolean
  // 【开关字段】multiple 控制是否支持多个 GitHub 用户名，开启后会按换行或逗号拆分并逐个采集
  multiple?: boolean
  // 【开关字段】inline 控制是否使用横向内联表单布局，项目库页顶部表单使用这个模式
  inline?: boolean
}

// GitHub 用户名采集表单执行地图：
// 1. 从父组件接收用户名、时间范围和采集上限草稿
// 2. 用户提交后校验输入，并把表单切换到采集中状态
// 3. 按账号调用 collectGithubStarredProjects，把网络请求委托给 github-starred-request.ts
// 4. 把采集到的项目和进度通过回调交回父组件刷新页面
// 5. 根据成功、失败和装饰性状态更新弹窗、按钮和提示
export function GithubUsernameForm({ githubUsername, days, maxProjects, onGithubUsernameChange, onDaysChange, onMaxProjectsChange, onCreated, onProjectsCollected, onProgressChange, compact = false, multiple = false, inline = false }: GithubUsernameFormProps) {
  // error 显示输入校验、接口失败或网络异常信息，表单顶部提示区会读取它
  const [error, setError] = useState<string | null>(null)
  // isCollecting 控制按钮禁用、输入框禁用和采集进度动画是否运行
  const [isCollecting, setIsCollecting] = useState(false)
  // buildDialogOpen 控制“项目库构建中”弹窗是否显示
  const [buildDialogOpen, setBuildDialogOpen] = useState(false)
  // 【装饰性状态】buildStepIndex 表示弹窗当前走到哪个步骤，只影响进度动画，不影响采集结果
  const [buildStepIndex, setBuildStepIndex] = useState(0)
  // 【装饰性状态】successToastVisible 控制采集全部成功后的顶部短提示，只影响提示显示时机
  const [successToastVisible, setSuccessToastVisible] = useState(false)
  // buildDialogProgress 保存弹窗和父组件都要用的采集进度快照
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
    // 这个 useEffect 监听采集状态和弹窗开关；采集中且弹窗打开时启动节拍器，依赖变化或组件卸载时清理定时器
    if (!isCollecting || !buildDialogOpen) {
      return
    }

    const timer = window.setInterval(() => {
      setBuildStepIndex((currentStep) => Math.min(currentStep + 1, 3))
    }, 1600)

    return () => window.clearInterval(timer)
  }, [buildDialogOpen, isCollecting])

  useEffect(() => {
    // 这个 useEffect 监听成功提示是否出现；显示后设置自动隐藏计时器，清理函数避免组件卸载后继续更新状态
    if (!successToastVisible) {
      return
    }

    const timer = window.setTimeout(() => setSuccessToastVisible(false), 2400)

    return () => window.clearTimeout(timer)
  }, [successToastVisible])

  // handleSubmit 执行地图：
  // 1. 阻止浏览器默认提交，避免页面刷新导致采集状态、弹窗和错误提示丢失
  // 2. 按单账号或多账号模式准备用户名列表，便于逐个校验和请求
  // 3. 校验用户名列表和最大采集数量，失败时把错误显示在表单顶部
  // 4. 清掉旧错误并进入采集态，让输入框、按钮和弹窗同步切换为处理中
  // 5. 按账号逐个委托 collectGithubStarredProjects 发起采集请求
  // 6. 成功时把累计项目列表和兼容回调交给父组件，并上报运行进度
  // 7. 失败时上报失败进度并终止后续账号，全部成功时展示成功提示
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // 1. 阻止浏览器默认提交，避免页面刷新导致采集状态、弹窗和错误提示丢失
    event.preventDefault()
    const values = multiple ? usernames : [githubUsername.trim()]
    // 2. 按单账号或多账号模式准备用户名列表，便于逐个校验和请求
    const emptyError = values.length === 0 ? '请输入 GitHub 用户名' : null
    const maxProjectsError = Number.isInteger(maxProjectsValue) && maxProjectsValue >= 0 ? null : '最多项目数量必须是大于等于 0 的整数。'
    const validationError = emptyError ?? maxProjectsError ?? values.map(validateGithubUsername).find((message) => message)

    if (validationError) {
      // 3. 校验用户名列表和最大采集数量，失败时把错误显示在表单顶部
      setError(validationError)
      return
    }

    // 4. 清掉旧错误并进入采集态，让输入框、按钮和弹窗同步切换为处理中
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

    // 进度上报：每采集 10 个项目或强制上报时，通过 onProgressChange 通知父组件更新进度条
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
        // 5. 按账号逐个委托 collectGithubStarredProjects 发起采集请求
        reportRunningProgress(username, true)

        try {
          // 修改采集请求参数或返回处理时，继续看 collectGithubStarredProjects（components/projects/github-starred-request.ts）
          const result = await collectGithubStarredProjects({ username, days, maxProjects: maxProjectsValue })

          fetchedCount += result.fetchedCount
          duplicateCount += result.duplicateCount
          updatedDuplicateCount += result.updatedDuplicateCount
          unchangedDuplicateCount += result.unchangedDuplicateCount
          estimatedTotalCount = result.estimatedTotalCount === null
            ? estimatedTotalCount
            : (estimatedTotalCount ?? 0) + result.estimatedTotalCount
          collectedProjects.push(...result.projects)
          // 6. 成功时把累计项目列表和兼容回调交给父组件，并上报运行进度
          onProjectsCollected?.([...collectedProjects])
          // 6. 成功时把累计项目列表和兼容回调交给父组件，并上报运行进度
          onCreated?.({ username, days: days === 'all' ? null : Number(days), maxProjects: maxProjectsValue, projects: [...collectedProjects] })
          reportRunningProgress(username)
        } catch (error) {
          // 7. 失败时上报失败进度并终止后续账号，全部成功时展示成功提示
          const message = error instanceof Error ? error.message : '采集请求失败，请稍后重试。'
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
      // 7. 失败时上报失败进度并终止后续账号，全部成功时展示成功提示
      setBuildStepIndex(3)
      setBuildDialogProgress(successProgress)
      onProgressChange?.(successProgress)
      window.setTimeout(() => {
        setBuildDialogOpen(false)
        setSuccessToastVisible(true)
      }, 700)
    } catch (error) {
      // 兜底失败路径：处理循环外的异常，仍用最后一个账号和当前累计统计生成失败进度
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
      // 收尾阶段：无论成功或失败都恢复按钮可点击状态，避免表单一直停在“采集中”
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
            // 多账号模式复用同一个输入框，但提交时会按换行和逗号拆分成多个 GitHub 用户名
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
            // 单账号模式只把当前输入值作为一个账号提交，适合普通的一次性采集
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
        // 成功提示由装饰性状态控制，只告诉用户项目库已构建完成，不承载业务数据
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
