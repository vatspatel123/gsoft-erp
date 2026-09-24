import { BrowserRouter } from 'react-router-dom'
import { CartProvider, useCartContext } from './context/CartContext'
import { useWebsiteSettings } from './hooks/useWebsiteSettings'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { AnnouncementMarquee } from './components/AnnouncementMarquee'
import { AppRoutes } from './router'
import './theme/tokens.css'

function Shell() {
  const { settings } = useWebsiteSettings()
  const { count } = useCartContext()

  return (
    <div>
      {settings.show_announcement && <AnnouncementMarquee text={settings.announcement_bar} />}
      <Header bagCount={count} />
      <AppRoutes />
      <Footer settings={settings} />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Shell />
      </CartProvider>
    </BrowserRouter>
  )
}
