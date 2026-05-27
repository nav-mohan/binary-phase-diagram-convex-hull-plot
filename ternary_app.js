import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

const plot = __g_htmlElements["plot_container_3D"];
const labelLayer = __g_htmlElements["label_layer"];
const tooltip = __g_htmlElements["tooltip_3D"];

const SIDE = 10;
const TRI_H = Math.sqrt(3) * SIDE / 2;
const ENERGY_SCALE = 4.0;
const EPS = 1e-9;

const VA = new THREE.Vector3(-SIDE / 2, -TRI_H / 3, 0);
const VB = new THREE.Vector3( SIDE / 2, -TRI_H / 3, 0);
const VC = new THREE.Vector3(0, 2 * TRI_H / 3, 0);

let species = ["Al", "Ni", "Ti"];
let dataGroup = null;
let raycastMarkers = [];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
plot.prepend(renderer.domElement);

const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 200);
camera.position.set(12, -14, 12);
camera.lookAt(0, 0, -1);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, -1.0);
controls.addEventListener("change", () => {
    positionVertexLabels();
    renderer.render(scene, camera);
});

const staticGroup = new THREE.Group();
scene.add(staticGroup);

function ternaryToBase(xA, xB, xC, z = 0) {
    return new THREE.Vector3(
        xA * VA.x + xB * VB.x + xC * VC.x,
        xA * VA.y + xB * VB.y + xC * VC.y,
        z
    );
}

function phasePointToWorld(point) {
    const [xB, xC, hf] = point;
    const xA = 1 - xB - xC;
    return ternaryToBase(xA, xB, xC, ENERGY_SCALE * hf);
}

function addLine(group, vertices, material) {
    const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
    group.add(new THREE.Line(geometry, material));
}

function buildBaseTriangle() {
    const border = new THREE.LineBasicMaterial({ color: 0x111827 });
    const grid = new THREE.LineBasicMaterial({ color: 0xd1d5db, transparent: true, opacity: 0.9 });

    addLine(staticGroup, [VA, VB, VC, VA], border);

    for (let i = 1; i < 10; i++) {
        const f = i / 10;
        // constant A, B, and C composition lines.
        addLine(staticGroup, [ternaryToBase(f, 1-f, 0), ternaryToBase(f, 0, 1-f)], grid);
        addLine(staticGroup, [ternaryToBase(1-f, f, 0), ternaryToBase(0, f, 1-f)], grid);
        addLine(staticGroup, [ternaryToBase(1-f, 0, f), ternaryToBase(0, 1-f, f)], grid);
    }

    const planeShape = new THREE.Shape();
    planeShape.moveTo(VA.x, VA.y);
    planeShape.lineTo(VB.x, VB.y);
    planeShape.lineTo(VC.x, VC.y);
    planeShape.closePath();
    const background = new THREE.Mesh(
        new THREE.ShapeGeometry(planeShape),
        new THREE.MeshBasicMaterial({
            color: 0xf8fafc, transparent: true, opacity: 0.18,
            side: THREE.DoubleSide, depthWrite: false
        })
    );
    background.renderOrder = -1;
    staticGroup.add(background);
}

const labelEls = [];
function addVertexLabel(text, position) {
    const el = document.createElement("div");
    el.className = "vertex-label";
    el.textContent = text;
    labelLayer.appendChild(el);
    labelEls.push({ el, position });
}

function updateLabels() {
    labelLayer.innerHTML = "";
    labelEls.length = 0;
    addVertexLabel(`${species[0]} (100%)`, VA.clone().add(new THREE.Vector3(-0.62, -0.35, 0)));
    addVertexLabel(`${species[1]} (100%)`, VB.clone().add(new THREE.Vector3(0.62, -0.35, 0)));
    addVertexLabel(`${species[2]} (100%)`, VC.clone().add(new THREE.Vector3(0, 0.48, 0)));
    positionVertexLabels();
}

function positionVertexLabels() {
    const width = plot.clientWidth;
    const height = plot.clientHeight;
    for (const { el, position } of labelEls) {
        const projected = position.clone().project(camera);
        el.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
        el.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    }
}

