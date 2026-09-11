async function OnFirstLoad()
{
    GetAllUrlParams();
    await DoGiantApiQuery(__g_urlParams["model"]);
    // PopulateSpeciesDropdown(); 
    // ToggleDimension(__g_urlParams['species'].length); 
    // RunPlot();
    GenerateBestHull(__g_urlParams['model'])
}

/**
 * Does an API query. Can be reused for N-ary phase-diagrams
 * @param {Array} species_list 
 * @param {String} model 
 * @returns {Object} {hull_points, prototype_labels, monospecies_min_energy_idx, records_length}
 */
async function GetFormationEnergies(species_list, model = null) {
    console.log("GetFormationEnergyies",species_list);
    if (species_list.length != new Set(species_list).size){
        throw new Error(`Choose ${species_list.length} different elements`);
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
    // const records = await DoApiQueryFormationEnergy(species_list, model);
    const species_set = new Set(species_list)
    let records = []
    if (model != null && model.length > 0)
    {
        records = __g_data['tr-formation-energies'].filter((e) => {
            const record_species_set = new Set(e['stoichiometric-species']['source-value'])
            return record_species_set.isSubsetOf(species_set);
        });       
    }
    else 
    {
        records = __g_data['rd-formation-energies'].filter((e) => {
            const record_species_set = new Set(e['stoichiometric-species']['source-value'])
            return record_species_set.isSubsetOf(species_set);
        });
    }

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

    const clean_points = [];
    const clean_labels = [];
    for (let i = 0; i < hull_points.length; i++) {
        if (!hull_points[i]) continue;
        clean_points.push(hull_points[i]);
        clean_labels.push(prototype_labels[i]);
    }

    const records_length = records.length;
    return { hull_points:clean_points, prototype_labels:clean_labels, monospecies_min_energy_idx, records_length };
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

__g_htmlElements["plot_button"].addEventListener("click", RunPlot);
// __g_htmlElements["clear_model_button"].addEventListener("click", () => {
    // __g_htmlElements["model_textbox"].value = "";
    // SetStatusMessage("Model field cleared.", "");
// });




// RunPlot() clears the current plot, toggle the visiblity of the <div>container, and then execute RunPlotND() 
function RunPlot()
{
    console.log("RunPlot");
    
    // Display 2D plot
    if(__g_htmlElements["species_dropdown_3"].disabled)
    {
        // hide 3D plot
        __g_htmlElements["plot_container_3D"].style.display = "none";
        // __g_htmlElements["label_layer"].style.display = "none";
        // __g_htmlElements["tooltip_3D"].style.display = "none";
        // __g_htmlElements["top_view_button"].style.display = "none";

        // show 2D plot
        __g_htmlElements["plot_container_2D"].style.display = "";
        // __g_htmlElements["svg"].style.display = "";
        // __g_htmlElements["tooltip_2D"].style.display = "";

        // run 2D plot
        RunPlot2D();
    }
    
    // Display 3D plot
    else if(!__g_htmlElements["species_dropdown_3"].disabled)
    {

        // show 3D plot
        __g_htmlElements["plot_container_3D"].style.display = "";
        // __g_htmlElements["label_layer"].style.display = "";
        // __g_htmlElements["tooltip_3D"].style.display = "";
        // __g_htmlElements["top_view_button"].style.display = "";

        // hide 2D plot
        __g_htmlElements["plot_container_2D"].style.display = "none";
        // __g_htmlElements["svg"].style.display = "none";
        // __g_htmlElements["tooltip_2D"].style.display = "none";

        // run 3D plot
        RunPlot3D();
    }

    // Display 4D plot
    else if(!__g_htmlElements["species_dropdown_3"].disabled)
    {

        // show 3D plot
        __g_htmlElements["plot_container"].style.display = "none";
        // __g_htmlElements["label_layer"].style.display = "none";
        // __g_htmlElements["tooltip3D"].style.display = "none";
        // __g_htmlElements["top_view_button"].style.display = "none";

        // hide 2D plot
        __g_htmlElements["plot_container_2D"].style.display = "none";
        // __g_htmlElements["svg"].style.display = "none";
        // __g_htmlElements["tooltip_2D"].style.display = "none";

        // run 4D plot
        // RunPlot4D();
    }

}

async function RenderThumbnail (model,species_list) {
    // Set model
    document.getElementById("model").value = model;
    const dimension = species_list.length;

    // Set species
    document.getElementById("species1").value = species_list[0] ?? "";
    document.getElementById("species2").value = species_list[1] ?? "";
    document.getElementById("species3").value = species_list[2] ?? "";

    // Select dimension
    const radio = document.querySelector(
        `input[name="toggle-dimension"][value="${dimension}"]`
    );

    if (radio) {
        radio.checked = true;
    }

    ToggleDimension(dimension);

    // Render
    if (dimension === 2) {
        await RunPlot2D();
    } else if (dimension === 3) {
        await RunPlot3D();

        // Optional:
        ShowTopView();
    }
};

function GetCombinations(array, k) {
    const result = [];

    function recurse(start, current) {
        if (current.length === k) {
            result.push([...current]);
            return;
        }

        for (let i = start; i < array.length; i++) {
            current.push(array[i]);
            recurse(i + 1, current);
            current.pop();
        }
    }

    recurse(0, []);

    return result;
}

async function FindBestCombination(model){
    const supported_species = __g_data['model-supported-species']

    let best_combination = [];
    if (supported_species.length == 2) {best_combination = supported_species}
    if (supported_species.length == 3) {best_combination = supported_species}
    if (supported_species.length > 3)
    {
        const combinations = GetCombinations(supported_species,3);
        for (const c of combinations)
        {
            const gf = await GetFormationEnergies(c,model);
            // console.log(c,gf)
            if (gf.hull_points.length > best_combination.length){best_combination = c}
        }
    }
    return best_combination;
}

async function ExportPlotAsPNG(filename = "phase-diagram.png",plotType = "auto") {
    let container;

    if (plotType === "2d") {
        container = document.getElementById("plotContainer2D");
    }
    else if (plotType === "3d") {
        container = document.getElementById("plotContainer3D");
    }
    else {
        /*
         * Automatically determine which plot is visible.
         */
        const plot2D = document.getElementById("plotContainer2D");
        const plot3D = document.getElementById("plotContainer3D");

        const visible = element => {
            if (!element) return false;

            const style =
                window.getComputedStyle(element);

            return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                element.offsetWidth > 0 &&
                element.offsetHeight > 0
            );
        };

        if (visible(plot3D)) {
            container = plot3D;
        }
        else if (visible(plot2D)) {
            container = plot2D;
        }
    }

    if (!container) {
        throw new Error(
            "Could not find a visible plot container."
        );
    }

    /*
     * Make sure the browser has finished rendering
     * before taking the snapshot.
     */
    await new Promise(resolve => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });

    const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",

        /*
         * Increase this for higher-resolution thumbnails.
         */
        scale: 2,

        /*
         * Capture the complete container.
         */
        width: container.clientWidth,
        height: container.clientHeight,

        /*
         * Avoid capturing anything outside the plot.
         */
        x: 0,
        y: 0,

        logging: false
    });

    /*
     * Convert canvas → PNG.
     */
    const dataURL =
        canvas.toDataURL("image/png");

    /*
     * Trigger browser download.
     */
    const link =
        document.createElement("a");

    link.download = filename;
    link.href = dataURL;

    document.body.appendChild(link);
    link.click();
    link.remove();

    return dataURL;
}

