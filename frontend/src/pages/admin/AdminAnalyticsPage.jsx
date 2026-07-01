import AnalyticsPage from '../AnalyticsPage'

export default function AdminAnalyticsPage() {
  return (
    <AnalyticsPage
      apiEndpoint="/api/admin/analytics/summary"
      isAdmin={true}
    />
  )
}
