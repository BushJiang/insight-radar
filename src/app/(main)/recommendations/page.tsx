// 智能推荐页：服务端组件查 DB 获取 50 个最新项目，传给客户端 page-client 做交互
import RecommendationsPageClient from '@/app/(main)/recommendations/page-client'
import { getLatestProjects } from '@/lib/projects-repository'

// revalidate=60 让推荐页初始项目列表最多缓存 60 秒，避免每次访问都查数据库
export const revalidate = 60

// RecommendationsPage 是推荐页的服务端入口，负责先取初始项目，再交给客户端组件处理交互
export default async function RecommendationsPage() {
  // 按采集时间倒序，在服务器上查找最新 N 个项目
  const initialProjects = await getLatestProjects(50)

  return <RecommendationsPageClient initialProjects={initialProjects} />
}
