import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const config = window.KHALIDCRAFT || {};
const characters = Array.isArray(config.characters) && config.characters.length > 0
    ? config.characters
    : [{
        name: config.character?.name || 'Khalid',
        role: config.character?.role || 'Main Character',
        image: config.character?.image || 'assets/img/khalid-main-character.png',
        position: [0, 5.7, 0],
        scale: [3.2, 4.3, 1],
    }];
function makeCharacterAvatarKey(name) {
    const cleaned = String(name ?? 'friend').toLowerCase().replace(/[^a-z0-9]+/g, '');

    if (/^[a-z]/.test(cleaned)) {
        return `${cleaned}Avatar`;
    }

    return `character${cleaned || 'friend'}Avatar`;
}

function makeCharacterReadyFlag(name) {
    const cleaned = String(name ?? 'friend').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

    return `__KHALIDCRAFT_${cleaned || 'FRIEND'}_AVATAR_READY`;
}

function normalizeCharacterName(name) {
    return String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const dom = {
    shell: document.querySelector('.shell'),
    canvas: document.getElementById('gameCanvas'),
    stage: document.getElementById('stage'),
    worldPanel: document.getElementById('worldPanel'),
    menuToggle: document.getElementById('menuToggleButton'),
    menuClose: document.getElementById('menuCloseButton'),
    menuScrim: document.getElementById('menuScrim'),
    palette: document.getElementById('palette'),
    worldName: document.getElementById('worldName'),
    worldSelect: document.getElementById('worldSelect'),
    newWorld: document.getElementById('newWorldButton'),
    saveWorld: document.getElementById('saveWorldButton'),
    loadWorld: document.getElementById('loadWorldButton'),
    deleteWorld: document.getElementById('deleteWorldButton'),
    blockCount: document.getElementById('blockCount'),
    selectedBlock: document.getElementById('selectedBlock'),
    status: document.getElementById('statusPill'),
    starCount: document.getElementById('starCount'),
    buildCount: document.getElementById('buildCount'),
    questText: document.getElementById('questText'),
    celebration: document.getElementById('celebration'),
    questReset: document.getElementById('questResetButton'),
};

const compactMenuQuery = window.matchMedia('(max-width: 1050px), (pointer: coarse)');
const blockTypes = [
    { id: 'grass', name: 'Grass', color: '#5ca84f', side: '#6f5134' },
    { id: 'dirt', name: 'Dirt', color: '#7a5434' },
    { id: 'stone', name: 'Stone', color: '#7f8588' },
    { id: 'wood', name: 'Wood', color: '#8a5a32' },
    { id: 'leaves', name: 'Leaves', color: '#3f8f46', transparent: true },
    { id: 'path', name: 'Path', color: '#d8a85d' },
    { id: 'sand', name: 'Sand', color: '#d8c783' },
    { id: 'water', name: 'Water', color: '#3e9ed6', transparent: true },
    { id: 'glass', name: 'Glass', color: '#a4d9e8', transparent: true },
    { id: 'lamp', name: 'Lamp', color: '#f2c44b', emissive: true },
    { id: 'brick', name: 'Brick', color: '#a75045' },
    { id: 'cloud', name: 'Cloud', color: '#f7fbff', transparent: true },
    { id: 'flowerPink', name: 'Pink Flower', color: '#ff78b4', emissive: true },
    { id: 'flowerBlue', name: 'Blue Flower', color: '#66d9ff', emissive: true },
    { id: 'rainbowRed', name: 'Rainbow Red', color: '#ff5a63', emissive: true },
    { id: 'rainbowYellow', name: 'Rainbow Yellow', color: '#ffe061', emissive: true },
    { id: 'rainbowGreen', name: 'Rainbow Green', color: '#6ee27a', emissive: true },
    { id: 'rainbowBlue', name: 'Rainbow Blue', color: '#5bb7ff', emissive: true },
    { id: 'purple', name: 'Purple Block', color: '#a678ff', emissive: true },
    { id: 'gold', name: 'Gold Block', color: '#ffd95b', emissive: true },
];

const blockById = new Map(blockTypes.map((block) => [block.id, block]));
const decorativeSurfaceTypes = new Set([
    'leaves',
    'wood',
    'flowerPink',
    'flowerBlue',
    'cloud',
    'rainbowRed',
    'rainbowYellow',
    'rainbowGreen',
    'rainbowBlue',
    'purple',
    'gold',
    'lamp',
    'glass',
    'water',
]);
const blocks = new Map();
const pressed = new Set();
const mobileMoves = new Set();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const cube = new THREE.BoxGeometry(1, 1, 1);
const starGeometry = new THREE.OctahedronGeometry(0.42, 0);
const funnySparkGeometry = new THREE.OctahedronGeometry(0.12, 0);
const characterTextureLoader = new THREE.TextureLoader();
const dummy = new THREE.Object3D();
const clock = new THREE.Clock();
const worldBounds = { min: -64, max: 64, minY: -16, maxY: 64 };
const comedyScene = {
    stage: 'wander',
    stageStarted: 0,
    nextStageAt: 9,
    anchor: new THREE.Vector3(8.5, 0, 7.5),
    forward: new THREE.Vector3(0, 0, -1),
    right: new THREE.Vector3(1, 0, 0),
    points: {},
};
const quest = {
    starGoal: 5,
    buildGoal: 5,
    collected: 0,
    built: 0,
    stars: [],
    completed: false,
};

let selectedType = 'grass';
let currentWorldId = null;
let currentSeed = makeSeed();
let meshes = [];
let characterActors = [];
let lastTouch = null;
let touchLookMoved = false;
let ignoreNextCanvasTap = false;
let lastInputWasTouch = false;
let touchInputTimer = null;
const characterMaterialCache = new Map();

const renderer = new THREE.WebGLRenderer({
    canvas: dom.canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb6edff);
scene.fog = new THREE.Fog(0xb6edff, 38, 116);

const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 240);
camera.position.set(8, 9, 12);
camera.lookAt(0, 3, 0);

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

const sun = new THREE.DirectionalLight(0xfff0c2, 2.2);
sun.position.set(24, 42, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -48;
sun.shadow.camera.right = 48;
sun.shadow.camera.top = 48;
sun.shadow.camera.bottom = -48;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbbe7ff, 0x3d3a32, 1.8));

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({ color: 0x48614a, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.52;
ground.receiveShadow = true;
scene.add(ground);

const materials = createMaterials();
const starMaterial = new THREE.MeshStandardMaterial({
    color: 0xffdc4a,
    emissive: 0xffb800,
    emissiveIntensity: 1.2,
    roughness: 0.35,
    metalness: 0.1,
});
init();

function init() {
    buildPalette();
    bindUi();
    resize();
    generateWorld(currentSeed);
    createCharacterAvatars();
    startKidQuest();
    loadWorldList();
    const roster = formatCharacterList(characters.map((item) => item.name));
    showStatus(`${roster} are exploring. The funny friends are being silly!`, false, 2600);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => window.setTimeout(resize, 250));
    window.visualViewport?.addEventListener('resize', resize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', (event) => pressed.delete(event.code));
    dom.canvas.addEventListener('click', onCanvasClick);
    dom.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    dom.canvas.addEventListener('pointerdown', onPointerDown);
    dom.canvas.addEventListener('pointermove', onPointerMove);
    dom.canvas.addEventListener('pointerup', endTouchLook);
    dom.canvas.addEventListener('pointercancel', endTouchLook);
    bindTouchControls();
    if (window.lucide) {
        window.lucide.createIcons();
    }
    animate();
}

function bindTouchControls() {
    document.querySelectorAll('[data-move]').forEach((button) => {
        const move = button.getAttribute('data-move');
        button.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            markTouchInput(event);
            mobileMoves.add(move);
            button.classList.add('is-active');
            button.setPointerCapture(event.pointerId);
        });
        const releaseMove = (event) => {
            if (event.cancelable) {
                event.preventDefault();
            }
            event.stopPropagation();
            mobileMoves.delete(move);
            button.classList.remove('is-active');
        };
        button.addEventListener('pointerup', releaseMove);
        button.addEventListener('pointercancel', releaseMove);
        button.addEventListener('pointerleave', (event) => {
            if (event.pointerType === 'mouse') {
                releaseMove(event);
            }
        });
        button.addEventListener('lostpointercapture', releaseMove);
        button.addEventListener('contextmenu', (event) => event.preventDefault());
    });

    document.querySelectorAll('[data-action]').forEach((button) => {
        const action = button.getAttribute('data-action');
        button.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            markTouchInput(event);
            button.classList.add('is-active');
            button.setPointerCapture(event.pointerId);
        });
        const releaseAction = (event) => {
            if (event.cancelable) {
                event.preventDefault();
            }
            event.stopPropagation();
            button.classList.remove('is-active');
        };
        button.addEventListener('pointerup', (event) => {
            releaseAction(event);
            performTouchAction(action);
        });
        button.addEventListener('pointercancel', releaseAction);
        button.addEventListener('lostpointercapture', releaseAction);
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        button.addEventListener('contextmenu', (event) => event.preventDefault());
    });
}

function formatCharacterList(names) {
    if (names.length <= 2) {
        return names.join(' and ');
    }

    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function createMaterials() {
    const map = new Map();
    for (const block of blockTypes) {
        const texture = makeBlockTexture(block);
        const materialOptions = {
            map: texture,
            roughness: 0.92,
            metalness: 0,
        };

        if (block.transparent) {
            materialOptions.transparent = true;
            materialOptions.opacity = block.id === 'water' ? 0.58 : 0.82;
            materialOptions.depthWrite = block.id !== 'water';
        }

        if (block.emissive) {
            materialOptions.emissive = new THREE.Color(block.color);
            materialOptions.emissiveIntensity = block.id.startsWith('rainbow') || block.id.startsWith('flower') ? 0.25 : 0.65;
        }

        map.set(block.id, new THREE.MeshStandardMaterial(materialOptions));
    }

    return map;
}

function characterMaterial(color, options = {}) {
    const key = `${color}:${options.emissive || ''}:${options.opacity || ''}`;
    if (!characterMaterialCache.has(key)) {
        const materialOptions = {
            color: new THREE.Color(color),
            roughness: 0.68,
            metalness: 0.02,
            ...options,
        };

        if (options.opacity !== undefined && options.opacity < 1) {
            materialOptions.transparent = true;
            materialOptions.depthWrite = false;
        }

        if (options.emissive) {
            materialOptions.emissive = new THREE.Color(options.emissive);
            materialOptions.emissiveIntensity = options.emissiveIntensity ?? 0.45;
        }

        characterMaterialCache.set(key, new THREE.MeshStandardMaterial(materialOptions));
    }

    return characterMaterialCache.get(key);
}

function addCharacterBox(parent, size, position, color, options = {}) {
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const mesh = new THREE.Mesh(geometry, characterMaterial(color, options.material || {}));
    mesh.position.set(position[0], position[1], position[2]);
    if (options.rotation) {
        mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);

    return mesh;
}

function addCharacterSphere(parent, radius, position, color, options = {}) {
    const geometry = new THREE.SphereGeometry(radius, 16, 12);
    const mesh = new THREE.Mesh(geometry, characterMaterial(color, options.material || {}));
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);

    return mesh;
}

