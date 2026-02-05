import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const UserLogin = () => {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    const trimmedName = name.trim()
    const storedUsers = JSON.parse(localStorage.getItem('clientUsers') || '[]')

    if (mode === 'register') {
      if (!trimmedName) {
        setSuccess('')
        setError('Please enter your full name.')
        return
      }

      const userExists = storedUsers.some(
        (user) => user.email.toLowerCase() === normalizedEmail
      )

      if (userExists) {
        setSuccess('')
        setError('That email is already registered. Please login instead.')
        return
      }

      const updatedUsers = [
        ...storedUsers,
        {
          name: trimmedName,
          email: normalizedEmail,
          password
        }
      ]

      localStorage.setItem('clientUsers', JSON.stringify(updatedUsers))
      setError('')
      setSuccess('Registration successful. Please login.')
      setMode('login')
      return
    }

    const matchedUser = storedUsers.find(
      (user) => user.email.toLowerCase() === normalizedEmail && user.password === password
    )

    if (normalizedEmail === 'user@demo.com' && password === 'client123') {
      localStorage.setItem('clientAuth', 'true')
      localStorage.setItem(
        'clientUser',
        JSON.stringify({ name: 'Demo Client', email: normalizedEmail })
      )
      setError('')
      setSuccess('')
      navigate('/client-dashboard')
      return
    }

    if (matchedUser) {
      localStorage.setItem('clientAuth', 'true')
      localStorage.setItem(
        'clientUser',
        JSON.stringify({ name: matchedUser.name, email: matchedUser.email })
      )
      setError('')
      setSuccess('')
      navigate('/client-dashboard')
      return
    }

    setSuccess('')
    setError('Invalid credentials. Try user@demo.com / client123 or register.')
  }

  return (
    <div className="px-6 py-16 flex justify-center">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">
          {mode === 'login' ? 'Client Login' : 'Create Client Account'}
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          Demo credentials: user@demo.com / client123
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="user-name">
                Full name
              </label>
              <input
                id="user-name"
                type="text"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Jane Doe"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
          )}
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
          {success && <p className="text-sm text-green-600">{success}</p>}

          <button
            className="w-full rounded-lg bg-red-500 py-2 text-white font-semibold"
            type="submit"
          >
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-gray-600">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                className="font-semibold text-red-500 hover:text-red-600"
                onClick={() => {
                  setMode('register')
                  setError('')
                  setSuccess('')
                }}
              >
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="font-semibold text-red-500 hover:text-red-600"
                onClick={() => {
                  setMode('login')
                  setError('')
                  setSuccess('')
                }}
              >
                Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserLogin
