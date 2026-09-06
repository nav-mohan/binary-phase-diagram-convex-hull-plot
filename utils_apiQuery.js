function GetAllUrlParams() 
{
    // FIRST, RESET ALL THE MEMBERS OF THE GLOBAL VARIABLE __g_urlParams
    __g_urlParams["model"] = "";
    __g_urlParams["species"] = [];

    // NEXT, BEGIN PARSING THROUGH THE URL AND COLLECT THE QUERY-PARAMETERS
    const urlObj = new URL(window.location);
    let result = {};
    urlObj.searchParams.forEach((value, key) => 
    {
        const decodedValue = decodeURIComponent(value);
        try 
        {
            result[key] = JSON.parse(decodedValue);
        } 
        catch (e) 
        {
            result[key] = decodedValue;
        }
    });
    
    // FINALLY, SET THE VALUES FOR THE GLOBAL VARIABLE __g_urlParams
    __g_urlParams["model"] = result["model"];
    __g_urlParams["species"] = result["species"].toSorted();
}

// when the Species dropdown is toggled, change the __g_urlParams["species"]
function SetAllUrlParams() {
    const s1 = __g_htmlElements["species_dropdown_1"].value;
    const s2 = __g_htmlElements["species_dropdown_2"].value;
    const s3 = __g_htmlElements["species_dropdown_3"].value;

    // Build the species array according to the active dimension
    const species = [s1, s2];
    if (__g_active_dimension === 3 && s3) {species.push(s3);}

    // 1. Update global state object
    __g_urlParams["species"] = species.toSorted();

    // 2. Update browser address bar without reloading the page
    const url = new URL(window.location);
    url.searchParams.set("species", JSON.stringify(__g_urlParams["species"]));

    window.history.replaceState({}, "", url);
}
/**
 * 
 * @param {Array} species_list 
 * @param {String} model 
 * @returns {Object} query 
 */
function PrepareQuery(species_list, model)
{
    const query = structuredClone(__g_query_template);
    query["stoichiometric-species.source-value"]["$not"]["$elemMatch"]["$nin"] = (species_list);
    if (model === null || model === "") {
        query["meta.type"] = "rd"
        delete query["meta.subject.extended-id"]
    } 
    else {
        query["meta.type"] = "tr"
        query["meta.subject.extended-id"] = model
    }

    return query;
}


async function DoApiQueryFormationEnergy(species_list, model)
{
    const query = JSON.stringify( PrepareQuery(species_list,model))
    const fields = JSON.stringify( __g_fields)

    const response = await fetch(__g_apiBaseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
        query,
        fields,
        database: "data"
    })
    });

    if (!response.ok) {
        throw new Error(`OpenKIM query failed with status ${response.status}`);
    }

    const result = await response.json();
    console.log(result)

    if (!Array.isArray(result) || result.length === 0) {
        throw new Error("No matching structures were returned from OpenKIM.");
    }

    return result;
}