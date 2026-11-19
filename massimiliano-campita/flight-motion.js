// Exact critically damped integration keeps position AND velocity continuous at pointer exit.
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function advanceAxis(axis, target, frequency, dt) {
  const displacement = axis.value - target;
  const impulse = axis.velocity + frequency * displacement;
  const decay = Math.exp(-frequency * dt);
  axis.value = target + (displacement + impulse * dt) * decay;
  axis.velocity = (axis.velocity - frequency * impulse * dt) * decay;
}

export class FlightMotion {
  constructor(progress = 0) {
    this.axes = {
      x: { value: 0, velocity: 0 },
      y: { value: 0, velocity: 0 },
      progress: { value: clamp(progress, 0, 1), velocity: 0 }
    };
    this.target = { x: 0, y: 0, progress: clamp(progress, 0, 1) };
    this.pointerInside = false;
    this.time = 0;
  }

  setPointer(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.pointerInside = true;
    this.target.x = clamp(x, -1, 1);
    this.target.y = clamp(y, -1, 1);
  }

  releasePointer() {
    this.pointerInside = false;
    this.target.x = this.target.y = 0;
    // Never touch current position or velocity here, including window blur.
  }

  setProgress(progress) {
    if (Number.isFinite(progress)) this.target.progress = clamp(progress, 0, 1);
  }

  step(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return this.state;
    // A suspended tab must not advance by minutes on its first visible frame.
    const dt = Math.min(seconds, .05);
    const steering = this.pointerInside ? 7.5 : 2.6;
    advanceAxis(this.axes.x, this.target.x, steering, dt);
    advanceAxis(this.axes.y, this.target.y, steering, dt);
    advanceAxis(this.axes.progress, this.target.progress, 11, dt);
    this.time += dt;
    return this.state;
  }

  get state() {
    return {
      x: this.axes.x.value,
      y: this.axes.y.value,
      progress: this.axes.progress.value,
      vx: this.axes.x.velocity,
      vy: this.axes.y.velocity,
      time: this.time
    };
  }
}
