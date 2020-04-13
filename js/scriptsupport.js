
//test if browser supports webGL

if(Modernizr.webgl) {

	//setup pymjs
	var pymChild = new pym.Child();

	//Load data and config file
	d3.queue()
		.defer(d3.json, "data/config.json")
		.defer(d3.json, "data/communitygroup.json")
		.await(ready);

	function ready (error, config, geog){

	// function ready (error, data, config, geog){

		//Set up global variables
		dvc = config.ons;
		oldlsoa11cd = "";
		firsthover = true;

		lastpoint = null;


		layernames = dvc.layernames;

		layername = dvc.layerstart;

		hoverlayernames = dvc.layernames;
		hoverlayername = dvc.layerstart;

		secondvars = dvc.secondvars;
		secondvar = dvc.secondvars[layernames.indexOf(layername)];

		oldtileset = dvc.tileSet[layernames.indexOf(layername)];

		getindexoflayer = 0;

		// windowheight = window.innerHeight;
		// d3.select("#map").style("height",windowheight + "px")

		//set title of page
		//Need to test that this shows up in GA
		document.title = dvc.maptitle;


		//Set up number formats
		// displayformat = GB.format("$,." + dvc.displaydecimals + "%");
		displayformat = d3.format(",." + dvc.displaydecimals + "f");
		legendformat = d3.format(",.0f");

		//set up basemap
		map = new mapboxgl.Map({
		  container: 'map', // container id
		  style: 'data/style.json', //stylesheet location
			//style: 'https://s3-eu-west-1.amazonaws.com/tiles.os.uk/v2/styles/open-zoomstack-night/style.json',
		  center: [-1.89, 52.9106], // starting position51.5074° N, 0.127850.910637,-1.27441
		  zoom:5.5, // starting zoom
		  minZoom:4,
			maxZoom: 17, //
		  attributionControl: false
		});

		//
		//var U = require('mapbox-gl-utils').init(map);


		// Add zoom and rotation controls to the map.
		map.addControl(new mapboxgl.NavigationControl(), 'bottom-left');

		//add fullscreen option
		map.addControl(new mapboxgl.FullscreenControl(), 'bottom-left');


		// Disable map rotation using right click + drag
		map.dragRotate.disable();

		// Disable map rotation using touch rotation gesture
		map.touchZoomRotate.disableRotation();


		// // Add geolocation controls to the map.
		// map.addControl(new mapboxgl.GeolocateControl({
		// 	positionOptions: {
		// 		enableHighAccuracy: true
		// 	}
		// }));

		//add compact attribution
		map.addControl(new mapboxgl.AttributionControl({
			compact: true
		}));

		addFullscreen();

		if(config.ons.breaks =="jenks") {
			breaks = [];

			ss.ckmeans(values, (dvc.numberBreaks)).map(function(cluster,i) {
				if(i<dvc.numberBreaks-1) {
					breaks.push(cluster[0]);
				} else {
					breaks.push(cluster[0])
					//if the last cluster take the last max value
					breaks.push(cluster[cluster.length-1]);
				}
			});
		}
		else if (config.ons.breaks == "equal") {
			breaks = ss.equalIntervalBreaks(values, dvc.numberBreaks);
		}
		else {breaks = config.ons.breaks[0];};


		//round breaks to specified decimal places
		breaks = breaks.map(function(each_element){
			return Number(each_element.toFixed(dvc.legenddecimals));
		});

		//work out halfway point (for no data position)
		midpoint = breaks[0] + ((breaks[dvc.numberBreaks] - breaks[0])/2)

		//Load colours
		if(typeof dvc.varcolour === 'string') {
			colour = colorbrewer[dvc.varcolour][dvc.numberBreaks];
		} else {
			colour = dvc.varcolour;
		}

		//set up d3 color scales
		color = d3.scaleThreshold()
				.domain(breaks.slice(1))
				.range(colour);

		//now ranges are set we can call draw the key
		//createKey(config);
		//createLegend(config)

		//convert topojson to geojson
		for(key in geog.objects){
			var areas = topojson.feature(geog, geog.objects[key])
		}


		map.on('load', function() {

			map.addSource('areas', {
					type: 'geojson',
					// Point to GeoJSON data. This example visualizes all M1.0+ earthquakes
					// from 12/22/15 to 1/21/16 as logged by USGS' Earthquake hazards program.
					data: areas,
					cluster: true,
					clusterMaxZoom: 14, // Max zoom to cluster points on
					clusterRadius: 50 // Radius of each cluster when clustering points (defaults to 50)
			});


				map.addLayer({
							id: 'clusters',
							type: 'circle',
							source: 'areas',
							filter: ['has', 'point_count'],
							paint: {
							// Use step expressions (https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
							// with three steps to implement three types of circles:
							//   * Blue, 20px circles when point count is less than 100
							//   * Yellow, 30px circles when point count is between 100 and 750
							//   * Pink, 40px circles when point count is greater than or equal to 750
							'circle-color': [
							'step',
							['get', 'point_count'],
							'#f0fc1a',
							100,
							'#f0fc1a',
							750,
							'#f0fc1a'
							],
							'circle-stroke-width': 1,
							'circle-opacity': 0.7,
							'circle-stroke-color': '#666',
							'circle-radius': [
							'step',
							['get', 'point_count'],
							20,
							100,
							30,
							750,
							40
							]
							}
				});

				map.addLayer({
							id: 'cluster-count',
							type: 'symbol',
							source: 'areas',
							filter: ['has', 'point_count'],
							layout: {
							'text-field': '{point_count_abbreviated}',
							'text-font': ['Open Sans', 'Arial Unicode MS Bold'],
							'text-size': 12
							}
							});

				map.addLayer({
							id: 'unclustered-point',
							type: 'circle',
							source: 'areas',
							filter: ['!', ['has', 'point_count']],
							paint: {
							'circle-color': '#fcaa1a',
							'circle-radius': 6,
							'circle-stroke-width': 2,
							'circle-stroke-color': '#666'
							}
				});

				// inspect a cluster on click
				map.on('click', 'clusters', function(e) {
						var features = map.queryRenderedFeatures(e.point, {
						layers: ['clusters']
						});
						var clusterId = features[0].properties.cluster_id;
						map.getSource('areas').getClusterExpansionZoom(
						clusterId,
						function(err, zoom) {
						if (err) return;

						map.easeTo({
						center: features[0].geometry.coordinates,
						zoom: zoom
						});
						}
						);
				});

				map.on('click', 'unclustered-point', function(e) {

						var coordinates = e.features[0].geometry.coordinates.slice();
						var mag = e.features[0].properties.Title;
						var url = e.features[0].properties.URL;


						// Ensure that if the map is zoomed out such that
						// multiple copies of the feature are visible, the
						// popup appears over the copy being pointed to.
						while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
						coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
						}

						new mapboxgl.Popup()
								.setLngLat(coordinates)
								.setHTML("<b>" + mag + '</b><br><a href="' + url +'" target="_blank">' + url + "</a>")
								.addTo(map);
				});

				map.on('mouseenter', 'clusters', function() {
				map.getCanvas().style.cursor = 'pointer';
				});
				map.on('mouseleave', 'clusters', function() {
				map.getCanvas().style.cursor = '';
				});


			//test whether ie or not
			function detectIE() {
			  var ua = window.navigator.userAgent;


			  var msie = ua.indexOf('MSIE ');
			  if (msie > 0) {
				// IE 10 or older => return version number
				return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
			  }

			  var trident = ua.indexOf('Trident/');
			  if (trident > 0) {
				// IE 11 => return version number
				var rv = ua.indexOf('rv:');
				return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
			  }

			  var edge = ua.indexOf('Edge/');
			  if (edge > 0) {
				// Edge (IE 12+) => return version number
				return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
			  }

			  // other browser
			  return false;
			}


			// if(detectIE()){
				//onMove = onMove.debounce(100);
				//onLeave = onLeave.debounce(100);
			// };

			//Highlight stroke on mouseover (and show area information)
			map.on("mousemove", "lsoa-outlines", onMove);
			map.on("mousemove", "lsoa-outlines2", onMove);

			// Reset the lsoa-fills-hover layer's filter when the mouse leaves the layer.
			map.on("mouseleave", "lsoa-outlines", onLeave);
			map.on("mouseleave", "lsoa-outlines2", onLeave);

			map.getCanvasContainer().style.cursor = 'pointer';

			//Add click event
			map.on('click', 'lsoa-outlines', onClick);
			map.on('click', 'lsoa-outlines2', onClick);

			//get location on click
			d3.select(".mapboxgl-ctrl-geolocate").on("click", geolocate);



})

		$(".search-control").click(function() {
			d3.select(".search-control").style("text-transform","uppercase");
			$(".search-control").val('');
		})

		d3.select(".search-control").on("keydown", function() {
    if(d3.event.keyCode === 13){
			event.preventDefault();
			event.stopPropagation();

			myValue=$(".search-control").val();


			getCodes(myValue);
			pymChild.sendHeight();

    }
  })

		$("#submitPost").click(function( event ) {

						event.preventDefault();
						event.stopPropagation();

						myValue=$(".search-control").val();


						getCodes(myValue);
						pymChild.sendHeight();
		});

		function onMove(e) {



				newlsoa11cd = e.features[0].properties.lsoa11cd;
				if(firsthover) {
          // dataLayer.push({
          //     'event': 'mapHoverSelect',
          //     'selected': newlsoa11cd
          // })

            firsthover = false;
        }

				if(newlsoa11cd != oldlsoa11cd) {
					lastpoint = null;

					oldlsoa11cd = e.features[0].properties.lsoa11cd;

					if(map.getZoom() > 9) {
						map.setFilter("lsoa-outlines-hover", ["==", "lsoa11cd", e.features[0].properties.lsoa11cd]);
						var features = map.queryRenderedFeatures(e.point,{layers: ['lsoa-outlines']});


					} else {
						map.setFilter("lsoa-outlines-hover2", ["==", "lsoa11cd", e.features[0].properties.lsoa11cd]);
						var features = map.queryRenderedFeatures(e.point,{layers: ['lsoa-outlines2']});

					}


				 	if(features.length != 0){

						//updatePercent(e.features[0]);
					}
					//setAxisVal(e.features[0].properties.lsoa11nm, e.features[0].properties["houseprice"]);
				}
		};



		function tog(v){return v?'addClass':'removeClass';}
		$(document).on('input', '.clearable', function(){
				$(this)[tog(this.value)]('x');
		}).on('mousemove', '.x', function( e ){
				$(this)[tog(this.offsetWidth-28 < e.clientX-this.getBoundingClientRect().left)]('onX');
		}).on('touchstart click', '.onX', function( ev ){
				ev.preventDefault();
				$(this).removeClass('x onX').val('').change();
				enableMouseEvents();
				onLeave();
				hideaxisVal();
		});



		function onLeave() {
				map.setFilter("lsoa-outlines-hover", ["==", "lsoa11cd", ""]);
				oldlsoa11cd = "";
				// $("#areaselect").val("").trigger("chosen:updated");
				hideaxisVal();
		};



		 function onClick(e) {
		 		disableMouseEvents();
				features =[];
				features[0] = e.features[0]
		 		newlsoa11cd = features[0].properties.lsoa11cd;

				lastpoint = e.point;

				if(newlsoa11cd != oldlsoa11cd) {
					if(map.getZoom() > 9) {
						//var features = map.queryRenderedFeatures(e.point,{layers: ['lsoa-outlines']});



					} else {
						//var features = map.queryRenderedFeatures(e.point,{layers: ['lsoa-outlines2']});

					}
				}

		 		// if(newlsoa11cd != oldlsoa11cd) {
		 		// 	oldlsoa11cd = features[0].properties.lsoa11cd;
		 		// 	map.setFilter("lsoa-outlines-hover", ["==", "lsoa11cd", features[0].properties.lsoa11cd]);
				//
		 		// 	 //selectArea(e.features[0].properties.lsoa11cd);
				// 	//updatePercent(features[0]);
				// 	setAxisVal(features[0].properties.lsoa11nm, features[0].properties.lsoa11cd,features[0].properties[hoverlayername],features[0].properties[secondvar]);
		 		// }

		 		// dataLayer.push({
        //      'event':'mapClickSelect',
        //      'selected': newlsoa11cd
        //  })
		 };

		function disableMouseEvents() {
				map.off("mousemove", "lsoa-outlines", onMove);
				map.off("mouseleave", "lsoa-outlines", onLeave);
				map.off("mousemove", "lsoa-outlines2", onMove);
				map.off("mouseleave", "lsoa-outlines2", onLeave);
		}

		function enableMouseEvents() {
				map.on("mousemove", "lsoa-outlines", onMove);
				map.on("click", "lsoa-outlines", onClick);
				map.on("mouseleave", "lsoa-outlines", onLeave);
				map.on("mousemove", "lsoa-outlines2", onMove);
				map.on("click", "lsoa-outlines2", onClick);
				map.on("mouseleave", "lsoa-outlines2", onLeave);
		}


		function setAxisVal(areanm, areacd, areaval, areanum) {

			d3.select("#keyvalue").style("font-weight","bold").html(function(){
				if(!isNaN(areaval)) {
					return areanm + "<br>" + displayformat(areaval) + "% (" + areanum +" " + dvc.householdOrPopulation[getindexoflayer] +")";
				} else {
					return areanm + "<br>" + displayformat(areaval) + "% (" + areanum +" " + dvc.householdOrPopulation[getindexoflayer] +")";
				}
			});

			d3.selectAll(".blocks").attr("stroke","black").attr("stroke-width","0px").lower();

			function blockLookup(areaval) {
				for (i = 0; i <= dvc.numberBreaks; i++) {
					if (areaval <= breaks[i]) {
						return i
					}
				}
				return dvc.numberBreaks;
			}
			d3.select("#block" + (blockLookup(areaval))).attr("stroke","orange").attr("stroke-width","3px").raise()

		}

		function hideaxisVal() {
			d3.select("#keyvalue").style("font-weight","bold").text("");

			d3.selectAll(".blocks").attr("stroke","black").attr("stroke-width","0px").lower();
			d3.selectAll(".legendRect").style("width","0px");

		}

		function createKey(config){

					d3.select("#key").selectAll("*").remove();

					keywidth = d3.select("#keydiv").node().getBoundingClientRect().width;

					var svgkey = d3.select("#key")
						.attr("width", keywidth)
						.attr("height",70);

					var color = d3.scaleThreshold()
					   .domain(breaks)
					   .range(colour);

					// Set up scales for legend
					x = d3.scaleLinear()
						.domain([breaks[0], breaks[dvc.numberBreaks]]) /*range for data*/
						.range([0,keywidth-30]); /*range for pixels*/


					var xAxis = d3.axisBottom(x)
						.tickSize(15)
						.tickValues(color.domain())
						.tickFormat(function(d) { return legendformat(d) + "%"; });

					var g2 = svgkey.append("g").attr("id","horiz")
						.attr("transform", "translate(15,5)");


					keyhor = d3.select("#horiz");

					g2.selectAll("rect")
						.data(color.range().map(function(d,i) {

						  return {
							x0: i ? x(color.domain()[i+1]) : x.range()[0],
							x1: i < color.domain().length ? x(color.domain()[i+1]) : x.range()[1],
							z: d
						  };
						}))
					  .enter().append("rect")
						.attr("id",function(d,i){return "block" + (i+1)})
						.attr("class", "blocks")
						.attr("height", 10)
						.attr("x", function(d) {
							 return d.x0; })
						.attr("width", function(d) {return d.x1 - d.x0; })
						.style("opacity",1)
						.attr("stroke","black")
						.attr("stroke-width","0px")
						.style("fill", function(d) { return d.z; });


					g2.append("line")
						.attr("id", "currLine")
						.attr("x1", x(10))
						.attr("x2", x(10))
						.attr("y1", -10)
						.attr("y2", 8)
						.attr("stroke-width","2px")
						.attr("stroke","#000")
						.attr("opacity",0);

					g2.append("text")
						.attr("id", "currVal")
						.attr("x", x(10))
						.attr("y", -15)
						.attr("fill","#000")
						.text("");



					keyhor.selectAll("rect")
						.data(color.range().map(function(d, i) {
						  return {
							x0: i ? x(color.domain()[i]) : x.range()[0],
							x1: i < color.domain().length ? x(color.domain()[i+1]) : x.range()[1],
							z: d
						  };
						}))
						.attr("x", function(d) { return d.x0; })
						.attr("width", function(d) { return d.x1 - d.x0; })
						.style("fill", function(d) { return d.z; });

					keyhor.call(xAxis).append("text")
						.attr("id", "caption")
						.attr("x", 0)
						.attr("y", 50)
						.attr("fill","#323132")
						.style("text-anchor","start")
						.attr("font-size","14px")
						.text(dvc.legendlabels[getindexoflayer]);

					keyhor.append("rect")
						.attr("id","keybar")
						.attr("width",8)
						.attr("height",0)
						.attr("transform","translate(15,0)")
						.style("fill", "#ccc")
						.attr("x",x(0));


					if(dvc.dropticks) {
						d3.select("#horiz").selectAll("text").attr("transform",function(d,i){
												// if there are more that 4 breaks, so > 5 ticks, then drop every other.
												if(i % 2){return "translate(0,10)"} }
										);
						//d3.select("#horiz").selectAll("text").attr("opacity",0);
					}


					//d3.selectAll(".tick text").attr("transform","translate(-" + (x.range()[1]/10)/2 + ",0)")
					//Temporary	hardcode unit text
					dvc.unittext = "change in life expectancy";

					// d3.select("#keyunits").append("p").style("float","left").attr("id","keyunit").style("margin-top","-10px").style("margin-left","18px").html(dvc.varunit);
					//d3.select("#keyunits").append("p").style("float","right").attr("id","keyunitR").style("margin-top","-10px").style("margin-right","18px").html(dvc.varunit2);
					//d3.select("#keyunits2").append("p").attr("width","100%").style("text-align","center").style("margin-top","-10px").style("margin-right","18px").html(dvc.varunit3);

			} // Ends create key

			function createLegend(keydata) {

				open = true;

				d3.select(".details__summary")
							.on("click",function(){
								if(open == true){
									d3.select(this).text("Show variables")
									open = false;
								} else {
									d3.select(this).text("Hide variables")
									open = true;
								}

							})

				//First get unique values in array (hierarchy)
				hierarchy = d3.set(dvc.structure).values();

				//merge structure and labels
				mergedvars = d3.zip(dvc.structure,dvc.legendvars)
				//draw radio buttons

				count = 0;

				hierarchy.forEach(function(k,j) {

						// d3.select("#radioselect")
						// 				.append("hr")

						detailshier = d3.select("#radioselect")
											.append("details")
											.attr("id", "details" + j)
											.attr("class", "detailsvar")
											.attr("role","group")
											.style("padding","0px 0px 0px 10px")
											.attr("min-height","30px")



										d3.select("#details0").property("open",true)


										detailshier.append("summary")
												.text(k)
												.style("font-weight","bold")
												.style("font-size","16px")
												.style("color","#206095")
												.style("margin-bottom","10px")
												.on("click", function(){
													// d3.selectAll(".detailsvar").property("open",false);
													// d3.select("details" + j).property("open",true);
												})



						radio = d3.select("#details" + j)
											.selectAll('rad')
											.data(mergedvars.filter(function(d,i){return d[0] == hierarchy[j]}))
											.enter()
											.append('div')
											.style("float","left")
											.style("width","100%")
											.style("padding-left","10px")
											.style("padding-right","10px")


							radio.append("input")
									.attr("id",function(d,i){return "radio"+(i + count)})
									.attr("class","input input--radio js-focusable")
									.attr("type","radio")
									.attr("name","layerchoice")
									.attr("value", function(d,i){return layernames[(i + count)]})
									.property("checked", function(d,i){if((count+i)==0){return true}})
									.on("click",repaintLayer)

							radio.append('label')
									.attr('class','legendlabel').text(function(d,i) {
										var value = parseFloat(d[1]).toFixed(1);
										return d[1];
									})
									.attr("value", function(d,i){return layernames[(i + count)]})
									.on("click",repaintLayer);


							optgroup = d3.select("#varselect")
								//.attr("name","select")
								.on("change",repaintLayer)
								.append("optgroup")
								.attr("label",k)

							optgroup.selectAll('option')
									.data(mergedvars.filter(function(d,i){return d[0] == hierarchy[j]}))
									.enter()
									.append("option")
									.attr("value", function(d,i){return layernames[(i + count)]})
									.text(function(d,i) {
										var value = parseFloat(d[1]).toFixed(1);
										return d[1];
									})
									//.on("click",repaintLayer);


							count = count + mergedvars.filter(function(d,i){return d[0] == hierarchy[j]}).length;

				});






					} //end createLegend


		function setLayerSource (layerId, source, sourceLayer) {
		    var oldLayers = map.getStyle().layers;
		    var layerIndex = oldLayers.findIndex(l => l.id === layerId);
		    var layerDef = oldLayers[layerIndex];
		    var before = oldLayers[layerIndex + 1] && oldLayers[layerIndex + 1].id;
		    layerDef.source = source;
		    if (sourceLayer) {
		        layerDef['source-layer'] = sourceLayer;
		    }
				currsource = map.getStyle().sources["imdlayer"];

		    map.removeLayer(layerId);
				map.removeSource(layerId);
		    map.addLayer(layerDef, before);
		}


			function repaintLayer(){

				if(d3.select(this).attr("id") == "varselect" ) {
					layername = d3.select(this).node().value;
				} else {
					layername = d3.select(this).attr("value");
				}


				getindexoflayer = layernames.indexOf(layername)
				hoverlayername = hoverlayernames[getindexoflayer];
				secondvar = secondvars[getindexoflayer];

				//redraw key
				breaks = config.ons.breaks[getindexoflayer];

				//createKey(config);

				d3.selectAll(".input--radio").property("checked",false);
				d3.selectAll("#radio" +getindexoflayer).property("checked",true);

				styleObject = {
					'property': layername,
					'default': '#666666',
					// Prevents interpolation of colors between stops
					'base': 0,
					'stops': [
						[dvc.breaks[getindexoflayer][0], '#7fcdbb'],
						[dvc.breaks[getindexoflayer][1], '#7fcdbb'],
						[dvc.breaks[getindexoflayer][2], '#41b6c4'],
						[dvc.breaks[getindexoflayer][3], '#1d91c0'],
						[dvc.breaks[getindexoflayer][4], '#225ea8'],
						[dvc.breaks[getindexoflayer][5], '#0c2c84']

					]
						}


				source1 = {
							"type": "vector",
							//"tiles": ["http://localhost:8000/boundaries/{z}/{x}/{y}.pbf"],
							"tiles": ["https://cdn.ons.gov.uk/maptiles/" + dvc.tileSet[getindexoflayer] + "/boundaries/{z}/{x}/{y}.pbf"],
						}

				source2 =		{
							"type": "vector",
							//"tiles": ["http://localhost:8000/tiles/{z}/{x}/{y}.pbf"],
							"tiles": ["https://cdn.ons.gov.uk/maptiles/" + dvc.tileSet[getindexoflayer] + "/tiles/{z}/{x}/{y}.pbf"],
						}

				//Reset sources if necessary (ie if variable belongs to different tileset)

				if(oldtileset != dvc.tileSet[getindexoflayer]) {
						setLayerSource("imdlayer",source2, dvc.sourceLayer[getindexoflayer])
						setLayerSource("lsoa-outlines",source1)
						setLayerSource("lsoa-outlines2",source1)
				}



				//repaint area layer map usign the styles above
				map.setPaintProperty("imdlayer", 'fill-color', styleObject);

				map.setPaintProperty("lsoa-outlines", 'fill-color', styleObject);

				map.setPaintProperty("lsoa-outlines2", 'fill-color', styleObject);

				function checkFeaturesHigh() {
						features = map.queryRenderedFeatures(lastpoint,{layers: ['lsoa-outlines']});
						if(typeof features[0].properties[hoverlayername] != undefined) {
							clearInterval(keepchecking);
							//setAxisVal(features[0].properties.lsoa11nm, features[0].properties.lsoa11cd,features[0].properties[hoverlayername],features[0].properties[secondvar]);
						}
				}

				function checkFeaturesLow() {
					  features = map.queryRenderedFeatures(lastpoint,{layers: ['lsoa-outlines2']});
						if(typeof features[0].properties[hoverlayername] != undefined) {
							clearInterval(keepchecking);
							//setAxisVal(features[0].properties.lsoa11nm, features[0].properties.lsoa11cd,features[0].properties[hoverlayername],features[0].properties[secondvar]);
						}
				}

				function myStopFunction() {
				  clearInterval(myVar);
				}

					//var features = map.queryRenderedFeatures(e.point,{layers: ['lsoa-outlines2']});
					if(lastpoint!= null) {
						if(map.getZoom() > 9) {
							var keepchecking = setInterval(checkFeaturesHigh,100)
						} else {
							var keepchecking = setInterval(checkFeaturesLow,100);
						}
					}

					//setAxisVal(features[0].properties.lsoa11nm, features[0].properties.lsoa11cd,features[0].properties[hoverlayername],features[0].properties[secondvar]);

 			 //}

			 oldtileset = dvc.tileSet[getindexoflayer]

			}



	function addFullscreen() {

		currentBody = d3.select("#map").style("height");
		d3.select(".mapboxgl-ctrl-fullscreen").on("click", setbodyheight)

	}

	function setbodyheight() {
		d3.select("#map").style("height","100%");

		document.addEventListener('webkitfullscreenchange', exitHandler, false);
		document.addEventListener('mozfullscreenchange', exitHandler, false);
		document.addEventListener('fullscreenchange', exitHandler, false);
		document.addEventListener('MSFullscreenChange', exitHandler, false);

	}


	function exitHandler() {
			if (document.webkitIsFullScreen === false)
			{
				shrinkbody();
			}
			else if (document.mozFullScreen === false)
			{
				shrinkbody();
			}
			else if (document.msFullscreenElement === false)
			{
				shrinkbody();
			}
		}

	function shrinkbody() {
		d3.select("#map").style("height",currentBody);
		pymChild.sendHeight();
	}

	function geolocate() {
		// dataLayer.push({
		// 						'event': 'geoLocate',
		// 						'selected': 'geolocate'
		// })

		var options = {
		  enableHighAccuracy: true,
		  timeout: 5000,
		  maximumAge: 0
		};

		navigator.geolocation.getCurrentPosition(success, error, options);
	}

	function getCodes(myPC)	{

		//first show the remove cross
		d3.select(".search-control").append("abbr").attr("class","postcode");

			// dataLayer.push({
			// 					 'event': 'geoLocate',
			// 					 'selected': 'postcode'
			// 				 })

			var myURIstring=encodeURI("https://api.postcodes.io/postcodes/"+myPC);
			$.support.cors = true;
			$.ajax({
				type: "GET",
				crossDomain: true,
				dataType: "jsonp",
				url: myURIstring,
				error: function (xhr, ajaxOptions, thrownError) {
					},
				success: function(data1){
					if(data1.status == 200 ){
						//$("#pcError").hide();
						lat =data1.result.latitude;
						lng = data1.result.longitude;
						successpc(lat,lng)
					} else {
						$(".search-control").val("Sorry, invalid postcode.");
					}
				}

			});

		}


	function successpc(lat,lng) {

		map.jumpTo({center:[lng,lat], zoom:12})
		point = map.project([lng,lat]);

		setTimeout(function(){

		var tilechecker = setInterval(function(){
			 features=null
		 	features = map.queryRenderedFeatures(point,{layers: ['lsoa-outlines']});
		 	if(features.length != 0){
		 		 //onrender(),
		 		map.setFilter("lsoa-outlines-hover", ["==", "lsoa11cd", features[0].properties.lsoa11cd]);
				//var features = map.queryRenderedFeatures(point);
				disableMouseEvents();
				//setAxisVal(features[0].properties.lsoa11nm, features[0].properties.lsoa11cd,features[0].properties[hoverlayername],features[0].properties[secondvar]);
				//updatePercent(features[0]);
		 		clearInterval(tilechecker);

				lastpoint = point;
		 	}
		 },500)
		},500);




	};

		function selectlist(datacsv) {

			var areacodes =  datacsv.map(function(d) { return d.lsoa11cd; });
			var areanames =  datacsv.map(function(d) { return d.lsoa11nm; });
			var menuarea = d3.zip(areanames,areacodes).sort(function(a, b){ return d3.ascending(a[0], b[0]); });

			// Build option menu for occupations
			var optns = d3.select("#selectNav").append("div").attr("id","sel").append("select")
				.attr("id","areaselect")
				.attr("style","width:98%")
				.attr("class","chosen-select");


			optns.append("option")
				.attr("value","first")
				.text("");

			optns.selectAll("p").data(menuarea).enter().append("option")
				.attr("value", function(d){ return d[1]})
				.text(function(d){ return d[0]});

			myId=null;

			$('#areaselect').chosen({width: "98%", allow_single_deselect:true}).on('change',function(evt,params){

					if(typeof params != 'undefined') {

							disableMouseEvents();

							map.setFilter("lsoa-outlines-hover", ["==", "lsoa11cd", params.selected]);

							selectArea(params.selected);
							//setAxisVal(params.selected);

							zoomToArea(params.selected);

							// dataLayer.push({
							// 		'event': 'mapDropSelect',
							// 		'selected': params.selected
							// })
					}
					else {
							enableMouseEvents();
							hideaxisVal();
							onLeave();
							resetZoom();
					}

			});

	};

	}

} else {

	//provide fallback for browsers that don't support webGL
	d3.select('#map').remove();
	d3.select('body').append('p').html("Unfortunately your browser does not support WebGL. <a href='https://www.gov.uk/help/browsers' target='_blank>'>If you're able to please upgrade to a modern browser</a>")

}
