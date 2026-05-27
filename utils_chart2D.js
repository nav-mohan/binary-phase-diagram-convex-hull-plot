
function ShowTooltip2D(event, html) {
    __g_htmlElements["tooltip_2D"]
        .style("opacity", 1)
        .html(html)
        .style("left", `${event.offsetX + 12}px`)
        .style("top", `${event.offsetY - 12}px`);
}

function MoveTooltip2D(event) {
    __g_htmlElements["tooltip_2D"]
        .style("left", `${event.offsetX + 12}px`)
        .style("top", `${event.offsetY - 12}px`);
}

function HideTooltip2D() {
    __g_htmlElements["tooltip_2D"].style("opacity", 0);
}

function MakePointTooltip2D(d) {
    return `
    <div><strong>${d.label}</strong></div>
    <div>x = ${d.pt[0].toFixed(4)}</div>
    <div>H<sub>f</sub> = ${d.pt[1].toFixed(6)} eV/atom</div>
    `;
}

function DrawPlot2D(species, model, rd, mo = null) {
    __g_htmlElements["svg"].selectAll("*").remove();

    const width = 900;
    const height = 680;
    const margin = { top: 70, right: 40, bottom: 70, left: 90 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = __g_htmlElements["svg"].append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const allhull_points = mo ? [...rd.hull_points, ...mo.hull_points] : [...rd.hull_points];
    const ymin = d3.min(allhull_points, d => d[1]);
    const ymax = d3.max(allhull_points, d => d[1]);

    const x = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);
    const y = d3.scaleLinear().domain([1.2 * ymin, 1.2*ymax]).range([innerHeight, 0]);

    g.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x));

    g.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(y));

    g.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 50)
        .attr("text-anchor", "middle")
        .text(`Mole fraction of ${species[1]}`);

    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -60)
        .attr("text-anchor", "middle")
        .text("H_f (eV/atom)");

    __g_htmlElements["svg"].append("text")
        .attr("x", width / 2)
        .attr("y", 28)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "700")
        .text(model ? model : `Reference data: ${species.join("-")}`);

    const line = d3.line()
        .x(d => x(d[0]))
        .y(d => y(d[1]));

    g.append("path")
        .datum(rd.lowerHull)
        .attr("class", "hull-rd")
        .attr("d", line);

    g.selectAll(".pt-rd")
        .data(rd.hull_points.map((pt, i) => ({ pt, label: rd.prototype_labels[i] })))
        .enter()
        .append("path")
        .attr("class", "pt-rd")
        .attr("transform", d => `translate(${x(d.pt[0])},${y(d.pt[1])})`)
        .attr("d", d3.symbol().type(d3.symbolCross).size(52))
        .on("mouseover", (event, d) => ShowTooltip2D(event, MakePointTooltip2D(d)))
        .on("mousemove", MoveTooltip2D)
        .on("mouseout", HideTooltip2D);

    let modelStableCorrect = [];
    let modelStableIncorrect = [];

    if (mo) {
        g.append("path")
            .datum(mo.lowerHull)
            .attr("class", "hull-model")
            .attr("d", line);

        g.selectAll(".pt-model")
            .data(mo.hull_points.map((pt, i) => ({ pt, label: mo.prototype_labels[i] })))
            .enter()
            .append("path")
            .attr("class", "pt-model")
            .attr("transform", d => `translate(${x(d.pt[0])},${y(d.pt[1])})`)
            .attr("d", d3.symbol().type(d3.symbolCross).size(52))
            .on("mouseover", (event, d) => ShowTooltip2D(event, MakePointTooltip2D(d)))
            .on("mousemove", MoveTooltip2D)
            .on("mouseout", HideTooltip2D);

        const rdHullProtos = PrototypeLabelsForPolygonPoints(rd.hull_points, rd.prototype_labels, rd.lowerHull);

        //  flag model's convex-hull-points as "correct" or "incorrect"
        //  if a prototype belongs in the model's lower-convex-hull i.e the model predicts this prototype to be stable 
        //      if the prototype also belongs in the RD's lower-convex-hull i.e the RD also predicts this prototype to be stable
        //          then the model has correctly predicted this prototype to be stable (i.e IP and RD agree)
        for (const pt of mo.lowerHull) {
            let matchedLabel = null;
            for (let i = 0; i < mo.hull_points.length; i++) {
                if (SamePoint(mo.hull_points[i], pt)) {
                    matchedLabel = mo.prototype_labels[i];
                    break;
                }
            }
            if (matchedLabel && rdHullProtos.has(matchedLabel)) {
                modelStableCorrect.push(pt);
            } else {
                modelStableIncorrect.push(pt);
            }
        }

        g.selectAll(".stable-correct")
            .data(modelStableCorrect)
            .enter()
            .append("circle")
            .attr("class", "stable-correct")
            .attr("cx", d => x(d[0]))
            .attr("cy", d => y(d[1]))
            .attr("r", 5);

        g.selectAll(".stable-incorrect")
            .data(modelStableIncorrect)
            .enter()
            .append("circle")
            .attr("class", "stable-incorrect")
            .attr("cx", d => x(d[0]))
            .attr("cy", d => y(d[1]))
            .attr("r", 5);
    }

    const legend_box = __g_htmlElements["svg"].append("g")
        .attr("transform", `translate(${10},${height - 10})`);

    const legend_items = mo ? [
        { label: "IP calculations", shape: "cross", cls: "pt-model" },
        { label: "DFT calculations", shape: "cross", cls: "pt-rd" },
        { label: "Prototype agrees", shape: "circle", cls: "stable-correct" },
        { label: "Prototype disagrees", shape: "circle", cls: "stable-incorrect" }
    ] : [
        { label: "Reference calculations", shape: "cross", cls: "pt-rd" }
    ];


    legend_items.forEach((legend_item, i) => {
        const row = legend_box.append("g").attr("transform", `translate(0,${i * 22})`);
        if (legend_item.shape === "cross") {
            row.append("path")
                .attr("class", legend_item.cls)
                .attr("transform", "translate(8,8)")
                .attr("d", d3.symbol().type(d3.symbolCross).size(52));
        } else {
            row.append("circle")
                .attr("class", legend_item.cls)
                .attr("cx", 8)
                .attr("cy", 8)
                .attr("r", 5);
        }
        row.append("text")
            .attr("x", 22)
            .attr("y", 12)
            .text(legend_item.label);
    });
}

