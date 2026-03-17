import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Cashier from './pages/Cashier'
import Inventory from './pages/Inventory'
import TransactionHistory from './pages/TransactionHistory'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function NavBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 px-6 h-14 flex items-center gap-6 shadow-sm">
      <span className="font-bold text-gray-900 mr-4">POS App</span>
      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `text-sm font-medium pb-1 border-b-2 transition-colors ${
            isActive
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`
        }
      >
        Kasir
      </NavLink>
      <NavLink
        to="/inventory"
        className={({ isActive }) =>
          `text-sm font-medium pb-1 border-b-2 transition-colors ${
            isActive
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`
        }
      >
        Inventori
      </NavLink>
      <NavLink
        to="/riwayat"
        className={({ isActive }) =>
          `text-sm font-medium pb-1 border-b-2 transition-colors ${
            isActive
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`
        }
      >
        Riwayat
      </NavLink>
    </nav>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NavBar />
        <div className="pt-14 h-screen">
          <Routes>
            <Route path="/" element={<Cashier />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/riwayat" element={<TransactionHistory />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
