import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/seance(.*)',
  '/api/seance(.*)',
  '/api/dashboard(.*)',
  '/settings(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  // Matcher large recommandé par Clerk : intercepte toutes les routes sauf les
  // assets statiques. Sans ça, `<Show>` / `auth()` sur la racine `/` lèvent
  // « auth() was called but Clerk can't detect usage of clerkMiddleware() ».
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