function addCharacterCone(parent, radius, height, position, color) {
    const geometry = new THREE.ConeGeometry(radius, height, 4);
    const mesh = new THREE.Mesh(geometry, characterMaterial(color, { emissive: color, emissiveIntensity: 0.12 }));
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.y = Math.PI / 4;
    mesh.castShadow = true;
    parent.add(mesh);

    return mesh;
}

function createKhalidModel() {
    const root = new THREE.Group();
    const parts = {};

    addCharacterBox(root, [0.34, 0.78, 0.34], [-0.26, 0.44, 0], '#20242a');
    addCharacterBox(root, [0.34, 0.78, 0.34], [0.26, 0.44, 0], '#20242a');
    addCharacterBox(root, [1.02, 0.98, 0.48], [0, 1.2, 0], '#12161a', {
        material: { emissive: '#00c8de', emissiveIntensity: 0.08 },
    });
    addCharacterBox(root, [1.12, 0.12, 0.52], [0, 1.67, 0], '#5ad7ee', {
        material: { emissive: '#15d0e8', emissiveIntensity: 0.5 },
    });
    parts.leftArm = addCharacterBox(root, [0.3, 0.9, 0.32], [-0.76, 1.22, 0.04], '#f0a77d', { rotation: [0, 0, -0.38] });
    parts.rightArm = addCharacterBox(root, [0.3, 0.9, 0.32], [0.76, 1.22, 0.04], '#f0a77d', { rotation: [0, 0, 0.38] });
    addCharacterBox(root, [1.02, 0.76, 0.92], [0, 2.05, 0], '#e9a078');
    addCharacterBox(root, [1.14, 0.34, 1.02], [0, 2.42, -0.02], '#3b241b');
    addCharacterBox(root, [0.58, 0.22, 1.05], [-0.31, 2.24, -0.03], '#2d1b14');
    addCharacterBox(root, [0.18, 0.1, 0.08], [-0.24, 2.08, -0.48], '#2a1711');
    addCharacterBox(root, [0.18, 0.1, 0.08], [0.24, 2.08, -0.48], '#2a1711');

    return { root, parts, height: 2.85 };
}

function createOmarModel() {
    const root = new THREE.Group();
    const parts = {};

    addCharacterBox(root, [0.38, 0.74, 0.36], [-0.25, 0.42, 0], '#f4f7f3');
    addCharacterBox(root, [0.38, 0.74, 0.36], [0.25, 0.42, 0], '#f4f7f3');
    addCharacterBox(root, [1.12, 1.1, 0.54], [0, 1.24, 0], '#f8faf7');
    addCharacterBox(root, [1.18, 0.14, 0.58], [0, 1.8, 0], '#d52e34');
    addCharacterBox(root, [0.22, 0.22, 0.06], [-0.26, 1.34, -0.3], '#1d66b1');
    addCharacterBox(root, [0.22, 0.22, 0.06], [0.26, 1.34, -0.3], '#246fc4');
    parts.leftArm = addCharacterBox(root, [0.34, 0.98, 0.34], [-0.78, 1.2, 0], '#f3f7f4', { rotation: [0, 0, -0.28] });
    parts.rightArm = addCharacterBox(root, [0.34, 0.98, 0.34], [0.78, 1.2, 0], '#f3f7f4', { rotation: [0, 0, 0.28] });
    addCharacterBox(root, [0.9, 0.74, 0.86], [0, 2.12, 0], '#efa77b');
    addCharacterBox(root, [0.96, 0.32, 0.9], [0, 2.48, 0], '#171719');
    addCharacterBox(root, [1.1, 0.12, 0.96], [0, 1.79, -0.01], '#d83a38');
    addCharacterBox(root, [0.16, 0.08, 0.07], [-0.24, 2.12, -0.45], '#1d1c1c');
    addCharacterBox(root, [0.16, 0.08, 0.07], [0.24, 2.12, -0.45], '#1d1c1c');

    return { root, parts, height: 2.9 };
}

function createFunny67BodySprite() {
    const bodyCanvas = document.createElement('canvas');
    bodyCanvas.width = 512;
    bodyCanvas.height = 512;
    const ctx = bodyCanvas.getContext('2d');
    ctx.clearRect(0, 0, bodyCanvas.width, bodyCanvas.height);
    ctx.font = '900 310px Arial Black, Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 28;
    ctx.strokeStyle = '#4c50b6';
    ctx.fillStyle = '#aaa6ff';
    ctx.strokeText('67', 256, 245);
    ctx.fillText('67', 256, 245);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(182, 166, 34, 0, Math.PI * 2);
    ctx.arc(332, 166, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111215';
    ctx.beginPath();
    ctx.arc(193, 174, 15, 0, Math.PI * 2);
    ctx.arc(321, 157, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4c50b6';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(252, 305, 56, 0.2, Math.PI - 0.2);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(bodyCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
    }));
    sprite.scale.set(1.72, 1.72, 1);
    sprite.userData.baseScale = sprite.scale.clone();

    return sprite;
}

function createCharacterImageSprite(character, width, height) {
    const texture = characterTextureLoader.load(character.image, (loadedTexture) => {
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.needsUpdate = true;
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
    }));
    sprite.renderOrder = 20;
    sprite.scale.set(width, height, 1);
    sprite.userData.baseScale = sprite.scale.clone();

    return sprite;
}

function drawSpeechBubble(sprite, text) {
    const { bubbleCanvas, ctx } = sprite.userData;
    ctx.clearRect(0, 0, bubbleCanvas.width, bubbleCanvas.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    roundRect(ctx, 42, 24, 300, 92, 22);
    ctx.fill();
    ctx.fillStyle = '#20242a';
    ctx.font = '900 48px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 192, 70);
    sprite.userData.text = text;
    sprite.material.map.needsUpdate = true;
}

function setSpeechBubbleText(sprite, text) {
    if (!sprite || sprite.userData.text === text) {
        return;
    }

    drawSpeechBubble(sprite, text);
}

function createSpeechBubble(text) {
    const bubbleCanvas = document.createElement('canvas');
    bubbleCanvas.width = 384;
    bubbleCanvas.height = 160;
    const ctx = bubbleCanvas.getContext('2d');
    const texture = new THREE.CanvasTexture(bubbleCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
    }));
    sprite.renderOrder = 24;
    sprite.scale.set(1.5, 0.62, 1);
    sprite.userData = { bubbleCanvas, ctx, text: '' };
    drawSpeechBubble(sprite, text);

    return sprite;
}

function createTearSprite() {
    const tearCanvas = document.createElement('canvas');
    tearCanvas.width = 96;
    tearCanvas.height = 128;
    const ctx = tearCanvas.getContext('2d');
    ctx.clearRect(0, 0, tearCanvas.width, tearCanvas.height);
    ctx.fillStyle = 'rgba(91, 213, 255, 0.92)';
    ctx.beginPath();
    ctx.moveTo(48, 12);
    ctx.bezierCurveTo(74, 46, 82, 70, 72, 94);
    ctx.bezierCurveTo(62, 118, 33, 118, 22, 94);
    ctx.bezierCurveTo(12, 70, 22, 46, 48, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.beginPath();
    ctx.arc(38, 62, 10, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(tearCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
    }));
    sprite.renderOrder = 25;
    sprite.scale.set(0.22, 0.32, 1);
    sprite.visible = false;

    return sprite;
}

function createFunny67Model() {
    const root = new THREE.Group();
    const parts = {};

    parts.body = createFunny67BodySprite();
    parts.body.position.set(0, 1.95, 0);
    parts.body.userData.baseY = parts.body.position.y;
    root.add(parts.body);
    parts.leftArm = addCharacterBox(root, [0.16, 0.92, 0.16], [-0.98, 1.62, 0], '#8d87ff', { rotation: [0, 0, -0.34] });
    parts.rightArm = addCharacterBox(root, [0.16, 0.92, 0.16], [0.98, 1.62, 0], '#8d87ff', { rotation: [0, 0, 0.34] });
    parts.leftGlove = addCharacterSphere(root, 0.27, [-1.18, 1.02, 0], '#338bff', {
        material: { emissive: '#1176ff', emissiveIntensity: 0.2 },
    });
    parts.rightGlove = addCharacterSphere(root, 0.27, [1.18, 1.02, 0], '#338bff', {
        material: { emissive: '#1176ff', emissiveIntensity: 0.2 },
    });
    parts.leftLeg = addCharacterBox(root, [0.16, 0.92, 0.16], [-0.34, 0.62, 0], '#928cff');
    parts.rightLeg = addCharacterBox(root, [0.16, 0.92, 0.16], [0.34, 0.62, 0], '#928cff');
    parts.leftShoe = addCharacterBox(root, [0.52, 0.22, 0.4], [-0.42, 0.12, -0.04], '#2f8cff');
    parts.rightShoe = addCharacterBox(root, [0.52, 0.22, 0.4], [0.42, 0.12, -0.04], '#2f8cff');
    parts.hat = addCharacterCone(root, 0.2, 0.46, [0.32, 2.92, 0], '#ffcc3d');
    parts.bubble = createSpeechBubble('WHEE!');
    parts.bubble.position.set(0.72, 3.42, 0);
    parts.bubble.userData.baseX = parts.bubble.position.x;
    parts.bubble.userData.baseY = parts.bubble.position.y;
    root.add(parts.bubble);
    parts.tears = [-0.3, 0.22].map((x, tearIndex) => {
        const tear = createTearSprite();
        tear.position.set(x, 2.05, 0.04);
        tear.userData.baseY = tear.position.y;
        tear.userData.phase = tearIndex * 0.28;
        root.add(tear);

        return tear;
    });
    parts.sparkles = Array.from({ length: 5 }, (_, sparkleIndex) => {
        const sparkle = new THREE.Mesh(
            funnySparkGeometry,
            characterMaterial(sparkleIndex % 2 === 0 ? '#ffdf54' : '#5deaff', {
                emissive: sparkleIndex % 2 === 0 ? '#ffdf54' : '#5deaff',
                emissiveIntensity: 0.8,
            })
        );
        sparkle.castShadow = false;
        root.add(sparkle);
        return sparkle;
    });

    return { root, parts, height: 3.68, funny: true };
}

