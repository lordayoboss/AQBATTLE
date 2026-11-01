import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

// AQBATTLE — MADE BY BELLO QUADRI AYOMIDE

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove("hidden");
const hide = id => $(id).classList.add("hidden");

let token = localStorage.getItem("aq_token");
let player = null;
let mode = "solo";
let character = "male";
let socket = null;
let scene, camera, renderer, clock;
let soldier, bots = [];
let keys = {};
let health = 100;
let ammo = 30;
let score = 0;
let gameStarted = false;
let lastShot = 0;

const skins = [
  { name: "Army Soldier", price: 0, icon: "🪖" },
  { name: "Shadow Warrior", price: 250, icon: "🥷" },
  { name: "Fire Warrior", price: 400, icon: "🔥" },
  { name: "Cyber Soldier", price: 600, icon: "🤖" },
  { name: "Golden Warrior", price: 900, icon: "👑" }
];

let equippedSkin = 0;

// ---------------- ACCOUNT ----------------

let authMode = "login";

$("loginTab").onclick = () => setAuthMode("login");
$("registerTab").onclick = () => setAuthMode("register");

function setAuthMode(value) {
  authMode = value;
  $("loginTab").classList.toggle("active", value === "login");
  $("registerTab").classList.toggle("active", value === "register");
  $("usernameGroup").classList.toggle("hidden", value === "login");
  $("authSubmit").textContent =
    value === "login" ? "LOGIN" : "CREATE ACCOUNT";
  $("authMessage").textContent = "";
  $("username").required = value === "register";
}

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const body = {
    email: $("email").value,
    password: $("password").value
  };

  if (authMode === "register") {
    body.username = $("username").value;
  }

  $("authSubmit").disabled = true;
  $("authMessage").textContent = "PLEASE WAIT...";

  try {
    const response = await fetch(/api/${authMode}, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Something went wrong.");

    token = result.token;
    player = result.player;

    localStorage.setItem("aq_token", token);
    enterLobby();
  } catch (error) {
    $("authMessage").textContent = error.message;
  } finally {
    $("authSubmit").disabled = false;
  }
});

async function loadProfile() {
  if (!token) return false;

  try {
    const response = await fetch("/api/profile", {
      headers: { Authorization: Bearer ${token} }
    });

    if (!response.ok) throw new Error("Login expired");

    const result = await response.json();
    player = result.player;
    return true;
  } catch {
    localStorage.removeItem("aq_token");
    token = null;
    return false;
  }
}

function enterLobby() {
  hide("authScreen");
  hide("arenaScreen");
  show("lobbyScreen");
  show("accountBar");

  $("playerName").textContent = player.username;
  $("coinBalance").textContent = player.coins.toLocaleString();
  $("diamondBalance").textContent = player.diamonds.toLocaleString();

  character = player.character || "male";
  updateCharacter();
}

$("logoutBtn").onclick = () => {
  localStorage.removeItem("aq_token");
  token = null;
  player = null;
  location.reload();
};

// ---------------- CHARACTER ----------------

function updateCharacter() {
  $("characterName").textContent =
    character === "male" ? "MALE SOLDIER" : "FEMALE SOLDIER";

  document.querySelectorAll(".choice-button").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.character === character
    );
  });

  $("characterPreview").querySelector(".character-icon").textContent =
    character === "male" ? "🪖" : "👩‍🚀";

  if (player) player.character = character;
}

document.querySelectorAll(".choice-button").forEach(button => {
  button.onclick = async () => {
    character = button.dataset.character;
    updateCharacter();

    try {
      await fetch("/api/character", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: Bearer ${token}
        },
        body: JSON.stringify({ character })
      });
    } catch {}
  };
});

// ---------------- GAME MODE ----------------

document.querySelectorAll(".mode-button").forEach(button => {
  button.onclick = () => {
    mode = button.dataset.mode;

    document.querySelectorAll(".mode-button").forEach(b => {
      b.classList.toggle("active", b === button);
    });
  };
});

// ---------------- SHOP ----------------

$("shopBtn").onclick = () => {
  show("shopPanel");
  renderShop();
};

$("closeShopBtn").onclick = () => hide("shopPanel");

