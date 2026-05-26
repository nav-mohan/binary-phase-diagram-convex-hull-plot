/**
 * Does an API query. Can be reused for N-ary phase-diagrams
 * @param {Array} species_list 
 * @param {String} model 
 * @returns {Object} {hull_points, prototype_labels, monospecies_min_energy_idx, records_length}
 */
async function GetFormationEnergies(species_list, model = null) {
    if (species_list[0] === species_list[1]) {
        throw new Error("Choose two different elements.");
    }

    /** 
     * each record from the API request looks like this 
    {
        "prototype-label": {
            "source-value": "AB_tP2_123_a_d"
        },
        "stoichiometric-species": {
            "source-value": ["Al","Ti"]
        },
        "binding-potential-energy-per-formula": {
            "source-value": -8.734203757787018
        }
    }
    */
    const records = await DoApiQueryFormationEnergy(species_list, model);

    // find the record corresponding to minimum energy of mono-species system
    const [monospecies_min_energies, monospecies_min_energy_idx] = FindMonoSpeciesMinEnergyIdx(records, species_list);

    const prototype_labels = []; // gather all prototype-labels
    const hull_points = new Array(records.length);
    for (let i = 0; i < records.length; i++) {
        const record_species_list = records[i]["stoichiometric-species"]["source-value"];
        const record_energy = records[i]["binding-potential-energy-per-formula"]["source-value"];
        const record_prototype_label = records[i]["prototype-label"]["source-value"];
        prototype_labels.push(record_prototype_label);

        const stoich_list = GetStoichReducedListFromPrototype(record_prototype_label, record_species_list, species_list);
        const num_atoms = stoich_list.reduce((a, b) => a + b, 0);

        // formation-energy-per-atom
        const baseline_energy = ComputeBaselineEnergy(monospecies_min_energies, stoich_list)
        const formation_energy_per_atom = (record_energy - baseline_energy) / num_atoms;

        // mole-fraction of the second element
        const stoich_list_normalized = stoich_list.map(n => n / num_atoms);
        const mole_fraction = stoich_list_normalized.slice(1); // array.slice(1) removes the zeroth element

        // each hull_point is [mole_fraction,formation_energy_per_atom]
        hull_points[i] = [...mole_fraction, formation_energy_per_atom];
    };

    const records_length = records.length;
    return { hull_points, prototype_labels, monospecies_min_energy_idx, records_length };
}

/**
 * Returns prototype-label for each convex-hull-point
 * I think this can be reused for N-ary phase-diagrams
 * @param {Array} records_points : array of coordinates for all points
 * @param {Array} records_prototype_labels : array of prototype-labels for all points
 * @param {Array} polygon_points : array of coordinates of convex-hull points
 * @param {Float} tol 
 * @returns {Array} array of strings. prototype-labels of polygon-points.
 */
function PrototypeLabelsForPolygonPoints(records_points, records_prototype_labels, polygon_points, tol = 1e-12) {
    const point_labels = new Set();
    for (const poly_point of polygon_points) {
        for (let i = 0; i < records_points.length; i++) {
            if (SamePoint(records_points[i], poly_point, tol)) {
                point_labels.add(records_prototype_labels[i]);
            }
        }
    }
    return point_labels;
}

__g_htmlElements["plot_button"].addEventListener("click", RunPlot2D);
__g_htmlElements["clear_model_button"].addEventListener("click", () => {
    __g_htmlElements["model_textbox"].value = "";
    SetStatusMessage("Model field cleared.", "");
});

PopulateSpeciesDropdown();
RunPlot2D();