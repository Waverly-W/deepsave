import { useRef, useCallback } from "react"

export function useThrottle<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number
): (...args: TArgs) => void {
  const lastRan = useRef(Date.now())
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  return useCallback(
    (...args: TArgs) => {
      const handler = () => {
        if (Date.now() - lastRan.current >= delay) {
          callback(...args)
          lastRan.current = Date.now()
        } else {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }
          timeoutRef.current = setTimeout(
            () => {
              callback(...args)
              lastRan.current = Date.now()
            },
            delay - (Date.now() - lastRan.current)
          )
        }
      }

      handler()
    },
    [callback, delay]
  )
}
