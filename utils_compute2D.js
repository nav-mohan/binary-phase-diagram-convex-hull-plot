/**
 * for compound A_x.B_y evaluate E_A*x + E_B*y 
 * where E_A is minimum-energy of monospecies A system among all records
 * where x is the number of atoms of A in one mole of the compound
 * where E_B is minimum-energy of monospecies B system among all records
 * where y is the number of atoms of B in one mole of the compound
 * @param {Array} monospecies_min_energies : array of len(species_list). [4.123, 3.125]
 * @param {*} stoich_list : array of len(species_list) [3,1]
 * @returns {Float}
 */
function ComputeBaselineEnergy(monospecies_min_energies, stoich_list)
{
    let baseline_energy = 0;
    for (let j = 0; j < monospecies_min_energies.length; j++) {
        baseline_energy += monospecies_min_energies[j] * stoich_list[j];
    }
    return baseline_energy;
}
/**
 * checks whether 2 points are equal (within some tolerance)
 * @param {Array} p 
 * @param {Array} q 
 * @param {Float} tol 
 * @returns {Boolean}
 */
function SamePoint(p, q, tol = 1e-12) {
    return Math.abs(p[0] - q[0]) < tol && Math.abs(p[1] - q[1]) < tol;
}


/**
 * 
 * @param {Array} hull_polygon an array of coords. each coord is an array [mole_fraction, formation_energy]
 * @param {Array} target_point the mono-species coordinate we're looking for
 * @param {Float} tol 
 * @returns {Integer} the index i where hull_polygon[i] = target 
 */
function FindHullVertexPosition(hull_polygon, target_point, tol = 1e-12)
{
    console.log("hull_polygon", hull_polygon)
    for (let i = 0; i < hull_polygon.length; i++)
    {
        // console.log(`comparing ${i} , ${target_point} , ${hull_polygon[i]}`)
        if (SamePoint(hull_polygon[i], target_point, tol))
        {
            // console.log(`hull vertex position = ${i} , ${target_point} , ${hull_polygon.length}`)
            return i;
        }
    }
    return -1;
}

/**
 * 
 * @param {Array} hull_polygon 
 * @param {Array} start_pos 
 * @param {Array} end_pos 
 * @param {Integer} direction : +1 for clockwise, -1 for counter-clockwise
 * @returns {Array} array of coordinates of the circular-path
 */
function CircularPathByPosition(hull_polygon, start_pos, end_pos, direction = +1) {
    const n = hull_polygon.length;
    let pos = start_pos;
    const circular_path = [hull_polygon[pos]];
    while (pos !== end_pos) 
    {
        pos = (pos + direction + n) % n;
        circular_path.push(hull_polygon[pos]);
    }
    console.log("CIRCULAR-PATH",direction,circular_path)
    return circular_path;
}




function PathMeanEnergyFromPolygon(path) {
    return d3.mean(path, pt => pt[1]);
}

function GetLowerHull2D(hull_points, monospecies_min_energy_idx) {
    const hull_polygon = d3.polygonHull(hull_points);
    if (!hull_polygon) {
        throw new Error("Convex hull could not be constructed.");
    }

    const startPt = hull_points[monospecies_min_energy_idx[0]];
    const endPt = hull_points[monospecies_min_energy_idx[1]];

    const startPos = FindHullVertexPosition(hull_polygon, startPt);
    const endPos = FindHullVertexPosition(hull_polygon, endPt);

    if (startPos === -1 || endPos === -1) {
        throw new Error("Could not find elemental endpoints on the hull polygon.");
    }

    const path_CW = CircularPathByPosition(hull_polygon, startPos, endPos, +1);
    const path_CCW = CircularPathByPosition(hull_polygon, startPos, endPos, -1);

    const energy_CW = PathMeanEnergyFromPolygon(path_CW);
    const energy_CCW = PathMeanEnergyFromPolygon(path_CCW);
    if (energy_CW < energy_CCW) {return path_CW};
    return path_CCW; 
}
