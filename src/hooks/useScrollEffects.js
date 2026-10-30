import { useEffect, useRef } from 'react'

/**
 * useScrollReveal
 * Attaches IntersectionObserver to add .visible class to .reveal elements.
 * Works without JavaScript (elements are visible by default in CSS if JS fails to load).
 */
export function useScrollReveal() {
  useEffect(() => {
    // Check for prefers-reduced-motion
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    if (prefersReduced) {
      // Make all reveal elements immediately visible
      document.querySelectorAll('.reveal').forEach((el) => {
        el.classList.add('visible')
      })
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            // Unobserve after reveal for performance
            observer.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      }
    )

    const elements = document.querySelectorAll('.reveal')
    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])
}

/**
 * useNavbarScroll
 * Returns whether the user has scrolled past a threshold.
 */
export function useNavbarScroll(threshold = 20) {
  const scrolledRef = useRef(false)

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > threshold
      if (isScrolled !== scrolledRef.current) {
        scrolledRef.current = isScrolled
        const navbar = document.getElementById('navbar')
        if (navbar) {
          navbar.classList.toggle('scrolled', isScrolled)
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Check on mount

    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])
}
