import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

const SIDE = 10; // side-length of equilateral triangle
const TRI_H = Math.sqrt(3) * SIDE / 2; // height of equilateral triangle
const ENERGY_SCALE = 4.0; // scaling, for visuals

// coordinates of the triangle's 3 vertices (corresponds to mono-species A, mono-species B, mono-species C)
const VA = new THREE.Vector3(-SIDE / 2, -TRI_H / 3, 0);
const VB = new THREE.Vector3( SIDE / 2, -TRI_H / 3, 0);
const VC = new THREE.Vector3(0, 2 * TRI_H / 3, 0);

// let species = ["Al", "Ni", "Ti"];
// let species = ["Na", "Cl", "O"];
let species = []
let dataset_group = null;
let raycast_markers = [];
let raycast_surfaces = [];

const scene = new THREE.Scene();
scene.background = new THREE.Color(new THREE.Color("rgb(255, 255, 255)"));

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
__g_htmlElements["plot_container_3D"].prepend(renderer.domElement);

const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.target.set(0, 0, -1.0);

const highlight_geometry = new THREE.BufferGeometry();
highlight_geometry.setAttribute("position",new THREE.Float32BufferAttribute(new Float32Array(9), 3));
const highlight_material = new THREE.MeshBasicMaterial({color: new THREE.Color("rgb(250, 200, 50)"),transparent: true,opacity: 0.75,side: THREE.DoubleSide,depthTest: false,depthWrite: false});
const face_highlight = new THREE.Mesh(highlight_geometry, highlight_material);
face_highlight.visible = false;
face_highlight.renderOrder = 100; // z-axis
scene.add(face_highlight);

// convert ternary compound [A_l, B_m, C_n] into x,y,z coordinates on the triangle
// h = formation-energy. h = 0 is the base-triangle. 
// l,m,n are molar-fractions. Not integers. l+m+n = 1
function TernaryToBase(l, m, n, h = 0) {
    return new THREE.Vector3(
        l * VA.x + m * VB.x + n * VC.x,
        l * VA.y + m * VB.y + n * VC.y,
        h
    );
}

function PhasePointToWorld(point) {
    const [xB, xC, hf] = point;
    return TernaryToBase(1 - xB - xC, xB, xC, ENERGY_SCALE * hf);
}

function AddLine(group, vertices, material) {
    const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
    group.add(new THREE.Line(geometry, material));
}

