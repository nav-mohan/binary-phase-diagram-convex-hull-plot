const ELEMENTS = [
    "H","He","Li","Be","B","C","N","O","F","Ne",
    "Na","Mg","Al","Si","P","S","Cl","Ar","K","Ca",
    "Sc","Ti","V","Cr","Mn","Fe","Co","Ni","Cu","Zn",
    "Ga","Ge","As","Se","Br","Kr","Rb","Sr","Y","Zr",
    "Nb","Mo","Tc","Ru","Rh","Pd","Ag","Cd","In","Sn",
    "Sb","Te","I","Xe","Cs","Ba","La","Ce","Pr","Nd",
    "Pm","Sm","Eu","Gd","Tb","Dy","Ho","Er","Tm","Yb",
    "Lu","Hf","Ta","W","Re","Os","Ir","Pt","Au","Hg",
    "Tl","Pb","Bi","Po","At","Rn"
];

const __g_apiBaseUrl = "https://query.openkim.org/api";

const __g_htmlElements = {
    "species_dropdown_1": document.getElementById("species1"),
    "species_dropdown_2": document.getElementById("species2"),
    "species_dropdown_3": document.getElementById("species3"),
    "species_dropdown_4": document.getElementById("species4"),
    "model_textbox": document.getElementById("model"),
    "plot_button": document.getElementById("plotBtn"),
    "clear_model_button": document.getElementById("clearModelBtn"),
    "status_textbox": document.getElementById("status"),
    "meta_textbox": document.getElementById("meta"),

    // 2D plot 
    "plot_container_2D" : document.getElementById("plotContainer2D"),
    "svg" : d3.select("#plot2D"),
    "tooltip_2D": d3.select("#tooltip2D"),

    // 3D plot 
    "plot_container_3D": document.getElementById("plotContainer3D"),
    "label_layer": document.getElementById("labelLayer"),
    "tooltip_3D": document.getElementById("tooltip3D"),
    "top_view_button": document.getElementById("topViewBtn"),
    "surface_view_button": document.getElementById("surfaceViewBtn"),
};

const __g_query_template = {
    "meta.type":"XX", // tr OR rd. if no model then rd. else tr
    "meta.subject.extended-id":"XXX_XXXXX_XXXX", // remove this if no model requested
    "property-id":"tag:staff@noreply.openkim.org,2023-02-21:property/binding-energy-crystal",
    "stoichiometric-species.source-value":{
        "$not":{"$elemMatch":{"$nin":["XX","YY"]}} // an array of species ["Ti","Al"]
    }
};

const __g_fields = {
    "prototype-label.source-value":1,
    "stoichiometric-species.source-value":1,
    "binding-potential-energy-per-formula.source-value":1
}