function renderShop() {
  $("shopItems").innerHTML = "";

  skins.forEach((skin, index) => {
    const owned = index === 0 ||
      (player.purchases || []).includes(skin.name);

    const item = document.createElement("div");
    item.className = "shop-item";

    const picture = document.createElement("div");
    picture.className = "skin-picture";
    picture.textContent = skin.icon;

    const title = document.createElement("h3");
    title.textContent = skin.name;

    const price = document.createElement("p");
    price.textContent = owned ? "OWNED" : ${skin.price} COINS;

    const button = document.createElement("button");
    button.textContent = index === equippedSkin ? "EQUIPPED" :
      owned ? "EQUIP" : "BUY";

    button.onclick = async () => {
      if (!owned) {
        if (player.coins < skin.price) {
          alert("Not enough coins!");
          return;
        }

        const response = await fetch("/api/shop/buy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: Bearer ${token}
          },
          body: JSON.stringify({ item: skin.name })
        });

        const result = await response.json();

        if (!response.ok) {
          alert(result.error || "Purchase failed.");
          return;
        }

        player = result.player;
      }

      equippedSkin = index;
      $("coinBalance").textContent = player.coins.toLocaleString();
      renderShop();
    };

    item.append(picture, title, price, button);
    $("shopItems").appendChild(item);
  });
}

// ---------------- SOCKET CONNECTION ----------------

function connectSocket() {
  if (socket?.connected) return;

  socket = io();

  socket.on("connect", () => {
    console.log("Connected to AQBATTLE server");
  });

  socket.on("waiting-for-players", () => {
    $("matchMessage").textContent = "SEARCHING FOR PLAYERS...";
  });

  socket.on("match-found", data => {
    $("matchMessage").textContent =
      MATCH FOUND! ${data.players} PLAYERS;
    startArena();
  });
}

$("battleBtn").onclick = () => {
  $("matchMessage").textContent = "CONNECTING...";
  connectSocket();

  const begin = () => {
    if (socket.connected) {
      socket.emit("find-match");
    } else {
      $("matchMessage").textContent = "CONNECTING TO SERVER...";
    }
  };

  if (socket.connected) begin();
  else socket.once("connect", begin);

  if (mode === "solo") {
    setTimeout(() => {
      if (!gameStarted && $("matchMessage").textContent.includes("SEARCHING")) {
        startArena();
        $("matchMessage").textContent = "SOLO TRAINING";
      }
    }, 2500);
  }
};

// ---------------- 3D ARENA ----------------

function createSoldier(color = 0x2455aa) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.1, 0.5),
    new THREE.MeshStandardMaterial({ color })
  );
  body.position.y = 1.1;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xc99772 })
  );
  head.position.y = 1.9;
  group.add(head);

  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.15, 1),
    new THREE.MeshStandardMaterial({ color: 0x222222 })
  );
  gun.position.set(0.45, 1.25, -0.5);
  group.add(gun);

  return group;
}

function createArena() {
  const container = $("gameContainer");

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cc4d2);
  scene.fog = new THREE.Fog(0x9cc4d2, 30, 100);

  camera = new THREE.PerspectiveCamera(
    70,
    container.clientWidth / container.clientHeight,
    0.1,
    200
  );

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.querySelector("canvas")?.remove();
  container.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x46563b, 2));

  const sunlight = new THREE.DirectionalLight(0xffffff, 2);
  sunlight.position.set(20, 30, 10);
  scene.add(sunlight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: 0x527c47 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  scene.add(ground);

  const grid = new THREE.GridHelper(120, 60, 0x566b47, 0x667e56);
  grid.position.y = 0.01;
  scene.add(grid);

  for (let i = 0; i < 25; i++) {
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(
        3 + Math.random() * 5,
        2 + Math.random() * 5,
        3 + Math.random() * 5
      ),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(
          0.08 + Math.random() * 0.08,
          0.3,
          0.3
        )
      })
    );

    building.position.set(
      (Math.random() - 0.5) * 90,
      building.geometry.parameters.height / 2,
      (Math.random() - 0.5) * 90
    );

    scene.add(building);
  }

  soldier = createSoldier();
  soldier.position.set(0, 0, 0);
  scene.add(soldier);

  bots = [];

  for (let i = 0; i < 8; i++) {
    const bot = createSoldier(0xa52b25);

    bot.position.set(
      (Math.random() - 0.5) * 35,
      0,
      (Math.random() - 0.5) * 35
    );

    bot.userData.health = 100;
    bot.userData.alive = true;

    bots.push(bot);
    scene.add(bot);
  }

  clock = new THREE.Clock();
  gameStarted = true;
  animate();
}

function startArena() {
  if (gameStarted) return;

  hide("lobbyScreen");
  show("arenaScreen");
  $("gameLoading").textContent = "LOADING BATTLEFIELD...";

  health = 100;
  ammo = 30;
  score = 0;

  $("healthValue").textContent = health;
  $("botCount").textContent = 8;
  $("weaponValue").textContent = "PISTOL";

  setTimeout(() => {
    try {
      createArena();
      hide("gameLoading");
    } catch (error) {
      console.error(error);
      $("gameLoading").textContent = "3D GAME ERROR. PLEASE REFRESH.";
    }
  }, 100);
}

