// script.js - improved dodge behavior + confetti + tiny sound
(function () {
  const noBtn = document.getElementById("noBtn");
  const yesBtn = document.getElementById("yesBtn");
  const buttonsWrap = document.querySelector(".buttons");
  const confettiCanvas = document.getElementById("confetti");
  const ctx = confettiCanvas.getContext && confettiCanvas.getContext("2d");

  // background music: file name expected at ./bg-music.mp3 (place your file there)
  let bgAudio = null;
  try {
    // use the mp3 filename you added — URL-encode to handle spaces/special chars
    // simplified audio filename for deployment
    const audioFile = "bg-music.mp3";
    bgAudio = new Audio(audioFile);
    bgAudio.loop = true;
    bgAudio.preload = "auto";
    bgAudio.autoplay = true;
    // lower the volume for background music
    bgAudio.volume = 0.12;
    bgAudio.crossOrigin = "anonymous";
    // User requested immediate playback without tapping. We'll attempt unmuted autoplay now.
    bgAudio.muted = false;
    // diagnostics
    bgAudio.addEventListener("error", (ev) => {
      console.error("bgAudio error event", ev, bgAudio.error);
      showPopup("Gagal memuat audio (lihat konsol)");
    });
    bgAudio.addEventListener("canplaythrough", () => {
      console.log("bgAudio canplaythrough — readyState=", bgAudio.readyState);
    });
    bgAudio.addEventListener("loadeddata", () => {
      console.log("bgAudio loadeddata — readyState=", bgAudio.readyState);
    });
  } catch (e) {
    bgAudio = null;
  }

  // resize canvas
  function fitCanvas() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }
  fitCanvas();
  window.addEventListener("resize", fitCanvas);

  // confetti pieces
  let confettiPieces = [];
  function spawnConfetti(x, y) {
    for (let i = 0; i < 20; i++) {
      confettiPieces.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * -6 - 2,
        size: Math.random() * 6 + 6,
        rot: Math.random() * 360,
        color: ["#ff4655", "#00d4ff", "#ffd166", "#6effb1"][
          Math.floor(Math.random() * 4)
        ],
        life: Math.random() * 60 + 60,
      });
    }
  }
  function renderConfetti() {
    if (!ctx) return;
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    for (let i = confettiPieces.length - 1; i >= 0; i--) {
      const p = confettiPieces[i];
      p.vy += 0.12; // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vx * 2;
      p.life--;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
      if (p.y > confettiCanvas.height + 30 || p.life <= 0)
        confettiPieces.splice(i, 1);
    }
    requestAnimationFrame(renderConfetti);
  }
  renderConfetti();

  // small oscillator sound on yes click
  function beep() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "sawtooth";
      o.frequency.value = 720;
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.06, ac.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.25);
      o.connect(g);
      g.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.28);
    } catch (e) {
      /* ignore on unsupported */
    }
  }

  // small toast/popup helper
  function showPopup(msg, duration = 2000) {
    try {
      const el = document.createElement("div");
      el.className = "toast";
      el.textContent = msg;
      document.body.appendChild(el);
      // trigger enter animation
      requestAnimationFrame(() => el.classList.add("show"));
      // remove after duration
      setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 280);
      }, duration);
    } catch (e) {
      /* ignore DOM errors */
    }
  }

  // helper to attempt starting background music
  function attemptPlayMusic() {
    if (!bgAudio) return;
    if (!bgAudio.paused) return;
    bgAudio.play().catch(() => {
      // play blocked by browser; inform user via toast
      showPopup("Klik tombol musik untuk mengaktifkan suara");
    });
  }

  // music toggle removed — autoplay will be attempted on load

  // Try autoplay immediately on load. Many browsers block autoplay with sound,
  // so we catch the failure and notify the user to enable it manually.
  if (bgAudio) {
    // Try unmuted autoplay immediately. If blocked, show a helpful toast.
    // Try to play — treat this audio as background music. If play succeeds
    // fade the volume in gently and add a body class so CSS can react.
    bgAudio
      .play()
      .then(() => {
        console.log("bgAudio.play() resolved on load");
        document.body.classList.add("has-bg-music");
        // gentle fade-in from 0 to target over 900ms
        try {
          const target = bgAudio.volume || 0.12;
          bgAudio.volume = 0;
          const step = 0.02;
          const iv = setInterval(() => {
            bgAudio.volume = Math.min(
              target,
              +(bgAudio.volume + step).toFixed(3)
            );
            if (bgAudio.volume >= target - 0.001) clearInterval(iv);
          }, 45);
        } catch (e) {
          /* ignore */
        }
      })
      .catch((err) => {
        console.warn("Autoplay failed (likely blocked by browser):", err);
        showPopup("Autoplay diblokir oleh browser — coba klik Ayo");
      })
      .finally(() => {
        // show current audio diagnostic in console
        console.log("bgAudio state", {
          paused: bgAudio.paused,
          muted: bgAudio.muted,
          volume: bgAudio.volume,
          readyState: bgAudio.readyState,
          src: bgAudio.src,
        });
      });
  }

  // smooth GPU-accelerated move using translate3d for smoothness
  let animating = false;
  function animateTo(element, targetLeft, targetTop, duration = 420) {
    if (!element) return Promise.resolve();
    const wrapRect = buttonsWrap.getBoundingClientRect();
    const currRect = element.getBoundingClientRect();
    // compute current position relative to wrap
    const currLeft = currRect.left - wrapRect.left;
    const currTop = currRect.top - wrapRect.top;

    // desired absolute left/top inside wrap
    const tgtLeft = Math.max(
      0,
      Math.min(targetLeft, Math.max(0, wrapRect.width - currRect.width))
    );
    const tgtTop = Math.max(
      0,
      Math.min(targetTop, Math.max(0, wrapRect.height - currRect.height))
    );

    // delta between current visual pos and target
    const deltaX = currLeft - tgtLeft;
    const deltaY = currTop - tgtTop;

    // place element at final left/top (so layout is correct), but offset visually by the delta
    element.style.position = "absolute";
    element.style.left = tgtLeft + "px";
    element.style.top = tgtTop + "px";

    // set starting transform to the delta so it appears in the original spot
    element.style.transition =
      "transform " + Math.max(160, duration) + "ms cubic-bezier(.22,.9,.2,1)";
    element.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
    // force reflow
    void element.offsetWidth;

    animating = true;
    return new Promise((res) => {
      let finished = false;
      function cleanup() {
        if (finished) return;
        finished = true;
        element.style.transition = "";
        element.style.transform = "";
        animating = false;
        res();
      }
      // on next frame, animate transform to 0,0
      requestAnimationFrame(() => {
        element.style.transform = "translate3d(0,0,0)";
      });
      // safety timeout in case transitionend doesn't fire
      const to = setTimeout(() => cleanup(), duration + 80);
      element.addEventListener("transitionend", function te(e) {
        if (e.propertyName !== "transform") return;
        clearTimeout(to);
        element.removeEventListener("transitionend", te);
        cleanup();
      });
    });
  }

  function getSafePosition(noRect, yesRect, wrapRect) {
    const margin = 8; // required gap (px) between buttons
    const padding = 6;
    const maxX = Math.max(0, wrapRect.width - noRect.width - padding);
    const maxY = Math.max(0, wrapRect.height - noRect.height - padding);

    function rectFrom(c) {
      return {
        left: wrapRect.left + c.x - margin,
        right: wrapRect.left + c.x + noRect.width + margin,
        top: wrapRect.top + c.y - margin,
        bottom: wrapRect.top + c.y + noRect.height + margin,
      };
    }

    function noOverlap(c) {
      const cand = rectFrom(c);
      // check if cand intersects yesRect (with margin)
      const intersects = !(
        cand.right <= yesRect.left ||
        cand.left >= yesRect.right ||
        cand.bottom <= yesRect.top ||
        cand.top >= yesRect.bottom
      );
      return !intersects;
    }

    // deterministic candidates (corners/sides)
    const candidates = [
      { x: 0, y: 0 },
      { x: maxX, y: 0 },
      { x: 0, y: maxY },
      { x: maxX, y: maxY },
      { x: Math.floor(maxX / 2), y: 0 },
      { x: Math.floor(maxX / 2), y: maxY },
      { x: 0, y: Math.floor(maxY / 2) },
      { x: maxX, y: Math.floor(maxY / 2) },
    ];

    for (const c of candidates) {
      if (noOverlap(c)) return c;
    }

    // heuristics: try to place opposite side from YES button center
    const yesCenterX = (yesRect.left + yesRect.right) / 2 - wrapRect.left;
    const yesCenterY = (yesRect.top + yesRect.bottom) / 2 - wrapRect.top;
    const preferX = yesCenterX < wrapRect.width / 2 ? maxX : 0;
    const preferY = yesCenterY < wrapRect.height / 2 ? maxY : 0;
    const preferred = { x: preferX, y: preferY };
    if (noOverlap(preferred)) return preferred;

    // fallback: random sampling, but ensure no overlap
    for (let i = 0; i < 60; i++) {
      const rx = Math.floor(Math.random() * (maxX + 1));
      const ry = Math.floor(Math.random() * (maxY + 1));
      if (noOverlap({ x: rx, y: ry })) return { x: rx, y: ry };
    }

    // last resort: return a clamped position (will likely overlap slightly)
    return {
      x: Math.floor(Math.max(0, Math.min(maxX, yesCenterX + 60))),
      y: Math.floor(Math.max(0, Math.min(maxY, yesCenterY + 60))),
    };
  }

  function moveNoButtonAway() {
    const wrapRect = buttonsWrap.getBoundingClientRect();
    const yesRect = yesBtn.getBoundingClientRect();
    const noRect = noBtn.getBoundingClientRect();
    const safe = getSafePosition(noRect, yesRect, wrapRect);
    noBtn.style.position = "absolute";
    return animateTo(noBtn, safe.x, safe.y, 360);
  }

  // compute a target position that moves the no button away from a pointer (ptrX, ptrY)
  function computeAwayPosition(ptrX, ptrY) {
    const wrapRect = buttonsWrap.getBoundingClientRect();
    const yesRect = yesBtn.getBoundingClientRect();
    const noRect = noBtn.getBoundingClientRect();
    const noCenterX = noRect.left + noRect.width / 2;
    const noCenterY = noRect.top + noRect.height / 2;

    // direction from pointer to button center (move opposite of pointer)
    let vx = noCenterX - ptrX;
    let vy = noCenterY - ptrY;
    const len = Math.hypot(vx, vy) || 1;
    vx /= len;
    vy /= len;

    // desired move distance (try to push it outside the immediate area)
    const moveDist = Math.max(
      120,
      Math.min(220, Math.max(wrapRect.width, wrapRect.height) * 0.22)
    );
    // compute desired top-left inside wrap
    const desiredCenterX = noCenterX + vx * moveDist;
    const desiredCenterY = noCenterY + vy * moveDist;
    const desiredLeft = Math.round(
      desiredCenterX - noRect.width / 2 - wrapRect.left
    );
    const desiredTop = Math.round(
      desiredCenterY - noRect.height / 2 - wrapRect.top
    );

    // clamp to wrap
    const maxX = Math.max(0, wrapRect.width - noRect.width - 6);
    const maxY = Math.max(0, wrapRect.height - noRect.height - 6);
    const clamped = {
      x: Math.max(0, Math.min(maxX, desiredLeft)),
      y: Math.max(0, Math.min(maxY, desiredTop)),
    };

    // Quick overlap check with yes; if overlapping, fallback to safe position
    const candRect = {
      left: wrapRect.left + clamped.x,
      right: wrapRect.left + clamped.x + noRect.width,
      top: wrapRect.top + clamped.y,
      bottom: wrapRect.top + clamped.y + noRect.height,
    };
    const intersects = !(
      candRect.right <= yesRect.left ||
      candRect.left >= yesRect.right ||
      candRect.bottom <= yesRect.top ||
      candRect.top >= yesRect.bottom
    );
    if (!intersects) return clamped;

    // if it intersects, prefer an opposite-side deterministic placement
    const yesCenterX = (yesRect.left + yesRect.right) / 2 - wrapRect.left;
    const yesCenterY = (yesRect.top + yesRect.bottom) / 2 - wrapRect.top;
    const preferX = yesCenterX < wrapRect.width / 2 ? maxX : 0;
    const preferY = yesCenterY < wrapRect.height / 2 ? maxY : 0;
    const preferred = { x: preferX, y: preferY };
    // if preferred is safe, return it
    const prefRect = {
      left: wrapRect.left + preferred.x,
      right: wrapRect.left + preferred.x + noRect.width,
      top: wrapRect.top + preferred.y,
      bottom: wrapRect.top + preferred.y + noRect.height,
    };
    const prefIntersects = !(
      prefRect.right <= yesRect.left ||
      prefRect.left >= yesRect.right ||
      prefRect.bottom <= yesRect.top ||
      prefRect.top >= yesRect.bottom
    );
    if (!prefIntersects) return preferred;

    // otherwise use getSafePosition fallback
    return getSafePosition(noRect, yesRect, wrapRect);
  }

  // cooldown so the button doesn't jitter too frequently
  let lastMoveTs = 0;
  // progressive shrink state
  let holdInterval = null;
  let holdActive = false;
  let lastShrinkTs = 0;
  // ensure CSS variable exists
  noBtn.style.setProperty(
    "--btn-scale",
    getComputedStyle(noBtn).getPropertyValue("--btn-scale") || "1"
  );

  // proximity detection
  function onPointerMove(e) {
    const ptrX =
      e.clientX !== undefined
        ? e.clientX
        : (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
    const ptrY =
      e.clientY !== undefined
        ? e.clientY
        : (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
    const noRect = noBtn.getBoundingClientRect();
    const centerX = noRect.left + noRect.width / 2;
    const centerY = noRect.top + noRect.height / 2;
    const d = Math.hypot(ptrX - centerX, ptrY - centerY);
    const now = Date.now();
    // only trigger if pointer is close and not currently animating and outside cooldown
    if (d < 140 && !animating && now - lastMoveTs > 120) {
      lastMoveTs = now;
      const target = computeAwayPosition(ptrX, ptrY);
      noBtn.classList.remove("shake");
      void noBtn.offsetWidth;
      noBtn.classList.add("shake");
      animateTo(noBtn, target.x, target.y, 360);
      yesBtn.classList.add("grow");
      setTimeout(() => yesBtn.classList.remove("grow"), 700);
    }
  }

  // Disabled pointer-based dodge: clicking 'no' will now shrink it and grow the 'yes' button instead.
  // buttonsWrap.addEventListener('mousemove', onPointerMove);
  // buttonsWrap.addEventListener('touchstart', function(e){ onPointerMove(e); }, {passive:true});

  // support hold-to-shrink: mouse and touch
  noBtn.addEventListener("mousedown", startHold);
  document.addEventListener("mouseup", stopHold);
  noBtn.addEventListener("touchstart", startHold, { passive: false });
  document.addEventListener("touchend", stopHold);

  function shrinkOnce() {
    const now = Date.now();
    if (now - lastShrinkTs < 60) return; // throttle
    lastShrinkTs = now;
    const cur =
      parseFloat(getComputedStyle(noBtn).getPropertyValue("--btn-scale")) || 1;
    const factor = 0.88; // shrink per press
    const minScale = 0.28;
    const next = Math.max(minScale, parseFloat((cur * factor).toFixed(3)));
    noBtn.style.setProperty("--btn-scale", String(next));
    // visual confirmation on YES
    yesBtn.classList.add("grow");
    setTimeout(() => yesBtn.classList.remove("grow"), 700);
  }

  function startHold(e) {
    if (e && e.cancelable) e.preventDefault();
    if (holdActive) return;
    holdActive = true;
    shrinkOnce();
    holdInterval = setInterval(shrinkOnce, 140);
  }

  function stopHold() {
    holdActive = false;
    if (holdInterval) {
      clearInterval(holdInterval);
      holdInterval = null;
    }
  }

  function handleNoAttempt(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    shrinkOnce();
  }
  noBtn.addEventListener("click", handleNoAttempt);
  noBtn.addEventListener("touchend", handleNoAttempt, { passive: false });
  noBtn.addEventListener("focus", () => noBtn.blur());

  yesBtn.addEventListener("click", (ev) => {
    // show popup then visual confirmation (also try to start music)
    showPopup("gas login");
    // Try to unmute and start audio immediately on this explicit user gesture.
    if (bgAudio) {
      try {
        bgAudio.muted = false;
        bgAudio.volume = 0.28;
        bgAudio
          .play()
          .then(() => {
            showPopup("Musik aktif");
          })
          .catch((err) => {
            // show helpful message
            console.warn("Audio play failed on Ayo click:", err);
            showPopup("Tidak dapat memutar musik (periksa konsol)");
          });
      } catch (e) {
        console.warn("Audio error", e);
        showPopup("Error audio");
      }
    } else {
      showPopup("File musik tidak ditemukan");
    }
    yesBtn.textContent = "Yay! 🎮 Ajak terkirim";
    yesBtn.disabled = true;
    yesBtn.style.cursor = "default";
    yesBtn.style.opacity = "0.98";
    // spawn confetti near yes button center
    const r = yesBtn.getBoundingClientRect();
    spawnConfetti(r.left + r.width / 2, r.top + r.height / 2);
    beep();
  });

  // keyboard support
  noBtn.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      handleNoAttempt(ev);
    }
  });
})();
