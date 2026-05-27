let __g_controls_initialized = false;
let __g_active_dimension = 3;
let __g_loading = false;

function PopulateSpeciesDropdown() {
    if (__g_controls_initialized) return;

    for (const el of ELEMENTS) {
        __g_htmlElements["species_dropdown_1"].append(new Option(el, el));
        __g_htmlElements["species_dropdown_2"].append(new Option(el, el));
        __g_htmlElements["species_dropdown_3"].append(new Option(el, el));
        __g_htmlElements["species_dropdown_4"].append(new Option(el, el));
    }
    // Set default values upon initialization
    __g_htmlElements["species_dropdown_1"].value = "Na";
    __g_htmlElements["species_dropdown_2"].value = "Cl";
    __g_htmlElements["species_dropdown_3"].value = "O";
    __g_htmlElements["model_textbox"].value =
        "Sim_LAMMPS_ReaxFF_BrugnoliMiyataniAkaji_SiCeNaClHO_2023__SM_282799919035_000"

    __g_controls_initialized = true;
}

function SetStatusMessage(message, kind = "") {
    __g_htmlElements["status_textbox"].textContent = message;
    __g_htmlElements["status_textbox"].className = `status ${kind}`.trim();
}

function SetMetaInfo(lines = []) {
    __g_htmlElements["meta_textbox"].innerHTML = "";
    for (const line of lines) {
        const div = document.createElement("div");
        div.innerHTML = line;
        __g_htmlElements["meta_textbox"].appendChild(div);
    }
}


function ToggleDimension(dimension)
{
    if (__g_loading) return;

    __g_active_dimension = Number(dimension);

    const is2D = __g_active_dimension === 2;
    const is3D = __g_active_dimension === 3;

    __g_htmlElements["species_dropdown_1"].disabled = false;
    __g_htmlElements["species_dropdown_2"].disabled = false;
    __g_htmlElements["species_dropdown_3"].disabled = is2D;
    __g_htmlElements["species_dropdown_4"].disabled = true;

    __g_htmlElements["plot_container_2D"].style.display = is2D ? "" : "none";
    __g_htmlElements["plot_container_3D"].style.display = is3D ? "" : "none";
    __g_htmlElements["top_view_button"].style.display = is3D ? "" : "none";
    __g_htmlElements["surface_view_button"].style.display = is3D ? "" : "none";

    if (!is2D && !is3D) {
        SetStatusMessage("A quaternary plot view has not been implemented.", "error");
    }

    if (is3D && typeof window.resizeTernaryPlot === "function") {
        requestAnimationFrame(() => window.resizeTernaryPlot());
    }
}

function SetControlsLoading(loading) {
    __g_loading = loading;
    __g_htmlElements["plot_button"].disabled = loading;
    __g_htmlElements["model_textbox"].disabled = loading;

    document.querySelectorAll('input[name="toggle-dimension"]').forEach((radio) => {
        radio.disabled = loading || radio.value === "4";
    });

    if (loading) {
        __g_htmlElements["species_dropdown_1"].disabled = true;
        __g_htmlElements["species_dropdown_2"].disabled = true;
        __g_htmlElements["species_dropdown_3"].disabled = true;
        __g_htmlElements["species_dropdown_4"].disabled = true;
    } else {
        ToggleDimension(__g_active_dimension);
    }
}
