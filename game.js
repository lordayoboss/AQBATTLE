
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

/* =================================
   AQBATTLE - 3D BATTLE ROYALE
================================= */

const CONFIG = {
  bots: 8,
  playerHealth: 100,
  botHealth: 100,
  playerSpeed: 12,
  botSpeed: 3.2,
  bulletDamage: 35,
  fireRate: 220,
  arenaSize: 180,
  safeZoneStart: 85,
  safeZoneMinimum: 12,
  zoneShrinkSpeed: 0.12
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 70, 190);

const camera = new THREE.PerspectiveCamera(
  70, window.innerWidth / window.innerHeight, 0.1, 500
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.style.margin = "0";
document.body.style.overflow = "hidden";
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();

scene.add(new THREE.HemisphereLight(0xffffff, 0x506040, 2));

const sunlight = new THREE.DirectionalLight(0xffffff, 2.5);
sunlight.position.set(40, 70, 30);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
scene.add(sunlight);

/* =================================
   GAME STATE
================================= */

const state = {
  health: CONFIG.playerHealth,
  ammo: 30,
  reserveAmmo: 120,
  kills: 0,
  alive: true,
  reloading: false,
  lastShot: 0,
  zoneRadius: CONFIG.safeZoneStart,
  gameOver: false
};

const keys = {};
const bots = [];
const bullets = [];
const obstacles = [];

let yaw = 0;
let pitch = -0.15;
let joystickX = 0;
let joystickY = 0;
let aiming = false;
let fireHeld = false;

/* =================================
   GROUND
================================= */

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(CONFIG.arenaSize, CONFIG.arenaSize),
  new THREE.MeshStandardMaterial({
    color: 0x477b38,
    roughness: 1
  })
);

ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(180, 36, 0x527d43, 0x527d43);
grid.position.y = 0.03;
grid.material.transparent = true;
grid.material.opacity = 0.15;
scene.add(grid);

/* =================================
   PLAYER CHARACTER
================================= */

function createCharacter(color, isPlayer = false) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.1, 4, 8),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 1.35;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xc99570 })
  );
  head.position.y = 2.35;
  head.castShadow = true;
  group.add(head);

  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  gun.position.set(0.55, 1.65, -0.65);
  group.add(gun);

  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.8, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x252b32 })
  );
  leftLeg.position.set(-0.25, 0.45, 0);
  group.add(leftLeg);

  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.25;
  group.add(rightLeg);

  group.userData = {
    body,
    head,
    gun,
    leftLeg,
    rightLeg,
    isPlayer
  };

  scene.add(group);
  return group;
}

const player = createCharacter(0x1769aa, true);
player.position.set(0, 0, 0);

/* =================================
   BUILDINGS AND TREES
================================= */

function createBuilding(x, z, width, height, depth) {
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color: 0x888b91 })
  );

  building.position.set(x, height / 2, z);
  building.castShadow = true;
  building.receiveShadow = true;
  scene.add(building);

  obstacles.push({
    x, z,
    width,
    depth
  });

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.4, 0.3, depth + 0.4),
    new THREE.MeshStandardMaterial({ color: 0x454545 })
  );
  roof.position.set(x, height + 0.15, z);
  scene.add(roof);
}

function createTree(x, z) {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0x70452a })
  );
  trunk.position.y = 1.5;
  tree.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x176b32 })
  );
  leaves.position.y = 4;
  tree.add(leaves);

  tree.position.set(x, 0, z);
  scene.add(tree);

  obstacles.push({ x, z, width: 1.5, depth: 1.5 });
}

for (let i = 0; i < 22; i++) {
  const x = (Math.random() - 0.5) * 150;
  const z = (Math.random() - 0.5) * 150;

  if (Math.hypot(x, z) > 17) {
    createTree(x, z);
  }
}

createBuilding(-22, -22, 12, 8, 12);
createBuilding(24, -28, 15, 10, 12);
createBuilding(-30, 28, 13, 7, 14);
createBuilding(30, 30, 14, 9, 12);
createBuilding(0, -48, 18, 8, 12);

/* =================================
   ENEMY BOTS
================================= */

function spawnBot(index) {
  const angle = Math.random() * Math.PI * 2;
  const distance = 35 + Math.random() * 35;

  const bot = createCharacter(0xb52b2b);

  bot.position.set(
    Math.cos(angle) * distance,
    0,
    Math.sin(angle) * distance
  );

  bots.push({
    mesh: bot,
    health: CONFIG.botHealth,
    alive: true,
    speed: CONFIG.botSpeed + Math.random(),
    shootTimer: Math.random() * 2,
    wanderAngle: Math.random() * Math.PI * 2
  });
}

for (let i = 0; i < CONFIG.bots; i++) {
  spawnBot(i);
}

