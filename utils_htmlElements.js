function PopulateSpeciesDropdown() {
    for (const el of ELEMENTS) {
        __g_htmlElements["species_dropdown_1"].append(new Option(el, el));
        __g_htmlElements["species_dropdown_2"].append(new Option(el, el));
        __g_htmlElements["species_dropdown_3"].append(new Option(el, el));
    }
    // Set default values upon initialization
    __g_htmlElements["species_dropdown_1"].value = "Ti";
    __g_htmlElements["species_dropdown_2"].value = "Al";
    __g_htmlElements["model_textbox"].value = "EAM_Dynamo_ZopeMishin_2003_TiAl__MO_117656786760_006"

    // __g_htmlElements["species_dropdown_3"].disabled = true
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