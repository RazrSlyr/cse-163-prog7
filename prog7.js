async function drawMap() {

    // set width and height
    let w = 1000;
    let h = 500;
    // grab geodata
    let data = await d3.json("./counties_data.json");

    // only include illinois data (state =  21)
    // also get rid of anything that isn't a county
    for (let i = data.features.length - 1; i >= 0; i--) {
        let county = data.features[i];
        if (county.properties.LSAD != "County" || county.properties.STATE != 17) {
            delete data.features[i];
        }
    }

    // make svg
    let svg = d3.select("#svg")
        .attr("width", w)
        .attr("height", h);

    // define projection
    let projection = d3.geoAlbersUsa()
        .translate([w / 2 - (600 / 1000 * w), h / 2 + (100 / 500 * h)])
        .scale([w * 4.5]);

    // define path
    let path = d3.geoPath().projection(projection);

    // read population density data
    let density_data = await d3.csv("./pop-dense.csv", (d) => {
        return {
            density: +d["Density per square mile of land area"],
            id: d["GCT_STUB.target-geo-id"],
            id2: d["GCT_STUB.target-geo-id2"]
        }
    });

    let densities = [];
    // loop through density info and only keep the ones we care about
    for (let i = density_data.length - 1; i >= 0; i--) {
        let d = density_data[i];
        // loop through all counties in data
        for (let j in data.features) {
            let id = data.features[j].properties.GEO_ID;
            if (id == d.id) {
                data.features[j].properties.density = d.density;
                // This will be useful for unemployment later
                data.features[j].properties.id2 = +d.id2;
                densities.push(d.density);
                break;
            }
        }
    }

    // definining color range
    let color_density = d3.scaleQuantize()
        .range(["#edf8fb",
            "#b2e2e2",
            "#66c2a4",
            "#2ca25f",
            "#006d2c"]);
    // establishing domain of color scale
    // the values are logged so that way the color change represents exponential growth
    // this is because the dense counties are MUCH more dense than the other ones, 
    // so if we did this linearly almost all the counties would be the light color
    color_density.domain([
        Math.log(d3.min(densities)),
        Math.log(d3.max(densities))
    ]);

    // Show density or unemployment (true -> density)
    let show_density = true;

    // read unemployement data
    let unemployment = await d3.tsv("unemployment.tsv", (d) => {
        return {
            id: +d.id,
            rate: +d.rate,
        }
    });

    let rates = []

    // loop through unemployment info and only keep the ones we care about
    for (let i = unemployment.length - 1; i >= 0; i--) {
        let d = unemployment[i];
        // loop through all counties in data
        for (let j in data.features) {
            let id = data.features[j].properties.id2;
            if (id == d.id) {
                data.features[j].properties.rate = d.rate;
                rates.push(d.rate);
                break;
            }
        }
    }

    // definining color range for unemployment
    let color_unemployment = d3.scaleQuantize()
        .range(["#fef0d9",
            "#fdcc8a",
            "#fc8d59",
            "#e34a33",
            "#b30000"]);
    // establishing domain of color scale
    // the values are logged so that way the color change represents exponential growth
    // this is to be consistent with the pop density
    color_unemployment.domain([
        Math.log(d3.min(rates)),
        Math.log(d3.max(rates))
    ]);



    function fill_map(d) {
        // Use density color scheme if needed
        if (show_density) {
            // does density data exist?
            if (d && d.properties.density) {
                return color_density(Math.log(d.properties.density));
            }
            // otherwise, return lightgrey
            return "lightgrey";
        }
        // otherwise use unemployment color scheme
        // does data exist?
        if (d && d.properties.rate) {
            return color_unemployment(Math.log(d.properties.rate));
        }
        // otherwise, return lightgrey

    }

    // define tooltips (mostly just code from my asgn 5)
    function makeTooltip(e, message) {

        // add tooltip
        let x = e.clientX;
        let y = e.clientY - 50;
        // add tooltip container
        d3.select("svg")
            .append("rect")
            .attr("class", "tooltip " + message.name.split(" ").join("").split(".").join(""))
            .attr("x", x)
            .attr("y", y)
            .attr("width", 200)
            .attr("height", 100)
            .attr("fill-opacity", 0)
            .attr("stroke-opacity", 0)
            .transition()
            .duration(500)
            .attr("stroke-opacity", 1)
            .attr("fill-opacity", 1);

        // add tooltip text
        // Referenced this for multi-line text in SVG:
        // https://stackoverflow.com/questions/31469134/how-to-display-multiple-lines-of-text-in-svg
        let text = d3.select("svg")
            .append("text");

        text.attr("class", "tooltip message " + message.name.split(" ").join("").split(".").join(""))
            .attr("x", x)
            .attr("y", y)
            .attr("dy", 20)
            .attr("dx", 15)

            .attr("fill-opacity", 0)
            .transition()
            .duration(500)
            .attr("fill-opacity", 1);


        text.append("tspan")
            .text(message.name);

        text.append("tspan")
            .attr("x", x)
            .attr("dy", 25)
            .attr("dx", 15)
            .text("Pop. Density:");

        text.append("tspan")
            .attr("x", x)
            .attr("dy", 15)
            .attr("dx", 15)
            .text(() => {
                if (message.density != null) {
                    return "" + message.density + " people per sq. mile";
                }
                return "NOT AVAILABLE";
            });

        text.append("tspan")
            .attr("x", x)
            .attr("dy", 25)
            .attr("dx", 15)
            .text(() => {
                if (message.rate != null) {
                    return "Unemployment:\t" + (Math.floor(message.rate * 10000) / 100) + "%";
                } else {
                    "Unemployment:\t NOT AVAILABLE";
                }
            });
    }

    function deleteTooltip(e, name) {

        d3.selectAll("." + name.split(" ").join("").split(".").join(""))
            .transition()
            .duration(500)
            .attr("fill-opacity", 0)
            .attr("stroke-opacity", 0);

        // Schedule timer to delete div later
        let timer = d3.timer((elapsed) => {
            // after 500 miliseconds, delete element
            // and stop timer
            if (elapsed >= 500) {
                d3.selectAll("." + name.split(" ").join(""))
                    .remove();
                timer.stop();
            }
        });
    }


    // draw map
    svg.append("g")
        .selectAll("path")
        .data(data.features)
        .enter()
        .append("path")
        .attr("class", "boundary")
        .attr("d", path)
        .style("fill", fill_map)
        .on("mouseover", (e, d) => {
            // let message = {
            //     name: `${d.properties["NAME"]} County`,
            //     density: d.properties.density,
            //     rate: d.properties.rate

            // }
            let message = {
                name: `NOT AVAILABLE`,
                density: null,
                rate: null

            }
            if (d) {
                message.name = `${d.properties["NAME"]} County`;
                if (d.properties.density) {
                    message.density = d.properties.density;
                }
                if (d.properties.rate) {
                    message.rate = d.properties.rate;
                }
            }
            makeTooltip(e, message);
        })
        .on("mouseout", (e, d) => {
            deleteTooltip(e, `${d.properties["NAME"]} County`);
        })
        .style("stroke", "black")
        .style("stroke-width", 0.5)

    // drawing legend
    // borrowed mostly from here: https://bl.ocks.org/mbostock/5562380
    // making this a function to easily swap between unemployment and pop density
    function drawLegend(color, metric, name) {

        // creating legend
        var g = svg.append("g")
            .attr("id", "key")
            .attr("transform", "translate(50,40)");


        // calculating legend domain
        var x = d3.scaleSqrt()
            .domain([d3.min(metric), d3.max(metric)])
            .rangeRound([400, 800]);

        // drawing rects
        g.selectAll("rect")
            // looping through each color and selecting the bounds
            .data(color.range().map(function (d) {
                d = color.invertExtent(d);
                d[0] = Math.pow(Math.E, d[0]);
                d[1] = Math.pow(Math.E, d[1]);


                if (d[0] == null) d[0] = x.domain()[0];
                if (d[1] == null) d[1] = x.domain()[1];
                return d;
            })) // drawing rectangle for each bounds
            .enter().append("rect")
            .style("stroke", "black")
            .style("stroke-width", "0.5")
            .attr("height", 8)
            .attr("x", function (d) { return x(d[0]); })
            .attr("width", function (d) { return x(d[1]) - x(d[0]); })
            .attr("fill", function (d) {
                return color(Math.log(d[0]));
            });

        // add labels and ticks to legend
        g.append("text")
            .attr("class", "caption")
            .attr("x", x.range()[0])
            .attr("y", -6)
            .attr("fill", "#000")
            .attr("text-anchor", "start")
            .attr("font-weight", "bold")
            .text(name);

        // make first tick
        let first = Math.pow(Math.E, color.invertExtent(color.range()[0])[0]);
        let tickVals = [first];

        // add rest of ticks by looping through different color options
        for (let i = 0; i < color.range().length; i++) {
            let d = color.range()[i];
            console.log(color.invertExtent(d));
            tickVals.push(Math.pow(Math.E, color.invertExtent(d)[1]))
        }
        g.call(d3.axisBottom(x)
            .tickSize(13)
            .tickValues(tickVals))
            .select(".domain")
            .remove();

    }

    drawLegend(color_density, densities, "Population Density by Square Mile");



    // set boudndary toggle to be on by default
    d3.select("#lines").property("checked", true);
    // make button toggle
    function toggleBounds(e) {
        let show = d3.select("#lines").property("checked");
        if (show) {
            // Show boundary
            d3.selectAll(".boundary")
                .style("stroke-width", 0.5);
        } else {
            // Hide boundary
            d3.selectAll(".boundary")
                .style("stroke-width", 0);
        }
    }
    // add toggle function to button
    d3.select("#lines").on("click", toggleBounds);

    // define toggle between different metrics
    function changeMetric(e) {
        let target = d3.select(e.target);
        show_density = !show_density;
        // change map colors
        svg.selectAll(".boundary").style("fill", fill_map);
        // update legend and button text
        d3.select("#key").remove();
        if (show_density) {
            drawLegend(color_density, densities, "Population Density by Square Mile");
            target.text("Show Unemployment");
        } else {
            drawLegend(color_unemployment, rates, "Unemployment Rate");
            target.text("Show Population Density");
        }
    }
    // make button perform this toggle
    d3.select("#change").on("click", changeMetric);
}

drawMap();