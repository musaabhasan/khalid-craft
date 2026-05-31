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
const primaryCharacter = characters[0];
const dom = {
    canvas: document.getElementById('gameCanvas'),
    stage: document.getElementById('stage'),
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
};

const blockTypes = [
    { id: 'grass', name: 'Grass', color: '#5ca84f', side: '#6f5134' },
    { id: 'dirt', name: 'Dirt', color: '#7a5434' },
    { id: 'stone', name: 'Stone', color: '#7f8588' },
    { id: 'wood', name: 'Wood', color: '#8a5a32' },
    { id: 'leaves', name: 'Leaves', color: '#3f8f46', transparent: true },
    { id: 'sand', name: 'Sand', color: '#d8c783' },
    { id: 'water', name: 'Water', color: '#3e9ed6', transparent: true },
    { id: 'glass', name: 'Glass', color: '#a4d9e8', transparent: true },
    { id: 'lamp', name: 'Lamp', color: '#f2c44b', emissive: true },
    { id: 'brick', name: 'Brick', color: '#a75045' },
];

const blockById = new Map(blockTypes.map((block) => [block.id, block]));
const blocks = new Map();
const pressed = new Set();
const mobileMoves = new Set();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const cube = new THREE.BoxGeometry(1, 1, 1);
const dummy = new THREE.Object3D();
const clock = new THREE.Clock();
const worldBounds = { min: -64, max: 64, minY: -16, maxY: 64 };

let selectedType = 'grass';
let currentWorldId = null;
let currentSeed = makeSeed();
let meshes = [];
let lastTouch = null;

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
scene.background = new THREE.Color(0x80c5df);
scene.fog = new THREE.Fog(0x80c5df, 32, 96);

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
init();

function init() {
    buildPalette();
    bindUi();
    resize();
    generateWorld(currentSeed);
    createCharacterAvatars();
    loadWorldList();
    const roster = characters.map((item) => item.name).join(' and ');
    showStatus(`${roster} are ready. Worlds save in this browser.`, false, 2200);
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', (event) => pressed.delete(event.code));
    dom.canvas.addEventListener('click', onCanvasClick);
    dom.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    dom.canvas.addEventListener('pointerdown', onPointerDown);
    dom.canvas.addEventListener('pointermove', onPointerMove);
    dom.canvas.addEventListener('pointerup', () => {
        lastTouch = null;
    });
    dom.canvas.addEventListener('pointercancel', () => {
        lastTouch = null;
    });
    document.querySelectorAll('[data-move]').forEach((button) => {
        const move = button.getAttribute('data-move');
        button.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            mobileMoves.add(move);
            button.setPointerCapture(event.pointerId);
        });
        button.addEventListener('pointerup', () => mobileMoves.delete(move));
        button.addEventListener('pointercancel', () => mobileMoves.delete(move));
        button.addEventListener('pointerleave', () => mobileMoves.delete(move));
    });
    if (window.lucide) {
        window.lucide.createIcons();
    }
    animate();
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
            materialOptions.emissive = new THREE.Color(0xf0b83f);
            materialOptions.emissiveIntensity = 0.65;
        }

        map.set(block.id, new THREE.MeshStandardMaterial(materialOptions));
    }

    return map;
}

function createCharacterAvatars() {
    document.documentElement.dataset.characterAvatars = 'loading';
    let loaded = 0;
    let failed = 0;

    characters.forEach((character, index) => {
        createCharacterAvatar(character, index, (ok) => {
            loaded += ok ? 1 : 0;
            failed += ok ? 0 : 1;
            if (loaded + failed === characters.length) {
                document.documentElement.dataset.characterAvatars = failed > 0 ? 'partial' : 'ready';
            }
        });
    });
}

