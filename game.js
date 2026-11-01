import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 35, 100);

const camera = new THREE.PerspectiveCamera(
  70, window.innerWidth / window.innerHeight, 0.1, 200
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const game = document.createElement("div");
game.id = "aqbattle-game";
game.style.cssText = "position:fixed;inset:0;z-index:-1;";
game.appendChild(renderer.domElement);
document.body.prepend(game);

scene.add(new THREE.HemisphereLight(0xffffff, 0x526b38, 2));

const sunlight = new THREE.DirectionalLight(0xffffff, 2);
sunlight.position.set(20, 30, 10);
sunlight.castShadow = true;
scene.add(sunlight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x477a35 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const soldier = new THREE.Group();

const body = new THREE.Mesh(
  new THREE.BoxGeometry(0.8, 1.2, 0.45),
  new THREE.MeshStandardMaterial({ color: 0x263d32 })
);
body.position.y = 1.35;
soldier.add(body);

const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 24, 24),
  new THREE.MeshStandardMaterial({ color: 0xb9815b })
);
head.position.y = 2.15;
soldier.add(head);

const legs = new THREE.Mesh(
  new THREE.BoxGeometry(0.65, 0.9, 0.4),
  new THREE.MeshStandardMaterial({ color: 0x263d32 })
);
legs.position.y = 0.45;
soldier.add(legs);

soldier.traverse(object => {
  if (object.isMesh) object.castShadow = true;
});

scene.add(soldier);

for (let i = 0; i < 18; i++) {
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

  tree.position.set(
    (Math.random() - 0.5) * 70,
    0,
    (Math.random() - 0.5) * 70
  );

  scene.add(tree);
}

camera.position.set(0, 4, 7);
camera.lookAt(0, 1.2, 0);

function animate() {
  requestAnimationFrame(animate);
  camera.position.x = soldier.position.x;
  camera.position.z = soldier.position.z + 7;
  camera.lookAt(soldier.position.x, 1.2, soldier.position.z);
  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});