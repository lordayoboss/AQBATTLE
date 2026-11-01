import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 45, 150);

const camera = new THREE.PerspectiveCamera(
  70, innerWidth / innerHeight, 0.1, 300
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const game = document.createElement("div");
game.style.cssText =
  "position:fixed;inset:0;z-index:10;display:none;touch-action:none;";
game.appendChild(renderer.domElement);
document.body.appendChild(game);

scene.add(new THREE.HemisphereLight(0xffffff, 0x526b38, 2));

const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(20, 30, 10);
sun.castShadow = true;
scene.add(sun);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x477a35 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Trees
for (let i = 0; i < 45; i++) {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.25, 2),
    new THREE.MeshStandardMaterial({ color: 0x68452a })
  );
  trunk.position.y = 1;
  tree.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0x174d25 })
  );
  leaves.position.y = 3;
  tree.add(leaves);

  const angle = Math.random() * Math.PI * 2;
  const distance = 12 + Math.random() * 65;
  tree.position.set(
    Math.cos(angle) * distance,
    0,
    Math.sin(angle) * distance
  );
  scene.add(tree);
}

// Buildings
for (let i = 0; i < 8; i++) {
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(5, 4, 5),
    new THREE.MeshStandardMaterial({ color: 0x777777 })
  );
  building.position.set(
    (Math.random() - 0.5) * 65,
    2,
    (Math.random() - 0.5) * 65
  );
  building.castShadow = true;
  scene.add(building);
}

// Create soldier
function createSoldier(color) {
  const soldier = new THREE.Group();

  const uniform = new THREE.MeshStandardMaterial({ color });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb9815b });

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.2, 0.45), uniform
  );
  body.position.y = 1.35;
  soldier.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 16), skin
  );
  head.position.y = 2.15;
  soldier.add(head);

  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.9, 0.4), uniform
  );
  legs.position.y = 0.45;
  soldier.add(legs);

  soldier.traverse(object => {
    if (object.isMesh) object.castShadow = true;
  });

  return soldier;
}

const player = createSoldier(0x263d32);
scene.add(player);

camera.position.set(0, 4, 7);

// Game state
let started = false;
let mode = "";
let health = 100;
let score = 0;
let bots = [];
let bullets = [];
let lastAttack = 0;
let joystickX = 0;
let joystickY = 0;
const keys = {};

window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

// HUD
const hud = document.createElement("div");
hud.style.cssText = `
  position:absolute;top:15px;left:15px;
  color:white;font:bold 18px Arial;
  text-shadow:2px 2px 4px black;
  pointer-events:none;line-height:1.6;
`;
game.appendChild(hud);

function updateHUD() {
  hud.innerHTML =
    AQBATTLE<br>${mode.toUpperCase()}<br> +
    HEALTH: ${health}<br> +
    BOTS LEFT: ${bots.filter(b => b.alive).length}<br> +
    ELIMINATIONS: ${score};
}

// Create enemy bots
function createBots() {
  bots = [];

  for (let i = 0; i < 10; i++) {
    const bot = createSoldier(0x9b2525);

    const angle = Math.random() * Math.PI * 2;
    const distance = 15 + Math.random() * 35;

    bot.position.set(
      Math.cos(angle) * distance,
      0,
      Math.sin(angle) * distance
    );

    scene.add(bot);

    bots.push({
      mesh: bot,
      alive: true,
      attackTime: 0
    });
  }
}

// Joystick
function createControls() {
  const base = document.createElement("div");
  base.style.cssText = `
    position:absolute;left:25px;bottom:35px;
    width:130px;height:130px;border-radius:50%;
    background:rgba(20,30,35,.55);
    border:3px solid white;touch-action:none;
  `;
  game.appendChild(base);

  const knob = document.createElement("div");
  knob.style.cssText = `
    position:absolute;left:35px;top:35px;
    width:55px;height:55px;border-radius:50%;
    background:#ffb000;border:3px solid white;
    pointer-events:none;
  `;
  base.appendChild(knob);

  let pointer = null;

  function moveJoystick(e) {
    const rect = base.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);

    const distance = Math.hypot(dx, dy);
    if (distance > 40) {
      dx *= 40 / distance;
      dy *= 40 / distance;
    }

    joystickX = dx / 40;
    joystickY = dy / 40;

    knob.style.left = 35 + dx + "px";
    knob.style.top = 35 + dy + "px";
  }

  base.addEventListener("pointerdown", e => {
    pointer = e.pointerId;
    base.setPointerCapture(pointer);
    moveJoystick(e);
  });

  base.addEventListener("pointermove", e => {
    if (e.pointerId === pointer) moveJoystick(e);
  });

  function release(e) {
    if (e.pointerId !== pointer) return;
    pointer = null;
    joystickX = 0;
    joystickY = 0;
    knob.style.left = "35px";
    knob.style.top = "35px";
  }

  base.addEventListener("pointerup", release);
  base.addEventListener("pointercancel", release);

  // Fire button
  const fire = document.createElement("button");
  fire.textContent = "FIRE";
  fire.style.cssText = `
    position:absolute;right:30px;bottom:55px;
    width:90px;height:90px;border-radius:50%;
    border:4px solid white;background:#d62828;
    color:white;font:bold 20px Arial;
    touch-action:none;
  `;
  game.appendChild(fire);

  fire.addEventListener("pointerdown", e => {
    e.preventDefault();
    shoot();
  });
}

