// === Basic Setup ===
const container = document.getElementById("container");
const statusDisplay = document.getElementById("status");
const infoDiv = document.getElementById("info");
const topBar = document.getElementById("topBar");
const gameTitleText = document.getElementById("gameTitleText");
const restartIcon = document.getElementById("restartIcon");
const copyrightDiv = document.getElementById("copyright");
const startScreen = document.getElementById("startScreen");
const endScreen = document.getElementById("endScreen");
const startButton = document.getElementById("startButton");
const playAgainButton = document.getElementById("playAgainButton");
const endMessage = document.getElementById("endMessage");
const boardSizeSelect = document.getElementById("boardSizeSelect");
const playerCountSelect = document.getElementById("playerCountSelect");

// === Global Game State & Config ===
let scene, camera, renderer, controls;
let raycaster,
  mouse = new THREE.Vector2();
let gameBoard = [];
let placedVoxels = [];
let clickTargets = [];
let gameGroup;
let composer, bloomPass;
const clock = new THREE.Clock();
let activeParticles = [];
let rolloverMesh = null;
let gameState = "START";

let boardSize = 3;
let numPlayers = 2;
let playerMode = "BOT";
let currentPlayerIndex = 0;

// --- Player Setup ---
const playerSymbols = ["P1", "P2", "P3", "P4"];
let playerMaterials = [];
let rolloverMaterials = [];

let mouseDownPos = new THREE.Vector2();
let isDragging = false;
const dragThreshold = 5;

let voxelSize = 1;
let spacing = 0.5;
let totalSize = 0;
let offset = 0;
let botThinkTime = 500;

// === Materials (Defined Once) ===
const placeholderMaterial = new THREE.MeshBasicMaterial({
  color: 0xaaaaaa,
  emissive: 0x666666,
  transparent: true,
  opacity: 0.15,
  wireframe: true,
});
// Rollover materials created in init

// === Initialization ===
init();
animate();

function init() {
  // Define Player Materials with Adjusted Glow & Reflections
  const emissiveIntensityValue = 0.01; // Reduced intensity by ~20% (from 1.9)
  const roughnessValue = 1; // Increased roughness further
  const metalnessValue = 0.0; // Kept metalness at 0
  const playerColors = [
    0x00bbf9, // P1
    0xff595e, // P2
    0x8ac926, // P3
    0x8338ec, // P4
  ];

  playerMaterials = playerColors.map(
    (color, index) =>
      new THREE.MeshStandardMaterial({
        name: `player${index}`,
        color: color,
        emissive: color,
        emissiveIntensity: emissiveIntensityValue, // Apply reduced intensity
        metalness: metalnessValue,
        roughness: roughnessValue, // Apply higher roughness
      })
  );

  // Create Rollover Materials based on Player Colors
  rolloverMaterials = playerColors.map(
    (color, index) =>
      new THREE.MeshBasicMaterial({
        name: `rollover${index}`,
        color: color,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      })
  );

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0xffffff, 0); // Reduced intensity due to less reflection
  pointLight.name = "pointLight1";
  scene.add(pointLight);
  const pointLight2 = new THREE.PointLight(0xffffff, 0); // Reduced intensity
  pointLight2.name = "pointLight2";
  scene.add(pointLight2);

  gameGroup = new THREE.Group();
  scene.add(gameGroup);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enabled = false;

  raycaster = new THREE.Raycaster();

  const rolloverGeo = new THREE.BoxGeometry(
    voxelSize * 1.05,
    voxelSize * 1.05,
    voxelSize * 1.05
  );
  rolloverMesh = new THREE.Mesh(rolloverGeo, rolloverMaterials[0]);
  rolloverMesh.visible = false;
  scene.add(rolloverMesh);

  const renderScene = new THREE.RenderPass(scene, camera);
  // Reduced bloom strength along with emissive intensity
  bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.2,
    0.3,
    0.6
  ); // Strength, Radius, Threshold
  composer = new THREE.EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  // Event Listeners
  window.addEventListener("resize", onWindowResize, false);
  container.addEventListener("pointerdown", onPointerDown, false);
  container.addEventListener("pointerup", onPointerUp, false);
  container.addEventListener("pointermove", onPointerMove, false);
  gameTitleText.addEventListener("click", showStartScreen);
  restartIcon.addEventListener("click", startGame);
  startButton.addEventListener("click", handleStartGameClick);
  playAgainButton.addEventListener("click", showStartScreen);

  showStartScreen();
}

