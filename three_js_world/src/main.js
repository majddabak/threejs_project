import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './style.css';
import { simulateWithDrag3D, simulateNoDrag3D } from './physics.js';

// === عناصر التحكم والإحصائيات ===
const airResistance = document.getElementById("airResistance");
const airResistanceValue = document.getElementById("airResistanceValue");
const thrustControl = document.getElementById("thrustControl");
const thrustValue = document.getElementById("thrustValue");
const massInput = document.getElementById("mass");
const angleControl = document.getElementById("angleControl");
const angleValue = document.getElementById("angleValue");

const airResistanceStat = document.querySelector("#airResistanceStat p#value");
const thrustStat = document.querySelector("#Thrust p#value");
const massStat = document.querySelector("#massStat p#value");
const angleStat = document.querySelector("#angleStat p#value");

// تحديث عناصر التحكم
airResistance.addEventListener("input", () => {
  airResistanceStat.textContent = airResistance.value;
});

thrustControl.addEventListener("input", () => {
  thrustValue.textContent = thrustControl.value;
  thrustStat.textContent = `${thrustControl.value} (متر/ثانية)`;
});

massInput.addEventListener("input", () => {
  massStat.textContent = `${massInput.value} كغ`;
});

angleControl.addEventListener("input", () => {
  angleValue.textContent = angleControl.value;
  angleStat.textContent = angleControl.value;
});

// ===================== Three.js =====================
let scene, camera, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
const clock = new THREE.Clock();

function init() {
  scene = new THREE.Scene();

  // الكاميرا
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    1,
    100000
  );
  camera.position.set(0, 50, 50); // وضع الكاميرا خلف القذيفة قليلاً

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  // PointerLockControls مع زر L
  controls = new PointerLockControls(camera, document.body);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyL') controls.lock();
  });

  // Keyboard events
  const onKeyDown = e => {
    switch(e.code){
      case 'ArrowUp': case 'KeyW': moveForward = true; break;
      case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
      case 'ArrowDown': case 'KeyS': moveBackward = true; break;
      case 'ArrowRight': case 'KeyD': moveRight = true; break;
    }
  };
  const onKeyUp = e => {
    switch(e.code){
      case 'ArrowUp': case 'KeyW': moveForward = false; break;
      case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
      case 'ArrowDown': case 'KeyS': moveBackward = false; break;
      case 'ArrowRight': case 'KeyD': moveRight = false; break;
    }
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const loader = new THREE.TextureLoader();

  // Skybox
  const skyboxSize = 50000;
  const materialArray = [
    new THREE.MeshBasicMaterial({ map: loader.load("/skybox/meadow_ft.jpg"), side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ map: loader.load("/skybox/meadow_bk.jpg"), side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ map: loader.load("/skybox/meadow_up.jpg"), side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ map: loader.load("/skybox/meadow_dn.jpg"), side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ map: loader.load("/skybox/meadow_rt.jpg"), side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ map: loader.load("/skybox/meadow_lf.jpg"), side: THREE.BackSide }),
  ];
  const skyboxGeo = new THREE.BoxGeometry(skyboxSize, skyboxSize, skyboxSize);
  const skybox = new THREE.Mesh(skyboxGeo, materialArray);
  scene.add(skybox);

  // الأرضية
  const groundTexture = loader.load("/skybox/k-high-resolution-seamless-grass-texture-k-high-resolution-seamless-grass-texture-games-d-rendering-195521252.webp");
  groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(skyboxSize / 200, skyboxSize / 200);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(skyboxSize, skyboxSize),
    new THREE.MeshStandardMaterial({ map: groundTexture })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // الإضاءة
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5000, 10000, 5000);
  scene.add(light);

  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  // === تحميل نموذج القذيفة GLTF أمام الكاميرا مباشرة ===
  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    '/models/scene.gltf',
    (gltf) => {
      const shell = gltf.scene;
      shell.scale.set(5, 5, 5);
      shell.position.set(camera.position.x, camera.position.y - 10, camera.position.z - 20); // أمام الكاميرا
      shell.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.map = loader.load('/difuze/Material.013_metallicRoughness.png'); // تعديل Texture إذا أردت
          child.material.needsUpdate = true;
        }
      });
      scene.add(shell);
    },
    (xhr) => { console.log((xhr.loaded / xhr.total * 100) + '% تم تحميل القذيفة'); },
    (error) => { console.error('خطأ في تحميل القذيفة:', error); }
  );

  animate();
}

function animate() {
  requestAnimationFrame(animate);

  if (controls.isLocked) {
    const delta = clock.getDelta();
    const speed = 300;

    const direction = new THREE.Vector3();
    if (moveForward) direction.z -= 1;
    if (moveBackward) direction.z += 1;
    if (moveLeft) direction.x -= 1;
    if (moveRight) direction.x += 1;
    direction.normalize();

    const moveX = direction.x * speed * delta;
    const moveZ = direction.z * speed * delta;

    controls.moveRight(moveX);
    controls.moveForward(moveZ);
  }

  renderer.render(scene, camera);
}

init();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
