export default function ThemeBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden print:hidden"
    >
      {/* 1. ОКЕАНСКОЕ СТЕКЛО — жидкий градиент + плывущие орбы */}
      <div className="theme-scene theme-scene--ocean absolute inset-0">
        <div
          className="absolute inset-0 animate-gradient-flow"
          style={{
            background:
              'linear-gradient(125deg, #7DD3FC 0%, #99F6E4 30%, #A5B4FC 62%, #67E8F9 85%, #93C5FD 100%)',
            backgroundSize: '300% 300%',
          }}
        />
        <div
          className="absolute -top-28 -left-24 w-[520px] h-[520px] rounded-full blur-3xl opacity-75 animate-aurora-a"
          style={{ background: 'radial-gradient(circle, #38BDF8, transparent 68%)' }}
        />
        <div
          className="absolute top-1/4 -right-24 w-[560px] h-[560px] rounded-full blur-3xl opacity-70 animate-aurora-b"
          style={{ background: 'radial-gradient(circle, #2DD4BF, transparent 68%)' }}
        />
        <div
          className="absolute -bottom-32 left-1/4 w-[620px] h-[620px] rounded-full blur-3xl opacity-65 animate-aurora-c"
          style={{ background: 'radial-gradient(circle, #818CF8, transparent 68%)' }}
        />
        <svg
          className="absolute inset-0 w-full h-full opacity-45"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
        >
          <circle
            cx="140"
            cy="180"
            r="90"
            fill="rgba(255,255,255,0.28)"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="2"
            className="animate-float"
          />
          <circle
            cx="1290"
            cy="220"
            r="130"
            fill="rgba(255,255,255,0.22)"
            stroke="rgba(255,255,255,0.65)"
            strokeWidth="2"
            className="animate-float-reverse"
          />
          <circle
            cx="1180"
            cy="760"
            r="75"
            fill="rgba(255,255,255,0.25)"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="2"
            className="animate-float"
          />
          <path
            d="M0 730 Q 360 630 720 720 T 1440 690 L 1440 900 L 0 900 Z"
            fill="rgba(255,255,255,0.22)"
          />
          <path
            d="M0 800 Q 420 710 840 790 T 1440 770 L 1440 900 L 0 900 Z"
            fill="rgba(255,255,255,0.18)"
          />
        </svg>
      </div>

      {/* 2. ШКОЛЬНАЯ ДОСКА — мягкий перелив света и мерцание мела */}
      <div className="theme-scene theme-scene--chalk absolute inset-0">
        <div
          className="absolute inset-0 animate-gradient-flow"
          style={{
            background:
              'linear-gradient(135deg, #071914 0%, #154236 35%, #0E332A 65%, #1D4D3D 100%)',
            backgroundSize: '260% 260%',
          }}
        />
        <div
          className="absolute -top-24 left-1/4 w-[620px] h-[420px] rounded-full blur-3xl opacity-35 animate-aurora-a"
          style={{ background: 'radial-gradient(circle, #34D399, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-[520px] h-[380px] rounded-full blur-3xl opacity-25 animate-aurora-b"
          style={{ background: 'radial-gradient(circle, #FACC15, transparent 70%)' }}
        />
        {/* Тонкая клетка разметки доски */}
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        {/* Меловые формулы и геометрия по краям экрана */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <g
            stroke="#F8FAFC"
            strokeOpacity="0.18"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="48,250 48,125 185,250" strokeDasharray="6 4" />
            <rect x="48" y="232" width="18" height="18" />

            <circle cx="1325" cy="195" r="78" strokeDasharray="8 6" />
            <line x1="1325" y1="195" x2="1392" y2="155" />
            <circle cx="1325" cy="195" r="4" fill="#FDE047" fillOpacity="0.6" className="animate-twinkle" />

            <line x1="40" y1="770" x2="245" y2="770" />
            <line x1="142" y1="835" x2="142" y2="625" />
            <path
              d="M 72 645 Q 142 865 212 645"
              stroke="#FDE047"
              strokeOpacity="0.28"
              strokeWidth="2.5"
              className="animate-twinkle-slow"
            />

            <line x1="1210" y1="790" x2="1390" y2="790" />
            <line x1="1210" y1="790" x2="1340" y2="675" />
            <path
              d="M 1265 790 A 55 55 0 0 0 1252 753"
              stroke="#FDE047"
              strokeOpacity="0.34"
              strokeWidth="2.5"
            />
          </g>

          <g fill="#FFFFFF" fillOpacity="0.16" fontFamily="monospace" fontWeight="700">
            <text x="58" y="286" fontSize="22">a² + b² = c²</text>
            <text x="1260" y="305" fontSize="24" fill="#FDE047" fillOpacity="0.26" className="animate-twinkle-slow">
              C = 2πR
            </text>
            <text x="52" y="470" fontSize="54" className="animate-float">∑</text>
            <text x="1315" y="485" fontSize="48" className="animate-float-reverse">π ≈ 3,14</text>
            <text x="55" y="600" fontSize="26">3/4 + 1/2 = 1¼</text>
            <text x="1225" y="645" fontSize="24">100% = 1</text>
            <text x="680" y="860" fontSize="24" textAnchor="middle">
              y = kx + b   ·   S = a · b   ·   V = s / t
            </text>
          </g>
        </svg>
      </div>

      {/* 3. ТЁПЛЫЙ ЗАКАТ — перелив неба + дышащее солнце */}
      <div className="theme-scene theme-scene--sunset absolute inset-0">
        <div
          className="absolute inset-0 animate-gradient-flow"
          style={{
            background:
              'linear-gradient(135deg, #FDE68A 0%, #FDBA74 28%, #FDA4AF 60%, #F9A8D4 84%, #FDE2C4 100%)',
            backgroundSize: '300% 300%',
          }}
        />
        <div
          className="absolute -top-20 right-8 sm:right-20 w-[380px] h-[380px] rounded-full opacity-90 animate-sun-pulse"
          style={{
            background:
              'radial-gradient(circle at 35% 35%, #FEF08A 0%, #FB923C 52%, rgba(234,88,12,0) 74%)',
          }}
        />
        <div
          className="absolute top-1/3 -left-24 w-[480px] h-[480px] rounded-full blur-3xl opacity-55 animate-aurora-b"
          style={{ background: 'radial-gradient(circle, #FB7185, transparent 70%)' }}
        />
        <svg
          className="absolute inset-x-0 bottom-0 w-full h-[46vh]"
          viewBox="0 0 1440 420"
          preserveAspectRatio="none"
        >
          <path
            d="M0 240 Q 260 110 560 210 T 1140 170 Q 1300 130 1440 190 L 1440 420 L 0 420 Z"
            fill="rgba(234, 88, 12, 0.18)"
          />
          <path
            d="M0 300 Q 340 190 740 280 T 1440 240 L 1440 420 L 0 420 Z"
            fill="rgba(190, 24, 93, 0.14)"
          />
          <path
            d="M0 355 Q 420 290 880 350 T 1440 320 L 1440 420 L 0 420 Z"
            fill="rgba(154, 52, 18, 0.16)"
          />
        </svg>
      </div>

      {/* 4. КОМИКС-ЗИН — движущаяся поп-арт сетка + живые наклейки */}
      <div className="theme-scene theme-scene--comic absolute inset-0">
        <div
          className="absolute inset-0 animate-gradient-flow"
          style={{
            background:
              'linear-gradient(135deg, #FDE047 0%, #FEF08A 40%, #FACC15 70%, #FDE68A 100%)',
            backgroundSize: '260% 260%',
          }}
        />
        <div
          className="absolute inset-0 animate-dots-drift"
          style={{
            backgroundImage:
              'radial-gradient(rgba(15, 23, 42, 0.22) 1.6px, transparent 1.6px)',
            backgroundSize: '20px 20px',
          }}
        />
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
        >
          <polygon
            points="-20,120 175,65 120,255"
            fill="#F43F5E"
            stroke="#0F172A"
            strokeWidth="4"
            className="animate-float"
          />
          <circle
            cx="1385"
            cy="145"
            r="105"
            fill="#38BDF8"
            stroke="#0F172A"
            strokeWidth="4"
            className="animate-float-reverse"
          />
          <rect
            x="1265"
            y="700"
            width="210"
            height="210"
            rx="24"
            transform="rotate(16 1370 805)"
            fill="#A855F7"
            stroke="#0F172A"
            strokeWidth="4"
            className="animate-float"
          />
          <polygon
            points="70,690 95,755 165,755 110,795 130,860 70,820 10,860 30,795 -25,755 45,755"
            fill="#34D399"
            stroke="#0F172A"
            strokeWidth="4"
            className="animate-float-reverse"
          />
        </svg>
      </div>

      {/* 5. КИБЕР-КОСМОС — северное сияние, мерцающие звёзды и бегущая сетка */}
      <div className="theme-scene theme-scene--cosmos absolute inset-0">
        <div
          className="absolute inset-0 animate-gradient-flow"
          style={{
            background:
              'linear-gradient(160deg, #040714 0%, #0E1033 35%, #1A0B36 68%, #071A2F 100%)',
            backgroundSize: '260% 260%',
          }}
        />
        {/* Живое северное сияние с переливом цвета */}
        <div
          className="absolute -top-36 -left-24 w-[620px] h-[620px] rounded-full blur-3xl opacity-60 animate-aurora-hue"
          style={{ background: 'radial-gradient(circle, #6366F1, transparent 66%)' }}
        />
        <div
          className="absolute top-6 -right-24 w-[580px] h-[580px] rounded-full blur-3xl opacity-55 animate-aurora-b"
          style={{ background: 'radial-gradient(circle, #06B6D4, transparent 66%)' }}
        />
        <div
          className="absolute -bottom-36 left-1/3 w-[640px] h-[460px] rounded-full blur-3xl opacity-50 animate-aurora-c"
          style={{ background: 'radial-gradient(circle, #EC4899, transparent 68%)' }}
        />

        {/* Бегущая неоновая сетка у горизонта */}
        <div
          className="absolute inset-x-0 bottom-0 h-[36vh] opacity-40 animate-grid-scroll"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(56, 189, 248, 0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(168, 85, 247, 0.4) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'linear-gradient(to top, black 0%, transparent 95%)',
            WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 95%)',
          }}
        />

        {/* Мерцающее звёздное небо */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
        >
          <g fill="#FFFFFF" className="animate-twinkle">
            <circle cx="95" cy="110" r="2.2" />
            <circle cx="420" cy="150" r="2.2" />
            <circle cx="890" cy="120" r="2" />
            <circle cx="1310" cy="140" r="2" />
            <circle cx="80" cy="670" r="2" />
          </g>
          <g fill="#BAE6FD" className="animate-twinkle-slow">
            <circle cx="240" cy="65" r="1.8" />
            <circle cx="670" cy="85" r="1.8" />
            <circle cx="1110" cy="70" r="2.4" />
            <circle cx="160" cy="390" r="2" />
            <circle cx="1340" cy="420" r="2.2" />
            <circle cx="1290" cy="710" r="1.8" />
            <circle cx="540" cy="240" r="1.5" />
            <circle cx="980" cy="280" r="1.7" />
          </g>
          <g fill="#7DD3FC" className="animate-twinkle">
            <path d="M 185 180 L 188 192 L 200 195 L 188 198 L 185 210 L 182 198 L 170 195 L 182 192 Z" />
            <path d="M 1240 230 L 1243 240 L 1253 243 L 1243 246 L 1240 256 L 1237 246 L 1227 243 L 1237 240 Z" />
            <path
              d="M 110 560 L 112 568 L 120 570 L 112 572 L 110 580 L 108 572 L 100 570 L 108 568 Z"
              fill="#F472B6"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}