window.ScheduleHolidayParticles = (() => {
  const configs = {
    "new-year": {
      colors: ["#ffffff", "#f8fdff", "#dff3ff"],
      shape: "snow",
      sizeRange: [2, 5],
      imageSizeRange: [6, 14],
      dotSizeRange: [2, 5],
      speedRange: [0.45, 1.18],
      driftRange: [-0.42, 0.42],
      maxParticles: 96,
      direction: "down",
      twinkle: true,
      opacityRange: [0.54, 0.92],
      imageChance: 0.76,
      assets: ["Img/Snow1.svg", "Img/Snow2.svg"]
    },
    "russia-day": {
      colors: ["#ffffff", "#e7edf6", "#2f67d8", "#1e55c0", "#e23d3d", "#c93535"],
      shape: "circle",
      sizeRange: [5, 15],
      speedRange: [0.35, 1.85],
      driftRange: [-0.9, 0.9],
      maxParticles: 86,
      direction: "up",
      twinkle: true,
      opacityRange: [0.42, 0.86],
      burstMode: true
    },
    easter: {
      colors: ["#f9e4b7", "#f8c8d2", "#c7e9c0", "#b8d4e3", "#fde5c8", "#e6c3a0"],
      shape: "mixed",
      sizeRange: [5, 16],
      speedRange: [0.28, 1.15],
      driftRange: [-0.42, 0.42],
      maxParticles: 58,
      direction: "down",
      twinkle: true,
      opacityRange: [0.46, 0.86]
    },
    "tagil-day": {
      colors: ["#ff6b1a", "#ff8c2e", "#ffa040", "#ffb85c", "#f0650e", "#ffd166"],
      shape: "spark",
      sizeRange: [3, 12],
      speedRange: [0.7, 2.55],
      driftRange: [-0.82, 0.82],
      maxParticles: 104,
      direction: "up",
      twinkle: true,
      opacityRange: [0.58, 1],
      glow: true
    },
    september: {
      colors: ["#e8a84c", "#d4913e", "#f0b65c", "#c2782a", "#bd7e34", "#f5d08c"],
      shape: "leaf",
      sizeRange: [6, 20],
      speedRange: [0.42, 1.28],
      driftRange: [-0.78, 0.78],
      maxParticles: 70,
      direction: "down",
      twinkle: false,
      opacityRange: [0.48, 0.84]
    },
    "march-8": {
      colors: ["#ff8fb8", "#d86be8", "#9f67ff"],
      shape: "petal-flower",
      sizeRange: [5, 17],
      speedRange: [0.38, 1.34],
      driftRange: [-1.08, 1.08],
      maxParticles: 68,
      direction: "down",
      twinkle: true,
      opacityRange: [0.48, 0.9]
    },
    "february-23": {
      colors: ["#E08F1A", "#d7b15f", "#32281A"],
      shape: "star",
      sizeRange: [5, 14],
      speedRange: [0.45, 1.18],
      driftRange: [-0.46, 0.46],
      maxParticles: 58,
      direction: "down",
      twinkle: true,
      opacityRange: [0.38, 0.8]
    }
  };

  const images = new Map();
  let canvas;
  let ctx;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];
  let frameId = 0;
  let active = "none";
  let resizeBound = false;

  function randomBetween([min, max]) {
    return min + Math.random() * (max - min);
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function getCanvas() {
    if (!canvas) {
      canvas = document.querySelector("#holidayParticles");
    }
    return canvas;
  }

  function getContext() {
    const element = getCanvas();
    if (!element) return null;
    if (!ctx) {
      ctx = element.getContext("2d");
    }
    return ctx;
  }

  function loadAssets(config) {
    if (!config.assets) return;
    config.assets.forEach((src) => {
      if (images.has(src)) return;
      const image = new Image();
      image.src = src;
      images.set(src, image);
    });
  }

  function resize() {
    const element = getCanvas();
    const context = getContext();
    if (!element || !context) return;

    const nextWidth = window.innerWidth;
    const nextHeight = window.innerHeight;
    const scaleX = width ? nextWidth / width : 1;
    const scaleY = height ? nextHeight / height : 1;

    width = nextWidth;
    height = nextHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    element.width = Math.round(width * dpr);
    element.height = Math.round(height * dpr);
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    particles.forEach((particle) => {
      particle.x *= scaleX;
      particle.y *= scaleY;
    });
  }

  class Particle {
    constructor(config) {
      this.config = config;
      this.reset(true);
    }

    reset(initial = false) {
      const config = this.config;
      this.x = Math.random() * width;
      this.y = config.direction === "up"
        ? (initial ? Math.random() * height : height + Math.random() * 80 + 20)
        : (initial ? Math.random() * height : -Math.random() * 80 - 20);
      this.variant = this.pickVariant(config);
      this.size = randomBetween(this.sizeRangeFor(config));
      this.speed = randomBetween(config.speedRange);
      this.drift = randomBetween(config.driftRange);
      this.color = pick(config.colors);
      this.opacity = randomBetween(config.opacityRange);
      this.twinklePhase = Math.random() * Math.PI * 2;
      this.twinkleSpeed = 0.018 + Math.random() * 0.045;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.035;
      this.life = 0;
      this.maxLife = Math.ceil((height + 220) / Math.max(this.speed, 0.08)) + 120 + Math.random() * 180;
      this.wave = Math.random() * Math.PI * 2;
      this.waveSpeed = 0.008 + Math.random() * 0.018;
      this.burstAngle = config.burstMode ? Math.random() * Math.PI * 2 : 0;
      this.burstSpeed = config.burstMode ? 0.35 + Math.random() * 1.7 : 0;
    }

    sizeRangeFor(config) {
      if (this.variant.type === "image" && config.imageSizeRange) return config.imageSizeRange;
      if (this.variant.type === "dot" && config.dotSizeRange) return config.dotSizeRange;
      return config.sizeRange;
    }

    pickVariant(config) {
      if (config.shape === "snow") {
        if (config.assets && Math.random() < config.imageChance) {
          return { type: "image", src: pick(config.assets) };
        }
        return { type: "dot" };
      }

      if (config.shape === "mixed") {
        return { type: pick(["circle", "egg", "flower"]) };
      }

      if (config.shape === "petal-flower") {
        return { type: Math.random() < 0.52 ? "petal" : "flower" };
      }

      return { type: config.shape };
    }

    update() {
      const config = this.config;
      const vertical = config.direction === "up" ? -this.speed : this.speed;
      this.life += 1;
      this.wave += this.waveSpeed;
      this.y += vertical;
      this.x += this.drift + Math.sin(this.wave) * 0.18;
      this.rotation += this.rotationSpeed;

      if (config.burstMode) {
        this.x += Math.cos(this.burstAngle) * this.burstSpeed * 0.48;
        this.y += Math.sin(this.burstAngle) * this.burstSpeed * 0.34;
        this.burstSpeed *= 0.992;
      }

      if (config.twinkle) {
        this.twinklePhase += this.twinkleSpeed;
      }

      const margin = 64;
      const outY = config.direction === "up" ? this.y < -margin : this.y > height + margin;
      const outX = this.x < -margin || this.x > width + margin;
      if (outY || outX || this.life > this.maxLife) {
        this.reset();
      }
    }

    draw(context) {
      let alpha = this.opacity;
      if (this.config.twinkle) {
        alpha *= 0.68 + 0.32 * Math.sin(this.twinklePhase);
      }

      context.save();
      context.translate(this.x, this.y);
      context.rotate(this.rotation);
      context.globalAlpha = Math.max(0.12, alpha);
      context.fillStyle = this.color;
      context.strokeStyle = this.color;
      context.lineWidth = 1.2;

      if (this.config.glow) {
        context.shadowColor = this.color;
        context.shadowBlur = this.size * 2.4;
      }

      this.drawShape(context);
      context.restore();
    }

    drawShape(context) {
      const size = this.size;
      const type = this.variant.type;

      if (type === "image") {
        const image = images.get(this.variant.src);
        if (image && image.complete && image.naturalWidth > 0) {
          context.drawImage(image, -size / 2, -size / 2, size, size);
          return;
        }
        drawCircle(context, size);
        return;
      }

      if (type === "dot" || type === "circle") {
        drawCircle(context, size);
        return;
      }

      if (type === "petal") {
        drawPetal(context, size, 0.48, 0.2);
        return;
      }

      if (type === "leaf") {
        drawPetal(context, size, 0.5, 0.18);
        context.beginPath();
        context.moveTo(-size * 0.36, 0);
        context.quadraticCurveTo(0, size * 0.06, size * 0.36, 0);
        context.strokeStyle = "rgba(92, 57, 24, 0.28)";
        context.stroke();
        return;
      }

      if (type === "star") {
        drawStar(context, size, 5, 0.5, 0.22);
        return;
      }

      if (type === "spark") {
        drawSpark(context, size);
        return;
      }

      if (type === "egg") {
        context.beginPath();
        context.ellipse(0, size * 0.08, size * 0.34, size * 0.5, 0, 0, Math.PI * 2);
        context.fill();
        return;
      }

      if (type === "flower") {
        for (let index = 0; index < 6; index += 1) {
          const angle = (index * Math.PI) / 3;
          context.beginPath();
          context.arc(Math.cos(angle) * size * 0.26, Math.sin(angle) * size * 0.26, size * 0.17, 0, Math.PI * 2);
          context.fill();
        }
        context.beginPath();
        context.arc(0, 0, size * 0.14, 0, Math.PI * 2);
        context.fillStyle = "rgba(255, 255, 255, 0.55)";
        context.fill();
      }
    }
  }

  function drawCircle(context, size) {
    context.beginPath();
    context.arc(0, 0, size / 2, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(35, 45, 62, 0.1)";
    context.stroke();
  }

  function drawPetal(context, size, radiusX, radiusY) {
    context.beginPath();
    context.ellipse(0, 0, size * radiusX, size * radiusY, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(0, 0, size * radiusX * 0.52, size * radiusY * 0.48, 0, 0, Math.PI * 2);
    context.fillStyle = "rgba(255, 255, 255, 0.26)";
    context.fill();
  }

  function drawStar(context, size, points, outerRatio, innerRatio) {
    context.beginPath();
    for (let index = 0; index < points * 2; index += 1) {
      const radius = index % 2 === 0 ? size * outerRatio : size * innerRatio;
      const angle = (index * Math.PI) / points - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
  }

  function drawSpark(context, size) {
    const longArm = size * 0.58;
    const shortArm = size * 0.32;
    context.lineWidth = Math.max(1, size * 0.12);
    context.lineCap = "round";

    for (let index = 0; index < 8; index += 1) {
      const angle = (index * Math.PI) / 4;
      const length = index % 2 === 0 ? longArm : shortArm;
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
      context.stroke();
    }

    context.beginPath();
    context.arc(0, 0, size * 0.16, 0, Math.PI * 2);
    context.fillStyle = "#fff7d6";
    context.fill();
  }

  function animate() {
    const context = getContext();
    if (!context) return;

    context.clearRect(0, 0, width, height);
    particles.forEach((particle) => {
      particle.update();
      particle.draw(context);
    });
    frameId = window.requestAnimationFrame(animate);
  }

  function stop() {
    if (frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
    particles = [];
    active = "none";
    const context = getContext();
    if (context) {
      context.clearRect(0, 0, width, height);
    }
  }

  function start(holiday) {
    const config = configs[holiday];
    if (!config) {
      stop();
      return;
    }

    if (active === holiday && frameId) return;

    stop();
    active = holiday;
    loadAssets(config);
    resize();

    particles = Array.from({ length: config.maxParticles }, () => new Particle(config));
    frameId = window.requestAnimationFrame(animate);

    if (!resizeBound) {
      window.addEventListener("resize", resize);
      resizeBound = true;
    }
  }

  return {
    start,
    stop
  };
})();
