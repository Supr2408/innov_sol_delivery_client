import React from 'react'
import { Link } from 'react-router-dom'

const StoreLogin = () => {
  return (
    <div className="min-h-screen bg-amber-50 px-4 py-12 text-slate-900">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-center gap-6 rounded-3xl bg-white p-8 shadow-sm lg:p-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-600">
              Store Portal
            </p>
            <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">
              Manage your storefront with ease
            </h1>
            <p className="mt-3 text-base text-slate-600">
              Sign in to track orders, update inventory, and stay connected with
              customers in real time.
            </p>
          </div>

          <div className="grid gap-4 rounded-2xl bg-amber-100/60 p-6 text-sm text-slate-700">
            <div>
              <p className="font-semibold text-amber-700">Before you sign in</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Use the store email registered with operations.</li>
                <li>Have your store ID ready for verification.</li>
                <li>Need access? Contact the onboarding team.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-sm lg:p-10">
          <div>
            <h2 className="text-2xl font-semibold">Sign in to your store</h2>
            <p className="mt-2 text-sm text-slate-500">
              Use your store credentials to access the dashboard.
            </p>
          </div>

          <form className="mt-8 grid gap-5">
            <label className="grid gap-2 text-sm font-medium">
              Store email
              <input
                type="email"
                name="email"
                placeholder="store@example.com"
                className="h-12 rounded-xl border border-slate-200 px-4 text-sm shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Password
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                className="h-12 rounded-xl border border-slate-200 px-4 text-sm shadow-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                Remember this device
              </label>
              <button type="button" className="font-semibold text-amber-700">
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="h-12 rounded-xl bg-amber-600 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
            >
              Log in
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-500">
            Need store access?{' '}
            <Link to="/" className="font-semibold text-amber-700">
              Request onboarding
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

export default StoreLogin
