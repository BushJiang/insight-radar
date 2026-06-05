'use client'

import { useState } from 'react'
import { AppShell } from '@/components/app/app-shell'
import { RecommendationExplanationCard } from '@/components/recommendations/recommendation-explanation-card'
import { RecommendationRequestPanel } from '@/components/recommendations/recommendation-request-panel'
import { mockProjects } from '@/data/mock-insight-radar'
import { readTransientFormState, writeTransientRecommendationFormState } from '@/lib/transient-form-state'
import type { RecommendationExplanation } from '@/types/insight-radar'

export default function RecommendationsPage() {
  const recommendationDraft = readTransientFormState().recommendations
  const [recommendationLimit, setRecommendationLimit] = useState(recommendationDraft.recommendationLimit)
  const [query, setQuery] = useState(recommendationDraft.query)
  const [recommendations, setRecommendations] = useState<RecommendationExplanation[]>([])
  const projects = mockProjects.slice(0, recommendationLimit)

  function handleGenerated(recommendation: RecommendationExplanation) {
    setRecommendations([recommendation])
  }

  return (
    <AppShell currentPath="/recommendations">
      <main className="space-y-6">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">智能推荐</h2>
          </div>
          <RecommendationRequestPanel
            projects={projects}
            query={query}
            onQueryChange={(nextQuery) => {
              setQuery(nextQuery)
              writeTransientRecommendationFormState({ query: nextQuery })
            }}
            recommendationLimit={recommendationLimit}
            onRecommendationLimitChange={(limit) => {
              setRecommendationLimit(limit)
              writeTransientRecommendationFormState({ recommendationLimit: limit })
            }}
            onGenerated={handleGenerated}
          />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">推荐结果</h2>
          </div>
          {recommendations.map((recommendation) => (
            <RecommendationExplanationCard key={recommendation.id} recommendation={recommendation} />
          ))}
        </section>
      </main>
    </AppShell>
  )
}
