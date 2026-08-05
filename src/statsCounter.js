export function createShieldCounter() {
  const container = document.createElement('div');
  container.id = 'shield-counter';

  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 80;
  canvas.id = 'shield-counter-canvas';
  container.appendChild(canvas);

  document.body.appendChild(container);

  const ctx = canvas.getContext('2d');
  let color = '#F0F0F0';
  let number = '01';
  let mouseX = 0, mouseY = 0;
  let time = 0;
  let cpuMs = 0, gpuMs = 0, fps = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    const step = 8;
    const lineW = step / 1.2;
    const offset = (time * 10) % step;

    // slash background
    ctx.save();
    ctx.translate(40, 40);
    ctx.rotate(45 * Math.PI / 180);
    ctx.translate(-40, -40);
    for (let x = -200 + offset; x < 400; x += step) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(x, -200, lineW, 400);
    }
    ctx.restore();

    // number
    // ctx.save();
    // ctx.textAlign = 'center';
    // ctx.textBaseline = 'middle';
    // ctx.font = '700 12px Orbitron, monospace';
    // ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
    // ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.3)`;
    // ctx.shadowBlur = 6;
    // ctx.fillText(`${number}`, 40, 18);
    // ctx.restore();

    // stats
    const smallFont = '700 28px Orbitron, monospace';
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = smallFont;
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
    ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
    ctx.shadowBlur = 6;
    ctx.fillText(`${fps}`, 40, 35);
    ctx.font = '500 9px Orbitron, monospace';
    ctx.fillText(`FPS`, 40, 55);
    ctx.restore();
  }

  function update(c, n) {
    color = c;
    number = n !== undefined ? String(n + 1).padStart(2, '0') : number;
    draw();
  }

  function setStats(cpu, gpu, frameRate) {
    cpuMs = cpu;
    gpuMs = gpu;
    fps = frameRate;
  }

  function tick(dt) {
    time += dt;
    draw();
  }

  function onMouseMove(x, y) {
    mouseX = x;
    mouseY = y;
    const rotY = mouseX * 8;
    const rotX = -mouseY * 8;
    container.style.transform = `perspective(200px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  }

  return { container, canvas, update, tick, onMouseMove, draw, setStats };
}
