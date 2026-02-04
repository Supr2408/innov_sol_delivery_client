import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const PartnerLogin = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()

    if (normalizedEmail === 'partner@demo.com' && password === 'partner123') {
      localStorage.setItem('partnerAuth', 'true')
      setError('')
      navigate('/partner-dashboard')
      return
    }

    setError('Invalid credentials. Try partner@demo.com / partner123.')
  }

  return (
    <div className="px-6 py-16 flex justify-center">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Partner Login</h1>
        <p className="text-sm text-gray-500 mt-2">
          Demo credentials: partner@demo.com / partner123
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="partner-email">
              Email
            </label>
            <input
              id="partner-email"
              type="email"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="partner@demo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="partner-password">
              Password
            </label>
            <input
              id="partner-password"
              type="password"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="partner123"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            className="w-full rounded-lg bg-red-500 py-2 text-white font-semibold"
            type="submit"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}

export default PartnerLogin
