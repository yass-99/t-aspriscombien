import { SignUp } from '@clerk/nextjs'

export default function Page() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 16px 24px',
        background: 'var(--bg)',
      }}
    >
      <SignUp />
    </div>
  )
}
