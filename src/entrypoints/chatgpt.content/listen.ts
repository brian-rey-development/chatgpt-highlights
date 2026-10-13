export type Stop = () => void

export type ListenSpec<K extends keyof WindowEventMap> = AddEventListenerOptions & { type: K }

export const listen = <K extends keyof WindowEventMap>(
  target: Document | ShadowRoot | Window,
  { type, ...options }: ListenSpec<K>,
  listener: (event: WindowEventMap[K]) => void,
): Stop => {
  const eventTarget: EventTarget = target
  // K names the exact event that arrives
  const handler = listener as EventListener
  eventTarget.addEventListener(type, handler, options)
  return () => eventTarget.removeEventListener(type, handler, options)
}