/* =================================
   BULLET SYSTEM
================================= */

function createBullet(start, end, color = 0xffdd55) {
  const direction = end.clone().sub(start);
  const distance = direction.length();

  const bullet = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 8),
    new THREE.MeshBasicMaterial({ color })
  );

  bullet.position.copy(start);
  scene.add(bullet);

  bullets.push({
    mesh: bullet,
    direction: direction.normalize(),
    distance,
    travelled: 0,
    speed: 100
  });
}

function shoot() {
  if (!state.alive || state.reloading || state.gameOver) return;

  const now = performance.now();
  if (now - state.lastShot < CONFIG.fireRate) return;

  if (state.ammo <= 0) {
    reload();
    return;
  }

  state.lastShot = now;
  state.ammo--;

  camera.updateMatrixWorld();

  const origin = camera.position.clone();
  const direction = new THREE.Vector3(0, 0, -1);
  direction.applyQuaternion(camera.quaternion);

  raycaster.set(origin, direction);
  raycaster.far = 120;

  const targets = bots
    .filter(bot => bot.alive)
    .map(bot => bot.mesh.userData.body);

  const hits = raycaster.intersectObjects(targets, false);

  let end = origin.clone().addScaledVector(direction, 120);

  if (hits.length > 0) {
    const hit = hits[0];
    end.copy(hit.point);

    const bot = bots.find(
      b => b.alive && b.mesh.userData.body === hit.object
    );

    if (bot) damageBot(bot, CONFIG.bulletDamage);
  }

  createBullet(origin, end);
  updateHUD();
}

function damageBot(bot, damage) {
  bot.health -= damage;

  if (bot.health <= 0) {
    bot.alive = false;
    scene.remove(bot.mesh);
    state.kills++;
    updateHUD();

    if (bots.every(b => !b.alive)) {
      showMessage("VICTORY! AQBATTLE CHAMPION!");
    }
  }
}

/* =================================
   RELOAD
================================= */

function reload() {
  if (state.reloading || state.ammo === 30 ||
      state.reserveAmmo <= 0 || state.gameOver) return;

  state.reloading = true;
  showMessage("RELOADING...");

  setTimeout(() => {
    const needed = 30 - state.ammo;
    const amount = Math.min(needed, state.reserveAmmo);

    state.ammo += amount;
    state.reserveAmmo -= amount;
    state.reloading = false;

    updateHUD();
  }, 1600);
}

/* =================================
   BOT AI
================================= */

function updateBots(delta) {
  for (const bot of bots) {
    if (!bot.alive || !state.alive) continue;

    const botPosition = bot.mesh.position;
    const playerPosition = player.position;

    const direction = new THREE.Vector3()
      .subVectors(playerPosition, botPosition);

    const distance = direction.length();
    direction.normalize();

    bot.mesh.rotation.y = Math.atan2(direction.x, direction.z);

    if (distance > 10) {
      botPosition.addScaledVector(
        direction,
        bot.speed * delta
      );
    }

    if (distance < 38) {
      bot.shootTimer -= delta;

      if (bot.shootTimer <= 0) {
        bot.shootTimer = 1.7 + Math.random() * 1.2;

        const accuracy = Math.random();

        if (accuracy > 0.35 && distance < 35) {
          state.health -= 5;

          if (state.health <= 0) {
            state.health = 0;
            state.alive = false;
            endGame();
          }

          updateHUD();
        }
      }
    }
  }
}

/* =================================
   BULLET ANIMATION
================================= */

function updateBullets(delta) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    const step = bullet.speed * delta;

    bullet.mesh.position.addScaledVector(
      bullet.direction, step
    );

    bullet.travelled += step;

    if (bullet.travelled >= bullet.distance) {
      scene.remove(bullet.mesh);
      bullets.splice(i, 1);
    }
  }
}

/* =================================
   PLAYER MOVEMENT
================================= */

function updatePlayer(delta) {
  if (!state.alive || state.gameOver) return;

  let forward = 0;
  let sideways = 0;

  if (keys["KeyW"] || keys["ArrowUp"]) forward++;
  if (keys["KeyS"] || keys["ArrowDown"]) forward--;
  if (keys["KeyA"] || keys["ArrowLeft"]) sideways--;
  if (keys["KeyD"] || keys["ArrowRight"]) sideways++;

  forward += -joystickY;
  sideways += joystickX;

  const movement = new THREE.Vector3(
    sideways, 0, -forward
  );

  if (movement.length() > 1) movement.normalize();

  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);

  const dx = movement.x * cos + movement.z * sin;
  const dz = -movement.x * sin + movement.z * cos;

  player.position.x += dx * CONFIG.playerSpeed * delta;
  player.position.z += dz * CONFIG.playerSpeed * delta;

  player.position.x = THREE.MathUtils.clamp(
    player.position.x, -88, 88
  );

  player.position.z = THREE.MathUtils.clamp(
    player.position.z, -88, 88
  );

  if (movement.length() > 0) {
    player.rotation.y = yaw;
  }
}

