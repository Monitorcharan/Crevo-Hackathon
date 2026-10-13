import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const headingSelector = [
  '.landing-section-head h2', '.mascot-spotlight-copy h2',
  '.section-top h2', '.workproof-copy h2', '.section-heading h2',
  '.journey-section h2', '.audience-section h2', '.landing-faq h2',
  '.cta-section h2', '.categories-heading h1', '.directory-head h1',
  '.portfolio-content > h1', '.profile-layout h1',
].join(',')

// Motion is progressive enhancement: the page stays readable before JS runs.
export default function CinematicMotion() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const animations = []
    const triggers = []
    const seen = new WeakSet()
    let frame = 0
    const progress = document.querySelector('.site-scroll-progress')
    const updateProgress = () => {
      const range = document.documentElement.scrollHeight - window.innerHeight
      if (progress) progress.style.transform = `scaleX(${range > 0 ? window.scrollY / range : 0})`
    }
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)
    updateProgress()
    const moveMagnet = event => {
      if (event.pointerType !== 'mouse') return
      const button = event.target.closest('.hero-actions .button, .cta-section .button, .round-link')
      if (!button) return
      const rect = button.getBoundingClientRect()
      gsap.to(button, {
        x: (event.clientX - rect.left - rect.width / 2) * .12,
        y: (event.clientY - rect.top - rect.height / 2) * .12,
        duration: .45, ease: 'power3.out', overwrite: true,
      })
    }
    const releaseMagnet = event => {
      const button = event.target.closest?.('.hero-actions .button, .cta-section .button, .round-link')
      if (button && !button.contains(event.relatedTarget)) {
        gsap.to(button, { x: 0, y: 0, duration: .65, ease: 'elastic.out(1,.6)', overwrite: true })
      }
    }
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      document.addEventListener('pointermove', moveMagnet)
      document.addEventListener('pointerout', releaseMagnet)
    }

    const addReveal = element => {
      if (seen.has(element)) return
      seen.add(element)
      const animation = gsap.fromTo(element,
        { y: 20 },
        { y: 0, duration: 1.05, ease: 'power3.out', paused: true, clearProps: 'transform,opacity,clipPath' },
      )
      animations.push(animation)
      triggers.push(ScrollTrigger.create({
        trigger: element, start: 'top 92%', once: true,
        onEnter: () => animation.play(),
      }))
    }

    const addParallax = element => {
      if (seen.has(element)) return
      seen.add(element)
      const animation = gsap.fromTo(element, { yPercent: -4 }, {
        yPercent: 4, ease: 'none', paused: true,
      })
      animations.push(animation)
      triggers.push(ScrollTrigger.create({
        trigger: element, start: 'top bottom', end: 'bottom top',
        scrub: 1.2, animation,
      }))
    }

    const scan = () => {
      frame = 0
      document.querySelectorAll(headingSelector).forEach(addReveal)
      if (window.matchMedia('(min-width: 900px)').matches) {
        document.querySelectorAll('.workproof-visual, .mascot-stage').forEach(addParallax)
      }
      ScrollTrigger.refresh()
    }

    const observer = new MutationObserver(records => {
      if (records.every(record => record.target instanceof Element && record.target.closest('.crevo-assistant'))) return
      if (!frame) frame = requestAnimationFrame(scan)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    frame = requestAnimationFrame(scan)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
      document.removeEventListener('pointermove', moveMagnet)
      document.removeEventListener('pointerout', releaseMagnet)
      observer.disconnect()
      triggers.forEach(trigger => trigger.kill())
      animations.forEach(animation => animation.revert())
      gsap.set([...document.querySelectorAll(headingSelector), ...document.querySelectorAll('.workproof-visual, .mascot-stage')], { clearProps: 'transform,opacity,clipPath' })
    }
  }, [pathname])

  return <div className="site-scroll-progress" aria-hidden="true"/>
}