// ---------------- MOVEMENT ----------------

function movePlayer(forward, sideways) {
  if (!gameStarted || !soldier) return;

  const speed = 0.18;
  soldier.position.x += sideways * speed;
  soldier.position.z += forward * speed;

  soldier.position.x = THREE.MathUtils.clamp(
    soldier.position.x, -55, 55
  );
  soldier.position.z = THREE.MathUtils.clamp(
    soldier.position.z, -55, 55
  );
}

function animate() {
  if (!gameStarted) return;

  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);

  const forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) -
    (keys.KeyS || keys.ArrowDown ? 1 : 0);

  const sideways = (keys.KeyD || keys.ArrowRight ? 1 : 0) -
    (keys.KeyA || keys.ArrowLeft ? 1 : 0);

  movePlayer(-forward, sideways);

  bots.forEach(bot => {
    if (!bot.userData.alive) return;

    const direction = new THREE.Vector3()
      .subVectors(soldier.position, bot.position);

    const distance = direction.length();

    if (distance > 2) {
      direction.normalize();
      bot.position.addScaledVector(direction, delta * 1.4);
    } else {
      health = Math.max(0, health - delta * 3);
      $("healthValue").textContent = Math.floor(health);

      if (health <= 0) {
        gameOver();
      }
    }

    bot.lookAt(soldier.position);
  });

  const cameraOffset = new THREE.Vector3(0, 5, 9);
  camera.position.copy(soldier.position).add(cameraOffset);
  camera.lookAt(
    soldier.position.x,
    soldier.position.y + 1,
    soldier.position.z - 2
  );

  renderer.render(scene, camera);
}

// ---------------- SHOOTING ----------------

function shoot() {
  if (!gameStarted || ammo <= 0 || Date.now() - lastShot < 250) return;

  lastShot = Date.now();
  ammo--;

  const targets = bots.filter(bot => bot.userData.alive);

  if (targets.length) {
    targets.sort((a, b) =>
      a.position.distanceTo(soldier.position) -
      b.position.distanceTo(soldier.position)
    );

    const target = targets[0];

    if (target.position.distanceTo(soldier.position) < 25) {
      target.userData.health -= 50;

      if (target.userData.health <= 0) {
        target.userData.alive = false;
        scene.remove(target);
        score += 100;
        $("botCount").textContent =
          bots.filter(bot => bot.userData.alive).length;
      }
    }
  }

  if (ammo === 0) {
    $("weaponValue").textContent = "RELOAD!";
  }
}

function reload() {
  ammo = 30;
  $("weaponValue").textContent = "PISTOL";
}

function gameOver() {
  gameStarted = false;
  alert(YOU WERE ELIMINATED! SCORE: ${score});
  returnToLobby();
}

function returnToLobby() {
  gameStarted = false;
  hide("arenaScreen");
  show("lobbyScreen");

  if (renderer) {
    renderer.dispose();
    renderer.domElement.remove();
  }

  scene = null;
  soldier = null;
  bots = [];
}

// ---------------- KEYBOARD ----------------

window.addEventListener("keydown", event => {
  keys[event.code] = true;

  if (event.code === "Space") shoot();
  if (event.code === "KeyR") reload();
});

window.addEventListener("keyup", event => {
  keys[event.code] = false;
});

// ---------------- MOBILE BUTTONS ----------------

function holdButton(id, code) {
  const button = $(id);

  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    keys[code] = true;
  });

  ["pointerup", "pointerleave", "pointercancel"].forEach(type => {
    button.addEventListener(type, () => {
      keys[code] = false;
    });
  });
}

holdButton("forwardBtn", "KeyW");
holdButton("backBtn", "KeyS");
holdButton("leftBtn", "KeyA");
holdButton("rightBtn", "KeyD");

$("fireBtn").addEventListener("pointerdown", shoot);
$("jumpBtn").onclick = () => {
  if (soldier) soldier.position.y = 0.5;
};

$("leaveArenaBtn").onclick = returnToLobby;

// ---------------- WINDOW RESIZE ----------------

window.addEventListener("resize", () => {
  if (!renderer || !camera) return;

  const container = $("gameContainer");
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

// ---------------- STARTUP ----------------

if (await loadProfile()) {
  enterLobby();
} else {
  show("authScreen");
}