async function GenerateAndExportThumbnail(model) {

    const species_list = await GenerateBestHull(model);
    const dimension = species_list.length
    /*
     * ------------------------------------------------------------
     * 6. Export rendered plot
     * ------------------------------------------------------------
     */
    const plotType = dimension === 2 ? "2d" : "3d";

    const filename = model + '_'+species_list.join('-');
    const dataURL = await ExportPlotAsPNG(filename,plotType);

    return {
        model,
        species_list,
        dimension,
        dataURL
    };
}


async function GenerateBestHull(model){
    console.log("GenerateBestHull:", model);

    /*
     * ------------------------------------------------------------
     * 1. Determine which species the model supports
     * ------------------------------------------------------------
     */
    const supported_species = __g_data['model-supported-species'];

    if (supported_species.length < 2) {
        throw new Error(`Model must support at least 2 species. Found: ${supported_species.join(", ")}`);
    }

    /*
     * ------------------------------------------------------------
     * 2. Determine the species combination to plot
     * ------------------------------------------------------------
     */
    const species_list = await FindBestCombination(model);

    if (species_list.length < 2) {throw new Error(`Could not find a suitable species combination for model: ${model}`);}

    __g_urlParams['species'] = species_list;
    PopulateSpeciesDropdown(); 
    ToggleDimension(__g_urlParams['species'].length); 


    console.log("Selected species:", species_list);

    /*
     * ------------------------------------------------------------
     * 3. Populate the UI
     * ------------------------------------------------------------
     */
    // document.getElementById("model").value = model;
    document.getElementById("species1").value = species_list[0] ?? "";
    document.getElementById("species2").value = species_list[1] ?? "";
    document.getElementById("species3").value = species_list[2] ?? "";

    /*
     * ------------------------------------------------------------
     * 5. Render the plot
     * ------------------------------------------------------------
     */
    RunPlot();

}