function createCharacterAvatar(character, index, onDone) {
    const group = new THREE.Group();
    group.name = `${character.name} Avatar`;
    const [x, y, z] = Array.isArray(character.position) ? character.position : [index * 3.2, 5.5, index * -0.6];
    group.position.set(x, y, z);
    document.documentElement.dataset[`${character.name.toLowerCase()}Avatar`] = 'loading';

    const loader = new THREE.TextureLoader();
    loader.load(character.image, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        }));
        sprite.name = character.name;
        sprite.renderOrder = 20 + index;
        const [sx, sy, sz] = Array.isArray(character.scale) ? character.scale : [2.8, 4.2, 1];
        sprite.scale.set(sx, sy, sz);
        group.add(sprite);
        document.documentElement.dataset[`${character.name.toLowerCase()}Avatar`] = 'ready';
        window[`__KHALIDCRAFT_${character.name.toUpperCase()}_AVATAR_READY`] = true;
        onDone(true);
    }, undefined, () => {
        document.documentElement.dataset[`${character.name.toLowerCase()}Avatar`] = 'error';
        onDone(false);
    });

    const label = makeTextSprite(character.name);
    label.position.set(0, 2.45, 0);
    group.add(label);

    const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(1.45, 1.45, 0.16, 4),
        new THREE.MeshStandardMaterial({
            color: 0x17252b,
            emissive: 0x0a8fa8,
            emissiveIntensity: 0.3,
            roughness: 0.5,
        })
    );
    pedestal.rotation.y = Math.PI / 4;
    pedestal.position.y = -2.2;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    group.add(pedestal);

    scene.add(group);
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

    const speckles = block.id === 'glass' || block.id === 'water' ? 45 : 110;
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
    dom.newWorld.addEventListener('click', () => {
        currentWorldId = null;
        currentSeed = makeSeed();
        dom.worldName.value = 'Khalid World';
        dom.worldSelect.value = '';
        generateWorld(currentSeed);
        showStatus('New world generated.');
    });

    dom.saveWorld.addEventListener('click', saveWorld);
    dom.loadWorld.addEventListener('click', loadSelectedWorld);
    dom.deleteWorld.addEventListener('click', deleteSelectedWorld);
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

    for (let x = -18; x <= 18; x += 1) {
        for (let z = -18; z <= 18; z += 1) {
            const ridge = Math.sin((x + seedNumber) * 0.28) + Math.cos((z - seedNumber) * 0.24);
            const detail = rand2(x, z, seedNumber) * 2.2;
            const height = Math.max(1, Math.floor(2 + ridge + detail));

            for (let y = 0; y <= height; y += 1) {
                const type = y === height ? 'grass' : y > height - 3 ? 'dirt' : 'stone';
                setBlock(x, y, z, type, false);
            }

            if (height <= 2 && rand2(x + 60, z - 44, seedNumber) > 0.72) {
                setBlock(x, height + 1, z, 'sand', false);
            }

            if (height <= 1 && rand2(x - 20, z + 12, seedNumber) > 0.76) {
                setBlock(x, height + 1, z, 'water', false);
            }

            if (height >= 3 && rand2(x + 12, z - 19, seedNumber) > 0.985) {
                addTree(x, height + 1, z);
            }
        }
    }

    camera.position.set(8, 9, 12);
    camera.lookAt(0, 3, 0);
    rebuildMeshes();
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

    if (!controls.isLocked && event.pointerType !== 'touch') {
        controls.lock();
        return;
    }

    const hit = getHit();
    if (!hit) {
        return;
    }

    if (event.shiftKey || pressed.has('AltLeft') || pressed.has('AltRight')) {
        removeBlock(hit.key);
        return;
    }

    const [x, y, z] = parseKey(hit.key);
    const normal = hit.face.normal;
    const nx = x + Math.round(normal.x);
    const ny = y + Math.round(normal.y);
    const nz = z + Math.round(normal.z);

    if (!blocks.has(keyOf(nx, ny, nz))) {
        setBlock(nx, ny, nz, selectedType);
    }
}

function onPointerDown(event) {
    if (event.pointerType === 'touch') {
        lastTouch = { x: event.clientX, y: event.clientY };
        dom.canvas.setPointerCapture(event.pointerId);
    }
}

function onPointerMove(event) {
    if (event.pointerType !== 'touch' || !lastTouch) {
        return;
    }

    const dx = event.clientX - lastTouch.x;
    const dy = event.clientY - lastTouch.y;
    lastTouch = { x: event.clientX, y: event.clientY };
    camera.rotation.order = 'YXZ';
    camera.rotation.y -= dx * 0.004;
    camera.rotation.x -= dy * 0.004;
    camera.rotation.x = Math.max(-Math.PI / 2 + 0.04, Math.min(Math.PI / 2 - 0.04, camera.rotation.x));
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
        const hit = getHit();
        if (hit) {
            removeBlock(hit.key);
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    updateMovement(delta);
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
    showStatus('World saved in this browser.');
}

async function loadSelectedWorld() {
    const id = dom.worldSelect.value;
    if (!id) {
        showStatus('Choose a saved world first.', true);
        return;
    }

    const world = readStoredWorlds().find((item) => item.id === id);
    if (!world) {
        showStatus('Saved world was not found in this browser.', true);
        await loadWorldList();
        return;
    }

    importWorld(world);
    showStatus('World loaded from this browser.');
}

async function deleteSelectedWorld() {
    const id = dom.worldSelect.value;
    if (!id) {
        showStatus('Choose a saved world first.', true);
        return;
    }

    const nextWorlds = readStoredWorlds().filter((world) => world.id !== id);
    localStorage.setItem('khalidcraft.worlds', JSON.stringify(nextWorlds));

    if (currentWorldId === id) {
        currentWorldId = null;
    }

    await loadWorldList();
    showStatus('World deleted from this browser.');
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
