import type { ToastModel, UiActions } from './types'

interface ToastProps {
  model: ToastModel
  actions: UiActions
}

export const Toast = ({ model, actions }: ToastProps) => {
  const { action } = model
  const runAction = () => {
    action?.run()
    actions.dismissToast()
  }
  return (
    <div class="hl-toast" role="status">
      <span>{model.message}</span>
      {action !== null && (
        <button type="button" class="hl-toast__action" onClick={runAction}>
          {action.label}
        </button>
      )}
    </div>
  )
}
