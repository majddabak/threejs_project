// projectile3d.js
// ES module: export functions simulateNoDrag3D, simulateWithDrag3D
// Units: meters, seconds, kilograms

export const DEFAULTS = {
  g: 9.81,
  rho: 1.225,
  Cd: 0.47,
  A: 0.01
};

/**
 * Compute acceleration given velocity (3D), mass and environment.
 * Uses quadratic drag: a = -k * |v_rel| * v_rel + gravity
 */
function accelerationFromState(vx, vy, vz, params) {
  const { rho, Cd, A, m, wind, g } = params;
  // relative velocity
  const vrx = vx - (wind?.x || 0);
  const vry = vy - (wind?.y || 0);
  const vrz = vz - (wind?.z || 0);
  const speed = Math.hypot(vrx, vry, vrz);
  if (speed === 0) {
    return { ax: 0, ay: -g, az: 0 };
  }
  const k = 0.5 * rho * Cd * A / m;   // k = (1/2) * rho * Cd * A / m
  // drag acceleration components (already negative direction)
  const ax = -k * speed * vrx;
  const ay = -k * speed * vry - g;
  const az = -k * speed * vrz;
  return { ax, ay, az };
}

/**
 * f(t, state) for RK4: state = [x, y, z, vx, vy, vz]
 */
function derivatives(state, params) {
  const [x, y, z, vx, vy, vz] = state;
  const { ax, ay, az } = accelerationFromState(vx, vy, vz, params);
  return [vx, vy, vz, ax, ay, az];
}

/**
 * Single RK4 step for vector state.
 */
function rk4Step(state, params, h) {
  const s = state;
  const k1 = derivatives(s, params);
  const s2 = s.map((val, i) => val + 0.5 * h * k1[i]);
  const k2 = derivatives(s2, params);
  const s3 = s.map((val, i) => val + 0.5 * h * k2[i]);
  const k3 = derivatives(s3, params);
  const s4 = s.map((val, i) => val + h * k3[i]);
  const k4 = derivatives(s4, params);
  const next = s.map((val, i) => val + (h / 6) * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i]));
  return next;
}

/**
 * Linear interpolation between two states for y=0 crossing.
 * stateA = [x0,y0,z0,vx0,vy0,vz0], t0 ; stateB, t1
 * returns interpolated state at t* where y=0
 */
function interpolateImpact(stateA, t0, stateB, t1) {
  const y0 = stateA[1], y1 = stateB[1];
  const alpha = (0 - y0) / (y1 - y0); // fraction from A->B where y crosses zero
  const tStar = t0 + alpha * (t1 - t0);
  const interp = stateA.map((val, i) => val + alpha * (stateB[i] - val));
  return { t: tStar, state: interp };
}

/**
 * Simulate 3D projectile WITH drag (RK4).
 * params: { v0, elevDeg, azimDeg, m, Cd, A, rho, wind:{x,y,z}, dt, tMax }
 * returns: { traj: [ {t,x,y,z,vx,vy,vz}, ... ], y_max, impact: {t,x,y,z} }
 */
export function simulateWithDrag3D(options = {}) {
  const {
    v0 = 50,
    elevDeg = 45,
    azimDeg = 0,
    m = 1.0,
    Cd = DEFAULTS.Cd,
    A = DEFAULTS.A,
    rho = DEFAULTS.rho,
    wind = { x:0, y:0, z:0 },
    dt = 0.01,
    tMax = 120,
    g = DEFAULTS.g
  } = options;

  // convert angles
  const elev = elevDeg * Math.PI / 180;
  const azim = azimDeg * Math.PI / 180;

  // initial velocities
  let vx0 = v0 * Math.cos(elev) * Math.cos(azim);
  let vy0 = v0 * Math.sin(elev);
  let vz0 = v0 * Math.cos(elev) * Math.sin(azim);

  // initial state
  let state = [0, 0, 0, vx0, vy0, vz0];
  const params = { rho, Cd, A, m, wind, g };

  const traj = [];
  let t = 0;
  let y_max = 0;
  let prevState = state.slice();
  let prevT = t;

  // store initial point
  traj.push({ t, x: state[0], y: state[1], z: state[2], vx: state[3], vy: state[4], vz: state[5] });

  while (t < tMax) {
    const next = rk4Step(state, params, dt);
    const tNext = t + dt;

    // update max
    if (next[1] > y_max) y_max = next[1];

    // push next
    traj.push({ t: tNext, x: next[0], y: next[1], z: next[2], vx: next[3], vy: next[4], vz: next[5] });

    // check ground crossing
    if (state[1] >= 0 && next[1] < 0) {
      // refine impact point by interpolation
      const { t: tImpact, state: stImpact } = interpolateImpact(state, t, next, tNext);
      const impact = { t: tImpact, x: stImpact[0], y: 0.0, z: stImpact[2] };
      return { traj, y_max, impact };
    }

    // advance
    prevState = state;
    prevT = t;
    state = next;
    t = tNext;
  }

  // if did not hit ground within tMax
  return { traj, y_max, impact: null };
}

/**
 * Simulate without drag (analytic dynamics integrated numerically with RK4 still works).
 * Useful for consistency & verification. Options similar to above.
 */
export function simulateNoDrag3D(options = {}) {
  const {
    v0 = 50,
    elevDeg = 45,
    azimDeg = 0,
    dt = 0.01,
    tMax = 120,
    g = DEFAULTS.g
  } = options;

  const elev = elevDeg * Math.PI / 180;
  const azim = azimDeg * Math.PI / 180;

  let vx0 = v0 * Math.cos(elev) * Math.cos(azim);
  let vy0 = v0 * Math.sin(elev);
  let vz0 = v0 * Math.cos(elev) * Math.sin(azim);

  // state [x,y,z,vx,vy,vz]
  let state = [0, 0, 0, vx0, vy0, vz0];
  const params = { rho: 0, Cd: 0, A: 0, m: 1, wind: {x:0,y:0,z:0}, g };

  const traj = [];
  let t = 0;
  let y_max = 0;

  traj.push({ t, x: state[0], y: state[1], z: state[2], vx: state[3], vy: state[4], vz: state[5] });

  while (t < tMax) {
    // since drag is zero, RK4 simplifies but we reuse it
    const next = rk4Step(state, params, dt);
    const tNext = t + dt;
    if (next[1] > y_max) y_max = next[1];
    traj.push({ t: tNext, x: next[0], y: next[1], z: next[2], vx: next[3], vy: next[4], vz: next[5] });

    // ground hit?
    if (state[1] >= 0 && next[1] < 0) {
      const { t: tImpact, state: stImpact } = interpolateImpact(state, t, next, tNext);
      const impact = { t: tImpact, x: stImpact[0], y: 0.0, z: stImpact[2] };
      return { traj, y_max, impact };
    }

    state = next;
    t = tNext;
  }

  return { traj, y_max, impact: null };
}
