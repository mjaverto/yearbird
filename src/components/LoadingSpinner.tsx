export function LoadingSpinner() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-white text-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute -inset-6 rounded-full bg-amber-100/70 blur-2xl" />
          <div className="relative text-4xl float-bird">🐦</div>
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Loading your year</p>
      </div>
    </div>
  )
}