function createTungTungSahurModel(character) {
    const root = new THREE.Group();
    const parts = {};

    parts.body = createCharacterImageSprite(character, 1.75, 3.55);
    parts.body.position.set(0, 1.92, 0);
    parts.body.userData.baseY = parts.body.position.y;
    root.add(parts.body);

    parts.footBeat = addCharacterBox(root, [1.18, 0.12, 0.52], [0, 0.08, 0.02], '#9a5a24', {
        material: { emissive: '#d47a2a', emissiveIntensity: 0.12, opacity: 0.72 },
    });
    parts.bubble = createSpeechBubble('TUNG!');
    parts.bubble.position.set(0.9, 3.68, 0);
    parts.bubble.userData.baseX = parts.bubble.position.x;
    parts.bubble.userData.baseY = parts.bubble.position.y;
    root.add(parts.bubble);
    parts.sparkles = Array.from({ length: 6 }, (_, sparkleIndex) => {
        const sparkle = new THREE.Mesh(
            funnySparkGeometry,
            characterMaterial(sparkleIndex % 2 === 0 ? '#ffd463' : '#ff9e4f', {
                emissive: sparkleIndex % 2 === 0 ? '#ffd463' : '#ff9e4f',
                emissiveIntensity: 0.9,
            })
        );
        sparkle.castShadow = false;
        root.add(sparkle);
        return sparkle;
    });

    return { root, parts, height: 3.82, funny: true, tung: true };
}

function createCharacterModel(character) {
    const name = normalizeCharacterName(character.name);
    if (name === '67') {
        return createFunny67Model();
    }

    if (name.includes('tung') || name.includes('sahur')) {
        return createTungTungSahurModel(character);
    }

    if (name === 'omar') {
        return createOmarModel();
    }

    return createKhalidModel();
}

function createCharacterAvatars() {
    document.documentElement.dataset.characterAvatars = 'loading';
    characterActors = [];

    characters.forEach((character, index) => {
        createCharacterAvatar(character, index);
    });

    resetComedyScene(7);
    document.documentElement.dataset.characterAvatars = 'ready';
}

function createCharacterAvatar(character, index) {
    const group = new THREE.Group();
    group.name = `${character.name} Avatar`;
    const [x, y, z] = Array.isArray(character.position) ? character.position : [index * 3.2, 5.5, index * -0.6];
    group.position.set(x, y, z);
    const avatarStatusKey = makeCharacterAvatarKey(character.name);
    document.documentElement.dataset[avatarStatusKey] = 'loading';

    const model = createCharacterModel(character);
    group.add(model.root);

    const label = makeTextSprite(character.name);
    label.position.set(0, model.height + 0.42, 0);
    group.add(label);

    scene.add(group);
    const actor = createCharacterActor(character, index, group, model);
    const spawn = findNearbyWalkableSpot(group.position.x, group.position.z, 8);
    group.position.x = spawn.x;
    group.position.z = spawn.z;
    actor.home.set(spawn.x, 0, spawn.z);
    actor.target.set(spawn.x, 0, spawn.z);
    characterActors.push(actor);
    chooseCharacterTarget(actor, true);
    updateCharacterGrounding(actor, 0);
    document.documentElement.dataset[avatarStatusKey] = 'ready';
    window[makeCharacterReadyFlag(character.name)] = true;
}

function makeTextSprite(text) {
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 160;
    const ctx = labelCanvas.getContext('2d');
    ctx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
    ctx.fillStyle = 'rgba(9, 14, 18, 0.84)';
    roundRect(ctx, 42, 38, 428, 84, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(39, 215, 232, 0.82)';
    ctx.lineWidth = 4;
    roundRect(ctx, 42, 38, 428, 84, 16);
    ctx.stroke();
    ctx.fillStyle = '#eef5ef';
    ctx.font = '700 54px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 80);

    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
    }));
    sprite.renderOrder = 21;
    sprite.scale.set(2.4, 0.75, 1);
    return sprite;
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

function makeBlockTexture(block) {
    const size = 64;
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = size;
    textureCanvas.height = size;
    const ctx = textureCanvas.getContext('2d');
    ctx.fillStyle = block.color;
    ctx.fillRect(0, 0, size, size);

    if (block.id === 'grass') {
        ctx.fillStyle = block.side;
        ctx.fillRect(0, 34, size, 30);
        ctx.fillStyle = '#67bb58';
        ctx.fillRect(0, 0, size, 26);
    }

    if (block.id === 'brick') {
        ctx.strokeStyle = 'rgba(60, 25, 20, 0.45)';
        ctx.lineWidth = 3;
        for (let y = 16; y < size; y += 16) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }
        for (let x = 0; x < size; x += 24) {
            ctx.beginPath();
            ctx.moveTo(x + 12, 0);
            ctx.lineTo(x + 12, size);
            ctx.stroke();
        }
    }

    if (block.id === 'path') {
        ctx.fillStyle = '#e7bf78';
        for (let y = 8; y < size; y += 16) {
            ctx.fillRect(0, y, size, 4);
        }
        ctx.fillStyle = '#b77a3d';
        ctx.fillRect(0, 48, size, 8);
    }

    if (block.id === 'cloud') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillRect(0, 0, size, 26);
        ctx.fillStyle = 'rgba(169, 222, 255, 0.28)';
        ctx.fillRect(0, 44, size, 20);
    }

    if (block.id.startsWith('flower') || block.id.startsWith('rainbow') || block.id === 'purple' || block.id === 'gold') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
        ctx.fillRect(0, 0, size, 12);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
        ctx.fillRect(0, 48, size, 16);
    }

    const speckles = block.id === 'glass' || block.id === 'water' || block.id === 'cloud' ? 45 : 110;
    for (let i = 0; i < speckles; i += 1) {
        const x = Math.floor(rand(i + block.id.length) * size);
        const y = Math.floor(rand(i * 7 + block.id.length) * size);
        const alpha = block.id === 'lamp' ? 0.16 : 0.22;
        ctx.fillStyle = i % 2 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
        ctx.fillRect(x, y, 3, 3);
    }

    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapNearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function buildPalette() {
    dom.palette.innerHTML = '';
    for (const block of blockTypes) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `block-button${block.id === selectedType ? ' active' : ''}`;
        button.style.setProperty('--swatch', block.color);
        button.title = block.name;
        button.setAttribute('aria-label', block.name);
        button.dataset.block = block.id;
        button.addEventListener('click', () => selectBlock(block.id));
        dom.palette.appendChild(button);
    }
}

function bindUi() {
    setupMenuDrawer();

    dom.newWorld.addEventListener('click', () => {
        currentWorldId = null;
        currentSeed = makeSeed();
        dom.worldName.value = 'Khalid World';
        dom.worldSelect.value = '';
        generateWorld(currentSeed);
        startKidQuest();
        showStatus('New adventure!');
    });

    dom.saveWorld.addEventListener('click', saveWorld);
    dom.loadWorld.addEventListener('click', loadSelectedWorld);
    dom.deleteWorld.addEventListener('click', deleteSelectedWorld);
    dom.questReset.addEventListener('click', () => {
        startKidQuest();
        showStatus('New quest!');
    });
}

function setupMenuDrawer() {
    setMenuCollapsed(compactMenuQuery.matches);

    dom.menuToggle?.addEventListener('click', () => {
        setMenuCollapsed(!dom.shell.classList.contains('menu-collapsed'));
    });
    dom.menuClose?.addEventListener('click', () => {
        setMenuCollapsed(true);
        dom.menuToggle?.focus();
    });
    dom.menuScrim?.addEventListener('click', () => {
        setMenuCollapsed(true);
        dom.menuToggle?.focus();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !dom.shell.classList.contains('menu-collapsed')) {
            setMenuCollapsed(true);
            dom.menuToggle?.focus();
        }
    });

    const updateForViewport = (event) => setMenuCollapsed(event.matches);
    if (typeof compactMenuQuery.addEventListener === 'function') {
        compactMenuQuery.addEventListener('change', updateForViewport);
    } else if (typeof compactMenuQuery.addListener === 'function') {
        compactMenuQuery.addListener(updateForViewport);
    }
}

function setMenuCollapsed(collapsed) {
    if (!dom.shell) {
        return;
    }

    dom.shell.classList.toggle('menu-collapsed', collapsed);
    dom.shell.dataset.menu = collapsed ? 'closed' : 'open';
    dom.menuToggle?.setAttribute('aria-expanded', String(!collapsed));
    dom.menuToggle?.setAttribute('title', collapsed ? 'Show tools' : 'Hide tools');
    dom.menuToggle?.setAttribute('aria-label', collapsed ? 'Show tools' : 'Hide tools');

    if (dom.worldPanel) {
        if (collapsed) {
            dom.worldPanel.setAttribute('aria-hidden', 'true');
        } else {
            dom.worldPanel.removeAttribute('aria-hidden');
        }
        dom.worldPanel.inert = collapsed;
    }

    const icon = dom.menuToggle?.querySelector('i');
    if (icon) {
        icon.setAttribute('data-lucide', collapsed ? 'panel-left-open' : 'panel-left-close');
    }
    if (window.lucide) {
        window.lucide.createIcons();
    }
    window.requestAnimationFrame(resize);
}

function selectBlock(type) {
    selectedType = type;
    dom.selectedBlock.textContent = blockById.get(type)?.name || type;
    dom.palette.querySelectorAll('.block-button').forEach((button) => {
        button.classList.toggle('active', button.dataset.block === type);
    });
}

function generateWorld(seed) {
    blocks.clear();
    const seedNumber = seedToNumber(seed);

    for (let x = -24; x <= 24; x += 1) {
        for (let z = -24; z <= 24; z += 1) {
            const ridge = Math.sin((x + seedNumber) * 0.2) + Math.cos((z - seedNumber) * 0.19);
            const rolling = Math.sin((x + z + seedNumber) * 0.09) * 0.9;
            const detail = rand2(x, z, seedNumber) * 2.1;
            const meadow = Math.sin((x - seedNumber) * 0.08) * Math.cos((z + seedNumber) * 0.08);
            const height = Math.max(1, Math.floor(2 + ridge + detail));
            const smoothedHeight = Math.max(1, Math.floor(height + rolling + meadow * 0.7));

            for (let y = 0; y <= smoothedHeight; y += 1) {
                const type = y === smoothedHeight ? 'grass' : y > smoothedHeight - 3 ? 'dirt' : 'stone';
                setBlock(x, y, z, type, false);
            }

            if (smoothedHeight <= 2 && rand2(x + 60, z - 44, seedNumber) > 0.7) {
                setBlock(x, smoothedHeight + 1, z, 'sand', false);
            }

            if (smoothedHeight <= 1 && rand2(x - 20, z + 12, seedNumber) > 0.74) {
                setBlock(x, smoothedHeight + 1, z, 'water', false);
            }

            if (smoothedHeight >= 3 && rand2(x + 12, z - 19, seedNumber) > 0.988) {
                addTree(x, smoothedHeight + 1, z);
            }
        }
    }

    camera.position.set(8, 9, 12);
    camera.lookAt(0, 3, 0);
    clearCompanionStartArea();
    addKidWorldDecorations(seedNumber);
    rebuildMeshes();
}

