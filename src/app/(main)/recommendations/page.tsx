import RecommendationsPageClient from '@/app/(main)/recommendations/page-client'
import { getLatestProjects } from '@/lib/projects-repository'

export default async function RecommendationsPage() {
  const initialProjects = await getLatestProjects(50)

  return <RecommendationsPageClient initialProjects={initialProjects} />
}