function pointKey(v) {
    return `${v.x.toPrecision(13)}|${v.y.toPrecision(13)}|${v.z.toPrecision(13)}`;
}

function nearestOriginalIndex(vertex, worldPoints) {
    let best = -1;
    let bestDist = Infinity;
    worldPoints.forEach((p, i) => {
        const d = vertex.distanceToSquared(p);
        if (d < bestDist) { best = i; bestDist = d; }
    });
    return best;
}

/**
 * Construct full 3-D hull from [xB, xC, Hf] and keep only outward facets
 * whose normal has negative energy component: the thermodynamic lower hull.
 */
function getLowerHullSurface(dataset) {
    const worldPoints = dataset.hull_points.map(phasePointToWorld);
    if (worldPoints.length < 4) {
        throw new Error("At least four non-coplanar energy/composition points are required.");
    }

    let convex;
    try {
        convex = new ConvexGeometry(worldPoints);
    } catch (err) {
        throw new Error("The returned points do not form a 3-D hull (they may be coplanar).");
    }

    const attr = convex.getAttribute("position");
    const positions = [];
    const stableIndices = new Set();

    for (let i = 0; i < attr.count; i += 3) {
        const p0 = new THREE.Vector3().fromBufferAttribute(attr, i);
        const p1 = new THREE.Vector3().fromBufferAttribute(attr, i + 1);
        const p2 = new THREE.Vector3().fromBufferAttribute(attr, i + 2);

        const normal = new THREE.Vector3()
            .subVectors(p1, p0)
            .cross(new THREE.Vector3().subVectors(p2, p0))
            .normalize();

        // Negative z means the facet faces toward decreasing formation energy.
        if (normal.z < -EPS) {
            positions.push(...p0.toArray(), ...p1.toArray(), ...p2.toArray());
            stableIndices.add(nearestOriginalIndex(p0, worldPoints));
            stableIndices.add(nearestOriginalIndex(p1, worldPoints));
            stableIndices.add(nearestOriginalIndex(p2, worldPoints));
        }
    }

    const lowerGeometry = new THREE.BufferGeometry();
    lowerGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    lowerGeometry.computeVertexNormals();

    return { geometry: lowerGeometry, stableIndices, worldPoints };
}

function makeMarker(point, dataset, index, color, isStable, sourceName) {
    const radius = isStable ? 0.13 : 0.075;
    const marker = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 12, 10),
        new THREE.MeshBasicMaterial({
            color: isStable ? 0x2563eb : color,
            transparent: !isStable,
            opacity: isStable ? 1 : 0.75,
            depthTest: false
        })
    );
    marker.position.copy(point);
    marker.renderOrder = isStable ? 5 : 4;

    const [xB, xC, hf] = dataset.hull_points[index];
    marker.userData = {
        sourceName,
        label: dataset.prototype_labels[index],
        fractions: [1 - xB - xC, xB, xC],
        hf
    };
    raycastMarkers.push(marker);
    return marker;
}

function addDatasetLayer(group, dataset, style) {
    const surface = getLowerHullSurface(dataset);
    if (surface.geometry.getAttribute("position").count === 0) {
        throw new Error(`No lower hull facets found for ${style.name}.`);
    }

    const mesh = new THREE.Mesh(
        surface.geometry,
        new THREE.MeshBasicMaterial({
            color: style.color,
            transparent: true,
            opacity: style.opacity,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    group.add(mesh);

    const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(surface.geometry),
        new THREE.LineBasicMaterial({ color: style.edgeColor, transparent: true, opacity: 0.9 })
    );
    group.add(edges);

    surface.worldPoints.forEach((point, index) => {
        group.add(makeMarker(point, dataset, index, style.edgeColor,
            surface.stableIndices.has(index), style.name));
    });

    return surface.stableIndices.size;
}

function clearDataLayer() {
    if (!dataGroup) return;
    scene.remove(dataGroup);
    dataGroup.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose();
    });
    dataGroup = null;
    raycastMarkers = [];
}