function clearCompanionStartArea() {
    for (let x = 2; x <= 14; x += 1) {
        for (let z = 2; z <= 14; z += 1) {
            for (let y = 2; y <= worldBounds.maxY; y += 1) {
                const key = keyOf(x, y, z);
                const type = blocks.get(key);
                if (type === 'leaves' || type === 'wood') {
                    blocks.delete(key);
                }
            }
        }
    }
}

function addKidWorldDecorations(seedNumber) {
    addAdventurePath(seedNumber);
    scatterFlowerMeadows(seedNumber);
    addFlowerPatch(6, 13, 5, seedNumber + 101);
    addFlowerPatch(-13, -9, 5, seedNumber + 203);
    addRainbowArch(-5, 9);
    addCloudCluster(-5, 13, 12, 3);
    addMiniCastle(15, -7);
    addMushroomGarden(-15, 10);
    addBalloonCluster(13, 12);
    addHappyStarCircle(1, -14);
}

function addAdventurePath(seedNumber) {
    const points = [
        [8, 12],
        [8, 7],
        [1, 8],
        [-5, 9],
        [-15, 10],
        [-13, -9],
        [1, -14],
        [15, -7],
        [13, 12],
    ];

    for (let index = 0; index < points.length - 1; index += 1) {
        drawSurfacePath(points[index], points[index + 1], 1 + (index % 2), seedNumber + index * 31);
    }
}

function drawSurfacePath(from, to, width, seedNumber) {
    const [x1, z1] = from;
    const [x2, z2] = to;
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(z2 - z1)) * 2;

    for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const wobble = Math.sin(t * Math.PI * 2 + seedNumber) * 0.35;
        const x = Math.round(x1 + (x2 - x1) * t + wobble);
        const z = Math.round(z1 + (z2 - z1) * t - wobble);
        for (let dx = -width; dx <= width; dx += 1) {
            for (let dz = -width; dz <= width; dz += 1) {
                if (Math.abs(dx) + Math.abs(dz) <= width + 1) {
                    setSurfaceTop(x + dx, z + dz, 'path');
                    clearAboveSurface(x + dx, z + dz);
                }
            }
        }
    }
}

function scatterFlowerMeadows(seedNumber) {
    for (let x = -23; x <= 23; x += 1) {
        for (let z = -23; z <= 23; z += 1) {
            const surface = getCharacterSurface(x, z);
            const nearStart = Math.abs(x - 8) < 6 && Math.abs(z - 8) < 6;
            if (!nearStart && surface.type === 'grass' && surface.y <= 7 && rand2(x + 500, z - 300, seedNumber) > 0.92) {
                const flowerType = rand2(x - 200, z + 400, seedNumber) > 0.5 ? 'flowerPink' : 'flowerBlue';
                setBlock(x, surface.y, z, flowerType, false);
            }
        }
    }
}

function addFlowerPatch(cx, cz, radius, seedNumber) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
        for (let z = cz - radius; z <= cz + radius; z += 1) {
            const dist = Math.hypot(x - cx, z - cz);
            if (dist <= radius && rand2(x, z, seedNumber) > 0.28) {
                const type = rand2(x + 80, z - 80, seedNumber) > 0.45 ? 'flowerPink' : 'flowerBlue';
                setSurfaceTop(x, z, dist < 1.6 ? 'gold' : 'grass');
                setBlock(x, findSurfaceY(x, z), z, type, false);
            }
        }
    }
}

function addRainbowArch(cx, cz) {
    const colors = ['rainbowRed', 'rainbowYellow', 'rainbowGreen', 'rainbowBlue', 'purple'];
    const baseY = Math.max(findSurfaceY(cx - 8, cz), findSurfaceY(cx + 8, cz), findSurfaceY(cx, cz)) + 1;

    colors.forEach((type, band) => {
        const radius = 8 - band;
        const z = cz + band - 2;
        for (let dx = -radius; dx <= radius; dx += 1) {
            const y = Math.round(Math.sqrt(Math.max(0, radius * radius - dx * dx)));
            if (y >= 1) {
                setBlock(cx + dx, baseY + y, z, type, false);
            }
        }
    });

    addCloudCluster(cx - 8, baseY + 1, cz, 2);
    addCloudCluster(cx + 8, baseY + 1, cz, 2);
}

function addCloudCluster(cx, y, cz, radius) {
    for (let x = -radius * 2; x <= radius * 2; x += 1) {
        for (let yy = -1; yy <= 1; yy += 1) {
            for (let z = -radius; z <= radius; z += 1) {
                const shape = (x * x) / (radius * radius * 3.4) + (yy * yy) / 1.8 + (z * z) / (radius * radius * 1.2);
                if (shape <= 1.15) {
                    setBlock(cx + x, y + yy, cz + z, 'cloud', false);
                }
            }
        }
    }
}

function addMiniCastle(cx, cz) {
    const baseY = prepareFlatPatch(cx, cz, 5, 'path');
    for (let x = -4; x <= 4; x += 1) {
        for (let z = -3; z <= 3; z += 1) {
            const edge = Math.abs(x) === 4 || Math.abs(z) === 3;
            if (edge) {
                setBlock(cx + x, baseY, cz + z, 'purple', false);
                if ((x + z) % 2 === 0) {
                    setBlock(cx + x, baseY + 1, cz + z, 'purple', false);
                }
            }
        }
    }

    const towers = [[-4, -3], [4, -3], [-4, 3], [4, 3]];
    for (const [tx, tz] of towers) {
        for (let y = 0; y <= 4; y += 1) {
            setBlock(cx + tx, baseY + y, cz + tz, 'brick', false);
        }
        setBlock(cx + tx, baseY + 5, cz + tz, 'gold', false);
        setBlock(cx + tx, baseY + 6, cz + tz, 'lamp', false);
    }

    for (let x = -1; x <= 1; x += 1) {
        setBlock(cx + x, baseY, cz - 3, 'glass', false);
    }
}

function addMushroomGarden(cx, cz) {
    const spots = [[0, 0], [3, 2], [-3, 1], [2, -3], [-2, -2]];
    spots.forEach(([dx, dz], index) => {
        const x = cx + dx;
        const z = cz + dz;
        const baseY = findSurfaceY(x, z);
        setBlock(x, baseY, z, 'wood', false);
        setBlock(x, baseY + 1, z, 'wood', false);
        const capType = index % 2 === 0 ? 'flowerPink' : 'purple';
        for (let ix = -1; ix <= 1; ix += 1) {
            for (let iz = -1; iz <= 1; iz += 1) {
                if (Math.abs(ix) + Math.abs(iz) <= 2) {
                    setBlock(x + ix, baseY + 2, z + iz, capType, false);
                }
            }
        }
        setBlock(x, baseY + 3, z, capType, false);
    });
}

function addBalloonCluster(cx, cz) {
    const colors = ['flowerPink', 'flowerBlue', 'gold', 'rainbowGreen', 'purple'];
    colors.forEach((type, index) => {
        const angle = (index / colors.length) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(angle) * 2);
        const z = Math.round(cz + Math.sin(angle) * 2);
        const baseY = findSurfaceY(x, z);
        for (let y = 0; y < 4; y += 1) {
            setBlock(x, baseY + y, z, 'glass', false);
        }
        addRoundBlob(x, baseY + 4, z, type, 1);
    });
}

function addHappyStarCircle(cx, cz) {
    for (let index = 0; index < 10; index += 1) {
        const angle = (index / 10) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(angle) * 4);
        const z = Math.round(cz + Math.sin(angle) * 4);
        setSurfaceTop(x, z, index % 2 === 0 ? 'path' : 'gold');
        setBlock(x, findSurfaceY(x, z), z, index % 3 === 0 ? 'lamp' : 'gold', false);
    }
}

function addRoundBlob(cx, cy, cz, type, radius) {
    for (let x = -radius; x <= radius; x += 1) {
        for (let y = -radius; y <= radius; y += 1) {
            for (let z = -radius; z <= radius; z += 1) {
                if (x * x + y * y + z * z <= radius * radius + 0.5) {
                    setBlock(cx + x, cy + y, cz + z, type, false);
                }
            }
        }
    }
}

function prepareFlatPatch(cx, cz, radius, topType) {
    let baseY = 0;
    for (let x = cx - radius; x <= cx + radius; x += 1) {
        for (let z = cz - radius; z <= cz + radius; z += 1) {
            if (Math.hypot(x - cx, z - cz) <= radius + 0.5) {
                baseY = Math.max(baseY, findBuildSurfaceY(x, z));
            }
        }
    }

    for (let x = cx - radius; x <= cx + radius; x += 1) {
        for (let z = cz - radius; z <= cz + radius; z += 1) {
            if (Math.hypot(x - cx, z - cz) <= radius + 0.5) {
                for (let y = 0; y < baseY - 1; y += 1) {
                    if (!blocks.has(keyOf(x, y, z))) {
                        setBlock(x, y, z, 'dirt', false);
                    }
                }
                clearAboveSurface(x, z, 0);
                setBlock(x, baseY - 1, z, topType, false);
            }
        }
    }

    return baseY;
}

function setSurfaceTop(x, z, type) {
    const surfaceY = findBuildSurfaceY(x, z);
    if (surfaceY <= worldBounds.minY + 1) {
        return;
    }

    setBlock(x, surfaceY - 1, z, type, false);
}

function clearAboveSurface(x, z, offset = 0) {
    const surfaceY = findBuildSurfaceY(x, z);
    for (let y = surfaceY + offset; y <= worldBounds.maxY; y += 1) {
        blocks.delete(keyOf(x, y, z));
    }
}

function findBuildSurfaceY(x, z) {
    for (let y = worldBounds.maxY; y >= worldBounds.minY; y -= 1) {
        const type = blocks.get(keyOf(x, y, z));
        if (type && !decorativeSurfaceTypes.has(type)) {
            return y + 1;
        }
    }

    return findSurfaceY(x, z);
}

function addTree(x, y, z) {
    for (let trunk = 0; trunk < 4; trunk += 1) {
        setBlock(x, y + trunk, z, 'wood', false);
    }

    for (let ix = -2; ix <= 2; ix += 1) {
        for (let iy = 2; iy <= 4; iy += 1) {
            for (let iz = -2; iz <= 2; iz += 1) {
                if (Math.abs(ix) + Math.abs(iz) + (iy === 4 ? 1 : 0) < 5) {
                    setBlock(x + ix, y + iy, z + iz, 'leaves', false);
                }
            }
        }
    }
}

function setBlock(x, y, z, type, rebuild = true) {
    if (!isInsideBounds(x, y, z) || !blockById.has(type)) {
        return false;
    }

    blocks.set(keyOf(x, y, z), type);
    if (rebuild) {
        rebuildMeshes();
    }

    return true;
}

