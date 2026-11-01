import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

// ========================================
// AQBATTLE
// MADE BY BELLO QUADRI AYOMIDE
// ========================================

let scene, camera, renderer, player;
let bots = [];
let started = false;
let health = 100;
let kills = 0;
let coins = 500;
let selectedGender = "male";
let selectedWeapon = "Pistol";
let selectedOutfit = "Army";
let moveX = 0, moveZ = 0;
let keys = {};
let lastTime = 0;
let playerFacing = 0;

const weapons = {
  Pistol: { price: 0, damage: 1, range: 25 },
  AK47: { price: 500, damage: 3, range: 45 },
  Shotgun: { price: 800, damage: 5, range: 18 },
  Sniper: { price: 1200, damage: 8, range: 80 }
};

const outfits = {
  Army: { price: 0, color: 0x526a43 },
  Shadow: { price: 1000, color: 0x202329 },
  Fire: { price: 2000, color: 0x982e26 },
  Cyber: { price: 3000, color: 0x247ca7 }
};

const ownedWeapons = new Set(["Pistol"]);
const ownedOutfits = new Set(["Army"]);

const panel = document.querySelector(".panel");

const arena = document.createElement("div");
Object.assign(arena.style, {
  position: "fixed",
  inset: "0",
  display: "none",
  overflow: "hidden",
  background: "#111",
  zIndex: "9999"
});
document.body.appendChild(arena);

const hud = document.createElement("div");
Object.assign(hud.style, {
  position: "absolute",
  top: "12px",
  left: "12px",
  color: "white",
  font: "bold 15px Arial",
  textShadow: "2px 2px 4px black",
  zIndex: "5",
  lineHeight: "1.7",
  pointerEvents: "none"
});
arena.appendChild(hud);

const credit = document.createElement("div");
credit.textContent = "MADE BY BELLO QUADRI AYOMIDE";
Object.assign(credit.style, {
  position: "absolute",
  top: "12px",
  left: "50%",
  transform: "translateX(-50%)",
  color: "#ffca48",
  font: "bold 12px Arial",
  textShadow: "2px 2px 4px black",
  zIndex: "5",
  whiteSpace: "nowrap",
  pointerEvents: "none"
});
arena.appendChild(credit);

const shopButton = document.createElement("button");
shopButton.textContent = "SHOP";
Object.assign(shopButton.style, {
  position: "absolute",
  top: "15px",
  right: "15px",
  width: "90px",
  background: "#ffb000",
  color: "#111",
  fontWeight: "bold",
  zIndex: "6"
});
arena.appendChild(shopButton);

const joystick = document.createElement("div");
Object.assign(joystick.style, {
  position: "absolute",
  bottom: "25px",
  left: "25px",
  width: "115px",
  height: "115px",
  borderRadius: "50%",
  background: "#ffffff35",
  border: "3px solid white",
  zIndex: "5",
  touchAction: "none"
});

const stick = document.createElement("div");
Object.assign(stick.style, {
  position: "absolute",
  left: "32px",
  top: "32px",
  width: "45px",
  height: "45px",
  borderRadius: "50%",
  background: "#ffb000"
});
joystick.appendChild(stick);
arena.appendChild(joystick);

const fireButton = document.createElement("button");
fireButton.textContent = "FIRE";
Object.assign(fireButton.style, {
  position: "absolute",
  right: "25px",
  bottom: "35px",
  width: "85px",
  height: "85px",
  borderRadius: "50%",
  background: "#d92727",
  color: "white",
  border: "3px solid white",
  fontWeight: "bold",
  zIndex: "5",
  touchAction: "none"
});
arena.appendChild(fireButton);

// ========================================
// MENUS
// ========================================

function makeOverlay(title) {
  const overlay = document.createElement("div");

  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(8,13,18,0.97)",
    color: "white",
    zIndex: "20000",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    overflowY: "auto",
    fontFamily: "Arial",
    textAlign: "center"
  });

  const heading = document.createElement("h1");
  heading.textContent = title;
  heading.style.color = "#ffb000";
  overlay.appendChild(heading);

  document.body.appendChild(overlay);
  return overlay;
}

function menuButton(parent, label, action) {
  const button = document.createElement("button");
  button.textContent = label;

  Object.assign(button.style, {
    padding: "14px",
    margin: "7px",
    minWidth: "220px",
    background: "#ffb000",
    color: "#101820",
    border: "0",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer"
  });

  button.onclick = action;
  parent.appendChild(button);
  return button;
}