function drawDatasets(rd, mo) {
    clearDataLayer();
    dataGroup = new THREE.Group();
    scene.add(dataGroup);

    const rdStableCount = addDatasetLayer(dataGroup, rd, {
        name: "Reference", color: 0xe879f9, edgeColor: 0xc026d3, opacity: 0.27
    });

    let modelStableCount = null;
    if (mo) {
        modelStableCount = addDatasetLayer(dataGroup, mo, {
            name: "Model", color: 0x64748b, edgeColor: 0x111827, opacity: 0.20
        });
    }

    renderer.render(scene, camera);
    return { rdStableCount, modelStableCount };
}

async function RunPlot3D() {
    console.log("RunPlot3D")
    species = [
        __g_htmlElements["species_dropdown_1"].value,
        __g_htmlElements["species_dropdown_2"].value,
        __g_htmlElements["species_dropdown_3"].value
    ];
    const model = __g_htmlElements["model_textbox"].value.trim();

    __g_htmlElements["plot_button"].disabled = true;
    SetStatusMessage("Loading OpenKIM data and constructing ternary lower hull…", "loading");
    SetMetaInfo([]);

    try {
        const rd = await GetFormationEnergies(species, null);
        let mo = null;
        if (model) mo = await GetFormationEnergies(species, model);

        updateLabels();
        const counts = drawDatasets(rd, mo);
        const lines = [
            `<strong>System:</strong> <code>${species.join("-")}</code>`,
            `<strong>Reference structures:</strong> ${rd.records_length}`,
            `<strong>Reference stable vertices:</strong> ${counts.rdStableCount}`
        ];
        if (mo) {
            lines.push(`<strong>Model structures:</strong> ${mo.records_length}`);
            lines.push(`<strong>Model stable vertices:</strong> ${counts.modelStableCount}`);
            lines.push(`<strong>Model:</strong> <code>${model}</code>`);
        }
        SetMetaInfo(lines);
        SetStatusMessage("Ternary hull updated.", "ok");
    } catch (err) {
        console.error(err);
        clearDataLayer();
        SetStatusMessage(err.message || "Unable to construct ternary hull.", "error");
    } finally {
        __g_htmlElements["plot_button"].disabled = false;
    }
}

function ShowTopView() {
    camera.position.set(0, 0, 18);
    camera.up.set(0, 1, 0);
    controls.target.set(0, 0, 0);
    camera.lookAt(controls.target);
    controls.update();
}

function ShowEnergyView() {
    camera.position.set(12, -14, 12);
    camera.up.set(0, 1, 0);
    controls.target.set(0, 0, -1.0);
    camera.lookAt(controls.target);
    controls.update();
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener("pointermove", event => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObjects(raycastMarkers, false)[0];

    if (!hit) {
        tooltip.style.opacity = 0;
        return;
    }

    const d = hit.object.userData;
    tooltip.innerHTML = `<strong>${d.sourceName}: ${d.label}</strong><br>` +
        `${species[0]}: ${(100*d.fractions[0]).toFixed(2)}% &nbsp; ` +
        `${species[1]}: ${(100*d.fractions[1]).toFixed(2)}% &nbsp; ` +
        `${species[2]}: ${(100*d.fractions[2]).toFixed(2)}%<br>` +
        `H<sub>f</sub>: ${d.hf.toFixed(6)} eV/atom`;
    tooltip.style.left = `${event.clientX - rect.left + 10}px`;
    tooltip.style.top = `${event.clientY - rect.top - 10}px`;
    tooltip.style.opacity = 1;
});
renderer.domElement.addEventListener("pointerleave", () => tooltip.style.opacity = 0);

function resize() {
    const width = plot.clientWidth;
    const height = plot.clientHeight;
    renderer.setSize(width, height);
    const viewHeight = 14;
    const aspect = width / height;
    camera.left = -viewHeight * aspect / 2;
    camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    positionVertexLabels();
    renderer.render(scene, camera);
}

buildBaseTriangle();
PopulateSpeciesDropdown();
updateLabels();
ShowEnergyView();
__g_htmlElements["top_view_button"].addEventListener("click", ShowTopView);
__g_htmlElements["surface_view_button"].addEventListener("click", ShowEnergyView);
new ResizeObserver(resize).observe(plot);

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
resize();
animate();