function removeBlock(key) {
    if (blocks.delete(key)) {
        rebuildMeshes();
    }
}

function rebuildMeshes() {
    for (const mesh of meshes) {
        scene.remove(mesh);
        mesh.geometry.dispose();
    }
    meshes = [];

    const groups = new Map();
    for (const [key, type] of blocks.entries()) {
        if (!groups.has(type)) {
            groups.set(type, []);
        }
        groups.get(type).push(key);
    }

    for (const [type, keys] of groups.entries()) {
        const geometry = cube.clone();
        const mesh = new THREE.InstancedMesh(geometry, materials.get(type), keys.length);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.keys = keys;
        mesh.userData.type = type;

        keys.forEach((key, index) => {
            const [x, y, z] = parseKey(key);
            dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
            dummy.updateMatrix();
            mesh.setMatrixAt(index, dummy.matrix);
        });

        mesh.instanceMatrix.needsUpdate = true;
        scene.add(mesh);
        meshes.push(mesh);
    }

    dom.blockCount.textContent = `${blocks.size.toLocaleString()} blocks`;
}

function onCanvasClick(event) {
    if (event.button !== 0) {
        return;
    }

    if (ignoreNextCanvasTap) {
        event.preventDefault();
        ignoreNextCanvasTap = false;
        return;
    }

    const isTouchLikeClick = event.pointerType === 'touch' || lastInputWasTouch;
    if (!controls.isLocked && !isTouchLikeClick) {
        controls.lock();
        return;
    }

    const hit = getHit();
    if (!hit) {
        return;
    }

    if (event.shiftKey || pressed.has('AltLeft') || pressed.has('AltRight')) {
        removeTargetBlock(hit);
        return;
    }

    placeSelectedBlockFromView(hit);
}

function placeSelectedBlockFromView(hit = getHit()) {
    if (!hit) {
        return false;
    }

    const [x, y, z] = parseKey(hit.key);
    const normal = hit.face.normal;
    const nx = x + Math.round(normal.x);
    const ny = y + Math.round(normal.y);
    const nz = z + Math.round(normal.z);

    if (!blocks.has(keyOf(nx, ny, nz))) {
        if (setBlock(nx, ny, nz, selectedType)) {
            quest.built = Math.min(quest.buildGoal, quest.built + 1);
            updateQuestUI();
            playKidTone(520, 0.08);
            checkQuestComplete();
            return true;
        }
    }

    return false;
}

function removeTargetBlock(hit = getHit()) {
    if (!hit) {
        return false;
    }

    removeBlock(hit.key);
    return true;
}

function performTouchAction(action) {
    if (action === 'place') {
        const placed = placeSelectedBlockFromView();
        showStatus(placed ? 'Block added!' : 'Point at a block first.', !placed, 1000);
        return;
    }

    if (action === 'remove') {
        const removed = removeTargetBlock();
        showStatus(removed ? 'Block popped!' : 'Point at a block first.', !removed, 1000);
    }
}

function markTouchInput(event) {
    if (event.pointerType !== 'touch') {
        return;
    }

    lastInputWasTouch = true;
    window.clearTimeout(touchInputTimer);
    touchInputTimer = window.setTimeout(() => {
        lastInputWasTouch = false;
    }, 700);
}

function onPointerDown(event) {
    if (event.pointerType === 'touch') {
        event.preventDefault();
        markTouchInput(event);
        touchLookMoved = false;
        lastTouch = {
            x: event.clientX,
            y: event.clientY,
            startX: event.clientX,
            startY: event.clientY,
        };
        dom.canvas.setPointerCapture(event.pointerId);
    }
}

function onPointerMove(event) {
    if (event.pointerType !== 'touch' || !lastTouch) {
        return;
    }

    event.preventDefault();
    const dx = event.clientX - lastTouch.x;
    const dy = event.clientY - lastTouch.y;
    const movedFromStart = Math.hypot(event.clientX - lastTouch.startX, event.clientY - lastTouch.startY);
    if (movedFromStart > 8) {
        touchLookMoved = true;
    }
    lastTouch = {
        x: event.clientX,
        y: event.clientY,
        startX: lastTouch.startX,
        startY: lastTouch.startY,
    };
    camera.rotation.order = 'YXZ';
    camera.rotation.y -= dx * 0.004;
    camera.rotation.x -= dy * 0.004;
    camera.rotation.x = Math.max(-Math.PI / 2 + 0.04, Math.min(Math.PI / 2 - 0.04, camera.rotation.x));
}

function endTouchLook() {
    if (touchLookMoved) {
        ignoreNextCanvasTap = true;
        window.setTimeout(() => {
            ignoreNextCanvasTap = false;
        }, 260);
    }

    lastTouch = null;
    touchLookMoved = false;
}

function getHit() {
    raycaster.setFromCamera(pointer, camera);
    raycaster.far = 8;
    const hits = raycaster.intersectObjects(meshes, false);
    const hit = hits.find((item) => item.instanceId !== undefined);
    if (!hit) {
        return null;
    }

    return {
        key: hit.object.userData.keys[hit.instanceId],
        face: hit.face,
    };
}

function onKeyDown(event) {
    pressed.add(event.code);

    if (/^Digit\d$/.test(event.code)) {
        const index = Number(event.code.replace('Digit', '')) - 1;
        if (blockTypes[index]) {
            selectBlock(blockTypes[index].id);
        }
    }

    if (event.code === 'KeyF') {
        removeTargetBlock();
    }
}

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    updateMovement(delta);
    updateCharacterActors(delta);
    updateStars(delta);
    renderer.render(scene, camera);
}

function updateMovement(delta) {
    const speed = pressed.has('ShiftLeft') || pressed.has('ShiftRight') ? 15 : 8;
    const direction = new THREE.Vector3();
    const forward = Number(pressed.has('KeyW') || mobileMoves.has('forward')) - Number(pressed.has('KeyS') || mobileMoves.has('back'));
    const right = Number(pressed.has('KeyD') || mobileMoves.has('right')) - Number(pressed.has('KeyA') || mobileMoves.has('left'));
    const up = Number(pressed.has('Space') || mobileMoves.has('up')) - Number(pressed.has('ControlLeft') || pressed.has('KeyC') || mobileMoves.has('down'));

    direction.set(right, 0, -forward);
    if (direction.lengthSq() > 0) {
        direction.normalize();
        direction.applyQuaternion(camera.quaternion);
        direction.y = 0;
        if (direction.lengthSq() > 0) {
            direction.normalize();
            camera.position.addScaledVector(direction, speed * delta);
        }
    }

    if (up !== 0) {
        camera.position.y += up * speed * delta;
    }

    camera.position.x = clamp(camera.position.x, worldBounds.min + 1, worldBounds.max - 1);
    camera.position.y = clamp(camera.position.y, 2, worldBounds.maxY);
    camera.position.z = clamp(camera.position.z, worldBounds.min + 1, worldBounds.max - 1);
}

function createCharacterActor(character, index, group, model) {
    const normalizedName = normalizeCharacterName(character.name);
    const isTagTarget = normalizedName === '67';
    const isTung = normalizedName.includes('tung') || normalizedName.includes('sahur');
    const isFunny = isTagTarget || isTung;
    return {
        character,
        index,
        group,
        model,
        home: new THREE.Vector3(group.position.x, 0, group.position.z),
        target: new THREE.Vector3(group.position.x, 0, group.position.z),
        nextTargetAt: 0,
        speed: isTagTarget ? 3.15 : isTung ? 2.45 : 1.35 + index * 0.18,
        phase: index * 1.73 + Math.random() * 0.4,
        action: 'wander',
        isFunny,
        isTagTarget,
        isTung,
        routeTargetCount: 0,
    };
}

function getCharacterSurface(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const y = findSurfaceY(ix, iz);
    const type = blocks.get(keyOf(ix, y - 1, iz));

    return { x: ix, y, z: iz, type };
}

function isCharacterWalkableSpot(x, z) {
    const surface = getCharacterSurface(x, z);
    return surface.type !== undefined
        && !['leaves', 'wood', 'water', 'glass'].includes(surface.type)
        && surface.y <= 7;
}

function findNearbyWalkableSpot(x, z, maxRadius = 8) {
    if (isCharacterWalkableSpot(x, z)) {
        const surface = getCharacterSurface(x, z);
        return { x: surface.x + 0.5, z: surface.z + 0.5 };
    }

    for (let radius = 1; radius <= maxRadius; radius += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
            for (let dz = -radius; dz <= radius; dz += 1) {
                if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) {
                    continue;
                }

                const candidateX = Math.round(x) + dx;
                const candidateZ = Math.round(z) + dz;
                if (isCharacterWalkableSpot(candidateX, candidateZ)) {
                    return { x: candidateX + 0.5, z: candidateZ + 0.5 };
                }
            }
        }
    }

    return { x, z };
}

function resetComedyScene(delay = 8) {
    comedyScene.stage = 'wander';
    comedyScene.stageStarted = clock.elapsedTime;
    comedyScene.nextStageAt = clock.elapsedTime + delay;
    comedyScene.points = {};
    document.documentElement.dataset.comedyScene = 'wander';
}

function updateComedyScene(elapsed) {
    if (characterActors.length < 3) {
        return;
    }

    if (elapsed < comedyScene.nextStageAt) {
        return;
    }

    const nextStage = {
        wander: 'handshake',
        handshake: 'dance',
        dance: 'chase',
        chase: 'tag',
        tag: 'tungChase',
        tungChase: 'makeup',
        makeup: 'wander',
    }[comedyScene.stage] || 'wander';

    enterComedyStage(nextStage);
}

function enterComedyStage(stage) {
    const elapsed = clock.elapsedTime;
    const durations = {
        wander: 9,
        handshake: 4,
        dance: 5,
        chase: 6,
        tag: 6,
        tungChase: 9,
        makeup: 4,
    };
    const messages = {
        handshake: 'Khalid and Omar shake hands!',
        dance: 'Dance party! Khalid and Omar jump together!',
        chase: 'Tag time! Khalid and Omar chase 67!',
        tag: 'Silly play fight! 67 cries funny cartoon tears!',
        tungChase: 'TTT Sahur chases 67 all around the world!',
        makeup: 'All friends again. 67 feels better!',
    };

    comedyScene.stage = stage;
    comedyScene.stageStarted = elapsed;
    comedyScene.nextStageAt = elapsed + (durations[stage] || 8);
    comedyScene.points = {};
    document.documentElement.dataset.comedyScene = stage;

    if (stage !== 'wander') {
        setComedyAnchorNearCamera();
        if (stage === 'tungChase') {
            startTungChaseRoute();
        }
        showStatus(messages[stage], false, stage === 'tag' || stage === 'tungChase' ? 5200 : 3000);
        playKidTone(stage === 'tag' ? 420 : stage === 'tungChase' ? 540 : 660, 0.08);
        window.setTimeout(() => playKidTone(stage === 'tag' ? 360 : stage === 'tungChase' ? 760 : 820, 0.1), 120);
    } else {
        for (const actor of characterActors) {
            actor.action = 'wander';
            chooseCharacterTarget(actor, true);
        }
    }
}

