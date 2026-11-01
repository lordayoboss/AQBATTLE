import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

// AQBATTLE - MADE BY BELLO QUADRI AYOMIDE

let scene, camera, renderer;
let player, bots = [];
let started = false;
let health = 100;
let score = 0;
let moveX = 0;
let moveZ = 0;
let keys = {};
let lastTime = 0;

const panel = document.querySelector(".panel");

const game = document.createElement("div");
game.id = "aqbattle-arena";

Object.assign(game.style, {
  position: "fixed",
  inset: "0",
  display: "none",
  background: "#111",
  overflow: "hidden",
  zIndex: "1000"
});

document.body.appendChild(game);

const hud = document.createElement("div");
Object.assign(hud.style, {
  position: "absolute",
  top: "12px",
  left: "12px",
  color: "white",
  fontFamily: "Arial",
  fontWeight: "bold",
  fontSize: "17px",
  zIndex: "5"
});
game.appendChild(hud);

const controls = document.createElement("div");
Object.assign(controls.style, {
  position: "absolute",
  bottom: "25px",
  left: "0",
  right: "0",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  padding: "15px",
  zIndex: "5",
  pointerEvents: "none"
});
game.appendChild(controls);

const joystick = document.createElement("div");
Object.assign(joystick.style, {
  width: "115px",
  height: "115px",
  borderRadius: "50%",
  background: "rgba(255,255,255,0.22)",
  border: "3px solid white",
  position: "relative",
  pointerEvents: "auto",
  touchAction: "none"
});

const stick = document.createElement("div");
Object.assign(stick.style, {
  width: "45px",
  height: "45px",
  borderRadius: "50%",
  background: "#ffb000",
  position: "absolute",
  left: "32px",
  top: "32px"
});
joystick.appendChild(stick);
controls.appendChild(joystick);

const fire = document.createElement("button");
fire.textContent = "FIRE";
Object.assign(fire.style, {
  width: "85px",
  height: "85px",
  borderRadius: "50%",
  background: "#e53935",
  color: "white",
  border: "3px solid white",
  fontWeight: "bold",
  pointerEvents: "auto"
});
controls.appendChild(fire);

function createSoldier(color) {
  const soldier = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.2, 0.5),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 1.1;
  soldier.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xd9a078 })
  );
  head.position.y = 1.95;
  soldier.add(head);

  return soldier;
}

function startGame() {
  if (started) return;
  started = true;

  health = 100;
  score = 0;
  bots = [];

  panel.style.display = "none";
  game.style.display = "block";

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  game.insertBefore(renderer.domElement, hud);

  const sunlight = new THREE.DirectionalLight(0xffffff, 2);
  sunlight.position.set(10, 20, 10);
  scene.add(sunlight);
  scene.add(new THREE.AmbientLight(0xffffff, 1));

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x397b35 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Arena buildings
  for (let i = 0; i < 12; i++) {
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(5, 4, 5),
      new THREE.MeshStandardMaterial({ color: 0x777777 })
    );

    building.position.set(
      Math.sin(i * 2) * 25,
      2,
      Math.cos(i * 2) * 25
    );

    scene.add(building);
  }

  // Trees
  for (let i = 0; i < 35; i++) {
    const tree = new THREE.Group();

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 2),
      new THREE.MeshStandardMaterial({ color: 0x754421 })
    );
    trunk.position.y = 1;
    tree.add(trunk);

    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 3, 8),
      new THREE.MeshStandardMaterial({ color: 0x126b25 })
    );
    leaves.position.y = 3;
    tree.add(leaves);

    tree.position.set(
      Math.sin(i * 4) * 45,
      0,
      Math.cos(i * 4) * 45
    );
    scene.add(tree);
  }

  player = createSoldier(0x2255ff);
  player.position.set(0, 0, 0);
  scene.add(player);

  // Create 8 enemy bots
  for (let i = 0; i < 8; i++) {
    const bot = createSoldier(0xdd2222);

    bot.position.set(
      Math.sin(i * 0.8) * 18,
      0,
      Math.cos(i * 0.8) * 18
    );

    bot.userData.health = 2;
    bots.push(bot);
    scene.add(bot);
  }

  updateHUD();
  animate(0);
}