// === UI State Management ===
function showStartScreen() {
  gameState = "START";
  startScreen.style.display = "flex";
  endScreen.style.display = "none";
  infoDiv.style.display = "none";
  topBar.style.display = "none";
  copyrightDiv.style.display = "none";
  controls.enabled = false;
  boardSizeSelect.value = boardSize;
  playerCountSelect.value =
    numPlayers === 2 && playerMode === "BOT"
      ? "2"
      : numPlayers === 2 && playerMode === "HUMAN"
      ? "2h"
      : numPlayers;
  hideRollover();
  resetGameVisualsOnly();
}

function hideStartScreen() {
  startScreen.style.display = "none";
}

function showEndScreen(message, winnerIndex = -1) {
  gameState = "GAME_OVER";
  endMessage.className = "overlay-title";
  if (winnerIndex >= 0 && winnerIndex < numPlayers) {
    endMessage.classList.add(`winner-${winnerIndex}`);
  } else {
    endMessage.classList.add("draw");
  }
  endMessage.textContent = message;
  endScreen.style.display = "flex";
  infoDiv.style.display = "none";
  topBar.style.display = "none";
  copyrightDiv.style.display = "none";
  controls.enabled = true;
  hideRollover();
}

function hideEndScreen() {
  endScreen.style.display = "none";
}

function handleStartGameClick() {
  boardSize = parseInt(boardSizeSelect.value, 10);
  const playerCountValue = playerCountSelect.value;
  if (playerCountValue === "2h") {
    numPlayers = 2;
    playerMode = "HUMAN";
  } else if (playerCountValue === "2") {
    numPlayers = 2;
    playerMode = "BOT";
  } else {
    numPlayers = parseInt(playerCountValue, 10);
    playerMode = "HUMAN";
  }
  startGame();
}

function startGame() {
  hideStartScreen();
  hideEndScreen();
  infoDiv.style.display = "block";
  topBar.style.display = "flex";
  copyrightDiv.style.display = "block";
  controls.enabled = true;
  resetGame();
  gameState = "PLAYING";
  updateStatusDisplay();
}

// === Game Board Management ===
function resetGame() {
  voxelSize = 1;
  spacing = boardSize > 3 ? 0.4 : 0.5;
  totalSize = boardSize * voxelSize + (boardSize - 1) * spacing;
  offset = -totalSize / 2 + voxelSize / 2;
  const camDist = boardSize > 3 ? 1.0 + (boardSize - 3) * 0.3 : 0.8;
  const camY = boardSize > 3 ? 1.0 + (boardSize - 3) * 0.2 : 0.8;
  camera.position.set(totalSize * camDist, totalSize * camY, totalSize * 1.5);
  controls.target.set(0, 0, 0);
  controls.update();
  scene
    .getObjectByName("pointLight1")
    ?.position.set(totalSize, totalSize, totalSize);
  scene
    .getObjectByName("pointLight2")
    ?.position.set(-totalSize * 1.5, -totalSize, -totalSize * 1.5);
  resetGameVisualsOnly();
  gameBoard = [];
  for (let x = 0; x < boardSize; x++) {
    gameBoard[x] = [];
    for (let y = 0; y < boardSize; y++) {
      gameBoard[x][y] = [];
      for (let z = 0; z < boardSize; z++) {
        gameBoard[x][y][z] = null;
      }
    }
  }
  currentPlayerIndex = 0;
  updateStatusDisplay();
  hideRollover();
  createPlaceholdersAndTargets();
}

function resetGameVisualsOnly() {
  activeParticles.forEach((sys) => {
    scene.remove(sys);
    if (sys.geometry) sys.geometry.dispose();
    if (sys.material) sys.material.dispose();
  });
  activeParticles = [];
  placedVoxels.forEach((vox) => {
    gameGroup.remove(vox);
    if (vox.geometry) vox.geometry.dispose();
  });
  placedVoxels = [];
  while (gameGroup.children.length > 0) {
    gameGroup.remove(gameGroup.children[0]);
  }
  clickTargets.forEach((t) => {
    scene.remove(t);
  });
  clickTargets = [];
}