function showCharacterSelection() {
  const menu = makeOverlay("CHOOSE YOUR SOLDIER");

  menuButton(menu, "MALE SOLDIER", () => {
    selectedGender = "male";
    menu.remove();
    startGame();
  });

  menuButton(menu, "FEMALE SOLDIER", () => {
    selectedGender = "female";
    menu.remove();
    startGame();
  });

  const message = document.createElement("p");
  message.textContent = "MADE BY BELLO QUADRI AYOMIDE";
  message.style.color = "#ffca48";
  menu.appendChild(message);
}

// ========================================
// MATERIALS AND 3D OBJECTS
// ========================================

function mat(color, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness
  });
}

function box(parent, size, position, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    mat(color)
  );

  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeSoldier(gender, outfitColor, isEnemy = false) {
  const soldier = new THREE.Group();

  const torsoWidth = gender === "female" ? 0.65 : 0.82;
  const legWidth = gender === "female" ? 0.29 : 0.34;

  // Body
  box(soldier, [torsoWidth, 0.95, 0.43],
    [0, 1.3, 0], outfitColor);

  // Armour vest
  box(soldier, [torsoWidth + 0.08, 0.35, 0.46],
    [0, 1.45, 0.02], 0x343b32);

  // Head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 20, 20),
    mat(0x9a674d)
  );
  head.position.y = 2.05;
  head.castShadow = true;
  soldier.add(head);

  // Helmet
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(
      0.3, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2
    ),
    mat(isEnemy ? 0x762b2b : 0x303b2c)
  );
  helmet.position.y = 2.2;
  helmet.castShadow = true;
  soldier.add(helmet);

  // Female hair
  if (gender === "female") {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.27, 16, 12),
      mat(0x21180f)
    );
    hair.scale.set(1, 1.15, 1);
    hair.position.set(0, 2.02, -0.08);
    soldier.add(hair);
  }

  // Backpack
  box(soldier, [0.55, 0.75, 0.3],
    [0, 1.3, -0.35], 0x333d30);

  // Arms
  for (const side of [-1, 1]) {
    box(soldier, [0.23, 0.75, 0.3],
      [side * 0.53, 1.28, 0], outfitColor);

    box(soldier, [0.25, 0.2, 0.27],
      [side * 0.53, 0.84, 0.08], 0x252525);
  }

  // Legs and boots
  for (const side of [-1, 1]) {
    box(soldier, [legWidth, 0.78, 0.37],
      [side * 0.23, 0.43, 0], 0x303a2c);

    box(soldier, [0.38, 0.2, 0.55],
      [side * 0.23, 0.1, 0.08], 0x181818);
  }

  // Rifle
  const gun = new THREE.Group();

  box(gun, [0.16, 0.17, 0.8], [0, 0, 0], 0x242424);
  box(gun, [0.13, 0.13, 0.8], [0, 0, 0.55], 0x151515);
  box(gun, [0.17, 0.35, 0.22], [0, -0.22, 0.05], 0x292929);
  box(gun, [0.17, 0.18, 0.5], [0, 0, -0.55], 0x343434);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.65, 10),
    mat(0x111111)
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.95;
  gun.add(barrel);

  gun.position.set(0.4, 1.2, 0.55);
  soldier.add(gun);

  soldier.userData.gun = gun;
  return soldier;
}

// ========================================
// HIGH-QUALITY GRAPHICS
// ========================================

function noise(x, z) {
  return (
    Math.sin(x * 0.09) * Math.cos(z * 0.08) * 2.5 +
    Math.sin(x * 0.025 + z * 0.04) * 5
  );
}

function makeTerrain() {
  const geometry = new THREE.PlaneGeometry(
    220, 220, 140, 140
  );

  const positions = geometry.attributes.position;
  const colors = [];

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = -positions.getY(i);

    const height = noise(x, z);
    const distance = Math.hypot(x, z);
    const flatten = THREE.MathUtils.smoothstep(
      distance, 8, 35
    );

    positions.setZ(i, height * flatten);

    const green =
      0.23 + Math.sin(x * 0.2 + z * 0.1) * 0.025;

    colors.push(
      green,
      0.35 + height * 0.006,
      0.15
    );
  }

  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );

  geometry.computeVertexNormals();
  geometry.rotateX(-Math.PI / 2);

  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1
    })
  );

  ground.receiveShadow = true;
  scene.add(ground);
}

