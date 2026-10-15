export type Stop = () => void

type ListenSpec<K extends keyof WindowEventMap> = AddEventListenerOptions & { type: K }

export const listen = <K extends keyof WindowEventMap>(
  target: Document | ShadowRoot | Window,
  { type, ...options }: ListenSpec<K>,
  listener: (event: WindowEventMap[K]) => void,
): Stop => {
  const eventTarget: EventTarget = target
  // K names the exact event that arrives
  const eventListener = listener as EventListener
  eventTarget.addEventListener(type, eventListener, options)
  return () => eventTarget.removeEventListener(type, eventListener, options)
}