function createPlaceholdersAndTargets() {
  resetGameVisualsOnly();
  const placeholderGeo = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
  const targetGeo = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
  const targetMat = new THREE.MeshBasicMaterial({ visible: false });
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      for (let z = 0; z < boardSize; z++) {
        const pX = offset + x * (voxelSize + spacing);
        const pY = offset + y * (voxelSize + spacing);
        const pZ = offset + z * (voxelSize + spacing);
        const placeholder = new THREE.Mesh(placeholderGeo, placeholderMaterial);
        placeholder.position.set(pX, pY, pZ);
        gameGroup.add(placeholder);
        const target = new THREE.Mesh(targetGeo, targetMat);
        target.position.set(pX, pY, pZ);
        target.userData = { x, y, z };
        clickTargets.push(target);
        scene.add(target);
      }
    }
  }
}

// === Event Handlers ===
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
function onPointerDown(e) {
  if (["PLAYING", "BOT_THINKING", "START", "GAME_OVER"].includes(gameState)) {
    isDragging = false;
    mouseDownPos.set(e.clientX, e.clientY);
  }
}
function onPointerMove(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  if (mouseDownPos.lengthSq() > 0) {
    const dX = Math.abs(e.clientX - mouseDownPos.x);
    const dY = Math.abs(e.clientY - mouseDownPos.y);
    if (dX > dragThreshold || dY > dragThreshold) {
      isDragging = true;
      hideRollover();
    }
  }
  const isHuman =
    gameState === "PLAYING" &&
    (playerMode === "HUMAN" || currentPlayerIndex === 0);
  if (isHuman && !isDragging) {
    updateRollover();
  } else {
    hideRollover();
  }
}
function onPointerUp(e) {
  const isHuman =
    gameState === "PLAYING" &&
    (playerMode === "HUMAN" || currentPlayerIndex === 0);
  if (!isDragging && isHuman) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clickTargets);
    if (intersects.length > 0) {
      const t = intersects[0].object;
      const { x, y, z } = t.userData;
      if (gameBoard[x]?.[y]?.[z] === null) {
        makeMove(x, y, z);
      }
    }
  }
  isDragging = false;
  mouseDownPos.set(0, 0);
}

// === Rollover/Hover Effect ===
function updateRollover() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(clickTargets);
  let found = false;
  if (intersects.length > 0) {
    const t = intersects[0].object;
    const { x, y, z } = t.userData;
    if (gameBoard[x]?.[y]?.[z] === null) {
      if (currentPlayerIndex < rolloverMaterials.length) {
        rolloverMesh.material = rolloverMaterials[currentPlayerIndex];
      }
      rolloverMesh.position.copy(t.position);
      rolloverMesh.visible = true;
      found = true;
    }
  }
  if (!found) {
    hideRollover();
  }
}
function hideRollover() {
  if (rolloverMesh) {
    rolloverMesh.visible = false;
  }
}

// === Game Logic ===
function makeMove(x, y, z) {
  const idx = currentPlayerIndex;
  const sym = playerSymbols[idx];
  const isPlayer =
    gameState === "PLAYING" && (playerMode === "HUMAN" || idx === 0);
  const isBot =
    gameState === "BOT_THINKING" && playerMode === "BOT" && idx === 1;
  if (!(isPlayer || isBot) || gameBoard[x]?.[y]?.[z] !== null) {
    console.warn(`Move blocked`);
    if (gameState === "BOT_THINKING") {
      gameState = "PLAYING";
      updateStatusDisplay();
    }
    return;
  }
  gameBoard[x][y][z] = sym;
  const mat = playerMaterials[idx];
  const vox = new THREE.Mesh(
    new THREE.BoxGeometry(voxelSize * 0.9, voxelSize * 0.9, voxelSize * 0.9),
    mat
  );
  vox.position.set(
    offset + x * (voxelSize + spacing),
    offset + y * (voxelSize + spacing),
    offset + z * (voxelSize + spacing)
  );
  vox.userData = { x, y, z, ownerIndex: idx };
  gameGroup.add(vox);
  placedVoxels.push(vox);
  shakeEffect();
  hideRollover();
  const winInfo = checkWin(sym);
  if (winInfo) {
    gameState = "GAME_OVER";
    console.log(`Win: ${sym}`, winInfo.line);
    winAnimation(winInfo.line);
    setTimeout(() => showEndScreen(`Player ${sym} Wins!`, idx), 500);
  } else if (checkDraw()) {
    gameState = "GAME_OVER";
    showEndScreen("It's a Draw!", -1);
  } else {
    switchPlayer();
  }
}

