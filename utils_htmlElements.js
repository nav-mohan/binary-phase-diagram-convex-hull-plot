let __g_controls_initialized = false;
let __g_active_dimension = 3;
let __g_loading = false;

function PopulateSpeciesDropdown() {
    if (__g_controls_initialized) return;

    for (const el of ELEMENTS) {
        __g_htmlElements["species_dropdown_1"].append(new Option(el, el));
        __g_htmlElements["species_dropdown_2"].append(new Option(el, el));
        __g_htmlElements["species_dropdown_3"].append(new Option(el, el));
    }
    // Set default values if species param is missing or empty
    if (!__g_urlParams["species"] || !Array.isArray(__g_urlParams["species"]) || __g_urlParams["species"].length === 0) {
        __g_urlParams["species"] = __g_default_species; 
    }

    if (__g_urlParams['species'][0]) {
        __g_htmlElements["species_dropdown_1"].value = __g_urlParams['species'][0];
    }
    if (__g_urlParams['species'][1]) {
        __g_htmlElements["species_dropdown_2"].value = __g_urlParams['species'][1];
    }
    if (__g_urlParams['species'].length > 2 && __g_urlParams['species'][2]) {
        __g_htmlElements["species_dropdown_3"].value = __g_urlParams['species'][2];
    }

    __g_htmlElements["species_dropdown_1"].addEventListener("change", SetAllUrlParams);
    __g_htmlElements["species_dropdown_2"].addEventListener("change", SetAllUrlParams);
    __g_htmlElements["species_dropdown_3"].addEventListener("change", SetAllUrlParams);

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

function UpdatePopup(event, title, href, citation, description)
{
    __g_htmlElements['popup_title'].innerText = title;
    __g_htmlElements['popup_citation'].innerText = citation;
    __g_htmlElements['popup_citation'].href = "https://openkim.org/prototype-hub/"+href;
    __g_htmlElements['popup_description'].innerText = description;

    __g_htmlElements["popup_screen"].style.display = "block";
}

__g_htmlElements["popup_close"].addEventListener('click',(e)=>{
    __g_htmlElements['popup_screen'].style.display = 'none';
})
// Close popup when clicking anywhere on the backdrop outside #popup
__g_htmlElements['popup_screen'].addEventListener('click', (e) => {
    if (e.target === __g_htmlElements["popup_screen"]) {
            __g_htmlElements["popup_screen"].style.display = "none";
};});

function ToggleDimension(dimension)
{
    if (__g_loading) return;

    __g_active_dimension = Number(dimension);

    // Sync species URL parameter and __g_urlParams based on new dimension
    SetAllUrlParams();

    // Sync the radio button state with the selected dimension
    const radio = document.querySelector(`input[name="toggle-dimension"][value="${__g_active_dimension}"]`);
    if (radio) {radio.checked = true;}

    const is2D = __g_active_dimension === 2;
    const is3D = __g_active_dimension === 3;

    __g_htmlElements["species_dropdown_1"].disabled = false;
    __g_htmlElements["species_dropdown_2"].disabled = false;
    __g_htmlElements["species_dropdown_3"].disabled = is2D;

    __g_htmlElements["plot_section_2D"].hidden = !is2D;
    __g_htmlElements["plot_section_3D"].hidden = !is3D;
    
    __g_htmlElements["top_view_button"].style.visibility = is3D ? "visible" : "hidden";
    __g_htmlElements["top_view_button"].style.display = "block";

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
    // __g_htmlElements["model_textbox"].disabled = loading;

    document.querySelectorAll('input[name="toggle-dimension"]').forEach((radio) => {
        radio.disabled = loading || radio.value === "4";
    });

    if (loading) {
        __g_htmlElements["species_dropdown_1"].disabled = true;
        __g_htmlElements["species_dropdown_2"].disabled = true;
        __g_htmlElements["species_dropdown_3"].disabled = true;
    } else {
        ToggleDimension(__g_active_dimension);
    }
}
