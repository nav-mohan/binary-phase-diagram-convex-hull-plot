function PopulateSpeciesDropdown() {
    for (const el of ELEMENTS) {
        __g_htmlElements["species_dropdown_1"].append(new Option(el, el));
        __g_htmlElements["species_dropdown_2"].append(new Option(el, el));
        __g_htmlElements["species_dropdown_3"].append(new Option(el, el));
        __g_htmlElements["species_dropdown_4"].append(new Option(el, el));
    }
    // Set default values upon initialization
    __g_htmlElements["species_dropdown_1"].value = "Al";
    __g_htmlElements["species_dropdown_2"].value = "Ni";
    __g_htmlElements["species_dropdown_3"].value = "Ti";
    __g_htmlElements["species_dropdown_4"].disabled = true;
    __g_htmlElements["model_textbox"].value = "EAM_Dynamo_ZhouJohnsonWadley_2004_CuAgAuNiPdPtAlPbFeMoTaWMgCoTiZr__MO_870117231765_001";
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
    if(dimension == 2)
    {
        __g_htmlElements["species_dropdown_1"].disabled=false;
        __g_htmlElements["species_dropdown_2"].disabled=false;
        __g_htmlElements["species_dropdown_3"].disabled=true;
        __g_htmlElements["species_dropdown_4"].disabled=true;
    }

    if(dimension == 3)
    {
        __g_htmlElements["species_dropdown_1"].disabled=false;
        __g_htmlElements["species_dropdown_2"].disabled=false;
        __g_htmlElements["species_dropdown_3"].disabled=false;
        __g_htmlElements["species_dropdown_4"].disabled=true;
    }

    if(dimension == 4)
    {
        __g_htmlElements["species_dropdown_1"].disabled=false;
        __g_htmlElements["species_dropdown_2"].disabled=false;
        __g_htmlElements["species_dropdown_3"].disabled=false;
        __g_htmlElements["species_dropdown_4"].disabled=false;
    }
}


