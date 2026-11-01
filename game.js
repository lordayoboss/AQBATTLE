import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 45, 150);

const camera = new THREE.PerspectiveCamera(
  70, window.innerWidth / window.innerHeight, 0.1, 300
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const game = document.createElement("div");
game.id = "aqbattle-game";
game.style.cssText = `
  position:fixed;
  inset:0;
  z-index:10;
  display:none;
  touch-action:none;
`;
game.appendChild(renderer.domElement);
document.body.appendChild(game);

scene.add(new THREE.HemisphereLight(0xffffff, 0x526b38, 2));

const sunlight = new THREE.DirectionalLight(0xffffff, 2);
sunlight.position.set(20, 30, 10);
sunlight.castShadow = true;
scene.add(sunlight);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x477a35 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Soldier
const soldier = new THREE.Group();

const uniform = new THREE.MeshStandardMaterial({ color: 0x263d32 });
const skin = new THREE.MeshStandardMaterial({ color: 0xb9815b });

const body = new THREE.Mesh(
  new THREE.BoxGeometry(0.8, 1.2, 0.45), uniform
);
body.position.y = 1.35;
soldier.add(body);

const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 24, 24), skin
);
head.position.y = 2.15;
soldier.add(head);

const legs = new THREE.Mesh(
  new THREE.BoxGeometry(0.65, 0.9, 0.4), uniform
);
legs.position.y = 0.45;
soldier.add(legs);

// Simple weapon
const weapon = new THREE.Mesh(
  new THREE.BoxGeometry(0.18, 0.18, 0.9),
  new THREE.MeshStandardMaterial({ color: 0x222222 })
);
weapon.position.set(0.48, 1.45, -0.35);
soldier.add(weapon);

soldier.traverse(object => {
  if (object.isMesh) object.castShadow = true;
});
scene.add(soldier);

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
    Math.cos(angle) * distance, 0,
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
  building.receiveShadow = true;
  scene.add(building);
}

camera.position.set(0, 4, 7);

// Controls
const keys = {};
let started = false;
let joystickX = 0;
let joystickY = 0;
const bullets = [];

window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

// Arena
function enterArena() {
  if (started) return;
  started = true;

  game.style.display = "block";

  const panel = document.querySelector(".panel");
  if (panel) panel.style.display = "none";

  // Arena label
  const label = document.createElement("div");
  label.textContent = "AQBATTLE | ARENA";
  label.style.cssText = `
    position:absolute;top:15px;left:15px;
    color:white;font:bold 18px Arial;
    text-shadow:2px 2px 4px black;
    pointer-events:none;
  `;
  game.appendChild(label);

  // Joystick base
  const base = document.createElement("div");
  base.style.cssText = `
    position:absolute;
    left:25px;
    bottom:35px;
    width:130px;
    height:130px;
    border-radius:50%;
    background:rgba(20,30,35,.55);
    border:3px solid rgba(255,255,255,.8);
    touch-action:none;
  `;
  game.appendChild(base);

  // Joystick knob
  const knob = document.createElement("div");
  knob.style.cssText = `
    position:absolute;
    width:55px;
    height:55px;
    left:35px;
    top:35px;
    border-radius:50%;
    background:rgba(255,176,0,.9);
    border:3px solid white;
    pointer-events:none;
  `;
  base.appendChild(knob);

  let joystickPointer = null;

  function moveJoystick(event) {
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;

    const maxDistance = 40;
    const distance = Math.hypot(dx, dy);

    if (distance > maxDistance) {
      dx = dx / distance * maxDistance;
      dy = dy / distance * maxDistance;
    }

    joystickX = dx / maxDistance;
    joystickY = dy / maxDistance;

    knob.style.left = (35 + dx) + "px";
    knob.style.top = (35 + dy) + "px";
  }

  base.addEventListener("pointerdown", event => {
    joystickPointer = event.pointerId;
    base.setPointerCapture(event.pointerId);
    moveJoystick(event);
  });

  base.addEventListener("pointermove", event => {
    if (event.pointerId === joystickPointer) {
      moveJoystick(event);
    }
  });

  function releaseJoystick(event) {
    if (event.pointerId !== joystickPointer) return;
    joystickPointer = null;
    joystickX = 0;
    joystickY = 0;
    knob.style.left = "35px";
    knob.style.top = "35px";
  }

  base.addEventListener("pointerup", releaseJoystick);
  base.addEventListener("pointercancel", releaseJoystick);

  // Fire button
  const fire = document.createElement("button");
  fire.textContent = "FIRE";
  fire.style.cssText = `
    position:absolute;
    right:30px;
    bottom:55px;
    width:90px;
    height:90px;
    border-radius:50%;
    border:4px solid white;
    background:#d62828;
    color:white;
    font:bold 20px Arial;
    touch-action:none;
    box-shadow:0 3px 12px #222;
  `;
  game.appendChild(fire);

  fire.addEventListener("pointerdown", event => {
    event.preventDefault();
    shoot();
  });

  // Desktop shooting
  window.addEventListener("keydown", event => {
    if (event.code === "Space" && started) shoot();
  });
}

// Shooting
function shoot() {
  if (!started) return;

  const bullet = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffdd00 })
  );

  const direction = new THREE.Vector3(0, 0, -1);
  direction.applyQuaternion(soldier.quaternion).normalize();

  bullet.position.set(
    soldier.position.x,
    soldier.position.y + 1.5,
    soldier.position.z
  );

  scene.add(bullet);
  bullets.push({
    mesh: bullet,
    direction,
    life: 0
  });
}

// Detect matchmaking success
const statusElement = document.getElementById("status");

if (statusElement) {
  const observer = new MutationObserver(() => {
    if (statusElement.textContent.includes("Match found!")) {
      enterArena();
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

  if (started) {
    const speed = 0.14;

    let moveX = joystickX;
    let moveZ = joystickY;

    if (keys["w"] || keys["arrowup"]) moveZ -= 1;
    if (keys["s"] || keys["arrowdown"]) moveZ += 1;
    if (keys["a"] || keys["arrowleft"]) moveX -= 1;
    if (keys["d"] || keys["arrowright"]) moveX += 1;

    const movement = Math.hypot(moveX, moveZ);
    if (movement > 1) {
      moveX /= movement;
      moveZ /= movement;
    }

    soldier.position.x += moveX * speed;
    soldier.position.z += moveZ * speed;

    if (movement > 0.05) {
      soldier.rotation.y = Math.atan2(-moveX, moveZ) + Math.PI;
    }

    camera.position.x +=
      (soldier.position.x - camera.position.x) * 0.08;
    camera.position.z +=
      (soldier.position.z + 7 - camera.position.z) * 0.08;
    camera.position.y = 4;

    camera.lookAt(
      soldier.position.x,
      1.2,
      soldier.position.z
    );

    // Move bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      bullet.mesh.position.addScaledVector(
        bullet.direction, 1.2
      );
      bullet.life++;

      if (bullet.life > 70) {
        scene.remove(bullet.mesh);
        bullet.mesh.geometry.dispose();
        bullet.mesh.material.dispose();
        bullets.splice(i, 1);
      }
    }
  }

  renderer.render(scene, camera);
}

animate();

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
