/**
 * 
 * @param {Array} species_list 
 * @param {String} model 
 * @returns {Object} query 
 */
function PrepareQuery(species_list, model)
{
    let query = { ...__g_query_template };
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