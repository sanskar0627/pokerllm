import Link from 'next/link'

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Full-screen casino background */}
      <img
        src="/images/casino-bg.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-6">
          {/* Logo video */}
          <video
            src="/videos/logo_loading_small.mp4"
            autoPlay
            muted
            playsInline
            className="w-48 h-48 mx-auto object-contain"
          />

          <h1 className="font-pixel text-[24px] text-[#FFD700] tracking-[3px] drop-shadow-[0_0_20px_rgba(255,215,0,0.5)]">
            POKERLLM
          </h1>
          <p className="font-pixel text-[7px] text-white/40 tracking-[2px]">NO LOGIN REQUIRED IN V1</p>
          <Link
            href="/"
            className="inline-block relative overflow-hidden rounded-xl active:scale-[0.98] transition-all"
          >
            <img
              src="/images/buttons/play-btn.png"
              alt="Go to Lobby"
              className="w-56 h-auto hover:brightness-110 transition-all"
              draggable={false}
            />
          </Link>
        </div>
      </div>
    </main>
  )
}