async function RunPlot2D() {
    console.log("RunPlot2D");
    const species = [
        __g_htmlElements["species_dropdown_1"].value, 
        __g_htmlElements["species_dropdown_2"].value,
    ];
    const model = __g_htmlElements["model_textbox"].value.trim();

    console.log("MODEL:", model)

    __g_htmlElements["plot_button"].disabled = true;
    SetStatusMessage("Loading data from OpenKIM and building hulls…", "loading");
    SetMetaInfo([]);

    try {
        const rd = await GetFormationEnergies(species, null);
        rd.lowerHull = GetLowerHull2D(rd.hull_points, rd.monospecies_min_energy_idx);

        let mo = null;
        if (model) {
            mo = await GetFormationEnergies(species, model);
            mo.lowerHull = GetLowerHull2D(mo.hull_points, mo.monospecies_min_energy_idx);
        }

        DrawPlot2D(species, model, rd, mo);

        const metaLines =
            [
                `<strong>System:</strong> <code>${species.join("-")}</code>`,
                `<strong>Reference structures:</strong> ${rd.records_length}`,
                `<strong>Reference lower-hull vertices:</strong> ${rd.lowerHull.length}`
            ];

        if (mo) {
            metaLines.push(`<strong>Model structures:</strong> ${mo.records_length}`);
            metaLines.push(`<strong>Model lower-hull vertices:</strong> ${mo.lowerHull.length}`);
            metaLines.push(`<strong>Model:</strong> <code>${model}</code>`);
        }

        SetMetaInfo(metaLines);
        SetStatusMessage("Plot updated.", "ok");
    }
    catch (err) {
        console.error(err);
        SetStatusMessage(err.message || "Something went wrong.", "error");
        __g_htmlElements["svg"].selectAll("*").remove();
    }
    finally {
        __g_htmlElements["plot_button"].disabled = false;
    }
}
