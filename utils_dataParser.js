/**
 * This is called on each record. 
 * converts A3B_tI8_139_ad_b into [3,1] 
 * converts ""A_hP3_191_ad"" into [1,0] or [0,1] depending on species_list
 * @param {String} record_prototype_label : A3B_tI8_139_ad_b
 * @returns {Array} stoich_reduced_list : [3,1]
 */
function GetStoichReducedListFromPrototype(record_prototype_label, record_species_list, species_list) {
    const stoich_reduced_formula = record_prototype_label.split("_")[0];
    const stoich_reduced_list = [];
    let stoich_reduced_curr = null;

    for (let char of stoich_reduced_formula) 
    {
        if (/[a-zA-Z]/.test(char)) 
        {
            if (stoich_reduced_curr !== null) 
            {
                if (stoich_reduced_curr === 0) stoich_reduced_curr = 1;
                stoich_reduced_list.push(stoich_reduced_curr);
            }
            stoich_reduced_curr = 0;
        } 
        else if (/[0-9]/.test(char)) 
        {
            stoich_reduced_curr *= 10;
            stoich_reduced_curr += parseInt(char, 10);
        } 
        else {throw new Error("Unexpected character in prototype label");}
    }

    if (stoich_reduced_curr === 0) stoich_reduced_curr = 1;
    stoich_reduced_list.push(stoich_reduced_curr);
    
    const stoich_reduced_list_full = new Array(species_list.length).fill(0);
    for (let j = 0; j < record_species_list.length; j++) 
    {
        const curr_spec = record_species_list[j];
        const idx = species_list.indexOf(curr_spec);
        if (idx == -1) {continue;}// if it's a mono-species record then just fill it 0
        stoich_reduced_list_full[idx] = stoich_reduced_list[j];
    };

    return stoich_reduced_list_full

}

/**
Each record looks like this:
{
    "prototype-label": {"source-value": "AB3_hP8_194_c_h"},
    "stoichiometric-species": {"source-value": ["Al","Ti"]},
    "binding-potential-energy-per-formula": {"source-value": -19.14408}
}

 * @param {Array} records 
 */
function FindMonoSpeciesMinEnergyIdx(records,species_list)
{
    // minimum energy of mono-species system
    const monospecies_min_energies = new Array(species_list.length).fill(Infinity);
    const monospecies_min_energy_idx = new Array(species_list.length).fill(-1);

    for (let i = 0; i < records.length; i++) 
    {
        const record = records[i];
        const species = record["stoichiometric-species"]["source-value"];
        if (species.length == 1)
        {
            const energy = record["binding-potential-energy-per-formula"]["source-value"];
            const element = species[0];
            const idx = species_list.indexOf(element)
            if(idx == -1 || energy > monospecies_min_energies[idx]) {continue;}
            monospecies_min_energies[idx] = energy;
            monospecies_min_energy_idx[idx] = i
        }
    }

    if (monospecies_min_energy_idx.some(idx => idx === -1)) {
        throw new Error("Could not identify both elemental reference states.");
    }

    return [monospecies_min_energies, monospecies_min_energy_idx]
}