/* =================================
   CAMERA FOLLOW
================================= */

function updateCamera() {
  const distance = 7;
  const height = 4;

  const target = new THREE.Vector3(
    player.position.x - Math.sin(yaw) * distance,
    player.position.y + height,
    player.position.z + Math.cos(yaw) * distance
  );

  camera.position.lerp(target, 0.15);

  const lookTarget = new THREE.Vector3(
    player.position.x + Math.sin(yaw) * 8,
    player.position.y + 2 + pitch * 4,
    player.position.z - Math.cos(yaw) * 8
  );

  camera.lookAt(lookTarget);
}

/* =================================
   SAFE ZONE
================================= */

const zoneGeometry = new THREE.RingGeometry(1, 1.15, 96);
const zoneMaterial = new THREE.MeshBasicMaterial({
  color: 0x31aaff,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.5
});

const zone = new THREE.Mesh(zoneGeometry, zoneMaterial);
zone.rotation.x = -Math.PI / 2;
zone.position.y = 0.15;
scene.add(zone);

function updateZone(delta) {
  state.zoneRadius = Math.max(
    CONFIG.safeZoneMinimum,
    state.zoneRadius - CONFIG.zoneShrinkSpeed * delta
  );

  zone.scale.set(
    state.zoneRadius,
    state.zoneRadius,
    1
  );

  const distance = Math.hypot(
    player.position.x,
    player.position.z
  );

  if (distance > state.zoneRadius && state.alive) {
    state.health = Math.max(0, state.health - 5 * delta);

    if (state.health <= 0) {
      state.alive = false;
      endGame();
    }
    updateHUD();
  }
}

/* =================================
   USER INTERFACE
================================= */

const ui = document.createElement("div");

ui.innerHTML = `
<style>
#aq-hud {
  position:fixed;top:15px;left:15px;
  color:white;font-family:Arial,sans-serif;
  font-weight:bold;text-shadow:1px 2px 4px black;
  z-index:10;font-size:16px;line-height:1.8;
  pointer-events:none;
}
#aq-message {
  position:fixed;top:42%;left:50%;
  transform:translate(-50%,-50%);
  color:#fff;font-size:27px;font-weight:bold;
  text-align:center;text-shadow:2px 3px 5px #000;
  z-index:20;pointer-events:none;
}
.aq-control {
  position:fixed;z-index:15;border-radius:50%;
  background:#ffffff33;border:2px solid white;
  color:white;font-weight:bold;touch-action:none;
  user-select:none;
}
#aq-fire {
  width:85px;height:85px;right:30px;bottom:45px;
  background:#bd2424bb;
}
#aq-reload {
  right:45px;bottom:145px;width:55px;height:55px;
}
#aq-stick {
  width:115px;height:115px;left:35px;bottom:35px;
  background:#ffffff22;
}
#aq-knob {
  width:45px;height:45px;left:35px;bottom:35px;
  background:#ffffff77;pointer-events:none;
}
#aq-crosshair {
  position:fixed;top:50%;left:50%;
  transform:translate(-50%,-50%);
  color:white;font-size:27px;
  z-index:10;pointer-events:none;
}
@media (orientation:portrait) {
  #aq-landscape {
    display:flex !important;
  }
}
</style>

<div id="aq-hud">
  <div>⚔ AQBATTLE</div>
  <div id="aq-health">❤️ HEALTH: 100</div>
  <div id="aq-ammo">🔫 AMMO: 30 / 120</div>
  <div id="aq-kills">☠ KILLS: 0</div>
  <div id="aq-enemies">👥 ENEMIES: 8</div>
  <div id="aq-zone">⭕ SAFE ZONE: 85m</div>
</div>

<div id="aq-message">AQBATTLE</div>
<div id="aq-crosshair">+</div>

<div id="aq-landscape" style="
display:none;position:fixed;inset:0;background:#101820;
color:white;z-index:100;align-items:center;
justify-content:center;text-align:center;font: bold 22px Arial;">
Rotate your phone to landscape mode to play AQBATTLE
</div>

<div id="aq-stick" class="aq-control"></div>
<div id="aq-knob" class="aq-control"></div>
<button id="aq-fire" class="aq-control">FIRE</button>
<button id="aq-reload" class="aq-control">RELOAD</button>
`;

document.body.appendChild(ui);

