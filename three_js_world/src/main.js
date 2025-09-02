import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './style.css';
import { simulateWithDrag3D, simulateNoDrag3D } from './physics.js';

// عناصر التحكم
const airResistance = document.getElementById("airResistance");
const launchBtn = document.getElementById("launch");
const thrustControl = document.getElementById("thrustControl");
const thrustValue = document.getElementById("thrustValue");
const massInput = document.getElementById("mass");
const angleControl = document.getElementById("angleControl");
const angleValue = document.getElementById('angleValue');
const phangle = document.getElementById("phAngle");
const phangleValue = document.getElementById('phvalue');

// عناصر الإحصائيات الحية
const xEl = document.querySelector("#x p#value");
const yEl = document.querySelector("#y p#value");
const zEl = document.querySelector("#z p#value");
const velocityEl = document.querySelector("#velocity p#value");
const yMaxEl = document.querySelector("#y-max p#value");
const thrustEl = document.querySelector("#Thrust p#value");
const angleStatEl = document.querySelector("#angleStat p#value");
const phangleStatEl = document.querySelector("#phangleStat p#value");
const airResistanceEl = document.querySelector("#airResistanceStat p#value");
const massEl = document.querySelector("#massStat p#value");
const currentStateEl = document.querySelector("#current-state p#value");

// تحديث عناصر التحكم
thrustControl.addEventListener("input", () => { 
  thrustValue.textContent = thrustControl.value; 
  if(thrustEl) thrustEl.textContent = thrustControl.value;
});
angleControl.addEventListener("input", () => {
  if(angleStatEl) {
    angleStatEl.textContent = angleControl.value;
    angleValue.textContent = angleControl.value;
  }
});
airResistance.addEventListener("input", () => {
  if(airResistanceEl) airResistanceEl.textContent = airResistance.checked ? "1" : "0";
});
massInput.addEventListener("input", () => {
  if(massEl) massEl.textContent = massInput.value;
});
phangle.addEventListener("input", () => {
  phangleValue.textContent = phangle.value;
  if(phangleStatEl) phangleStatEl.textContent = phangle.value;
});

let scene, camera, renderer, controls;
let shellModel;
let shellPath = [];
let currentStep = 0;
let isLaunched = false;
let smoothFactor = 0.1;
let maxHeight = 0;

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 1, 100000);
  camera.position.set(0, 20, 50);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

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

  // تحميل القذيفة
  const gltfLoader = new GLTFLoader();
  gltfLoader.load(
    '/models/scene.gltf',
    (gltf) => {
      shellModel = gltf.scene;
      shellModel.scale.set(15,15,15);
      shellModel.position.set(0,5,0);
      scene.add(shellModel);
    },
    undefined,
    (err) => { console.error("Error loading shell:", err); }
  );

  // 🌳 إضافة مكعبات صغيرة عشوائية لتزيين البيئة
  const colors = [0x8B4513, 0x228B22, 0x556B2F, 0x6B8E23, 0x2E8B57]; // ألوان مختلفة للأشجار/الصخور
  const cubeCount = 500; // عدد أكبر
  for (let i = 0; i < cubeCount; i++) {
    const size = Math.random() * 150 + 5; // أحجام صغيرة
    const cubeGeometry = new THREE.BoxGeometry(size, size, size);
    const cubeMaterial = new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)] });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

    cube.position.set(
      (Math.random() - 0.5) * skyboxSize * 0.8, 
      size / 2, 
      (Math.random() - 0.5) * skyboxSize * 0.8
    );

    scene.add(cube);
  }

  // إطلاق القذيفة
  launchBtn.addEventListener("click", () => {
    let result = airResistance.checked
      ? simulateWithDrag3D({
          v0: Number(thrustControl.value),
          elevDeg: Number(angleControl.value),
          azimDeg: Number(phangle.value+90),
          m: Number(massInput.value),
          dt: 0.01
        }).traj
      : simulateNoDrag3D({
          v0: Number(thrustControl.value),
          elevDeg: Number(angleControl.value),
          azimDeg: Number(phangle.value+90),
          m: Number(massInput.value),
          dt: 0.01
        }).traj;

    if(result && result.length > 0){
      shellPath = result;
      currentStep = 0;
      isLaunched = true;
      maxHeight = 0;

      // تدوير القذيفة 90° مع عقارب الساعة
      if(shellModel){
        shellModel.rotation.y = -Math.PI / 2;
      }
    } else {
      console.error("خطأ: المسار فارغ!");
    }
  });

  animate();
}

function animate() {
  requestAnimationFrame(animate);

  if(shellModel && shellPath.length > 0 && currentStep < shellPath.length){
    const pos = shellPath[currentStep];
    const nextPos = shellPath[currentStep + 1] || pos;

    shellModel.position.set(pos.x, pos.y, pos.z);

    const velocityVec = new THREE.Vector3(nextPos.x - pos.x, nextPos.y - pos.y, nextPos.z - pos.z);
    const speed = velocityVec.length() / 0.01;

    if(velocityVec.length() > 0){
      const targetQuaternion = new THREE.Quaternion();
      targetQuaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), velocityVec.clone().normalize());

      const yawQuaternion = new THREE.Quaternion();
      yawQuaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), -Math.PI/2);

      targetQuaternion.multiply(yawQuaternion);
      shellModel.quaternion.slerp(targetQuaternion, smoothFactor);

      const offsetDistance = 50;
      const offsetHeight = 20;
      const behind = velocityVec.clone().normalize().multiplyScalar(-offsetDistance);

      const targetCamPos = new THREE.Vector3(
        pos.x + behind.x,
        pos.y + offsetHeight,
        pos.z + behind.z
      );

      camera.position.lerp(targetCamPos, smoothFactor);
      camera.lookAt(shellModel.position);
    }

    if(xEl) xEl.textContent = pos.x.toFixed(2);
    if(yEl) yEl.textContent = pos.y.toFixed(2);
    if(zEl) zEl.textContent = pos.z.toFixed(2);
    if(velocityEl) velocityEl.textContent = speed.toFixed(2);

    maxHeight = Math.max(maxHeight, pos.y);
    if(yMaxEl) yMaxEl.textContent = maxHeight.toFixed(2);

    if(currentStateEl) currentStateEl.textContent = "في الجو";

    currentStep++;
  } else if(shellPath.length > 0 && currentStep >= shellPath.length){
    if(currentStateEl) currentStateEl.textContent = "هبوط";
  } else {
    if(currentStateEl) currentStateEl.textContent = "سكون";
  }

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

init();