function updateHUD() {
  hud.textContent =
    "AQBATTLE | HEALTH: " + health +
    " | ELIMINATIONS: " + score +
    " | ENEMIES: " + bots.length;
}

function shoot() {
  if (!started || bots.length === 0) return;

  let closest = null;
  let distance = Infinity;

  for (const bot of bots) {
    const d = player.position.distanceTo(bot.position);

    if (d < distance) {
      distance = d;
      closest = bot;
    }
  }

  if (closest && distance < 30) {
    closest.userData.health--;

    if (closest.userData.health <= 0) {
      scene.remove(closest);
      bots = bots.filter(bot => bot !== closest);
      score++;
      updateHUD();
    }
  }
}

fire.addEventListener("pointerdown", shoot);

let joystickPointer = null;

joystick.addEventListener("pointerdown", event => {
  joystickPointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  moveJoystick(event);
});

joystick.addEventListener("pointermove", event => {
  if (event.pointerId === joystickPointer) {
    moveJoystick(event);
  }
});

function moveJoystick(event) {
  const rect = joystick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  let x = event.clientX - centerX;
  let y = event.clientY - centerY;

  const max = 35;
  const length = Math.hypot(x, y);

  if (length > max) {
    x = x / length * max;
    y = y / length * max;
  }

  stick.style.left = (32 + x) + "px";
  stick.style.top = (32 + y) + "px";

  moveX = x / max;
  moveZ = y / max;
}

function resetJoystick() {
  joystickPointer = null;
  moveX = 0;
  moveZ = 0;
  stick.style.left = "32px";
  stick.style.top = "32px";
}

joystick.addEventListener("pointerup", resetJoystick);
joystick.addEventListener("pointercancel", resetJoystick);

window.addEventListener("keydown", event => {
  keys[event.key.toLowerCase()] = true;
});

window.addEventListener("keyup", event => {
  keys[event.key.toLowerCase()] = false;
});

function animate(time) {
  if (!started) return;

  requestAnimationFrame(animate);

  const delta = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  let x = moveX;
  let z = moveZ;

  if (keys["w"] || keys["arrowup"]) z -= 1;
  if (keys["s"] || keys["arrowdown"]) z += 1;
  if (keys["a"] || keys["arrowleft"]) x -= 1;
  if (keys["d"] || keys["arrowright"]) x += 1;

  const movement = new THREE.Vector3(x, 0, z);

  if (movement.length() > 1) movement.normalize();

  player.position.addScaledVector(movement, 8 * delta);

  player.position.x = THREE.MathUtils.clamp(player.position.x, -90, 90);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -90, 90);

  // Bots chase the player
  for (const bot of bots) {
    const direction = new THREE.Vector3()
      .subVectors(player.position, bot.position);

    const distance = direction.length();

    if (distance > 2) {
      direction.normalize();
      bot.position.addScaledVector(direction, 2.5 * delta);
    }

    if (distance < 2.5) {
      health = Math.max(0, health - 5 * delta);
    }
  }

  camera.position.set(
    player.position.x,
    player.position.y + 6,
    player.position.z + 10
  );

  camera.lookAt(
    player.position.x,
    player.position.y + 1,
    player.position.z
  );

  updateHUD();

  if (health <= 0) {
    hud.textContent = "YOU WERE ELIMINATED! Refresh to play again.";
    started = false;
  }

  if (bots.length === 0) {
    hud.textContent = "VICTORY! YOU ELIMINATED ALL ENEMIES!";
    started = false;
  }

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  if (!renderer || !camera) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// This is the command from the SINGLE PLAYER button
window.addEventListener("aqbattle-single-player", startGame);
