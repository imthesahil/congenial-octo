import { useEffect, useRef } from 'react'

const stack = []
let skipPop = 0

window.addEventListener('popstate', () => {
  if (skipPop > 0) {
    skipPop--
    return
  }
  const top = stack.pop()
  top?.onClose()
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) stack[stack.length - 1].onClose()
})

export function useOverlay(active, onClose) {
  const ref = useRef(onClose)
  ref.current = onClose

  useEffect(() => {
    if (!active) return
    const entry = { onClose: () => ref.current() }
    stack.push(entry)
    history.pushState({ overlay: true }, '')
    return () => {
      const i = stack.indexOf(entry)
      if (i > -1) {
        stack.splice(i, 1)
        skipPop++
        history.back()
      }
    }
  }, [active])
}