// Shoot bullets
function shoot() {
  if (!started || health <= 0) return;

  const bullet = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
  );

  const direction = new THREE.Vector3(0, 0, -1);
  direction.applyQuaternion(player.quaternion).normalize();

  bullet.position.set(
    player.position.x,
    1.5,
    player.position.z
  );

  scene.add(bullet);
  bullets.push({ mesh: bullet, direction, life: 0 });
}

window.addEventListener("keydown", e => {
  if (e.code === "Space") shoot();
});

// Start game
function startGame(gameMode) {
  if (started) return;

  started = true;
  mode = gameMode;
  health = 100;
  score = 0;
  player.position.set(0, 0, 0);

  document.querySelector(".panel").style.display = "none";
  game.style.display = "block";

  if (gameMode === "single") {
    createBots();
  }

  createControls();
  updateHUD();
}

// Single-player selection
window.addEventListener("aqbattle-single-player", () => {
  startGame("single player");
});

// Multiplayer selection
const statusElement = document.getElementById("status");

if (statusElement) {
  const observer = new MutationObserver(() => {
    if (statusElement.textContent.includes("Match found!")) {
      startGame("multiplayer");
    }
  });

  observer.observe(statusElement, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

// Game loop
function animate() {
  requestAnimationFrame(animate);

  if (started && health > 0) {
    let mx = joystickX;
    let mz = joystickY;

    if (keys["w"] || keys["arrowup"]) mz -= 1;
    if (keys["s"] || keys["arrowdown"]) mz += 1;
    if (keys["a"] || keys["arrowleft"]) mx -= 1;
    if (keys["d"] || keys["arrowright"]) mx += 1;

    const length = Math.hypot(mx, mz);
    if (length > 1) {
      mx /= length;
      mz /= length;
    }

    const speed = 0.14;
    player.position.x += mx * speed;
    player.position.z += mz * speed;

    if (Math.hypot(mx, mz) > 0.05) {
      player.rotation.y = Math.atan2(-mx, -mz);
    }

    // Camera follows player
    const cameraTarget = new THREE.Vector3(
      player.position.x,
      4,
      player.position.z + 7
    );

    camera.position.lerp(cameraTarget, 0.1);
    camera.lookAt(
      player.position.x,
      1.2,
      player.position.z
    );

    // Bot intelligence
    const now = performance.now();

    for (const bot of bots) {
      if (!bot.alive) continue;

      const dx = player.position.x - bot.mesh.position.x;
      const dz = player.position.z - bot.mesh.position.z;
      const distance = Math.hypot(dx, dz);

      if (distance > 2.5) {
        bot.mesh.position.x += dx / distance * 0.045;
        bot.mesh.position.z += dz / distance * 0.045;
      } else if (now - bot.attackTime > 1000) {
        health = Math.max(0, health - 5);
        bot.attackTime = now;
      }

      bot.mesh.rotation.y = Math.atan2(-dx, -dz);
    }

    // Bullet movement and bot hits
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];

      bullet.mesh.position.addScaledVector(
        bullet.direction, 1.0
      );
      bullet.life++;

      let hit = false;

      if (mode === "single player") {
        for (const bot of bots) {
          if (!bot.alive) continue;

          if (bullet.mesh.position.distanceTo(
            new THREE.Vector3(
              bot.mesh.position.x,
              1.5,
              bot.mesh.position.z
            )
          ) < 1.0) {
            bot.alive = false;
            scene.remove(bot.mesh);
            score++;
            hit = true;
            break;
          }
        }
      }

      if (hit || bullet.life > 70) {
        scene.remove(bullet.mesh);
        bullet.mesh.geometry.dispose();
        bullet.mesh.material.dispose();
        bullets.splice(i, 1);
      }
    }

    updateHUD();

    if (health <= 0) {
      hud.innerHTML += "<br>YOU WERE ELIMINATED!";
      started = false;
    }

    if (mode === "single player" &&
        bots.length > 0 &&
        bots.every(bot => !bot.alive)) {
      hud.innerHTML += "<br>VICTORY! ALL BOTS ELIMINATED!";
      started = false;
    }
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