function makeSky() {
  const geometry = new THREE.SphereGeometry(400, 48, 32);
  const positions = geometry.attributes.position;
  const colors = [];

  for (let i = 0; i < positions.count; i++) {
    const height = THREE.MathUtils.clamp(
      positions.getY(i) / 400,
      -1,
      1
    );

    const color = new THREE.Color().lerpColors(
      new THREE.Color(0xd4eaff),
      new THREE.Color(0x2878b9),
      THREE.MathUtils.smoothstep(height, -0.1, 0.9)
    );

    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );

  const sky = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide
    })
  );

  scene.add(sky);
}

function makeMountain(x, z, scale, color) {
  const mountain = new THREE.Mesh(
    new THREE.ConeGeometry(1, 1, 12, 5),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 1,
      flatShading: true
    })
  );

  mountain.position.set(x, scale * 0.35, z);
  mountain.scale.set(scale, scale, scale);
  mountain.receiveShadow = true;
  mountain.castShadow = true;
  scene.add(mountain);
}

function makeRock(x, z, scale) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(scale, 1),
    new THREE.MeshStandardMaterial({
      color: 0x77766c,
      roughness: 1,
      flatShading: true
    })
  );

  rock.position.set(x, scale * 0.5, z);
  rock.rotation.set(x * 0.1, z * 0.1, 0);
  rock.castShadow = true;
  scene.add(rock);
}

// ========================================
// TREES AND BUILDINGS
// ========================================

function addTree(x, z, scale = 1) {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, 2.3, 8),
    mat(0x63442c)
  );
  trunk.position.y = 1.15;
  trunk.castShadow = true;
  tree.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 3.5, 9),
    mat(0x28602d)
  );
  leaves.position.y = 3.3;
  leaves.castShadow = true;
  tree.add(leaves);

  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  scene.add(tree);
}

function addBuilding(x, z) {
  const house = new THREE.Group();

  box(house, [8, 4.5, 8], [0, 2.25, 0], 0x9a927f);
  box(house, [9, 0.5, 9], [0, 4.7, 0], 0x45403b);

  box(house, [1.4, 1.5, 0.12],
    [-2, 3, 4.05], 0x263e50);

  box(house, [1.4, 1.5, 0.12],
    [2, 3, 4.05], 0x263e50);

  box(house, [1.5, 2.2, 0.15],
    [0, 1.1, 4.1], 0x493425);

  house.position.set(x, 0, z);
  scene.add(house);
}

// ========================================
// CREATE GAME WORLD
// ========================================

function createWorld() {
  scene = new THREE.Scene();

  scene.background = new THREE.Color(0x91c9ef);
  scene.fog = new THREE.FogExp2(0x91c9ef, 0.003);

  camera = new THREE.PerspectiveCamera(
    65, innerWidth / innerHeight, 0.1, 700
  );

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
  });

  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 1.5)
  );

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  arena.insertBefore(renderer.domElement, hud);

  // Sky
  makeSky();

  // Sunlight and shadows
  const sun = new THREE.DirectionalLight(0xffedcf, 3.5);

  sun.position.set(-50, 90, 45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);

  sun.shadow.camera.left = -100;
  sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100;
  sun.shadow.camera.bottom = -100;
  sun.shadow.bias = -0.0003;

  scene.add(sun);

  // Environmental lighting
  scene.add(
    new THREE.HemisphereLight(
      0xd5eaff, 0x465337, 2.2
    )
  );

  const fillLight = new THREE.DirectionalLight(
    0xffffff, 0.7
  );

  fillLight.position.set(40, 25, -35);
  scene.add(fillLight);

  // Terrain
  makeTerrain();

  // Mountains
  for (let i = 0; i < 22; i++) {
    const angle = i * Math.PI * 2 / 22;
    const distance = 135 + (i % 4) * 12;

    makeMountain(
      Math.sin(angle) * distance,
      Math.cos(angle) * distance,
      25 + (i % 5) * 8,
      i % 2 ? 0x596c5c : 0x697d69
    );
  }

  // Road
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 190),
    mat(0x34383a)
  );

  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.15;
  road.receiveShadow = true;
  scene.add(road);

  // Road markings
  for (let z = -85; z < 90; z += 12) {
    const marking = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 5),
      new THREE.MeshBasicMaterial({
        color: 0xf5e9b4
      })
    );

    marking.rotation.x = -Math.PI / 2;
    marking.position.set(0, 0.2, z);
    scene.add(marking);
  }

  // Buildings
  addBuilding(-25, -20);
  addBuilding(27, -30);
  addBuilding(-28, 30);
  addBuilding(30, 25);
  addBuilding(45, 0);

  // Forest
  for (let i = 0; i < 85; i++) {
    const angle = i * 2.399;
    const distance = 36 + (i % 10) * 5;

    addTree(
      Math.sin(angle) * distance,
      Math.cos(angle) * distance,
      0.8 + (i % 4) * 0.15
    );
  }

  // Rocks
  for (let i = 0; i < 45; i++) {
    const angle = i * 2.4;
    const distance = 55 + (i % 8) * 8;

    makeRock(
      Math.sin(angle) * distance,
      Math.cos(angle) * distance,
      0.7 + (i % 4) * 0.45
    );
  }

  // Player
  player = makeSoldier(
    selectedGender,
    outfits[selectedOutfit].color
  );

  scene.add(player);
}