function setComedyAnchorNearCamera() {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.001) {
        forward.set(0, 0, -1);
    }
    forward.normalize();

    const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
    const spot = findNearbyWalkableSpot(
        camera.position.x + forward.x * 8,
        camera.position.z + forward.z * 8,
        10
    );

    comedyScene.anchor.set(spot.x, 0, spot.z);
    comedyScene.forward.copy(forward);
    comedyScene.right.copy(right);
}

function getComedyPoint(key, rightOffset, forwardOffset) {
    if (!comedyScene.points[key]) {
        const candidate = comedyScene.anchor.clone()
            .addScaledVector(comedyScene.right, rightOffset)
            .addScaledVector(comedyScene.forward, forwardOffset);
        const spot = findNearbyWalkableSpot(candidate.x, candidate.z, 5);
        comedyScene.points[key] = new THREE.Vector3(spot.x, 0, spot.z);
    }

    return comedyScene.points[key];
}

function getCharacterActor(name) {
    const expected = normalizeCharacterName(name);
    return characterActors.find((actor) => normalizeCharacterName(actor.character.name) === expected);
}

function getTungActor() {
    return characterActors.find((actor) => actor.isTung);
}

function startTungChaseRoute() {
    const funny67 = getCharacterActor('67');
    const tung = getTungActor();

    if (funny67) {
        choose67EscapeTarget(funny67);
    }
    if (tung && funny67) {
        tung.target.set(funny67.group.position.x, 0, funny67.group.position.z);
        tung.nextTargetAt = clock.elapsedTime + 1.2;
    }
}

function moveActorToward(actor, target, delta, speedScale = 1) {
    const position = actor.group.position;
    const toTarget = new THREE.Vector3(target.x - position.x, 0, target.z - position.z);
    const distance = toTarget.length();
    if (distance > 0.04) {
        toTarget.normalize();
        const step = Math.min(distance, actor.speed * speedScale * delta);
        position.x += toTarget.x * step;
        position.z += toTarget.z * step;
        faceActorToward(actor, target, delta, actor.isFunny ? 9 : 6);
    }

    return distance;
}

function faceActorToward(actor, target, delta, turnSpeed = 5) {
    const dx = target.x - actor.group.position.x;
    const dz = target.z - actor.group.position.z;
    if (Math.abs(dx) + Math.abs(dz) < 0.02) {
        return;
    }

    const yaw = Math.atan2(dx, dz);
    actor.group.rotation.y = rotateToward(actor.group.rotation.y, yaw, delta * turnSpeed);
}

function comedyMovingPoint(rightOffset, forwardOffset) {
    return comedyScene.anchor.clone()
        .addScaledVector(comedyScene.right, rightOffset)
        .addScaledVector(comedyScene.forward, forwardOffset);
}

function applyComedySceneActor(actor, delta, elapsed) {
    const stage = comedyScene.stage;
    if (stage === 'wander') {
        return null;
    }

    if (stage === 'tungChase') {
        return applyTungChaseSceneActor(actor, delta, elapsed);
    }

    if (actor.isTung) {
        return null;
    }

    const name = normalizeCharacterName(actor.character.name);
    const progress = elapsed - comedyScene.stageStarted;
    const khalid = getCharacterActor('Khalid');
    const omar = getCharacterActor('Omar');
    const funny67 = getCharacterActor('67');

    if (stage === 'handshake') {
        if (name === 'khalid') {
            actor.action = 'handshakeKhalid';
            const point = getComedyPoint('handshake-khalid', -0.8, 0);
            const distance = moveActorToward(actor, point, delta, 1.65);
            if (omar) {
                faceActorToward(actor, omar.group.position, delta, 7);
            }
            return distance;
        }

        if (name === 'omar') {
            actor.action = 'handshakeOmar';
            const point = getComedyPoint('handshake-omar', 0.8, 0);
            const distance = moveActorToward(actor, point, delta, 1.65);
            if (khalid) {
                faceActorToward(actor, khalid.group.position, delta, 7);
            }
            return distance;
        }

        actor.action = 'watch';
        return moveActorToward(actor, getComedyPoint(`handshake-${name}`, 0, 2.4), delta, 1.2);
    }

    if (stage === 'dance') {
        actor.action = 'dance';
        const angle = progress * 1.9 + actor.index * ((Math.PI * 2) / characterActors.length);
        const radius = actor.isFunny ? 1.95 : 1.35;
        const point = comedyMovingPoint(Math.cos(angle) * radius, Math.sin(angle) * radius);
        return moveActorToward(actor, point, delta, actor.isFunny ? 1.55 : 1.35);
    }

    if (stage === 'chase') {
        if (actor.isTagTarget) {
            actor.action = 'chased';
            const angle = progress * 2.35;
            const point = comedyMovingPoint(Math.cos(angle) * 4.1, Math.sin(angle) * 3.2);
            return moveActorToward(actor, point, delta, 1.65);
        }

        actor.action = 'chase';
        if (!funny67) {
            return null;
        }

        const side = name === 'khalid' ? -1.2 : 1.2;
        const chasePoint = new THREE.Vector3(
            funny67.group.position.x + comedyScene.right.x * side - comedyScene.forward.x * 1.2,
            0,
            funny67.group.position.z + comedyScene.right.z * side - comedyScene.forward.z * 1.2
        );
        return moveActorToward(actor, chasePoint, delta, 2.25);
    }

    if (stage === 'tag') {
        if (actor.isTagTarget) {
            actor.action = 'cry';
            const point = getComedyPoint('tag-67', 0, 0);
            return moveActorToward(actor, point, delta, 1.4);
        }

        actor.action = 'playTag';
        const side = name === 'khalid' ? -1.1 : 1.1;
        const point = getComedyPoint(`tag-${name}`, side, -0.35);
        const distance = moveActorToward(actor, point, delta, 1.9);
        if (funny67) {
            faceActorToward(actor, funny67.group.position, delta, 8);
        }
        return distance;
    }

    if (stage === 'makeup') {
        actor.action = actor.isTagTarget ? 'makeup67' : 'makeup';
        const side = name === 'khalid' ? -1.15 : name === 'omar' ? 1.15 : 0;
        const point = getComedyPoint(`makeup-${name}`, side, 0);
        const distance = moveActorToward(actor, point, delta, 1.5);
        const center = getComedyPoint('makeup-67', 0, 0);
        faceActorToward(actor, center, delta, 6);
        return distance;
    }

    return null;
}

function applyTungChaseSceneActor(actor, delta, elapsed) {
    const funny67 = getCharacterActor('67');
    const tung = getTungActor();

    if (actor.isTagTarget) {
        actor.action = 'chased';
        const distanceToTung = tung
            ? new THREE.Vector3(
                actor.group.position.x - tung.group.position.x,
                0,
                actor.group.position.z - tung.group.position.z
            ).length()
            : Infinity;
        const distanceToTarget = new THREE.Vector3(
            actor.target.x - actor.group.position.x,
            0,
            actor.target.z - actor.group.position.z
        ).length();

        if (distanceToTarget < 0.75 || elapsed > actor.nextTargetAt || distanceToTung < 2.6) {
            choose67EscapeTarget(actor);
        }

        return moveActorToward(actor, actor.target, delta, 1.72);
    }

    if (actor.isTung) {
        actor.action = 'drumChase';
        if (!funny67) {
            return null;
        }

        const chasePoint = new THREE.Vector3(funny67.group.position.x, 0, funny67.group.position.z);
        return moveActorToward(actor, chasePoint, delta, 2.65);
    }

    return null;
}

function chooseCharacterTarget(actor, forceNearHome = false) {
    if (actor.isTung) {
        chooseTungWorldTarget(actor, forceNearHome);
        return;
    }

    const elapsed = clock.elapsedTime;
    const cameraFlat = new THREE.Vector3(camera.position.x, 0, camera.position.z);
    const actorFlat = new THREE.Vector3(actor.group.position.x, 0, actor.group.position.z);
    const shouldCatchUp = actorFlat.distanceTo(cameraFlat) > (actor.isFunny ? 24 : 20);
    const center = shouldCatchUp && !forceNearHome ? cameraFlat : actor.home;
    let x = actor.group.position.x;
    let z = actor.group.position.z;

    for (let attempt = 0; attempt < 18; attempt += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = actor.isFunny ? 4 + Math.random() * 10 : 3 + Math.random() * 8;
        const candidateX = clamp(center.x + Math.cos(angle) * radius, worldBounds.min + 3, worldBounds.max - 3);
        const candidateZ = clamp(center.z + Math.sin(angle) * radius, worldBounds.min + 3, worldBounds.max - 3);

        if (isCharacterWalkableSpot(candidateX, candidateZ)) {
            const surface = getCharacterSurface(candidateX, candidateZ);
            x = surface.x + 0.5;
            z = surface.z + 0.5;
            break;
        }
    }

    actor.target.set(x, 0, z);
    actor.nextTargetAt = elapsed + (actor.isFunny ? 1.1 + Math.random() * 1.6 : 3 + Math.random() * 3.5);
}

function chooseTungWorldTarget(actor, forceNearHome = false) {
    chooseWideWorldRouteTarget(actor, {
        forceNearHome,
        routeOffset: 0,
        spread: 12,
        timeoutMin: 5.5,
        timeoutRange: 3.5,
    });
}

function choose67EscapeTarget(actor) {
    chooseWideWorldRouteTarget(actor, {
        routeOffset: 4,
        spread: 14,
        timeoutMin: 2.4,
        timeoutRange: 1.8,
    });
}