function switchPlayer() {
  if (gameState !== "PLAYING" && gameState !== "BOT_THINKING") return;
  currentPlayerIndex = (currentPlayerIndex + 1) % numPlayers;
  updateStatusDisplay();
  const isBot = playerMode === "BOT" && currentPlayerIndex === 1;
  if (isBot) {
    gameState = "BOT_THINKING";
    hideRollover();
    setTimeout(botMove, botThinkTime);
  } else {
    gameState = "PLAYING";
  }
}

// === AI Logic ===
function botMove() {
  if (
    gameState !== "BOT_THINKING" ||
    playerMode !== "BOT" ||
    currentPlayerIndex !== 1
  ) {
    console.error("Bot error");
    gameState = "PLAYING";
    updateStatusDisplay();
    return;
  }
  const spots = getAvailableSpots();
  if (spots.length === 0) {
    console.warn("Bot: No moves");
    gameState = "PLAYING";
    updateStatusDisplay();
    return;
  }
  let move = null;
  const bot = playerSymbols[1];
  const human = playerSymbols[0];
  for (const s of spots) {
    if (checkPotentialWin(bot, s.x, s.y, s.z)) {
      move = s;
      console.log("Bot: WIN");
      break;
    }
  }
  if (!move) {
    for (const s of spots) {
      if (checkPotentialWin(human, s.x, s.y, s.z)) {
        move = s;
        console.log("Bot: BLOCK");
        break;
      }
    }
  }
  if (!move && boardSize === 3) {
    if (gameBoard[1]?.[1]?.[1] === null) {
      move = { x: 1, y: 1, z: 1 };
      console.log("Bot: CENTER");
    }
  }
  if (!move) {
    const i = Math.floor(Math.random() * spots.length);
    move = spots[i];
    console.log("Bot: RANDOM");
  }
  if (move) {
    makeMove(move.x, move.y, move.z);
  } else {
    console.error("Bot failed!");
    gameState = "PLAYING";
    updateStatusDisplay();
  }
}
function getAvailableSpots() {
  const s = [];
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      for (let z = 0; z < boardSize; z++) {
        if (gameBoard[x]?.[y]?.[z] === null) s.push({ x, y, z });
      }
    }
  }
  return s;
}
function checkPotentialWin(p, x, y, z) {
  if (gameBoard[x]?.[y]?.[z] !== null) return false;
  gameBoard[x][y][z] = p;
  const win = checkWin(p);
  gameBoard[x][y][z] = null;
  return win !== null;
}