// ========================================
// ENEMY BOTS
// ========================================

function createBots() {
  bots = [];

  for (let i = 0; i < 8; i++) {
    const bot = makeSoldier("male", 0x923d32, true);

    bot.position.set(
      Math.sin(i * 0.9) * 28,
      0,
      Math.cos(i * 0.9) * 28
    );

    bot.userData.hp = 3;
    scene.add(bot);
    bots.push(bot);
  }
}

// ========================================
// WEAPON AND OUTFIT SHOP
// ========================================

function showShop() {
  const menu = makeOverlay("AQBATTLE SHOP");

  const balance = document.createElement("h3");
  balance.textContent = "YOUR COINS: " + coins;
  balance.style.color = "#ffcf66";
  menu.appendChild(balance);

  const weaponTitle = document.createElement("h2");
  weaponTitle.textContent = "WEAPONS";
  menu.appendChild(weaponTitle);

  for (const [name, item] of Object.entries(weapons)) {
    const owned = ownedWeapons.has(name);
    const label = name + " — " +
      (item.price === 0 ? "FREE" : item.price + " coins");

    menuButton(
      menu,
      owned
        ? (selectedWeapon === name ? "EQUIPPED: " : "EQUIP: ") + label
        : "BUY: " + label,
      () => {
        if (!owned) {
          if (coins < item.price) {
            alert("Not enough coins!");
            return;
          }

          coins -= item.price;
          ownedWeapons.add(name);
        }

        selectedWeapon = name;
        menu.remove();
        showShop();
        updateHUD();
      }
    );
  }

  const outfitTitle = document.createElement("h2");
  outfitTitle.textContent = "CHARACTER OUTFITS";
  menu.appendChild(outfitTitle);

  for (const [name, item] of Object.entries(outfits)) {
    const owned = ownedOutfits.has(name);
    const label = name + " — " +
      (item.price === 0 ? "FREE" : item.price + " coins");

    menuButton(
      menu,
      owned
        ? (selectedOutfit === name ? "EQUIPPED: " : "EQUIP: ") + label
        : "BUY: " + label,
      () => {
        if (!owned) {
          if (coins < item.price) {
            alert("Not enough coins!");
            return;
          }

          coins -= item.price;
          ownedOutfits.add(name);
        }

        selectedOutfit = name;
        menu.remove();
        showShop();
        updateHUD();
      }
    );
  }

  menuButton(menu, "CLOSE SHOP", () => menu.remove());

  const note = document.createElement("p");
  note.textContent =
    "Real-money purchases require secure payment setup.";
  note.style.color = "#ffcf66";
  menu.appendChild(note);
}

shopButton.addEventListener("click", showShop);

// ========================================
// GAME START
// ========================================

function startGame() {
  if (started) return;

  started = true;
  health = 100;
  kills = 0;
  lastTime = 0;
  playerFacing = 0;

  if (panel) panel.style.display = "none";
  arena.style.display = "block";

  try {
    createWorld();
    createBots();
    updateHUD();
    requestAnimationFrame(animate);
  } catch (error) {
    console.error(error);

    started = false;
    arena.style.display = "none";

    if (panel) panel.style.display = "block";

    alert("AQBATTLE could not start. Check the browser console.");
  }
}

function updateHUD() {
  hud.textContent =
    "AQBATTLE | HP: " + Math.ceil(health) +
    " | KILLS: " + kills +
    " | COINS: " + coins +
    " | GUN: " + selectedWeapon;
}

