import RecommendationsPageClient from '@/app/(main)/recommendations/page-client'
import { getLatestProjects } from '@/lib/projects-repository'

export default async function RecommendationsPage() {
// 🔰 按采集时间倒序取最新 N 个项目
  const initialProjects = await getLatestProjects(50)

  return <RecommendationsPageClient initialProjects={initialProjects} />
}
