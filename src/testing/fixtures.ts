import askBoxHtml from './fixtures/ask-box.html?raw'
import conversationHtml from './fixtures/conversation.html?raw'
import homeHtml from './fixtures/home.html?raw'
import sessionJson from './fixtures/session.json?raw'
import sidebarHtml from './fixtures/sidebar.html?raw'

export { askBoxHtml, conversationHtml, homeHtml, sessionJson, sidebarHtml }

export const MAIN_NAV = 'nav[aria-label]'
export const RAIL_NAV = 'nav[data-app-navigation-rail]'

export const mountFixture = (html: string): void => {
  document.body.innerHTML = html
}