// ========================================
// SHOOTING
// ========================================

function shoot() {
  if (!started || bots.length === 0) return;

  let target = null;
  let nearest = Infinity;

  for (const bot of bots) {
    const distance = player.position.distanceTo(bot.position);

    if (distance < nearest) {
      nearest = distance;
      target = bot;
    }
  }

  const gun = weapons[selectedWeapon];

  if (!target || nearest > gun.range) return;

  target.userData.hp -= gun.damage;

  target.traverse(object => {
    if (object.isMesh && object.material?.color) {
      object.material.emissive = new THREE.Color(0x441111);
    }
  });

  if (target.userData.hp <= 0) {
    scene.remove(target);
    bots = bots.filter(bot => bot !== target);

    kills++;
    coins += 100;
  }

  updateHUD();
}

fireButton.addEventListener("pointerdown", shoot);

// ========================================
// MOBILE JOYSTICK
// ========================================

let joystickPointer = null;

function moveJoystick(event) {
  const rect = joystick.getBoundingClientRect();

  let x = event.clientX - rect.left - rect.width / 2;
  let y = event.clientY - rect.top - rect.height / 2;

  const length = Math.hypot(x, y);

  if (length > 35) {
    x *= 35 / length;
    y *= 35 / length;
  }

  stick.style.left = (32 + x) + "px";
  stick.style.top = (32 + y) + "px";

  moveX = x / 35;
  moveZ = y / 35;
}

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

function resetJoystick() {
  joystickPointer = null;
  moveX = 0;
  moveZ = 0;
  stick.style.left = "32px";
  stick.style.top = "32px";
}

joystick.addEventListener("pointerup", resetJoystick);
joystick.addEventListener("pointercancel", resetJoystick);

// ========================================
// KEYBOARD CONTROLS
// ========================================

window.addEventListener("keydown", event => {
  keys[event.key.toLowerCase()] = true;
});

window.addEventListener("keyup", event => {
  keys[event.key.toLowerCase()] = false;
});

// ========================================
// GAME LOOP
// ========================================

function animate(time) {
  if (!started) return;

  requestAnimationFrame(animate);

  const dt = lastTime
    ? Math.min((time - lastTime) / 1000, 0.05)
    : 0;

  lastTime = time;

  let x = moveX;
  let z = moveZ;

  if (keys.w || keys.arrowup) z--;
  if (keys.s || keys.arrowdown) z++;
  if (keys.a || keys.arrowleft) x--;
  if (keys.d || keys.arrowright) x++;

  const movement = new THREE.Vector3(x, 0, z);

  if (movement.length() > 1) movement.normalize();

  player.position.addScaledVector(movement, 8 * dt);

  if (movement.length() > 0.05) {
    playerFacing = Math.atan2(movement.x, movement.z);
    player.rotation.y = playerFacing;
  }

  player.position.x = THREE.MathUtils.clamp(
    player.position.x, -95, 95
  );

  player.position.z = THREE.MathUtils.clamp(
    player.position.z, -95, 95
  );

  // Bot movement
  for (const bot of bots) {
    const direction = new THREE.Vector3()
      .subVectors(player.position, bot.position);

    const distance = direction.length();

    if (distance > 2.5) {
      direction.normalize();

      bot.position.addScaledVector(
        direction, 2.2 * dt
      );

      bot.rotation.y = Math.atan2(
        direction.x, direction.z
      );
    } else {
      health = Math.max(0, health - 8 * dt);
    }
  }

  // Third-person camera
  const offset = new THREE.Vector3(0, 5, -9);

  offset.applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    playerFacing
  );

  camera.position.lerp(
    player.position.clone().add(offset),
    0.09
  );

  camera.lookAt(
    player.position.x,
    player.position.y + 1.4,
    player.position.z
  );

  updateHUD();

  if (health <= 0) {
    started = false;
    hud.textContent = "ELIMINATED! Refresh to play again.";
  }

  if (bots.length === 0) {
    started = false;
    hud.textContent = "VICTORY! ALL ENEMIES ELIMINATED!";
  }

  renderer.render(scene, camera);
}

// ========================================
// RESIZE
// ========================================

window.addEventListener("resize", () => {
  if (!renderer || !camera) return;

  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ========================================
// SINGLE PLAYER EVENT
// ========================================

window.addEventListener(
  "aqbattle-single-player",
  showCharacterSelection
);
