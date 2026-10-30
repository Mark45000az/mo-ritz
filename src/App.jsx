import { useState, useEffect } from 'react'
import { useScrollReveal } from './hooks/useScrollEffects'
import Navbar from './components/Navbar'
import LivePresence from './components/LivePresence'
import Hero from './sections/Hero'
import About from './sections/About'
import Socials from './sections/Socials'
import Donation from './sections/Donation'
import Footer from './sections/Footer'
import { siteConfig } from './data/siteConfig'
import { AuthProvider } from './context/AuthContext'
import CommunityLayout from './components/community/CommunityLayout'
import ErrorBoundary from './components/ErrorBoundary'

function MainContent() {
  const [currentView, setCurrentView] = useState(() => {
    return window.location.hash === '#community' ? 'community' : 'home'
  })

  // Initialize scroll reveal for all .reveal elements
  useScrollReveal()

  // Handle hash change
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#community') {
        setCurrentView('community')
      } else if (currentView === 'community' && window.location.hash !== '#community') {
        setCurrentView('home')
      }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [currentView])

  // Update document title dynamically
  useEffect(() => {
    const { seo } = siteConfig
    if (currentView === 'community') {
      document.title = 'Moritz Community — คอมมูนิตี้คนคิดถึงคนเก่า'
    } else if (seo.title && !seo.title.includes('YOUR_')) {
      document.title = seo.title
    }
  }, [currentView])

  if (currentView === 'community') {
    return (
      <ErrorBoundary>
        <CommunityLayout
          onBackToHome={() => {
            window.location.hash = ''
            setCurrentView('home')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      </ErrorBoundary>
    )
  }

  return (
    <>
      <LivePresence />
      <Navbar
        onOpenCommunity={() => {
          window.location.hash = '#community'
          setCurrentView('community')
        }}
      />

      <main id="main-content">
        <Hero />
        <About />
        <Socials />
        <Donation />
      </main>

      <Footer />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  )
}