// === Win/Draw Checks ===
function checkWin(p) {
  const B = boardSize;
  for (let i = 0; i < B; i++) {
    for (let j = 0; j < B; j++) {
      let x = 1,
        y = 1,
        z = 1;
      for (let k = 0; k < B; k++) {
        if (gameBoard[k]?.[i]?.[j] !== p) x = 0;
        if (gameBoard[i]?.[k]?.[j] !== p) y = 0;
        if (gameBoard[i]?.[j]?.[k] !== p) z = 0;
      }
      if (x) return { player: p, line: getLineCoords("x", i, j) };
      if (y) return { player: p, line: getLineCoords("y", i, j) };
      if (z) return { player: p, line: getLineCoords("z", i, j) };
    }
  }
  for (let i = 0; i < B; i++) {
    let xy1 = 1,
      xy2 = 1,
      xz1 = 1,
      xz2 = 1,
      yz1 = 1,
      yz2 = 1;
    for (let k = 0; k < B; k++) {
      if (gameBoard[k]?.[k]?.[i] !== p) xy1 = 0;
      if (gameBoard[k]?.[B - 1 - k]?.[i] !== p) xy2 = 0;
      if (gameBoard[k]?.[i]?.[k] !== p) xz1 = 0;
      if (gameBoard[k]?.[i]?.[B - 1 - k] !== p) xz2 = 0;
      if (gameBoard[i]?.[k]?.[k] !== p) yz1 = 0;
      if (gameBoard[i]?.[k]?.[B - 1 - k] !== p) yz2 = 0;
    }
    if (xy1) return { player: p, line: getLineCoords("diag_xy_1", i) };
    if (xy2) return { player: p, line: getLineCoords("diag_xy_2", i) };
    if (xz1) return { player: p, line: getLineCoords("diag_xz_1", i) };
    if (xz2) return { player: p, line: getLineCoords("diag_xz_2", i) };
    if (yz1) return { player: p, line: getLineCoords("diag_yz_1", i) };
    if (yz2) return { player: p, line: getLineCoords("diag_yz_2", i) };
  }
  let d1 = 1,
    d2 = 1,
    d3 = 1,
    d4 = 1;
  for (let k = 0; k < B; k++) {
    if (gameBoard[k]?.[k]?.[k] !== p) d1 = 0;
    if (gameBoard[k]?.[k]?.[B - 1 - k] !== p) d2 = 0;
    if (gameBoard[k]?.[B - 1 - k]?.[k] !== p) d3 = 0;
    if (gameBoard[B - 1 - k]?.[k]?.[k] !== p) d4 = 0;
  }
  if (d1) return { player: p, line: getLineCoords("diag_3d_1") };
  if (d2) return { player: p, line: getLineCoords("diag_3d_2") };
  if (d3) return { player: p, line: getLineCoords("diag_3d_3") };
  if (d4) return { player: p, line: getLineCoords("diag_3d_4") };
  return null;
}
function getLineCoords(t, p1, p2) {
  const c = [];
  const B = boardSize;
  for (let i = 0; i < B; i++) {
    switch (t) {
      case "x":
        c.push({ x: i, y: p1, z: p2 });
        break;
      case "y":
        c.push({ x: p1, y: i, z: p2 });
        break;
      case "z":
        c.push({ x: p1, y: p2, z: i });
        break;
      case "diag_xy_1":
        c.push({ x: i, y: i, z: p1 });
        break;
      case "diag_xy_2":
        c.push({ x: i, y: B - 1 - i, z: p1 });
        break;
      case "diag_xz_1":
        c.push({ x: i, y: p1, z: i });
        break;
      case "diag_xz_2":
        c.push({ x: i, y: p1, z: B - 1 - i });
        break;
      case "diag_yz_1":
        c.push({ x: p1, y: i, z: i });
        break;
      case "diag_yz_2":
        c.push({ x: p1, y: i, z: B - 1 - i });
        break;
      case "diag_3d_1":
        c.push({ x: i, y: i, z: i });
        break;
      case "diag_3d_2":
        c.push({ x: i, y: i, z: B - 1 - i });
        break;
      case "diag_3d_3":
        c.push({ x: i, y: B - 1 - i, z: i });
        break;
      case "diag_3d_4":
        c.push({ x: B - 1 - i, y: i, z: i });
        break;
    }
  }
  return c;
}
function checkDraw() {
  if (gameState !== "PLAYING" && gameState !== "BOT_THINKING") return false;
  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
      for (let z = 0; z < boardSize; z++) {
        if (gameBoard[x]?.[y]?.[z] === null) return false;
      }
    }
  }
  console.log("Draw");
  return true;
}

function updateStatusDisplay() {
  if (gameState === "PLAYING" || gameState === "BOT_THINKING") {
    const sym = playerSymbols[currentPlayerIndex];
    const txt =
      playerMode === "BOT" && currentPlayerIndex === 1
        ? "Bot's Turn..."
        : `Player ${sym}'s Turn`;
    statusDisplay.textContent = txt;
    statusDisplay.className = `player-color-${currentPlayerIndex}`;
  } else {
    statusDisplay.className = "";
  }
}

