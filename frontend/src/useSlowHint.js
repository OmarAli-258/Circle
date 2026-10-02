import { useEffect, useState } from "react"

export function useSlowHint(isActive, delayMs = 4000) {
  const [isSlow, setIsSlow] = useState(false)

  useEffect(() => {
    if (!isActive) return
    const timerId = setTimeout(() => setIsSlow(true), delayMs)
    return () => {
      clearTimeout(timerId)
      setIsSlow(false)
    }
  }, [isActive, delayMs])

  return isSlow
}