const base_triangle_group = new THREE.Group(); // a group containing the triangle and the grid-lines
scene.add(base_triangle_group);
function BuildBaseTriangle() {
    const border = new THREE.LineBasicMaterial({ color: new THREE.Color("rgb(0, 0, 0)") });
    const grid = new THREE.LineBasicMaterial({ color: new THREE.Color("rgb(180, 180, 180)"), transparent: true, opacity: 0.9 });

    AddLine(base_triangle_group, [VA, VB, VC, VA], border);

    // draw grid-lines every 10%
    for (let i = 1; i < 10; i++) {
        const f = i / 10;
        AddLine(base_triangle_group, [TernaryToBase(f, 1-f, 0), TernaryToBase(f, 0, 1-f)], grid);
        AddLine(base_triangle_group, [TernaryToBase(1-f, f, 0), TernaryToBase(0, f, 1-f)], grid);
        AddLine(base_triangle_group, [TernaryToBase(1-f, 0, f), TernaryToBase(0, 1-f, f)], grid);
    }

    const plane_shape = new THREE.Shape();
    plane_shape.moveTo(VA.x, VA.y);
    plane_shape.lineTo(VB.x, VB.y);
    plane_shape.lineTo(VC.x, VC.y);
    plane_shape.closePath();

    const background = new THREE.Mesh(
        new THREE.ShapeGeometry(plane_shape),
        new THREE.MeshBasicMaterial({
            color: new THREE.Color("rgb(250, 250, 250)"),
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    background.position.z = 0.002;
    background.renderOrder = -1;
    base_triangle_group.add(background);
}

const triangle_vertex_labels = [];
function AddTriangleVertexLabel(text, position) {
    const el = document.createElement("div");
    el.className = "vertex-label";
    el.textContent = text;
    __g_htmlElements["label_layer"].appendChild(el);
    triangle_vertex_labels.push({ el, position });
}

function PositionTriangleVertexLabels() {
    const width = __g_htmlElements["plot_container_3D"].clientWidth;
    const height = __g_htmlElements["plot_container_3D"].clientHeight;
    if (!width || !height) return;

    for (const { el, position } of triangle_vertex_labels) {
        const projected = position.clone().project(camera);
        el.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
        el.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    }
}

function UpdateTriangleVertexLabels() {
    __g_htmlElements["label_layer"].innerHTML = "";
    triangle_vertex_labels.length = 0;
    AddTriangleVertexLabel(`${species[0]} (100%)`, VA.clone().add(new THREE.Vector3(-0.6, -0.35, 0)));
    AddTriangleVertexLabel(`${species[1]} (100%)`, VB.clone().add(new THREE.Vector3(0.6, -0.35, 0)));
    AddTriangleVertexLabel(`${species[2]} (100%)`, VC.clone().add(new THREE.Vector3(0, 0.5, 0)));
    PositionTriangleVertexLabels();
}

// there could be multiple prototypes with the same elemental-composition i.e same [x,y] position on the Gibbs triangle
// but only the minimum-energy prototype will be part of the convex-hull (thermodynamically relevant)
// filter out the prototypes that are not minimum-energy. this will improve Quickhull performance/accuracy
// also filter out points that are thermodynamically-unstable (i.e hf > 0)
function FilterMinEnergyPrototypeForIdenticalComposition(dataset) {
    const min_energy_points = new Map();

    dataset.hull_points.forEach((point, index) => {
        const [xB, xC, hf] = point;
        if (hf > 0) {return}
        const key = `${xB.toFixed(12)}|${xC.toFixed(12)}`; // use the composition as key in the Map
        const previous = min_energy_points.get(key);

        if (!previous || hf < previous.point[2]) {
            min_energy_points.set(key, { point, index });
        }
    });

    // stores the [x,y] position and index of a point in the original records
    return [...min_energy_points.values()];
}

function NearestWorldPoint(vertex, world_points) {
    let best = -1;
    let bestDist = Infinity;
    world_points.forEach((p, i) => {
        const d = vertex.distanceToSquared(p);
        if (d < bestDist) {
            best = i;
            bestDist = d;
        }
    });
    return best;
}

function GetLowerHullSurface(dataset) {
    const min_energy_points = FilterMinEnergyPrototypeForIdenticalComposition(dataset);
    const world_points = min_energy_points.map(item => PhasePointToWorld(item.point));

    if (world_points.length < 4) {
        throw new Error("3D Convex Hull requires at least 4 independent composition-energy points.");
    }

    let convex;
    try {
        convex = new ConvexGeometry(world_points);
    } catch (error) {
        throw new Error("Ternary hull construction failed. \nThe minimum-energy points may be coplanar or degenerate.");
    }

// NOTE: ConvexGeometry returns an array where every consecutive group of three vertices represents one triangular face
// NOTE: ConvexGeometry returns all faces - top faces, side faces, bottom faces. we need to filter out the faces with normals pointing out 
    const convex_positions_attr = convex.getAttribute("position");
    const positions = [];
    const stable_records_idx = new Set();
    const face_records_idx = [];

    for (let i = 0; i < convex_positions_attr.count; i += 3) { // iterate in steps of 3. 
        const p0 = new THREE.Vector3().fromBufferAttribute(convex_positions_attr, i);
        const p1 = new THREE.Vector3().fromBufferAttribute(convex_positions_attr, i + 1);
        const p2 = new THREE.Vector3().fromBufferAttribute(convex_positions_attr, i + 2);
        const normal = new THREE.Vector3()
            .subVectors(p1, p0)
            .cross(new THREE.Vector3().subVectors(p2, p0))
            .normalize();
        
        // filter for lower convex hull, i.e faces with normals pointing down
        if (normal.z < 0) {
            positions.push(...p0.toArray(), ...p1.toArray(), ...p2.toArray());

            const lower_world_points = [
                NearestWorldPoint(p0, world_points),
                NearestWorldPoint(p1, world_points),
                NearestWorldPoint(p2, world_points)
            ];
            const lower_original_idx = lower_world_points.map(composition => min_energy_points[composition].index);
            face_records_idx.push(lower_original_idx);
            lower_original_idx.forEach(index => stable_records_idx.add(index));
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    return {
        geometry,
        stable_records_idx,
        face_records_idx,
        candidateCount: min_energy_points.length
    };
}

function CreateMarker(point, dataset, index, style, is_stable, shared_geometry, shared_materials) {
    const marker = new THREE.Mesh(
        shared_geometry,
        is_stable ? shared_materials.stable : shared_materials.regular
    );
    marker.scale.setScalar(is_stable ? 1.6 : 1);
    marker.position.copy(point);
    marker.renderOrder = is_stable ? 12 : 11;

    const [xB, xC, hf] = dataset.hull_points[index];
    marker.userData = {sourceName: style.name,label: dataset.prototype_labels[index],fractions: [1 - xB - xC, xB, xC],hf};
    raycast_markers.push(marker);
    return marker;
}

function AddDatasetLayer(group, dataset, style) {
    const surface = GetLowerHullSurface(dataset);
    if (surface.geometry.getAttribute("position").count === 0) {
        throw new Error(`No lower hull facets found for ${style.name}.`);
    }

    const mesh = new THREE.Mesh(
        surface.geometry,
        new THREE.MeshBasicMaterial({color: style.color,transparent: true,opacity: style.opacity,side: THREE.DoubleSide,depthWrite: false,polygonOffset: true,polygonOffsetFactor: 1,polygonOffsetUnits: 1})
    );
    mesh.userData = {sourceName: style.name,dataset,face_records_idx: surface.face_records_idx,highlightColor: style.highlightColor};
    mesh.renderOrder = style.renderOrder;
    raycast_surfaces.push(mesh);
    group.add(mesh);

    const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(surface.geometry),
        new THREE.LineBasicMaterial({ color: style.edgeColor, transparent: true, opacity: 0.9 })
    );
    edges.renderOrder = style.renderOrder + 1;
    group.add(edges);

    const sharedGeometry = new THREE.SphereGeometry(0.075, 10, 8);
    const sharedMaterials = {
        regular: new THREE.MeshBasicMaterial({
            color: style.edgeColor, transparent: true, opacity: 0.6, depthTest: false
        }),
        stable: new THREE.MeshBasicMaterial({
            color: 0x2563eb, depthTest: false
        })
    };

    dataset.hull_points.forEach((point, index) => {
        group.add(CreateMarker(
            PhasePointToWorld(point),
            dataset,
            index,
            style,
            surface.stable_records_idx.has(index),
            sharedGeometry,
            sharedMaterials
        ));
    });

    return {
        stableCount: surface.stable_records_idx.size,
        candidateCount: surface.candidateCount
    };
}

function HideFaceHighlight() {
    face_highlight.visible = false;
}

function ShowFaceHighlight(hit) {
    if (hit.faceIndex == null) {
        HideFaceHighlight();
        return;
    }
    const input = hit.object.geometry.getAttribute("position");
    const output = face_highlight.geometry.getAttribute("position");
    const start = 3 * hit.faceIndex;

    for (let local = 0; local < 3; local++) {
        const v = start + local;
        output.setXYZ(local, input.getX(v), input.getY(v), input.getZ(v));
    }
    output.needsUpdate = true;
    face_highlight.geometry.computeVertexNormals();
    face_highlight.material.color.setHex(hit.object.userData.highlightColor);
    face_highlight.visible = true;
}

function ClearDataLayer() {
    HideFaceHighlight();
    __g_htmlElements["tooltip_3D"].style.opacity = 0;
    raycast_markers = [];
    raycast_surfaces = [];

    if (!dataset_group) return;
    scene.remove(dataset_group);

    const disposed_geometries = new Set();
    const disposed_materials = new Set();
    dataset_group.traverse(object => {
        if (object.geometry && !disposed_geometries.has(object.geometry)) {
            disposed_geometries.add(object.geometry);
            object.geometry.dispose();
        }
        if (object.material && !disposed_materials.has(object.material)) {
            disposed_materials.add(object.material);
            object.material.dispose();
        }
    });
    dataset_group = null;
}

function DrawDatasets(rd, mo) {
    ClearDataLayer();
    dataset_group = new THREE.Group();
    scene.add(dataset_group);

    const rd_statistics = AddDatasetLayer(dataset_group, rd, {
        name: "Reference",
        color: 0xe879f9,
        edgeColor: 0xc026d3,
        highlightColor: 0xf0abfc,
        opacity: 0.3,
        renderOrder: 1
    });

    let model_statistics = null;
    if (mo) {
        model_statistics = AddDatasetLayer(dataset_group, mo, {
            name: "Model",
            color: 0x64748b,
            edgeColor: 0x111827,
            highlightColor: 0xfacc15,
            opacity: 0.20,
            renderOrder: 3
        });
    }
    return { rd_statistics, model_statistics };
}

async function RunPlot3D() {
    species = [
        __g_htmlElements["species_dropdown_1"].value,
        __g_htmlElements["species_dropdown_2"].value,
        __g_htmlElements["species_dropdown_3"].value
    ];
    const model = __g_htmlElements["model_textbox"].value.trim();

    if (new Set(species).size !== 3) {
        SetStatusMessage("Choose three different elements.", "error");
        return;
    }

    SetControlsLoading(true);
    SetStatusMessage("Loading OpenKIM data and constructing ternary lower hull…", "loading");
    SetMetaInfo([]);

    try {
        const rd = await GetFormationEnergies(species, null);
        const mo = model ? await GetFormationEnergies(species, model) : null;

        UpdateTriangleVertexLabels();
        const { rd_statistics, model_statistics } = DrawDatasets(rd, mo);
        const lines = [
            `<strong>System:</strong> <code>${species.join("-")}</code>`,
            `<strong>Reference structures:</strong> ${rd.records_length}`,
            `<strong>Reference unique compositions:</strong> ${rd_statistics.candidateCount}`,
            `<strong>Reference stable vertices:</strong> ${rd_statistics.stableCount}`
        ];
        if (mo) {
            lines.push(`<strong>Model structures:</strong> ${mo.records_length}`);
            lines.push(`<strong>Model unique compositions:</strong> ${model_statistics.candidateCount}`);
            lines.push(`<strong>Model stable vertices:</strong> ${model_statistics.stableCount}`);
            lines.push(`<strong>Model:</strong> <code>${model}</code>`);
        }
        SetMetaInfo(lines);
        SetStatusMessage("Ternary hull updated.", "ok");
    } catch (error) {
        console.error(error);
        ClearDataLayer();
        SetStatusMessage(error.message || "Unable to construct ternary hull.", "error");
    } finally {
        SetControlsLoading(false);
    }
}

function ShowTopView() {
    camera.position.set(0, 0, 18);
    camera.up.set(0, 1, 0);
    controls.target.set(0, 0, 0);
    camera.lookAt(controls.target);
    controls.update();
    PositionTriangleVertexLabels();
}

function ShowEnergyView() {
    camera.position.set(12, -14, 12);
    camera.up.set(0, 1, 0);
    controls.target.set(0, 0, -1);
    camera.lookAt(controls.target);
    controls.update();
    PositionTriangleVertexLabels();
}

function MarkerTooltipHtml(hit) {
    const d = hit.object.userData;
    return `<strong>${d.sourceName}: ${d.label}</strong><br>` +
        `${species[0]}: ${(100*d.fractions[0]).toFixed(2)}% &nbsp; ` +
        `${species[1]}: ${(100*d.fractions[1]).toFixed(2)}% &nbsp; ` +
        `${species[2]}: ${(100*d.fractions[2]).toFixed(2)}%<br>` +
        `H<sub>f</sub>: ${d.hf.toFixed(6)} eV/atom`;
}

function FaceTooltipHtml(hit) {
    const { sourceName, dataset, face_records_idx } = hit.object.userData;
    const indices = face_records_idx[hit.faceIndex] || [];
    const labels = indices.map(index => dataset.prototype_labels[index]).join(" / ");
    return `<strong>${sourceName} lower-hull facet</strong><br>Vertices: ${labels}`;
}

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener("pointermove", event => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const surfaceHit = raycaster.intersectObjects(raycast_surfaces, false)[0];
    const markerHit = raycaster.intersectObjects(raycast_markers, false)[0];
    const useMarker = markerHit && (!surfaceHit || markerHit.distance <= surfaceHit.distance + 0.03);

    if (surfaceHit) {
        ShowFaceHighlight(surfaceHit);
        renderer.domElement.style.cursor = "pointer";
    } else {
        HideFaceHighlight();
        renderer.domElement.style.cursor = "default";
    }

    const tooltipHit = useMarker ? markerHit : surfaceHit;
    if (!tooltipHit) {
        __g_htmlElements["tooltip_3D"].style.opacity = 0;
        return;
    }

    __g_htmlElements["tooltip_3D"].innerHTML = useMarker ? MarkerTooltipHtml(markerHit) : FaceTooltipHtml(surfaceHit);
    __g_htmlElements["tooltip_3D"].style.left = `${event.clientX - rect.left + 10}px`;
    __g_htmlElements["tooltip_3D"].style.top = `${event.clientY - rect.top - 10}px`;
    __g_htmlElements["tooltip_3D"].style.opacity = 1;
});

renderer.domElement.addEventListener("pointerleave", () => {
    HideFaceHighlight();
    renderer.domElement.style.cursor = "default";
    __g_htmlElements["tooltip_3D"].style.opacity = 0;
});

function Resize() {
    const width = __g_htmlElements["plot_container_3D"].clientWidth;
    const height = __g_htmlElements["plot_container_3D"].clientHeight;
    if (!width || !height) return;

    renderer.setSize(width, height, false);
    const viewHeight = 14;
    const aspect = width / height;
    camera.left = -viewHeight * aspect / 2;
    camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    PositionTriangleVertexLabels();
}

function Animate() {
    requestAnimationFrame(Animate);
    if (__g_htmlElements["plot_container_3D"].style.display === "none") return;
    controls.update();
    PositionTriangleVertexLabels();
    renderer.render(scene, camera);
}

BuildBaseTriangle();
UpdateTriangleVertexLabels();
ShowEnergyView();

__g_htmlElements["top_view_button"].addEventListener("click", ShowTopView);
__g_htmlElements["surface_view_button"].addEventListener("click", ShowEnergyView);
new ResizeObserver(Resize).observe(__g_htmlElements["plot_container_3D"]);

window.RunPlot3D = RunPlot3D;
window.resizeTernaryPlot = Resize;

Resize();
Animate();
