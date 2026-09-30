/* RM orb — spinning wireframe globe with a glowing RM mark.
   Markup:
     <canvas class="rm-orb" role="img" aria-label="RM logo"></canvas>
   Size the canvas with CSS. The backing store uses devicePixelRatio.
   prefers-reduced-motion draws a single static frame. */
(function () {
  "use strict";

  var TILT = 0.42;
  var FRAME_MS = 1000 / 60;

  function mount(canvas) {
    if (!canvas || canvas.getAttribute("data-rm-orb") === "on") return null;
    var ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return null;
    canvas.setAttribute("data-rm-orb", "on");

    var reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    var reduce = reduceQuery.matches;
    var angle = 0.6;
    var last = 0;
    var pending = false;
    var onscreen = true;

    function fit() {
      var css = canvas.clientWidth;
      if (!css) return 0;
      var dpr = window.devicePixelRatio || 1;
      if (dpr < 1) dpr = 1;
      if (dpr > 3) dpr = 3;
      var size = Math.max(1, Math.round(css * dpr));
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      return size;
    }

    function project(lat, lon, spin, radius, cx, cy) {
      var X = Math.cos(lat) * Math.cos(lon);
      var Y = Math.sin(lat);
      var Z = Math.cos(lat) * Math.sin(lon);
      var c1 = Math.cos(spin);
      var s1 = Math.sin(spin);
      var x1 = X * c1 - Z * s1;
      var z1 = X * s1 + Z * c1;
      var c2 = Math.cos(TILT);
      var s2 = Math.sin(TILT);
      var y2 = Y * c2 - z1 * s2;
      var z2 = Y * s2 + z1 * c2;
      return [cx + x1 * radius, cy - y2 * radius, z2];
    }

    function segment(a, b, style, width) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }

    function wire(points, scale) {
      for (var i = 1; i < points.length; i++) {
        var a = points[i - 1];
        var b = points[i];
        var depth = (a[2] + b[2]) / 2;
        var fade = (depth + 1) / 2;
        var hue = 160 + (1 - fade) * 110;
        var light = 55 + fade * 20;
        var alpha = 0.12 + fade * 0.85;
        segment(
          a,
          b,
          "hsla(" + hue + ",90%," + light + "%," + alpha + ")",
          (1.2 + fade * 2.6) * scale
        );
      }
    }

    function drawFull(spin) {
      var W = canvas.width;
      var radius = W * 0.36;
      var cx = W / 2;
      var cy = W / 2;
      var scale = W / 480;
      ctx.clearRect(0, 0, W, W);

      var glow = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.5);
      glow.addColorStop(0, "rgba(124,245,200,0.18)");
      glow.addColorStop(1, "rgba(11,13,18,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, W);

      var k, i, lat, lon, pts;
      for (k = -3; k <= 3; k++) {
        lat = (k * Math.PI) / 8;
        pts = [];
        for (i = 0; i <= 72; i++) {
          pts.push(project(lat, (i / 72) * Math.PI * 2, spin, radius, cx, cy));
        }
        wire(pts, scale);
      }
      for (k = 0; k < 8; k++) {
        lon = (k * Math.PI) / 8;
        pts = [];
        for (i = 0; i <= 72; i++) {
          pts.push(project(-Math.PI / 2 + (i / 72) * Math.PI, lon, spin, radius, cx, cy));
        }
        wire(pts, scale);
      }

      var orbit = [];
      for (i = 0; i <= 120; i++) {
        var a = (i / 120) * Math.PI * 2;
        orbit.push([
          cx + Math.cos(a) * radius * 1.28,
          cy + Math.sin(a) * radius * 0.42,
          Math.sin(a)
        ]);
      }
      for (i = 1; i < orbit.length; i++) {
        var fade = (orbit[i][2] + 1) / 2;
        segment(
          orbit[i - 1],
          orbit[i],
          "rgba(167,139,250," + (0.25 + fade * 0.7) + ")",
          (1.5 + fade * 2) * scale
        );
      }

      var sat = spin * 1.6;
      ctx.fillStyle = "#7cf5c8";
      ctx.shadowColor = "#7cf5c8";
      ctx.shadowBlur = 18 * scale;
      ctx.beginPath();
      ctx.arc(
        cx + Math.cos(sat) * radius * 1.28,
        cy + Math.sin(sat) * radius * 0.42,
        W * 0.018,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.save();
      var disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.62);
      disc.addColorStop(0, "rgba(11,13,18,0.92)");
      disc.addColorStop(0.7, "rgba(11,13,18,0.75)");
      disc.addColorStop(1, "rgba(11,13,18,0)");
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.62, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "800 " + W * 0.24 + "px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var pulse = 0.75 + 0.25 * Math.sin(spin * 3);
      ctx.shadowColor = "#7cf5c8";
      ctx.shadowBlur = W * 0.06 * pulse;
      var ink = ctx.createLinearGradient(
        cx - radius * 0.6,
        cy - radius * 0.4,
        cx + radius * 0.6,
        cy + radius * 0.4
      );
      ink.addColorStop(0, "#eafff7");
      ink.addColorStop(0.5, "#7cf5c8");
      ink.addColorStop(1, "#a78bfa");
      ctx.fillStyle = ink;
      ctx.fillText("RM", cx, cy + W * 0.01);
      ctx.restore();
    }

    /* Header size is about 40px. Fewer, thicker strokes and a larger RM
       so the mark stays readable instead of turning into hairlines. */
    function drawCompact(spin) {
      var W = canvas.width;
      var css = canvas.clientWidth || W;
      var dpr = W / css;
      var radius = W * 0.34;
      var cx = W / 2;
      var cy = W / 2;
      var minLine = 1.25 * dpr;
      ctx.clearRect(0, 0, W, W);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      function strokeWire(points) {
        var i, a, b, depth, fade, hue, light, alpha, width;
        for (i = 1; i < points.length; i++) {
          a = points[i - 1];
          b = points[i];
          depth = (a[2] + b[2]) / 2;
          fade = (depth + 1) / 2;
          if (fade < 0.46) continue;
          hue = 165 + (1 - fade) * 70;
          light = 64 + fade * 14;
          alpha = 0.55 + fade * 0.45;
          width = Math.max(minLine, (1.15 + fade * 0.9) * dpr);
          segment(a, b, "hsla(" + hue + ",92%," + light + "%," + alpha + ")", width);
        }
      }

      var steps = 32;
      var k, i, pts, lat, lon;
      for (k = -1; k <= 1; k++) {
        lat = (k * Math.PI) / 5;
        pts = [];
        for (i = 0; i <= steps; i++) {
          pts.push(project(lat, (i / steps) * Math.PI * 2, spin, radius, cx, cy));
        }
        strokeWire(pts);
      }
      for (k = 0; k < 4; k++) {
        lon = (k * Math.PI) / 4;
        pts = [];
        for (i = 0; i <= steps; i++) {
          pts.push(project(-Math.PI / 2 + (i / steps) * Math.PI, lon, spin, radius, cx, cy));
        }
        strokeWire(pts);
      }

      var orbitN = 40;
      var orbit = [];
      for (i = 0; i <= orbitN; i++) {
        var ang = (i / orbitN) * Math.PI * 2;
        orbit.push([
          cx + Math.cos(ang) * radius * 1.18,
          cy + Math.sin(ang) * radius * 0.38,
          Math.sin(ang)
        ]);
      }
      for (i = 1; i < orbit.length; i++) {
        var ofade = (orbit[i][2] + 1) / 2;
        segment(
          orbit[i - 1],
          orbit[i],
          "rgba(167,139,250," + (0.4 + ofade * 0.6) + ")",
          Math.max(minLine * 0.9, (0.95 + ofade * 0.7) * dpr)
        );
      }

      var sat = spin * 1.6;
      ctx.fillStyle = "#7cf5c8";
      ctx.shadowColor = "#7cf5c8";
      ctx.shadowBlur = 3 * dpr;
      ctx.beginPath();
      ctx.arc(
        cx + Math.cos(sat) * radius * 1.18,
        cy + Math.sin(sat) * radius * 0.38,
        Math.max(1.7 * dpr, W * 0.04),
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.save();
      var discR = radius * 0.78;
      var disc = ctx.createRadialGradient(cx, cy, discR * 0.15, cx, cy, discR);
      disc.addColorStop(0, "rgba(7,8,12,0.96)");
      disc.addColorStop(0.78, "rgba(7,8,12,0.88)");
      disc.addColorStop(1, "rgba(7,8,12,0)");
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(cx, cy, discR, 0, Math.PI * 2);
      ctx.fill();

      var fontPx = Math.max(10 * dpr, Math.round(W * 0.38));
      ctx.font = "800 " + fontPx + "px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(1, dpr * 0.7);
      ctx.strokeStyle = "rgba(7,8,12,0.72)";
      ctx.strokeText("RM", cx, cy + W * 0.015);
      ctx.shadowColor = "#7cf5c8";
      ctx.shadowBlur = 1.1 * dpr;
      var ink = ctx.createLinearGradient(cx - radius, cy - radius * 0.3, cx + radius, cy + radius * 0.45);
      ink.addColorStop(0, "#f4fffb");
      ink.addColorStop(0.6, "#7cf5c8");
      ink.addColorStop(1, "#b7a6ff");
      ctx.fillStyle = ink;
      ctx.fillText("RM", cx, cy + W * 0.015);
      ctx.restore();
    }

    function draw(spin) {
      if (canvas.clientWidth && canvas.clientWidth <= 72) drawCompact(spin);
      else drawFull(spin);
    }

    function schedule() {
      if (pending) return;
      pending = true;
      requestAnimationFrame(frame);
    }

    function frame(now) {
      pending = false;
      var size = fit();
      if (!size) {
        schedule();
        return;
      }
      if (!last) last = now;
      var dt = Math.min(50, now - last);
      last = now;
      draw(angle);
      if (reduce || document.hidden || !onscreen) return;
      angle += 0.008 * (dt / FRAME_MS);
      schedule();
    }

    function onReduce(event) {
      reduce = event.matches;
      if (reduce) draw(angle);
      else schedule();
    }

    function onVisibility() {
      if (!document.hidden && !reduce && onscreen) schedule();
    }

    if (reduceQuery.addEventListener) {
      reduceQuery.addEventListener("change", onReduce);
    } else if (reduceQuery.addListener) {
      reduceQuery.addListener(onReduce);
    }

    document.addEventListener("visibilitychange", onVisibility);

    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        if (fit() && (reduce || document.hidden || !onscreen)) draw(angle);
      }).observe(canvas);
    } else {
      window.addEventListener("resize", function () {
        if (fit() && (reduce || document.hidden || !onscreen)) draw(angle);
      });
    }

    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        onscreen = entries[0].isIntersecting;
        if (onscreen && !reduce && !document.hidden) schedule();
      }).observe(canvas);
    }

    if (fit()) draw(angle);
    if (!reduce || !canvas.clientWidth) schedule();
    return { canvas: canvas };
  }

  function boot() {
    var nodes = document.querySelectorAll("canvas.rm-orb");
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  window.RMOrb = { mount: mount };

  boot();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  }
})();
