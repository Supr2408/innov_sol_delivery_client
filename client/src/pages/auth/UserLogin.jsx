import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const UserLogin = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()

    if (normalizedEmail === 'user@demo.com' && password === 'client123') {
      localStorage.setItem('clientAuth', 'true')
      setError('')
      navigate('/client-dashboard')
      return
    }

    setError('Invalid credentials. Try user@demo.com / client123.')
  }

  return (
    <div className="px-6 py-16 flex justify-center">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Client Login</h1>
        <p className="text-sm text-gray-500 mt-2">
          Demo credentials: user@demo.com / client123
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="user-email">
              Email
            </label>
            <input
              id="user-email"
              type="email"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="user@demo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="user-password">
              Password
            </label>
            <input
              id="user-password"
              type="password"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="client123"
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

export default UserLogin
