import { useEffect, useState, type RefObject } from 'react'

/** 要素の大きさが分かるまでの、仮の大きさ (px)。 */
const INITIAL_ELEMENT_SIZE = { width: 800, height: 600 }

/** 要素の大きさ (px)。 */
export interface ElementSize {
  readonly width: number
  readonly height: number
}

/** 要素の大きさ (px) を追う。 */
export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>(INITIAL_ELEMENT_SIZE)

  useEffect(() => {
    const element = ref.current
    if (element === null) {
      return
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) {
        setSize({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) })
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}

/**
 * コンテナの大きさを追い、Canvas の内部の解像度をその大きさと devicePixelRatio に合わせる。コンテナの大きさ (px) を返す。
 * 解像度を変えると Canvas の内容は消えるので、呼び出し側は、返した大きさが変わったあとに描き直す。
 */
export function useCanvasSize(
  containerRef: RefObject<HTMLElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
): ElementSize {
  const size = useElementSize(containerRef)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) {
      return
    }
    const ratio = window.devicePixelRatio
    canvas.width = Math.floor(size.width * ratio)
    canvas.height = Math.floor(size.height * ratio)
  }, [canvasRef, size])

  return size
}
