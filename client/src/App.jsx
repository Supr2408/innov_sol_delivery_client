import React from 'react'
import Navbar from './components/Navbar'
import { Route, Routes } from 'react-router-dom'
import Home from './pages/landing/Home'
import AdminLogin from './pages/auth/AdminLogin'
import UserLogin from './pages/auth/UserLogin'
import PartnerLogin from './pages/auth/PartnerLogin'
import StoreLogin from './pages/auth/StoreLogin'
import Footer from './components/Footer'

const App = () => {
  return (
    <div>
      <Navbar />
      {/* Other components and routes will go here */}
      <div>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/user-login" element={<UserLogin />} />
          <Route path="/partner-login" element={<PartnerLogin />} />
          <Route path="/store-login" element={<StoreLogin />} />
        </Routes>
      </div>

      <Footer />
    </div>
  )
}

export default App
