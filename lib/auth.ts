import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/rateLimit'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // If a user already signed up with this email (e.g. via email/password),
      // link this Google sign-in to that existing account instead of failing
      // with OAuthAccountNotLinked. Safe here because Google verifies email
      // ownership — only enable this for providers that verify emails.
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = (credentials.email as string).toLowerCase().trim()
        const password = credentials.password as string

        // Brute-force protection: max 10 attempts per email per 15 minutes.
        const rl = rateLimit(`login:${email}`, 10, 15 * 60 * 1000)
        if (!rl.allowed) {
          throw new Error('TOO_MANY_ATTEMPTS')
        }

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const isValid = await compare(password, user.passwordHash)
        if (!isValid) {
          return null
        }

        // Check email verification
        if (!user.emailVerified) {
          throw new Error('EMAIL_NOT_VERIFIED')
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        }
      },
    }),
    // Email-verification link sign-in. Clicking the link in the verification
    // email opens a fresh tab with no saved password, so we log the user in
    // using the one-time verification token itself: validate it, mark the
    // account verified, consume the token, and return the user (creates a
    // session). This lets the link land directly on the home page.
    Credentials({
      id: 'verify-token',
      name: 'verify-token',
      credentials: {
        token: { label: 'Token', type: 'text' },
      },
      async authorize(credentials) {
        const token = credentials?.token as string | undefined
        if (!token) return null

        const vt = await prisma.verificationToken.findUnique({ where: { token } })
        if (!vt) return null

        // Expired → consume and reject
        if (vt.expires < new Date()) {
          await prisma.verificationToken.delete({ where: { token } }).catch(() => {})
          return null
        }

        const user = await prisma.user.findUnique({ where: { email: vt.identifier } })
        if (!user) {
          await prisma.verificationToken.delete({ where: { token } }).catch(() => {})
          return null
        }

        // Mark verified (idempotent) and consume the one-time token
        if (!user.emailVerified) {
          await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: new Date() },
          })
        }
        await prisma.verificationToken.delete({ where: { token } }).catch(() => {})

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        }
      },
    }),
  ],
  events: {},
  callbacks: {
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user
      const isProtected = nextUrl.pathname.startsWith('/game')

      if (isProtected && !isLoggedIn) {
        return Response.redirect(new URL('/login', nextUrl))
      }

      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})