function chooseWideWorldRouteTarget(actor, options = {}) {
    const elapsed = clock.elapsedTime;
    const {
        forceNearHome = false,
        routeOffset = 0,
        spread = 12,
        timeoutMin = 5.5,
        timeoutRange = 3.5,
    } = options;
    const routePoints = [
        [-18, -14],
        [18, -10],
        [24, 18],
        [-22, 22],
        [-8, 6],
        [10, 26],
        [30, -24],
        [-30, -22],
    ];
    let x = actor.group.position.x;
    let z = actor.group.position.z;

    for (let attempt = 0; attempt < 36; attempt += 1) {
        let candidateX;
        let candidateZ;
        if (forceNearHome && attempt < 8) {
            candidateX = actor.home.x + (Math.random() - 0.5) * 16;
            candidateZ = actor.home.z + (Math.random() - 0.5) * 16;
        } else {
            const base = routePoints[(actor.routeTargetCount + routeOffset + attempt) % routePoints.length];
            candidateX = base[0] + (Math.random() - 0.5) * spread;
            candidateZ = base[1] + (Math.random() - 0.5) * spread;
        }

        candidateX = clamp(candidateX, worldBounds.min + 4, worldBounds.max - 4);
        candidateZ = clamp(candidateZ, worldBounds.min + 4, worldBounds.max - 4);

        if (isCharacterWalkableSpot(candidateX, candidateZ)) {
            const surface = getCharacterSurface(candidateX, candidateZ);
            x = surface.x + 0.5;
            z = surface.z + 0.5;
            actor.routeTargetCount += 1;
            break;
        }
    }

    actor.target.set(x, 0, z);
    actor.nextTargetAt = elapsed + timeoutMin + Math.random() * timeoutRange;
}

function updateCharacterActors(delta) {
    const elapsed = clock.elapsedTime;
    updateComedyScene(elapsed);

    for (const actor of characterActors) {
        actor.action = actor.isTung ? 'drum' : 'wander';
        let distance = applyComedySceneActor(actor, delta, elapsed);

        if (distance === null) {
            const position = actor.group.position;
            const toTarget = new THREE.Vector3(actor.target.x - position.x, 0, actor.target.z - position.z);
            distance = toTarget.length();
            if (distance < 0.35 || elapsed > actor.nextTargetAt) {
                chooseCharacterTarget(actor);
            }

            if (distance > 0.04) {
                toTarget.normalize();
                const sillySpeedBoost = actor.isFunny ? 1 + Math.max(0, Math.sin(elapsed * 5.5 + actor.phase)) * 0.75 : 1;
                const step = Math.min(distance, actor.speed * sillySpeedBoost * delta);
                position.x += toTarget.x * step;
                position.z += toTarget.z * step;
                const yaw = Math.atan2(toTarget.x, toTarget.z);
                actor.group.rotation.y = rotateToward(actor.group.rotation.y, yaw, delta * (actor.isFunny ? 8 : 4.5));
            }
        }

        updateCharacterGrounding(actor, distance);
        animateCharacterModel(actor, distance, elapsed);
    }
}

function updateCharacterGrounding(actor, distance) {
    const groundY = findSurfaceY(Math.round(actor.group.position.x), Math.round(actor.group.position.z));
    const elapsed = clock.elapsedTime;
    const moving = distance > 0.05;
    let hop = actor.isFunny
        ? Math.abs(Math.sin(elapsed * 7.6 + actor.phase)) * (moving ? 0.5 : 0.3)
        : Math.max(0, Math.sin(elapsed * 5.2 + actor.phase)) * (moving ? 0.09 : 0.03);

    if (actor.action === 'dance') {
        hop += Math.abs(Math.sin(elapsed * 7.8 + actor.phase)) * (actor.isFunny ? 0.62 : 0.42);
    } else if (actor.action === 'playTag' || actor.action === 'chase') {
        hop += Math.abs(Math.sin(elapsed * 9.2 + actor.phase)) * 0.16;
    } else if (actor.action === 'drum' || actor.action === 'drumChase') {
        hop += Math.abs(Math.sin(elapsed * 13.5 + actor.phase)) * (actor.isTung ? 0.24 : 0.18);
    } else if (actor.action === 'cry') {
        hop = Math.abs(Math.sin(elapsed * 12 + actor.phase)) * 0.12;
    } else if (actor.action === 'makeup' || actor.action === 'makeup67') {
        hop += Math.abs(Math.sin(elapsed * 5.6 + actor.phase)) * 0.22;
    }

    actor.group.position.y = groundY + 0.03 + hop;
}

function animateCharacterModel(actor, distance, elapsed) {
    const parts = actor.model.parts || {};
    const moving = distance > 0.05;
    const step = moving ? Math.sin(elapsed * (actor.isFunny ? 10 : 6) + actor.phase) : Math.sin(elapsed * 2 + actor.phase) * 0.25;
    actor.model.root.rotation.z = actor.isFunny
        ? Math.sin(elapsed * 4.2 + actor.phase) * 0.18
        : step * 0.035;

    if (parts.leftArm) {
        parts.leftArm.rotation.z = (actor.isFunny ? -0.34 : -0.28) + step * (actor.isFunny ? 0.45 : 0.16);
    }
    if (parts.rightArm) {
        parts.rightArm.rotation.z = (actor.isFunny ? 0.34 : 0.28) - step * (actor.isFunny ? 0.45 : 0.16);
    }

    applyComedyPose(actor, parts, elapsed, step);

    if (!actor.isFunny) {
        return;
    }

    if (parts.body) {
        const crySquish = actor.action === 'cry' ? Math.sin(elapsed * 15 + actor.phase) * 0.08 : 0;
        const bodyBaseY = parts.body.userData.baseY ?? 1.95;
        const bodyBaseScale = parts.body.userData.baseScale ?? new THREE.Vector3(1, 1, 1);
        const isDrumming = actor.action === 'drum' || actor.action === 'drumChase';
        const drumBounce = isDrumming ? Math.abs(Math.sin(elapsed * 13.5 + actor.phase)) * 0.16 : 0;
        parts.body.position.y = bodyBaseY + Math.sin(elapsed * 8.4 + actor.phase) * 0.08 + drumBounce;
        parts.body.scale.set(
            bodyBaseScale.x * (1 + crySquish),
            bodyBaseScale.y * (1 - Math.abs(crySquish) * 0.4),
            bodyBaseScale.z
        );
        parts.body.material.rotation = Math.sin(elapsed * (actor.action === 'cry' ? 8 : isDrumming ? 12 : 3.2))
            * (actor.action === 'cry' ? 0.11 : isDrumming ? 0.08 : 0.05);
    }
    if (parts.leftGlove) {
        parts.leftGlove.position.y = 1.02 + Math.sin(elapsed * 9.5 + actor.phase) * 0.22;
    }
    if (parts.rightGlove) {
        parts.rightGlove.position.y = 1.02 + Math.cos(elapsed * 9.5 + actor.phase) * 0.22;
    }
    if (parts.hat) {
        parts.hat.rotation.y += 0.18;
        parts.hat.position.y = 2.92 + Math.abs(Math.sin(elapsed * 7.6 + actor.phase)) * 0.16;
    }
    if (parts.bubble) {
        const bubbleText = actor.isTung
            ? actor.action === 'drumChase'
                ? 'CHASE!'
                : actor.action === 'dance'
                ? 'TUNG!'
                : actor.action === 'drum'
                    ? 'TUNG!'
                    : 'SAHUR!'
            : actor.action === 'cry'
                ? 'WAH!'
                : actor.action === 'chased'
                    ? 'EEK!'
                    : actor.action === 'makeup67'
                        ? 'OK!'
                        : 'WHEE!';
        setSpeechBubbleText(parts.bubble, bubbleText);
        parts.bubble.visible = actor.isTung
            || actor.action === 'cry'
            || actor.action === 'chased'
            || actor.action === 'makeup67'
            || Math.sin(elapsed * 1.4 + actor.phase) > -0.35;
        const bubbleBaseX = parts.bubble.userData.baseX ?? 0.72;
        const bubbleBaseY = parts.bubble.userData.baseY ?? 3.42;
        parts.bubble.position.x = bubbleBaseX + Math.sin(elapsed * 3.4) * 0.08;
        parts.bubble.position.y = bubbleBaseY + Math.abs(Math.sin(elapsed * 5.4)) * 0.12;
    }
    if (parts.footBeat) {
        parts.footBeat.scale.x = 1 + Math.abs(Math.sin(elapsed * 13.5 + actor.phase)) * 0.2;
        parts.footBeat.rotation.y += 0.08;
    }
    if (parts.tears) {
        parts.tears.forEach((tear, tearIndex) => {
            tear.visible = actor.action === 'cry';
            const fall = (elapsed * 1.8 + tear.userData.phase) % 0.62;
            tear.position.y = tear.userData.baseY - fall;
            tear.position.x = (tearIndex === 0 ? -0.3 : 0.22) + Math.sin(elapsed * 11 + tearIndex) * 0.035;
        });
    }
    if (parts.sparkles) {
        parts.sparkles.forEach((sparkle, sparkleIndex) => {
            const angle = elapsed * (2.2 + sparkleIndex * 0.2) + sparkleIndex * 1.25;
            const radius = 0.78 + (sparkleIndex % 2) * 0.22;
            sparkle.position.set(
                Math.cos(angle) * radius,
                2.2 + Math.sin(angle * 1.7) * 0.55,
                Math.sin(angle) * radius
            );
            sparkle.rotation.x += 0.16;
            sparkle.rotation.y += 0.12;
        });
    }
}

function applyComedyPose(actor, parts, elapsed, step) {
    const wave = Math.sin(elapsed * 8.5 + actor.phase);
    if (actor.action === 'handshakeKhalid') {
        actor.model.root.rotation.z = Math.sin(elapsed * 5) * 0.04;
        if (parts.rightArm) {
            parts.rightArm.rotation.z = -1.08 + wave * 0.08;
        }
        if (parts.leftArm) {
            parts.leftArm.rotation.z = -0.45;
        }
    } else if (actor.action === 'handshakeOmar') {
        actor.model.root.rotation.z = Math.sin(elapsed * 5) * -0.04;
        if (parts.leftArm) {
            parts.leftArm.rotation.z = 1.08 - wave * 0.08;
        }
        if (parts.rightArm) {
            parts.rightArm.rotation.z = 0.45;
        }
    } else if (actor.action === 'dance') {
        actor.model.root.rotation.z = Math.sin(elapsed * 7 + actor.phase) * (actor.isFunny ? 0.24 : 0.16);
        if (parts.leftArm) {
            parts.leftArm.rotation.z = -0.95 + wave * 0.28;
        }
        if (parts.rightArm) {
            parts.rightArm.rotation.z = 0.95 - wave * 0.28;
        }
    } else if (actor.action === 'chase' || actor.action === 'chased') {
        actor.model.root.rotation.z = step * (actor.isFunny ? 0.24 : 0.12);
        if (parts.leftArm) {
            parts.leftArm.rotation.z += wave * 0.22;
        }
        if (parts.rightArm) {
            parts.rightArm.rotation.z -= wave * 0.22;
        }
    } else if (actor.action === 'playTag') {
        actor.model.root.rotation.z = Math.sin(elapsed * 10 + actor.phase) * 0.13;
        if (parts.leftArm) {
            parts.leftArm.rotation.z = -0.82 + Math.sin(elapsed * 12 + actor.phase) * 0.55;
        }
        if (parts.rightArm) {
            parts.rightArm.rotation.z = 0.82 - Math.cos(elapsed * 12 + actor.phase) * 0.55;
        }
    } else if (actor.action === 'drum' || actor.action === 'drumChase') {
        actor.model.root.rotation.z = Math.sin(elapsed * 13.5 + actor.phase) * (actor.isTung ? 0.18 : 0.12);
        if (parts.leftArm) {
            parts.leftArm.rotation.z = -0.5 + wave * 0.35;
        }
        if (parts.rightArm) {
            parts.rightArm.rotation.z = 0.5 - wave * 0.35;
        }
    } else if (actor.action === 'cry') {
        actor.model.root.rotation.z = Math.sin(elapsed * 14 + actor.phase) * 0.18;
        if (parts.leftArm) {
            parts.leftArm.rotation.z = -0.1 + Math.sin(elapsed * 11) * 0.1;
        }
        if (parts.rightArm) {
            parts.rightArm.rotation.z = 0.1 - Math.sin(elapsed * 11) * 0.1;
        }
    } else if (actor.action === 'makeup' || actor.action === 'makeup67') {
        actor.model.root.rotation.z = Math.sin(elapsed * 5 + actor.phase) * 0.08;
        if (parts.leftArm) {
            parts.leftArm.rotation.z = -0.75 + wave * 0.18;
        }
        if (parts.rightArm) {
            parts.rightArm.rotation.z = 0.75 - wave * 0.18;
        }
    }
}

