import { Toaster } from 'react-hot-toast'
import { POSScreen } from './components/pos/POSScreen'
import './components/pos/pos.css'

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e2d42',
            color: '#e8edf5',
            border: '1px solid #253650',
            fontFamily: "'Sora', sans-serif",
            fontSize: '13px'
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#0f1923' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#0f1923' } },
        }}
      />
      <POSScreen />
    </>
  )
}
