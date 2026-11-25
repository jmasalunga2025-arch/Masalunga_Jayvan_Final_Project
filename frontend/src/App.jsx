import { Component } from 'react'
import Layout from './components/Layout'
import { ErrorState, OwlLoader } from './components/ui'
import { useAuth } from './context/AuthContext'
import { useRoute } from './lib/router'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Templates from './pages/Templates'
import Generator from './pages/Generator'
import Documents from './pages/Documents'
import Approvals from './pages/Approvals'
import AIAssistant from './pages/AIAssistant'
import Settings from './pages/Settings'

class Boundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }) }
  render() {
    if (this.state.error) return <ErrorState message="This page hit an unexpected problem. Reload it, or go back to the dashboard." onRetry={() => this.setState({ error: null })} />
    return this.props.children
  }
}

const PAGES = {
  dashboard: Dashboard, templates: Templates, generator: Generator, documents: Documents,
  approvals: Approvals, ai: AIAssistant, settings: Settings,
}

export default function App() {
  const { user, loading } = useAuth()
  const route = useRoute()

  if (loading) return <div className="flex min-h-screen items-center justify-center"><OwlLoader label="Opening DAMS…" /></div>
  if (!user) return <Login />

  const Page = PAGES[route.segments[0] || 'dashboard'] || Dashboard
  return (
    <Layout route={route}>
      <Boundary resetKey={route.path + JSON.stringify(route.query)}><Page route={route} /></Boundary>
    </Layout>
  )
}
