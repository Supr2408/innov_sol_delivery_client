import React from 'react'
import { Link } from 'react-router-dom'

const AdminLogin = () => {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-center gap-6 rounded-3xl bg-white p-8 shadow-sm lg:p-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              Admin Console
            </p>
            <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">
              Control operations in one place
            </h1>
            <p className="mt-3 text-base text-slate-600">
              Sign in to oversee users, partners, and live order activity across
              the platform.
            </p>
          </div>

          <div className="grid gap-4 rounded-2xl bg-slate-100 p-6 text-sm text-slate-700">
            <div>
              <p className="font-semibold text-slate-700">Admin checklist</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Use your organization-issued admin email.</li>
                <li>Confirm two-factor access is enabled.</li>
                <li>Contact security if you need a reset.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-sm lg:p-10">
          <div>
            <h2 className="text-2xl font-semibold">Sign in as admin</h2>
            <p className="mt-2 text-sm text-slate-500">
              Use your admin credentials to access the console.
            </p>
          </div>

          <form className="mt-8 grid gap-5">
            <label className="grid gap-2 text-sm font-medium">
              Admin email
              <input
                type="email"
                name="email"
                placeholder="admin@company.com"
                className="h-12 rounded-xl border border-slate-200 px-4 text-sm shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Password
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                className="h-12 rounded-xl border border-slate-200 px-4 text-sm shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                Remember this device
              </label>
              <button type="button" className="font-semibold text-slate-700">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="h-12 rounded-xl bg-slate-800 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
            >
              Log in
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-500">
            Need admin access?{' '}
            <Link to="/" className="font-semibold text-slate-700">
              Contact support
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

export default AdminLogin
