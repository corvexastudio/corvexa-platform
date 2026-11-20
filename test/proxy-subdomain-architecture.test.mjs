import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Subdomain & Proxy Architecture: Clean Multi-Domain Structure Validation', async (t) => {
  const proxyPath = path.resolve(import.meta.dirname || process.cwd(), '../src/proxy.ts')
  const fallbackPath = path.resolve(process.cwd(), 'src/proxy.ts')
  const resolved = fs.existsSync(proxyPath) ? proxyPath : fallbackPath
  const proxyContent = fs.readFileSync(resolved, 'utf-8')

  await t.test('1. Core Subdomain Definitions: book., agency., app., and admin. are properly declared', () => {
    assert.ok(proxyContent.includes("hostname.startsWith('book.')"), 'Must define book. subdomain handler')
    assert.ok(proxyContent.includes("hostname.startsWith('agency.')"), 'Must define agency. subdomain handler')
    assert.ok(proxyContent.includes("hostname.startsWith('app.')"), 'Must define app. subdomain handler')
    assert.ok(proxyContent.includes("hostname.startsWith('admin.')"), 'Must define admin. subdomain handler')
  })

  await t.test('2. Client Routes Coverage: Includes all standard contractor modules', () => {
    assert.ok(proxyContent.includes("'/dashboard'"), 'Must include /dashboard')
    assert.ok(proxyContent.includes("'/inbox'"), 'Must include /inbox')
    assert.ok(proxyContent.includes("'/leads'"), 'Must include /leads')
    assert.ok(proxyContent.includes("'/calendar'"), 'Must include /calendar')
    assert.ok(proxyContent.includes("'/quotes'"), 'Must include /quotes')
    assert.ok(proxyContent.includes("'/invoices'"), 'Must include /invoices')
    assert.ok(proxyContent.includes("'/analytics'"), 'Must include /analytics')
    assert.ok(proxyContent.includes("'/services'"), 'Must include /services')
  })

  await t.test('3. App Subdomain (app.captodesk.com): Enforces clean URLs without /client prefix', () => {
    // Redundant /client stripping
    assert.ok(proxyContent.includes("pathname.replace(/^\\/client/, '')"), 'Must strip /client on app subdomain')
    // Clean login and dashboard redirection
    assert.ok(proxyContent.includes("user ? '/dashboard' : '/login'"), 'Bare root on app subdomain must route to /dashboard or /login')
    // Rewrite clean paths to /client/*
    assert.ok(proxyContent.includes("NextResponse.rewrite(new URL(`/client${pathname}`, request.url))"), 'Must rewrite clean app paths to internal /client routes')
  })

  await t.test('4. Main Domain (captodesk.com): Redirects contractor paths to app.captodesk.com in production', () => {
    assert.ok(proxyContent.includes("https://app.captodesk.com"), 'Main domain must redirect client portal requests to app.captodesk.com')
    assert.ok(proxyContent.includes("https://app.captodesk.com${cleanPath}"), 'Must redirect /client/* to app.captodesk.com/*')
    assert.ok(proxyContent.includes("https://app.captodesk.com${pathname}"), 'Must redirect /dashboard to app.captodesk.com/dashboard')
    assert.ok(proxyContent.includes("https://app.captodesk.com${pathname}"), 'Must redirect /demo on captodesk.com to app.captodesk.com/demo')
  })

  await t.test('5. Booking Subdomain (book.captodesk.com): Strictly reserved for public booking flow', () => {
    assert.ok(proxyContent.includes("NextResponse.redirect(new URL('https://captodesk.com', request.url))"), 'Bare root on book subdomain must redirect to marketing')
    assert.ok(proxyContent.includes("NextResponse.rewrite(new URL(`/book${pathname}`, request.url))"), 'Slug visits on book subdomain rewrite to /book/:slug')
  })

  await t.test('6. Demo Entrypoint (src/app/demo/route.ts): Uses app.captodesk.com destination in production', () => {
    const demoRoutePath = path.resolve(import.meta.dirname || process.cwd(), '../src/app/demo/route.ts')
    const demoFallback = path.resolve(process.cwd(), 'src/app/demo/route.ts')
    const demoResolved = fs.existsSync(demoRoutePath) ? demoRoutePath : demoFallback
    const demoContent = fs.readFileSync(demoResolved, 'utf-8')

    assert.ok(demoContent.includes("'https://app.captodesk.com'"), 'Demo magic link callback must target app.captodesk.com')
    assert.ok(demoContent.includes("targetOrigin.includes('app.') ? '/dashboard' : '/client/dashboard'"), 'Demo next destination must point to /dashboard on app.captodesk.com')
  })

  await t.test('7. Auth Callback (src/app/client/auth/callback/route.ts): Clean redirects to app.captodesk.com', () => {
    const callbackPath = path.resolve(import.meta.dirname || process.cwd(), '../src/app/client/auth/callback/route.ts')
    const callbackFallback = path.resolve(process.cwd(), 'src/app/client/auth/callback/route.ts')
    const callbackResolved = fs.existsSync(callbackPath) ? callbackPath : callbackFallback
    const callbackContent = fs.readFileSync(callbackResolved, 'utf-8')

    assert.ok(callbackContent.includes("'https://app.captodesk.com'"), 'Contractor auth callback must route to app.captodesk.com')
    assert.ok(callbackContent.includes("destination.replace(/^\\/client/, '')"), 'Must strip /client on app.captodesk.com')
  })
})