function rotateToward(current, target, amount) {
    const delta = normalizeAngle(target - current);
    return current + clamp(delta, -amount, amount);
}

function normalizeAngle(value) {
    return Math.atan2(Math.sin(value), Math.cos(value));
}

function resize() {
    const rect = dom.stage.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

async function loadWorldList() {
    const worlds = readStoredWorlds();
    dom.worldSelect.innerHTML = '<option value="">Saved worlds</option>';

    for (const world of worlds) {
        const option = document.createElement('option');
        option.value = String(world.id);
        option.textContent = `${world.name} (${world.block_count})`;
        dom.worldSelect.appendChild(option);
    }

    if (currentWorldId) {
        dom.worldSelect.value = String(currentWorldId);
    }
}

async function saveWorld() {
    const worlds = readStoredWorlds();
    const now = new Date().toISOString();
    const worldId = currentWorldId || `world-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const data = exportWorld();
    const record = {
        id: worldId,
        name: cleanWorldName(dom.worldName.value),
        seed: currentSeed,
        block_count: data.blocks.length,
        data,
        updated_at: now,
        created_at: worlds.find((world) => world.id === worldId)?.created_at || now,
    };

    const nextWorlds = [
        record,
        ...worlds.filter((world) => world.id !== worldId),
    ].slice(0, 20);

    localStorage.setItem('khalidcraft.worlds', JSON.stringify(nextWorlds));
    currentWorldId = worldId;
    dom.worldName.value = record.name;
    await loadWorldList();
    showStatus('Saved!');
}

async function loadSelectedWorld() {
    const id = dom.worldSelect.value;
    if (!id) {
        showStatus('Pick a world first.', true);
        return;
    }

    const world = readStoredWorlds().find((item) => item.id === id);
    if (!world) {
        showStatus('World not found.', true);
        await loadWorldList();
        return;
    }

    importWorld(world);
    startKidQuest();
    showStatus('Loaded!');
}

async function deleteSelectedWorld() {
    const id = dom.worldSelect.value;
    if (!id) {
        showStatus('Pick a world first.', true);
        return;
    }

    const nextWorlds = readStoredWorlds().filter((world) => world.id !== id);
    localStorage.setItem('khalidcraft.worlds', JSON.stringify(nextWorlds));

    if (currentWorldId === id) {
        currentWorldId = null;
    }

    await loadWorldList();
    showStatus('Removed.');
}

function exportWorld() {
    const exportedBlocks = Array.from(blocks.entries())
        .map(([key, type]) => [...parseKey(key), type])
        .sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);

    return {
        version: 1,
        seed: currentSeed,
        camera: {
            x: Number(camera.position.x.toFixed(2)),
            y: Number(camera.position.y.toFixed(2)),
            z: Number(camera.position.z.toFixed(2)),
        },
        blocks: exportedBlocks,
    };
}

function importWorld(world) {
    const data = world.data || world;
    currentWorldId = world.id || null;
    currentSeed = world.seed || data.seed || makeSeed();
    dom.worldName.value = world.name || 'Khalid World';
    blocks.clear();

    for (const block of data.blocks || []) {
        const [x, y, z, type] = block;
        if (Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) && blockById.has(type)) {
            setBlock(x, y, z, type, false);
        }
    }

    if (data.camera) {
        camera.position.set(
            Number(data.camera.x) || 8,
            Number(data.camera.y) || 9,
            Number(data.camera.z) || 12
        );
    }

    rebuildMeshes();
}

function startKidQuest() {
    clearStars();
    quest.collected = 0;
    quest.built = 0;
    quest.completed = false;
    dom.celebration.classList.remove('show');
    dom.celebration.textContent = '';
    spawnStars();
    updateQuestUI();
}

function clearStars() {
    for (const star of quest.stars) {
        scene.remove(star);
    }
    quest.stars = [];
}

function spawnStars() {
    const seedNumber = seedToNumber(currentSeed);
    const positions = [
        [-5, -2],
        [-1, -7],
        [5, -4],
        [-7, 5],
        [4, 6],
    ];

    positions.forEach(([baseX, baseZ], index) => {
        const wiggleX = Math.round((rand(seedNumber + index * 9) - 0.5) * 3);
        const wiggleZ = Math.round((rand(seedNumber + index * 13) - 0.5) * 3);
        const x = baseX + wiggleX;
        const z = baseZ + wiggleZ;
        const y = findSurfaceY(x, z) + 2.1;
        const star = new THREE.Mesh(starGeometry, starMaterial);
        star.position.set(x + 0.5, y, z + 0.5);
        star.castShadow = false;
        star.userData.baseY = y;
        star.userData.phase = index * 0.8;
        star.userData.collected = false;
        scene.add(star);
        quest.stars.push(star);
    });
}

function findSurfaceY(x, z) {
    for (let y = worldBounds.maxY; y >= worldBounds.minY; y -= 1) {
        if (blocks.has(keyOf(x, y, z))) {
            return y + 1;
        }
    }

    return 3;
}

function updateStars(delta) {
    const elapsed = clock.elapsedTime;
    for (const star of quest.stars) {
        if (star.userData.collected) {
            continue;
        }

        star.rotation.x += delta * 1.6;
        star.rotation.y += delta * 2.4;
        star.position.y = star.userData.baseY + Math.sin(elapsed * 2 + star.userData.phase) * 0.18;

        if (camera.position.distanceTo(star.position) < 2.25) {
            collectStar(star);
        }
    }
}

function collectStar(star) {
    star.userData.collected = true;
    scene.remove(star);
    quest.collected = Math.min(quest.starGoal, quest.collected + 1);
    updateQuestUI();
    showStatus('Star found!');
    playKidTone(740, 0.1);
    checkQuestComplete();
}

function updateQuestUI() {
    dom.starCount.textContent = `${quest.collected}/${quest.starGoal}`;
    dom.buildCount.textContent = `${quest.built}/${quest.buildGoal}`;

    const starsLeft = quest.starGoal - quest.collected;
    const blocksLeft = quest.buildGoal - quest.built;
    if (starsLeft > 0 && blocksLeft > 0) {
        dom.questText.textContent = `Find ${starsLeft} stars and place ${blocksLeft} blocks.`;
    } else if (starsLeft > 0) {
        dom.questText.textContent = `Find ${starsLeft} more stars.`;
    } else if (blocksLeft > 0) {
        dom.questText.textContent = `Place ${blocksLeft} more blocks.`;
    } else {
        dom.questText.textContent = 'Quest complete. Great job!';
    }

    document.documentElement.dataset.kidQuest = quest.completed ? 'complete' : 'playing';
}

function checkQuestComplete() {
    if (quest.completed || quest.collected < quest.starGoal || quest.built < quest.buildGoal) {
        return;
    }

    quest.completed = true;
    document.documentElement.dataset.kidQuest = 'complete';
    dom.celebration.textContent = 'Great job!';
    dom.celebration.classList.add('show');
    playKidTone(880, 0.12);
    window.setTimeout(() => playKidTone(1040, 0.16), 140);
    window.setTimeout(() => dom.celebration.classList.remove('show'), 3200);
}

function playKidTone(frequency, duration) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            return;
        }

        const context = playKidTone.context || new AudioContext();
        playKidTone.context = context;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.06, context.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + duration + 0.02);
    } catch {
        // Sound is optional; browsers may block it until a direct gesture.
    }
}

function readStoredWorlds() {
    const raw = localStorage.getItem('khalidcraft.worlds');
    if (!raw) {
        const legacy = localStorage.getItem('khalidcraft.demo');
        if (!legacy) {
            return [];
        }

        try {
            const parsed = JSON.parse(legacy);
            const migrated = {
                id: 'legacy-demo',
                name: parsed.name || 'Khalid World',
                seed: parsed.seed || parsed.data?.seed || currentSeed,
                block_count: Array.isArray(parsed.data?.blocks) ? parsed.data.blocks.length : 0,
                data: parsed.data || parsed,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            localStorage.setItem('khalidcraft.worlds', JSON.stringify([migrated]));
            localStorage.removeItem('khalidcraft.demo');
            return [migrated];
        } catch {
            localStorage.removeItem('khalidcraft.demo');
            return [];
        }
    }

    try {
        const worlds = JSON.parse(raw);
        return Array.isArray(worlds) ? worlds : [];
    } catch {
        return [];
    }
}

function cleanWorldName(name) {
    const cleaned = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return cleaned || 'Khalid World';
}

function showStatus(message, isError = false, duration = 2800) {
    dom.status.textContent = message;
    dom.status.classList.toggle('error', isError);
    dom.status.classList.add('show');
    window.clearTimeout(showStatus.timer);
    showStatus.timer = window.setTimeout(() => {
        dom.status.classList.remove('show');
    }, duration);
}

function keyOf(x, y, z) {
    return `${x},${y},${z}`;
}

function parseKey(key) {
    return key.split(',').map(Number);
}

function isInsideBounds(x, y, z) {
    return x >= worldBounds.min && x <= worldBounds.max
        && z >= worldBounds.min && z <= worldBounds.max
        && y >= worldBounds.minY && y <= worldBounds.maxY;
}

function rand(value) {
    return fract(Math.sin(value * 127.1 + 311.7) * 43758.5453123);
}

function rand2(x, z, seed) {
    return fract(Math.sin(x * 12.9898 + z * 78.233 + seed * 37.719) * 43758.5453);
}

function fract(value) {
    return value - Math.floor(value);
}

function seedToNumber(seed) {
    return String(seed).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1;
}

function makeSeed() {
    return Math.random().toString(36).slice(2, 10);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