// === Animations ===
let isShaking = false;
let shakeIntensity = 0.1;
let shakeDuration = 150;
function shakeEffect() {
  if (isShaking) return;
  isShaking = true;
  const sPos = gameGroup.position.clone();
  const sTime = Date.now();
  function shake() {
    const el = Date.now() - sTime;
    if (el < shakeDuration) {
      const p = el / shakeDuration;
      const i = shakeIntensity * (1 - p);
      const sX = (Math.random() - 0.5) * i;
      const sY = (Math.random() - 0.5) * i;
      const sZ = (Math.random() - 0.5) * i;
      gameGroup.position.set(sPos.x + sX, sPos.y + sY, sPos.z + sZ);
      requestAnimationFrame(shake);
    } else {
      gameGroup.position.copy(sPos);
      isShaking = false;
    }
  }
  shake();
}
function winAnimation(line) {
  console.log("Win anim", line);
  line.forEach((c) => {
    const idx = placedVoxels.findIndex(
      (v) =>
        v.userData.x === c.x && v.userData.y === c.y && v.userData.z === c.z
    );
    if (idx !== -1) {
      const vox = placedVoxels[idx];
      const oIdx = vox.userData.ownerIndex ?? 0;
      const mat = playerMaterials[oIdx];
      gameGroup.remove(vox);
      placedVoxels.splice(idx, 1);
      createParticleExplosion(vox.position.clone(), mat.emissive.getHex());
      if (vox.geometry) vox.geometry.dispose();
    } else {
      console.warn("Voxel not found", c);
    }
  });
}
function createParticleExplosion(pos, colHex) {
  const cnt = 70;
  const geo = new THREE.BufferGeometry();
  const p = [];
  const v = [];
  const c = [];
  const mat = new THREE.PointsMaterial({
    size: 0.18,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });
  const exCol = new THREE.Color(colHex);
  const bCol = new THREE.Color(0xffffff);
  for (let i = 0; i < cnt; i++) {
    p.push(pos.x, pos.y, pos.z);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 2 - 1);
    const sp = 0.8 + Math.random() * 2.2;
    v.push(
      sp * Math.sin(ph) * Math.cos(th),
      sp * Math.sin(ph) * Math.sin(th),
      sp * Math.cos(ph)
    );
    const pCol = exCol.clone().lerp(bCol, Math.random() * 0.4);
    c.push(pCol.r, pCol.g, pCol.b);
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3));
  const ps = new THREE.Points(geo, mat);
  ps.userData = {
    velocities: v,
    startTime: Date.now(),
    duration: 900 + Math.random() * 600,
  };
  scene.add(ps);
  activeParticles.push(ps);
}
function updateParticles(dT) {
  const grav = -2.0;
  const rem = [];
  activeParticles.forEach((sys, idx) => {
    if (!sys?.geometry?.attributes?.position) {
      rem.push(idx);
      return;
    }
    const pos = sys.geometry.attributes.position.array;
    const vel = sys.userData.velocities;
    const st = sys.userData.startTime;
    const dur = sys.userData.duration;
    const el = Date.now() - st;
    if (el >= dur || !pos || !vel) {
      rem.push(idx);
      return;
    }
    const life = el / dur;
    sys.material.opacity = Math.max(0, 1.0 - life);
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] += vel[i] * dT;
      pos[i + 1] += vel[i + 1] * dT;
      pos[i + 2] += vel[i + 2] * dT;
      vel[i + 1] += grav * dT;
    }
    sys.geometry.attributes.position.needsUpdate = true;
  });
  for (let i = rem.length - 1; i >= 0; i--) {
    const idxRem = rem[i];
    const sysRem = activeParticles[idxRem];
    if (sysRem) {
      scene.remove(sysRem);
      if (sysRem.geometry) sysRem.geometry.dispose();
      if (sysRem.material) sysRem.material.dispose();
    }
    activeParticles.splice(idxRem, 1);
  }
}

// === Animation Loop ===
function animate() {
  requestAnimationFrame(animate);
  const dT = clock.getDelta();
  if (controls.enabled) {
    controls.update();
  }
  updateParticles(dT);
  composer.render();
}