function updateHUD() {
  document.getElementById("aq-health").textContent =
    `❤️ HEALTH: ${Math.ceil(state.health)}`;

  document.getElementById("aq-ammo").textContent =
    `🔫 AMMO: ${state.ammo} / ${state.reserveAmmo}`;

  document.getElementById("aq-kills").textContent =
    `☠ KILLS: ${state.kills}`;

  document.getElementById("aq-enemies").textContent =
    `👥 ENEMIES: ${bots.filter(b => b.alive).length}`;

  document.getElementById("aq-zone").textContent =
    `⭕ SAFE ZONE: ${Math.ceil(state.zoneRadius)}m`;
}

function showMessage(message) {
  const element = document.getElementById("aq-message");
  element.textContent = message;

  setTimeout(() => {
    if (element.textContent === message) {
      element.textContent = "";
    }
  }, 2500);
}

function endGame() {
  state.gameOver = true;
  showMessage("GAME OVER! KILLS: " + state.kills);
}

/* =================================
   DESKTOP CONTROLS
================================= */

window.addEventListener("keydown", e => {
  keys[e.code] = true;

  if (e.code === "KeyR") reload();
  if (e.code === "Space") shoot();
});

window.addEventListener("keyup", e => {
  keys[e.code] = false;
});

renderer.domElement.addEventListener("click", () => {
  if (!state.gameOver) shoot();
});

window.addEventListener("mousemove", e => {
  if (document.pointerLockElement === renderer.domElement) {
    yaw -= e.movementX * 0.003;
    pitch -= e.movementY * 0.002;
    pitch = THREE.MathUtils.clamp(pitch, -0.7, 0.5);
  }
});

renderer.domElement.addEventListener("dblclick", () => {
  renderer.domElement.requestPointerLock?.();
});

/* =================================
   MOBILE JOYSTICK
================================= */

const stick = document.getElementById("aq-stick");
const knob = document.getElementById("aq-knob");

let stickPointer = null;

stick.addEventListener("pointerdown", e => {
  stickPointer = e.pointerId;
  stick.setPointerCapture(e.pointerId);
  moveStick(e);
});

stick.addEventListener("pointermove", e => {
  if (e.pointerId === stickPointer) moveStick(e);
});

function moveStick(e) {
  const rect = stick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  let x = e.clientX - centerX;
  let y = e.clientY - centerY;

  const max = 43;
  const length = Math.hypot(x, y);

  if (length > max) {
    x = x / length * max;
    y = y / length * max;
  }

  joystickX = x / max;
  joystickY = y / max;

  knob.style.transform = `translate(${x}px, ${y}px)`;
}

function stopStick(e) {
  if (e.pointerId !== stickPointer) return;
  stickPointer = null;
  joystickX = 0;
  joystickY = 0;
  knob.style.transform = "translate(0,0)";
}

stick.addEventListener("pointerup", stopStick);
stick.addEventListener("pointercancel", stopStick);

/* =================================
   MOBILE AIMING
================================= */

let aimPointer = null;
let lastAimX = 0;
let lastAimY = 0;

renderer.domElement.addEventListener("pointerdown", e => {
  if (e.pointerType !== "touch" || e.clientX < innerWidth * 0.4) return;
  aimPointer = e.pointerId;
  lastAimX = e.clientX;
  lastAimY = e.clientY;
});

renderer.domElement.addEventListener("pointermove", e => {
  if (e.pointerId !== aimPointer) return;

  yaw -= (e.clientX - lastAimX) * 0.006;
  pitch -= (e.clientY - lastAimY) * 0.004;

  pitch = THREE.MathUtils.clamp(pitch, -0.7, 0.5);

  lastAimX = e.clientX;
  lastAimY = e.clientY;
});

function stopAim(e) {
  if (e.pointerId === aimPointer) aimPointer = null;
}

renderer.domElement.addEventListener("pointerup", stopAim);
renderer.domElement.addEventListener("pointercancel", stopAim);

/* =================================
   FIRE AND RELOAD BUTTONS
================================= */

const fireButton = document.getElementById("aq-fire");

fireButton.addEventListener("pointerdown", e => {
  e.preventDefault();
  fireHeld = true;
  shoot();
});

fireButton.addEventListener("pointerup", () => {
  fireHeld = false;
});

fireButton.addEventListener("pointercancel", () => {
  fireHeld = false;
});

fireButton.addEventListener("pointerleave", () => {
  fireHeld = false;
});

document.getElementById("aq-reload").addEventListener(
  "click", reload
);

/* =================================
   GAME LOOP
================================= */

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  if (!state.gameOver) {
    updatePlayer(delta);
    updateBots(delta);
    updateBullets(delta);
    updateZone(delta);
    updateCamera();

    if (fireHeld) shoot();
  }

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

updateHUD();
showMessage("WELCOME TO AQBATTLE");
animate();
