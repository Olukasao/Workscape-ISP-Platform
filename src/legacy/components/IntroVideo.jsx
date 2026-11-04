import { useEffect, useRef, useState } from "react";

const INTRO_VIDEO_SRC = "/videos/01-comercial-intranet.mp4";
const INTRO_WATCHED_KEY = "introVideoWatched";

const readStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage indisponível
  }
};

export default function IntroVideo({ children }) {
  const [showIntro, setShowIntro] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  // Na primeira vez o vídeo precisa ser assistido inteiro; depois pode pular.
  const [canSkip] = useState(() => readStorage(INTRO_WATCHED_KEY) === "1");
  const videoRef = useRef(null);

  const finishIntro = () => {
    setFadingOut(true);
    setTimeout(() => setShowIntro(false), 500);
  };

  useEffect(() => {
    if (!showIntro || !videoRef.current) return;
    // Navegadores bloqueiam autoplay com som; tenta com som e cai para mudo.
    videoRef.current.play().catch(() => {
      if (!videoRef.current) return;
      videoRef.current.muted = true;
      videoRef.current.play().catch(finishIntro);
    });
  }, [showIntro]);

  if (!showIntro) return children;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadingOut ? 0 : 1,
        transition: "opacity 0.5s ease",
      }}
    >
      <video
        ref={videoRef}
        src={INTRO_VIDEO_SRC}
        playsInline
        onEnded={() => {
          writeStorage(INTRO_WATCHED_KEY, "1");
          finishIntro();
        }}
        onError={finishIntro}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      {canSkip && (
        <button
          type="button"
          onClick={finishIntro}
          style={{
            position: "absolute",
            right: 24,
            bottom: 24,
            padding: "8px 18px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.4)",
            background: "rgba(0,0,0,0.5)",
            color: "#fff",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Pular
        </button>
      )}
    </div>
  );
}
